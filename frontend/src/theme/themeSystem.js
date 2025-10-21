// ============================================================================
// SYSTÈME DE THÈME AVANCÉ - EvocomPrint
// ============================================================================

// Thèmes de couleurs
export const lightTheme = {
  // Couleurs principales
  primary: {
    gradient: 'linear-gradient(135deg, #007bff, #00c6ff)',
    solid: '#007bff',
    light: '#00c6ff',
    hover: 'rgba(0, 198, 255, 0.1)',
    glow: 'rgba(0, 198, 255, 0.5)',
  },
  
  // Couleur d'action/accent
  accent: {
    main: '#ff4f70',
    hover: '#ff6b81',
    light: '#ffebef',
  },
  
  // Couleurs de succès/erreur/warning
  success: {
    main: '#22c55e',
    light: '#dcfce7',
    dark: '#16a34a',
  },
  
  warning: {
    main: '#f59e0b',
    light: '#fef3c7',
    dark: '#d97706',
  },
  
  error: {
    main: '#ef4444',
    light: '#fee2e2',
    dark: '#dc2626',
  },
  
  info: {
    main: '#3b82f6',
    light: '#dbeafe',
    dark: '#2563eb',
  },
  
  // Textes
  text: {
    primary: '#1E1E1E',
    secondary: '#5A5A5A',
    disabled: '#9E9E9E',
    inverse: '#FFFFFF',
  },
  
  // Backgrounds
  background: {
    default: '#F9FAFB',
    paper: '#FFFFFF',
    elevated: '#FFFFFF',
    hover: '#F3F4F6',
  },
  
  // Bordures et dividers
  divider: '#E5E7EB',
  border: {
    light: '#E0E0E0',
    main: '#D1D5DB',
    dark: '#9CA3AF',
  },
  
  // Ombres
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    glow: '0 0 20px rgba(0, 123, 255, 0.3)',
  },
  
  // États spécifiques
  states: {
    pending: '#f59e0b',
    inProgress: '#3b82f6',
    completed: '#22c55e',
    cancelled: '#ef4444',
  },
};

export const darkTheme = {
  // Couleurs principales
  primary: {
    gradient: 'linear-gradient(135deg, #00c6ff, #007bff)',
    solid: '#00c6ff',
    light: '#007bff',
    hover: 'rgba(0, 198, 255, 0.15)',
    glow: 'rgba(0, 198, 255, 0.6)',
  },
  
  // Couleur d'action/accent
  accent: {
    main: '#ff6b81',
    hover: '#ff8fa3',
    light: '#4a1f2a',
  },
  
  // Couleurs de succès/erreur/warning
  success: {
    main: '#4ade80',
    light: '#14532d',
    dark: '#22c55e',
  },
  
  warning: {
    main: '#fbbf24',
    light: '#451a03',
    dark: '#f59e0b',
  },
  
  error: {
    main: '#f87171',
    light: '#450a0a',
    dark: '#ef4444',
  },
  
  info: {
    main: '#60a5fa',
    light: '#1e3a8a',
    dark: '#3b82f6',
  },
  
  // Textes
  text: {
    primary: '#E0E0E0',
    secondary: '#B0B0B0',
    disabled: '#6B7280',
    inverse: '#1E1E1E',
  },
  
  // Backgrounds
  background: {
    default: '#121212',
    paper: '#1E1E1E',
    elevated: '#2A2A2A',
    hover: '#2E2E2E',
  },
  
  // Bordures et dividers
  divider: '#2E2E2E',
  border: {
    light: '#2E2E2E',
    main: '#3A3A3A',
    dark: '#4A4A4A',
  },
  
  // Ombres
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
    glow: '0 0 20px rgba(0, 198, 255, 0.4)',
  },
  
  // États spécifiques
  states: {
    pending: '#fbbf24',
    inProgress: '#60a5fa',
    completed: '#4ade80',
    cancelled: '#f87171',
  },
};

// ============================================================================
// CLASSES CSS UTILITAIRES
// ============================================================================

export const buttonClasses = {
  // Boutons principaux (actions importantes)
  primary: `
    bg-gradient-to-r from-blue-600 to-cyan-500
    hover:from-blue-700 hover:to-cyan-600
    text-white font-semibold
    shadow-md hover:shadow-lg
    hover:shadow-cyan-500/50
    transition-all duration-300
    rounded-xl px-6 py-3
    active:scale-95
  `,
  
  // Boutons secondaires (navigation, voir)
  secondary: `
    bg-white dark:bg-neutral-800
    border-2 border-blue-500
    text-blue-600 dark:text-blue-400
    hover:bg-blue-50 dark:hover:bg-neutral-700
    font-medium
    rounded-lg px-5 py-2.5
    transition-all duration-200
  `,
  
  // Boutons critiques (supprimer)
  danger: `
    bg-gradient-to-r from-red-500 to-pink-500
    hover:from-red-600 hover:to-pink-600
    text-white font-semibold
    shadow-md hover:shadow-lg
    hover:shadow-red-500/50
    transition-all duration-300
    rounded-xl px-6 py-3
    active:scale-95
  `,
  
  // Boutons neutres (filtres, options)
  neutral: `
    bg-neutral-100 dark:bg-neutral-800
    text-neutral-700 dark:text-neutral-200
    hover:bg-neutral-200 dark:hover:bg-neutral-700
    font-medium
    rounded-lg px-4 py-2
    transition-colors duration-200
  `,
  
  // Boutons de succès
  success: `
    bg-gradient-to-r from-green-500 to-emerald-500
    hover:from-green-600 hover:to-emerald-600
    text-white font-semibold
    shadow-md hover:shadow-lg
    hover:shadow-green-500/50
    transition-all duration-300
    rounded-xl px-6 py-3
    active:scale-95
  `,
  
  // Boutons fantômes
  ghost: `
    bg-transparent
    text-blue-600 dark:text-blue-400
    hover:bg-blue-50 dark:hover:bg-blue-900/20
    font-medium
    rounded-lg px-4 py-2
    transition-colors duration-200
  `,
};

