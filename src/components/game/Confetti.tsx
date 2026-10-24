import { useEffect, useRef } from 'react';

const COLORS = ['#e31e24', '#ff5a5f', '#1f4fb5', '#6c95ff', '#ffffff', '#f7b32b'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
}

/** One burst of red and blue confetti from both sides of the screen. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const reduce =
      document.documentElement.dataset.motion === 'reduce' ||
      (document.documentElement.dataset.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) return;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = innerWidth * dpr);
    const h = (canvas.height = innerHeight * dpr);
    const pieces: Piece[] = Array.from({ length: 140 }, (_, i) => {
      const left = i % 2 === 0;
      const angle = (-60 + Math.random() * 30) * (Math.PI / 180);
      const speed = (9 + Math.random() * 9) * dpr;
      return {
        x: left ? 0 : w,
        y: h * 0.75,
        vx: Math.cos(angle) * speed * (left ? 1 : -1),
        vy: Math.sin(angle) * speed,
        size: (5 + Math.random() * 6) * dpr,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length]!,
      };
    });
    let frame = 0;
    let raf = 0;
    const tick = () => {
      g.clearRect(0, 0, w, h);
      for (const p of pieces) {
        p.vy += 0.28 * dpr;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        g.save();
        g.globalAlpha = Math.max(0, 1 - frame / 220);
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
      }
      if (++frame < 220) raf = requestAnimationFrame(tick);
      else g.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
