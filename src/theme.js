import { useCallback, useEffect, useState } from 'react';

const KEY = 'peach-study-theme';
const COLORS = { light: '#f5f0e6', dark: '#1c1c1a' };

function readPref() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(resolved) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', COLORS[resolved]);
}

/** Theme preference: 'system' | 'light' | 'dark'. Applies data-theme on <html>. */
export function useTheme() {
  const [pref, setPrefState] = useState(readPref);
  const [resolved, setResolved] = useState(() => (readPref() === 'system' ? (systemIsDark() ? 'dark' : 'light') : readPref()));

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const next = pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
      setResolved(next);
      apply(next);
    };
    update();
    if (pref !== 'system') return undefined;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [pref]);

  const setPref = useCallback((next) => {
    try { localStorage.setItem(KEY, next); } catch { /* private mode: ignore */ }
    setPrefState(next);
  }, []);

  /** Quick toggle between light and dark (used by the header button). */
  const toggle = useCallback(() => setPref(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPref]);

  return { pref, resolved, setPref, toggle };
}
