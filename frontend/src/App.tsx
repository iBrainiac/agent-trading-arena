import { useState } from 'react';
import { useArenaStore } from './store/arenaStore';
import { useArenaWs } from './hooks/useArenaWs';
import { CircuitBoard } from './components/layout/CircuitBoard';
import { TraceLayer } from './components/layout/TraceLayer';
import { AgentChip } from './components/agent/AgentChip';
import { MarketProcessor } from './components/market/MarketProcessor';
import { PaymentTrace } from './components/payment/PaymentTrace';
import { BoardFlash } from './components/fx/BoardFlash';
import { LandingPage } from './components/layout/LandingPage';
import type { ArenaFormConfig } from './types/arena';
import './styles/globals.css';
import './styles/glow.css';
import './styles/traces.css';

const DURATION_PRESETS = [
  { label: '1 MIN', value: 1 },
  { label: '2 MIN', value: 2 },
  { label: '3 MIN', value: 3 },
  { label: '5 MIN', value: 5 },
];

const BASE_ASSET = {
  symbol: 'ETH',
  chainIndex: '8453',
  tokenContractAddress: '0x4200000000000000000000000000000000000006',
};

const DEFAULT_CONFIG: ArenaFormConfig = {
  question: 'Will ETH be above $3200?',
  targetPrice: 3200,
  durationMin: 2,
  entryFeeUsdt: '1',
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,255,65,0.04)',
  border: '1px solid var(--chip-border-dim)',
  borderRadius: 4, color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', fontSize: 13,
  padding: '8px 12px', width: '100%', outline: 'none',
};

async function callReset() {
  await fetch('/api/arena/reset', { method: 'POST' });
}

async function callCreate(cfg: ArenaFormConfig) {
  const resTime = new Date(Date.now() + cfg.durationMin * 60_000).toISOString();
  await fetch('/api/arena/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: cfg.question,
      targetPrice: cfg.targetPrice,
      targetAsset: BASE_ASSET,
      resolutionTimeIso: resTime,
      entryFeeUsdt: cfg.entryFeeUsdt,
    }),
  });
}

interface CreateFormProps {
  initial: ArenaFormConfig;
  onCreated: (cfg: ArenaFormConfig) => void;
  isRematch?: boolean;
}