export const cardClasses = {
  default: `
    bg-white dark:bg-neutral-800
    rounded-2xl
    shadow-sm dark:shadow-neutral-900/50
    border border-neutral-200 dark:border-neutral-700
    transition-all duration-300
    hover:shadow-md dark:hover:shadow-neutral-900/70
  `,
  
  elevated: `
    bg-white dark:bg-neutral-800
    rounded-2xl
    shadow-lg dark:shadow-neutral-900/70
    border border-neutral-100 dark:border-neutral-700
    transition-all duration-300
    hover:shadow-xl dark:hover:shadow-neutral-900/90
  `,
  
  interactive: `
    bg-white dark:bg-neutral-800
    rounded-2xl
    shadow-sm dark:shadow-neutral-900/50
    border border-neutral-200 dark:border-neutral-700
    transition-all duration-300
    hover:shadow-lg dark:hover:shadow-neutral-900/70
    hover:scale-[1.02]
    cursor-pointer
  `,
  
  gradient: `
    bg-gradient-to-br from-blue-500 to-cyan-500
    rounded-2xl
    shadow-lg shadow-blue-500/30
    border border-blue-400/50
    text-white
    transition-all duration-300
    hover:shadow-xl hover:shadow-blue-500/40
  `,
};

export const inputClasses = {
  default: `
    bg-neutral-50 dark:bg-neutral-900
    border border-neutral-300 dark:border-neutral-600
    text-neutral-900 dark:text-neutral-100
    placeholder:text-neutral-400 dark:placeholder:text-neutral-500
    rounded-lg px-4 py-2.5
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    transition-all duration-200
  `,
  
  error: `
    bg-red-50 dark:bg-red-900/20
    border border-red-300 dark:border-red-600
    text-red-900 dark:text-red-100
    placeholder:text-red-400 dark:placeholder:text-red-500
    rounded-lg px-4 py-2.5
    focus:ring-2 focus:ring-red-500 focus:border-red-500
  `,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getTheme = (isDark) => isDark ? darkTheme : lightTheme;

export const getButtonClass = (variant = 'primary', size = 'md') => {
  const sizeClasses = {
    sm: 'text-sm px-4 py-2',
    md: 'text-base px-6 py-3',
    lg: 'text-lg px-8 py-4',
  };
  
  return `${buttonClasses[variant]} ${sizeClasses[size]}`;
};

export const getStatusColor = (status, isDark = false) => {
  const theme = getTheme(isDark);
  
  const statusMap = {
    'nouveau': theme.info.main,
    'en_cours': theme.states.inProgress,
    'en_preparation': theme.warning.main,
    'pret_impression': theme.info.main,
    'en_impression': theme.primary.solid,
    'termine': theme.success.main,
    'livre': theme.success.dark,
    'echec': theme.error.main,
    'annule': theme.error.dark,
  };
  
  return statusMap[status] || theme.text.secondary;
};

export const getRoleTheme = (role) => {
  const themes = {
    admin: {
      gradient: 'from-purple-600 to-pink-600',
      color: '#9333ea',
      icon: '👑',
    },
    preparateur: {
      gradient: 'from-blue-600 to-cyan-500',
      color: '#0284c7',
      icon: '📋',
    },
    imprimeur_roland: {
      gradient: 'from-indigo-600 to-purple-600',
      color: '#6366f1',
      icon: '🖨️',
    },
    imprimeur_xerox: {
      gradient: 'from-violet-600 to-fuchsia-600',
      color: '#8b5cf6',
      icon: '⚡',
    },
    livreur: {
      gradient: 'from-orange-500 to-red-500',
      color: '#f97316',
      icon: '🚚',
    },
  };
  
  return themes[role] || themes.admin;
};

// ============================================================================
// CONFIGURATION CSS VARIABLES
// ============================================================================

export const generateCSSVariables = (theme) => {
  return {
    '--color-primary': theme.primary.solid,
    '--color-primary-light': theme.primary.light,
    '--color-accent': theme.accent.main,
    '--color-accent-hover': theme.accent.hover,
    '--color-success': theme.success.main,
    '--color-warning': theme.warning.main,
    '--color-error': theme.error.main,
    '--color-info': theme.info.main,
    '--color-text-primary': theme.text.primary,
    '--color-text-secondary': theme.text.secondary,
    '--color-bg-default': theme.background.default,
    '--color-bg-paper': theme.background.paper,
    '--color-bg-elevated': theme.background.elevated,
    '--color-border': theme.border.main,
    '--color-divider': theme.divider,
    '--shadow-sm': theme.shadow.sm,
    '--shadow-md': theme.shadow.md,
    '--shadow-lg': theme.shadow.lg,
    '--shadow-xl': theme.shadow.xl,
    '--shadow-glow': theme.shadow.glow,
  };
};

// ============================================================================
// ANIMATIONS
// ============================================================================

export const animations = {
  fadeIn: 'animate-fadeIn',
  slideUp: 'animate-slideUp',
  scaleIn: 'animate-scaleIn',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
  spin: 'animate-spin',
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  lightTheme,
  darkTheme,
  buttonClasses,
  cardClasses,
  inputClasses,
  getTheme,
  getButtonClass,
  getStatusColor,
  getRoleTheme,
  generateCSSVariables,
  animations,
};
