import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import type {
  ArenaState, MarketState, AgentState, PaymentState,
  MarketPhase, AgentId, OHLCV, SignalEvent, AgentAction,
  EntryPayment, PnlPoint, CreateArenaDto,
} from '../models/ArenaState';

type PhaseChangeCallback = (phase: MarketPhase) => void;
type ResolutionCallback = (winner: AgentId | 'draw', finalPrice: number) => void;
type PriceUpdateCallback = (price: number, candle: OHLCV, pnlA: number, pnlB: number) => void;

let arenaState: ArenaState | null = null;
let onPhaseChange: PhaseChangeCallback | null = null;
let onResolution: ResolutionCallback | null = null;
let onPriceUpdate: PriceUpdateCallback | null = null;

// P&L sampling — max one sample every 2s to keep history lean
const PNL_SAMPLE_INTERVAL_MS = 2_000;
const PNL_HISTORY_MAX = 300;
let lastPnlSampleTs = 0;

function makeAgent(id: AgentId, displayName: string, walletAddress: string, stake: string): AgentState {
  return {
    id, displayName, walletAddress,
    entryPaymentStatus: 'pending',
    stake,
    position: 'HOLD',
    positionSize: '0',
    currentPnl: 0,
    pnlHistory: [],
    lastReasoning: '',
    lastAction: null,
    actionLog: [],
  };
}

export function createArena(dto: CreateArenaDto): ArenaState {
  lastPnlSampleTs = 0;
  const id = uuidv4();
  const entryFeeUsdt = dto.entryFeeUsdt;
  const entryFeeMinimal = String(Math.round(parseFloat(entryFeeUsdt) * 1_000_000));

  const market: MarketState = {
    id, phase: 'ENTRY',
    question: dto.question,
    targetPrice: dto.targetPrice,
    targetAsset: dto.targetAsset,
    resolutionTime: new Date(dto.resolutionTimeIso).getTime(),
    entryFeeUsdt, entryFeeMinimal,
    createdAt: Date.now(),
    currentPrice: 0,
    priceHistory: [],
    lastSignals: [],
  };

  arenaState = {
    market,
    agentA: makeAgent('agentA', 'ALPHA-7', config.agentWallets.agentA, entryFeeUsdt),
    agentB: makeAgent('agentB', 'OMEGA-3', config.agentWallets.agentB, entryFeeUsdt),
    payments: { agentA: { phase: 'unpaid' }, agentB: { phase: 'unpaid' } },
    tickCount: 0,
    lastTickAt: 0,
  };

  logger.info(`Arena created: ${id}`, { question: dto.question, targetPrice: dto.targetPrice });
  return arenaState;
}

export function resetArena(): void {
  arenaState = null;
  lastPnlSampleTs = 0;
  logger.info('Arena reset');
}

export function getArena(): ArenaState | null { return arenaState; }

export function setPhaseChangeHandler(cb: PhaseChangeCallback) { onPhaseChange = cb; }
export function setResolutionHandler(cb: ResolutionCallback) { onResolution = cb; }
export function setPriceUpdateHandler(cb: PriceUpdateCallback) { onPriceUpdate = cb; }

function transitionPhase(next: MarketPhase) {
  if (!arenaState) return;
  arenaState.market.phase = next;
  logger.info(`Phase → ${next}`);
  onPhaseChange?.(next);
}

function calcAgentPnl(agent: AgentState, currentPrice: number): number {
  if (!agent.entryPrice || agent.position === 'HOLD') return 0;
  const size = parseFloat(agent.positionSize) * parseFloat(agent.stake);
  const direction = agent.position === 'LONG' ? 1 : -1;
  const priceDelta = (currentPrice - agent.entryPrice) / agent.entryPrice;
  return parseFloat((size * direction * priceDelta).toFixed(4));
}

