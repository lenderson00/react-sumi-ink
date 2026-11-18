/* tslint:disable */
/* eslint-disable */

export class InkSim {
    free(): void;
    [Symbol.dispose](): void;
    clear(): void;
    copy_density_rgba(out: Float32Array): void;
    density_len(): number;
    density_ptr(): number;
    dry_all(): void;
    dry_ptr(): number;
    height(): number;
    constructor(width: number, height: number);
    pigment_ptr(): number;
    set_obstacle_mask(data: Float32Array | number[]): void;
    set_params(viscosity: number, diffusion: number, drying: number, vorticity: number): void;
    splat(x: number, y: number, radius: number, amount: number, r: number, g: number, b: number, vx: number, vy: number): void;
    step(dt: number): void;
    width(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_inksim_free: (a: number, b: number) => void;
    readonly inksim_clear: (a: number) => void;
    readonly inksim_copy_density_rgba: (a: number, b: number, c: number, d: any) => void;
    readonly inksim_density_len: (a: number) => number;
    readonly inksim_density_ptr: (a: number) => number;
    readonly inksim_dry_all: (a: number) => void;
    readonly inksim_dry_ptr: (a: number) => number;
    readonly inksim_height: (a: number) => number;
    readonly inksim_new: (a: number, b: number) => number;
    readonly inksim_pigment_ptr: (a: number) => number;
    readonly inksim_set_obstacle_mask: (a: number, b: number, c: number) => void;
    readonly inksim_set_params: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly inksim_splat: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly inksim_step: (a: number, b: number) => void;
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
