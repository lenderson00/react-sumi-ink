/* tslint:disable */
/* eslint-disable */

/**
 * Dual-resolution sumi sim.
 * Velocity lives on a coarse grid. Pigment (crisp mark, flowing ink, wash, wetness)
 * lives on a 2x to 4x grid and is advected with MacCormack so edges stay sharp.
 */
export class InkSim {
    free(): void;
    [Symbol.dispose](): void;
    clear(): void;
    copy_density_rgba(out: Float32Array): void;
    dry_all(): void;
    height(): number;
    constructor(vw: number, vh: number, scale: number);
    /**
     * Packed mask, length `width * height * 3`: obstacle, absorb, repel.
     */
    set_obstacle_mask(data: Float32Array | number[]): void;
    set_params(viscosity: number, diffusion: number, drying: number, vorticity: number): void;
    /**
     * Legacy round deposit. Radius is in pigment pixels. Prefer `stroke_segment`.
     */
    splat(x: number, y: number, radius: number, amount: number, _r: number, _g: number, _b: number, vx: number, vy: number): void;
    step(dt: number): void;
    /**
     * One polyline segment. Coordinates are normalized 0..1.
     * `radius` is pigment pixels. `speed` and `wash_bias` are 0..1.
     */
    stroke_segment(x0: number, y0: number, x1: number, y1: number, radius: number, pressure: number, load: number, speed: number, wash_bias: number): void;
    width(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_inksim_free: (a: number, b: number) => void;
    readonly inksim_clear: (a: number) => void;
    readonly inksim_copy_density_rgba: (a: number, b: number, c: number, d: any) => void;
    readonly inksim_dry_all: (a: number) => void;
    readonly inksim_height: (a: number) => number;
    readonly inksim_new: (a: number, b: number, c: number) => number;
    readonly inksim_set_obstacle_mask: (a: number, b: number, c: number) => void;
    readonly inksim_set_params: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly inksim_splat: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly inksim_step: (a: number, b: number) => void;
    readonly inksim_stroke_segment: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly inksim_width: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
