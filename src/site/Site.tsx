import { useEffect, useState } from 'react';
import { Playground } from '../playground/App';
import { Docs } from './Docs';
import { Home } from './Home';
import { href, useRoute, type Route } from './router';
import { ThemeToggle, useTheme } from './theme';
import { useHeaderScroll } from './useHeaderScroll';

const NAV: [Route, string][] = [
  ['home', 'Overview'],
  ['docs', 'Docs'],
  ['playground', 'Playground'],
];

const REPO = 'https://github.com/lenderson00/react-sumi-ink';

function Header({ route }: { route: Route }) {
  const [theme, setTheme] = useTheme();
  const scrollHide = useHeaderScroll(route !== 'playground');
  const [playNavOpen, setPlayNavOpen] = useState(true);

  useEffect(() => {
    if (route !== 'playground') return;
    const mq = window.matchMedia('(max-width: 720px)');
    const apply = () => setPlayNavOpen(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [route]);

  const overlay = route === 'playground';
  const headerClass = [
    'site-header',
    overlay ? 'overlay' : '',
    scrollHide.hidden ? 'is-hidden' : '',
    scrollHide.compact ? 'is-compact' : '',
    overlay && !playNavOpen ? 'nav-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header className={headerClass}>
        <a className="brand" href={href('home')}>
          <span className="brand-dot" aria-hidden /> react-sumi-ink
        </a>
        <nav className="site-nav" aria-label="Main">
          {NAV.map(([r, label]) => (
            <a key={r} href={href(r)} aria-current={route === r ? 'page' : undefined} className={route === r ? 'on' : ''}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-end">
          <a className="npm" href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          {overlay && (
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={playNavOpen}
              aria-label={playNavOpen ? 'Hide navigation' : 'Show navigation'}
              onClick={() => setPlayNavOpen((o) => !o)}
            >
              {playNavOpen ? '▴' : '☰'}
            </button>
          )}
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>
      {overlay && !playNavOpen && (
        <button type="button" className="nav-fab" aria-label="Show navigation" onClick={() => setPlayNavOpen(true)}>
          ☰
        </button>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>react-sumi-ink · MIT · Lenderson Macedo</span>
      <span>
        <a href={href('docs')}>Docs</a> · <a href={href('playground')}>Playground</a> · <a href={REPO}>GitHub</a>
      </span>
    </footer>
  );
}

export function Site() {
  const { route } = useRoute();
  return (
    <div className={`site route-${route}`}>
      <Header route={route} />
      {route === 'playground' ? (
        <Playground />
      ) : (
        <>
          <main>{route === 'docs' ? <Docs /> : <Home />}</main>
          <Footer />
        </>
      )}
    </div>
  );
}