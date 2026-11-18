import { InkStage } from 'react-sumi-ink';
import { useViewportStage } from '../lib/useViewportStage';
import { Scene } from '../playground/Scene';
import { Code, InstallPill } from './Code';
import { PresetDemo } from './PresetDemo';
import { href } from './router';

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

export function Home() {
  const { scale } = useViewportStage();
  return (
    <>
      <section className="hero ink-hero">
        <div className="hero-copy">
          <span className="eyebrow">React · Rust WASM · WebGL2</span>
          <h1>
            Tinta sumi-e
            <br />
            ao redor do <em>DOM</em>.
          </h1>
          <p className="lead">
            Pinte no papel washi. O fluido contorna titulos, botoes e cartoes marcados com data-ink, com presets prontos
            para produto.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href={href('docs', 'quick-start')}>
              Comecar
            </a>
            <a className="btn" href={href('playground')}>
              Playground
            </a>
          </div>
          <InstallPill />
        </div>

        <InkStage className="hero-stage" preset="sumi" mode="paint" style={{ minHeight: 460 }}>
          <div className="hero-ink-content">
            <h2 className="hero-serif" data-ink-glyphs data-ink="obstacle">
              墨
            </h2>
            <p className="hero-cta" data-ink="obstacle">
              Passe o mouse ou o dedo no papel
            </p>
            <a className="hero-cta-btn" href={href('playground')} data-ink="repel">
              Abrir demo
            </a>
          </div>
          <Scene heading={false} layoutScale={scale} />
        </InkStage>
        <p className="hero-hint">Pinte no playground. Troque sumi, koi e smoke no painel.</p>
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