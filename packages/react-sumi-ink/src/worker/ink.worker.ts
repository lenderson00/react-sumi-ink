/// <reference lib="webworker" />
import init, { InkSim } from 'sumi-ink-sim';

export type WorkerRequest =
  | { type: 'init'; wasm: string; gw: number; gh: number }
  | { type: 'params'; viscosity: number; diffusion: number; drying: number; vorticity: number }
  | { type: 'mask'; mask: Float32Array }
  | {
      type: 'splat';
      nx: number;
      ny: number;
      radius: number;
      amount: number;
      r: number;
      g: number;
      b: number;
      vx: number;
      vy: number;
    }
  | { type: 'step'; dt: number }
  | { type: 'clear' }
  | { type: 'dry' };

let sim: InkSim | null = null;
let gw = 0;
let gh = 0;
let rgba: Float32Array | null = null;

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      await init(msg.wasm);
      gw = msg.gw;
      gh = msg.gh;
      sim = new InkSim(gw, gh);
      rgba = new Float32Array(gw * gh * 4);
      self.postMessage({ type: 'ready', usedWorker: true });
      return;
    }
    if (!sim || !rgba) return;
    if (msg.type === 'params') sim.set_params(msg.viscosity, msg.diffusion, msg.drying, msg.vorticity);
    if (msg.type === 'mask') sim.set_obstacle_mask(msg.mask);
    if (msg.type === 'clear') sim.clear();
    if (msg.type === 'dry') sim.dry_all();
    if (msg.type === 'splat') {
      sim.splat(msg.nx, msg.ny, msg.radius, msg.amount, msg.r, msg.g, msg.b, msg.vx, msg.vy);
    }
    if (msg.type === 'step') {
      sim.step(msg.dt);
      sim.copy_density_rgba(rgba);
      self.postMessage({ type: 'frame', rgba, gw, gh }, [rgba.buffer]);
      rgba = new Float32Array(gw * gh * 4);
    }
  } catch (e) {
    self.postMessage({ type: 'error', message: e instanceof Error ? e.message : 'worker' });
  }
};