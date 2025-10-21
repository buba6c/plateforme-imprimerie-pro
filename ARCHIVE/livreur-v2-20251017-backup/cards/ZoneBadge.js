import React from 'react';
import PropTypes from 'prop-types';

/**
 * Badge de zone de livraison moderne pour l'interface Livreur V2
 * Composant optimisé avec gestion des zones géographiques
 */
const ZoneBadge = ({ 
  zone, 
  size = 'sm', 
  className = '', 
  showIcon = true, 
  showLabel = true,
  variant = 'default'
}) => {
  // Configuration des zones avec améliorations visuelles
  const zoneConfigs = {
    paris: {
      bg: 'bg-purple-100 dark:bg-purple-800/40',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-600',
      label: 'Paris',
      icon: '🏙️',
      description: 'Paris intramuros'
    },
    banlieue: {
      bg: 'bg-blue-100 dark:bg-blue-800/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-600',
      label: 'Banlieue',
      icon: '🏘️',
      description: 'Banlieue proche'
    },
    petite_couronne: {
      bg: 'bg-indigo-100 dark:bg-indigo-800/40',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-600',
      label: 'Petite Couronne',
      icon: '🌆',
      description: '92, 93, 94'
    },
    grande_couronne: {
      bg: 'bg-emerald-100 dark:bg-emerald-800/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-600',
      label: 'Grande Couronne',
      icon: '🌳',
      description: '77, 78, 91, 95'
    },
    idf: {
      bg: 'bg-teal-100 dark:bg-teal-800/40',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-600',
      label: 'Île-de-France',
      icon: '🗺️',
      description: 'Région IDF'
    },
    province: {
      bg: 'bg-orange-100 dark:bg-orange-800/40',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-600',
      label: 'Province',
      icon: '🚛',
      description: 'Hors Île-de-France'
    },
    autre: {
      bg: 'bg-slate-100 dark:bg-slate-800/60',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-600',
      label: 'Autre',
      icon: '📍',
      description: 'Zone non définie'
    }
  };

  const defaultConfig = zoneConfigs.autre;
  const config = zoneConfigs[zone] || defaultConfig;

  // Classes de taille
  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  // Variantes de style
  const variantClasses = {
    default: {
      base: 'rounded-full font-medium',
      bg: config.bg,
      text: config.text,
      border: 'border border-transparent'
    },
    outlined: {
      base: 'rounded-full font-medium bg-transparent',
      bg: 'bg-transparent hover:' + config.bg,
      text: config.text,
      border: 'border-2 ' + config.border
    },
    subtle: {
      base: 'rounded-md font-medium',
      bg: config.bg.replace('100', '50').replace('800/40', '800/20'),
      text: config.text,
      border: 'border border-transparent'
    }
  };

  const variantClass = variantClasses[variant] || variantClasses.default;

  // Classes de base
  const baseClasses = [
    'inline-flex items-center justify-center',
    'transition-all duration-200',
    'hover:shadow-sm',
    variantClass.base,
    variantClass.bg,
    variantClass.text,
    variantClass.border,
    sizeClass
  ];

  // Ajouter les classes personnalisées
  if (className) {
    baseClasses.push(className);
  }

  return (
    <span 
      className={baseClasses.join(' ')}
      title={`Zone: ${config.label} - ${config.description}`}
    >
      {showLabel && (
        <span className="font-semibold truncate text-xs">
          {config.label}
        </span>
      )}
    </span>
  );
};

ZoneBadge.propTypes = {
  zone: PropTypes.oneOf([
    'paris',
    'banlieue',
    'petite_couronne',
    'grande_couronne',
    'idf',
    'province',
    'autre'
  ]).isRequired,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  className: PropTypes.string,
  showIcon: PropTypes.bool,
  showLabel: PropTypes.bool,
  variant: PropTypes.oneOf(['default', 'outlined', 'subtle'])
};

export default React.memo(ZoneBadge);