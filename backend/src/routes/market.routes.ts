import { Router, type Request, type Response } from 'express';
import { getArena } from '../services/arenaService';

const router = Router();

router.get('/snapshot', (_req: Request, res: Response) => {
  const arena = getArena();
  if (!arena) {
    res.status(404).json({ error: 'No active arena' });
    return;
  }
  res.json({
    currentPrice: arena.market.currentPrice,
    priceHistory: arena.market.priceHistory,
    lastSignals: arena.market.lastSignals,
    phase: arena.market.phase,
  });
});

export default router;
