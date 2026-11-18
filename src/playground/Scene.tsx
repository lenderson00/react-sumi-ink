import { InkButton } from 'react-sumi-ink';

type SceneProps = {
  heading?: boolean;
  layoutScale?: number;
};

export function Scene({ heading = true, layoutScale = 1 }: SceneProps) {
  return (
    <div className="scene ink-demo-scene" style={{ ['--scene-scale' as string]: layoutScale }}>
      <div className="scene-stage">
        {heading && (
          <header className="scene-head">
            <p className="eyebrow">data-ink no palco</p>
            <h1 className="scene-title" data-ink-glyphs data-ink="obstacle">
              Sumi
            </h1>
            <p className="scene-lede">A tinta contorna tipo e cartoes. Pinte no papel ao redor.</p>
          </header>
        )}
        <div className="scene-cards">
          <div className="scene-card" data-ink="obstacle">
            <span className="scene-kicker">Obstacle</span>
            <strong>Cartao</strong>
            <p>Fluxo contorna e empilha na borda.</p>
          </div>
          <div className="scene-card absorb" data-ink="absorb">
            <span className="scene-kicker">Absorb</span>
            <strong>Papel</strong>
            <p>Manchar e secar rapido.</p>
          </div>
          <div className="scene-card repel" data-ink="repel">
            <span className="scene-kicker">Repel</span>
            <strong>Pedra</strong>
            <p>Repulsao do fluxo.</p>
          </div>
        </div>
        <InkButton className="scene-ink-btn" splashAmount={1.45}>
          Splash
        </InkButton>
      </div>
    </div>
  );
}