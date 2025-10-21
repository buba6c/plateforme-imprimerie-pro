import api from './httpClient';
import { retryAsync } from './httpClient';
import { DossierIdResolver } from './dossierIdResolver';

// Fonction helper pour récupérer l'ID d'un dossier de façon uniforme
function resolveDossierKey(input) {
  const resolved = DossierIdResolver.resolve(input);
  if (!resolved) {
    throw new Error(`Impossible de résoudre l'identifiant du dossier: ${JSON.stringify(input)}`);
  }
  return resolved;
}

// Mapping erreur pour message plus clair
const mapDossierError = error => {
  const status = error?.response?.status;
  if (status === 403) {
    return error.response?.data || { error: 'Action non autorisée sur ce dossier' };
  }
  if (status === 404) {
    return error.response?.data || { error: 'Ce dossier n\'existe pas' };
  }
  return error?.response?.data || { error: 'Erreur dossier' };
};

// ===================================
// SERVICES D'AUTHENTIFICATION
// ===================================

export const authService = {
  // Connexion
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur de connexion' };
    }
  },

  // Déconnexion
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
    }
  },

  // Récupérer les infos utilisateur actuel
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data.user;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération utilisateur' };
    }
  },

  // Rafraîchir le token
  refreshToken: async () => {
    try {
      const response = await api.post('/auth/refresh');

      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
      }

      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur rafraîchissement token' };
    }
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated: () => {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },

  // Récupérer les données utilisateur du localStorage
  getUserData: () => {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  },
};

// ===================================
// SERVICES DOSSIERS
// ===================================

