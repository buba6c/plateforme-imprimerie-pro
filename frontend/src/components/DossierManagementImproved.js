// Composant d'exemple montrant l'utilisation du nouveau système unifié
import React, { useState, useEffect } from 'react';
import { useDossiersByRole } from '../hooks/useDossierSync';
import { errorHandler } from '../services/errorHandlerService';
import { authService } from '../services/apiAdapter';
import { ROLE_TRANSITIONS, ACTION_LABELS, Roles, Status } from '../workflow-adapter/config';
import { mapAppRoleToAdapter, mapBackendLabelToStatus, getAvailableActions } from '../workflow-adapter';

const DossierManagementImproved = () => {
  const devLog = (level, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console[level](...args);
    }
  };
  const [userRole, setUserRole] = useState('admin');
  const [machineType, setMachineType] = useState(null);
  const [notification, setNotification] = useState(null);

  // Hook pour la gestion synchronisée des dossiers par rôle
  const {
    dossiers,
    loading,
    error,
    connected,
    loadDossiers,
    changeStatus,
    validateDossier,
    deleteDossier,
    clearError
  } = useDossiersByRole(userRole, machineType);

  // ===================================
  // INITIALISATION
  // ===================================

  useEffect(() => {
    // Récupérer le rôle utilisateur depuis l'auth
    try {
      const userData = authService.getUserData();
      if (userData?.role) {
        setUserRole(userData.role);
        if (userData.machine_type) {
          setMachineType(userData.machine_type);
        }
      }
    } catch (err) {
      devLog('warn', 'Impossible de récupérer le rôle utilisateur:', err);
    }
  }, []);

  // Fonctions utilitaires placées avant le return
  const getStatusColor = (status) => {
    const colors = {
      'en_cours': 'bg-blue-100 text-blue-800',
      'a_revoir': 'bg-red-100 text-red-800',
      'en_impression': 'bg-purple-100 text-purple-800',
      'termine': 'bg-gray-100 text-gray-800',
      'en_livraison': 'bg-yellow-100 text-yellow-800',
      'livre': 'bg-green-100 text-green-800',
      'pret_impression': 'bg-indigo-100 text-indigo-800',
      'pret_livraison': 'bg-orange-100 text-orange-800',
      'imprime': 'bg-teal-100 text-teal-800',
    };
    return colors[status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'en_cours': 'En cours',
      'a_revoir': 'À revoir',
      'en_impression': 'En impression',
      'termine': 'Terminé',
      'en_livraison': 'En livraison',
      'livre': 'Livré',
      'pret_impression': 'Prêt impression',
      'pret_livraison': 'Prêt livraison',
      'imprime': 'Imprimé',
      // Statuts anglais
      'READY': 'Prêt livraison',
      'DELIVERED': 'Livré',
      'PREPARATION': 'En impression',
      'REVISION': 'À revoir',
      'IN_PROGRESS': 'En cours',
    };
    if (labels[status]) return labels[status];
    if (labels[status?.toUpperCase()]) return labels[status.toUpperCase()];
    return status;
  };

  // Centralisation de la logique métier pour l'affichage des boutons
  const getDossierActions = (dossier) => {
    const adapterRole = mapAppRoleToAdapter(userRole);
    const adapterStatus = mapBackendLabelToStatus(dossier.statut || dossier.status);
    const job = {
      status: adapterStatus,
      machineType: dossier.type_formulaire || dossier.machine || dossier.type,
      jobNumber: dossier.numero_commande || dossier.numero,
      createdById: dossier.created_by || dossier.createdById,
    };
    const adaptedUser = { id: dossier.created_by || dossier.createdById || '', role: adapterRole };
    return getAvailableActions(adaptedUser, job);
  };

  const handleAction = async (actionKey, dossier) => {
    try {
      if (actionKey === 'validate') {
        await validateDossier(dossier.id);
        setNotification({ type: 'success', message: 'Dossier validé avec succès' });
      } else if (actionKey === 'reject') {
        await changeStatus(dossier.id, 'a_revoir');
        setNotification({ type: 'info', message: 'Dossier marqué à revoir' });
      } else if (actionKey === 'deliver') {
        await changeStatus(dossier.id, 'livre');
        setNotification({ type: 'success', message: 'Dossier livré' });
      } else {
        await changeStatus(dossier.id, actionKey);
        setNotification({ type: 'success', message: `Statut changé vers ${actionKey}` });
      }
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      devLog('error', 'Erreur lors de l\'action:', err);
    }
  };

  return (
    <>
      {/* Notifications */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg border ${
          notification.type === 'success' ? 'bg-success-50 border-green-200 text-green-800' :
          notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          notification.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
          'bg-error-50 border-red-200 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Erreurs */}
      {error && (
        <div className="mb-4 p-4 bg-error-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-red-800">{errorHandler.formatErrorMessage(error)}</span>
            <button
              onClick={clearError}
              className="text-error-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Liste des dossiers */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
            Dossiers ({dossiers.length})
          </h3>
        </div>
        {loading && dossiers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            Chargement des dossiers...
          </div>
        ) : dossiers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
            Aucun dossier à afficher pour votre rôle
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {dossiers.map((dossier) => {
              const actions = getDossierActions(dossier);
              
              return (
                <div key={dossier.id || dossier.folder_id} className="p-6 hover:bg-neutral-50 dark:bg-neutral-900">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <h4 className="text-lg font-medium text-neutral-900 dark:text-white">
                          {dossier.numero_dossier}
                        </h4>
                        
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(dossier.statut)}`}>
                          {getStatusLabel(dossier.statut)}
                        </span>
                        
                        {dossier.type_fichier && (
                          <span className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded">
                            {dossier.type_fichier}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-300 space-y-1">
                        <p><strong>Client:</strong> {dossier.nom_client}</p>
                        <p><strong>Description:</strong> {dossier.description}</p>
                        {dossier.date_creation && (
                          <p><strong>Créé le:</strong> {new Date(dossier.date_creation).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {actions.map(action => (
                        <button
                          key={action.key}
                          onClick={() => handleAction(action.key, dossier)}
                          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                            action.color === 'green' ? 'bg-success-100 text-success-700 hover:bg-green-200' :
                            action.color === 'blue' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                            action.color === 'purple' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' :
                            action.color === 'orange' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                            'bg-error-100 text-error-700 hover:bg-red-200'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default DossierManagementImproved;