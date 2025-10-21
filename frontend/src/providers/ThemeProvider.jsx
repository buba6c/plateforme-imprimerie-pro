/**
 * THEME PROVIDER - Gestion professionnelle du thème clair/sombre
 * 
 * Features:
 * - Mode clair/sombre uniquement
 * - Détection automatique des préférences système
 * - Persistence dans localStorage
 * - Transitions fluides
 * - Hook useTheme() pour les composants
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const ThemeContext = createContext(undefined);

/**
 * ThemeProvider - Provider pour gérer le thème de l'application
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Composants enfants
 * @param {string} [props.defaultTheme='system'] - Thème par défaut: 'light', 'dark', ou 'system'
 * @param {string} [props.storageKey='theme'] - Clé pour localStorage
 */
export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  storageKey = 'theme' 
}) {
  const [theme, setThemeState] = useState(() => {
    // Essayer de récupérer depuis localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored && ['light', 'dark', 'system'].includes(stored)) {
          return stored;
        }
      } catch (error) {
        console.warn('Failed to read theme from localStorage:', error);
      }
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Calculer le thème résolu (light ou dark)
  const computeResolvedTheme = (themeValue) => {
    if (themeValue === 'dark') return 'dark';
    if (themeValue === 'light') return 'light';
    
    // Système
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    return 'light';
  };

  // Appliquer le thème au DOM
  const applyTheme = (themeValue) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const resolved = computeResolvedTheme(themeValue);
    
    // Ajouter classe pour transitions
    root.classList.add('theme-transitioning');
    
    // Appliquer data-theme
    root.setAttribute('data-theme', resolved);
    
    // Ajouter/retirer la classe 'dark' pour Tailwind
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Nettoyer la classe de transition après animation
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 200);

    setResolvedTheme(resolved);
  };

  // Changer le thème
  const setTheme = (newTheme) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) {
      console.warn(`Invalid theme: ${newTheme}`);
      return;
    }

    setThemeState(newTheme);
    applyTheme(newTheme);

    // Sauvegarder dans localStorage
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  };

  // Toggle entre clair et sombre
  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Initialiser le thème au montage
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Écouter les changements de préférences système
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (event) => {
      const newResolved = event.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      const root = document.documentElement;
      root.setAttribute('data-theme', newResolved);
      
      // Synchroniser la classe dark pour Tailwind
      if (newResolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // Vérifier si addEventListener est disponible
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback pour anciens navigateurs
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      isDark: resolvedTheme === 'dark',
      isLight: resolvedTheme === 'light',
      isSystem: theme === 'system',
    }),
    [theme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte de thème
 * 
 * @returns {Object} Contexte de thème avec:
 *   - theme: 'light' | 'dark' | 'system' - Thème sélectionné
 *   - resolvedTheme: 'light' | 'dark' - Thème effectif appliqué
 *   - setTheme: (theme) => void - Changer le thème
 *   - toggleTheme: () => void - Basculer entre clair/sombre
 *   - isDark: boolean - True si le thème résolu est sombre
 *   - isLight: boolean - True si le thème résolu est clair
 *   - isSystem: boolean - True si suit les préférences système
 * 
 * @throws {Error} Si utilisé en dehors d'un ThemeProvider
 * 
 * @example
 * function MyComponent() {
 *   const { isDark, toggleTheme } = useTheme();
 *   return <button onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</button>;
 * }
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

// Export default pour compatibilité
export default ThemeProvider;
