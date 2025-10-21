import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

/**
 * Composant LoadingState pour les états de chargement
 * Différents types d'affichage selon le contexte
 */
const LoadingState = ({ 
  type = 'spinner', 
  message = 'Chargement...', 
  size = 'md',
  fullScreen = false,
  className = '' 
}) => {
  // Spinner circulaire
  const SpinnerLoader = () => {
    const sizes = {
      sm: 'w-6 h-6 border-2',
      md: 'w-10 h-10 border-3',
      lg: 'w-16 h-16 border-4'
    };
    
    return (
      <div className={`
        ${sizes[size]} 
        border-blue-200 dark:border-blue-800 
        border-t-blue-600 dark:border-t-blue-400 
        rounded-full animate-spin
      `} />
    );
  };

  // Dots loader
  const DotsLoader = () => (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 bg-blue-600 dark:bg-blue-400 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2
          }}
        />
      ))}
    </div>
  );

  // Skeleton loader pour cartes
  const SkeletonCards = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse"
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-1/3" />
              <div className="h-5 bg-gray-200 dark:bg-neutral-700 rounded-full w-20" />
            </div>
            
            {/* Content */}
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-2/3" />
              <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-3/4" />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <div className="h-9 bg-gray-200 dark:bg-neutral-700 rounded flex-1" />
              <div className="h-9 bg-gray-200 dark:bg-neutral-700 rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Pulse loader (simple rectangle pulsant)
  const PulseLoader = () => (
    <motion.div
      className="w-full h-64 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl"
      animate={{
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );

  // Contenu selon le type
  const renderLoader = () => {
    switch (type) {
      case 'spinner':
        return <SpinnerLoader />;
      case 'dots':
        return <DotsLoader />;
      case 'skeleton':
        return <SkeletonCards />;
      case 'pulse':
        return <PulseLoader />;
      default:
        return <SpinnerLoader />;
    }
  };

  // Container selon fullScreen
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          {renderLoader()}
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 text-gray-600 dark:text-gray-400 font-medium"
            >
              {message}
            </motion.p>
          )}
        </div>
      </div>
    );
  }

  // Type skeleton a son propre layout
  if (type === 'skeleton' || type === 'pulse') {
    return (
      <div className={className}>
        {renderLoader()}
      </div>
    );
  }

  // Container standard
  return (
    <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
      {renderLoader()}
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-gray-600 dark:text-gray-400 font-medium"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};

LoadingState.propTypes = {
  type: PropTypes.oneOf(['spinner', 'dots', 'skeleton', 'pulse']),
  message: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  fullScreen: PropTypes.bool,
  className: PropTypes.string
};

export default React.memo(LoadingState);