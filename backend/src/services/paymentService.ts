import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getArena, recordPayout, confirmEntryPayment } from './arenaService';
import { broadcast } from '../server/wsServer';
import type { AgentId, PayoutPayment } from '../models/ArenaState';

const execAsync = promisify(exec);

async function runCmd(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { timeout: 60_000 });
  return stdout.trim();
}

async function payEntryFeeForAgent(agentId: AgentId): Promise<void> {
  const arena = getArena();
  if (!arena) throw new Error('No active arena');

  const agent = arena[agentId];
  const market = arena.market;

  broadcast({ type: 'PAYMENT_UPDATE', data: { agentId, payment: { phase: 'signed' } } });

  const acceptsJson = JSON.stringify({
    scheme: 'exact',
    network: config.caip2,
    asset: config.usdcAddress,
    payTo: config.escrowWallet,
    maxAmountRequired: market.entryFeeMinimal,
  });

  const cmd = `onchainos payment pay --accepts '${acceptsJson}' --from ${agent.walletAddress}`;
  logger.info(`x402 entry payment for ${agentId}`);

  const output = await runCmd(cmd);
  const sigMatch = output.match(/PAYMENT-SIGNATURE[:\s]+([A-Za-z0-9+/=._-]+)/i);
  const paymentSigHeader = sigMatch?.[1];

  if (!paymentSigHeader) {
    throw new Error(`No PAYMENT-SIGNATURE in onchainos output for ${agentId}: ${output.slice(0, 200)}`);
  }

  confirmEntryPayment(agentId, {
    phase: 'confirmed',
    paymentSigHeader,
    confirmedAt: Date.now(),
  });

  const updatedPayment = getArena()?.payments[agentId];
  if (updatedPayment) {
    broadcast({ type: 'PAYMENT_UPDATE', data: { agentId, payment: updatedPayment } });
  }

  logger.info(`x402 entry confirmed for ${agentId}`);
}

// Called immediately after arena creation — both agents pay entry fee concurrently
export async function autoPayEntryFees(): Promise<void> {
  logger.info('Triggering x402 entry fees for both agents');

  const results = await Promise.allSettled([
    payEntryFeeForAgent('agentA'),
    payEntryFeeForAgent('agentB'),
  ]);

  results.forEach((result, i) => {
    const agentId = (i === 0 ? 'agentA' : 'agentB') as AgentId;
    if (result.status === 'rejected') {
      logger.error(`Entry payment failed for ${agentId}:`, result.reason);
      broadcast({ type: 'PAYMENT_UPDATE', data: { agentId, payment: { phase: 'unpaid' } } });
    }
  });
}

export async function payoutWinner(winnerId: AgentId): Promise<void> {
  const arena = getArena();
  if (!arena) return;

  const winner = arena[winnerId];
  const totalPool = String(
    parseFloat(arena.agentA.stake) + parseFloat(arena.agentB.stake),
  );

  let payoutState: PayoutPayment = {
    paymentId: '',
    amount: totalPool,
    recipient: winner.walletAddress,
    status: 'pending',
  };
  broadcast({ type: 'PAYOUT_UPDATE', data: payoutState });

  try {
    const createOutput = await runCmd(
      `onchainos payment a2a-pay create --amount ${totalPool} --symbol USDT --recipient ${winner.walletAddress} --description "Arena ${arena.market.id} payout" --expires-in 300`,
    );
    const idMatch = createOutput.match(/paymentId[:\s]+(a2a_\S+)/i);
    const paymentId = idMatch?.[1] ?? `a2a_mock_${Date.now()}`;
    payoutState = { ...payoutState, paymentId, status: 'settling' };
    broadcast({ type: 'PAYOUT_UPDATE', data: payoutState });

    await runCmd(`onchainos payment a2a-pay pay --payment-id ${paymentId}`);

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3_000));
      const statusOutput = await runCmd(`onchainos payment a2a-pay status --payment-id ${paymentId}`);
      const txMatch = statusOutput.match(/txHash[:\s]+([0-9a-fA-Fx]+)/i);

      if (statusOutput.includes('completed')) {
        payoutState = { ...payoutState, status: 'completed', txHash: txMatch?.[1], confirmedAt: Date.now() };
        broadcast({ type: 'PAYOUT_UPDATE', data: payoutState });
        recordPayout(payoutState.txHash ?? '');
        logger.info('Payout completed', { paymentId, txHash: payoutState.txHash });
        return;
      }
      if (statusOutput.includes('failed') || statusOutput.includes('expired')) {
        payoutState = { ...payoutState, status: 'failed' };
        broadcast({ type: 'PAYOUT_UPDATE', data: payoutState });
        logger.error('Payout failed/expired', { paymentId });
        return;
      }
    }

    payoutState = { ...payoutState, status: 'expired' };
    broadcast({ type: 'PAYOUT_UPDATE', data: payoutState });
    logger.error('Payout timed out', { paymentId });
  } catch (err) {
    payoutState = { ...payoutState, status: 'failed' };
    broadcast({ type: 'PAYOUT_UPDATE', data: payoutState });
    logger.error('Payout error', err);
  }
}

export async function refundDraw(): Promise<void> {
  const arena = getArena();
  if (!arena) return;

  logger.info('Draw — refunding both agents');
  await Promise.allSettled([
    payoutWinner('agentA').catch((e) => logger.error('Draw refund agentA failed', e)),
    payoutWinner('agentB').catch((e) => logger.error('Draw refund agentB failed', e)),
  ]);
}
