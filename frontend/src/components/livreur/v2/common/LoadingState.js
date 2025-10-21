/**
 * 🔄 Composant LoadingState
 * Affichage d'un état de chargement avec spinner animé
 */

import React from 'react';
import { motion } from 'framer-motion';

const LoadingState = ({ message = 'Chargement en cours...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full`}
      />
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-gray-600 text-center"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};

export default LoadingState;
