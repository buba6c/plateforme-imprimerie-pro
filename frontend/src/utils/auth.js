
/**
 * Utilitaires d'authentification centralisés
 * Créé automatiquement le 2025-10-06T11:53:49.826Z
 */

/**
 * Récupérer le token d'authentification depuis le stockage
 * @returns {string|null} Token d'authentification ou null
 */
export const getAuthToken = () => {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
};

/**
 * Stocker le token d'authentification
 * @param {string} token Token à stocker
 */
export const setAuthToken = (token) => {
  localStorage.setItem('auth_token', token);
};

/**
 * Supprimer le token d'authentification
 */
export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
};

/**
 * Générer les headers d'autorisation pour les requêtes API
 * @returns {Object} Headers avec autorisation ou objet vide
 */
export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Vérifier si l'utilisateur est connecté
 * @returns {boolean} True si un token existe
 */
export const isAuthenticated = () => {
  return !!getAuthToken();
};
