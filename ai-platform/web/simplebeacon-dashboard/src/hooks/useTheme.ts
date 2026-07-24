import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';
    setTheme(current);

    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';
      setTheme(t);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    localStorage.setItem('sb_theme', next);
  }, [theme]);

  return { theme, toggleTheme };
}
