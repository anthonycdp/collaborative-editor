/**
 * Editor Binding - Connects Yjs document to Quill editor
 */

import * as Y from 'yjs';
import Quill from 'quill';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import type { UserPresence } from '../shared/types.js';

interface RemoteCursor {
  userId: string;
  name: string;
  color: string;
  index: number;
  length: number;
}

/**
 * Binds Y.Text to Quill editor with awareness support
 */
export class EditorBinding {
  private ytext: Y.Text;
  private quill: Quill;
  private awareness: awarenessProtocol.Awareness;
  private cursors: Map<number, RemoteCursor> = new Map();
  private isRemoteChange = false;
  private ytextObserver: (event: Y.YTextEvent) => void;
  private awarenessHandler: () => void;

  constructor(
    ytext: Y.Text,
    quill: Quill,
    awareness: awarenessProtocol.Awareness
  ) {
    this.ytext = ytext;
    this.quill = quill;
    this.awareness = awareness;

    // Define observer function (stored for proper cleanup)
    this.ytextObserver = (event: Y.YTextEvent) => {
      if (event.transaction.local) return;

      this.isRemoteChange = true;

      let index = 0;
      event.changes.delta.forEach((change) => {
        if ('retain' in change) {
          index += change.retain!;
        } else if ('insert' in change) {
          this.quill.insertText(index, change.insert as string, 'api');
          index += (change.insert as string).length;
        } else if ('delete' in change) {
          this.quill.deleteText(index, change.delete!);
        }
      });

      this.isRemoteChange = false;
    };

    // Define awareness handler (stored for proper cleanup)
    this.awarenessHandler = () => this.renderRemoteCursors();

    // Initialize
    this.initContent();
    this.setupQuillHandlers();
    this.setupAwarenessHandlers();
  }

  /**
   * Initialize editor content from Y.Text
   */
  private initContent(): void {
    const content = this.ytext.toString();
    if (content) {
      this.quill.setText(content);
    }

    // Register observer for remote changes
    this.ytext.observe(this.ytextObserver);
  }

  /**
   * Set up Quill event handlers
   */
  private setupQuillHandlers(): void {
    this.quill.on('text-change', (delta, _oldDelta, source) => {
      if (source === 'api' || this.isRemoteChange) return;

      // Apply changes to Y.Text
      let index = 0;
      delta.ops?.forEach((op) => {
        if (typeof op.retain === 'number') {
          index += op.retain;
        } else if (typeof op.insert === 'string') {
          this.ytext.insert(index, op.insert);
          index += op.insert.length;
        } else if (typeof op.insert === 'object') {
          // Handle embeds
          this.ytext.insert(index, '\n');
          index += 1;
        } else if (typeof op.delete === 'number') {
          this.ytext.delete(index, op.delete);
        }
      });

      // Update cursor in awareness
      this.updateLocalCursor();
    });

    // Update cursor position
    this.quill.on('selection-change', (_range, _oldRange, source) => {
      if (source === 'user') {
        this.updateLocalCursor();
      }
    });
  }

  /**
   * Set up awareness handlers
   */
  private setupAwarenessHandlers(): void {
    this.awareness.on('change', this.awarenessHandler);

    // Initial cursor update
    this.updateLocalCursor();
  }

  /**
   * Update local cursor in awareness
   */
  private updateLocalCursor(): void {
    const selection = this.quill.getSelection();

    this.awareness.setLocalStateField('cursor', {
      index: selection?.index ?? 0,
      length: selection?.length ?? 0,
    });
  }

  /**
   * Render remote cursors
   */
  private renderRemoteCursors(): void {
    const states = this.awareness.getStates();
    const localClientID = this.awareness.doc?.clientID;

    // Clear old cursors
    this.cursors.clear();

    // Add cursors for other users
    states.forEach((state: unknown, clientID: number) => {
      if (clientID === localClientID) return;

      const s = state as { user?: UserPresence; cursor?: { index: number; length: number } };
      const user = s.user;
      const cursor = s.cursor;

      if (user && cursor) {
        this.cursors.set(clientID, {
          userId: String(clientID),
          name: user.name,
          color: user.color,
          index: cursor.index,
          length: cursor.length,
        });
      }
    });

    this.renderCursors();
  }

  /**
   * Render cursor decorations
   */
  private renderCursors(): void {
    // Remove existing cursor decorations
    const existingCursors = document.querySelectorAll('.remote-cursor');
    existingCursors.forEach((el) => el.remove());

    // Add cursor decorations
    this.cursors.forEach((cursor) => {
      try {
        const bounds = this.quill.getBounds(cursor.index, cursor.length || 1);
        if (!bounds) return;

        const editorContainer = this.quill.root.parentElement;
        if (!editorContainer) return;

        const cursorEl = document.createElement('div');
        cursorEl.className = 'remote-cursor';
        cursorEl.style.cssText = `
          position: absolute;
          left: ${bounds.left}px;
          top: ${bounds.top}px;
          width: 2px;
          height: ${bounds.height}px;
          background-color: ${cursor.color};
          pointer-events: none;
          z-index: 10;
        `;

        // Add name label
        const labelEl = document.createElement('div');
        labelEl.className = 'remote-cursor-caret';
        labelEl.style.cssText = `
          position: absolute;
          top: -18px;
          left: -2px;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
          color: white;
          background-color: ${cursor.color};
          white-space: nowrap;
        `;
        labelEl.textContent = cursor.name;
        cursorEl.appendChild(labelEl);

        editorContainer.appendChild(cursorEl);
      } catch {
        // Cursor position might be out of bounds
      }
    });
  }

  /**
   * Get document content
   */
  getContent(): string {
    return this.ytext.toString();
  }

  /**
   * Get document statistics
   */
  getStats(): { characters: number; words: number } {
    const content = this.getContent();
    return {
      characters: content.length,
      words: content.trim() ? content.trim().split(/\s+/).length : 0,
    };
  }

  /**
   * Destroy the binding and clean up resources
   */
  destroy(): void {
    this.ytext.unobserve(this.ytextObserver);
    this.awareness.off('change', this.awarenessHandler);
    this.cursors.clear();
  }
}

export default EditorBinding;
