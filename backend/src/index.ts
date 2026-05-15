import 'dotenv/config';
import { config } from './config';
import { logger } from './utils/logger';
import { createHttpServer } from './server/httpServer';
import { initWsServer, broadcast } from './server/wsServer';
import { startAgentLoop, stopAgentLoop } from './services/agentLoopService';
import { payoutWinner, refundDraw } from './services/paymentService';
import {
  setPhaseChangeHandler,
  setResolutionHandler,
  setPriceUpdateHandler,
} from './services/arenaService';

const server = createHttpServer();
initWsServer(server);

// Broadcast real-time price + live P&L to all clients
setPriceUpdateHandler((price, candle, pnlA, pnlB) => {
  broadcast({ type: 'PRICE_UPDATE', data: { price, candle, pnlA, pnlB } });
});

// Phase transitions
setPhaseChangeHandler((phase) => {
  broadcast({ type: 'PHASE_CHANGE', data: { phase } });
  if (phase === 'TRADING') {
    startAgentLoop();
  }
  if (phase === 'RESOLUTION') {
    stopAgentLoop();
  }
});

// Resolution — pay winner or refund draw
setResolutionHandler((winner, finalPrice) => {
  broadcast({ type: 'RESOLUTION', data: { winner, finalPrice } });
  if (winner === 'draw') {
    refundDraw().catch((e) => logger.error('Draw refund failed', e));
  } else {
    payoutWinner(winner).catch((e) => logger.error('Payout failed', e));
  }
});

server.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} [${config.networkLabel}]`);
  logger.info(`Chain: ${config.caip2} | USDC: ${config.usdcAddress}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM — shutting down');
  stopAgentLoop();
  server.close(() => process.exit(0));
});
