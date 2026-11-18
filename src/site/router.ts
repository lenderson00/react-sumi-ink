import { useEffect, useState } from 'react';

export type Route = 'home' | 'docs' | 'playground';

const parse = (): { route: Route; anchor: string | null } => {
  const [path, anchor] = location.hash.replace(/^#\/?/, '').split('#');
  const route: Route = path === 'docs' ? 'docs' : path === 'playground' ? 'playground' : 'home';
  return { route, anchor: anchor || null };
};

/** Tiny hash router: `#/`, `#/docs`, `#/docs#props`, `#/playground`. */
export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const on = () => setState(parse());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  // Scroll to the anchor (or top) after a route change.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (state.anchor) document.getElementById(state.anchor)?.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    });
  }, [state.route, state.anchor]);
  return state;
}

export const href = (route: Route, anchor?: string) =>
  `#/${route === 'home' ? '' : route}${anchor ? `#${anchor}` : ''}`;
