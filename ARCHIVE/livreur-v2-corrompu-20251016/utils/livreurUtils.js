/**
 * 🛠️ Utilitaires pour l'Interface Livreur V2
 * Fonctions helper, transformations de données et logique métier
 */

import {
  DELIVERY_STATUS,
  DELIVERY_ZONES,
  PRIORITY_LEVELS,
  ZONE_CONFIGS,
  getZoneFromPostalCode
} from './livreurConstants';

/**
 * 📋 Normalisation du statut de livraison
 * Convertit différents formats de statuts en format standardisé
 */
export const normalizeDeliveryStatus = (statut) => {
  if (!statut) return DELIVERY_STATUS.IMPRIME;
  
  const val = String(statut).toLowerCase().trim();
  
  // Mappings spécifiques
  if (val === 'terminé' || val === 'termine' || val === 'fini') {
    return DELIVERY_STATUS.TERMINE;
  }
  if (val === 'imprimé' || val === 'imprime') {
    return DELIVERY_STATUS.IMPRIME;
  }
  if (val.includes('pret') && val.includes('livraison')) {
    return DELIVERY_STATUS.PRET_LIVRAISON;
  }
  if (val.includes('livraison') && !val.includes('pret')) {
    return DELIVERY_STATUS.EN_LIVRAISON;
  }
  if (val === 'livré' || val === 'livre' || val === 'delivered') {
    return DELIVERY_STATUS.LIVRE;
  }
  if (val.includes('retour') || val.includes('return')) {
    return DELIVERY_STATUS.RETOUR;
  }
  if (val.includes('echec') || val.includes('failed')) {
    return DELIVERY_STATUS.ECHEC;
  }
  if (val.includes('reporte') || val.includes('postponed')) {
    return DELIVERY_STATUS.REPORTE;
  }
  
  // Fallback - normaliser les espaces
  return val.replace(/\\s/g, '_');
};

/**
 * ⚡ Calcul de la priorité de livraison
 * Détermine la priorité basée sur la date de livraison et l'âge du dossier
 */
export const calculateDeliveryPriority = (dossier) => {
  const now = new Date();
  const created = new Date(dossier.created_at);
  const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
  
  // Priorité basée sur la date de livraison prévue
  if (dossier.date_livraison_prevue) {
    const datePrevu = new Date(dossier.date_livraison_prevue);
    const diffPrevu = (datePrevu - now) / (1000 * 60 * 60 * 24);
    
    if (diffPrevu < 0) return PRIORITY_LEVELS.URGENT; // En retard
    if (diffPrevu < 1) return PRIORITY_LEVELS.HIGH;    // Livraison aujourd'hui
    if (diffPrevu < 2) return PRIORITY_LEVELS.MEDIUM;  // Livraison demain
  }
  
  // Priorité basée sur l'âge du dossier
  if (daysDiff > 7) return PRIORITY_LEVELS.HIGH;
  if (daysDiff > 3) return PRIORITY_LEVELS.MEDIUM;
  
  return PRIORITY_LEVELS.LOW;
};

/**
 * 🌍 Enrichissement des données de dossier
 * Ajoute toutes les informations calculées nécessaires pour l'affichage
 */
