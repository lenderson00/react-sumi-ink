import { useEffect, useState } from 'react';

/** Auto-hide the site header on scroll down; show on scroll up. */
export function useHeaderScroll(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      setCompact(false);
      return;
    }
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y <= 4) {
          setHidden(false);
          setCompact(false);
        } else {
          if (dy > 8) setHidden(true);
          else if (dy < -8) setHidden(false);
          setCompact(y > 40);
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return { hidden, compact };
}