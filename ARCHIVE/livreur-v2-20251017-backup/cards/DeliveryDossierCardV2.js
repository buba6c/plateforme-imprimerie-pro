import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  MapPinIcon,
  PhoneIcon,
  PlayIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CurrencyEuroIcon,
  CalendarIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Import des badges modernes
import DeliveryStatusBadge from './DeliveryStatusBadge';
import DeliveryPriorityBadge from './DeliveryPriorityBadge';
import ZoneBadge from './ZoneBadge';

/**
 * Carte de dossier de livraison moderne pour l'interface Livreur V2
 * Composant optimisé avec interactions avancées et UI moderne
 */
const DeliveryDossierCardV2 = ({
  dossier,
  index = 0,
  onStartDelivery,
  onShowDetails,
  onNavigateToAddress,
  onCallClient,
  onMarkComplete,
  onMarkFailed,
  onReschedule,
  layout = 'default',
  showActions = true,
  showMetadata = true,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Données du dossier avec fallbacks
  const {
    displayNumber = 'N/A',
    displayClient = 'Client inconnu',
    displayAdresse = 'Adresse non définie',
    displayTelephone = '',
    deliveryStatus = 'imprime',
    deliveryZone = 'autre',
    deliveryPriority = 'medium',
    isUrgentDelivery = false,
    amount = null,
    estimatedTime = null,
    distance = null,
    deliveryDate = null,
    comments = null,
    retryCount = 0
  } = dossier;

  // Gestion des actions avec état de chargement
  const handleActionWithLoading = useCallback(async (action, ...args) => {
    setIsLoading(true);
    try {
      await action(...args);
    } catch (error) {
      console.error('Erreur lors de l\'action:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Actions principales selon le statut
  const getPrimaryAction = () => {
    switch (deliveryStatus) {
      case 'pret_livraison':
        return {
          icon: PlayIcon,
          label: 'DÉMARRER',
          action: () => handleActionWithLoading(onStartDelivery, dossier),
          className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          disabled: false
        };
      case 'en_livraison':
        return {
          icon: CheckCircleIcon,
          label: 'TERMINER',
          action: () => handleActionWithLoading(onMarkComplete, dossier),
          className: 'bg-blue-600 hover:bg-blue-700 text-white',
          disabled: false
        };
      default:
        return null;
    }
  };

  // Actions secondaires
  const getSecondaryActions = () => {
    const actions = [];

    if (displayTelephone) {
      actions.push({
        icon: PhoneIcon,
        label: 'Appeler',
        action: () => onCallClient?.(dossier),
        className: 'text-blue-600 hover:text-blue-700',
        tooltip: `Appeler ${displayClient}`
      });
    }

    actions.push({
      icon: MapPinIcon,
      label: 'Navigator',
      action: () => onNavigateToAddress?.(dossier),
      className: 'text-purple-600 hover:text-purple-700',
      tooltip: 'Ouvrir dans Maps'
    });

    if (deliveryStatus === 'en_livraison') {
      actions.push({
        icon: XCircleIcon,
        label: 'Échec',
        action: () => handleActionWithLoading(onMarkFailed, dossier),
        className: 'text-red-600 hover:text-red-700',
        tooltip: 'Marquer comme échec'
      });

      actions.push({
        icon: ArrowPathIcon,
        label: 'Reporter',
        action: () => handleActionWithLoading(onReschedule, dossier),
        className: 'text-amber-600 hover:text-amber-700',
        tooltip: 'Reporter la livraison'
      });
    }

    return actions;
  };

  const primaryAction = getPrimaryAction();
  const secondaryActions = getSecondaryActions();

  // Classes de style selon le statut et la priorité
  const getCardClasses = () => {
    const baseClasses = [
      'bg-white',
      'rounded-xl shadow-sm hover:shadow-md',
      'border border-gray-200',
      'transition-all duration-200',
      'overflow-hidden'
    ];

    // Bordure colorée pour les livraisons urgentes
    if (isUrgentDelivery) {
      baseClasses.push('ring-2 ring-red-200 border-red-200');
    }

    // Style selon le statut
    if (deliveryStatus === 'en_livraison') {
      baseClasses.push('ring-2 ring-orange-200 border-orange-200');
    }

    if (className) {
      baseClasses.push(className);
    }

    return baseClasses.join(' ');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={getCardClasses()}
    >
      {/* En-tête de la carte */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          {/* Informations principales */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-base font-bold text-gray-900">
                {displayNumber}
              </span>
              {isUrgentDelivery && (
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <DeliveryStatusBadge status={deliveryStatus} />
              {retryCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                  Tentative {retryCount + 1}
                </span>
              )}
            </div>

            {/* Informations client */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="font-semibold text-gray-900 truncate">
                  {displayClient}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPinIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-600 truncate">
                  {displayAdresse}
                </span>
              </div>
            </div>

            {/* Badges et métadonnées */}
            <div className="flex items-center gap-2 mt-3">
              <ZoneBadge zone={deliveryZone} size="xs" />
              {deliveryPriority && (
                <DeliveryPriorityBadge
                  priority={deliveryPriority}
                  estimatedTime={estimatedTime}
                  distance={distance}
                  size="xs"
                  layout="horizontal"
                />
              )}
            </div>
          </div>

          {/* Actions principales */}
          {showActions && (
            <div className="flex flex-col gap-2 ml-4">
              {primaryAction && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={primaryAction.action}
                  disabled={primaryAction.disabled || isLoading}
                  className={`
                    inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm
                    ${primaryAction.className}
                  `}
                >
                  <primaryAction.icon className="h-4 w-4" />
                  {isLoading ? 'Chargement...' : primaryAction.label}
                </motion.button>
              )}

              {/* Bouton détails */}
              <button
                onClick={() => onShowDetails?.(dossier)}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200"
              >
                <EyeIcon className="h-3 w-3" />
                Détails
              </button>
            </div>
          )}
        </div>

        {/* Actions secondaires */}
        {showActions && secondaryActions.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            {secondaryActions.map((action, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.action}
                title={action.tooltip}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                  transition-all duration-200 hover:bg-gray-100
                  ${action.className}
                `}
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </motion.button>
            ))}
          </div>
        )}

        {/* Métadonnées étendues (optionnelles) */}
        <AnimatePresence>
          {isExpanded && showMetadata && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-gray-100"
            >
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                {amount && (
                  <div className="flex items-center gap-2">
                    <CurrencyEuroIcon className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{amount}€</span>
                  </div>
                )}
                {deliveryDate && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{new Date(deliveryDate).toLocaleDateString()}</span>
                  </div>
                )}
                {estimatedTime && (
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">~{estimatedTime}min</span>
                  </div>
                )}
                {distance && (
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">{distance}km</span>
                  </div>
                )}
              </div>
              {comments && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs">
                  <strong className="text-blue-900 block mb-1">Commentaires :</strong>
                  <p className="text-gray-700">{comments}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle pour métadonnées */}
        {showMetadata && (amount || deliveryDate || comments) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            {isExpanded ? '▼ Masquer les détails' : '▲ Voir plus de détails'}
          </button>
        )}
      </div>
    </motion.div>
  );
};

DeliveryDossierCardV2.propTypes = {
  dossier: PropTypes.shape({
    displayNumber: PropTypes.string.isRequired,
    displayClient: PropTypes.string.isRequired,
    displayAdresse: PropTypes.string.isRequired,
    displayTelephone: PropTypes.string,
    deliveryStatus: PropTypes.string.isRequired,
    deliveryZone: PropTypes.string,
    deliveryPriority: PropTypes.string,
    isUrgentDelivery: PropTypes.bool,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    estimatedTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    distance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    deliveryDate: PropTypes.string,
    comments: PropTypes.string,
    retryCount: PropTypes.number
  }).isRequired,
  index: PropTypes.number,
  onStartDelivery: PropTypes.func,
  onShowDetails: PropTypes.func,
  onNavigateToAddress: PropTypes.func,
  onCallClient: PropTypes.func,
  onMarkComplete: PropTypes.func,
  onMarkFailed: PropTypes.func,
  onReschedule: PropTypes.func,
  layout: PropTypes.oneOf(['default', 'compact', 'expanded']),
  showActions: PropTypes.bool,
  showMetadata: PropTypes.bool,
  className: PropTypes.string
};

export default React.memo(DeliveryDossierCardV2);