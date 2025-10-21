/**
 * CONFIGURATION API CENTRALISÉE
 * ==============================
 * 
 * Configuration uniforme pour toutes les requêtes API
 */

// Configuration de base de l'API
export const API_CONFIG = {
  // Utilise le proxy configuré dans package.json (/api -> http://localhost:5001/api)
  baseURL: process.env.REACT_APP_API_URL || '/api',
  
  // Configuration des timeouts
  timeout: 30000,
  
  // En-têtes par défaut
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
};

// URLs des endpoints principaux
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
  },
  dossiers: {
    list: '/dossiers',
    create: '/dossiers',
    get: (id) => `/dossiers/${id}`,
    update: (id) => `/dossiers/${id}`,
    delete: (id) => `/dossiers/${id}`,
    updateStatus: (id) => `/dossiers/${id}/statut`,
  },
  files: {
    list: '/files',
    upload: '/files/upload',
    download: (id) => `/files/${id}/download`,
    preview: (id) => `/files/${id}/preview`,
    thumbnail: (id) => `/files/${id}/thumbnail`,
    byDossier: (dossierId) => `/files/dossier/${dossierId}`,
  },
  users: '/users',
  statistics: '/statistiques',
  health: '/health',
};

// Configuration des tokens d'authentification
export const AUTH_CONFIG = {
  tokenKeys: ['auth_token', 'token'], // Clés possibles dans localStorage/sessionStorage
  headerName: 'Authorization',
  headerFormat: (token) => `Bearer ${token}`,
};

export default {
  API_CONFIG,
  API_ENDPOINTS,
  AUTH_CONFIG,
};