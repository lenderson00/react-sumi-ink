import { InkStage } from 'react-sumi-ink';
import { useViewportStage } from '../lib/useViewportStage';
import { Scene } from '../playground/Scene';
import { Code, InstallPill } from './Code';
import { PresetDemo } from './PresetDemo';
import { href } from './router';

const FEATURES = [
  {
    title: 'Fluido de verdade',
    body: 'Advecao, difusao, projecao de pressao e vorticidade no WASM. Nao e apenas um filtro de manchas.',
    icon: 'M4 12h16M4 6h10M4 18h8',
  },
  {
    title: 'Sumi-e no papel',
    body: 'Sangramento ao longo de fibras, granulacao no shader, secagem lenta e tracos secos em alta velocidade.',
    icon: 'M6 4h12v16H6z',
  },
  {
    title: 'Ciente do DOM',
    body: 'data-ink em filhos vira obstaculos, absorcao ou repulsao no grid, via ResizeObserver e MutationObserver.',
    icon: 'M4 5h16v14H4z',
  },
  {
    title: 'Util no produto',
    body: 'Hero, trilhas no hover, splash em botao, loading e transicao de pagina com a API imperativa.',
    icon: 'M8 4v16m8-16v16',
  },
  {
    title: 'Acessivel',
    body: 'Camada decorativa com aria-hidden. Conteudo segue clicavel. prefers-reduced-motion vira static.',
    icon: 'M12 4v16M4 12h16',
  },
  {
    title: 'Leve',
    body: 'TypeScript, ESM e CJS, WASM empacotado para Vite e Next.js sem config extra.',
    icon: 'M7 8l-4 4 4 4m10-8 4 4-4 4',
  },
];

export function Home() {
  const { scale } = useViewportStage();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">React · Rust WASM · WebGL2</span>
          <h1>
            Tinta sumi-e
            <br />
            que <em>contorna</em> o DOM.
          </h1>
          <p className="lead">
            Pinte com o dedo ou o mouse. A simulacao flui em volta de texto, botoes e cartoes, com pigmento preto e
            acentos opcionais.
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
        <InkStage className="hero-stage" preset="sumi" mode="paint" style={{ minHeight: 420 }}>
          <Scene layoutScale={scale} />
        </InkStage>
      </section>
      <section className="features">
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d={f.icon} fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="quick-start" id="quick-start">
        <h2>Uso rapido</h2>
        <Code
          code={`import { InkStage } from 'react-sumi-ink';

<InkStage preset="sumi" mode="paint" style={{ height: 480 }}>
  <h1 data-ink="obstacle">Titulo</h1>
</InkStage>`}
        />
      </section>
      <PresetDemo />
    </>
  );
}