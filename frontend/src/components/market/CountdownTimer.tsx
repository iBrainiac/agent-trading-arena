import { useCountdown } from '../../hooks/useCountdown';
import '../../styles/glow.css';

interface Props { resolutionTime: number }

export function CountdownTimer({ resolutionTime }: Props) {
  const { minutes, seconds, isCritical, isPulsing } = useCountdown(resolutionTime);

  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 4 }}>
        TIME REMAINING
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 4,
          color: isCritical ? 'var(--short-color)' : 'var(--text-primary)',
          textShadow: isCritical
            ? '0 0 10px var(--short-color)'
            : '0 0 10px var(--trace-green)',
        }}
        className={isPulsing ? 'countdown-critical' : ''}
      >
        {display}
      </div>
    </div>
  );
}
