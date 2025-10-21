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
    icon: '🏙️'
  },
  [DELIVERY_ZONES.BANLIEUE]: {
    label: 'Banlieue',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: '🏘️'
  },
  [DELIVERY_ZONES.IDF]: {
    label: 'Île-de-France',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: '🌳'
  },
  [DELIVERY_ZONES.AUTRE]: {
    label: 'Autre région',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: '🗺️'
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
    icon: '⚡'
  },
  [PRIORITY_LEVELS.MEDIUM]: {
    label: 'Normal',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: '⏰'
  },
  [PRIORITY_LEVELS.LOW]: {
    label: 'Différé',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: '🟢'
  }
};

// ⚙️ Configuration par défaut
export const DEFAULT_CONFIG = {
  ITEMS_PER_PAGE: 12,
  DEFAULT_FILTER_STATUS: 'all',
  DEFAULT_FILTER_ZONE: 'all',
  AUTO_REFRESH_INTERVAL_MS: 30000,
  ENABLE_AUTO_REFRESH: false
};

// 📍 Détection de zone par code postal
export const getZoneFromPostalCode = (codePostal) => {
  if (!codePostal) return DELIVERY_ZONES.AUTRE;
  
  const code = String(codePostal).trim();
  if (code.startsWith('75')) return DELIVERY_ZONES.PARIS;
  if (['92', '93', '94'].some(prefix => code.startsWith(prefix))) return DELIVERY_ZONES.BANLIEUE;
  if (['77', '78', '91', '95'].some(prefix => code.startsWith(prefix))) return DELIVERY_ZONES.IDF;
  
  return DELIVERY_ZONES.AUTRE;
};

// 🏷️ Messages
export const MESSAGES = {
  LOADING: {
    DASHBOARD: 'Chargement du tableau de bord...',
    DOSSIERS: 'Chargement des dossiers...',
    SAVING: 'Enregistrement en cours...'
  },
  SUCCESS: {
    PROGRAMMED: 'Livraison programmée avec succès',
    DELIVERED: 'Livraison validée avec succès',
    UPDATED: 'Dossier mis à jour'
  },
  ERROR: {
    LOAD_FAILED: 'Erreur lors du chargement',
    SAVE_FAILED: 'Erreur lors de l enregistrement',
    NETWORK_ERROR: 'Erreur de connexion'
  },
  EMPTY_STATES: {
    NO_DELIVERIES: 'Aucune livraison à traiter',
    NO_RESULTS: 'Aucun résultat trouvé',
    NO_PROGRAMMED: 'Aucune livraison programmée',
    NO_COMPLETED: 'Aucune livraison terminée'
  }
};
