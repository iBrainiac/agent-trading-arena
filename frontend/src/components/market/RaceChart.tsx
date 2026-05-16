import { useEffect, useRef } from 'react';
import type { AgentState, MarketState } from '../../types/arena';

interface Props {
  agentA: AgentState;
  agentB: AgentState;
  market: MarketState;
}

const A_COLOR = '#00ff87';
const B_COLOR = '#ff4757';
const PAD = { top: 44, right: 64, bottom: 36, left: 52 };

function drawJet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  glow: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * glow;
  ctx.fillStyle = color;

  // Fuselage
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(6, -3.5);
  ctx.lineTo(-10, -3);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-10, 3);
  ctx.lineTo(6, 3.5);
  ctx.closePath();
  ctx.fill();

  // Top wing
  ctx.beginPath();
  ctx.moveTo(4, -3);
  ctx.lineTo(-5, -17);
  ctx.lineTo(-13, -3);
  ctx.closePath();
  ctx.fill();

  // Bottom wing
  ctx.beginPath();
  ctx.moveTo(4, 3);
  ctx.lineTo(-5, 17);
  ctx.lineTo(-13, 3);
  ctx.closePath();
  ctx.fill();

  // Tail fin
  ctx.beginPath();
  ctx.moveTo(-11, -3);
  ctx.lineTo(-18, -10);
  ctx.lineTo(-18, -2);
  ctx.closePath();
  ctx.fill();

  // Cockpit highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(10, -1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function RaceChart({ agentA, agentB, market }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glowPhase = useRef(0);
  const dataRef = useRef({ agentA, agentB, market });
  useEffect(() => { dataRef.current = { agentA, agentB, market }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

      const allPnl = [
        ...agentA.pnlHistory.map((p) => p.pnl),
        ...agentB.pnlHistory.map((p) => p.pnl),
        1, -1,
      ];
      const maxAbs = Math.max(...allPnl.map(Math.abs));
      const yMax = maxAbs * 1.2;

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

      // Grid lines
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
      ctx.fillStyle = `rgba(255,183,0,${fAlpha + 0.1})`;
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', finishX, PAD.top - 14);

      // Progress bar along bottom
      ctx.fillStyle = 'rgba(0,255,65,0.08)';
      ctx.fillRect(PAD.left, PAD.top + cH + 4, ((now - startTs) / timeRange) * cW, 3);
      ctx.strokeStyle = 'rgba(0,255,65,0.15)';
      ctx.strokeRect(PAD.left, PAD.top + cH + 4, cW, 3);

      // Draw trail + exhaust + jet for one agent
      function drawAgent(
        history: { ts: number; pnl: number }[],
        color: string,
        label: string,
        currentPnl: number,
      ) {
        if (!ctx) return;
        const points = history.length > 0 ? history : [{ ts: startTs, pnl: 0 }];
        const head = points[points.length - 1];
        const jetX = toX(head.ts);
        const jetY = toY(head.pnl);

        // Exhaust trail — fades from transparent at start to visible near jet
        if (points.length > 1) {
          const grad = ctx.createLinearGradient(
            toX(points[0].ts), 0,
            jetX, 0,
          );
          grad.addColorStop(0, `${color}00`);
          grad.addColorStop(0.5, `${color}22`);
          grad.addColorStop(1, `${color}99`);

          ctx.beginPath();
          ctx.moveTo(toX(points[0].ts), toY(points[0].pnl));
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx = (toX(prev.ts) + toX(curr.ts)) / 2;
            ctx.bezierCurveTo(cpx, toY(prev.pnl), cpx, toY(curr.pnl), toX(curr.ts), toY(curr.pnl));
          }
          ctx.shadowColor = color;
          ctx.shadowBlur = 3;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Exhaust particles behind jet
        for (let i = 0; i < 6; i++) {
          const offset = (i + 1) * 7;
          const alpha = (1 - i / 6) * 0.55 * (0.8 + 0.2 * gsin);
          const spread = (Math.sin(glowPhase.current * 3 + i * 1.2)) * 3;
          const size = Math.max(0.5, 2 - i * 0.25);
          ctx.beginPath();
          ctx.arc(jetX - offset, jetY + spread, size, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.fill();
        }

        // Jet
        const pulse = 0.75 + 0.25 * gsin;
        drawJet(ctx, jetX, jetY, color, pulse);

        // Label
        const sign = currentPnl >= 0 ? '+' : '';
        const labelText = `${label}  ${sign}$${currentPnl.toFixed(2)}`;
        ctx.font = 'bold 9px "Share Tech Mono", monospace';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.textAlign = jetX > W * 0.65 ? 'right' : 'left';
        const lx = jetX + (jetX > W * 0.65 ? -32 : 32);
        ctx.fillText(labelText, lx, jetY - 22);
        ctx.shadowBlur = 0;
      }

      drawAgent(agentA.pnlHistory, A_COLOR, agentA.displayName, agentA.currentPnl);
      drawAgent(agentB.pnlHistory, B_COLOR, agentB.displayName, agentB.currentPnl);

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
