import type { ReactNode } from 'react';

interface Props { children: ReactNode }

export function CircuitBoard({ children }: Props) {
  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: 'var(--pcb-bg)',
      overflow: 'hidden',
    }}>
      {/* PCB grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(var(--pcb-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--pcb-grid) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        opacity: 0.6,
      }} />

      {/* Corner pads */}
      {[
        { top: 16, left: 16 }, { top: 16, right: 16 },
        { bottom: 16, left: 16 }, { bottom: 16, right: 16 },
      ].map((style, i) => (
        <div key={i} style={{
          position: 'absolute', width: 24, height: 24,
          border: '2px solid var(--trace-dim)',
          borderRadius: 2,
          ...style,
        }}>
          <div style={{
            position: 'absolute', inset: 4,
            background: 'var(--trace-dim)',
            borderRadius: 1,
          }} />
        </div>
      ))}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}