export const enrichDossierData = (dossier) => {
  const deliveryStatus = normalizeDeliveryStatus(dossier.statut || dossier.status);
  const deliveryPriority = calculateDeliveryPriority(dossier);
  const deliveryZone = getZoneFromPostalCode(
    dossier.code_postal_livraison || dossier.code_postal
  );
  
  const zoneConfig = ZONE_CONFIGS[deliveryZone] || ZONE_CONFIGS[DELIVERY_ZONES.AUTRE];
  
  return {
    ...dossier,
    
    // Statuts normalisés
    deliveryStatus,
    deliveryPriority,
    deliveryZone,
    
    // Flags utiles
    isUrgentDelivery: deliveryPriority === PRIORITY_LEVELS.URGENT,
    isHighPriority: [PRIORITY_LEVELS.URGENT, PRIORITY_LEVELS.HIGH].includes(deliveryPriority),
    
    // Informations d'affichage
    displayNumber: dossier.numero_commande || 
                   dossier.numero_dossier || 
                   dossier.numero || 
                   `Dossier ${dossier.id?.toString()?.slice(-8) || 'N/A'}`,
                   
    displayClient: dossier.client_nom || 
                   dossier.client || 
                   dossier.nom_client || 
                   dossier.client_name || 
                   'Client inconnu',
                   
    displayAdresse: dossier.adresse_livraison || 
                    dossier.adresse_client || 
                    'Adresse non renseignée',
                    
    displayTelephone: dossier.telephone_livraison || 
                      dossier.telephone_client || 
                      dossier.telephone || 
                      '',
    
    // Estimations de livraison
    estimatedDeliveryTime: zoneConfig.estimatedTime,
    estimatedDistance: zoneConfig.estimatedDistance,
    
    // Montants
    displayMontant: dossier.montant_prevu || dossier.montant || 0,
    displayMontantEncaisse: dossier.montant_encaisse || 0,
    
    // Dates formatées
    displayDateCreation: formatDate(dossier.created_at),
    displayDateLivraisonPrevue: formatDate(dossier.date_livraison_prevue),
    displayDateLivraison: formatDate(dossier.date_livraison),
  };
};

/**
 * 📊 Calcul des statistiques de livraison
 * Génère les KPI pour le tableau de bord
 */
export const calculateDeliveryStats = (dossiersList) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const stats = {
    // Compteurs principaux
    aLivrer: dossiersList.filter(d => 
      [DELIVERY_STATUS.IMPRIME, DELIVERY_STATUS.PRET_LIVRAISON].includes(d.deliveryStatus)
    ).length,
    
    programmees: dossiersList.filter(d => 
      d.deliveryStatus === DELIVERY_STATUS.EN_LIVRAISON
    ).length,
    
    livrees: dossiersList.filter(d => 
      d.deliveryStatus === DELIVERY_STATUS.LIVRE
    ).length,
    
    livreesAujourdhui: dossiersList.filter(d => {
      const updated = new Date(d.updated_at || d.date_livraison || d.created_at);
      return d.deliveryStatus === DELIVERY_STATUS.LIVRE && updated >= today;
    }).length,
    
    retours: dossiersList.filter(d => 
      [DELIVERY_STATUS.RETOUR, DELIVERY_STATUS.ECHEC, DELIVERY_STATUS.REPORTE].includes(d.deliveryStatus)
    ).length,
    
    urgent: dossiersList.filter(d => d.isUrgentDelivery).length,
    
    // Montants
    encaisseAujourdhui: dossiersList
      .filter(d => {
        const updated = new Date(d.updated_at || d.date_livraison || d.created_at);
        return d.deliveryStatus === DELIVERY_STATUS.LIVRE && updated >= today;
      })
      .reduce((sum, d) => sum + (parseFloat(d.displayMontantEncaisse) || 0), 0),
      
    encaisseMois: dossiersList
      .filter(d => {
        const updated = new Date(d.updated_at || d.date_livraison || d.created_at);
        return d.deliveryStatus === DELIVERY_STATUS.LIVRE && updated >= monthStart;
      })
      .reduce((sum, d) => sum + (parseFloat(d.displayMontantEncaisse) || 0), 0),
    
    // Estimations
    estimatedKmTotal: dossiersList
      .filter(d => [DELIVERY_STATUS.PRET_LIVRAISON, DELIVERY_STATUS.EN_LIVRAISON].includes(d.deliveryStatus))
      .reduce((sum, d) => sum + d.estimatedDistance, 0),
      
    estimatedTimeTotal: dossiersList
      .filter(d => [DELIVERY_STATUS.PRET_LIVRAISON, DELIVERY_STATUS.EN_LIVRAISON].includes(d.deliveryStatus))
      .reduce((sum, d) => sum + d.estimatedDeliveryTime, 0),
    
    // Taux de réussite
    tauxReussite: (() => {
      const totalLivraisons = dossiersList.filter(d => 
        [DELIVERY_STATUS.LIVRE, DELIVERY_STATUS.RETOUR, DELIVERY_STATUS.ECHEC].includes(d.deliveryStatus)
      ).length;
      const livraissonsReussies = dossiersList.filter(d => 
        d.deliveryStatus === DELIVERY_STATUS.LIVRE
      ).length;
      
      return totalLivraisons > 0 ? Math.round((livraissonsReussies / totalLivraisons) * 100) : 100;
    })(),
    
    // Répartition par zone
    zonesStats: Object.values(DELIVERY_ZONES).reduce((acc, zone) => {
      acc[zone] = dossiersList.filter(d => d.deliveryZone === zone).length;
      return acc;
    }, {})
  };
  
  return stats;
};

