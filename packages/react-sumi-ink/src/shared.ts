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
  pressure?: number;
  load?: number;
  speed?: number;
  wash?: number;
}

export interface InkPoint {
  x: number;
  y: number;
}

export interface InkRuntimeError {
  code: 'no-webgl2' | 'no-wasm' | 'worker-failed';
  message: string;
}

export interface InkGrid {
  vw: number;
  vh: number;
  scale: number;
}

export const qualityToGrid = (
  quality: InkQuality,
  width: number,
  height: number,
  fps?: number,
): InkGrid => {
  const mobile = width < 760;
  let vw = 160;
  let scale = 4;
  if (quality === 'low' || (quality === 'auto' && mobile)) {
    vw = 96;
    scale = 2;
  } else if (quality === 'medium') {
    vw = 128;
    scale = 3;
  } else if (quality === 'high') {
    vw = 176;
    scale = 4;
  }
  if (fps !== undefined && fps < 48) {
    vw = Math.max(80, Math.round(vw * 0.75));
    scale = Math.max(2, scale - 1);
  }
  const aspect = width / Math.max(1, height);
  let vh = Math.round(vw / Math.max(0.42, Math.min(aspect, 2.4)));
  vh = Math.max(36, Math.min(220, vh));
  if (vw * vh * scale * scale > 300000) scale = Math.max(2, scale - 1);
  return { vw, vh, scale };
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