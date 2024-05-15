/**
 * Constants for the collaborative editor
 */
export declare const USER_COLORS: readonly ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9", "#F8B500", "#00CED1"];
export declare const DEFAULT_SERVER_CONFIG: {
    readonly port: 1234;
    readonly host: "localhost";
    readonly persistenceEnabled: true;
    readonly persistenceInterval: 60000;
    readonly maxConnections: 1000;
    readonly corsOrigins: readonly ["*"];
};
export declare const MESSAGE_TYPES: {
    readonly SYNC: 0;
    readonly SYNC_STEP_1: 1;
    readonly SYNC_STEP_2: 2;
    readonly UPDATE: 3;
    readonly AWARENESS_UPDATE: 4;
    readonly QUERY_AWARENESS: 5;
};
export declare const TIMEOUTS: {
    readonly CONNECTION_TIMEOUT: 5000;
    readonly RECONNECT_BASE_DELAY: 1000;
    readonly RECONNECT_MAX_DELAY: 30000;
    readonly SYNC_TIMEOUT: 10000;
    readonly HEARTBEAT_INTERVAL: 30000;
};
export declare const STORAGE_KEYS: {
    readonly USER_PREFERENCES: "collab-editor-user-prefs";
    readonly RECENT_ROOMS: "collab-editor-recent-rooms";
    readonly OFFLINE_QUEUE: "collab-editor-offline-queue";
};
export declare const ANONYMOUS_NAMES: readonly ["Anonymous Panda", "Anonymous Fox", "Anonymous Owl", "Anonymous Cat", "Anonymous Dog", "Anonymous Rabbit", "Anonymous Bear", "Anonymous Wolf", "Anonymous Eagle", "Anonymous Dolphin"];
//# sourceMappingURL=constants.d.ts.map