/**
 * 🔍 Filtrage et recherche des dossiers
 * Applique tous les filtres et la recherche
 */
export const filterDossiers = (dossiers, filters) => {
  const {
    searchTerm = '',
    filterStatus = 'all',
    filterZone = 'all',
    filterPriority = 'all',
    dateFrom = null,
    dateTo = null,
    sortBy = 'date_desc'
  } = filters;
  
  let filtered = [...dossiers];
  
  // Recherche textuelle
  if (searchTerm && searchTerm.length >= 2) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter(dossier =>
      dossier.displayNumber.toLowerCase().includes(searchLower) ||
      dossier.displayClient.toLowerCase().includes(searchLower) ||
      dossier.displayAdresse.toLowerCase().includes(searchLower) ||
      dossier.displayTelephone.includes(searchTerm)
    );
  }
  
  // Filtre par statut
  if (filterStatus !== 'all') {
    filtered = filtered.filter(dossier => dossier.deliveryStatus === filterStatus);
  }
  
  // Filtre par zone
  if (filterZone !== 'all') {
    filtered = filtered.filter(dossier => dossier.deliveryZone === filterZone);
  }
  
  // Filtre par priorité
  if (filterPriority !== 'all') {
    filtered = filtered.filter(dossier => dossier.deliveryPriority === filterPriority);
  }
  
  // Filtre par période
  if (dateFrom || dateTo) {
    filtered = filtered.filter(dossier => {
      const dossierDate = new Date(dossier.created_at);
      
      if (dateFrom && dossierDate < new Date(dateFrom)) return false;
      if (dateTo && dossierDate > new Date(dateTo)) return false;
      
      return true;
    });
  }
  
  // Tri
  filtered = sortDossiers(filtered, sortBy);
  
  return filtered;
};

/**
 * 📊 Tri des dossiers
 * Applique le tri selon le critère choisi
 */
export const sortDossiers = (dossiers, sortBy) => {
  const sorted = [...dossiers];
  
  switch (sortBy) {
    case 'date_desc':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
    case 'date_asc':
      return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
    case 'client_asc':
      return sorted.sort((a, b) => a.displayClient.localeCompare(b.displayClient));
      
    case 'client_desc':
      return sorted.sort((a, b) => b.displayClient.localeCompare(a.displayClient));
      
    case 'montant_desc':
      return sorted.sort((a, b) => (b.displayMontant || 0) - (a.displayMontant || 0));
      
    case 'montant_asc':
      return sorted.sort((a, b) => (a.displayMontant || 0) - (b.displayMontant || 0));
      
    case 'priority':
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return sorted.sort((a, b) => 
        (priorityOrder[b.deliveryPriority] || 0) - (priorityOrder[a.deliveryPriority] || 0)
      );
      
    default:
      return sorted;
  }
};

/**
 * 📅 Formatage des dates
 * Formate les dates pour l'affichage
 */
