import { motion, AnimatePresence } from 'framer-motion';
import type { AgentId } from '../../types/arena';

interface Props {
  visible: boolean;
  winner?: AgentId | 'draw';
}

export function BoardFlash({ visible, winner }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.6, 0.3, 0] }}
          transition={{ duration: 1.2, times: [0, 0.15, 0.4, 0.7, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: winner === 'draw'
              ? 'radial-gradient(ellipse at center, rgba(255,211,42,0.6) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(0,255,65,0.8) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </AnimatePresence>
  );
}
