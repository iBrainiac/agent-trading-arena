import { motion } from 'framer-motion';
import { AgentStats } from './AgentStats';
import { AgentSignal } from './AgentSignal';
import { ReasoningLog } from './ReasoningLog';
import { SparkCanvas } from '../fx/SparkCanvas';
import '../../styles/glow.css';
import type { AgentState, EntryPayment, SignalEvent, MarketPhase, AgentId } from '../../types/arena';

interface Props {
  agent: AgentState;
  payment: EntryPayment;
  lastSignal?: SignalEvent;
  phase: MarketPhase;
  winner?: AgentId | 'draw';
}

const PHASE_LED: Record<string, string> = {
  ENTRY: 'var(--hold-color)',
  TRADING: 'var(--long-color)',
  RESOLUTION: 'var(--short-color)',
  PAYOUT: 'var(--trace-amber)',
};

export function AgentChip({ agent, payment, lastSignal, phase, winner }: Props) {
  const isWinner = winner === agent.id;
  const isLoser = winner && winner !== 'draw' && winner !== agent.id;
  const isTrading = phase === 'TRADING';
  const lastSwapTick = agent.lastAction?.swapSuccess && agent.lastAction.decision !== 'HOLD';

  const chipClass = isWinner ? 'chip-winner' : isLoser ? 'chip-loser' : isTrading ? 'chip-active' : '';

  return (
    <motion.div
      layout
      style={{
        width: 260,
        background: 'var(--chip-bg)',
        border: `2px solid ${isWinner ? 'var(--long-color)' : 'var(--chip-border-dim)'}`,
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
      className={chipClass}
    >
      {/* IC chip notch */}
      <div style={{
        position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
        width: 40, height: 8, background: 'var(--pcb-bg)',
        borderRadius: '0 0 8px 8px', border: '1px solid var(--chip-border-dim)', borderTop: 'none',
      }} />

      {/* Header */}
      <div style={{
        padding: '14px 12px 8px',
        borderBottom: '1px solid var(--chip-border-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>AGENT</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>
            {agent.displayName}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {/* Status LED */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: PHASE_LED[phase] ?? 'var(--text-muted)',
            boxShadow: `0 0 6px ${PHASE_LED[phase] ?? 'transparent'}`,
          }} className={isTrading ? 'led-active' : ''} />
          {/* Payment status */}
          <div style={{ fontSize: 9, color: payment.phase === 'confirmed' ? 'var(--long-color)' : 'var(--text-dim)' }}>
            {payment.phase.toUpperCase()}
          </div>
        </div>
      </div>

      {/* IC pin labels (decorative) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '4px 8px', fontSize: 8, color: 'var(--text-muted)',
      }}>
        {['VCC', 'GND', 'CLK', 'DAT'].map((p) => (
          <span key={p}>{p}</span>
        ))}
      </div>

      <AgentStats agent={agent} />
      <AgentSignal signal={lastSignal} />
      <ReasoningLog log={agent.actionLog} />

      {/* Spark FX on swap */}
      {lastSwapTick && <SparkCanvas trigger={agent.lastAction?.ts ?? 0} />}

      {/* Wallet address */}
      <div style={{
        padding: '6px 12px',
        fontSize: 9, color: 'var(--text-muted)',
        borderTop: '1px solid var(--chip-border-dim)',
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {agent.walletAddress}
      </div>
    </motion.div>
  );
}
