import '../../styles/traces.css';

interface Props {
  isTrading: boolean;
  paymentA: boolean;
  paymentB: boolean;
}

export function TraceLayer({ isTrading, paymentA, paymentB }: Props) {
  const traceClass = isTrading ? 'trace-active' : 'trace-idle';
  const traceAClass = paymentA ? 'trace-payment-active' : 'trace-payment-idle';
  const traceBClass = paymentB ? 'trace-payment-active' : 'trace-payment-idle';

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      preserveAspectRatio="none"
    >
      {/* Left chip → center: horizontal then diagonal */}
      <path
        d="M 280 50% L 380 50% L 420 45%"
        fill="none" strokeWidth="2"
        className={traceClass}
      />
      <path
        d="M 280 55% L 370 55% L 410 60%"
        fill="none" strokeWidth="1.5"
        className={traceClass}
        style={{ animationDelay: '0.3s' }}
      />

      {/* Right chip → center */}
      <path
        d="M 720 50% L 620 50% L 580 45%"
        fill="none" strokeWidth="2"
        className={traceClass}
        style={{ animationDelay: '0.15s' }}
      />
      <path
        d="M 720 55% L 630 55% L 590 60%"
        fill="none" strokeWidth="1.5"
        className={traceClass}
        style={{ animationDelay: '0.45s' }}
      />

      {/* Payment traces — bottom, connecting agent chips through bottom rail */}
      <path
        d="M 140 88% L 140 92% L 500 92%"
        fill="none" strokeWidth="3"
        className={traceAClass}
      />
      <path
        d="M 860 88% L 860 92% L 500 92%"
        fill="none" strokeWidth="3"
        className={traceBClass}
        style={{ animationDelay: '0.2s' }}
      />

      {/* Decorative via holes */}
      {[[280, '50%'], [380, '50%'], [720, '50%'], [620, '50%']].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4" fill="var(--pcb-bg)" stroke="var(--trace-dim)" strokeWidth="2" />
      ))}
    </svg>
  );
}
