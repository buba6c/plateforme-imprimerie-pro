import React from 'react';
import PropTypes from 'prop-types';

/**
 * Badge de statut de livraison moderne pour l'interface Livreur V2
 * Composant optimisé avec thème sombre et animations
 */
const DeliveryStatusBadge = ({ status, size = 'sm', className = '', showIcon = true, showLabel = true }) => {
  // Configuration des statuts avec design minimaliste
  const statusConfigs = {
    imprime: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Imprimé',
      pulse: false
    },
    pret_livraison: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Prêt',
      pulse: false
    },
    en_livraison: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      label: 'En cours',
      pulse: false
    },
    livre: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Livré',
      pulse: false
    },
    retour: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Retour',
      pulse: false
    },
    echec_livraison: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Échec',
      pulse: false
    },
    reporte: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      label: 'Reporté',
      pulse: false
    },
    annule: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Annulé',
      pulse: false
    }
  };

  // Configuration par défaut pour statuts inconnus
  const defaultConfig = {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: status || 'Inconnu',
    pulse: false
  };

  const config = statusConfigs[status] || defaultConfig;

  // Classes de taille
  const sizeClasses = {
    xs: 'text-xs px-2 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-sm px-3 py-1'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  // Classes de base
  const baseClasses = [
    'inline-flex items-center justify-center',
    'rounded-md font-semibold',
    'transition-all duration-200',
    config.bg,
    config.text,
    sizeClass
  ];

  // Ajouter les classes personnalisées
  if (className) {
    baseClasses.push(className);
  }

  return (
    <span 
      className={baseClasses.join(' ')}
      title={`Statut: ${config.label}`}
    >
      {showLabel && (
        <span className="truncate">
          {config.label}
        </span>
      )}
    </span>
  );
};

DeliveryStatusBadge.propTypes = {
  status: PropTypes.oneOf([
    'imprime',
    'pret_livraison', 
    'en_livraison',
    'livre',
    'retour',
    'echec_livraison',
    'reporte',
    'annule'
  ]).isRequired,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  className: PropTypes.string,
  showIcon: PropTypes.bool,
  showLabel: PropTypes.bool
};

export default React.memo(DeliveryStatusBadge);