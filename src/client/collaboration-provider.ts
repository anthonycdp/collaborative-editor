/**
 * Collaboration Provider - Handles WebSocket connection and Yjs sync
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import { encoding, decoding } from 'lib0';
import type { UserPresence, ConnectionStatus } from '../shared/types.js';
import { TIMEOUTS } from '../shared/constants.js';
import { createUser } from '../shared/utils.js';

const { createEncoder, toUint8Array, writeVarUint, writeVarUint8Array } = encoding;
const { readVarUint, Decoder } = decoding;

// Message types
const messageSync = 0;
const messageAwareness = 1;

export interface CollaborationProviderOptions {
  serverUrl: string;
  room: string;
  user?: Partial<UserPresence>;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onSyncChange?: (synced: boolean) => void;
  onAwarenessChange?: (states: Map<number, unknown>) => void;
  reconnect?: boolean;
}

/**
 * Collaboration Provider
 * Manages WebSocket connection and Yjs document synchronization
 */
export class CollaborationProvider {
  public doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;
  public synced = false;

  private ws: WebSocket | null = null;
  private options: CollaborationProviderOptions;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = true;

  constructor(options: CollaborationProviderOptions) {
    this.options = options;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Set initial user state
    const user = createUser(options.user?.id, options.user?.name);
    this.awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color,
    });

    // Set up awareness change handler
    this.awareness.on('change', () => {
      this.options.onAwarenessChange?.(this.awareness.getStates());
    });

    // Connect if not explicitly disabled
    if (options.reconnect !== false) {
      this.connect();
    }
  }

  /**
   * Get the shared text type
   */
  getText(name: string = 'content'): Y.Text {
    return this.doc.getText(name);
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Update local user presence
   */
  setLocalPresence(data: Partial<UserPresence>): void {
    const currentState = this.awareness.getLocalState() ?? {};
    this.awareness.setLocalStateField('user', {
      ...currentState.user,
      ...data,
    });
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.shouldConnect = true;
    this.setStatus('connecting');

    const url = `${this.options.serverUrl}/ws/${this.options.room}`;

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');

        // Send sync step 1
        this.sendSyncStep1();

        // Broadcast awareness
        this.broadcastAwareness();

        // Set sync timeout
        this.syncTimeout = setTimeout(() => {
          if (!this.synced) {
            console.warn('Sync timeout');
          }
        }, TIMEOUTS.SYNC_TIMEOUT);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(new Uint8Array(event.data as ArrayBuffer));
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.shouldConnect = false;
    this.clearTimeouts();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Remove local awareness state
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      'disconnect'
    );

    this.setStatus('disconnected');
  }

  /**
   * Destroy the provider
   */
  destroy(): void {
    this.disconnect();
    this.awareness.destroy();
    this.doc.destroy();
  }

  /**
   * Set connection status and notify listeners
   */
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.onConnectionChange?.(status);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: Uint8Array): void {
    const decoder = new Decoder(data);
    const messageType = readVarUint(decoder);

    switch (messageType) {
      case messageSync:
        this.handleSyncMessage(decoder);
        break;
      case messageAwareness:
        this.handleAwarenessMessage(decoder);
        break;
    }
  }

  /**
   * Handle sync protocol message
   */
  private handleSyncMessage(decoder: decoding.Decoder): void {
    const encoder = createEncoder();
    const syncType = readVarUint(decoder);

    switch (syncType) {
      case syncProtocol.messageYjsSyncStep1:
        syncProtocol.readSyncStep1(decoder, encoder, this.doc);
        break;
      case syncProtocol.messageYjsSyncStep2:
        syncProtocol.readSyncStep2(decoder, this.doc, this);
        this.setSynced(true);
        break;
      case syncProtocol.messageYjsUpdate:
        syncProtocol.readUpdate(decoder, this.doc, this);
        break;
      default:
        return;
    }

    // Send response if encoder has content
    const response = toUint8Array(encoder);
    if (response.byteLength > 1) {
      this.send(response);
    }
  }

  /**
   * Handle awareness protocol message
   */
  private handleAwarenessMessage(decoder: decoding.Decoder): void {
    awarenessProtocol.applyAwarenessUpdate(
      this.awareness,
      decoding.readVarUint8Array(decoder),
      this
    );
  }

  /**
   * Send sync step 1 (request state from server)
   */
  private sendSyncStep1(): void {
    const encoder = createEncoder();
    writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send(toUint8Array(encoder));
  }

  /**
   * Broadcast awareness state
   */
  private broadcastAwareness(): void {
    if (this.awareness.getLocalState() !== null) {
      const encoder = createEncoder();
      writeVarUint(encoder, messageAwareness);
      writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
          this.doc.clientID,
        ])
      );
      this.send(toUint8Array(encoder));
    }
  }

  /**
   * Send data to the server
   */
  private send(data: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Set sync status and notify listeners
   */
  private setSynced(synced: boolean): void {
    if (this.synced !== synced) {
      this.synced = synced;
      this.options.onSyncChange?.(synced);

      if (synced && this.syncTimeout) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
      }
    }
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(): void {
    this.setSynced(false);

    // Notify awareness that we're offline
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      'disconnect'
    );

    if (this.shouldConnect) {
      this.scheduleReconnect();
    } else {
      this.setStatus('disconnected');
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.setStatus('reconnecting');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      TIMEOUTS.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      TIMEOUTS.RECONNECT_MAX_DELAY
    );

    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      if (this.shouldConnect) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Clear all timeouts
   */
  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
}

export default CollaborationProvider;
