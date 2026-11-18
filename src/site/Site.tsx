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

const STUDIO_NAV: { href: string; label: string; external?: boolean }[] = [
  { href: '#/docs', label: 'About' },
  { href: '#/playground', label: 'Collection' },
  { href: 'https://github.com/lenderson00/react-sumi-ink', label: 'Journal', external: true },
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

  const overlay = route === 'playground' || route === 'home';
  const studio = route === 'home';
  const headerClass = [
    'site-header',
    studio ? 'studio-nav' : '',
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
          {studio ? (
            'Sumi Ink Studio'
          ) : (
            <>
              <span className="brand-dot" aria-hidden /> react-sumi-ink
            </>
          )}
        </a>
        <nav className="site-nav" aria-label="Main">
          {studio
            ? STUDIO_NAV.map((item) =>
                item.external ? (
                  <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                ) : (
                  <a key={item.label} href={item.href}>
                    {item.label}
                  </a>
                ),
              )
            : NAV.map(([r, label]) => (
                <a key={r} href={href(r)} aria-current={route === r ? 'page' : undefined} className={route === r ? 'on' : ''}>
                  {label}
                </a>
              ))}
        </nav>
        <div className="header-end">
          {studio ? (
            <a className="bag" href={href('playground')} aria-label="Collection">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 8h12l-1 12H7L6 8z" />
                <path d="M9 8V7a3 3 0 0 1 6 0v1" />
              </svg>
            </a>
          ) : (
            <a className="npm" href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
          {overlay && !studio && (
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
          {!studio && <ThemeToggle theme={theme} onChange={setTheme} />}
        </div>
      </header>
      {overlay && !studio && !playNavOpen && (
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