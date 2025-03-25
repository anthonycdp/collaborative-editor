/**
 * Tests for PersistenceManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';
import { PersistenceManager } from '../src/server/persistence.js';

const TEST_PERSISTENCE_DIR = path.join(process.cwd(), '.test-persistence');

describe('PersistenceManager', () => {
  let persistenceManager: PersistenceManager;

  beforeEach(() => {
    persistenceManager = new PersistenceManager(TEST_PERSISTENCE_DIR);
  });

  afterEach(() => {
    persistenceManager.destroy();
    // Clean up test directory
    if (fs.existsSync(TEST_PERSISTENCE_DIR)) {
      fs.rmSync(TEST_PERSISTENCE_DIR, { recursive: true });
    }
  });

  describe('hasDocument', () => {
    it('should return false for non-existent document', () => {
      expect(persistenceManager.hasDocument('non-existent')).toBe(false);
    });

    it('should return true for existing document', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test content');

      persistenceManager.saveDocument('test-room', doc);

      // Wait for debounce to complete
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(persistenceManager.hasDocument('test-room')).toBe(true);
          resolve();
        }, 1500);
      });
    });
  });

  describe('saveDocument and loadDocument', () => {
    it('should save and load document', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Hello, World!');

      // Save the document
      persistenceManager.saveDocument('test-room', doc);

      // Wait for debounce
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Load into new document
          const loadedDoc = new Y.Doc();
          const loaded = persistenceManager.loadDocument('test-room', loadedDoc);

          expect(loaded).toBe(true);
          expect(loadedDoc.getText('content').toString()).toBe('Hello, World!');
          resolve();
        }, 1500);
      });
    });

    it('should handle loading non-existent document', () => {
      const doc = new Y.Doc();
      const loaded = persistenceManager.loadDocument('non-existent', doc);

      expect(loaded).toBe(false);
    });

    it('should preserve document state across save/load cycles', () => {
      const doc = new Y.Doc();
      const text = doc.getText('content');
      text.insert(0, 'Line 1\n');
      text.insert(7, 'Line 2\n');
      text.insert(14, 'Line 3');

      return new Promise<void>((resolve) => {
        persistenceManager.saveDocument('test-room', doc);

        setTimeout(() => {
          const loadedDoc = new Y.Doc();
          persistenceManager.loadDocument('test-room', loadedDoc);

          expect(loadedDoc.getText('content').toString()).toBe('Line 1\nLine 2\nLine 3');
          resolve();
        }, 1500);
      });
    });
  });

  describe('deleteDocument', () => {
    it('should delete existing document', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test');

      return new Promise<void>((resolve) => {
        persistenceManager.saveDocument('test-room', doc);

        setTimeout(() => {
          expect(persistenceManager.hasDocument('test-room')).toBe(true);

          const deleted = persistenceManager.deleteDocument('test-room');
          expect(deleted).toBe(true);
          expect(persistenceManager.hasDocument('test-room')).toBe(false);

          resolve();
        }, 1500);
      });
    });

    it('should return false when deleting non-existent document', () => {
      const deleted = persistenceManager.deleteDocument('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getAllPersistedRooms', () => {
    it('should return empty array when no rooms exist', () => {
      const rooms = persistenceManager.getAllPersistedRooms();
      expect(rooms).toEqual([]);
    });

    it('should return all persisted room IDs', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test');

      return new Promise<void>((resolve) => {
        persistenceManager.saveDocument('room-1', doc);
        persistenceManager.saveDocument('room-2', doc);

        setTimeout(() => {
          const rooms = persistenceManager.getAllPersistedRooms();

          expect(rooms).toContain('room-1');
          expect(rooms).toContain('room-2');

          resolve();
        }, 1500);
      });
    });
  });

  describe('getDocumentStats', () => {
    it('should return null for non-existent document', () => {
      const stats = persistenceManager.getDocumentStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return stats for existing document', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test content');

      return new Promise<void>((resolve) => {
        persistenceManager.saveDocument('test-room', doc);

        setTimeout(() => {
          const stats = persistenceManager.getDocumentStats('test-room');

          expect(stats).toBeDefined();
          expect(stats?.size).toBeGreaterThan(0);
          expect(stats?.lastModified).toBeInstanceOf(Date);

          resolve();
        }, 1500);
      });
    });
  });

  describe('security', () => {
    it('should sanitize room IDs to prevent directory traversal', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test');

      // Attempt to write outside persistence directory
      persistenceManager.saveDocument('../../../malicious', doc);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // The file should be created with sanitized name
          const files = fs.readdirSync(TEST_PERSISTENCE_DIR);
          expect(files.some((f) => f.includes('malicious'))).toBe(true);
          expect(files.some((f) => f.includes('..'))).toBe(false);

          resolve();
        }, 1500);
      });
    });
  });
});
