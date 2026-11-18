/**
 * Optional OffscreenCanvas worker entry. Loaded only when worker mode is enabled.
 */
export const inkWorkerSource = `
import init, { InkSim } from 'sumi-ink-sim';

let sim = null;
let gw = 0;
let gh = 0;
let rgba = null;

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    await init(msg.wasm);
    gw = msg.gw;
    gh = msg.gh;
    sim = new InkSim(gw, gh);
    rgba = new Float32Array(gw * gh * 4);
    self.postMessage({ type: 'ready' });
    return;
  }
  if (!sim) return;
  if (msg.type === 'mask') sim.set_obstacle_mask(msg.mask);
  if (msg.type === 'params') sim.set_params(msg.viscosity, msg.diffusion, msg.drying, msg.vorticity);
  if (msg.type === 'splat') {
    sim.splat(msg.nx, msg.ny, msg.radius, msg.amount, msg.r, msg.g, msg.b, msg.vx, msg.vy);
  }
  if (msg.type === 'clear') sim.clear();
  if (msg.type === 'dry') sim.dry_all();
  if (msg.type === 'step') {
    sim.step(msg.dt);
    sim.copy_density_rgba(rgba);
    self.postMessage({ type: 'frame', rgba }, [rgba.buffer]);
    rgba = new Float32Array(gw * gh * 4);
  }
};
`;