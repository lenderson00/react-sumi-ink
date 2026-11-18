export type InkMode = 'trail' | 'paint' | 'ambient' | 'static';
export type InkQuality = 'auto' | 'low' | 'medium' | 'high';
export type InkElementRole = 'obstacle' | 'absorb' | 'repel' | 'ignore';

export interface InkRgb {
  r: number;
  g: number;
  b: number;
}

export interface InkSplashOptions {
  amount?: number;
  radius?: number;
  color?: InkRgb;
  vx?: number;
  vy?: number;
}

export interface InkPoint {
  x: number;
  y: number;
}

export interface InkRuntimeError {
  code: 'no-webgl2' | 'no-wasm' | 'worker-failed';
  message: string;
}

export const qualityToGrid = (
  quality: InkQuality,
  width: number,
  height: number,
  fps?: number,
): { w: number; h: number } => {
  const short = Math.min(width, height);
  let scale = 0.35;
  if (quality === 'low') scale = 0.22;
  else if (quality === 'medium') scale = 0.3;
  else if (quality === 'high') scale = 0.42;
  else if (fps !== undefined && fps < 50) scale = Math.max(0.18, scale - 0.08);
  const base = Math.max(64, Math.round(short * scale));
  return {
    w: Math.round((width / short) * base),
    h: Math.round((height / short) * base),
  };
};

export const supportsInkRuntime = (): { webgl2: boolean; wasm: boolean; worker: boolean } => {
  if (typeof window === 'undefined') {
    return { webgl2: false, wasm: false, worker: false };
  }
  const c = document.createElement('canvas');
  const webgl2 = !!c.getContext('webgl2');
  const wasm = typeof WebAssembly === 'object';
  const worker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  return { webgl2, wasm, worker };
};

export const parseInkRole = (el: Element): InkElementRole => {
  const raw = (el.getAttribute('data-ink') || 'ignore').toLowerCase();
  if (raw === 'obstacle' || raw === 'absorb' || raw === 'repel') return raw;
  return 'ignore';
};