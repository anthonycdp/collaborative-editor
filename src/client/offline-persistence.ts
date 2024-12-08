/**
 * Offline Persistence - Handles IndexedDB storage for offline support
 */

import * as Y from 'yjs';
import type { SyncState } from '../shared/types.js';

const DB_NAME = 'collab-editor';
const DB_VERSION = 1;

/**
 * IndexedDB-based persistence for offline support
 */
export class OfflinePersistence {
  private db: IDBDatabase | null = null;
  private roomId: string;
  private doc: Y.Doc;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isOnline: boolean = navigator.onLine;
  private boundHandleOnline: () => void;
  private boundHandleOffline: () => void;

  constructor(roomId: string, doc: Y.Doc) {
    this.roomId = roomId;
    this.doc = doc;

    // Bind handlers once for proper removal
    this.boundHandleOnline = () => this.handleOnline();
    this.boundHandleOffline = () => this.handleOffline();

    // Listen for online/offline events
    window.addEventListener('online', this.boundHandleOnline);
    window.addEventListener('offline', this.boundHandleOffline);

    // Listen for document updates
    this.doc.on('update', (update: Uint8Array) => {
      this.handleDocumentUpdate(update);
    });
  }

  /**
   * Initialize the persistence layer
   */
  async initialize(): Promise<void> {
    this.db = await this.openDatabase();
    await this.loadDocument();
  }

  /**
   * Open the IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'roomId' });
        }

        if (!db.objectStoreNames.contains('pendingUpdates')) {
          const pendingStore = db.createObjectStore('pendingUpdates', {
            keyPath: 'id',
            autoIncrement: true,
          });
          pendingStore.createIndex('by-room', 'roomId');
        }
      };
    });
  }

  /**
   * Load document from IndexedDB
   */
  private async loadDocument(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('documents', 'readonly');
    const store = tx.objectStore('documents');
    const request = store.get(this.roomId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (result?.update) {
          try {
            Y.applyUpdate(this.doc, result.update);
            console.log('Document loaded from IndexedDB');
          } catch (error) {
            console.error('Failed to apply stored update:', error);
          }
        }
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Handle document update
   */
  private handleDocumentUpdate(update: Uint8Array): void {
    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveDocument();
    }, 1000);

    // If offline, queue the update
    if (!this.isOnline) {
      this.queuePendingUpdate(update);
    }
  }

  /**
   * Save document to IndexedDB
   */
  private async saveDocument(): Promise<void> {
    if (!this.db) return;

    const update = Y.encodeStateAsUpdate(this.doc);
    const tx = this.db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');

    const data = {
      roomId: this.roomId,
      update: update,
      timestamp: Date.now(),
    };

    store.put(data);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Queue a pending update for when we're back online
   */
  private async queuePendingUpdate(update: Uint8Array): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('pendingUpdates', 'readwrite');
    const store = tx.objectStore('pendingUpdates');

    const data = {
      roomId: this.roomId,
      update: update,
      timestamp: Date.now(),
    };

    store.add(data);
  }

  /**
   * Get pending updates for this room
   */
  async getPendingUpdates(): Promise<Uint8Array[]> {
    if (!this.db) return [];

    const tx = this.db.transaction('pendingUpdates', 'readonly');
    const store = tx.objectStore('pendingUpdates');
    const index = store.index('by-room');
    const request = index.getAll(this.roomId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result;
        resolve(results.map((r) => r.update));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear pending updates after sync
   */
  async clearPendingUpdates(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('pendingUpdates', 'readwrite');
    const store = tx.objectStore('pendingUpdates');
    const index = store.index('by-room');
    const request = index.openCursor(this.roomId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    console.log('Back online');

    // Apply any pending updates
    const pending = await this.getPendingUpdates();
    if (pending.length > 0) {
      console.log(`Applying ${pending.length} pending updates`);
      // The updates will be sent via the provider when it reconnects
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Gone offline - updates will be queued');
  }

  /**
   * Get sync state
   */
  async getSyncState(): Promise<SyncState> {
    const pendingUpdates = await this.getPendingUpdates();
    const documentState = Y.encodeStateAsUpdate(this.doc);

    return {
      lastSynced: Date.now(),
      pendingUpdates,
      documentState,
    };
  }

  /**
   * Destroy the persistence layer
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    window.removeEventListener('online', this.boundHandleOnline);
    window.removeEventListener('offline', this.boundHandleOffline);
  }
}

export default OfflinePersistence;
