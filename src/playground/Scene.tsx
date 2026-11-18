import type { PointerEvent as ReactPointerEvent } from 'react';
import { InkButton } from 'react-sumi-ink';

export interface StickerState {
  id: string;
  x: number;
  y: number;
  rot: number;
  z: number;
}

export const initialStickers: StickerState[] = [
  { id: 'seal', x: -120, y: -60, rot: -8, z: 2 },
  { id: 'card', x: 140, y: 40, rot: 6, z: 3 },
  { id: 'note', x: -40, y: 120, rot: 2, z: 1 },
];

type SceneProps = {
  heading?: boolean;
  stickers?: StickerState[];
  draggingId?: string | null;
  onStickerPointerDown?: (id: string, e: ReactPointerEvent) => void;
  layoutScale?: number;
};

export function Scene({ heading = true, layoutScale = 1 }: SceneProps) {
  return (
    <div className="ink-scene" style={{ ['--scene-scale' as string]: layoutScale }}>
      {heading && (
        <header className="scene-heading">
          <h2 data-ink="obstacle">Tinta que contorna o DOM</h2>
          <p>Passe o dedo ou o mouse. Obstáculos usam <code>data-ink</code>.</p>
        </header>
      )}
      <div className="scene-grid">
        <div className="scene-card" data-ink="obstacle">
          <span className="scene-kicker">Obstacle</span>
          <strong>Cartão</strong>
          <p>A tinta contorna e acumula na borda.</p>
        </div>
        <div className="scene-card absorb" data-ink="absorb">
          <span className="scene-kicker">Absorb</span>
          <strong>Papel absorvente</strong>
          <p>O preto mancha e some mais rápido.</p>
        </div>
        <div className="scene-card repel" data-ink="repel">
          <span className="scene-kicker">Repel</span>
          <strong>Pedra</strong>
          <p>Empurra o fluxo para fora.</p>
        </div>
        <InkButton className="scene-ink-btn" splashAmount={1.3}>
          Splash
        </InkButton>
      </div>
    </div>
  );
}