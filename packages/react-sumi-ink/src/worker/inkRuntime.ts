import init, { InkSim } from 'sumi-ink-sim';
import wasmUrl from 'virtual:sumi-ink-wasm-url';
import type { WorkerRequest } from './ink.worker';

export interface InkSimBridge {
  gw: number;
  gh: number;
  usedWorker: boolean;
  setParams: (viscosity: number, diffusion: number, drying: number, vorticity: number) => void;
  setMask: (mask: Float32Array) => void;
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
  step: (dt: number) => Promise<Float32Array>;
  clear: () => void;
  dryAll: () => void;
  dispose: () => void;
}

export const createInkRuntime = async (gw: number, gh: number, preferWorker = true): Promise<InkSimBridge> => {
  const canWorker = preferWorker && typeof Worker !== 'undefined';
  if (canWorker) {
    try {
      const worker = new Worker(new URL('./ink.worker.ts', import.meta.url), { type: 'module' });
      const bridge = await new Promise<InkSimBridge>((resolve, reject) => {
        let rgba = new Float32Array(gw * gh * 4);
        const timeout = setTimeout(() => reject(new Error('worker timeout')), 8000);
        worker.onmessage = (ev: MessageEvent) => {
          const data = ev.data as {
            type: string;
            usedWorker?: boolean;
            rgba?: Float32Array;
            gw?: number;
            gh?: number;
            message?: string;
          };
          if (data.type === 'ready') {
            clearTimeout(timeout);
            resolve({
              gw,
              gh,
              usedWorker: true,
              setParams(v, d, dr, vo) {
                worker.postMessage({ type: 'params', viscosity: v, diffusion: d, drying: dr, vorticity: vo } satisfies WorkerRequest);
              },
              setMask(mask) {
                worker.postMessage({ type: 'mask', mask: new Float32Array(mask) } satisfies WorkerRequest);
              },
              splat(nx, ny, radius, amount, r, g, b, vx, vy) {
                worker.postMessage({
                  type: 'splat',
                  nx,
                  ny,
                  radius,
                  amount,
                  r,
                  g,
                  b,
                  vx,
                  vy,
                } satisfies WorkerRequest);
              },
              step(dt) {
                return new Promise((res) => {
                  const onFrame = (e: MessageEvent) => {
                    if (e.data?.type === 'frame') {
                      worker.removeEventListener('message', onFrame);
                      rgba = new Float32Array(e.data.rgba as Float32Array);
                      res(rgba);
                    }
                  };
                  worker.addEventListener('message', onFrame);
                  worker.postMessage({ type: 'step', dt } satisfies WorkerRequest);
                });
              },
              clear() {
                worker.postMessage({ type: 'clear' } satisfies WorkerRequest);
              },
              dryAll() {
                worker.postMessage({ type: 'dry' } satisfies WorkerRequest);
              },
              dispose() {
                worker.terminate();
              },
            });
          }
          if (data.type === 'error') reject(new Error(data.message || 'worker error'));
        };
        worker.postMessage({ type: 'init', wasm: wasmUrl, gw, gh } satisfies WorkerRequest);
      });
      return bridge;
    } catch {
      /* fall through main thread */
    }
  }

  await init(wasmUrl);
  const sim = new InkSim(gw, gh);
  const rgba = new Float32Array(gw * gh * 4);
  return {
    gw,
    gh,
    usedWorker: false,
    setParams(v, d, dr, vo) {
      sim.set_params(v, d, dr, vo);
    },
    setMask(mask) {
      sim.set_obstacle_mask(mask);
    },
    splat(nx, ny, radius, amount, r, g, b, vx, vy) {
      sim.splat(nx, ny, radius, amount, r, g, b, vx, vy);
    },
    async step(dt) {
      sim.step(dt);
      sim.copy_density_rgba(rgba);
      return rgba;
    },
    clear() {
      sim.clear();
    },
    dryAll() {
      sim.dry_all();
    },
    dispose() {
      sim.free();
    },
  };
};