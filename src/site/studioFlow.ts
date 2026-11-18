import type { InkPoint, InkSplashOptions, InkStageHandle } from 'react-sumi-ink';

type Stroke = { pts: InkPoint[]; opts: InkSplashOptions };

const pt = (pairs: number[][]): InkPoint[] => pairs.map(([x, y]) => ({ x, y }));

const mirror = (pairs: number[][]): number[][] => pairs.map(([x, y]) => [1 - x, y + 0.012]);

const studioStrokes = (): Stroke[] => {
  const leftCore = [
    [0.0, 0.4],
    [0.07, 0.33],
    [0.15, 0.31],
    [0.2, 0.4],
    [0.24, 0.52],
    [0.22, 0.66],
    [0.18, 0.79],
    [0.08, 0.84],
    [0.0, 0.74],
  ];
  const leftInner = [
    [0.02, 0.48],
    [0.11, 0.44],
    [0.16, 0.5],
    [0.2, 0.62],
    [0.18, 0.74],
    [0.12, 0.8],
  ];
  const leftWash = [
    [-0.02, 0.36],
    [0.1, 0.28],
    [0.2, 0.34],
    [0.32, 0.5],
    [0.3, 0.7],
    [0.18, 0.88],
    [0.04, 0.9],
  ];
  const leftDry = [
    [0.0, 0.26],
    [0.09, 0.23],
    [0.17, 0.27],
    [0.23, 0.34],
  ];
  const leftLow = [
    [0.16, 0.8],
    [0.28, 0.9],
    [0.4, 0.93],
  ];
  const rightCore = mirror([
    [0.0, 0.46],
    [0.08, 0.36],
    [0.16, 0.34],
    [0.24, 0.44],
    [0.3, 0.58],
    [0.26, 0.72],
    [0.16, 0.82],
    [0.05, 0.78],
  ]);
  const rightInner = mirror([
    [0.02, 0.52],
    [0.12, 0.48],
    [0.2, 0.56],
    [0.24, 0.68],
    [0.16, 0.78],
  ]);
  const rightWash = mirror([
    [0.0, 0.4],
    [0.12, 0.3],
    [0.22, 0.4],
    [0.32, 0.58],
    [0.28, 0.76],
    [0.14, 0.9],
  ]);
  const rightDry = mirror([
    [0.0, 0.28],
    [0.1, 0.24],
    [0.18, 0.3],
    [0.26, 0.4],
  ]);
  const rightLow = mirror([
    [0.14, 0.82],
    [0.26, 0.91],
    [0.38, 0.94],
  ]);

  const leftEdge = [
    [0.0, 0.33],
    [0.1, 0.3],
    [0.18, 0.36],
    [0.22, 0.46],
  ];
  const rightEdge = mirror([
    [0.0, 0.34],
    [0.1, 0.31],
    [0.18, 0.38],
    [0.22, 0.48],
  ]);
  return [
    { pts: pt(leftWash), opts: { radius: 110, pressure: 0.75, load: 0.8, speed: 0.16, wash: 0.96 } },
    { pts: pt(rightWash), opts: { radius: 104, pressure: 0.72, load: 0.78, speed: 0.18, wash: 0.96 } },
    { pts: pt(leftCore), opts: { radius: 64, pressure: 0.96, load: 1, speed: 0.1, wash: 0.04 } },
    { pts: pt(rightCore), opts: { radius: 60, pressure: 0.94, load: 1, speed: 0.12, wash: 0.04 } },
    { pts: pt(leftInner), opts: { radius: 36, pressure: 0.88, load: 0.95, speed: 0.2, wash: 0.05 } },
    { pts: pt(rightInner), opts: { radius: 34, pressure: 0.86, load: 0.92, speed: 0.22, wash: 0.05 } },
    { pts: pt(leftEdge), opts: { radius: 22, pressure: 0.4, load: 0.55, speed: 0.88, wash: 0.02 } },
    { pts: pt(rightEdge), opts: { radius: 20, pressure: 0.38, load: 0.5, speed: 0.9, wash: 0.02 } },
    { pts: pt(leftDry), opts: { radius: 16, pressure: 0.3, load: 0.4, speed: 0.95, wash: 0.0 } },
    { pts: pt(rightDry), opts: { radius: 15, pressure: 0.28, load: 0.38, speed: 0.96, wash: 0.0 } },
    { pts: pt(leftLow), opts: { radius: 48, pressure: 0.6, load: 0.66, speed: 0.34, wash: 0.7 } },
    { pts: pt(rightLow), opts: { radius: 46, pressure: 0.58, load: 0.64, speed: 0.36, wash: 0.7 } },
  ];
};

const segmentsOf = (strokes: Stroke[]) => {
  const segs: { a: InkPoint; b: InkPoint; opts: InkSplashOptions }[] = [];
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.pts.length; i++) {
      const t = i / (stroke.pts.length - 1);
      const load = (stroke.opts.load ?? 1) * (1 - t * 0.28);
      segs.push({ a: stroke.pts[i - 1], b: stroke.pts[i], opts: { ...stroke.opts, load } });
    }
  }
  return segs;
};

export const playStudioFlow = (stage: InkStageHandle, animate = false) => {
  const strokes = studioStrokes();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduced) {
    for (const stroke of strokes) stage.stroke(stroke.pts, stroke.opts);
    if (reduced) stage.dry();
    return () => {};
  }
  const segs = segmentsOf(strokes);
  const t0 = performance.now();
  const dur = 2600;
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
