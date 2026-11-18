import { defaultInkConfig } from 'react-sumi-ink';

export interface PropDoc {
  name: string;
  type: string;
  default: string;
  description: string;
}

const d = <K extends keyof typeof defaultInkConfig>(k: K) => {
  const v = defaultInkConfig[k];
  if (typeof v === 'object' && v) return JSON.stringify(v);
  return String(v);
};

export const inkPropDocs: PropDoc[] = [
  { name: 'preset', type: 'InkPresetName', default: 'n/a', description: 'Shortcut para `inkPresets` (sumi, wash, calligraphy, smoke, koi, minimal).' },
  { name: 'config', type: 'InkConfig', default: 'defaultInkConfig', description: 'Objeto base; props soltas sobrescrevem.' },
  { name: 'mode', type: `'trail' | 'paint' | 'ambient' | 'static'`, default: 'trail', description: 'Como a entrada gera tinta. `ambient` goteja sozinho. `static` pausa o passo da simulação.' },
  { name: 'quality', type: `'auto' | 'low' | 'medium' | 'high'`, default: 'auto', description: 'Resolução do grid WASM; `auto` reduz se o FPS cair.' },
  { name: 'interactive', type: 'boolean', default: 'true', description: 'Pointer e touch no palco.' },
  { name: 'viscosity', type: 'number', default: d('viscosity'), description: 'Viscosidade do fluido (estável de Navier-Stokes).' },
  { name: 'diffusion', type: 'number', default: d('diffusion'), description: 'Difusão da densidade, incluindo sangramento sumi-e.' },
  { name: 'drying', type: 'number', default: d('drying'), description: 'Secagem lenta e borda mais escura (coffee ring).' },
  { name: 'brushSize', type: 'number', default: d('brushSize'), description: 'Raio do splat em px CSS.' },
  { name: 'inkColor', type: 'InkRgb', default: d('inkColor'), description: 'Pigmento principal.' },
  { name: 'paper', type: `'washi' | 'rice' | 'cloud'`, default: d('paper'), description: 'Tom do papel no shader WebGL2.' },
  { name: 'onError', type: '(err) => void', default: 'n/a', description: 'Sem WebGL2 ou WASM: renderiza filhos e avisa.' },
  { name: 'onFrame', type: '(fps) => void', default: 'n/a', description: 'FPS medio a cada ~500 ms.' },
];

export const inkHandleDocs: PropDoc[] = [
  { name: 'splash(x, y, opts?)', type: 'void', default: 'n/a', description: 'Coordenadas em px na janela; `opts.amount`, `radius`, `color`.' },
  { name: 'stroke(points, opts?)', type: 'void', default: 'n/a', description: 'Pontos normalizados 0..1 ao longo do traco.' },
  { name: 'clear()', type: 'void', default: 'n/a', description: 'Limpa densidade e velocidade.' },
  { name: 'dry()', type: 'void', default: 'n/a', description: 'Forca secagem total.' },
  { name: 'snapshot()', type: 'string | null', default: 'n/a', description: 'PNG data URL do canvas de tinta.' },
];

export const domInkDocs: PropDoc[] = [
  { name: 'data-ink="obstacle"', type: 'HTML attr', default: 'n/a', description: 'Bloqueia fluxo; tinta contorna.' },
  { name: 'data-ink="absorb"', type: 'HTML attr', default: 'n/a', description: 'Absorve e reduz densidade local.' },
  { name: 'data-ink="repel"', type: 'HTML attr', default: 'n/a', description: 'Empurra o campo de velocidade.' },
  { name: 'data-ink="ignore"', type: 'HTML attr', default: 'n/a', description: 'Nao entra na mascara (padrao).' },
  { name: 'data-ink-glyphs', type: 'HTML attr', default: 'n/a', description: 'Obstaculo por forma do glifo (Canvas 2D), combine com data-ink.' },
];