import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { logger } from '../utils/logger';
import { getArena } from '../services/arenaService';
import type { WsEvent, WsClientEvent } from '../models/ArenaState';

let wss: WebSocketServer;

export function initWsServer(server: Server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    logger.info('WS client connected');

    const arena = getArena();
    if (arena) {
      ws.send(JSON.stringify({ type: 'ARENA_SNAPSHOT', data: arena } satisfies WsEvent));
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientEvent;
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => logger.info('WS client disconnected'));
    ws.on('error', (err) => logger.error('WS client error', err));
  });

  logger.info('WebSocket server initialized');
}

export function broadcast(event: WsEvent) {
  if (!wss) return;
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
