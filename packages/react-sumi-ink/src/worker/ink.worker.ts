/// <reference lib="webworker" />
import init, { InkSim } from 'sumi-ink-sim';
import { InkRenderer, type PaperName } from '../webgl/renderer';

export type WorkerRequest =
  | {
      type: 'init';
      wasm: string;
      vw: number;
      vh: number;
      scale: number;
      canvas: OffscreenCanvas;
      viewW: number;
      viewH: number;
      dpr: number;
      paper: PaperName;
    }
  | { type: 'params'; viscosity: number; diffusion: number; drying: number; vorticity: number }
  | { type: 'mask'; mask: Float32Array }
  | { type: 'resize'; viewW: number; viewH: number; dpr: number }
  | { type: 'paper'; paper: PaperName }
  | { type: 'mode'; mode: string }
  | {
      type: 'stroke';
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      radius: number;
      pressure: number;
      load: number;
      speed: number;
      wash: number;
    }
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
  | { type: 'clear' }
  | { type: 'dry' }
  | { type: 'snapshot' };

let sim: InkSim | null = null;
let renderer: InkRenderer | null = null;
let surface: OffscreenCanvas | null = null;
let rgba: Float32Array | null = null;
let paper: PaperName = 'washi';
let mode = 'paint';
let raf = 0;
let last = 0;
let frames = 0;
let fpsStamp = 0;
let mask: Float32Array | null = null;
let maskDirty = false;

const drawFrame = (now: number) => {
  if (!sim || !renderer || !rgba) return;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  if (mode !== 'static') sim.step(dt);
  sim.copy_density_rgba(rgba);
  renderer.uploadRGBA(rgba, sim.width(), sim.height());
  if (maskDirty && mask) {
    renderer.uploadMask(mask, sim.width(), sim.height());
    maskDirty = false;
  }
  renderer.draw(paper, 0.7, now * 0.001);
  frames += 1;
  if (now - fpsStamp > 500) {
    const fps = (frames * 1000) / (now - fpsStamp);
    self.postMessage({ type: 'fps', fps });
    frames = 0;
    fpsStamp = now;
  }
  raf = requestAnimationFrame(drawFrame);
};

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      await init(msg.wasm);
      surface = msg.canvas;
      sim = new InkSim(msg.vw, msg.vh, msg.scale);
      rgba = new Float32Array(sim.width() * sim.height() * 4);
      renderer = new InkRenderer(msg.canvas);
      renderer.resize(msg.viewW, msg.viewH, msg.dpr);
      paper = msg.paper;
      last = 0;
      fpsStamp = performance.now();
      raf = requestAnimationFrame(drawFrame);
      self.postMessage({ type: 'ready', usedWorker: true, gw: sim.width(), gh: sim.height() });
      return;
    }
    if (!sim) return;
    if (msg.type === 'params') sim.set_params(msg.viscosity, msg.diffusion, msg.drying, msg.vorticity);
    if (msg.type === 'mask') {
      mask = new Float32Array(msg.mask);
      sim.set_obstacle_mask(mask);
      maskDirty = true;
    }
    if (msg.type === 'resize' && renderer) renderer.resize(msg.viewW, msg.viewH, msg.dpr);
    if (msg.type === 'paper') paper = msg.paper;
    if (msg.type === 'mode') mode = msg.mode;
    if (msg.type === 'clear') sim.clear();
    if (msg.type === 'dry') sim.dry_all();
    if (msg.type === 'splat') {
      sim.splat(msg.nx, msg.ny, msg.radius, msg.amount, msg.r, msg.g, msg.b, msg.vx, msg.vy);
    }
    if (msg.type === 'stroke') {
      sim.stroke_segment(msg.x0, msg.y0, msg.x1, msg.y1, msg.radius, msg.pressure, msg.load, msg.speed, msg.wash);
    }
    if (msg.type === 'snapshot' && surface && 'convertToBlob' in surface) {
      const blob = await surface.convertToBlob({ type: 'image/png' });
      const buffer = await blob.arrayBuffer();
      self.postMessage({ type: 'png', buffer }, [buffer]);
    }
  } catch (e) {
    self.postMessage({ type: 'error', message: e instanceof Error ? e.message : 'worker' });
  }
};

