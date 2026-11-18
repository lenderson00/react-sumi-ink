import init, { InkSim } from 'sumi-ink-sim';
import wasmUrl from 'virtual:sumi-ink-wasm-url';
import type { PaperName } from '../webgl/renderer';
import { InkRenderer } from '../webgl/renderer';
import type { WorkerRequest } from './ink.worker';

export interface InkSimBridge {
  gw: number;
  gh: number;
  usedWorker: boolean;
  setParams: (viscosity: number, diffusion: number, drying: number, vorticity: number) => void;
  setMask: (mask: Float32Array) => void;
  stroke: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
    pressure: number,
    load: number,
    speed: number,
    wash: number,
  ) => void;
  splat: (
    nx: number,
    ny: number,
    radius: number,
    amount: number,
    r: number,
    g: number,
    b: number,
    vx: number,
    vy: number,
  ) => void;
  resize: (viewW: number, viewH: number, dpr: number) => void;
  setPaper: (paper: PaperName) => void;
  setMode: (mode: string) => void;
  clear: () => void;
  dryAll: () => void;
  snapshot: () => Promise<string | null>;
  onFps: ((fps: number) => void) | null;
  dispose: () => void;
}

export interface RuntimeOptions {
  vw: number;
  vh: number;
  scale: number;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  viewW: number;
  viewH: number;
  dpr: number;
  paper: PaperName;
}

export const createInkRuntime = async (opts: RuntimeOptions): Promise<InkSimBridge> => {
  const surface = opts.canvas;
  if (surface instanceof OffscreenCanvas && typeof Worker !== 'undefined') {
    const worker = new Worker(new URL('./ink.worker.ts', import.meta.url), { type: 'module' });
    const bridge = await new Promise<InkSimBridge>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('worker timeout')), 8000);
      let bridgeRef: InkSimBridge | null = null;
      worker.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { type: string; gw?: number; gh?: number; fps?: number; message?: string; buffer?: ArrayBuffer };
        if (data.type === 'ready' && data.gw && data.gh) {
          clearTimeout(timeout);
          const ready: InkSimBridge = {
            gw: data.gw,
            gh: data.gh,
            usedWorker: true,
            onFps: null,
            setParams(v, d, dr, vo) {
              worker.postMessage({ type: 'params', viscosity: v, diffusion: d, drying: dr, vorticity: vo } satisfies WorkerRequest);
            },
            setMask(mask) {
              const copy = new Float32Array(mask);
              worker.postMessage({ type: 'mask', mask: copy } satisfies WorkerRequest, [copy.buffer]);
            },
            stroke(x0, y0, x1, y1, radius, pressure, load, speed, wash) {
              worker.postMessage({
                type: 'stroke',
                x0,
                y0,
                x1,
                y1,
                radius,
                pressure,
                load,
                speed,
                wash,
              } satisfies WorkerRequest);
            },
            splat(nx, ny, radius, amount, r, g, b, vx, vy) {
              worker.postMessage({ type: 'splat', nx, ny, radius, amount, r, g, b, vx, vy } satisfies WorkerRequest);
            },
            resize(viewW, viewH, dpr) {
              worker.postMessage({ type: 'resize', viewW, viewH, dpr } satisfies WorkerRequest);
            },
            setPaper(paper) {
              worker.postMessage({ type: 'paper', paper } satisfies WorkerRequest);
            },
            setMode(mode) {
              worker.postMessage({ type: 'mode', mode } satisfies WorkerRequest);
            },
            clear() {
              worker.postMessage({ type: 'clear' } satisfies WorkerRequest);
            },
            dryAll() {
              worker.postMessage({ type: 'dry' } satisfies WorkerRequest);
            },
            snapshot() {
              return new Promise((res) => {
                const onPng = (e: MessageEvent) => {
                  if (e.data?.type !== 'png') return;
                  worker.removeEventListener('message', onPng);
                  const buffer = e.data.buffer as ArrayBuffer | null;
                  if (!buffer) {
                    res(null);
                    return;
                  }
                  const blob = new Blob([buffer], { type: 'image/png' });
                  const reader = new FileReader();
                  reader.onload = () => res(typeof reader.result === 'string' ? reader.result : null);
                  reader.onerror = () => res(null);
                  reader.readAsDataURL(blob);
                };
                worker.addEventListener('message', onPng);
                worker.postMessage({ type: 'snapshot' } satisfies WorkerRequest);
              });
            },
            dispose() {
              worker.terminate();
            },
          };
          bridgeRef = ready;
          resolve(ready);
        }
        if (data.type === 'fps' && bridgeRef?.onFps && typeof data.fps === 'number') bridgeRef.onFps(data.fps);
        if (data.type === 'log') console.info(String((data as { message?: string }).message || ''));
        if (data.type === 'error') reject(new Error(data.message || 'worker error'));
      };
      worker.onerror = () => reject(new Error('worker failed'));
      worker.postMessage(
        {
          type: 'init',
          wasm: wasmUrl,
          vw: opts.vw,
          vh: opts.vh,
          scale: opts.scale,
          canvas: surface,
          viewW: opts.viewW,
          viewH: opts.viewH,
          dpr: opts.dpr,
          paper: opts.paper,
        } satisfies WorkerRequest,
        [surface],
      );
    });
    return bridge;
  }

  if (!(surface instanceof HTMLCanvasElement)) {
    throw new Error('main-thread runtime needs an HTML canvas');
  }
  await init(wasmUrl);
  const sim = new InkSim(opts.vw, opts.vh, opts.scale);
  const renderer = new InkRenderer(surface);
  renderer.resize(opts.viewW, opts.viewH, opts.dpr);
  const gw = sim.width();
  const gh = sim.height();
  const rgba = new Float32Array(gw * gh * 4);
  let paper = opts.paper;
  let mode = 'paint';
  let raf = 0;
  let last = 0;
  let frames = 0;
  let fpsStamp = performance.now();
  let alive = true;
  const bridge: InkSimBridge = {
    gw,
    gh,
    usedWorker: false,
    onFps: null,
    setParams(v, d, dr, vo) {
      sim.set_params(v, d, dr, vo);
    },
    setMask(mask) {
      sim.set_obstacle_mask(mask);
      renderer.uploadMask(mask, gw, gh);
    },
    stroke(x0, y0, x1, y1, radius, pressure, load, speed, wash) {
      sim.stroke_segment(x0, y0, x1, y1, radius, pressure, load, speed, wash);
    },
    splat(nx, ny, radius, amount, r, g, b, vx, vy) {
      sim.splat(nx, ny, radius, amount, r, g, b, vx, vy);
    },
    resize(viewW, viewH, dpr) {
      renderer.resize(viewW, viewH, dpr);
    },
    setPaper(next) {
      paper = next;
    },
    setMode(next) {
      mode = next;
    },
    clear() {
      sim.clear();
    },
    dryAll() {
      sim.dry_all();
    },
    async snapshot() {
      return renderer.snapshot();
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      sim.free();
    },
  };
  const tick = (now: number) => {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (mode !== 'static') sim.step(dt);
    sim.copy_density_rgba(rgba);
    renderer.uploadRGBA(rgba, gw, gh);
    renderer.draw(paper, 0.7, now * 0.001);
    frames += 1;
    if (now - fpsStamp > 500) {
      bridge.onFps?.((frames * 1000) / (now - fpsStamp));
      frames = 0;
      fpsStamp = now;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return bridge;
};
