import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'ink-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(KEY) as Theme) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return [theme, setTheme] as const;
}

const OPTIONS = [
  ['dark', 'Dark', 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'],
  ['light', 'Light', 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
  ['system', 'System', 'M3 5h18v11H3zM8 20h8m-4-4v4'],
] as const;

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(([t, label, d]) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          aria-label={label}
          title={label}
          className={theme === t ? 'on' : ''}
          onClick={() => onChange(t)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={d} />
          </svg>
        </button>
      ))}
    </div>
  );
}
