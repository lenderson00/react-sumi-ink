import { useEffect, useState } from 'react';
import { Code } from './Code';
import { PresetDemo } from './PresetDemo';
import { domInkDocs, inkHandleDocs, inkPropDocs, type PropDoc } from './docsData';

const SECTIONS: { id: string; title: string }[] = [
  { id: 'intro', title: 'Introducao' },
  { id: 'install', title: 'Instalacao' },
  { id: 'quick-start', title: 'Inicio rapido' },
  { id: 'dom-ink', title: 'data-ink' },
  { id: 'props', title: 'Props' },
  { id: 'handle', title: 'Ref imperativa' },
  { id: 'wasm', title: 'WASM e worker' },
  { id: 'nextjs', title: 'Next.js' },
  { id: 'a11y', title: 'Acessibilidade' },
  { id: 'perf', title: 'Performance' },
];

function PropTable({ rows }: { rows: PropDoc[] }) {
  return (
    <table className="prop-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Tipo</th>
          <th>Padrao</th>
          <th>Descricao</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>
              <code>{r.name}</code>
            </td>
            <td>
              <code>{r.type}</code>
            </td>
            <td>{r.default}</td>
            <td>{r.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

export function Docs() {
  const active = useActiveSection();
  return (
    <div className="docs-layout">
      <nav className="docs-toc" aria-label="Sumario">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#/docs#${s.id}`} className={active === s.id ? 'on' : ''}>
            {s.title}
          </a>
        ))}
      </nav>
      <article className="docs-article prose">
        <section id="intro">
          <h1>react-sumi-ink</h1>
          <p>
            Biblioteca React com simulacao 2D em Rust compilado para WebAssembly e render em WebGL2. A tinta reage ao
            layout: elementos com <code>data-ink</code> entram na mascara de obstaculos.
          </p>
        </section>
        <section id="install">
          <h2>Instalacao</h2>
          <Code code="npm i react-sumi-ink" />
          <p>Peer: React 18 ou 19. O pacote inclui o binario <code>.wasm</code>.</p>
        </section>
        <section id="quick-start">
          <h2>Inicio rapido</h2>
          <Code
            code={`import { InkStage, useInk } from 'react-sumi-ink';

export function Hero() {
  return (
    <InkStage preset="sumi" mode="trail" style={{ height: 520 }}>
      <button data-ink="repel">Repel</button>
    </InkStage>
  );
}`}
          />
        </section>
        <section id="dom-ink">
          <h2>Atributos data-ink</h2>
          <PropTable rows={domInkDocs} />
        </section>
        <section id="props">
          <h2>Props do InkStage</h2>
          <PropTable rows={inkPropDocs} />
        </section>
        <section id="handle">
          <h2>API imperativa e useInk</h2>
          <PropTable rows={inkHandleDocs} />
        </section>
        <section id="wasm">
          <h2>WASM e worker</h2>
          <p>
            O nucleo roda em <code>InkSim</code> (stable fluids). Com suporte, o canvas usa worker e OffscreenCanvas;
            senao, a simulacao fica na thread principal com buffers transferiveis.
          </p>
        </section>
        <section id="nextjs">
          <h2>Next.js</h2>
          <p>
            Importe com <code>dynamic(..., {'{ ssr: false }'})</code>. Sirva o wasm em <code>public</code> ou use o
            caminho exportado <code>react-sumi-ink/wasm/sumi_ink_sim_bg.wasm</code>.
          </p>
        </section>
        <section id="a11y">
          <h2>Acessibilidade</h2>
          <p>
            O canvas de tinta tem <code>aria-hidden</code>. Filhos permanecem no tab order. Com{' '}
            <code>prefers-reduced-motion</code> o modo vira <code>static</code> e a secagem acelera visualmente.
          </p>
        </section>
        <section id="perf">
          <h2>Performance</h2>
          <table className="prop-table">
            <thead>
              <tr>
                <th>Cenario</th>
                <th>Resultado alvo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Desktop, grid medio</td>
                <td>55 a 60 fps</td>
              </tr>
              <tr>
                <td>Android medio, quality auto</td>
                <td>45 a 60 fps</td>
              </tr>
              <tr>
                <td>Passo WASM (128²)</td>
                <td>~1.2 ms</td>
              </tr>
              <tr>
                <td>Draw WebGL2 full viewport</td>
                <td>~0.6 ms GPU</td>
              </tr>
            </tbody>
          </table>
        </section>
        <PresetDemo />
      </article>
    </div>
  );
}