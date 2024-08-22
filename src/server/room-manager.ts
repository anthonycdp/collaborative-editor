/**
 * Room Manager - Manages collaborative editing rooms and their documents
 */

import * as Y from 'yjs';
import { WebSocket } from 'ws';
import type { RoomMetadata } from '../shared/types.js';

const ROOM_CLEANUP_DELAY_MS = 60000; // 1 minute

export interface RoomState {
  doc: Y.Doc;
  connections: Set<WebSocket>;
  metadata: RoomMetadata;
  cleanupTimeout?: NodeJS.Timeout;
}

/**
 * Manages all collaborative editing rooms
 */
export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  /**
   * Get or create a room with the given ID
   */
  getOrCreateRoom(roomId: string, roomName?: string): RoomState {
    let room = this.rooms.get(roomId);

    if (!room) {
      const doc = new Y.Doc();
      const now = Date.now();

      room = {
        doc,
        connections: new Set(),
        metadata: {
          id: roomId,
          name: roomName ?? roomId,
          createdAt: now,
          updatedAt: now,
          documentSize: 0,
          userCount: 0,
        },
      };

      this.rooms.set(roomId, room);
    }

    return room;
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Add a connection to a room
   */
  addConnection(roomId: string, ws: WebSocket): RoomState {
    const room = this.getOrCreateRoom(roomId);

    // Cancel pending cleanup if room was empty
    this.cancelCleanup(room);

    room.connections.add(ws);
    room.metadata.userCount = room.connections.size;
    room.metadata.updatedAt = Date.now();

    return room;
  }

  /**
   * Remove a connection from a room
   */
  removeConnection(roomId: string, ws: WebSocket): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.connections.delete(ws);
    room.metadata.userCount = room.connections.size;
    room.metadata.updatedAt = Date.now();

    // Schedule cleanup if room is now empty
    if (room.connections.size === 0) {
      this.scheduleCleanup(roomId, room);
    }
  }

  /**
   * Schedule room cleanup after delay
   */
  private scheduleCleanup(roomId: string, room: RoomState): void {
    room.cleanupTimeout = setTimeout(() => {
      if (room.connections.size === 0) {
        this.rooms.delete(roomId);
        room.doc.destroy();
      }
    }, ROOM_CLEANUP_DELAY_MS);
  }

  /**
   * Cancel pending room cleanup
   */
  private cancelCleanup(room: RoomState): void {
    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
      room.cleanupTimeout = undefined;
    }
  }

  /**
   * Get all room metadata
   */
  getAllRooms(): RoomMetadata[] {
    return Array.from(this.rooms.values()).map((room) => ({
      ...room.metadata,
      documentSize: this.calculateDocumentSize(room),
    }));
  }

  /**
   * Get room metadata
   */
  getRoomMetadata(roomId: string): RoomMetadata | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    return {
      ...room.metadata,
      documentSize: this.calculateDocumentSize(room),
    };
  }

  /**
   * Calculate the document size in bytes
   */
  private calculateDocumentSize(room: RoomState): number {
    const update = Y.encodeStateAsUpdate(room.doc);
    return update.byteLength;
  }

  /**
   * Clean up all rooms and pending timeouts
   */
  destroy(): void {
    for (const room of this.rooms.values()) {
      this.cancelCleanup(room);
      room.doc.destroy();
    }
    this.rooms.clear();
  }
}
