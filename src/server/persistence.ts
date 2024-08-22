/**
 * Persistence Manager - Handles document persistence to storage
 */

import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';

const PERSISTENCE_DIR = path.join(process.cwd(), '.persistence');

/**
 * Manages document persistence to disk
 */
export class PersistenceManager {
  private persistenceDir: string;
  private saveQueue: Map<string, NodeJS.Timeout> = new Map();

  constructor(persistenceDir: string = PERSISTENCE_DIR) {
    this.persistenceDir = persistenceDir;

    // Ensure persistence directory exists
    if (!fs.existsSync(this.persistenceDir)) {
      fs.mkdirSync(this.persistenceDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a room's document
   */
  private getFilePath(roomId: string): string {
    // Sanitize room ID to prevent directory traversal
    const sanitized = roomId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.persistenceDir, `${sanitized}.ydoc`);
  }

  /**
   * Save a document to disk
   */
  saveDocument(roomId: string, doc: Y.Doc): void {
    const filePath = this.getFilePath(roomId);
    const update = Y.encodeStateAsUpdate(doc);

    // Clear any pending save for this room
    const pending = this.saveQueue.get(roomId);
    if (pending) {
      clearTimeout(pending);
    }

    // Schedule a save after the interval (debounce)
    const timeout = setTimeout(() => {
      try {
        fs.writeFileSync(filePath, Buffer.from(update));
        this.saveQueue.delete(roomId);
      } catch (error) {
        console.error(`Failed to save document for room ${roomId}:`, error);
      }
    }, 1000); // 1 second debounce

    this.saveQueue.set(roomId, timeout);
  }

  /**
   * Load a document from disk
   */
  loadDocument(roomId: string, doc: Y.Doc): boolean {
    const filePath = this.getFilePath(roomId);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const update = new Uint8Array(buffer);
      Y.applyUpdate(doc, update);
      return true;
    } catch (error) {
      console.error(`Failed to load document for room ${roomId}:`, error);
      return false;
    }
  }

  /**
   * Check if a persisted document exists
   */
  hasDocument(roomId: string): boolean {
    const filePath = this.getFilePath(roomId);
    return fs.existsSync(filePath);
  }

  /**
   * Delete a persisted document
   */
  deleteDocument(roomId: string): boolean {
    const filePath = this.getFilePath(roomId);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch (error) {
        console.error(`Failed to delete document for room ${roomId}:`, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get all persisted room IDs
   */
  getAllPersistedRooms(): string[] {
    try {
      const files = fs.readdirSync(this.persistenceDir);
      return files
        .filter((f) => f.endsWith('.ydoc'))
        .map((f) => f.replace('.ydoc', ''));
    } catch (error) {
      console.error('Failed to list persisted rooms:', error);
      return [];
    }
  }

  /**
   * Get document statistics
   */
  getDocumentStats(roomId: string): { size: number; lastModified: Date } | null {
    const filePath = this.getFilePath(roomId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all pending saves
    for (const timeout of this.saveQueue.values()) {
      clearTimeout(timeout);
    }
    this.saveQueue.clear();
  }
}