export const formatDate = (date, options = {}) => {
  if (!date) return null;
  
  const {
    format = 'short', // short | long | time | datetime
    locale = 'fr-FR'
  } = options;
  
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) return null;
  
  switch (format) {
    case 'long':
      return dateObj.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
    case 'time':
      return dateObj.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      });
      
    case 'datetime':
      return dateObj.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
    case 'short':
    default:
      return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
  }
};

/**
 * 💰 Formatage des montants
 * Formate les montants avec la devise
 */
export const formatCurrency = (amount, currency = 'CFA') => {
  if (!amount && amount !== 0) return '0 CFA';
  
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return `${formatter.format(amount)} ${currency}`;
};

/**
 * ⏱️ Formatage des durées
 * Convertit les minutes en format lisible
 */
export const formatDuration = (minutes) => {
  if (!minutes) return '0 min';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  }
  
  return `${mins} min`;
};

/**
 * 📍 Génération d'URL Google Maps
 * Crée un lien de navigation vers l'adresse
 */
export const generateMapsUrl = (dossier) => {
  let address = dossier.displayAdresse || '';
  
  if (!address || address === 'Adresse non renseignée') {
    address = `${dossier.displayClient}, Paris`;
  }
  
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
};

/**
 * 📱 Génération d'URL pour appel téléphonique
 * Crée un lien tel: pour mobile
 */
export const generatePhoneUrl = (telephone) => {
  if (!telephone) return null;
  
  const cleanPhone = telephone.replace(/[^\\d+]/g, '');
  return cleanPhone ? `tel:${cleanPhone}` : null;
};

/**
 * 🔄 Debounce pour la recherche
 * Optimise les appels de recherche
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * 📊 Groupement des dossiers par critère
 * Groupe les dossiers pour l'affichage en sections
 */
export const groupDossiersByCriteria = (dossiers, criteria = 'status') => {
  switch (criteria) {
    case 'status':
      return {
        aLivrer: dossiers.filter(d => 
          [DELIVERY_STATUS.IMPRIME, DELIVERY_STATUS.PRET_LIVRAISON].includes(d.deliveryStatus)
        ),
        programmees: dossiers.filter(d => 
          d.deliveryStatus === DELIVERY_STATUS.EN_LIVRAISON
        ),
        livrees: dossiers.filter(d => 
          d.deliveryStatus === DELIVERY_STATUS.LIVRE
        ),
        retours: dossiers.filter(d => 
          [DELIVERY_STATUS.RETOUR, DELIVERY_STATUS.ECHEC, DELIVERY_STATUS.REPORTE].includes(d.deliveryStatus)
        )
      };
      
    case 'priority':
      return {
        urgent: dossiers.filter(d => d.deliveryPriority === PRIORITY_LEVELS.URGENT),
        high: dossiers.filter(d => d.deliveryPriority === PRIORITY_LEVELS.HIGH),
        medium: dossiers.filter(d => d.deliveryPriority === PRIORITY_LEVELS.MEDIUM),
        low: dossiers.filter(d => d.deliveryPriority === PRIORITY_LEVELS.LOW)
      };
      
    case 'zone':
      return Object.values(DELIVERY_ZONES).reduce((acc, zone) => {
        acc[zone] = dossiers.filter(d => d.deliveryZone === zone);
        return acc;
      }, {});
      
    default:
      return { all: dossiers };
  }
};

/**
 * ⚡ Validation des données
 * Valide les champs requis pour les actions
 */
export const validateDeliveryData = (action, data) => {
  const errors = {};
  
  switch (action) {
    case 'programmer':
      if (!data.date_livraison_prevue) {
        errors.date_livraison_prevue = 'La date de livraison est requise';
      }
      if (!data.adresse_livraison || data.adresse_livraison.trim() === '') {
        errors.adresse_livraison = 'L\'adresse de livraison est requise';
      }
      break;
      
    case 'valider':
      if (!data.montant_encaisse || data.montant_encaisse <= 0) {
        errors.montant_encaisse = 'Le montant encaissé est requis';
      }
      if (!data.mode_paiement) {
        errors.mode_paiement = 'Le mode de paiement est requis';
      }
      break;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};