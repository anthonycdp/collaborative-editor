# Collaborative Real-Time Editor

A production-ready real-time collaborative text editor built with **Yjs CRDT**, featuring conflict resolution, offline sync, and presence indicators. This project demonstrates advanced concepts in distributed systems and real-time collaboration.

## Features

- **Real-Time Collaboration**: Multiple users can edit simultaneously with instant sync
- **CRDT Conflict Resolution**: Yjs-based Conflict-free Replicated Data Types ensure eventual consistency without central coordination
- **Offline Support**: IndexedDB persistence allows editing without network connectivity
- **Presence Indicators**: See other users' cursors and selections in real-time
- **WebSocket API**: Low-latency bidirectional communication
- **Rich Text Editing**: Full-featured editor with formatting toolbar

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Application                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   Quill Editor  │  │ Editor Binding  │  │ Offline Persistence │  │
│  │   (Rich Text)   │◄─┤   (Y.Text ↔)    │◄─┤   (IndexedDB)        │  │
│  └─────────────────┘  └────────┬────────┘  └─────────────────────┘  │
│                                │                                     │
│  ┌─────────────────────────────┴─────────────────────────────────┐  │
│  │              Collaboration Provider                             │  │
│  │  ┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐   │  │
│  │  │  Y.Doc (CRDT) │  │   WebSocket     │  │    Awareness    │   │  │
│  │  │  Shared Type  │◄─┤   Connection    │◄─┤   (Presence)    │   │  │
│  │  └───────────────┘  └────────┬────────┘  └─────────────────┘   │  │
│  └──────────────────────────────┼──────────────────────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────────┘
                                  │ WebSocket
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Collaboration Server                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    WebSocket Server                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │    │
│  │  │  Sync Protocol  │  │ Awareness Mgmt  │  │ Room Manager │ │    │
│  │  │  (y-protocols)  │  │   (Presence)    │  │  (Routing)   │ │    │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Persistence Layer                           │    │
│  │  ┌─────────────────────────────────────────────────────────┐│    │
│  │  │              File-based Document Storage                 ││    │
│  │  └─────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     HTTP API (Express)                       │    │
│  │  /health  /api/rooms  /api/rooms/:id                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **CRDT** | [Yjs](https://yjs.dev/) | Conflict-free replicated data types |
| **Editor** | [Quill](https://quilljs.com/) | Rich text editor |
| **Transport** | WebSocket (ws) | Real-time bidirectional communication |
| **Protocols** | y-protocols | Sync & awareness protocols |
| **Persistence** | IndexedDB (client), File System (server) | Offline support |
| **Backend** | Node.js + Express | HTTP API & WebSocket server |
| **Language** | TypeScript | Type safety |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd collaborative-editor

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at:
- **Client**: http://localhost:3000
- **Server**: http://localhost:1234
- **WebSocket**: ws://localhost:1234/ws/:roomId

### Production Build

```bash
npm run build
npm start
```

## Usage

### Creating/Joining a Room

1. Open the application in your browser
2. Enter a room name in the sidebar input
3. Click "Join Room" or press Enter
4. Share the URL with collaborators

### Collaborative Editing

- All changes sync in real-time
- See other users' cursors with their names
- User presence is shown in the sidebar
- Full rich text formatting support

### Offline Editing

- Changes are saved to IndexedDB automatically
- When offline, changes are queued locally
- On reconnection, changes sync automatically

## API Reference

### WebSocket Protocol

The server implements the standard Yjs sync protocol:

| Message Type | Code | Description |
|--------------|------|-------------|
| `sync` | 0 | Sync message wrapper |
| `sync-step-1` | 1 | Request remote state |
| `sync-step-2` | 2 | Send state/update |
| `update` | 3 | Document update |
| `awareness-update` | 4 | Presence update |

### HTTP Endpoints

```http
GET /health
# Health check endpoint

GET /api/rooms
# List all active rooms

GET /api/rooms/:roomId
# Get room metadata
```

## Project Structure

```
collaborative-editor/
├── src/
│   ├── client/                 # Frontend code
│   │   ├── index.html          # HTML entry point
│   │   ├── styles.css          # Application styles
│   │   ├── main.ts             # Application entry
│   │   ├── collaboration-provider.ts  # WebSocket + Yjs integration
│   │   ├── editor-binding.ts   # Quill ↔ Y.Text binding
│   │   └── offline-persistence.ts     # IndexedDB storage
│   │
│   ├── server/                 # Backend code
│   │   ├── index.ts            # Server entry point
│   │   ├── websocket-server.ts # WebSocket + sync protocol
│   │   ├── room-manager.ts     # Room/connection management
│   │   └── persistence.ts      # Document persistence
│   │
│   └── shared/                 # Shared code
│       ├── types.ts            # TypeScript interfaces
│       ├── constants.ts        # Application constants
│       └── utils.ts            # Utility functions
│
├── tests/                      # Test files
│   ├── room-manager.test.ts
│   ├── persistence.test.ts
│   ├── crdt.test.ts
│   └── utils.test.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## CRDT Deep Dive

### Why CRDT over OT?

| Aspect | CRDT (Yjs) | Operational Transform |
|--------|------------|---------------------|
| **Coordination** | No central server required | Requires server for transforms |
| **Offline** | Natural support | Complex to implement |
| **Scalability** | P2P possible | Centralized bottleneck |
| **Complexity** | Mathematical guarantees | Complex conflict resolution |

### How Yjs Works

Yjs implements a modified YATA (Yet Another Transformation Approach) algorithm:

1. **Unique IDs**: Every character gets a unique (clientID, clock) tuple
2. **Linked List**: Characters form a linked list based on logical ordering
3. **Conflict Resolution**: When conflicts occur, the algorithm uses:
   - Client ID comparison (deterministic)
   - Clock comparison (causal ordering)
4. **Merge**: Updates are commutative and idempotent

```typescript
// Example: Concurrent edits converge
// User A types "Hello" at position 0
// User B types "World" at position 0 (concurrently)
// Result: Both users see "HelloWorld" or "WorldHello" (deterministic)
```

### State Vectors

State vectors track what each client has seen:

```typescript
// Efficient sync: only send what's missing
const stateVector1 = Y.encodeStateVector(doc1);
const diff = Y.encodeStateAsUpdate(doc2, stateVector1);
Y.applyUpdate(doc1, diff);
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories

- **Unit Tests**: Utility functions, state management
- **Integration Tests**: Room management, persistence
- **CRDT Tests**: Conflict resolution, sync protocols

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1234` | Server port |
| `HOST` | `localhost` | Server host |
| `PERSISTENCE_ENABLED` | `true` | Enable document persistence |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

### Client Configuration

```typescript
const provider = new CollaborationProvider({
  serverUrl: 'ws://localhost:1234',
  room: 'my-room',
  user: {
    name: 'John Doe',
    color: '#ff0000'
  }
});
```

## Performance Considerations

### Document Size

- Yjs efficiently handles documents up to 100,000+ characters
- Binary encoding minimizes network overhead
- State vector diff reduces sync payload

### Connection Management

- Automatic reconnection with exponential backoff
- Heartbeat to detect stale connections
- Connection pooling for scalability

### Memory Management

- Unused rooms are cleaned up after 1 minute
- Documents are destroyed when rooms are empty
- Awareness states are cleaned on disconnect

## Security

### Input Validation

- Room IDs are sanitized to prevent directory traversal
- WebSocket connections are validated
- Document size limits prevent DoS

### Recommendations for Production

1. Add authentication (JWT, OAuth)
2. Implement rate limiting
3. Use HTTPS/WSS
4. Add document encryption for sensitive data

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 13+ |
| Edge | 80+ |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT

## Acknowledgments

- [Yjs](https://yjs.dev/) - The CRDT framework
- [y-protocols](https://github.com/yjs/y-protocols) - Sync protocols
- [Quill](https://quilljs.com/) - Rich text editor
- [Kevin Jahns](https://github.com/dmonad) - Yjs creator
