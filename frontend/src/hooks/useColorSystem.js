import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  BRAND_COLORS,
  ROLE_COLORS,
  STATUS_COLORS,
  CHART_COLORS,
  THEME_COLORS,
  getRoleColor,
  getStatusColor,
  getThemeColors,
  getChartColor
} from '../system/colors';

/**
 * Hook personnalisé pour utiliser le système de couleurs unifié
 * 
 * Palette : Bleu professionnel, Orange énergique, Blanc épuré
 * 
 * @returns {Object} Système de couleurs complet avec utilitaires
 */
export const useColorSystem = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const colorSystem = useMemo(() => {
    const themeColors = getThemeColors(isDark);

    return {
      // === COULEURS DE BASE ===
      
      // Palette principale
      brand: BRAND_COLORS,
      
      // Couleurs du thème actuel (mode sombre/clair)
      theme: themeColors,
      
      // === COULEURS SÉMANTIQUES ===
      
      // Couleurs par rôle utilisateur
      role: ROLE_COLORS,
      
      // Couleurs des statuts
      status: STATUS_COLORS,
      
      // Couleurs pour graphiques
      chart: CHART_COLORS,
      
      // === UTILITAIRES ===
      
      // État du thème
      isDark,
      
      /**
       * Obtient la couleur d'un rôle
       * @param {string} role - Le rôle (admin, preparateur, etc.)
       * @param {string} variant - La variante (primary, light, dark, accent)
       * @returns {string} Code couleur hex
       */
      getRoleColor: (role, variant = 'primary') => getRoleColor(role, variant),
      
      /**
       * Obtient la couleur d'un statut
       * @param {string} status - Le statut du dossier
       * @returns {string} Code couleur hex
       */
      getStatusColor: (status) => getStatusColor(status),
      
      /**
       * Obtient une couleur de graphique par index
       * @param {number} index - Index de la couleur
       * @returns {string} Code couleur hex
       */
      getChartColor: (index) => getChartColor(index),
      
      /**
       * Génère les classes Tailwind pour un rôle
       * @param {string} role - Le rôle utilisateur
       * @param {Object} options - Options de génération
       * @returns {Object} Classes Tailwind organisées
       */
      getRoleClasses: (role, options = {}) => {
        const { variant = 'primary', includeHover = true, includeDark = true } = options;
        const baseColor = getRoleColor(role, variant);
        
        // Déterminer les classes Tailwind correspondantes
        const colorMap = {
          [BRAND_COLORS.blue[500]]: 'blue-500',
          [BRAND_COLORS.blue[600]]: 'blue-600',
          [BRAND_COLORS.blue[700]]: 'blue-700',
          [BRAND_COLORS.orange[500]]: 'orange-500',
          [BRAND_COLORS.orange[600]]: 'orange-600',
          [BRAND_COLORS.orange[700]]: 'orange-700',
        };
        
        const tailwindColor = colorMap[baseColor] || 'blue-500';
        
        return {
          bg: `bg-${tailwindColor}`,
          text: `text-${tailwindColor}`,
          border: `border-${tailwindColor}`,
          ...(includeHover && {
            hover: {
              bg: `hover:bg-${tailwindColor}`,
              text: `hover:text-${tailwindColor}`,
              border: `hover:border-${tailwindColor}`,
            }
          }),
          ...(includeDark && {
            dark: {
              bg: `dark:bg-${tailwindColor}`,
              text: `dark:text-${tailwindColor}`,
              border: `dark:border-${tailwindColor}`,
            }
          }),
        };
      },
      
      /**
       * Génère les classes Tailwind pour un statut
       * @param {string} status - Le statut
       * @returns {Object} Classes Tailwind pour le statut
       */
      getStatusClasses: (status) => {
        const statusColorMap = {
          nouveau: 'info-500',
          en_cours: 'warning-500',
          en_preparation: 'orange-500',
          pret_impression: 'blue-500',
          en_impression: 'blue-600',
          imprime: 'success-500',
          pret_livraison: 'orange-600',
          en_livraison: 'warning-600',
          livre: 'success-600',
          termine: 'neutral-600',
          actif: 'success-500',
          inactif: 'neutral-400',
          attente: 'warning-500',
          erreur: 'error-500',
        };
        
        const tailwindColor = statusColorMap[status] || 'neutral-500';
        
        return {
          bg: `bg-${tailwindColor}`,
          text: `text-${tailwindColor}`,
          border: `border-${tailwindColor}`,
          badge: `bg-${tailwindColor.replace('-500', '-100')} text-${tailwindColor.replace('-500', '-800')}`,
        };
      },
      
      /**
       * Génère un gradient pour un rôle
       * @param {string} role - Le rôle utilisateur
       * @returns {string} Classes de gradient Tailwind
       */
      getRoleGradient: (role) => {
        // Unifié sur la palette principale bleu -> turquoise
        const unified = 'from-[#007bff] to-[#00c6ff]';
        return `bg-gradient-to-r ${unified}`;
      },
      
      /**
       * Obtient les couleurs adaptées au thème pour les composants
       * @returns {Object} Couleurs de composants
       */
      getComponentColors: () => ({
        // Cards et containers
        card: {
          background: isDark ? 'bg-neutral-800' : 'bg-neutral-0',
          border: isDark ? 'border-neutral-700' : 'border-neutral-200',
          shadow: isDark ? 'shadow-neutral-900/20' : 'shadow-neutral-900/10',
        },
        
        // Boutons
        button: {
          primary: {
            base: 'bg-blue-500 text-neutral-0 border-blue-500',
            hover: 'hover:bg-blue-600 hover:border-blue-600',
            focus: 'focus:ring-blue-500/20',
          },
          secondary: {
            base: isDark ? 'bg-neutral-700 text-neutral-100 border-neutral-600' : 'bg-neutral-100 text-neutral-900 border-neutral-200',
            hover: isDark ? 'hover:bg-neutral-600' : 'hover:bg-neutral-200',
            focus: 'focus:ring-neutral-500/20',
          },
          accent: {
            base: 'bg-orange-500 text-neutral-0 border-orange-500',
            hover: 'hover:bg-orange-600 hover:border-orange-600',
            focus: 'focus:ring-orange-500/20',
          },
        },
        
        // Inputs
        input: {
          base: isDark ? 'bg-neutral-800 text-neutral-100 border-neutral-700' : 'bg-neutral-0 text-neutral-900 border-neutral-200',
          focus: 'focus:border-blue-500 focus:ring-blue-500/20',
          error: 'border-error-500 focus:border-error-500 focus:ring-error-500/20',
          placeholder: isDark ? 'placeholder-neutral-400' : 'placeholder-neutral-500',
        },
        
        // Navigation
        nav: {
          background: isDark ? 'bg-neutral-900' : 'bg-neutral-0',
          border: isDark ? 'border-neutral-800' : 'border-neutral-200',
          text: isDark ? 'text-neutral-100' : 'text-neutral-900',
          active: 'bg-blue-500 text-neutral-0',
          hover: isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100',
        },
      }),
      
      /**
       * Génère les variables CSS pour le thème actuel
       * @returns {Object} Variables CSS
       */
      getCSSVariables: () => {
        const variables = {};
        
        // Variables de couleurs principales
        Object.entries(BRAND_COLORS).forEach(([colorName, shades]) => {
          if (typeof shades === 'object') {
            Object.entries(shades).forEach(([shade, value]) => {
              variables[`--color-${colorName}-${shade}`] = value;
            });
          }
        });
        
        // Variables du thème
        Object.entries(themeColors).forEach(([category, colors]) => {
          if (typeof colors === 'object') {
            Object.entries(colors).forEach(([name, value]) => {
              variables[`--theme-${category}-${name}`] = value;
            });
          }
        });
        
        return variables;
      },
    };
  }, [isDark]);

  return colorSystem;
};

export default useColorSystem;