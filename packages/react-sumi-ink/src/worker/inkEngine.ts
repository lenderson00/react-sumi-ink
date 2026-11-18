import init, { InkSim } from 'sumi-ink-sim';

const wasmUrl = new URL('../wasm/pkg/sumi_ink_sim_bg.wasm', import.meta.url).href;

export type EngineDispose = () => void;

export interface InkEngine {
  sim: InkSim;
  rgba: Float32Array;
  gw: number;
  gh: number;
  step: (dt: number) => void;
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
  dispose: EngineDispose;
}

let initPromise: Promise<void> | null = null;

const ensureWasm = async () => {
  if (!initPromise) {
    initPromise = init(wasmUrl);
  }
  await initPromise;
};

export const createInkEngine = async (gw: number, gh: number): Promise<InkEngine> => {
  await ensureWasm();
  const sim = new InkSim(gw, gh);
  const rgba = new Float32Array(gw * gh * 4);
  return {
    sim,
    rgba,
    gw,
    gh,
    step(dt: number) {
      sim.step(dt);
      sim.copy_density_rgba(rgba);
    },
    setMask(mask: Float32Array) {
      sim.set_obstacle_mask(mask);
    },
    splat(nx, ny, radius, amount, r, g, b, vx, vy) {
      sim.splat(nx, ny, radius, amount, r, g, b, vx, vy);
    },
    dispose() {
      sim.free();
    },
  };
};