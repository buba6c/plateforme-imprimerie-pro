/**
 * SYSTÈME DE COULEURS UNIFIÉ - PLATEFORME D'IMPRIMERIE
 * 
 * Palette principale : Bleu professionnel, Orange énergique, Blanc épuré
 * Compatible mode sombre/clair avec toutes les variantes nécessaires
 */

export const BRAND_COLORS = {
  // === COULEURS PRINCIPALES ===
  
  // Bleu principal (couleur principale de la marque)
  blue: {
    50: '#eff6ff',   // Très clair - backgrounds subtils
    100: '#dbeafe',  // Clair - highlights doux
    200: '#bfdbfe',  // Clair moyen - borders légères
    300: '#93c5fd',  // Moyen clair - états hover
    400: '#60a5fa',  // Moyen - éléments secondaires
    500: 'var(--color-blue-500)',  // Standard - couleur principale
    600: 'var(--color-blue-600)',  // Foncé - boutons, liens actifs
    700: 'var(--color-blue-700)',  // Très foncé - contraste élevé
    800: '#1e40af',  // Ultra foncé - mode sombre
    900: '#1e3a8a',  // Maximum - accents forts
    950: '#172554',  // Ultra profond - mode sombre intense
  },

  // Orange énergique (couleur d'accent et d'action)
  orange: {
    50: '#fff7ed',   // Très clair - backgrounds subtils
    100: '#ffedd5',  // Clair - highlights doux
    200: '#fed7aa',  // Clair moyen - borders légères
    300: '#fdba74',  // Moyen clair - états hover
    400: '#fb923c',  // Moyen - éléments secondaires
    500: 'var(--color-orange-500)',  // Standard - couleur d'action
    600: 'var(--color-orange-600)',  // Foncé - boutons CTA
    700: '#c2410c',  // Très foncé - contraste élevé
    800: '#9a3412',  // Ultra foncé - mode sombre
    900: '#7c2d12',  // Maximum - accents forts
    950: '#431407',  // Ultra profond - mode sombre intense
  },

  // === COULEURS NEUTRES (basées sur le blanc) ===
  
  // Gris neutres (dérivés du blanc vers le noir)
  neutral: {
    0: 'var(--color-neutral-0)',    // Blanc pur
    50: '#fafafa',   // Blanc cassé
    100: '#f5f5f5',  // Gris très clair
    200: '#e5e5e5',  // Gris clair
    300: '#d4d4d4',  // Gris moyen clair
    400: '#a3a3a3',  // Gris moyen
    500: '#737373',  // Gris standard
    600: '#525252',  // Gris foncé
    700: '#404040',  // Gris très foncé
    800: '#262626',  // Gris ultra foncé
    900: '#171717',  // Presque noir
    950: '#0a0a0a',  // Noir intense
  },

  // === COULEURS FONCTIONNELLES ===
  
  // Succès (vert harmonieux avec la palette)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',   // Vert standard
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  // Erreur (rouge harmonieux)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',   // Rouge standard
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Avertissement (jaune/orange harmonieux)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',   // Jaune standard
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // Information (basé sur le bleu principal)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: 'var(--color-blue-500)',   // Bleu info (même que principal)
    600: 'var(--color-blue-600)',
    700: 'var(--color-blue-700)',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
};

// === COULEURS SÉMANTIQUES PAR RÔLE ===

export const ROLE_COLORS = {
  admin: {
    primary: BRAND_COLORS.blue[600],
    light: BRAND_COLORS.blue[100],
    dark: BRAND_COLORS.blue[800],
    accent: BRAND_COLORS.orange[500],
  },
  preparateur: {
    primary: BRAND_COLORS.orange[600],
    light: BRAND_COLORS.orange[100],
    dark: BRAND_COLORS.orange[800],
    accent: BRAND_COLORS.blue[500],
  },
  imprimeur_roland: {
    primary: BRAND_COLORS.blue[700],
    light: BRAND_COLORS.blue[50],
    dark: BRAND_COLORS.blue[900],
    accent: BRAND_COLORS.orange[400],
  },
  imprimeur_xerox: {
    primary: BRAND_COLORS.orange[700],
    light: BRAND_COLORS.orange[50],
    dark: BRAND_COLORS.orange[900],
    accent: BRAND_COLORS.blue[400],
  },
  livreur: {
    primary: BRAND_COLORS.blue[500],
    light: BRAND_COLORS.neutral[100],
    dark: BRAND_COLORS.neutral[800],
    accent: BRAND_COLORS.orange[600],
  },
};

// === COULEURS D'ÉTAT ===

