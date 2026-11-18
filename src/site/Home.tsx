import { useRef } from 'react';
import { InkStage, type InkStageHandle } from 'react-sumi-ink';
import { Code } from './Code';
import { PresetDemo } from './PresetDemo';
import { href } from './router';
import { playStudioFlow } from './studioFlow';

const FEATURES = [
  {
    title: 'Fluido em WASM',
    body: 'Stable fluids em Rust: advecao, pressao, vorticidade e secagem lenta no papel.',
    icon: 'M4 6h16v12H4zM8 10h8',
  },
  {
    title: 'Sumi-e visivel',
    body: 'Pigmento denso, fibras de washi, granulacao e borda mais escura ao secar.',
    icon: 'M6 18L12 6l6 12H6z',
  },
  {
    title: 'DOM como obstaculo',
    body: 'data-ink e data-ink-glyphs viram mascara no grid. A tinta contorna titulo e cartoes.',
    icon: 'M4 5h16v14H4zM8 13h6',
  },
  {
    title: 'API util',
    body: 'splash, stroke, presets, InkButton e useInk para heros, ripples e transicoes.',
    icon: 'M8 4v16m8-16v16',
  },
  {
    title: 'Worker',
    body: 'Simulacao em Web Worker com fallback na thread principal quando preciso.',
    icon: 'M12 3v18M3 12h18',
  },
  {
    title: 'Leve',
    body: '~6 kB gzip no bundle TS e ~29 kB no wasm, ESM e CJS.',
    icon: 'M7 8l-4 4 4 4m10-8 4 4-4 4',
  },
];

function Seal() {
  return (
    <svg className="seal-svg" viewBox="0 0 64 64" width="44" height="44" aria-hidden>
      <rect x="1.5" y="1.5" width="61" height="61" fill="#f4f0e8" stroke="#c23b2e" strokeWidth="3" />
      <rect x="6" y="6" width="52" height="52" fill="none" stroke="#c23b2e" strokeWidth="1" />
      <path
        d="M16 18h32M16 32h24M20 46h28M32 14v36M22 24c6 4 14 4 20 0M24 40c5-3 12-3 18 1"
        fill="none"
        stroke="#c23b2e"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function Home() {
  const stageRef = useRef<InkStageHandle>(null);
  const played = useRef(false);
  return (
    <>
      <section className="studio">
        <InkStage
          ref={stageRef}
          className="studio-stage"
          preset="sumi"
          mode="paint"
          onReady={(info) => {
            if (played.current || !stageRef.current) return;
            played.current = true;
            const stage = stageRef.current;
            playStudioFlow(stage, false);
            const w = window as Window & {
              __inkReplay?: (animate: boolean) => void;
              __inkClear?: () => void;
            };
            w.__inkClear = () => stage.clear();
            w.__inkReplay = (animate) => playStudioFlow(stage, animate);
          }}
        >
          <div className="studio-ui">
            <h1 className="studio-title" data-ink-glyphs data-ink="obstacle">
              Ink that flows
            </h1>
            <a className="studio-cta" href={href('playground')} data-ink="obstacle">
              Explore collection
              <span aria-hidden> →</span>
            </a>
            <div className="studio-seal" data-ink="obstacle">
              <Seal />
            </div>
          </div>
          <div className="studio-corners">
            <span data-ink-glyphs data-ink="obstacle">
              Handcrafted in Japan
            </span>
            <span className="studio-scroll">Scroll to discover ↓</span>
          </div>
        </InkStage>
      </section>

      <section className="band">
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d={f.icon} />
              </svg>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="band split">
        <div>
          <span className="eyebrow">Inicio rapido</span>
          <h2>Envolva o conteudo</h2>
          <p>
            Coloque o tree dentro de <code>InkStage</code> e marque obstaculos. O wasm vem no pacote.
          </p>
          <a className="link" href={href('docs')}>
            Ver docs
          </a>
        </div>
        <Code
          code={`import { InkStage } from 'react-sumi-ink';

export default function App() {
  return (
    <InkStage preset="sumi" mode="paint" style={{ height: 520 }}>
      <h1 data-ink-glyphs data-ink="obstacle">Titulo</h1>
    </InkStage>
  );
}`}
        />
      </section>

      <section className="band">
        <div className="band-head">
          <span className="eyebrow">Presets</span>
          <h2>Seis tintas</h2>
          <p>De caligrafia densa a fumaca suave no modo escuro.</p>
        </div>
        <PresetDemo />
      </section>
    </>
  );
}