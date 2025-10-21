/**
 * 📭 Composant EmptyState
 * Affichage d'un état vide avec message et action optionnelle
 */

import React from 'react';
import { motion } from 'framer-motion';
import { InboxIcon } from '@heroicons/react/24/outline';

const EmptyState = ({ 
  icon: Icon = InboxIcon,
  title = 'Aucun élément',
  message = 'Il n y a rien à afficher pour le moment',
  actionLabel,
  onAction
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="bg-gray-100 rounded-full p-6 mb-4">
        <Icon className="h-12 w-12 text-gray-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      
      <p className="text-gray-600 max-w-md mb-6">
        {message}
      </p>
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;
