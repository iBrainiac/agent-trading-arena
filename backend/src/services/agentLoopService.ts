import { config } from '../config';
import { logger } from '../utils/logger';
import { getArena, recordAgentAction, resolveMarket } from './arenaService';
import { reasonForAgent } from './openaiService';
import { executeSwap } from './okxSwapService';
import { broadcast } from '../server/wsServer';
import type { AgentId, AgentAction } from '../models/ArenaState';

let loopTimer: NodeJS.Timeout | null = null;

async function tickAgent(agentId: AgentId, arena: NonNullable<ReturnType<typeof getArena>>) {
  const agent = arena[agentId];

  try {
    const decision = await reasonForAgent(agentId, arena);
    let txHash: string | undefined;
    let swapSuccess = false;

    if (decision.decision !== 'HOLD') {
      const swapAmount = String(
        parseFloat(agent.stake) * parseFloat(decision.size),
      );
      const result = await executeSwap(decision.decision, swapAmount, agent.walletAddress);
      txHash = result.txHash;
      swapSuccess = result.success;
    } else {
      swapSuccess = true;
    }

    const action: AgentAction = {
      ts: Date.now(),
      decision: decision.decision,
      size: decision.size,
      reasoning: decision.reasoning,
      txHash,
      swapSuccess,
    };

    recordAgentAction(agentId, action);
    broadcast({ type: 'AGENT_TICK', data: { agentId, action } });

    logger.info(`${agentId} tick done: ${decision.decision} size=${decision.size} swap=${swapSuccess}`);
  } catch (err) {
    logger.error(`${agentId} tick error`, err);
  }
}

async function runTick() {
  const arena = getArena();
  if (!arena || arena.market.phase !== 'TRADING') return;

  if (Date.now() >= arena.market.resolutionTime) {
    logger.info('Resolution time reached, resolving market');
    resolveMarket();
    stopAgentLoop();
    return;
  }

  // Stagger agents by 200ms to avoid simultaneous OpenAI calls
  await tickAgent('agentA', arena);
  await new Promise((r) => setTimeout(r, 200));
  await tickAgent('agentB', arena);
}

export function startAgentLoop() {
  if (loopTimer) return;
  logger.info('Agent loop started');
  loopTimer = setInterval(() => { runTick().catch((e) => logger.error('Loop error', e)); }, config.agentTickIntervalMs);
  // Run immediately on start
  runTick().catch((e) => logger.error('Loop first tick error', e));
}

export function stopAgentLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    logger.info('Agent loop stopped');
  }
}
