import { motion, AnimatePresence } from 'framer-motion';
import type { AgentAction } from '../../types/arena';

interface Props { log: AgentAction[] }

export function ReasoningLog({ log }: Props) {
  const last3 = log.slice(0, 3);

  return (
    <div style={{
      padding: '6px 12px 12px',
      minHeight: 72,
      borderTop: '1px solid var(--chip-border-dim)',
      marginTop: 4,
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>
        AGENT LOG
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 80 }}>
        <AnimatePresence initial={false}>
          {last3.map((action) => (
            <motion.div
              key={action.ts}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}
            >
              <span style={{
                color: action.decision === 'LONG' ? 'var(--long-color)' :
                       action.decision === 'SHORT' ? 'var(--short-color)' : 'var(--hold-color)',
                fontWeight: 'bold', marginRight: 6, fontSize: 9,
              }}>
                {action.decision}
              </span>
              {action.reasoning}
            </motion.div>
          ))}
        </AnimatePresence>
        {last3.length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AWAITING FIRST TICK…</div>
        )}
      </div>
    </div>
  );
}
