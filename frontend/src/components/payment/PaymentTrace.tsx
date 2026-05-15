import '../../styles/glow.css';
import type { PaymentState, PayoutPayment } from '../../types/arena';

interface Props {
  payments: PaymentState;
}

function PaymentStatus({ label, phase, payout }: { label: string; phase: string; payout?: PayoutPayment }) {
  const isActive = phase === 'confirmed';
  const color = isActive ? 'var(--trace-amber)' : 'var(--text-muted)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 16px',
      border: `1px solid ${isActive ? 'var(--trace-amber-dim)' : 'var(--chip-border-dim)'}`,
      borderRadius: 4,
      background: isActive ? 'rgba(255,183,0,0.04)' : 'transparent',
    }} className={isActive ? 'payment-amber' : ''}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, boxShadow: isActive ? `0 0 8px ${color}` : 'none',
      }} />
      <span style={{ fontSize: 9, color, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1 }}>
        {phase.toUpperCase()}
      </span>
      {payout && (
        <span style={{ fontSize: 9, color: 'var(--trace-amber)', marginLeft: 8 }}>
          PAYOUT: {payout.status.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function PaymentTrace({ payments }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 16, alignItems: 'center',
      zIndex: 10,
    }}>
      <PaymentStatus label="ALPHA-7 ENTRY" phase={payments.agentA.phase} />
      <div style={{ width: 60, height: 2, background: 'var(--trace-amber-dim)', borderRadius: 1 }} />
      <PaymentStatus label="OMEGA-3 ENTRY" phase={payments.agentB.phase} payout={payments.payout} />
    </div>
  );
}
