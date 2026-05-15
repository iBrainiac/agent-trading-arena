import { motion, AnimatePresence } from 'framer-motion';
import type { AgentState } from '../../types/arena';

interface Props { agent: AgentState }

export function AgentStats({ agent }: Props) {
  const pnlColor = agent.currentPnl >= 0 ? 'var(--pnl-positive)' : 'var(--pnl-negative)';
  const posColor =
    agent.position === 'LONG' ? 'var(--long-color)' :
    agent.position === 'SHORT' ? 'var(--short-color)' :
    'var(--hold-color)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 12px 12px' }}>
      {[
        { label: 'STAKE', value: `$${agent.stake}` },
        { label: 'SIZE', value: `${(parseFloat(agent.positionSize) * 100).toFixed(0)}%` },
        {
          label: 'POSITION',
          value: agent.position,
          style: { color: posColor, fontWeight: 'bold' },
        },
        {
          label: 'P&L',
          value: `${agent.currentPnl >= 0 ? '+' : ''}$${agent.currentPnl.toFixed(2)}`,
          style: { color: pnlColor },
        },
      ].map(({ label, value, style }) => (
        <div key={label} style={{
          background: 'rgba(0,255,65,0.03)',
          border: '1px solid var(--chip-border-dim)',
          borderRadius: 4,
          padding: '6px 8px',
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2, letterSpacing: 1 }}>{label}</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={value}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 13, fontFamily: 'var(--font-display)', ...style }}
            >
              {value}
            </motion.div>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
