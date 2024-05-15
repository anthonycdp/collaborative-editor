/**
 * Shared types for the collaborative editor
 */

// User presence information
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastActive: number;
}

// Cursor position in the document
export interface CursorPosition {
  index: number;
  length: number;
}

// Selection range
export interface SelectionRange {
  start: number;
  end: number;
}

// Room metadata
export interface RoomMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  documentSize: number;
  userCount: number;
}

// WebSocket message types
export type MessageType =
  | 'sync'
  | 'sync-step-1'
  | 'sync-step-2'
  | 'update'
  | 'awareness-update'
  | 'query-awareness'
  | 'room-info'
  | 'user-joined'
  | 'user-left';

// Base WebSocket message
export interface BaseMessage {
  type: MessageType;
  room: string;
}

// Sync message with document state
export interface SyncMessage extends BaseMessage {
  type: 'sync';
  documentState: Uint8Array;
}

// Update message with changes
export interface UpdateMessage extends BaseMessage {
  type: 'update';
  update: Uint8Array;
}

// Awareness update message
export interface AwarenessUpdateMessage extends BaseMessage {
  type: 'awareness-update';
  awarenessUpdate: Uint8Array;
  clientID: number;
}

// Room info message
export interface RoomInfoMessage extends BaseMessage {
  type: 'room-info';
  metadata: RoomMetadata;
}

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Client configuration
export interface ClientConfig {
  serverUrl: string;
  room: string;
  user?: Partial<UserPresence>;
  reconnectTimeout?: number;
  maxReconnectAttempts?: number;
}

// Server configuration
export interface ServerConfig {
  port: number;
  host: string;
  persistenceEnabled: boolean;
  persistenceInterval?: number;
  maxConnections?: number;
  corsOrigins?: string[];
}

// Sync state for offline support
export interface SyncState {
  lastSynced: number;
  pendingUpdates: Uint8Array[];
  documentState: Uint8Array | null;
}

// Document change event
export interface DocumentChangeEvent {
  type: 'insert' | 'delete' | 'format';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, unknown>;
  author: string;
  timestamp: number;
}
