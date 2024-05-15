/**
 * Shared types for the collaborative editor
 */
export interface UserPresence {
    id: string;
    name: string;
    color: string;
    cursor?: CursorPosition;
    selection?: SelectionRange;
    lastActive: number;
}
export interface CursorPosition {
    index: number;
    length: number;
}
export interface SelectionRange {
    start: number;
    end: number;
}
export interface RoomMetadata {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    documentSize: number;
    userCount: number;
}
export type MessageType = 'sync' | 'sync-step-1' | 'sync-step-2' | 'update' | 'awareness-update' | 'query-awareness' | 'room-info' | 'user-joined' | 'user-left';
export interface BaseMessage {
    type: MessageType;
    room: string;
}
export interface SyncMessage extends BaseMessage {
    type: 'sync';
    documentState: Uint8Array;
}
export interface UpdateMessage extends BaseMessage {
    type: 'update';
    update: Uint8Array;
}
export interface AwarenessUpdateMessage extends BaseMessage {
    type: 'awareness-update';
    awarenessUpdate: Uint8Array;
    clientID: number;
}
export interface RoomInfoMessage extends BaseMessage {
    type: 'room-info';
    metadata: RoomMetadata;
}
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export interface ClientConfig {
    serverUrl: string;
    room: string;
    user?: Partial<UserPresence>;
    reconnectTimeout?: number;
    maxReconnectAttempts?: number;
}
export interface ServerConfig {
    port: number;
    host: string;
    persistenceEnabled: boolean;
    persistenceInterval?: number;
    maxConnections?: number;
    corsOrigins?: string[];
}
export interface SyncState {
    lastSynced: number;
    pendingUpdates: Uint8Array[];
    documentState: Uint8Array | null;
}
export interface DocumentChangeEvent {
    type: 'insert' | 'delete' | 'format';
    position: number;
    content?: string;
    length?: number;
    attributes?: Record<string, unknown>;
    author: string;
    timestamp: number;
}
//# sourceMappingURL=types.d.ts.map