import type { SignalEvent } from '../../types/arena';

interface Props { signal?: SignalEvent }

const walletLabels: Record<string, string> = {
  '1': 'SMART MONEY',
  '2': 'KOL',
  '3': 'WHALE',
};

export function AgentSignal({ signal }: Props) {
  if (!signal) {
    return (
      <div style={{ padding: '4px 12px 8px', color: 'var(--text-muted)', fontSize: 10 }}>
        NO SIGNAL
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{
        background: 'rgba(0,255,65,0.1)', border: '1px solid var(--chip-border-dim)',
        borderRadius: 3, padding: '2px 6px', fontSize: 9, letterSpacing: 1, color: 'var(--text-secondary)',
      }}>
        {walletLabels[signal.walletType] ?? 'UNKNOWN'}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
        ${signal.amountUsd.toFixed(0)}
      </span>
      <span style={{ fontSize: 10, color: signal.soldRatioPercentage > 50 ? 'var(--short-color)' : 'var(--long-color)' }}>
        sold {signal.soldRatioPercentage}%
      </span>
    </div>
  );
}
