/**
 * Constants for the collaborative editor
 */

// Default user colors for presence indicators
export const USER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
  '#F8B500', // Orange
  '#00CED1', // Dark Cyan
] as const;

// Default server configuration
export const DEFAULT_SERVER_CONFIG = {
  port: 1234,
  host: 'localhost',
  persistenceEnabled: true,
  persistenceInterval: 60000, // 1 minute
  maxConnections: 1000,
  corsOrigins: ['*'],
} as const;

// WebSocket message type identifiers (matching y-protocols)
export const MESSAGE_TYPES = {
  SYNC: 0,
  SYNC_STEP_1: 1,
  SYNC_STEP_2: 2,
  UPDATE: 3,
  AWARENESS_UPDATE: 4,
  QUERY_AWARENESS: 5,
} as const;

// Connection timeouts
export const TIMEOUTS = {
  CONNECTION_TIMEOUT: 5000,
  RECONNECT_BASE_DELAY: 1000,
  RECONNECT_MAX_DELAY: 30000,
  SYNC_TIMEOUT: 10000,
  HEARTBEAT_INTERVAL: 30000,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'collab-editor-user-prefs',
  RECENT_ROOMS: 'collab-editor-recent-rooms',
  OFFLINE_QUEUE: 'collab-editor-offline-queue',
} as const;

// Default user names for anonymous users
export const ANONYMOUS_NAMES = [
  'Anonymous Panda',
  'Anonymous Fox',
  'Anonymous Owl',
  'Anonymous Cat',
  'Anonymous Dog',
  'Anonymous Rabbit',
  'Anonymous Bear',
  'Anonymous Wolf',
  'Anonymous Eagle',
  'Anonymous Dolphin',
] as const;
