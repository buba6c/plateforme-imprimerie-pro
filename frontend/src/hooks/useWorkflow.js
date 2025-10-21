/**
 * HOOKS REACT POUR LA GESTION DU WORKFLOW
 * =========================================
 * 
 * Hooks optimisés pour la gestion des transitions de statuts avec validation.
 */

import { useState, useCallback, useMemo } from 'react';
import { workflowService } from '../services/workflowService';
import { errorHandler } from '../services/errorHandlerService';

/**
 * Hook principal pour la gestion du workflow d'un dossier
 */
export const useWorkflow = (dossier, user = null) => {
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState(null);
  const [lastChange, setLastChange] = useState(null);

  // Récupérer le rôle utilisateur
  const userRole = user?.role || localStorage.getItem('user_role') || 'user';
  const userData = user || {
    id: localStorage.getItem('user_id'),
    role: userRole,
    nom: localStorage.getItem('user_name')
  };

  // Calculer les transitions disponibles
  const availableTransitions = useMemo(() => {
    if (!dossier) return [];
    return workflowService.getAvailableTransitions(dossier, userRole, userData);
  }, [dossier, userRole, userData]);

  // Obtenir la prochaine action suggérée
  const suggestedAction = useMemo(() => {
    if (!dossier) return null;
    return workflowService.getNextSuggestedAction(dossier, userRole);
  }, [dossier, userRole]);

  // Obtenir les informations du statut actuel
  const currentStatusInfo = useMemo(() => {
    if (!dossier?.statut) return null;
    return workflowService.getStatusInfo(dossier.statut);
  }, [dossier?.statut]);

  // Changer le statut
  const changeStatus = useCallback(async (newStatus, reason = '') => {
    if (!dossier) {
      throw new Error('Dossier non disponible');
    }

    try {
      setChanging(true);
      setError(null);

      const result = await workflowService.changeStatus(dossier, newStatus, reason, userData);
      
      setLastChange({
        from: dossier.statut,
        to: newStatus,
        reason,
        timestamp: Date.now()
      });

      return result;

    } catch (err) {
      const errorMessage = errorHandler.formatErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setChanging(false);
    }
  }, [dossier, userData]);

  // Valider une transition sans l'exécuter
  const validateTransition = useCallback((toStatus) => {
    if (!dossier) return { valid: false, error: 'Dossier non disponible' };

    try {
      workflowService.validateTransition(
        dossier.statut, 
        toStatus, 
        userRole, 
        dossier, 
        userData
      );
      return { valid: true };
    } catch (err) {
      return { 
        valid: false, 
        error: errorHandler.formatErrorMessage(err) 
      };
    }
  }, [dossier, userRole, userData]);

  // Vérifier la cohérence du dossier
  const consistency = useMemo(() => {
    if (!dossier) return null;
    return workflowService.validateDossierConsistency(dossier);
  }, [dossier]);

  return {
    // État
    changing,
    error,
    lastChange,
    
    // Données
    currentStatusInfo,
    availableTransitions,
    suggestedAction,
    consistency,
    
    // Actions
    changeStatus,
    validateTransition,
    
    // Utilitaires
    canTransitionTo: (status) => availableTransitions.some(t => t.key === status),
    hasAvailableActions: availableTransitions.length > 0,
    isValidWorkflow: consistency?.isValid !== false
  };
};

/**
 * Hook pour l'historique des changements de statuts
 */
export const useStatusHistory = (dossier) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!dossier) return;

    try {
      setLoading(true);
      setError(null);
      
      const historyData = await workflowService.getStatusHistory(dossier);
      setHistory(historyData);

    } catch (err) {
      console.error('Erreur chargement historique:', err);
      setError(errorHandler.formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [dossier]);

  // Charger automatiquement au montage
  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    history,
    loading,
    error,
    loadHistory
  };
};

/**
 * Hook pour les statistiques de workflow
 */
export const useWorkflowStats = (dossiers = []) => {
  const stats = useMemo(() => {
    const statusCount = {};
    const transitionCount = {};
    const totalDossiers = dossiers.length;
    let withIssues = 0;

    // Initialiser les compteurs de statuts
    workflowService.getAllStatuses().forEach(status => {
      statusCount[status.key] = 0;
    });

    // Calculer les statistiques
    dossiers.forEach(dossier => {
      if (dossier.statut) {
        statusCount[dossier.statut] = (statusCount[dossier.statut] || 0) + 1;
      }

      // Vérifier la cohérence
      const consistency = workflowService.validateDossierConsistency(dossier);
      if (!consistency.isValid) {
        withIssues++;
      }
    });

    // Calculer les pourcentages
    const statusPercentages = {};
    Object.entries(statusCount).forEach(([status, count]) => {
      statusPercentages[status] = totalDossiers > 0 ? (count / totalDossiers) * 100 : 0;
    });

    return {
      totalDossiers,
      statusCount,
      statusPercentages,
      withIssues,
      consistencyRate: totalDossiers > 0 ? ((totalDossiers - withIssues) / totalDossiers) * 100 : 100
    };
  }, [dossiers]);

  return stats;
};

/**
 * Hook pour les actions en lot sur les dossiers
 */
export const useBulkWorkflow = () => {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const processBulkAction = useCallback(async (dossiers, action, options = {}) => {
    try {
      setProcessing(true);
      setError(null);
      setResults([]);

      const { newStatus, reason = '', user = null } = options;
      const batchResults = [];

      for (const dossier of dossiers) {
        try {
          let result;
          
          switch (action) {
            case 'change_status':
              result = await workflowService.changeStatus(dossier, newStatus, reason, user);
              batchResults.push({
                dossier: dossier,
                success: true,
                result: result
              });
              break;
              
            case 'validate_consistency':
              result = workflowService.validateDossierConsistency(dossier);
              batchResults.push({
                dossier: dossier,
                success: result.isValid,
                result: result,
                issues: result.issues
              });
              break;
              
            default:
              throw new Error(`Action non supportée: ${action}`);
          }
          
        } catch (err) {
          batchResults.push({
            dossier: dossier,
            success: false,
            error: errorHandler.formatErrorMessage(err)
          });
        }
      }

      setResults(batchResults);
      return batchResults;

    } catch (err) {
      const errorMessage = errorHandler.formatErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  const resetResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    processing,
    results,
    error,
    processBulkAction,
    resetResults,
    
    // Statistiques des résultats
    successCount: results.filter(r => r.success).length,
    errorCount: results.filter(r => !r.success).length,
    totalProcessed: results.length
  };
};

/**
 * Hook pour la validation en temps réel du workflow
 */
export const useWorkflowValidation = (dossier) => {
  const [validationResult, setValidationResult] = useState(null);

  // Valider automatiquement quand le dossier change
  React.useEffect(() => {
    if (dossier) {
      const result = workflowService.validateDossierConsistency(dossier);
      setValidationResult(result);
    }
  }, [dossier]);

  const revalidate = useCallback(() => {
    if (dossier) {
      const result = workflowService.validateDossierConsistency(dossier);
      setValidationResult(result);
    }
  }, [dossier]);

  return {
    validationResult,
    isValid: validationResult?.isValid,
    issues: validationResult?.issues || [],
    revalidate,
    
    // Helpers
    hasWarnings: validationResult?.issues?.some(i => i.type === 'warning') || false,
    hasErrors: validationResult?.issues?.some(i => i.type === 'error') || false,
    issueCount: validationResult?.issues?.length || 0
  };
};