export const STATUS_COLORS = {
  // États des dossiers
  nouveau: BRAND_COLORS.info[500],
  en_cours: BRAND_COLORS.warning[500],
  en_preparation: BRAND_COLORS.orange[500],
  pret_impression: BRAND_COLORS.blue[500],
  en_impression: BRAND_COLORS.blue[600],
  imprime: BRAND_COLORS.success[500],
  pret_livraison: BRAND_COLORS.orange[600],
  en_livraison: BRAND_COLORS.warning[600],
  livre: BRAND_COLORS.success[600],
  termine: BRAND_COLORS.neutral[600],
  
  // États système
  actif: BRAND_COLORS.success[500],
  inactif: BRAND_COLORS.neutral[400],
  attente: BRAND_COLORS.warning[500],
  erreur: BRAND_COLORS.error[500],
};

// === COULEURS POUR LES GRAPHIQUES ===

export const CHART_COLORS = {
  // Palette principale pour graphiques (optimisée pour l'accessibilité)
  primary: [
    BRAND_COLORS.blue[500],
    BRAND_COLORS.orange[500],
    BRAND_COLORS.success[500],
    BRAND_COLORS.warning[500],
    BRAND_COLORS.blue[700],
    BRAND_COLORS.orange[700],
    BRAND_COLORS.neutral[600],
    BRAND_COLORS.info[600],
  ],
  
  // Couleurs métiers spécifiques
  xerox: BRAND_COLORS.blue[500],
  roland: BRAND_COLORS.orange[500],
  livraison: BRAND_COLORS.warning[500],
  production: BRAND_COLORS.success[500],
  revenu: BRAND_COLORS.blue[600],
};

// === THÈMES MODE SOMBRE/CLAIR ===

export const THEME_COLORS = {
  light: {
    // Backgrounds
    background: {
      primary: BRAND_COLORS.neutral[0],      // var(--color-neutral-0)
      secondary: BRAND_COLORS.neutral[50],   // #fafafa
      tertiary: BRAND_COLORS.neutral[100],   // #f5f5f5
      elevated: BRAND_COLORS.neutral[0],     // var(--color-neutral-0) avec shadow
    },
    
    // Textes
    text: {
      primary: BRAND_COLORS.neutral[900],    // #171717
      secondary: BRAND_COLORS.neutral[700],  // #404040
      tertiary: BRAND_COLORS.neutral[500],   // #737373
      inverse: BRAND_COLORS.neutral[0],      // var(--color-neutral-0)
    },
    
    // Borders
    border: {
      primary: BRAND_COLORS.neutral[200],    // #e5e5e5
      secondary: BRAND_COLORS.neutral[300],  // #d4d4d4
      focus: BRAND_COLORS.blue[500],         // var(--color-blue-500)
    },
  },
  
  dark: {
    // Backgrounds
    background: {
      primary: BRAND_COLORS.neutral[900],    // #171717
      secondary: BRAND_COLORS.neutral[800],  // #262626
      tertiary: BRAND_COLORS.neutral[700],   // #404040
      elevated: BRAND_COLORS.neutral[800],   // #262626 avec shadow
    },
    
    // Textes
    text: {
      primary: BRAND_COLORS.neutral[50],     // #fafafa
      secondary: BRAND_COLORS.neutral[200],  // #e5e5e5
      tertiary: BRAND_COLORS.neutral[400],   // #a3a3a3
      inverse: BRAND_COLORS.neutral[900],    // #171717
    },
    
    // Borders
    border: {
      primary: BRAND_COLORS.neutral[700],    // #404040
      secondary: BRAND_COLORS.neutral[600],  // #525252
      focus: BRAND_COLORS.blue[400],         // #60a5fa
    },
  },
};

// === FONCTIONS UTILITAIRES ===

/**
 * Obtient la couleur d'un rôle
 */
export const getRoleColor = (role, variant = 'primary') => {
  return ROLE_COLORS[role]?.[variant] || BRAND_COLORS.blue[500];
};

/**
 * Obtient la couleur d'un statut
 */
export const getStatusColor = (status) => {
  return STATUS_COLORS[status] || BRAND_COLORS.neutral[500];
};

/**
 * Obtient les couleurs du thème actuel
 */
export const getThemeColors = (isDark = false) => {
  return isDark ? THEME_COLORS.dark : THEME_COLORS.light;
};

/**
 * Obtient une couleur de graphique par index
 */
export const getChartColor = (index) => {
  return CHART_COLORS.primary[index % CHART_COLORS.primary.length];
};

/**
 * Génère les variables CSS pour toutes les couleurs
 */
export const generateCSSVariables = () => {
  const variables = {};
  
  // Variables principales
  Object.entries(BRAND_COLORS).forEach(([colorName, shades]) => {
    if (typeof shades === 'object') {
      Object.entries(shades).forEach(([shade, value]) => {
        variables[`--color-${colorName}-${shade}`] = value;
      });
    } else {
      variables[`--color-${colorName}`] = shades;
    }
  });
  
  return variables;
};

export default BRAND_COLORS;