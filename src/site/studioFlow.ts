import type { InkPoint, InkSplashOptions, InkStageHandle } from 'react-sumi-ink';

type Seg = { a: InkPoint; b: InkPoint; opts: InkSplashOptions };

const river = (t: number): [number, number] => {
  const x = -0.03 + t * 1.06;
  const dive = Math.sin(t * Math.PI);
  const y = 0.4 + dive * 0.3 + Math.sin(t * Math.PI * 2.2) * 0.055 + Math.sin(t * 13.0) * 0.02;
  return [x, Math.min(0.9, Math.max(0.26, y))];
};

const tangent = (t: number): [number, number] => {
  const a = river(Math.max(0, t - 0.01));
  const b = river(Math.min(1, t + 0.01));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
};

const filaments = (): Seg[] => {
  const segs: Seg[] = [];
  const lines = 24;
  for (let k = 0; k < lines; k++) {
    const u = k / (lines - 1);
    const side = (u - 0.5) * 2;
    const core = Math.abs(side) < 0.5;
    const pts: InkPoint[] = [];
    const steps = 32;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const [x, y] = river(t);
      const [nx, ny] = tangent(t);
      const edge = 1 - Math.sin(t * Math.PI);
      const widen = core ? 0.018 + edge * 0.09 : 0.04 + edge * 0.18;
      const swirl = Math.sin(t * Math.PI * 2.6 + k * 0.55) * (0.01 + edge * 0.035);
      const off = side * widen + swirl;
      pts.push({ x: x + nx * off, y: y + ny * off });
    }
    const radius = core ? 16 : 6;
    const wash = core ? 0.0 : 0.72;
    const speed = core ? 0.28 : 0.86;
    for (let i = 1; i < pts.length; i++) {
      segs.push({
        a: pts[i - 1],
        b: pts[i],
        opts: {
          radius,
          pressure: core ? 0.85 : 0.4,
          load: core ? 0.95 : 0.55,
          speed,
          wash,
        },
      });
    }
  }
  for (let k = 0; k < 22; k++) {
    const u = k / 21;
    const side = (u - 0.5) * 2;
    const pts: InkPoint[] = [];
    for (let s = 0; s <= 26; s++) {
      const t = s / 26;
      const [x, y] = river(t);
      const [nx, ny] = tangent(t);
      const edge = 1 - Math.sin(t * Math.PI);
      const off = side * (0.05 + edge * 0.2) + Math.sin(t * 19.0 + k) * 0.02;
      pts.push({ x: x + nx * off, y: y + ny * off + Math.sin(t * 9.0 + k * 0.4) * edge * 0.03 });
    }
    for (let i = 1; i < pts.length; i++) {
      segs.push({
        a: pts[i - 1],
        b: pts[i],
        opts: { radius: 8, pressure: 0.3, load: 0.42, speed: 0.9, wash: 0.8 },
      });
    }
  }
  for (let k = 0; k < 10; k++) {
    const t0 = 0.08 + (k / 10) * 0.84;
    const [x, y] = river(t0);
    const [nx, ny] = tangent(t0);
    const spin = k % 2 === 0 ? 1 : -1;
    const pts: InkPoint[] = [];
    for (let s = 0; s < 6; s++) {
      const a = s / 5;
      pts.push({
        x: x + nx * (a - 0.5) * 0.05 + ny * Math.sin(a * Math.PI) * 0.03 * spin,
        y: y + ny * (a - 0.5) * 0.05 - nx * Math.sin(a * Math.PI) * 0.03 * spin,
      });
    }
    for (let i = 1; i < pts.length; i++) {
      segs.push({
        a: pts[i - 1],
        b: pts[i],
        opts: { radius: 4, pressure: 0.35, load: 0.4, speed: 0.95, wash: 0.15 },
      });
    }
  }
  return segs;
};

export const playStudioFlow = (stage: InkStageHandle, animate = false) => {
  const segs = filaments();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduced) {
    for (const seg of segs) stage.stroke([seg.a, seg.b], seg.opts);
    if (reduced) stage.dry();
    return () => {};
  }
  const t0 = performance.now();
  const dur = 3200;
  let n = 0;
  let raf = 0;
  const frame = (now: number) => {
    const target = Math.min(segs.length, Math.floor(((now - t0) / dur) * segs.length) + 1);
    while (n < target) {
      const seg = segs[n];
      stage.stroke([seg.a, seg.b], seg.opts);
      n += 1;
    }
    if (n < segs.length) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
};
