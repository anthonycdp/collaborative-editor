/**
 * Tests for RoomManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { RoomManager } from '../src/server/room-manager.js';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  afterEach(() => {
    roomManager.destroy();
  });

  describe('getOrCreateRoom', () => {
    it('should create a new room if it does not exist', () => {
      const room = roomManager.getOrCreateRoom('test-room');

      expect(room).toBeDefined();
      expect(room.doc).toBeInstanceOf(Y.Doc);
      expect(room.connections.size).toBe(0);
      expect(room.metadata.id).toBe('test-room');
      expect(room.metadata.name).toBe('test-room');
    });

    it('should return existing room if it already exists', () => {
      const room1 = roomManager.getOrCreateRoom('test-room');
      const room2 = roomManager.getOrCreateRoom('test-room');

      expect(room1).toBe(room2);
    });

    it('should create room with custom name', () => {
      const room = roomManager.getOrCreateRoom('test-room', 'My Room');

      expect(room.metadata.name).toBe('My Room');
    });
  });

  describe('getRoom', () => {
    it('should return undefined for non-existent room', () => {
      const room = roomManager.getRoom('non-existent');

      expect(room).toBeUndefined();
    });

    it('should return existing room', () => {
      roomManager.getOrCreateRoom('test-room');
      const room = roomManager.getRoom('test-room');

      expect(room).toBeDefined();
    });
  });

  describe('addConnection', () => {
    it('should add connection to room', () => {
      const mockWs = {} as WebSocket;
      const room = roomManager.addConnection('test-room', mockWs);

      expect(room.connections.size).toBe(1);
      expect(room.connections.has(mockWs)).toBe(true);
      expect(room.metadata.userCount).toBe(1);
    });

    it('should create room if it does not exist', () => {
      const mockWs = {} as WebSocket;
      const room = roomManager.addConnection('new-room', mockWs);

      expect(room).toBeDefined();
      expect(room.metadata.id).toBe('new-room');
    });
  });

  describe('removeConnection', () => {
    it('should remove connection from room', () => {
      const mockWs = {} as WebSocket;
      roomManager.addConnection('test-room', mockWs);
      roomManager.removeConnection('test-room', mockWs);

      const room = roomManager.getRoom('test-room');
      expect(room?.connections.size).toBe(0);
      expect(room?.metadata.userCount).toBe(0);
    });

    it('should handle removing from non-existent room', () => {
      const mockWs = {} as WebSocket;

      expect(() => {
        roomManager.removeConnection('non-existent', mockWs);
      }).not.toThrow();
    });
  });

  describe('getAllRooms', () => {
    it('should return empty array when no rooms exist', () => {
      const rooms = roomManager.getAllRooms();

      expect(rooms).toEqual([]);
    });

    it('should return all room metadata', () => {
      roomManager.getOrCreateRoom('room-1');
      roomManager.getOrCreateRoom('room-2');

      const rooms = roomManager.getAllRooms();

      expect(rooms).toHaveLength(2);
      expect(rooms.map((r) => r.id)).toContain('room-1');
      expect(rooms.map((r) => r.id)).toContain('room-2');
    });
  });

  describe('getRoomMetadata', () => {
    it('should return undefined for non-existent room', () => {
      const metadata = roomManager.getRoomMetadata('non-existent');

      expect(metadata).toBeUndefined();
    });

    it('should return room metadata with document size', () => {
      const room = roomManager.getOrCreateRoom('test-room');
      room.doc.getText('content').insert(0, 'Hello, World!');

      const metadata = roomManager.getRoomMetadata('test-room');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('test-room');
      expect(metadata?.documentSize).toBeGreaterThan(0);
    });
  });

  describe('destroy', () => {
    it('should clean up all rooms', () => {
      roomManager.getOrCreateRoom('room-1');
      roomManager.getOrCreateRoom('room-2');

      roomManager.destroy();

      const rooms = roomManager.getAllRooms();
      expect(rooms).toHaveLength(0);
    });
  });
});
