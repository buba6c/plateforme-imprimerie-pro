import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

/**
 * Composant EmptyState réutilisable pour afficher les états vides
 * Utilisé dans toutes les sections quand il n'y a pas de données
 */
const EmptyState = ({
  icon = '📦',
  title = 'Aucune donnée',
  description = 'Il n\'y a rien à afficher pour le moment',
  action = null,
  variant = 'default',
  className = ''
}) => {
  // Variantes de style
  const variants = {
    default: {
      bg: 'bg-white dark:bg-neutral-800',
      iconBg: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-400 dark:text-blue-500',
      titleColor: 'text-gray-700 dark:text-gray-200',
      descColor: 'text-gray-500 dark:text-gray-400'
    },
    success: {
      bg: 'bg-white dark:bg-neutral-800',
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
      iconColor: 'text-emerald-400 dark:text-emerald-500',
      titleColor: 'text-gray-700 dark:text-gray-200',
      descColor: 'text-gray-500 dark:text-gray-400'
    },
    warning: {
      bg: 'bg-white dark:bg-neutral-800',
      iconBg: 'bg-amber-50 dark:bg-amber-900/20',
      iconColor: 'text-amber-400 dark:text-amber-500',
      titleColor: 'text-gray-700 dark:text-gray-200',
      descColor: 'text-gray-500 dark:text-gray-400'
    },
    info: {
      bg: 'bg-white dark:bg-neutral-800',
      iconBg: 'bg-cyan-50 dark:bg-cyan-900/20',
      iconColor: 'text-cyan-400 dark:text-cyan-500',
      titleColor: 'text-gray-700 dark:text-gray-200',
      descColor: 'text-gray-500 dark:text-gray-400'
    }
  };

  const style = variants[variant] || variants.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        ${style.bg}
        rounded-2xl shadow-sm border border-gray-100 dark:border-neutral-700
        p-12 text-center
        ${className}
      `}
    >
      {/* Icône */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className={`
          w-24 h-24 mx-auto mb-6
          ${style.iconBg}
          rounded-full flex items-center justify-center
        `}
      >
        <span className="text-5xl" role="img" aria-label="icon">
          {icon}
        </span>
      </motion.div>

      {/* Titre */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className={`text-xl font-semibold ${style.titleColor} mb-2`}
      >
        {title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className={`${style.descColor} mb-4 max-w-md mx-auto`}
      >
        {description}
      </motion.p>

      {/* Action optionnelle */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-6"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'success', 'warning', 'info']),
  className: PropTypes.string
};

export default React.memo(EmptyState);