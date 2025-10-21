/**
 * SERVICE D'AUTHENTIFICATION
 * ===========================
 * 
 * Service centralisé pour toutes les opérations d'authentification
 */

import { API_ENDPOINTS } from '../config/api';
import { 
  getAuthToken, 
  setAuthToken, 
  clearAuthToken, 
  getAuthHeaders,
  apiCallWithAuth 
} from '../utils/authUtils';

class AuthService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || '/api';
  }

  /**
   * Connexion utilisateur
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseURL}${API_ENDPOINTS.auth.login}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      // Sauvegarder le token et les données utilisateur
      if (data.token) {
        setAuthToken(data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      return { success: true, user: data.user, token: data.token };
      
    } catch (error) {
      console.error('❌ Erreur login:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Déconnexion utilisateur
   */
  async logout() {
    try {
      // Appel API de déconnexion (optionnel selon l'implémentation backend)
      if (getAuthToken()) {
        await apiCallWithAuth(`${this.baseURL}${API_ENDPOINTS.auth.logout}`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.warn('⚠️  Erreur lors de la déconnexion API:', error.message);
    } finally {
      // Nettoyer les données locales dans tous les cas
      clearAuthToken();
    }
  }

  /**
   * Récupérer les informations de l'utilisateur connecté
   */
  async getCurrentUser() {
    try {
      const response = await apiCallWithAuth(`${this.baseURL}${API_ENDPOINTS.auth.me}`);
      const data = await response.json();
      
      // Mettre à jour les données utilisateur stockées
      localStorage.setItem('user', JSON.stringify(data.user));
      
      return { success: true, user: data.user };
      
    } catch (error) {
      console.error('❌ Erreur récupération utilisateur:', error);
      
      if (error.message.includes('Session expirée')) {
        clearAuthToken();
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Rafraîchir le token d'authentification
   */
  async refreshToken() {
    try {
      const response = await apiCallWithAuth(`${this.baseURL}${API_ENDPOINTS.auth.refresh}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.token) {
        setAuthToken(data.token);
        return { success: true, token: data.token };
      }
      
      throw new Error('Aucun token reçu');
      
    } catch (error) {
      console.error('❌ Erreur rafraîchissement token:', error);
      clearAuthToken();
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isLoggedIn() {
    return !!getAuthToken();
  }

  /**
   * Obtenir les données utilisateur depuis le cache local
   */
  getCachedUser() {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.warn('⚠️  Erreur parsing données utilisateur:', error);
      return null;
    }
  }

  /**
   * Obtenir les en-têtes d'authentification
   */
  getHeaders() {
    return getAuthHeaders();
  }
}

// Créer une instance singleton
const authService = new AuthService();

export default authService;