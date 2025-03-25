/**
 * Tests for Yjs CRDT functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';

describe('Yjs CRDT', () => {
  describe('Y.Text', () => {
    let doc: Y.Doc;
    let text: Y.Text;

    beforeEach(() => {
      doc = new Y.Doc();
      text = doc.getText('content');
    });

    it('should insert text', () => {
      text.insert(0, 'Hello');
      expect(text.toString()).toBe('Hello');
    });

    it('should delete text', () => {
      text.insert(0, 'Hello, World!');
      text.delete(5, 8);
      expect(text.toString()).toBe('Hello');
    });

    it('should handle concurrent inserts', () => {
      const doc2 = new Y.Doc();
      const text2 = doc2.getText('content');

      // Sync docs
      doc.on('update', (update: Uint8Array) => {
        Y.applyUpdate(doc2, update);
      });
      doc2.on('update', (update: Uint8Array) => {
        Y.applyUpdate(doc, update);
      });

      text.insert(0, 'Hello');
      text2.insert(0, 'World');

      // Both should converge
      expect(text.toString()).toBe(text2.toString());
    });

    it('should handle formatting', () => {
      text.insert(0, 'Hello, World!');
      text.format(0, 5, { bold: true });

      const delta = text.toDelta();
      expect(delta[0].attributes?.bold).toBe(true);
    });
  });

  describe('Document Sync', () => {
    it('should sync full document state', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.getText('content').insert(0, 'Hello from doc1');

      const state = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state);

      expect(doc2.getText('content').toString()).toBe('Hello from doc1');
    });

    it('should sync incremental updates', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // Initial sync
      const state1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state1);

      // Apply update from doc1
      doc1.getText('content').insert(0, 'Hello');
      const update = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      Y.applyUpdate(doc2, update);

      expect(doc2.getText('content').toString()).toBe('Hello');
    });

    it('should handle merge conflicts with CRDT', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // Both docs start with same content
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      text1.insert(0, 'AB');
      text2.insert(0, 'CD');

      // Sync both ways
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Both should have the same content (CRDT merge)
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString().length).toBe(4);
    });
  });

  describe('State Vectors', () => {
    it('should encode and decode state vectors', () => {
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test content');

      const sv = Y.encodeStateVector(doc);

      expect(sv).toBeInstanceOf(Uint8Array);
      expect(sv.byteLength).toBeGreaterThan(0);
    });

    it('should compute minimal updates', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.getText('content').insert(0, 'Hello');

      // Sync doc1 to doc2
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // doc1 has more changes
      doc1.getText('content').insert(5, ', World');

      // Compute diff
      const sv2 = Y.encodeStateVector(doc2);
      const diff = Y.encodeStateAsUpdate(doc1, sv2);

      // Apply diff
      Y.applyUpdate(doc2, diff);

      expect(doc2.getText('content').toString()).toBe('Hello, World');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve concurrent inserts at same position', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial content
      text1.insert(0, 'AC');
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Concurrent inserts
      text1.insert(1, 'B'); // 'ABC'
      text2.insert(1, 'D'); // 'ADC'

      // Sync
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Both should have consistent state
      expect(text1.toString()).toBe(text2.toString());
    });

    it('should handle overlapping deletes', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      text1.insert(0, 'Hello World');
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Concurrent deletes
      text1.delete(0, 6); // 'World'
      text2.delete(5, 6); // 'Hello'

      // Sync
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Both should have consistent state
      expect(text1.toString()).toBe(text2.toString());
    });
  });
});
