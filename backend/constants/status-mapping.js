// ================================================
// MAPPING CENTRALISÉ DES STATUTS
// ================================================
// Ce fichier unique définit la correspondance entre:
// - Les codes utilisés dans le frontend (snake_case)
// - Les libellés stockés en base de données (français avec accents)
// - Les libellés affichés à l'utilisateur

/**
 * Statuts valides dans la base de données
 * Ces valeurs correspondent à la contrainte dossiers_statut_valide
 */
const DB_STATUTS = {
  EN_COURS: 'En cours',
  A_REVOIR: 'À revoir',
  PRET_IMPRESSION: 'Prêt impression',
  EN_IMPRESSION: 'En impression',
  IMPRIME: 'Imprimé',
  TERMINE: 'Terminé',
  PRET_LIVRAISON: 'Prêt livraison',
  EN_LIVRAISON: 'En livraison',
  LIVRE: 'Livré',
};

/**
 * Codes statuts utilisés dans le frontend/API
 */
const API_STATUTS = {
  EN_COURS: 'en_cours',
  A_REVOIR: 'a_revoir',
  PRET_IMPRESSION: 'pret_impression',
  EN_IMPRESSION: 'en_impression',
  IMPRIME: 'imprime',
  TERMINE: 'termine',
  PRET_LIVRAISON: 'pret_livraison',
  EN_LIVRAISON: 'en_livraison',
  LIVRE: 'livre',
};

/**
 * Mapping: Code API → Valeur DB
 */
const API_TO_DB = {
  en_cours: 'En cours',
  a_revoir: 'À revoir',
  pret_impression: 'Prêt impression',
  en_impression: 'En impression',
  imprime: 'Imprimé',
  termine: 'Terminé',
  pret_livraison: 'Prêt livraison',
  en_livraison: 'En livraison',
  livre: 'Livré',
};

/**
 * Mapping: Valeur DB → Code API
 */
const DB_TO_API = {
  'En cours': 'en_cours',
  'À revoir': 'a_revoir',
  'Prêt impression': 'pret_impression',
  'Pret impression': 'pret_impression', // Alias sans accent
  'En impression': 'en_impression',
  'Imprimé': 'imprime',
  'Terminé': 'termine',
  'Prêt livraison': 'pret_livraison',
  'pret_livraison': 'pret_livraison',
  'En livraison': 'en_livraison',
  'Livré': 'livre',
};

/**
 * Normalise un statut venant du frontend vers le format DB
 * @param {string} statusCode - Code du statut (en_cours, a_revoir, etc.)
 * @returns {string} Valeur pour la base de données
 */
function normalizeToDb(statusCode) {
  if (!statusCode) return DB_STATUTS.EN_COURS;
  
  const normalized = String(statusCode).toLowerCase().trim();
  
  // Si c'est déjà un libellé DB valide, le retourner
  if (Object.values(DB_STATUTS).includes(statusCode)) {
    return statusCode;
  }
  
  // Mapping depuis code API
  if (API_TO_DB[normalized]) {
    return API_TO_DB[normalized];
  }
  
  // Fallback: tentative de parsing
  const fallbackMap = {
    'cours': DB_STATUTS.EN_COURS,
    'preparation': DB_STATUTS.EN_COURS,
    'revoir': DB_STATUTS.A_REVOIR,
    'revision': DB_STATUTS.A_REVOIR,
    'pret': normalized.includes('livr') ? DB_STATUTS.PRET_LIVRAISON : DB_STATUTS.PRET_IMPRESSION,
    'impression': normalized.includes('pret') ? DB_STATUTS.PRET_IMPRESSION : DB_STATUTS.EN_IMPRESSION,
    'imprime': DB_STATUTS.IMPRIME,
    'fini': DB_STATUTS.TERMINE,
    'termine': DB_STATUTS.TERMINE,
    'completed': DB_STATUTS.TERMINE,
    'livraison': normalized.includes('pret') ? DB_STATUTS.PRET_LIVRAISON : DB_STATUTS.EN_LIVRAISON,
    'livre': DB_STATUTS.LIVRE,
    'delivered': DB_STATUTS.LIVRE,
  };
  
  for (const [key, value] of Object.entries(fallbackMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  // Si aucune correspondance, retourner le statut par défaut
  console.warn(`⚠️  Statut non reconnu: "${statusCode}", utilisation de "En cours" par défaut`);
  return DB_STATUTS.EN_COURS;
}

/**
 * Normalise un statut venant de la DB vers le format API/Frontend
 * @param {string} dbStatus - Statut depuis la base de données
 * @returns {string} Code pour l'API/Frontend
 */
function normalizeFromDb(dbStatus) {
  if (!dbStatus) return API_STATUTS.EN_COURS;
  
  const normalized = String(dbStatus).trim();
  
  // Si c'est déjà un code API valide, le retourner
  if (Object.values(API_STATUTS).includes(normalized)) {
    return normalized;
  }
  
  // Mapping depuis valeur DB
  if (DB_TO_API[normalized]) {
    return DB_TO_API[normalized];
  }
  
  // Fallback: conversion snake_case
  return normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Vérifie si un statut est valide pour la base de données
 * @param {string} status - Statut à vérifier
 * @returns {boolean}
 */
function isValidDbStatus(status) {
  return Object.values(DB_STATUTS).includes(status);
}

/**
 * Vérifie si un code statut API est valide
 * @param {string} statusCode - Code à vérifier
 * @returns {boolean}
 */
function isValidApiStatus(statusCode) {
  return Object.values(API_STATUTS).includes(statusCode);
}

/**
 * Obtient le libellé d'affichage pour un statut
 * @param {string} status - Statut (code API ou valeur DB)
 * @returns {string}
 */
function getDisplayLabel(status) {
  // Si c'est un code API, le convertir en DB
  if (isValidApiStatus(status)) {
    return API_TO_DB[status];
  }
  
  // Si c'est déjà un libellé DB, le retourner
  if (isValidDbStatus(status)) {
    return status;
  }
  
  // Sinon, normaliser d'abord
  return normalizeToDb(status);
}

/**
 * Liste de tous les statuts valides (format DB)
 */
function getAllDbStatuses() {
  return Object.values(DB_STATUTS);
}

/**
 * Liste de tous les codes statuts valides (format API)
 */
function getAllApiStatuses() {
  return Object.values(API_STATUTS);
}

module.exports = {
  // Constantes
  DB_STATUTS,
  API_STATUTS,
  API_TO_DB,
  DB_TO_API,
  
  // Fonctions de normalisation
  normalizeToDb,
  normalizeFromDb,
  
  // Fonctions de validation
  isValidDbStatus,
  isValidApiStatus,
  
  // Fonctions utilitaires
  getDisplayLabel,
  getAllDbStatuses,
  getAllApiStatuses,
};
