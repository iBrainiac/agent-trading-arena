import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

export function applyMiddleware(app: express.Application) {
  app.use(cors({ origin: config.frontendOrigin }));
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
}

export function applyErrorHandler(app: express.Application) {
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err.message);
    res.status(500).json({ error: err.message });
  });
}
