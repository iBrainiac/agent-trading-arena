import { motion, AnimatePresence } from 'framer-motion';
import { RaceChart } from './RaceChart';
import { CountdownTimer } from './CountdownTimer';
import '../../styles/glow.css';
import type { MarketState, AgentState, AgentId } from '../../types/arena';

interface Props {
  market: MarketState;
  agentA: AgentState;
  agentB: AgentState;
  winner?: AgentId | 'draw';
  onNewArena: () => void;
  onRematch: () => void;
}

export function MarketProcessor({ market, agentA, agentB, winner, onNewArena, onRematch }: Props) {
  const priceColor = market.currentPrice >= market.targetPrice ? 'var(--long-color)' : 'var(--short-color)';
  const isResolved = !!winner;
  const winnerName = winner === 'agentA' ? agentA.displayName
    : winner === 'agentB' ? agentB.displayName
    : 'DRAW';

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
    letterSpacing: 2, padding: '8px 18px', borderRadius: 4, cursor: 'pointer',
    border: '1px solid', transition: 'all 0.15s',
  };

  return (
    <div style={{
      width: 360, height: '90%', maxHeight: 600,
      background: 'var(--chip-bg)',
      border: '2px solid var(--chip-border-dim)',
      borderRadius: 8,
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }} className="chip-active">

      {/* IC notch */}
      <div style={{
        position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
        width: 60, height: 10, background: 'var(--pcb-bg)',
        borderRadius: '0 0 8px 8px', border: '1px solid var(--chip-border-dim)', borderTop: 'none',
      }} />

      {/* Header */}
      <div style={{
        padding: '16px 16px 10px', borderBottom: '1px solid var(--chip-border-dim)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 3 }}>MARKET PROCESSOR</div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
          color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3,
        }}>
          {market.question}
        </div>

        {/* Live price */}
        <AnimatePresence mode="wait">
          <motion.div
            key={Math.floor(market.currentPrice * 10)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
              color: priceColor, textShadow: `0 0 14px ${priceColor}`, letterSpacing: 2,
            }}
          >
            ${market.currentPrice > 0
              ? market.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '---'}
          </motion.div>
        </AnimatePresence>

        <div style={{ fontSize: 10, color: 'var(--trace-amber)', display: 'flex', gap: 8 }}>
          <span>TARGET</span>
          <span style={{ fontWeight: 'bold' }}>${market.targetPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* Race chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <RaceChart agentA={agentA} agentB={agentB} market={market} />
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px 14px', borderTop: '1px solid var(--chip-border-dim)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        {isResolved ? (
          <>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900, textAlign: 'center',
              color: winner === 'draw' ? 'var(--hold-color)' : 'var(--long-color)',
              textShadow: '0 0 16px currentColor',
            }}>
              {winner === 'draw' ? '⚡ DRAW — REFUNDING' : `🏆 ${winnerName} WINS`}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onRematch} style={{
                ...btnBase,
                background: 'rgba(0,255,65,0.1)', borderColor: 'var(--chip-border)',
                color: 'var(--text-primary)',
              }}>
                REMATCH
              </button>
              <button onClick={onNewArena} style={{
                ...btnBase,
                background: 'transparent', borderColor: 'var(--chip-border-dim)',
                color: 'var(--text-dim)',
              }}>
                NEW ARENA
              </button>
            </div>
          </>
        ) : (
          <CountdownTimer resolutionTime={market.resolutionTime} />
        )}
        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2 }}>
          PHASE: {market.phase}
        </div>
      </div>
    </div>
  );
}
