import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { systemConfigService } from '../services/apiAdapter';

const ThemeContext = createContext({
  theme: 'system', // 'light' | 'dark' | 'system'
  resolvedTheme: 'light', // 'light' | 'dark'
  setTheme: () => {},
  toggleDarkLight: () => {},
});

const THEME_STORAGE_KEY = 'theme';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Apply theme to <html> class
  const applyThemeClass = nextResolved => {
    const root = document.documentElement;
    if (nextResolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  };

  // Compute resolved from theme + system preference
  const computeResolved = pref => {
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  };

  // Initial load: localStorage -> backend default -> system
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored) {
          if (!mounted) return;
          setTheme(stored);
          const res = computeResolved(stored);
          setResolvedTheme(res);
          applyThemeClass(res);
          return;
        }
        // Fallback: backend default
        try {
          const data = await systemConfigService.get('dark_mode');
          const enabled = !!(data && (data.enabled ?? data.dark_mode));
          const pref = enabled ? 'dark' : 'system';
          if (!mounted) return;
          setTheme(pref);
          const res = computeResolved(pref);
          setResolvedTheme(res);
          applyThemeClass(res);
        } catch {
          // Last fallback: system
          const res = computeResolved('system');
          if (!mounted) return;
          setTheme('system');
          setResolvedTheme(res);
          applyThemeClass(res);
        }
      } catch {}
    };
    init();

    // React to system changes if theme is 'system'
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handle = () => {
      if (theme === 'system') {
        const res = computeResolved('system');
        setResolvedTheme(res);
        applyThemeClass(res);
      }
    };
    media.addEventListener?.('change', handle);
    return () => {
      mounted = false;
      media.removeEventListener?.('change', handle);
    };
  }, [theme]);

  useEffect(() => {
    const res = computeResolved(theme);
    setResolvedTheme(res);
    applyThemeClass(res);
  }, [theme]);

  const startThemeTransition = () => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: t => {
        startThemeTransition();
        setTheme(t);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, t);
        } catch {}
      },
      toggleDarkLight: () => {
        startThemeTransition();
        setTheme(prev => {
          const next = prev === 'dark' ? 'light' : 'dark';
          try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
          } catch {}
          return next;
        });
      },
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
