/**
 * 🚚 Constantes pour l'Interface Livreur V2
 * Centralisation de toutes les constantes, configurations et mappings
 */

// 📋 Statuts de livraison normalisés
export const DELIVERY_STATUS = {
  IMPRIME: 'imprime',
  PRET_LIVRAISON: 'pret_livraison',
  EN_LIVRAISON: 'en_livraison',
  LIVRE: 'livre',
  RETOUR: 'retour',
  ECHEC: 'echec_livraison',
  REPORTE: 'reporte',
  TERMINE: 'termine'
};

// 🎨 Configuration des badges de statut
export const STATUS_CONFIGS = {
  [DELIVERY_STATUS.IMPRIME]: {
    label: 'Imprimé',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: '🖨️'
  },
  [DELIVERY_STATUS.PRET_LIVRAISON]: {
    label: 'Prêt à livrer',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: '📦'
  },
  [DELIVERY_STATUS.EN_LIVRAISON]: {
    label: 'En livraison',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: '🚚'
  },
  [DELIVERY_STATUS.LIVRE]: {
    label: 'Livré',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: '✅'
  },
  [DELIVERY_STATUS.RETOUR]: {
    label: 'Retour',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: '↩️'
  },
  [DELIVERY_STATUS.ECHEC]: {
    label: 'Échec',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: '❌'
  },
  [DELIVERY_STATUS.REPORTE]: {
    label: 'Reporté',
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    icon: '⏰'
  }
};

// 🌍 Zones de livraison
export const DELIVERY_ZONES = {
  PARIS: 'paris',
  BANLIEUE: 'banlieue',
  IDF: 'idf',
  AUTRE: 'autre'
};

// 🗺️ Configuration des zones
export const ZONE_CONFIGS = {
  [DELIVERY_ZONES.PARIS]: {
    label: 'Paris',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    icon: '🏙️',
    estimatedTime: 45,
    estimatedDistance: 12
  },
  [DELIVERY_ZONES.BANLIEUE]: {
    label: 'Banlieue',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: '🏘️',
    estimatedTime: 60,
    estimatedDistance: 18
  },
  [DELIVERY_ZONES.IDF]: {
    label: 'Île-de-France',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: '🌳',
    estimatedTime: 90,
    estimatedDistance: 35
  },
  [DELIVERY_ZONES.AUTRE]: {
    label: 'Autre région',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: '🗺️',
    estimatedTime: 120,
    estimatedDistance: 50
  }
};

// ⚡ Niveaux de priorité
export const PRIORITY_LEVELS = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// 🔥 Configuration des priorités
export const PRIORITY_CONFIGS = {
  [PRIORITY_LEVELS.URGENT]: {
    label: 'URGENT',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: '🔥',
    pulse: true
  },
  [PRIORITY_LEVELS.HIGH]: {
    label: 'Priorité haute',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: '⚡',
    pulse: false
  },
  [PRIORITY_LEVELS.MEDIUM]: {
    label: 'Normal',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: '⏰',
    pulse: false
  },
  [PRIORITY_LEVELS.LOW]: {
    label: 'Différé',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: '🟢',
    pulse: false
  }
};

// 📊 Types de tri
export const SORT_TYPES = {
  DATE_DESC: 'date_desc',
  DATE_ASC: 'date_asc',
  CLIENT_ASC: 'client_asc',
  CLIENT_DESC: 'client_desc',
  MONTANT_DESC: 'montant_desc',
  MONTANT_ASC: 'montant_asc',
  PRIORITY: 'priority'
};

// 🔢 Configuration des tris
export const SORT_CONFIGS = {
  [SORT_TYPES.DATE_DESC]: {
    label: 'Plus récent',
    icon: '📅',
    field: 'created_at',
    direction: 'desc'
  },
  [SORT_TYPES.DATE_ASC]: {
    label: 'Plus ancien',
    icon: '📅',
    field: 'created_at',
    direction: 'asc'
  },
  [SORT_TYPES.CLIENT_ASC]: {
    label: 'Client (A-Z)',
    icon: '👤',
    field: 'client',
    direction: 'asc'
  },
  [SORT_TYPES.CLIENT_DESC]: {
    label: 'Client (Z-A)',
    icon: '👤',
    field: 'client',
    direction: 'desc'
  },
  [SORT_TYPES.MONTANT_DESC]: {
    label: 'Montant décroissant',
    icon: '💰',
    field: 'montant',
    direction: 'desc'
  },
  [SORT_TYPES.MONTANT_ASC]: {
    label: 'Montant croissant',
    icon: '💰',
    field: 'montant',
    direction: 'asc'
  },
  [SORT_TYPES.PRIORITY]: {
    label: 'Par priorité',
    icon: '⚡',
    field: 'priority',
    direction: 'desc'
  }
};

