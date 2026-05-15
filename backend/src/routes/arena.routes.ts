import { Router, type Request, type Response } from 'express';
import { createArena, getArena, confirmEntryPayment, resetArena } from '../services/arenaService';
import { stopAgentLoop } from '../services/agentLoopService';
import { startOkxWs, stopOkxWs } from '../services/okxWsService';
import { autoPayEntryFees } from '../services/paymentService';
import { broadcast } from '../server/wsServer';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { CreateArenaDto, AgentId } from '../models/ArenaState';

const router = Router();

router.post('/create', (req: Request, res: Response) => {
  const dto = req.body as CreateArenaDto;
  if (!dto.question || !dto.targetPrice || !dto.resolutionTimeIso || !dto.targetAsset) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const arena = createArena(dto);
  broadcast({ type: 'ARENA_SNAPSHOT', data: arena });
  res.json({ arenaId: arena.market.id, arena });

  // Start price feed immediately so UI shows live prices during ENTRY phase
  startOkxWs();

  // Agents autonomously pay their entry fees via x402 — transitions to TRADING when both confirm
  autoPayEntryFees().catch((e) => logger.error('Auto entry payment failed', e));
});

router.get('/:id', (_req: Request, res: Response) => {
  const arena = getArena();
  if (!arena) {
    res.status(404).json({ error: 'No active arena' });
    return;
  }
  res.json(arena);
});

// x402 resource endpoint — agents can also pay manually via this route
router.post('/:id/entry', (req: Request, res: Response) => {
  const arena = getArena();
  if (!arena) {
    res.status(404).json({ error: 'No active arena' });
    return;
  }

  const agentId = req.query.agentId as AgentId;
  if (agentId !== 'agentA' && agentId !== 'agentB') {
    res.status(400).json({ error: 'agentId must be agentA or agentB' });
    return;
  }

  const paymentSigHeader = req.headers['payment-signature'] as string | undefined;

  if (!paymentSigHeader) {
    const paymentRequired = {
      x402Version: 2,
      resource: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      accepts: [
        {
          scheme: 'exact',
          network: config.caip2,
          asset: config.usdcAddress,
          payTo: config.escrowWallet,
          maxAmountRequired: arena.market.entryFeeMinimal,
          extra: { name: 'AgentTradingArena', version: '1' },
        },
      ],
    };

    res.setHeader(
      'PAYMENT-REQUIRED',
      Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
    );
    res.status(402).json({ error: 'Payment required', paymentRequired });
    return;
  }

  logger.info(`Entry payment received for ${agentId}`, { paymentSigHeader: paymentSigHeader.slice(0, 40) });

  confirmEntryPayment(agentId, {
    phase: 'confirmed',
    paymentSigHeader,
    confirmedAt: Date.now(),
  });

  const payment = arena.payments[agentId];
  broadcast({ type: 'PAYMENT_UPDATE', data: { agentId, payment } });

  res.json({ success: true, agentId, phase: 'confirmed' });
});

router.post('/reset', (_req: Request, res: Response) => {
  stopAgentLoop();
  stopOkxWs();
  resetArena();
  broadcast({ type: 'ARENA_RESET' });
  res.json({ success: true });
});

export default router;