function samplePnl(now: number) {
  if (!arenaState || arenaState.market.phase !== 'TRADING') return;
  if (now - lastPnlSampleTs < PNL_SAMPLE_INTERVAL_MS) return;
  lastPnlSampleTs = now;

  const price = arenaState.market.currentPrice;
  const pnlA = calcAgentPnl(arenaState.agentA, price);
  const pnlB = calcAgentPnl(arenaState.agentB, price);

  arenaState.agentA.currentPnl = pnlA;
  arenaState.agentB.currentPnl = pnlB;

  const pointA: PnlPoint = { ts: now, pnl: pnlA };
  const pointB: PnlPoint = { ts: now, pnl: pnlB };

  arenaState.agentA.pnlHistory.push(pointA);
  arenaState.agentB.pnlHistory.push(pointB);

  if (arenaState.agentA.pnlHistory.length > PNL_HISTORY_MAX) arenaState.agentA.pnlHistory.shift();
  if (arenaState.agentB.pnlHistory.length > PNL_HISTORY_MAX) arenaState.agentB.pnlHistory.shift();
}

export function updatePrice(price: number, candle: OHLCV) {
  if (!arenaState) return;
  arenaState.market.currentPrice = price;

  // Update price history ring buffer
  const history = arenaState.market.priceHistory;
  const last = history[history.length - 1];
  if (last && last.ts === candle.ts) history[history.length - 1] = candle;
  else {
    history.push(candle);
    if (history.length > config.priceHistoryMaxLen) history.shift();
  }

  // Sample P&L on every price tick (throttled to 2s)
  const now = Date.now();
  samplePnl(now);

  onPriceUpdate?.(
    price, candle,
    arenaState.agentA.currentPnl,
    arenaState.agentB.currentPnl,
  );
}

export function addSignal(signal: SignalEvent) {
  if (!arenaState) return;
  arenaState.market.lastSignals.unshift(signal);
  if (arenaState.market.lastSignals.length > config.signalHistoryMaxLen) {
    arenaState.market.lastSignals.pop();
  }
}

export function confirmEntryPayment(agentId: AgentId, payment: Partial<EntryPayment>) {
  if (!arenaState) return;
  const p = arenaState.payments[agentId];
  Object.assign(p, payment);
  logger.info(`Entry payment ${agentId}`, { phase: p.phase });

  if (
    arenaState.payments.agentA.phase === 'confirmed' &&
    arenaState.payments.agentB.phase === 'confirmed' &&
    arenaState.market.phase === 'ENTRY'
  ) {
    transitionPhase('TRADING');
  }
}

export function recordAgentAction(agentId: AgentId, action: AgentAction) {
  if (!arenaState) return;
  const agent = arenaState[agentId];

  // Track entry price when first opening a position
  if (agent.position === 'HOLD' && action.decision !== 'HOLD') {
    agent.entryPrice = arenaState.market.currentPrice;
  }
  if (action.decision === 'HOLD') {
    agent.entryPrice = undefined;
  }

  agent.lastAction = action;
  agent.lastReasoning = action.reasoning;
  agent.position = action.decision;
  agent.positionSize = action.size;
  if (action.txHash) agent.swapTxHash = action.txHash;

  agent.actionLog.unshift(action);
  if (agent.actionLog.length > 20) agent.actionLog.pop();

  arenaState.tickCount += 1;
  arenaState.lastTickAt = Date.now();

  // Immediately recalculate P&L after position change
  agent.currentPnl = calcAgentPnl(agent, arenaState.market.currentPrice);
}

export function resolveMarket() {
  if (!arenaState || arenaState.market.phase !== 'TRADING') return;
  transitionPhase('RESOLUTION');

  const { currentPrice, targetPrice, winner: existingWinner } = arenaState.market;
  if (existingWinner) return;

  // Final P&L snapshot
  arenaState.agentA.currentPnl = calcAgentPnl(arenaState.agentA, currentPrice);
  arenaState.agentB.currentPnl = calcAgentPnl(arenaState.agentB, currentPrice);

  const pnlA = arenaState.agentA.currentPnl;
  const pnlB = arenaState.agentB.currentPnl;

  let winner: AgentId | 'draw';
  if (pnlA > pnlB) winner = 'agentA';
  else if (pnlB > pnlA) winner = 'agentB';
  else winner = 'draw';

  arenaState.market.winner = winner;
  arenaState.market.resolvedAt = Date.now();

  logger.info('Market resolved', { winner, pnlA, pnlB, finalPrice: currentPrice, targetPrice });
  onResolution?.(winner, currentPrice);
  transitionPhase('PAYOUT');
}

export function recordPayout(txHash: string) {
  if (!arenaState) return;
  arenaState.market.settlementTxHash = txHash;
  logger.info('Payout recorded', { txHash });
}