// 💳 Modes de paiement
export const PAYMENT_MODES = {
  CASH: 'especes',
  CARD: 'carte',
  CHECK: 'cheque',
  TRANSFER: 'virement',
  MOBILE: 'mobile'
};

// 💎 Configuration des modes de paiement
export const PAYMENT_CONFIGS = {
  [PAYMENT_MODES.CASH]: {
    label: 'Espèces',
    icon: '💵',
    color: 'green'
  },
  [PAYMENT_MODES.CARD]: {
    label: 'Carte bancaire',
    icon: '💳',
    color: 'blue'
  },
  [PAYMENT_MODES.CHECK]: {
    label: 'Chèque',
    icon: '📝',
    color: 'indigo'
  },
  [PAYMENT_MODES.TRANSFER]: {
    label: 'Virement',
    icon: '🏦',
    color: 'purple'
  },
  [PAYMENT_MODES.MOBILE]: {
    label: 'Paiement mobile',
    icon: '📱',
    color: 'orange'
  }
};

// ⏱️ Intervalles de temps
export const TIME_INTERVALS = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  THIS_MONTH: 'this_month',
  CUSTOM: 'custom'
};

// 🎨 Thème des couleurs
export const THEME_COLORS = {
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1'
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d'
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309'
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c'
  }
};

// 📱 Points de rupture responsive
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// ⚙️ Configuration par défaut
export const DEFAULT_CONFIG = {
  // Pagination
  ITEMS_PER_PAGE: 12,
  ITEMS_PER_PAGE_OPTIONS: [6, 12, 24, 48],
  
  // Filtres
  DEFAULT_FILTER_STATUS: 'all',
  DEFAULT_FILTER_ZONE: 'all',
  DEFAULT_SORT: SORT_TYPES.DATE_DESC,
  
  // Recherche
  SEARCH_DEBOUNCE_MS: 300,
  MIN_SEARCH_LENGTH: 2,
  
  // Notifications
  TOAST_DURATION_MS: 5000,
  TOAST_AUTO_CLOSE: true,
  
  // Animations
  ANIMATION_DURATION_MS: 300,
  STAGGER_DELAY_MS: 100,
  
  // Rafraîchissement auto
  AUTO_REFRESH_INTERVAL_MS: 30000,
  ENABLE_AUTO_REFRESH: false
};

// 📍 Fonctions utilitaires pour les codes postaux
export const getZoneFromPostalCode = (codePostal) => {
  if (!codePostal) return DELIVERY_ZONES.AUTRE;
  
  const code = String(codePostal).trim();
  if (code.startsWith('75')) return DELIVERY_ZONES.PARIS;
  if (['92', '93', '94'].some(prefix => code.startsWith(prefix))) return DELIVERY_ZONES.BANLIEUE;
  if (['77', '78', '91', '95'].some(prefix => code.startsWith(prefix))) return DELIVERY_ZONES.IDF;
  
  return DELIVERY_ZONES.AUTRE;
};

// 🏷️ Messages et textes
export const MESSAGES = {
  LOADING: {
    DASHBOARD: 'Chargement du tableau de bord...',
    DOSSIERS: 'Chargement des dossiers...',
    SAVING: 'Enregistrement en cours...',
    UPDATING: 'Mise à jour...'
  },
  SUCCESS: {
    PROGRAMMED: 'Livraison programmée avec succès',
    DELIVERED: 'Livraison validée avec succès',
    UPDATED: 'Dossier mis à jour',
    REFRESHED: 'Données actualisées'
  },
  ERROR: {
    LOAD_FAILED: 'Erreur lors du chargement',
    SAVE_FAILED: 'Erreur lors de l\'enregistrement',
    NETWORK_ERROR: 'Erreur de connexion',
    UNKNOWN_ERROR: 'Une erreur inattendue s\'est produite'
  },
  EMPTY_STATES: {
    NO_DELIVERIES: 'Aucune livraison à traiter',
    NO_RESULTS: 'Aucun résultat trouvé',
    NO_PROGRAMMED: 'Aucune livraison programmée',
    NO_COMPLETED: 'Aucune livraison terminée'
  }
};