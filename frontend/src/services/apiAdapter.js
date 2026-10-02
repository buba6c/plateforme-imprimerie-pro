// Adaptateur API qui utilise soit l'API réelle soit les services mockés
import axios from 'axios';
import {
  mockAuthService,
  mockUsersService,
  mockDossiersService,
  shouldUseMockApi,
} from './mockApi';

import {
  authService as realAuthService,
  usersService as realUsersService,
  dossiersService as realDossiersService,
  systemConfigService as realSystemConfigService,
} from './api';

// Variable pour détecter si le backend est disponible
let backendAvailable = null;
const FORCE_REAL = true; // Forcé pour éviter tout fallback silencieux vers les mocks en production de debug

// Test de disponibilité du backend
const testBackendAvailability = async () => {
  // En mode API réelle forcée, ne pas dépendre du healthcheck
  if (FORCE_REAL) { backendAvailable = true; return true; }
  if (shouldUseMockApi()) {
    console.log('🔧 Mode développement: utilisation des services mockés');
    backendAvailable = false;
    return false;
  }
  try {
    await axios.get((process.env.REACT_APP_API_URL || '/api') + '/health', {
      timeout: 2000,
    });
    backendAvailable = true;
    console.log('✅ Backend disponible');
    return true;
  } catch (error) {
    backendAvailable = false;
    console.log('⚠️ Backend non disponible, basculement vers les services mockés');
    return false;
  }
};

// Service d'authentification adaptatif
export const authService = {
  login: async (email, password) => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (FORCE_REAL) { return await realAuthService.login(email, password); }
    if (backendAvailable) {
      try {
        return await realAuthService.login(email, password);
      } catch (error) {
        console.log('Erreur API réelle, tentative avec mock...');
        backendAvailable = false;
        return await mockAuthService.login(email, password);
      }
    } else {
      return await mockAuthService.login(email, password);
    }
  },

  logout: async () => {
    if (backendAvailable) {
      try {
        return await realAuthService.logout();
      } catch (error) {
        return await mockAuthService.logout();
      }
    } else {
      return await mockAuthService.logout();
    }
  },

  getCurrentUser: async () => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (FORCE_REAL) { return await realAuthService.getCurrentUser(); }
    if (backendAvailable) {
      try {
        return await realAuthService.getCurrentUser();
      } catch (error) {
        return await mockAuthService.getCurrentUser();
      }
    } else {
      return await mockAuthService.getCurrentUser();
    }
  },

  isAuthenticated: () => {
    return mockAuthService.isAuthenticated(); // Cette méthode fonctionne avec les deux
  },

  getUserData: () => {
    return mockAuthService.getUserData(); // Cette méthode fonctionne avec les deux
  },
};

// Service des utilisateurs adaptatif
export const usersService = {
  getUsers: async (params = {}) => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }

    if (backendAvailable) {
      try {
        return await realUsersService.getUsers(params);
      } catch (error) {
        return await mockUsersService.getUsers(params);
      }
    } else {
      return await mockUsersService.getUsers(params);
    }
  },

  getUser: async id => {
    if (backendAvailable) {
      try {
        return await realUsersService.getUser(id);
      } catch (error) {
        return await mockUsersService.getUser(id);
      }
    } else {
      return await mockUsersService.getUser(id);
    }
  },

  createUser: async userData => {
    if (backendAvailable) {
      try {
        return await realUsersService.createUser(userData);
      } catch (error) {
        return await mockUsersService.createUser(userData);
      }
    } else {
      return await mockUsersService.createUser(userData);
    }
  },

  updateUser: async (id, userData) => {
    if (backendAvailable) {
      try {
        return await realUsersService.updateUser(id, userData);
      } catch (error) {
        return await mockUsersService.updateUser(id, userData);
      }
    } else {
      return await mockUsersService.updateUser(id, userData);
    }
  },

  deleteUser: async id => {
    if (backendAvailable) {
      try {
        return await realUsersService.deleteUser(id);
      } catch (error) {
        return await mockUsersService.deleteUser(id);
      }
    } else {
      return await mockUsersService.deleteUser(id);
    }
  },
};

