/**
 * UTILITAIRE D'AUTHENTIFICATION
 * ==============================
 * 
 * Fonctions utilitaires pour la gestion de l'authentification
 */

import { AUTH_CONFIG } from '../config/api';

/**
 * Vérifier si l'utilisateur est connecté
 */
export const isAuthenticated = () => {
  const token = getAuthToken();
  return !!token && token.length > 0;
};

/**
 * Obtenir le token d'authentification depuis le stockage local
 */
export const getAuthToken = () => {
  // Vérifier dans localStorage puis sessionStorage
  for (const key of AUTH_CONFIG.tokenKeys) {
    const token = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (token && token.trim().length > 0) {
      return token.trim();
    }
  }
  return null;
};

/**
 * Sauvegarder le token d'authentification
 */
export const setAuthToken = (token) => {
  if (!token) return;
  
  // Sauvegarder dans localStorage avec la clé principale
  localStorage.setItem('auth_token', token);
  localStorage.setItem('token', token); // Compatibilité
  
  // Optionnellement dans sessionStorage pour les sessions temporaires
  sessionStorage.setItem('auth_token', token);
};

/**
 * Supprimer le token d'authentification
 */
export const clearAuthToken = () => {
  // Nettoyer toutes les clés possibles
  AUTH_CONFIG.tokenKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  // Nettoyer également les données utilisateur
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

/**
 * Obtenir les en-têtes d'authentification pour les requêtes
 */
export const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

/**
 * Rediriger vers la page de connexion
 */
export const redirectToLogin = () => {
  // Nettoyer les tokens expirés
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('auth_token');
  
  // Redirection
  window.location.href = '/login';
};

/**
 * Gérer les erreurs d'authentification
 */
export const handleAuthError = (error, setError) => {
  console.error('🔐 Erreur d\'authentification:', error);
  
  if (error.status === 401 || 
      error.message?.includes('401') || 
      error.message?.includes('Unauthorized')) {
    
    setError('Session expirée - Veuillez vous reconnecter');
    return 'auth_expired';
  }
  
  return 'other_error';
};

/**
 * Wrapper pour les appels API avec gestion d'auth
 */
export const apiCallWithAuth = async (url, options = {}) => {
  // S'assurer que l'utilisateur est connecté
  if (!isAuthenticated()) {
    throw new Error('Utilisateur non connecté');
  }

  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  };
  
  try {
    console.log('🔗 Appel API avec auth:', url);
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Gestion des erreurs d'authentification
    if (response.status === 401) {
      clearAuthToken();
      throw new Error('Session expirée - Veuillez vous reconnecter');
    }
    
    if (response.status === 403) {
      throw new Error('Accès refusé - Permissions insuffisantes');
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Erreur appel API avec auth:', error);
    throw error;
  }
};

// Export par défaut
export default {
  isAuthenticated,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getAuthHeaders,
  redirectToLogin,
  handleAuthError,
  apiCallWithAuth
};