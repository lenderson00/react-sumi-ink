declare module 'sumi-ink-sim' {
  export default function init(module?: string | URL | Request | BufferSource): Promise<void>;
  export class InkSim {
    constructor(width: number, height: number);
    free(): void;
    width(): number;
    height(): number;
    set_params(viscosity: number, diffusion: number, drying: number, vorticity: number): void;
    set_obstacle_mask(data: Float32Array | number[]): void;
    splat(
      x: number,
      y: number,
      radius: number,
      amount: number,
      r: number,
      g: number,
      b: number,
      vx: number,
      vy: number,
    ): void;
    step(dt: number): void;
    clear(): void;
    dry_all(): void;
    copy_density_rgba(out: Float32Array): void;
  }
}