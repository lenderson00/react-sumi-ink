import type { InkRgb } from './shared';

export interface InkConfig {
  viscosity: number;
  diffusion: number;
  drying: number;
  vorticity: number;
  brushSize: number;
  amount: number;
  inkColor: InkRgb;
  accent: InkRgb | null;
  paper: 'washi' | 'rice' | 'cloud';
}

export const defaultInkConfig: InkConfig = {
  viscosity: 0.00015,
  diffusion: 0.0003,
  drying: 0.12,
  vorticity: 3,
  brushSize: 18,
  amount: 0.85,
  inkColor: { r: 0.02, g: 0.02, b: 0.025 },
  accent: null,
  paper: 'washi',
};

export type InkPresetName = keyof typeof inkPresets;

export const inkPresets = {
  sumi: defaultInkConfig,
  wash: {
    ...defaultInkConfig,
    diffusion: 0.00055,
    drying: 0.08,
    brushSize: 28,
    amount: 0.55,
    inkColor: { r: 0.12, g: 0.14, b: 0.18 },
  },
  calligraphy: {
    ...defaultInkConfig,
    viscosity: 0.00005,
    vorticity: 1.2,
    brushSize: 10,
    amount: 1.1,
    drying: 0.18,
  },
  smoke: {
    ...defaultInkConfig,
    diffusion: 0.0008,
    drying: 0.05,
    brushSize: 36,
    amount: 0.35,
    inkColor: { r: 0.2, g: 0.22, b: 0.25 },
  },
  koi: {
    ...defaultInkConfig,
    accent: { r: 0.85, g: 0.18, b: 0.12 },
    brushSize: 22,
    amount: 0.7,
    inkColor: { r: 0.03, g: 0.04, b: 0.09 },
  },
  minimal: {
    ...defaultInkConfig,
    brushSize: 8,
    amount: 0.4,
    drying: 0.22,
    vorticity: 0.6,
    inkColor: { r: 0.15, g: 0.15, b: 0.17 },
  },
} as const satisfies Record<string, InkConfig>;