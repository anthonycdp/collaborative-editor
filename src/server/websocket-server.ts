/**
 * WebSocket Server for Yjs collaboration
 * Implements the y-protocols sync protocol
 */

import { WebSocketServer as WSServer, WebSocket, RawData } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import { encoding, decoding } from 'lib0';
import { RoomManager } from './room-manager.js';
import { PersistenceManager } from './persistence.js';
import type { ServerConfig } from '../shared/types.js';
import { DEFAULT_SERVER_CONFIG } from '../shared/constants.js';

const { createEncoder, toUint8Array, writeVarUint, writeVarUint8Array } = encoding;
const { readVarUint, Decoder } = decoding;

/**
 * Message types from y-protocols
 */
const messageSync = 0;
const messageAwareness = 1;

/**
 * WebSocket with room tracking
 */
interface ClientWebSocket extends WebSocket {
  roomId?: string;
  clientID?: number;
  isConnected?: boolean;
}

/**
 * WebSocket server for collaborative editing
 */
export class CollaborationServer {
  private wss: WSServer;
  private roomManager: RoomManager;
  private persistenceManager: PersistenceManager;
  private config: ServerConfig;
  private server?: http.Server;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...config } as ServerConfig;
    this.roomManager = new RoomManager();
    this.persistenceManager = new PersistenceManager();
    this.wss = new WSServer({ noServer: true });

    this.setupWebSocketHandlers();
  }

  /**
   * Attach to an existing HTTP server
   */
  attach(server: http.Server): void {
    this.server = server;

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '', `http://${request.headers.host}`);
      const roomId = this.extractRoomId(url.pathname);

      if (!roomId) {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as ClientWebSocket).roomId = roomId;
        this.wss.emit('connection', ws, request);
      });
    });
  }

  /**
   * Start the server standalone
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer();
      this.attach(this.server);

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(
          `Collaboration server running on ws://${this.config.host}:${this.config.port}`
        );
        resolve();
      });
    });
  }

  /**
   * Extract room ID from URL path
   */
  private extractRoomId(pathname: string): string | null {
    // Expected format: /ws/<room-id> or /<room-id>
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    // If first part is 'ws', use second part as room ID
    if (parts[0] === 'ws' && parts.length > 1) {
      return parts[1];
    }

    return parts[0];
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: ClientWebSocket, _request) => {
      const roomId = ws.roomId;
      if (!roomId) {
        ws.close();
        return;
      }

      const room = this.roomManager.getOrCreateRoom(roomId);
      ws.clientID = room.doc.clientID;
      ws.isConnected = true;

      // Load persisted document if available
      if (this.config.persistenceEnabled) {
        this.persistenceManager.loadDocument(roomId, room.doc);
      }

      // Add connection to room
      this.roomManager.addConnection(roomId, ws);

      // Initialize awareness for this client
      const awareness = this.getAwareness(room);
      awareness.setLocalState(null);

      // Send initial sync state
      this.sendSyncStep1(ws, room.doc);

      // Set up message handler
      ws.on('message', (data: RawData) => {
        this.handleMessage(ws, data, room);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws, room);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws, room);
      });
    });
  }

  /**
   * Get or create awareness instance for a room
   */
  private awarenessInstances: Map<string, awarenessProtocol.Awareness> = new Map();

  private getAwareness(room: ReturnType<typeof this.roomManager.getOrCreateRoom>): awarenessProtocol.Awareness {
    let awareness = this.awarenessInstances.get(room.metadata.id);
    if (!awareness) {
      awareness = new awarenessProtocol.Awareness(room.doc);
      this.awarenessInstances.set(room.metadata.id, awareness);
    }
    return awareness;
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(
    ws: ClientWebSocket,
    data: RawData,
    room: ReturnType<typeof this.roomManager.getOrCreateRoom>
  ): void {
    if (!(data instanceof Buffer)) {
      data = Buffer.from(data as ArrayBuffer);
    }

    const decoder = new Decoder(data as Uint8Array);
    const messageType = readVarUint(decoder);

    switch (messageType) {
      case messageSync:
        this.handleSyncMessage(ws, decoder, room, data as Uint8Array);
        break;
      case messageAwareness:
        this.handleAwarenessMessage(ws, decoder, room);
        break;
      default:
        console.warn(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Handle sync protocol message
   */
  private handleSyncMessage(
    ws: ClientWebSocket,
    decoder: decoding.Decoder,
    room: ReturnType<typeof this.roomManager.getOrCreateRoom>,
    rawData: Uint8Array
  ): void {
    const encoder = createEncoder();
    const syncType = readVarUint(decoder);

    switch (syncType) {
      case syncProtocol.messageYjsSyncStep1:
        // Client is requesting our state
        syncProtocol.readSyncStep1(decoder, encoder, room.doc);
        break;
      case syncProtocol.messageYjsSyncStep2:
        // Client is sending their state
        syncProtocol.readSyncStep2(decoder, room.doc, ws);
        // Broadcast to other clients
        this.broadcast(room, toUint8Array(encoder), ws);
        // Save document
        if (this.config.persistenceEnabled) {
          this.persistenceManager.saveDocument(room.metadata.id, room.doc);
        }
        return;
      case syncProtocol.messageYjsUpdate:
        // Client is sending an update
        syncProtocol.readUpdate(decoder, room.doc, ws);
        // Broadcast the raw update to other clients
        this.broadcast(room, rawData, ws);
        // Save document
        if (this.config.persistenceEnabled) {
          this.persistenceManager.saveDocument(room.metadata.id, room.doc);
        }
        return;
      default:
        return;
    }

    // Send response if encoder has content
    const response = toUint8Array(encoder);
    if (response.byteLength > 1) {
      ws.send(response);
    }
  }

  /**
   * Handle awareness protocol message
   */
  private handleAwarenessMessage(
    ws: ClientWebSocket,
    decoder: decoding.Decoder,
    room: ReturnType<typeof this.roomManager.getOrCreateRoom>
  ): void {
    const awareness = this.getAwareness(room);
    awarenessProtocol.applyAwarenessUpdate(
      awareness,
      decoding.readVarUint8Array(decoder),
      ws
    );

    // Broadcast awareness update to all clients
    const encoder = createEncoder();
    writeVarUint(encoder, messageAwareness);
    writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awareness.getStates().keys())
      )
    );
    this.broadcast(room, toUint8Array(encoder));
  }

  /**
   * Send sync step 1 to client (request their state)
   */
  private sendSyncStep1(ws: ClientWebSocket, doc: Y.Doc): void {
    const encoder = createEncoder();
    writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(toUint8Array(encoder));
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(
    ws: ClientWebSocket,
    room: ReturnType<typeof this.roomManager.getOrCreateRoom>
  ): void {
    if (!ws.roomId) return;

    // Remove from awareness
    const awareness = this.getAwareness(room);
    awarenessProtocol.removeAwarenessStates(awareness, [ws.clientID!], 'disconnect');

    // Remove from room
    this.roomManager.removeConnection(ws.roomId, ws);
    ws.isConnected = false;
  }

  /**
   * Broadcast message to all clients in room except sender
   */
  private broadcast(
    room: ReturnType<typeof this.roomManager.getOrCreateRoom>,
    message: Uint8Array,
    exclude?: WebSocket
  ): void {
    for (const client of room.connections) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Get room manager
   */
  getRoomManager(): RoomManager {
    return this.roomManager;
  }

  /**
   * Get persistence manager
   */
  getPersistenceManager(): PersistenceManager {
    return this.persistenceManager;
  }

  /**
   * Close the server
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.roomManager.destroy();
          this.persistenceManager.destroy();
          resolve();
        }
      });
    });
  }
}

export default CollaborationServer;
