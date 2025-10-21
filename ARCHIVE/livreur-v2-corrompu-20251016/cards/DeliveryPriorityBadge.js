import React from 'react';
import PropTypes from 'prop-types';

/**
 * Badge de priorité de livraison moderne avec informations de distance et temps
 * Composant optimisé pour l'interface Livreur V2
 */
const DeliveryPriorityBadge = ({ 
  priority, 
  estimatedTime, 
  distance, 
  size = 'sm',
  layout = 'vertical',
  className = '',
  showDetails = true 
}) => {
  // Configuration des priorités avec améliorations visuelles
  const priorityConfigs = {
    urgent: {
      bg: 'bg-red-100 dark:bg-red-800/40',
      text: 'text-red-700 dark:text-red-300',
      label: 'URGENT',
      icon: '🔥',
      pulse: true,
      glow: 'shadow-red-200/50 dark:shadow-red-800/30'
    },
    high: {
      bg: 'bg-orange-100 dark:bg-orange-800/40',
      text: 'text-orange-700 dark:text-orange-300',
      label: 'Priorité',
      icon: '⚡',
      pulse: false,
      glow: 'shadow-orange-200/50 dark:shadow-orange-800/30'
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-800/40',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Normal',
      icon: '⏰',
      pulse: false,
      glow: 'shadow-amber-200/50 dark:shadow-amber-800/30'
    },
    low: {
      bg: 'bg-emerald-100 dark:bg-emerald-800/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      label: 'Différé',
      icon: '🟢',
      pulse: false,
      glow: 'shadow-emerald-200/50 dark:shadow-emerald-800/30'
    }
  };

  const defaultConfig = priorityConfigs.medium;
  const config = priorityConfigs[priority] || defaultConfig;

  // Classes de taille
  const sizeClasses = {
    xs: { badge: 'text-xs px-1.5 py-0.5 gap-1', details: 'text-xs' },
    sm: { badge: 'text-xs px-2 py-0.5 gap-1', details: 'text-xs' },
    md: { badge: 'text-sm px-3 py-1 gap-1.5', details: 'text-sm' },
    lg: { badge: 'text-base px-4 py-1.5 gap-2', details: 'text-base' }
  };

  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  // Classes de base pour le badge
  const badgeClasses = [
    'inline-flex items-center justify-center',
    'rounded-full font-bold uppercase tracking-wide',
    'transition-all duration-200',
    'border border-transparent',
    config.bg,
    config.text,
    sizeClass.badge
  ];

  // Animation de pulsation pour les priorités urgentes
  if (config.pulse) {
    badgeClasses.push('animate-pulse shadow-md', config.glow);
  } else {
    badgeClasses.push('hover:shadow-sm');
  }

  // Ajouter les classes personnalisées
  if (className) {
    badgeClasses.push(className);
  }

  // Formatage des détails
  const hasDetails = showDetails && (estimatedTime || distance);
  const layoutClass = layout === 'horizontal' ? 'flex-row items-center gap-3' : 'flex-col gap-1';

  return (
    <div className={`flex ${layoutClass}`}>
      {/* Badge principal */}
      <span 
        className={badgeClasses.join(' ')}
        title={`Priorité: ${config.label}`}
      >
        <span className="truncate">
          {config.label}
        </span>
      </span>

      {/* Détails (distance et temps estimé) */}
      {hasDetails && (
        <div className={`
          ${sizeClass.details} 
          text-gray-600 
          font-medium
          ${layout === 'horizontal' ? 'text-left' : 'text-center'}
        `}>
          {distance && (
            <div className="flex items-center gap-1">
              <span className="text-blue-500" aria-hidden="true">•</span>
              <span>{distance}km</span>
            </div>
          )}
          {estimatedTime && (
            <div className="flex items-center gap-1">
              <span className="text-green-500" aria-hidden="true">•</span>
              <span>~{estimatedTime}min</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

DeliveryPriorityBadge.propTypes = {
  priority: PropTypes.oneOf(['urgent', 'high', 'medium', 'low']).isRequired,
  estimatedTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  distance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  layout: PropTypes.oneOf(['vertical', 'horizontal']),
  className: PropTypes.string,
  showDetails: PropTypes.bool
};

export default React.memo(DeliveryPriorityBadge);