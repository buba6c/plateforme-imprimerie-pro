import { useState, useEffect } from 'react';

/**
 * Hook pour détecter si une media query est matchée
 * @param {string} query - La media query à tester (ex: '(max-width: 768px)')
 * @returns {boolean} - True si la query est matchée
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Définir l'état initial
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Créer le listener
    const listener = (e) => setMatches(e.matches);
    
    // Ajouter le listener (ancien et nouveau format pour compatibilité)
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [matches, query]);

  return matches;
};

/**
 * Hook pour détecter le type d'écran actuel
 * @returns {object} - Objet avec isMobile, isTablet, isDesktop
 */
export const useBreakpoint = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');

  return { isMobile, isTablet, isDesktop };
};

/**
 * Hook pour obtenir la largeur de la fenêtre
 * @returns {number} - Largeur de la fenêtre en pixels
 */
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    
    // Appeler une fois pour définir la taille initiale
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

export default useMediaQuery;
