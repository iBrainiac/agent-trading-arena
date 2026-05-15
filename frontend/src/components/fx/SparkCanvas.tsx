import { useEffect, useRef } from 'react';

interface Props { trigger: number }

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number; size: number; color: string;
}

export function SparkCanvas({ trigger }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const colors = ['#00ff41', '#00ff87', '#7dff9e', '#ffffff'];

    const particles: Particle[] = Array.from({ length: 28 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    let frame = 0;
    function draw() {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.025;
        if (p.alpha <= 0) return;
        ctx!.globalAlpha = p.alpha;
        ctx!.fillStyle = p.color;
        ctx!.shadowColor = p.color;
        ctx!.shadowBlur = 6;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;
      frame++;
      if (frame < 50) rafRef.current = requestAnimationFrame(draw);
      else ctx!.clearRect(0, 0, canvas.width, canvas.height);
    }

    cancelAnimationFrame(rafRef.current);
    frame = 0;
    draw();

    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={260}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        width: '100%', height: '100%',
      }}
    />
  );
}
