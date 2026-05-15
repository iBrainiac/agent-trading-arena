import { useEffect, useRef } from 'react';
import type { AgentState, MarketState } from '../../types/arena';

interface Props {
  agentA: AgentState;
  agentB: AgentState;
  market: MarketState;
}

const A_COLOR = '#00ff87';
const B_COLOR = '#ff4757';
const PAD = { top: 28, right: 52, bottom: 32, left: 52 };

export function RaceChart({ agentA, agentB, market }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glowPhase = useRef(0);

  // Stable refs so the RAF loop always sees fresh data without restart
  const dataRef = useRef({ agentA, agentB, market });
  useEffect(() => { dataRef.current = { agentA, agentB, market }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to parent once
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    const ro = new ResizeObserver(() => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let running = true;

    function draw() {
      if (!running) return;
      const { agentA, agentB, market } = dataRef.current;
      const ctx = canvas!.getContext('2d');
      if (!ctx) return;

      const W = canvas!.width;
      const H = canvas!.height;
      const cW = W - PAD.left - PAD.right;
      const cH = H - PAD.top - PAD.bottom;

      ctx.clearRect(0, 0, W, H);
      glowPhase.current += 0.04;
      const gsin = Math.sin(glowPhase.current);

      const startTs = market.createdAt;
      const endTs = market.resolutionTime;
      const timeRange = Math.max(endTs - startTs, 1);
      const now = Math.min(Date.now(), endTs);

      // Y-axis: auto-scale to widest P&L seen, minimum ±1
      const allPnl = [
        ...agentA.pnlHistory.map((p) => p.pnl),
        ...agentB.pnlHistory.map((p) => p.pnl),
        1, -1,
      ];
      const maxAbs = Math.max(...allPnl.map(Math.abs));
      const yMax = maxAbs * 1.2; // 20% headroom

      const toX = (ts: number) => PAD.left + ((ts - startTs) / timeRange) * cW;
      const toY = (pnl: number) => PAD.top + cH / 2 - (pnl / yMax) * (cH / 2);
      const zeroY = PAD.top + cH / 2;
      const finishX = PAD.left + cW;

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(0,255,65,0.03)');
      bg.addColorStop(0.5, 'rgba(0,0,0,0)');
      bg.addColorStop(1, 'rgba(255,71,87,0.03)');
      ctx.fillStyle = bg;
      ctx.fillRect(PAD.left, PAD.top, cW, cH);

      // Horizontal grid lines
      ctx.strokeStyle = 'rgba(0,255,65,0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (cH / 4) * i;
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(finishX, y); ctx.stroke();
      }

      // Zero line
      ctx.strokeStyle = 'rgba(0,255,65,0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(finishX, zeroY); ctx.stroke();
      ctx.setLineDash([]);

      // Y axis labels
      ctx.fillStyle = 'rgba(0,255,65,0.45)';
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textAlign = 'right';
      [yMax, yMax / 2, 0, -yMax / 2, -yMax].forEach((v, i) => {
        const y = PAD.top + (cH / 4) * i;
        ctx.fillText(`$${v >= 0 ? '+' : ''}${v.toFixed(1)}`, PAD.left - 6, y + 3);
      });

      // Finish line — pulsing amber
      const fAlpha = 0.5 + 0.35 * gsin;
      ctx.strokeStyle = `rgba(255,183,0,${fAlpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath(); ctx.moveTo(finishX, PAD.top); ctx.lineTo(finishX, PAD.top + cH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Finish label
      ctx.fillStyle = `rgba(255,183,0,${fAlpha + 0.1})`;
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', finishX, PAD.top - 10);

      // Current-time cursor
      const nowX = toX(now);
      ctx.strokeStyle = 'rgba(0,255,65,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nowX, PAD.top); ctx.lineTo(nowX, PAD.top + cH); ctx.stroke();

      // Progress bar along bottom
      ctx.fillStyle = 'rgba(0,255,65,0.08)';
      ctx.fillRect(PAD.left, PAD.top + cH + 4, ((now - startTs) / timeRange) * cW, 3);
      ctx.strokeStyle = 'rgba(0,255,65,0.15)';
      ctx.strokeRect(PAD.left, PAD.top + cH + 4, cW, 3);

      // Draw a P&L line
      function drawLine(
        history: { ts: number; pnl: number }[],
        color: string,
        label: string,
        currentPnl: number,
      ) {
        if (!ctx) return;
        const points = history.length > 0 ? history : [{ ts: startTs, pnl: 0 }];

        // Smooth bezier path
        ctx.beginPath();
        ctx.moveTo(toX(points[0].ts), toY(points[0].pnl));
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const cpx = (toX(prev.ts) + toX(curr.ts)) / 2;
          ctx.bezierCurveTo(cpx, toY(prev.pnl), cpx, toY(curr.pnl), toX(curr.ts), toY(curr.pnl));
        }

        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Glowing dot at head
        const head = points[points.length - 1];
        const hx = toX(head.ts);
        const hy = toY(head.pnl);
        const dotPulse = 0.7 + 0.3 * gsin;

        ctx.shadowColor = color;
        ctx.shadowBlur = 14 * dotPulse;
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label beside dot
        const sign = currentPnl >= 0 ? '+' : '';
        const labelText = `${label}  ${sign}$${currentPnl.toFixed(2)}`;
        ctx.font = 'bold 9px "Share Tech Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = hx > W * 0.6 ? 'right' : 'left';
        const lx = hx + (hx > W * 0.6 ? -10 : 10);
        ctx.fillText(labelText, lx, hy - 10);
      }

      drawLine(agentA.pnlHistory, A_COLOR, agentA.displayName, agentA.currentPnl);
      drawLine(agentB.pnlHistory, B_COLOR, agentB.displayName, agentB.currentPnl);

      // Winner banner when resolved
      if (market.winner) {
        const w = market.winner;
        const bannerColor = w === 'draw' ? '#ffd32a' : w === 'agentA' ? A_COLOR : B_COLOR;
        const bannerText = w === 'draw'
          ? 'DRAW'
          : `${(w === 'agentA' ? agentA : agentB).displayName} WINS`;
        ctx.font = 'bold 18px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = bannerColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = bannerColor;
        ctx.fillText(bannerText, W / 2, PAD.top + cH / 2 - 10);
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []); // one long-running loop; reads fresh data from dataRef

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