export const dossiersService = {
  // Récupérer la liste des dossiers
  getDossiers: async (params = {}) => {
    try {
      // Nettoyer les paramètres - éliminer null/undefined
      const cleanParams = {};
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== null && value !== undefined && value !== '' && value !== 'null' && value !== 'undefined') {
          cleanParams[key] = value;
        }
      });
      
      console.log('[api.js] getDossiers - Params nettoyés:', cleanParams);
      const response = await api.get('/dossiers', { params: cleanParams });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération dossiers' };
    }
  },
  // Récupérer un dossier par ID avec retry léger si 404 juste après création
  getDossier: async idLike => {
    const id = resolveDossierKey(idLike);
    const exec = async () => {
      try {
        const response = await api.get(`/dossiers/${id}`);
        return response.data;
      } catch (error) {
        const status = error?.response?.status;
        const code = error?.response?.data?.code;
        if (status === 404 && code === 'DOSSIER_NOT_FOUND') throw error; // retry uniquement ce cas
        throw error;
      }
    };
    try {
      return await retryAsync(exec, { retries: 2, baseDelay: 150 });
    } catch (e) {
      throw mapDossierError(e);
    }
  },
  // Créer un nouveau dossier
  createDossier: async data => {
    try {
      const response = await api.post('/dossiers', data);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },

  // Mettre à jour un dossier
  updateDossier: async (idLike, data) => {
    const id = resolveDossierKey(idLike);
    try {
      const response = await api.put(`/dossiers/${id}`, data);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },

  // Changer le statut d'un dossier
  changeStatus: async (idLike, newStatus, comment = null) => {
    const id = resolveDossierKey(idLike);
    try {
      // Le backend attend directement les noms français des statuts
      // La nouvelle route PATCH /status attend le statut en anglais (underscore)
      
      // Utiliser la nouvelle route PATCH /status pour les permissions 'change_status'
      const payload = {
        status: newStatus,
        comment: comment ?? null,
      };
      const response = await api.patch(`/dossiers/${id}/status`, payload);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
  // Valider un dossier (préparateur)
  validateDossier: async (idLike, comment = null) => {
    const id = resolveDossierKey(idLike);
    try {
      const response = await api.put(
        `/dossiers/${id}/valider`,
        comment ? { commentaire: comment } : {}
      );
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
  // Remettre en impression (admin)
  reprintDossier: async (idLike, comment = null) => {
    const id = resolveDossierKey(idLike);
    try {
      const response = await api.put(
        `/dossiers/${id}/remettre-en-impression`,
        comment ? { commentaire: comment } : {}
      );
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
  // Programmer une livraison (livreur)
  scheduleDelivery: async (idLike, payload) => {
    const id = resolveDossierKey(idLike);
    try {
      const body = {
        status: 'en_livraison',
        comment: payload?.comment || null,
        date_livraison_prevue:
          payload?.date_livraison_prevue || payload?.date_prevue || payload?.date_livraison || null,
      };
      const response = await api.patch(`/dossiers/${id}/status`, body);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
  // Valider la livraison (livreur)
  confirmDelivery: async (idLike, payload) => {
    const id = resolveDossierKey(idLike);
    try {
      const body = {
        status: 'termine',
        comment: payload?.comment || null,
        date_livraison: payload?.date_livraison || null,
        mode_paiement: payload?.mode_paiement || null,
        montant_cfa: payload?.montant_paye ?? payload?.montant_cfa ?? null,
      };
      const response = await api.patch(`/dossiers/${id}/status`, body);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
  // Supprimer un dossier (admin uniquement)
  deleteDossier: async idLike => {
    const id = resolveDossierKey(idLike);
    try {
      const response = await api.delete(`/dossiers/${id}`);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
  // Autoriser la modification d'un dossier validé (admin)
  unlockDossier: async idLike => {
    const id = resolveDossierKey(idLike);
    try {
      const response = await api.put(`/dossiers/${id}/autoriser-modification`);
      return response.data;
    } catch (error) {
      throw mapDossierError(error);
    }
  },
};

// ===================================
// SERVICES UTILISATEURS
// ===================================

export const usersService = {
  // Récupérer la liste des utilisateurs
  getUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération utilisateurs' };
    }
  },

  // Récupérer un utilisateur par ID
  getUser: async id => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération utilisateur' };
    }
  },

  // Créer un nouvel utilisateur
  createUser: async userData => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur création utilisateur' };
    }
  },

  // Mettre à jour un utilisateur
  updateUser: async (id, userData) => {
    try {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur mise à jour utilisateur' };
    }
  },

  // Supprimer un utilisateur
  deleteUser: async id => {
    try {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur suppression utilisateur' };
    }
  },

  // Récupérer les statistiques utilisateurs
  getUserStats: async () => {
    try {
      const response = await api.get('/users/stats/summary');
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération statistiques' };
    }
  },
};

// ===================================
// SERVICES FICHIERS
// ===================================

export const filesService = {
  // Récupérer les fichiers d'un dossier
  getFiles: async dossierId => {
    try {
      const response = await api.get('/files', { params: { dossier_id: dossierId } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération fichiers' };
    }
  },
  
  // Récupérer les fichiers par ID de dossier (alias pour compatibilité)
  getFilesByDossier: async dossierId => {
    try {
      const response = await api.get('/files', { params: { dossier_id: dossierId } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération fichiers' };
    }
  },

  // Récupérer un fichier par ID
  getFile: async id => {
    try {
      const response = await api.get(`/files/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération fichier' };
    }
  },

  // Supprimer un fichier
  deleteFile: async id => {
    try {
      const response = await api.delete(`/files/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur suppression fichier' };
    }
  },

  // Télécharger un fichier
  downloadFile: async id => {
    try {
      const response = await api.get(`/files/download/${id}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur téléchargement fichier' };
    }
  },
};

// ===================================
// SERVICES PARAMÈTRES SYSTÈME (ADMIN)
// ===================================

export const systemConfigService = {
  get: async key => {
    try {
      const response = await api.get(`/system-config/${encodeURIComponent(key)}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération paramètre système' };
    }
  },
  set: async (key, value) => {
    try {
      const response = await api.put(`/system-config/${encodeURIComponent(key)}`, { value });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur mise à jour paramètre système' };
    }
  },
  list: async () => {
    try {
      const response = await api.get('/system-config');
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération liste paramètres système' };
    }
  },
};

// ===================================
// SERVICES GÉNÉRAUX
// ===================================

export const healthService = {
  // Vérifier l'état du serveur
  checkHealth: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur vérification santé serveur' };
    }
  },
};

// Export par défaut de l'instance API
export default api;
