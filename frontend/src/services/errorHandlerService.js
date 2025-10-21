// Service de gestion centralisée des erreurs pour éviter les dysfonctionnements
import { DossierIdResolver } from './dossierIdResolver';

class ErrorHandlerService {
  constructor() {
    this.errorHandlers = new Map();
    this.retryStrategies = new Map();
    this.setupDefaultHandlers();
  }

  // ===================================
  // GESTION DES ERREURS SPÉCIFIQUES
  // ===================================

  setupDefaultHandlers() {
    // Erreurs dossiers non trouvés
    this.registerHandler('DOSSIER_NOT_FOUND', {
      message: 'Ce dossier n\'existe plus ou a été supprimé',
      action: 'refresh_list',
      severity: 'warning'
    });

    this.registerHandler('ASSOCIATED_DOSSIER_NOT_FOUND', {
      message: 'Le dossier associé n\'est plus disponible',
      action: 'refresh_list',
      severity: 'warning'
    });

    // Erreurs de permissions
    this.registerHandler('PERMISSION_DENIED', {
      message: 'Vous n\'avez pas les permissions pour cette action',
      action: 'none',
      severity: 'error'
    });

    // Erreurs de connexion
    this.registerHandler('NETWORK_ERROR', {
      message: 'Erreur de connexion. Vérifiez votre connection internet.',
      action: 'retry',
      severity: 'error'
    });

    // Erreurs de validation
    this.registerHandler('VALIDATION_ERROR', {
      message: 'Les données saisies ne sont pas valides',
      action: 'none',
      severity: 'warning'
    });

    // Erreurs de statut
    this.registerHandler('INVALID_STATUS_TRANSITION', {
      message: 'Cette transition de statut n\'est pas autorisée',
      action: 'refresh_dossier',
      severity: 'warning'
    });
  }

  registerHandler(errorCode, config) {
    this.errorHandlers.set(errorCode, {
      message: config.message || 'Une erreur est survenue',
      action: config.action || 'none',
      severity: config.severity || 'error',
      customHandler: config.customHandler
    });
  }

  // ===================================
  // TRAITEMENT DES ERREURS
  // ===================================

  handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error);
    const handler = this.errorHandlers.get(errorInfo.code) || this.getDefaultHandler();

    const processedError = {
      code: errorInfo.code,
      message: handler.message,
      originalMessage: errorInfo.originalMessage,
      severity: handler.severity,
      action: handler.action,
      context: context,
      timestamp: Date.now(),
      retry: this.canRetry(errorInfo.code)
    };

    // Log de l'erreur pour le debug
    console.error('🚨 Erreur interceptée:', processedError);

    // Traitement personnalisé si défini
    if (handler.customHandler) {
      try {
        handler.customHandler(processedError, context);
      } catch (customError) {
        console.error('Erreur dans le handler personnalisé:', customError);
      }
    }

    return processedError;
  }

  analyzeError(error) {
    // Erreur réseau/axios
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      // Codes d'erreur spécifiques du backend
      if (data?.code) {
        return {
          code: data.code,
          originalMessage: data.message || data.error || error.message,
          status: status
        };
      }

      // Codes HTTP standards
      switch (status) {
        case 404:
          return {
            code: 'DOSSIER_NOT_FOUND',
            originalMessage: data?.message || 'Ressource non trouvée',
            status: status
          };
        case 403:
          return {
            code: 'PERMISSION_DENIED',
            originalMessage: data?.message || 'Accès interdit',
            status: status
          };
        case 401:
          return {
            code: 'AUTHENTICATION_REQUIRED',
            originalMessage: data?.message || 'Authentification requise',
            status: status
          };
        case 422:
          return {
            code: 'VALIDATION_ERROR',
            originalMessage: data?.message || 'Données invalides',
            status: status
          };
        default:
          return {
            code: 'SERVER_ERROR',
            originalMessage: data?.message || error.message || 'Erreur serveur',
            status: status
          };
      }
    }

    // Erreur réseau
    if (error.request) {
      return {
        code: 'NETWORK_ERROR',
        originalMessage: 'Impossible de contacter le serveur',
        status: null
      };
    }

    // Erreur JavaScript
    return {
      code: 'CLIENT_ERROR',
      originalMessage: error.message || 'Erreur inconnue',
      status: null
    };
  }

  getDefaultHandler() {
    return {
      message: 'Une erreur inattendue s\'est produite',
      action: 'none',
      severity: 'error'
    };
  }

  canRetry(errorCode) {
    const retryableCodes = [
      'NETWORK_ERROR',
      'SERVER_ERROR',
      'TIMEOUT_ERROR'
    ];
    return retryableCodes.includes(errorCode);
  }

  // ===================================
  // STRATÉGIES DE RÉCUPÉRATION
  // ===================================

  async executeWithFallback(operation, fallbackStrategy = 'none', context = {}) {
    try {
      return await operation();
    } catch (error) {
      const processedError = this.handleError(error, context);
      
      // Tentative de récupération selon la stratégie
      switch (fallbackStrategy) {
        case 'retry':
          return this.retryOperation(operation, processedError, context);
        
        case 'refresh_list':
          if (context.onRefreshList) {
            context.onRefreshList();
          }
          break;
        
        case 'refresh_dossier':
          if (context.onRefreshDossier && context.dossierId) {
            context.onRefreshDossier(context.dossierId);
          }
          break;
        
        case 'fallback_data':
          if (context.fallbackData) {
            return context.fallbackData;
          }
          break;
      }

      throw processedError;
    }
  }

  async retryOperation(operation, error, context = {}, maxRetries = 3) {
    let retries = 0;
    const baseDelay = 1000; // 1 seconde

    while (retries < maxRetries) {
      retries++;
      
      // Délai exponentiel
      const delay = baseDelay * Math.pow(2, retries - 1);
      await this.sleep(delay);

      try {
        console.log(`🔄 Tentative ${retries}/${maxRetries} après erreur:`, error.code);
        return await operation();
      } catch (retryError) {
        const processedRetryError = this.handleError(retryError, context);
        
        if (retries >= maxRetries) {
          throw processedRetryError;
        }
        
        // Si l'erreur n'est plus "retryable", arrêter
        if (!this.canRetry(processedRetryError.code)) {
          throw processedRetryError;
        }
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===================================
  // VALIDATIONS PRÉVENTIVES
  // ===================================

  validateDossierAccess(dossier, requiredAction, userRole) {
    if (!dossier) {
      throw new Error('Dossier introuvable');
    }

    const dossierId = DossierIdResolver.resolve(dossier);
    if (!dossierId) {
      throw new Error('Identifiant de dossier invalide');
    }

    // Validation selon le rôle et l'action
    const permissions = this.getPermissionsForRole(userRole);
    
    if (!permissions[requiredAction]) {
      throw new Error('Action non autorisée pour votre rôle');
    }

    // Validation selon le statut du dossier
    if (!this.isActionAllowedForStatus(requiredAction, dossier.statut)) {
      throw new Error('Action non autorisée pour le statut actuel du dossier');
    }

    return true;
  }

  getPermissionsForRole(role) {
    const permissions = {
      admin: {
        view: true,
        edit: true,
        delete: true,
        validate: true,
        print: true,
        deliver: true,
        unlock: true
      },
      preparateur: {
        view: true,
        edit: true,
        delete: false,
        validate: false,
        print: false,
        deliver: false,
        unlock: false
      },
      imprimeur: {
        view: true,
        edit: false,
        delete: false,
        validate: true,
        print: true,
        deliver: false,
        unlock: false
      },
      livreur: {
        view: true,
        edit: false,
        delete: false,
        validate: false,
        print: false,
        deliver: true,
        unlock: false
      }
    };

    return permissions[role] || {};
  }

  isActionAllowedForStatus(action, status) {
    const statusWorkflow = {
      validate: ['en_cours', 'a_revoir'],
      print: ['en_impression'],
      deliver: ['termine', 'pret_livraison'],
      edit: ['en_cours', 'a_revoir'],
      delete: ['en_cours', 'a_revoir']
    };

    const allowedStatuses = statusWorkflow[action];
    return !allowedStatuses || allowedStatuses.includes(status);
  }

  // ===================================
  // UTILITAIRES PUBLICS
  // ===================================

  formatErrorMessage(error) {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.code) {
      const handler = this.errorHandlers.get(error.code);
      return handler?.message || error.originalMessage || 'Erreur inconnue';
    }

    return 'Une erreur est survenue';
  }

  isRetryableError(error) {
    const code = error?.code || error?.response?.data?.code;
    return this.canRetry(code);
  }

  shouldShowToUser(error) {
    // Ne pas afficher les erreurs techniques internes
    const hiddenCodes = ['INTERNAL_ERROR', 'DEBUG_ERROR'];
    const code = error?.code || error?.response?.data?.code;
    return !hiddenCodes.includes(code);
  }
}

// Instance singleton
export const errorHandler = new ErrorHandlerService();

// Wrapper pour les opérations dossiers
export async function safeDossierOperation(operation, context = {}) {
  return errorHandler.executeWithFallback(
    operation,
    context.fallbackStrategy || 'retry',
    context
  );
}

export default errorHandler;