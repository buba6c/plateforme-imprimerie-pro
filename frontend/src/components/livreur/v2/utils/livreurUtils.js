/**
 * 🛠️ Utilitaires pour l'Interface Livreur V2
 * Fonctions de traitement, filtrage, tri et enrichissement des données
 */

import { 
  DELIVERY_STATUS, 
  STATUS_CONFIGS, 
  DELIVERY_ZONES,
  getZoneFromPostalCode 
} from './livreurConstants';

/**
 * Enrichit les données d'un dossier avec des métadonnées calculées
 */
export const enrichDossierData = (dossier) => {
  if (!dossier) return null;

  const zone = getZoneFromPostalCode(dossier.code_postal || dossier.codePostal);
  const isUrgent = dossier.priorite === 'urgent' || dossier.priority === 'urgent';
  const isLate = dossier.date_limite && new Date(dossier.date_limite) < new Date();

  return {
    ...dossier,
    zone,
    isUrgent,
    isLate,
    displayName: dossier.nom_client || dossier.client || 'Client inconnu',
    displayStatus: STATUS_CONFIGS[dossier.statut]?.label || dossier.statut,
    adresseComplete: formatAdresse(dossier)
  };
};

/**
 * Formate une adresse complète
 */
export const formatAdresse = (dossier) => {
  if (!dossier) return '';
  
  const parts = [
    dossier.adresse_livraison || dossier.adresse,
    dossier.code_postal || dossier.codePostal,
    dossier.ville_livraison || dossier.ville
  ].filter(Boolean);
  
  return parts.join(', ');
};

/**
 * Calcule les statistiques de livraison
 */
export const calculateDeliveryStats = (dossiers = []) => {
  const enrichedDossiers = dossiers.map(enrichDossierData);

  return {
    total: dossiers.length,
    aLivrer: enrichedDossiers.filter(d => 
      d.statut === DELIVERY_STATUS.PRET_LIVRAISON
    ).length,
    programmees: enrichedDossiers.filter(d => 
      d.statut === DELIVERY_STATUS.EN_LIVRAISON
    ).length,
    livrees: enrichedDossiers.filter(d => 
      d.statut === DELIVERY_STATUS.LIVRE
    ).length,
    enRetard: enrichedDossiers.filter(d => d.isLate).length,
    urgents: enrichedDossiers.filter(d => d.isUrgent).length
  };
};

/**
 * Filtre les dossiers selon les critères
 */
export const filterDossiers = (dossiers, filters) => {
  if (!dossiers || !Array.isArray(dossiers)) return [];

  let filtered = dossiers.map(enrichDossierData);

  // Filtre par statut
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(d => d.statut === filters.status);
  }

  // Filtre par zone
  if (filters.zone && filters.zone !== 'all') {
    filtered = filtered.filter(d => d.zone === filters.zone);
  }

  // Filtre par recherche
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(d => 
      (d.displayName || '').toLowerCase().includes(searchLower) ||
      (d.reference || '').toLowerCase().includes(searchLower) ||
      (d.adresseComplete || '').toLowerCase().includes(searchLower)
    );
  }

  // Filtre par priorité
  if (filters.priority && filters.priority !== 'all') {
    filtered = filtered.filter(d => d.priorite === filters.priority || d.priority === filters.priority);
  }

  return filtered;
};

/**
 * Trie les dossiers
 */
export const sortDossiers = (dossiers, sortBy = 'date_desc') => {
  if (!dossiers || !Array.isArray(dossiers)) return [];

  const sorted = [...dossiers];

  switch (sortBy) {
    case 'date_desc':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    case 'date_asc':
      return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    case 'client_asc':
      return sorted.sort((a, b) => 
        (a.nom_client || a.client || '').localeCompare(b.nom_client || b.client || '')
      );
    
    case 'client_desc':
      return sorted.sort((a, b) => 
        (b.nom_client || b.client || '').localeCompare(a.nom_client || a.client || '')
      );
    
    case 'priority': {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return sorted.sort((a, b) => {
        const priorityA = priorityOrder[a.priorite || a.priority] ?? 999;
        const priorityB = priorityOrder[b.priorite || b.priority] ?? 999;
        return priorityA - priorityB;
      });
    }
    
    default:
      return sorted;
  }
};

/**
 * Formate une date
 */
export const formatDate = (date, format = 'short') => {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const options = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }
  };

  return d.toLocaleString('fr-FR', options[format] || options.short);
};

/**
 * Formate un montant en devise
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '';
  
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

/**
 * Génère une URL Google Maps
 */
export const generateMapsUrl = (dossier) => {
  if (!dossier) return '';
  
  const adresse = formatAdresse(dossier);
  if (!adresse) return '';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
};

/**
 * Génère une URL tel:
 */
export const generatePhoneUrl = (phone) => {
  if (!phone) return '';
  return `tel:${phone.replace(/\s/g, '')}`;
};

/**
 * Valide les données de livraison
 */
export const validateDeliveryData = (data) => {
  const errors = [];

  if (!data.date_livraison) {
    errors.push('La date de livraison est obligatoire');
  }

  if (!data.adresse_livraison && !data.adresse) {
    errors.push('L adresse de livraison est obligatoire');
  }

  if (data.date_livraison) {
    const deliveryDate = new Date(data.date_livraison);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deliveryDate < today) {
      errors.push('La date de livraison ne peut pas être dans le passé');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Groupe les dossiers par critère
 */
export const groupDossiersByCriteria = (dossiers, criteria = 'zone') => {
  if (!dossiers || !Array.isArray(dossiers)) return {};

  const enriched = dossiers.map(enrichDossierData);

  switch (criteria) {
    case 'zone':
      return enriched.reduce((acc, dossier) => {
        const zone = dossier.zone || 'autre';
        if (!acc[zone]) acc[zone] = [];
        acc[zone].push(dossier);
        return acc;
      }, {});

    case 'priority':
      return enriched.reduce((acc, dossier) => {
        const priority = dossier.priorite || dossier.priority || 'medium';
        if (!acc[priority]) acc[priority] = [];
        acc[priority].push(dossier);
        return acc;
      }, {});

    case 'status':
      return enriched.reduce((acc, dossier) => {
        const status = dossier.statut || 'unknown';
        if (!acc[status]) acc[status] = [];
        acc[status].push(dossier);
        return acc;
      }, {});

    default:
      return { all: enriched };
  }
};

/**
 * Formate une durée en minutes en format lisible
 */
export const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0min';
  
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h${mins}`;
};