// Service des dossiers adaptatif
export const dossiersService = {
  getDossiers: async (params = {}) => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (FORCE_REAL) {
      // Toujours utiliser l'API réelle en mode forcé
      return await realDossiersService.getDossiers(params);
    }
    if (backendAvailable) {
      try {
        return await realDossiersService.getDossiers(params);
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401) {
          throw error;
        }
        return await mockDossiersService.getDossiers(params);
      }
    } else {
      return await mockDossiersService.getDossiers(params);
    }
  },

  getDossier: async id => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (FORCE_REAL) {
      return await realDossiersService.getDossier(id);
    }
    if (backendAvailable) {
      try {
        return await realDossiersService.getDossier(id);
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401) {
          throw error;
        }
        return await mockDossiersService.getDossier(id);
      }
    } else {
      return await mockDossiersService.getDossier(id);
    }
  },

  createDossier: async dossierData => {
    // Log et test de disponibilité avant chaque création
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (FORCE_REAL) {
      console.log('[API] createDossier: Utilisation API réelle (FORCE_REAL)');
      try {
        return await realDossiersService.createDossier(dossierData);
      } catch (error) {
        console.error('[API] createDossier: Erreur API réelle, aucune bascule vers mock', error);
        throw error;
      }
    }
    if (backendAvailable) {
      console.log('[API] createDossier: Utilisation API réelle');
      try {
        return await realDossiersService.createDossier(dossierData);
      } catch (error) {
        console.warn('[API] createDossier: Erreur API réelle, bascule vers mock', error);
        return await mockDossiersService.createDossier(dossierData);
      }
    } else {
      console.warn('[API] createDossier: Backend indisponible, utilisation mock');
      return await mockDossiersService.createDossier(dossierData);
    }
  },

  updateDossier: async (id, dossierData) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.updateDossier(id, dossierData);
      } catch (error) {
        // Pas de mock pour cette méthode
        throw error instanceof Error ? error : new Error('Erreur updateDossier');
      }
    } else {
      throw new Error('Fonctionnalité non disponible en mode mock');
    }
  },

  changeStatus: async (id, newStatus, comment = null) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.changeStatus(id, newStatus, comment);
      } catch (error) {
        // Si l'API réelle est forcée, ne JAMAIS fallback vers les mocks
        if (typeof FORCE_REAL !== 'undefined' && FORCE_REAL) {
          throw error.response?.data || error;
        }
        // Ne basculer vers le mock que si l'erreur semble provenir d'une indisponibilité du backend
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          // Erreur fonctionnelle (permissions, validation, etc.) -> remonter l'erreur réelle
          throw error.response?.data || error;
        }
        return await mockDossiersService.changeStatus(id, newStatus, comment);
      }
    } else {
      return await mockDossiersService.changeStatus(id, newStatus, comment);
    }
  },

  validateDossier: async (id, comment = null) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.validateDossier(id, comment);
      } catch (error) {
        // Si API réelle forcée, ne pas fallback
        if (typeof FORCE_REAL !== 'undefined' && FORCE_REAL) {
          throw error.response?.data || error;
        }
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error.response?.data || error;
        }
        // Fallback: transition to READY in mock
        return await mockDossiersService.changeStatus(id, 'en_impression', comment);
      }
    } else {
      // In mock: emulate validation by moving status from en_cours -> en_impression
      return await mockDossiersService.changeStatus(id, 'en_impression', comment);
    }
  },

  updateDossierStatus: async (id, newStatus, data = {}) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.changeStatus(id, newStatus, data.commentaire || data.comment);
      } catch (error) {
        // Si API réelle forcée, ne pas fallback
        if (typeof FORCE_REAL !== 'undefined' && FORCE_REAL) {
          throw error.response?.data || error;
        }
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error.response?.data || error;
        }
        return await mockDossiersService.changeStatus(id, newStatus, data.commentaire || data.comment);
      }
    } else {
      return await mockDossiersService.changeStatus(id, newStatus, data.commentaire || data.comment);
    }
  },

  scheduleDelivery: async (id, payload) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.scheduleDelivery(id, payload);
      } catch (error) {
        if (typeof FORCE_REAL !== 'undefined' && FORCE_REAL) {
          throw error.response?.data || error;
        }
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error.response?.data || error;
        }
        // Fallback to mock: change status to en_livraison with optional comment
        return await mockDossiersService.changeStatus(id, 'en_livraison', payload?.comment || null);
      }
    } else {
      return await mockDossiersService.changeStatus(id, 'en_livraison', payload?.comment || null);
    }
  },

  confirmDelivery: async (id, payload) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.confirmDelivery(id, payload);
      } catch (error) {
        if (typeof FORCE_REAL !== 'undefined' && FORCE_REAL) {
          throw error.response?.data || error;
        }
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error.response?.data || error;
        }
        const comment = [payload?.date_livraison, payload?.mode_paiement, payload?.montant_paye]
          .filter(Boolean)
          .join(' | ');
        return await mockDossiersService.changeStatus(id, 'livre', comment || null);
      }
    } else {
      const comment = [payload?.date_livraison, payload?.mode_paiement, payload?.montant_paye]
        .filter(Boolean)
        .join(' | ');
      return await mockDossiersService.changeStatus(id, 'livre', comment || null);
    }
  },

  repousserLivraison: async (id, payload) => {
    if (backendAvailable) {
      try {
        return await realDossiersService.repousserLivraison(id, payload);
      } catch (error) {
        if (typeof FORCE_REAL !== 'undefined' && FORCE_REAL) {
          throw error.response?.data || error;
        }
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error.response?.data || error;
        }
        // Pas de fallback mock pour cette fonction spécifique
        throw error;
      }
    } else {
      throw new Error('Fonctionnalité non disponible en mode mock');
    }
  },

  deleteDossier: async id => {
    if (backendAvailable) {
      try {
        return await realDossiersService.deleteDossier(id);
      } catch (error) {
        return await mockDossiersService.deleteDossier(id);
      }
    } else {
      return await mockDossiersService.deleteDossier(id);
    }
  },
  // Autoriser la modification d'un dossier validé (admin)
  unlockDossier: async id => {
    if (backendAvailable) {
      try {
        return await realDossiersService.unlockDossier(id);
      } catch (error) {
        throw error instanceof Error ? error : new Error('Erreur unlockDossier');
      }
    } else {
      throw new Error('Fonctionnalité non disponible en mode mock');
    }
  },
};

// Initialiser la vérification
testBackendAvailability();

// Service systemConfig adaptatif
export const systemConfigService = {
  get: async key => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (backendAvailable) {
      try {
        return await realSystemConfigService.get(key);
      } catch (error) {
        throw error;
      }
    } else {
      throw new Error('systemConfigService non disponible en mode mock');
    }
  },
  set: async (key, value) => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (backendAvailable) {
      try {
        return await realSystemConfigService.set(key, value);
      } catch (error) {
        throw error;
      }
    } else {
      throw new Error('systemConfigService non disponible en mode mock');
    }
  },
  list: async () => {
    if (backendAvailable === null) {
      await testBackendAvailability();
    }
    if (backendAvailable) {
      try {
        return await realSystemConfigService.list();
      } catch (error) {
        throw error;
      }
    } else {
      throw new Error('systemConfigService non disponible en mode mock');
    }
  },
};

const apiAdapter = { authService, usersService, dossiersService, systemConfigService };
export default apiAdapter;
