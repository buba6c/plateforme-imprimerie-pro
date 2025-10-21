import { useState, useEffect, createContext, useContext } from 'react';
import { systemConfigService } from '../services/apiAdapter';

// Thème par défaut - Palette modernisée (bleu -> turquoise)
const defaultTheme = {
  primaryColor: '#007bff',        // Bleu clair principal
  secondaryColor: '#00c6ff',      // Turquoise pour les dégradés et accents
  accentColor: '#ff4f70',         // Rose/rouge douce pour actions importantes
  backgroundColor: '#F9FAFB',     // Fond clair global
  backgroundSecondary: '#FFFFFF', // Surfaces et sections
  textColor: '#1E1E1E',          // Texte principal
  textSecondary: '#5A5A5A',      // Texte secondaire
  cardBg: '#FFFFFF',             // Blanc pour les cartes
  borderColor: '#E5E7EB',        // Gris clair pour les bordures
  successColor: '#00B894',       // Succès
  warningColor: '#FDCB6E',       // Avertissement
  errorColor: '#E17055',         // Erreur
  infoColor: '#0984E3'           // Info
};

// Context pour le thème
const ThemeCustomContext = createContext({
  theme: defaultTheme,
  updateTheme: () => {},
  resetTheme: () => {},
  isLoading: false
});

export const useThemeCustom = () => {
  const context = useContext(ThemeCustomContext);
  if (!context) {
    throw new Error('useThemeCustom doit être utilisé dans un ThemeCustomProvider');
  }
  return context;
};

// Provider du thème
export const ThemeCustomProvider = ({ children }) => {
  const [theme, setTheme] = useState(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Appliquer les variables CSS
  const applyThemeToDOM = (themeData) => {
    const root = document.documentElement;
    
    // Couleurs principales
    root.style.setProperty('--primary-color', themeData.primaryColor);
    root.style.setProperty('--secondary-color', themeData.secondaryColor);
    root.style.setProperty('--accent-color', themeData.accentColor);
    
    // Arrière-plans
    root.style.setProperty('--background-color', themeData.backgroundColor);
    root.style.setProperty('--background-secondary', themeData.backgroundSecondary);
    
    // Textes
    root.style.setProperty('--text-color', themeData.textColor);
    root.style.setProperty('--text-secondary', themeData.textSecondary);
    
    // Cartes
    root.style.setProperty('--card-bg', themeData.cardBg);
    root.style.setProperty('--border-color', themeData.borderColor);
    root.style.setProperty('--card-border', themeData.borderColor);
    
    // États
    root.style.setProperty('--success-color', themeData.successColor);
    root.style.setProperty('--warning-color', themeData.warningColor);
    root.style.setProperty('--error-color', themeData.errorColor);
    root.style.setProperty('--info-color', themeData.infoColor);
    
    // Dégradés et hover
    root.style.setProperty('--gradient-primary', 
      `linear-gradient(135deg, ${themeData.primaryColor} 0%, ${themeData.secondaryColor} 100%)`);
    root.style.setProperty('--gradient-sidebar', 
      `linear-gradient(135deg, ${themeData.primaryColor} 0%, ${themeData.secondaryColor} 100%)`);
    // Glow hover (léger)
    try {
      const hoverGlow = 'rgba(0, 198, 255, 0.15)';
      root.style.setProperty('--button-hover', hoverGlow);
    } catch (e) { /* no-op */ }
  };

  // Charger le thème depuis le backend
  const loadTheme = async () => {
    try {
      setIsLoading(true);
      const response = await systemConfigService.get('custom_theme');
      const config = response?.value ?? response; // API renvoie { value } depuis /system-config
      
      if (config && config.enabled && config.colors) {
        const loadedTheme = { ...defaultTheme, ...config.colors };
        setTheme(loadedTheme);
        applyThemeToDOM(loadedTheme);
      } else {
        // Appliquer le thème par défaut
        applyThemeToDOM(defaultTheme);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Erreur lors du chargement du thème, utilisation du thème par défaut:', error);
      applyThemeToDOM(defaultTheme);
    } finally {
      setIsLoading(false);
    }
  };

  // Mettre à jour le thème
  const updateTheme = async (newTheme) => {
    try {
      const updatedTheme = { ...theme, ...newTheme };
      setTheme(updatedTheme);
      applyThemeToDOM(updatedTheme);
      
      // Sauvegarder en backend
      await systemConfigService.set('custom_theme', {
        enabled: true,
        colors: updatedTheme
      });
      
      return { success: true };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erreur lors de la mise à jour du thème:', error);
      return { success: false, error: error.message };
    }
  };

  // Réinitialiser le thème
  const resetTheme = async () => {
    try {
      setTheme(defaultTheme);
      applyThemeToDOM(defaultTheme);
      
      // Désactiver le thème personnalisé en backend
      await systemConfigService.set('custom_theme', {
        enabled: false,
        colors: defaultTheme
      });
      
      return { success: true };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erreur lors de la réinitialisation du thème:', error);
      return { success: false, error: error.message };
    }
  };

  // Charger le thème au montage
  useEffect(() => {
    loadTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    theme,
    updateTheme,
    resetTheme,
    isLoading
  };

  return (
    <ThemeCustomContext.Provider value={value}>
      {children}
    </ThemeCustomContext.Provider>
  );
};

// Utilitaires pour générer des couleurs
export const generateColorVariants = (baseColor) => {
  // Cette fonction pourrait être utilisée pour générer automatiquement
  // des variations de couleurs (plus clair, plus foncé, etc.)
  return {
    50: lightenColor(baseColor, 90),
    100: lightenColor(baseColor, 80),
    200: lightenColor(baseColor, 60),
    300: lightenColor(baseColor, 40),
    400: lightenColor(baseColor, 20),
    500: baseColor,
    600: darkenColor(baseColor, 20),
    700: darkenColor(baseColor, 40),
    800: darkenColor(baseColor, 60),
    900: darkenColor(baseColor, 80)
  };
};

// Utilitaires pour modifier les couleurs
const lightenColor = (color, percent) => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
};

const darkenColor = (color, percent) => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
    (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
    (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
};

export default ThemeCustomProvider;