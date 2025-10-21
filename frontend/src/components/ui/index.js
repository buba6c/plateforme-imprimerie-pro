import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';

// ============================================================================
// TOOLTIP - Info-bulle contextuelle
// ============================================================================
export const Tooltip = ({ children, content, position = 'top', delay = 200 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-neutral-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-neutral-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-neutral-900',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-neutral-900',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && content && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 px-3 py-2 text-xs font-medium text-white bg-neutral-900 dark:bg-neutral-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none ${positionClasses[position]}`}
          >
            {content}
            <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// CONFIRMATION MODAL - Modale de confirmation pour actions critiques
// ============================================================================
export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info', // info, warning, danger
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isLoading = false,
}) => {
  const typeStyles = {
    info: {
      icon: InformationCircleIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    danger: {
      icon: ExclamationCircleIcon,
      color: 'text-red-600',
      bg: 'bg-red-50',
      button: 'bg-red-600 hover:bg-red-700',
    },
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  // Gestion du focus trap
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={!isLoading ? onClose : undefined}
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icône */}
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${style.bg} mb-4`}>
              <Icon className={`h-6 w-6 ${style.color}`} />
            </div>

            {/* Contenu */}
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white text-center mb-2">
              {title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 text-center mb-6">
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${style.button}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Chargement...
                  </span>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// EMPTY STATE - État vide avec illustration
// ============================================================================
export const EmptyState = ({
  icon: Icon,
  title = "Aucun élément",
  description = "Il n'y a rien à afficher pour le moment",
  action,
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    {Icon && (
      <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
        <Icon className="h-12 w-12 text-neutral-400 dark:text-neutral-500" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">{title}</h3>
    <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-sm">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
      >
        <PlusCircleIcon className="h-5 w-5" />
        {action.label || "Créer"}
      </button>
    )}
  </div>
);

// ============================================================================
// SKELETON LOADERS - Placeholders de chargement
// ============================================================================
export const SkeletonCard = () => (
  <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
      </div>
      <div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
    </div>
    <div className="space-y-3">
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6"></div>
    </div>
  </div>
);

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"
        style={{ width: i === lines - 1 ? '75%' : '100%' }}
      />
    ))}
  </div>
);

// ============================================================================
// LOADING SPINNER - Indicateur de chargement
// ============================================================================
export const LoadingSpinner = ({ size = 'md', text, className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  if (text) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className={`${sizeClasses[size]} ${className}`}>
          <svg className="animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <p className="text-neutral-600 dark:text-neutral-300 font-medium">{text}</p>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

export const LoadingOverlay = ({ message = "Chargement en cours..." }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
      <div className="flex flex-col items-center">
        <LoadingSpinner size="lg" className="text-blue-600 mb-4" />
        <p className="text-neutral-900 dark:text-white font-medium">{message}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          Veuillez patienter...
        </p>
      </div>
    </div>
  </div>
);

// ============================================================================
// BADGE - Badge pour statuts et étiquettes
// ============================================================================
export const Badge = ({ 
  children, 
  variant = 'default', 
  size = 'md',
  className = '' 
}) => {
  const variants = {
    default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
    primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
};

// ============================================================================
// BUTTON - Bouton amélioré avec variants et dégradés
// ============================================================================
export const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  className = '',
  ...props
}) => {
  const variants = {
    primary: `
      bg-gradient-to-r from-blue-600 to-cyan-500
      hover:from-blue-700 hover:to-cyan-600
      text-white font-semibold
      shadow-md hover:shadow-lg hover:shadow-cyan-500/50
      active:scale-95
    `,
    secondary: `
      bg-white dark:bg-neutral-800
      border-2 border-blue-500
      text-blue-600 dark:text-blue-400
      hover:bg-blue-50 dark:hover:bg-neutral-700
      font-medium
    `,
    success: `
      bg-gradient-to-r from-green-500 to-emerald-500
      hover:from-green-600 hover:to-emerald-600
      text-white font-semibold
      shadow-md hover:shadow-lg hover:shadow-green-500/50
      active:scale-95
    `,
    danger: `
      bg-gradient-to-r from-red-500 to-pink-500
      hover:from-red-600 hover:to-pink-600
      text-white font-semibold
      shadow-md hover:shadow-lg hover:shadow-red-500/50
      active:scale-95
    `,
    neutral: `
      bg-neutral-100 dark:bg-neutral-800
      text-neutral-700 dark:text-neutral-200
      hover:bg-neutral-200 dark:hover:bg-neutral-700
      font-medium
    `,
    ghost: `
      bg-transparent
      text-blue-600 dark:text-blue-400
      hover:bg-blue-50 dark:hover:bg-blue-900/20
      font-medium
    `,
    outline: `
      bg-transparent
      border-2 border-blue-600 dark:border-blue-400
      text-blue-600 dark:text-blue-400
      hover:bg-blue-50 dark:hover:bg-blue-900/20
    `,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-8 py-3.5 text-lg rounded-xl',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Chargement...</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

export default {
  Tooltip,
  ConfirmationModal,
  EmptyState,
  SkeletonCard,
  SkeletonText,
  LoadingSpinner,
  LoadingOverlay,
  Badge,
  Button,
};
