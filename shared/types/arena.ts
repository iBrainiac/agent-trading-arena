export type MarketPhase = 'CREATE' | 'ENTRY' | 'TRADING' | 'RESOLUTION' | 'PAYOUT';
export type AgentId = 'agentA' | 'agentB';
export type Position = 'LONG' | 'SHORT' | 'HOLD';

export interface OHLCV {
  ts: number;
  o: number; h: number; l: number; c: number;
  vol: number; volUsd: number; confirm: boolean;
}

export interface SignalEvent {
  ts: number;
  symbol: string;
  walletType: '1' | '2' | '3';
  amountUsd: number;
  triggerWalletCount: number;
  soldRatioPercentage: number;
}

export interface AgentAction {
  ts: number;
  decision: Position;
  size: string;
  reasoning: string;
  txHash?: string;
  swapSuccess: boolean;
}

export interface PnlPoint {
  ts: number;
  pnl: number;
}

export interface MarketState {
  id: string;
  phase: MarketPhase;
  question: string;
  targetPrice: number;
  targetAsset: { symbol: string; chainIndex: string; tokenContractAddress: string };
  resolutionTime: number;
  entryFeeUsdt: string;
  entryFeeMinimal: string;
  winner?: AgentId | 'draw';
  settlementTxHash?: string;
  createdAt: number;
  resolvedAt?: number;
  currentPrice: number;
  priceHistory: OHLCV[];
  lastSignals: SignalEvent[];
}

export interface AgentState {
  id: AgentId;
  displayName: string;
  walletAddress: string;
  entryPaymentStatus: 'pending' | 'settling' | 'completed' | 'failed';
  entryTxHash?: string;
  stake: string;
  position: Position;
  positionSize: string;
  entryPrice?: number;
  currentPnl: number;
  pnlHistory: PnlPoint[];
  lastReasoning: string;
  lastAction: AgentAction | null;
  actionLog: AgentAction[];
  swapTxHash?: string;
}

export interface EntryPayment {
  phase: 'unpaid' | 'signed' | 'confirmed';
  paymentSigHeader?: string;
  txHash?: string;
  confirmedAt?: number;
}

export interface PayoutPayment {
  paymentId: string;
  amount: string;
  recipient: string;
  status: 'pending' | 'settling' | 'completed' | 'failed' | 'expired';
  txHash?: string;
  confirmedAt?: number;
}

export interface PaymentState {
  agentA: EntryPayment;
  agentB: EntryPayment;
  payout?: PayoutPayment;
}

export interface ArenaState {
  market: MarketState;
  agentA: AgentState;
  agentB: AgentState;
  payments: PaymentState;
  tickCount: number;
  lastTickAt: number;
}

export type WsEvent =
  | { type: 'ARENA_SNAPSHOT'; data: ArenaState }
  | { type: 'ARENA_RESET' }
  | { type: 'PHASE_CHANGE'; data: { phase: MarketPhase } }
  | { type: 'PRICE_UPDATE'; data: { price: number; candle: OHLCV; pnlA: number; pnlB: number } }
  | { type: 'SIGNAL_UPDATE'; data: { signal: SignalEvent } }
  | { type: 'AGENT_TICK'; data: { agentId: AgentId; action: AgentAction } }
  | { type: 'PAYMENT_UPDATE'; data: { agentId: AgentId; payment: EntryPayment } }
  | { type: 'PAYOUT_UPDATE'; data: PayoutPayment }
  | { type: 'RESOLUTION'; data: { winner: AgentId | 'draw'; finalPrice: number } }
  | { type: 'ERROR'; data: { message: string } };

export type WsClientEvent =
  | { type: 'SUBSCRIBE'; data: { arenaId: string } }
  | { type: 'PING' };

export interface CreateArenaDto {
  question: string;
  targetPrice: number;
  targetAsset: { symbol: string; chainIndex: string; tokenContractAddress: string };
  resolutionTimeIso: string;
  entryFeeUsdt: string;
}
