import express from 'express';
import { createServer } from 'http';
import { applyMiddleware, applyErrorHandler } from './middleware';
import arenaRoutes from '../routes/arena.routes';
import marketRoutes from '../routes/market.routes';

export function createHttpServer() {
  const app = express();
  applyMiddleware(app);

  app.use('/api/arena', arenaRoutes);
  app.use('/api/market', marketRoutes);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  applyErrorHandler(app);

  return createServer(app);
}
