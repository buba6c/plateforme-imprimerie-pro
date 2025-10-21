import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useWorkflow, useWorkflowValidation } from '../../hooks/useWorkflow';
import { workflowService } from '../../services/workflowService';

/**
 * Composant de gestion des statuts avec workflow intégré
 */
const StatusWorkflowManager = ({ 
  dossier, 
  user = null,
  showHistory = true,
  showValidation = true,
  showSuggestions = true,
  compact = false,
  onStatusChange
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState(null);
  const [reason, setReason] = useState('');

  // Hooks pour la gestion du workflow
  const {
    changing,
    error,
    currentStatusInfo,
    availableTransitions,
    suggestedAction,
    consistency,
    changeStatus,
    validateTransition,
    canTransitionTo,
    hasAvailableActions
  } = useWorkflow(dossier, user);

  const {
    validationResult,
    isValid,
    issues,
    hasWarnings,
    hasErrors
  } = useWorkflowValidation(dossier);

  // Gestionnaire de changement de statut
  const handleStatusChange = async (newStatus, statusReason = '') => {
    try {
      const result = await changeStatus(newStatus, statusReason);
      
      if (onStatusChange) {
        onStatusChange(dossier, newStatus, result);
      }
      
      setShowConfirmModal(false);
      setSelectedTransition(null);
      setReason('');
      
    } catch (err) {
      console.error('Erreur changement statut:', err);
      // L'erreur est déjà gérée par le hook
    }
  };

  const openConfirmModal = (transition) => {
    setSelectedTransition(transition);
    setReason('');
    setShowConfirmModal(true);
  };

  const getStatusColorClass = (color) => {
    const colorMap = {
      'blue': 'bg-blue-100 text-blue-800 border-blue-200',
      'yellow': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'green': 'bg-success-100 text-green-800 border-green-200',
      'purple': 'bg-purple-100 text-purple-800 border-purple-200',
      'indigo': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'emerald': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'red': 'bg-error-100 text-red-800 border-red-200',
      'gray': 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700'
    };
    return colorMap[color] || colorMap['gray'];
  };

  if (!dossier) {
    return (
      <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 text-center">
        <p className="text-neutral-600 dark:text-neutral-300">Aucun dossier sélectionné</p>
      </div>
    );
  }

  if (compact) {
    // Version compacte pour intégration dans des listes
    return (
      <div className="flex items-center space-x-2">
        {/* Statut actuel */}
        <span className={`
          px-2 py-1 rounded-full text-xs font-medium border
          ${getStatusColorClass(currentStatusInfo?.color)}
        `}>
          {currentStatusInfo?.label || dossier.statut}
        </span>

        {/* Actions rapides */}
        {hasAvailableActions && (
          <div className="flex items-center space-x-1">
            {availableTransitions.slice(0, 2).map((transition) => (
              <button
                key={transition.key}
                onClick={() => handleStatusChange(transition.key)}
                disabled={changing}
                className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                title={`Changer vers: ${transition.label}`}
              >
                <ArrowRightIcon className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Indicateur de validation */}
        {showValidation && !isValid && (
          <ExclamationTriangleIcon className="h-4 w-4 text-error-500" title="Problèmes détectés" />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      
      {/* En-tête */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-b border-neutral-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
              <Cog6ToothIcon className="h-5 w-5 mr-2 text-neutral-600 dark:text-neutral-300" />
              Gestion du workflow
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
              Dossier: {dossier.numero_commande || dossier.nom || dossier.id}
            </p>
          </div>
          
          {/* Indicateurs d'état */}
          <div className="flex items-center space-x-2">
            {changing && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm">Changement...</span>
              </div>
            )}
            
            {showValidation && (
              <div className="flex items-center space-x-1">
                {isValid ? (
                  <CheckCircleIcon className="h-5 w-5 text-success-500" title="Workflow valide" />
                ) : (
                  <ExclamationTriangleIcon className="h-5 w-5 text-error-500" title={`${issues.length} problème(s) détecté(s)`} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-6">
        
        {/* Statut actuel */}
        <div>
          <h4 className="font-medium text-neutral-900 dark:text-white mb-3 flex items-center">
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Statut actuel
          </h4>
          <div className="flex items-center space-x-3">
            <span className={`
              px-4 py-2 rounded-lg text-sm font-medium border
              ${getStatusColorClass(currentStatusInfo?.color)}
            `}>
              {currentStatusInfo?.label || dossier.statut}
            </span>
            <div className="text-sm text-neutral-600 dark:text-neutral-300">
              {currentStatusInfo?.description}
            </div>
          </div>
        </div>

        {/* Erreur d'action */}
        {error && (
          <div className="bg-error-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-error-500 mr-2" />
              <span className="text-error-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Problèmes de validation */}
        {showValidation && !isValid && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h5 className="font-medium text-yellow-800 mb-2 flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              Problèmes détectés ({issues.length})
            </h5>
            <ul className="text-sm text-yellow-700 space-y-1">
              {issues.map((issue, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions suggérées */}
        {showSuggestions && suggestedAction && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-800 mb-2 flex items-center">
              <DocumentTextIcon className="h-4 w-4 mr-2" />
              Action suggérée
            </h5>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-blue-700">{suggestedAction.reason}</span>
                <div className="text-xs text-blue-600 mt-1">
                  Passer à: <strong>{suggestedAction.label}</strong>
                </div>
              </div>
              <button
                onClick={() => handleStatusChange(suggestedAction.key)}
                disabled={changing}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </div>
        )}

        {/* Transitions disponibles */}
        {hasAvailableActions && (
          <div>
            <h4 className="font-medium text-neutral-900 dark:text-white mb-3 flex items-center">
              <ArrowRightIcon className="h-4 w-4 mr-2" />
              Actions disponibles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableTransitions.map((transition) => {
                const validation = validateTransition(transition.key);
                
                return (
                  <button
                    key={transition.key}
                    onClick={() => openConfirmModal(transition)}
                    disabled={changing || !validation.valid}
                    className={`
                      p-3 text-left border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                      ${validation.valid
                        ? 'border-neutral-300 dark:border-neutral-600 hover:border-blue-500 hover:bg-blue-50'
                        : 'border-red-300 bg-error-50'
                      }
                    `}
                    title={validation.valid ? transition.description : validation.error}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white">
                          {transition.label}
                        </div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
                          {transition.description}
                        </div>
                      </div>
                      
                      <span className={`
                        px-2 py-1 rounded text-xs border
                        ${getStatusColorClass(transition.color)}
                      `}>
                        {transition.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Aucune action disponible */}
        {!hasAvailableActions && (
          <div className="text-center py-6 text-neutral-500 dark:text-neutral-400">
            <ClockIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>Aucune action disponible pour ce dossier</p>
            <p className="text-sm mt-1">
              Le workflow est peut-être terminé ou vous n&apos;avez pas les permissions nécessaires.
            </p>
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      {showConfirmModal && selectedTransition && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl dark:shadow-secondary-900/30 max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Confirmer le changement de statut
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-2">
                    Changer le statut de <strong>{currentStatusInfo?.label}</strong> vers:
                  </p>
                  <span className={`
                    px-3 py-1.5 rounded text-sm font-medium border
                    ${getStatusColorClass(selectedTransition.color)}
                  `}>
                    {selectedTransition.label}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
                    Raison du changement (optionnel)
                  </label>
                  <textarea
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Expliquer la raison de ce changement..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-neutral-700 bg-white dark:bg-neutral-800 border border-neutral-300 rounded-lg hover:bg-neutral-50 dark:bg-neutral-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleStatusChange(selectedTransition.key, reason)}
                disabled={changing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {changing ? 'Changement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

StatusWorkflowManager.propTypes = {
  dossier: PropTypes.object.isRequired,
  user: PropTypes.object,
  showHistory: PropTypes.bool,
  showValidation: PropTypes.bool,
  showSuggestions: PropTypes.bool,
  compact: PropTypes.bool,
  onStatusChange: PropTypes.func
};

export default StatusWorkflowManager;