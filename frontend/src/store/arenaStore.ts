import { create } from 'zustand';
import type {
  ArenaState, MarketPhase, AgentId, AgentAction,
  EntryPayment, PayoutPayment, OHLCV, SignalEvent,
  PnlPoint, ArenaFormConfig,
} from '../types/arena';

const PNL_HISTORY_MAX = 300;

interface ArenaStore {
  arena: ArenaState | null;
  wsConnected: boolean;
  resolutionFlash: boolean;
  lastConfig: ArenaFormConfig | null;

  setArena: (arena: ArenaState) => void;
  clearArena: () => void;
  setWsConnected: (v: boolean) => void;
  setLastConfig: (cfg: ArenaFormConfig) => void;
  setPhase: (phase: MarketPhase) => void;
  updatePrice: (price: number, candle: OHLCV, pnlA: number, pnlB: number) => void;
  addSignal: (signal: SignalEvent) => void;
  recordAgentTick: (agentId: AgentId, action: AgentAction) => void;
  updatePayment: (agentId: AgentId, payment: EntryPayment) => void;
  updatePayout: (payout: PayoutPayment) => void;
  setResolution: (winner: AgentId | 'draw', finalPrice: number) => void;
  triggerFlash: () => void;
}

export const useArenaStore = create<ArenaStore>((set, get) => ({
  arena: null,
  wsConnected: false,
  resolutionFlash: false,
  lastConfig: null,

  setArena: (arena) => set({ arena }),
  clearArena: () => set({ arena: null }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setLastConfig: (lastConfig) => set({ lastConfig }),

  setPhase: (phase) =>
    set((s) => s.arena ? { arena: { ...s.arena, market: { ...s.arena.market, phase } } } : s),

  updatePrice: (price, candle, pnlA, pnlB) =>
    set((s) => {
      if (!s.arena) return s;

      // Update price history
      const history = [...s.arena.market.priceHistory];
      const last = history[history.length - 1];
      if (last && last.ts === candle.ts) history[history.length - 1] = candle;
      else {
        history.push(candle);
        if (history.length > 200) history.shift();
      }

      // Append P&L points for both agents
      const now = Date.now();
      const appendPnl = (existing: PnlPoint[], pnl: number): PnlPoint[] => {
        const next = [...existing, { ts: now, pnl }];
        if (next.length > PNL_HISTORY_MAX) next.shift();
        return next;
      };

      return {
        arena: {
          ...s.arena,
          market: { ...s.arena.market, currentPrice: price, priceHistory: history },
          agentA: {
            ...s.arena.agentA,
            currentPnl: pnlA,
            pnlHistory: appendPnl(s.arena.agentA.pnlHistory, pnlA),
          },
          agentB: {
            ...s.arena.agentB,
            currentPnl: pnlB,
            pnlHistory: appendPnl(s.arena.agentB.pnlHistory, pnlB),
          },
        },
      };
    }),

  addSignal: (signal) =>
    set((s) => {
      if (!s.arena) return s;
      const signals = [signal, ...s.arena.market.lastSignals].slice(0, 5);
      return { arena: { ...s.arena, market: { ...s.arena.market, lastSignals: signals } } };
    }),

  recordAgentTick: (agentId, action) =>
    set((s) => {
      if (!s.arena) return s;
      const agent = s.arena[agentId];
      const log = [action, ...agent.actionLog].slice(0, 20);
      return {
        arena: {
          ...s.arena,
          [agentId]: {
            ...agent,
            lastAction: action,
            lastReasoning: action.reasoning,
            position: action.decision,
            positionSize: action.size,
            actionLog: log,
          },
          tickCount: s.arena.tickCount + 1,
          lastTickAt: Date.now(),
        },
      };
    }),

  updatePayment: (agentId, payment) =>
    set((s) => s.arena
      ? { arena: { ...s.arena, payments: { ...s.arena.payments, [agentId]: payment } } }
      : s),

  updatePayout: (payout) =>
    set((s) => s.arena
      ? { arena: { ...s.arena, payments: { ...s.arena.payments, payout } } }
      : s),

  setResolution: (winner, finalPrice) => {
    set((s) => s.arena ? {
      arena: {
        ...s.arena,
        market: { ...s.arena.market, winner, currentPrice: finalPrice, phase: 'RESOLUTION' },
      },
    } : s);
    get().triggerFlash();
  },

  triggerFlash: () => {
    set({ resolutionFlash: true });
    setTimeout(() => set({ resolutionFlash: false }), 1200);
  },
}));
