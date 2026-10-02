import React from 'react';
import { motion } from 'framer-motion';
import { 
  EyeIcon, 
  UserIcon,
  DocumentTextIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';

const DossierCard = ({ 
  dossier, 
  onView, 
  actions, 
  showClient = true,
  showDate = true,
  showDetails = true,
  animationDelay = 0,
}) => {
  const statusColor = getStatusColor(dossier.statut || dossier.status || 'nouveau');
  const statusLabel = getStatusLabel(dossier.statut || dossier.status || 'nouveau');

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.3,
        delay: animationDelay,
        ease: 'easeOut'
      }
    },
    hover: {
      y: -4,
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Header avec statut */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {dossier.numero_dossier || dossier.reference || `#${dossier.id}`}
          </h3>
        </div>
        
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: animationDelay + 0.1, type: 'spring', stiffness: 200 }}
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}
        >
          {statusLabel}
        </motion.span>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Client */}
        {showClient && (dossier.nom_client || dossier.client) && (
          <div className="flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span className="text-gray-700 dark:text-gray-300 truncate">
              {dossier.nom_client || dossier.client}
            </span>
          </div>
        )}

        {/* Date */}
        {showDate && dossier.date_creation && (
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span className="text-gray-500 dark:text-gray-400">
              {new Date(dossier.date_creation).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        )}

        {/* Détails supplémentaires */}
        {showDetails && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
              {dossier.quantite && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Qté:</span>
                  <span>{dossier.quantite}</span>
                </div>
              )}
              {dossier.format && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Format:</span>
                  <span>{dossier.format}</span>
                </div>
              )}
              {dossier.couleur && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Couleur:</span>
                  <span>{dossier.couleur}</span>
                </div>
              )}
              {dossier.finition && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">Finition:</span>
                  <span>{dossier.finition}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {actions}
        
        {onView && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onView(dossier)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
            Voir détails
          </motion.button>
        )}
      </div>

      {/* Animation de pulsation pour les statuts urgents */}
      {(dossier.statut === 'a_revoir' || dossier.urgent) && (
        <motion.div
          className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
};

export default DossierCard;
