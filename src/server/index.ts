/**
 * Main server entry point
 * Collaborative Real-Time Editor Server
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { CollaborationServer } from './websocket-server.js';
import type { ServerConfig } from '../shared/types.js';
import { DEFAULT_SERVER_CONFIG } from '../shared/constants.js';

// Configuration
const config: ServerConfig = {
  ...DEFAULT_SERVER_CONFIG,
  port: parseInt(process.env.PORT ?? '1234', 10),
  host: process.env.HOST ?? 'localhost',
  persistenceEnabled: process.env.PERSISTENCE_ENABLED !== 'false',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? ['*'],
};

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoints
app.get('/api/rooms', (_req, res) => {
  const rooms = collaborationServer.getRoomManager().getAllRooms();
  res.json({ rooms });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const metadata = collaborationServer
    .getRoomManager()
    .getRoomMetadata(req.params.roomId);

  if (!metadata) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  res.json({ room: metadata });
});

// Create HTTP server
const server = createServer(app);

// Create and attach collaboration server
const collaborationServer = new CollaborationServer(config);
collaborationServer.attach(server);

// Start server
server.listen(config.port, config.host, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Collaborative Real-Time Editor Server                       ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP Server:  http://${config.host}:${config.port}                       ║
║  WebSocket:    ws://${config.host}:${config.port}/ws/<room-id>             ║
║  Persistence:  ${config.persistenceEnabled ? 'Enabled' : 'Disabled'}                                      ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');

  server.close(async () => {
    await collaborationServer.close();
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server, collaborationServer };