function CreateArenaForm({ initial, onCreated, isRematch }: CreateFormProps) {
  const [cfg, setCfg] = useState<ArenaFormConfig>(initial);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    await callCreate(cfg);
    setLoading(false);
    onCreated(cfg);
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        width: 420, background: 'var(--chip-bg)',
        border: '2px solid var(--chip-border-dim)',
        borderRadius: 8, padding: 32,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900,
          marginBottom: 24, letterSpacing: 2, textAlign: 'center',
          color: isRematch ? 'var(--long-color)' : 'var(--text-primary)',
          textShadow: isRematch ? '0 0 16px var(--long-color)' : 'none',
        }}>
          {isRematch ? '⚡ REMATCH' : 'INITIALIZE ARENA'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              PREDICTION QUESTION
            </label>
            <input
              style={inputStyle}
              value={cfg.question}
              onChange={(e) => setCfg((c) => ({ ...c, question: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              TARGET PRICE (USD)
            </label>
            <input
              style={inputStyle}
              type="number"
              value={cfg.targetPrice}
              onChange={(e) => {
                const price = Number(e.target.value);
                setCfg((c) => ({
                  ...c,
                  targetPrice: price,
                  question: `Will ETH be above $${price.toLocaleString()}?`,
                }));
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              DURATION
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DURATION_PRESETS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setCfg((c) => ({ ...c, durationMin: value }))}
                  style={{
                    flex: 1, padding: '8px 0',
                    fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    borderRadius: 4, cursor: 'pointer',
                    border: cfg.durationMin === value ? '2px solid var(--chip-border)' : '1px solid var(--chip-border-dim)',
                    background: cfg.durationMin === value ? 'rgba(0,255,65,0.12)' : 'transparent',
                    color: cfg.durationMin === value ? 'var(--text-primary)' : 'var(--text-dim)',
                    boxShadow: cfg.durationMin === value ? '0 0 12px rgba(0,255,65,0.2)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              ENTRY FEE (USDT)
            </label>
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={cfg.entryFeeUsdt}
              onChange={(e) => setCfg((c) => ({ ...c, entryFeeUsdt: e.target.value }))}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !cfg.question || !cfg.targetPrice}
            style={{
              marginTop: 8,
              background: loading ? 'var(--trace-dim)' : 'rgba(0,255,65,0.12)',
              border: '2px solid var(--chip-border)',
              borderRadius: 4, color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)', fontSize: 12,
              fontWeight: 700, letterSpacing: 2, padding: '12px 24px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'INITIALIZING…' : 'LAUNCH ARENA'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: 24, right: 48,
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 9, color: connected ? 'var(--long-color)' : 'var(--short-color)',
      letterSpacing: 1, zIndex: 20,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: connected ? 'var(--long-color)' : 'var(--short-color)',
        boxShadow: connected ? '0 0 6px var(--long-color)' : 'none',
      }} />
      {connected ? 'CONNECTED' : 'CONNECTING…'}
    </div>
  );
}

type AppScreen = 'landing' | 'form' | 'waiting' | 'arena';

export default function App() {
  useArenaWs();

  const arena = useArenaStore((s) => s.arena);
  const wsConnected = useArenaStore((s) => s.wsConnected);
  const resolutionFlash = useArenaStore((s) => s.resolutionFlash);
  const lastConfig = useArenaStore((s) => s.lastConfig);
  const setLastConfig = useArenaStore((s) => s.setLastConfig);
  const clearArena = useArenaStore((s) => s.clearArena);

  const [screen, setScreen] = useState<AppScreen>('landing');
  const [isRematch, setIsRematch] = useState(false);

  // When WS pushes arena data, move to arena screen
  if (arena && screen === 'waiting') setScreen('arena');
  // If arena was cleared externally (ARENA_RESET), return to landing
  if (!arena && screen === 'arena') setScreen('landing');

  async function handleCreated(cfg: ArenaFormConfig) {
    setLastConfig(cfg);
    setIsRematch(false);
    setScreen('waiting');
  }

  async function handleNewArena() {
    await callReset();
    clearArena();
    setIsRematch(false);
    setScreen('landing');
  }

  async function handleRematch() {
    await callReset();
    clearArena();
    setIsRematch(true);
    setScreen('form');
  }

  const isTrading = arena?.market.phase === 'TRADING';

  if (screen === 'landing') {
    return <LandingPage onEnter={() => setScreen('form')} />;
  }

  return (
    <CircuitBoard>
      <ConnectionBadge connected={wsConnected} />

      <TraceLayer
        isTrading={isTrading ?? false}
        paymentA={arena?.payments.agentA.phase === 'confirmed'}
        paymentB={arena?.payments.agentB.phase === 'confirmed'}
      />

      {screen === 'form' && (
        <CreateArenaForm
          initial={isRematch && lastConfig ? lastConfig : DEFAULT_CONFIG}
          onCreated={handleCreated}
          isRematch={isRematch}
        />
      )}

      {screen === 'waiting' && !arena && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, zIndex: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14,
            letterSpacing: 3, color: 'var(--text-dim)',
          }}>
            INITIALIZING ARENA…
          </div>
        </div>
      )}

      {arena && screen === 'arena' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '56px 24px 80px', gap: 16,
        }}>
          <AgentChip
            agent={arena.agentA}
            payment={arena.payments.agentA}
            lastSignal={arena.market.lastSignals[0]}
            phase={arena.market.phase}
            winner={arena.market.winner}
          />

          <MarketProcessor
            market={arena.market}
            agentA={arena.agentA}
            agentB={arena.agentB}
            winner={arena.market.winner}
            onNewArena={handleNewArena}
            onRematch={handleRematch}
          />

          <AgentChip
            agent={arena.agentB}
            payment={arena.payments.agentB}
            lastSignal={arena.market.lastSignals[1]}
            phase={arena.market.phase}
            winner={arena.market.winner}
          />
        </div>
      )}

      {arena && <PaymentTrace payments={arena.payments} />}

      <BoardFlash visible={resolutionFlash} winner={arena?.market.winner} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '14px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--chip-border-dim)',
        background: 'rgba(10,15,10,0.85)', backdropFilter: 'blur(4px)', zIndex: 20,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 13,
          fontWeight: 900, letterSpacing: 4, color: 'var(--text-primary)',
          textShadow: '0 0 18px var(--trace-green)',
        }}>
          AGENT TRADING ARENA
        </div>
        {arena && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>
              {arena.market.id.slice(0, 8).toUpperCase()} · TICK #{arena.tickCount}
            </span>
            <button
              onClick={handleNewArena}
              style={{
                fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1,
                padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--chip-border-dim)',
                color: 'var(--text-dim)',
              }}
            >
              END
            </button>
          </div>
        )}
      </div>
    </CircuitBoard>
  );
}
