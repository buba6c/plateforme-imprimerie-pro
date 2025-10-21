/**
 * 📄 DossierDetailsModalV2 - Modale des détails de dossier
 */

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline';

const DossierDetailsModalV2 = memo(({
  dossier = null,
  isOpen = false,
  onClose,
  availableActions = [],
  onAction
}) => {
  if (!isOpen || !dossier) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DocumentIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Détails du Dossier</h3>
                <p className="text-gray-600 text-sm">{dossier.displayNumber}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Informations Client</h4>
                <p className="text-gray-700">{dossier.displayClient}</p>
                <p className="text-gray-600 text-sm">{dossier.displayAdresse}</p>
                {dossier.displayTelephone && (
                  <p className="text-gray-600 text-sm">{dossier.displayTelephone}</p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Statut de livraison</h4>
                <p className="text-gray-700">{dossier.deliveryStatus}</p>
              </div>

              <div className="bg-purple-50 rounded-xl p-6 text-center border border-purple-200">
                <div className="text-6xl mb-4">📄</div>
                <p className="text-purple-700">Interface détaillée en développement...</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

DossierDetailsModalV2.displayName = 'DossierDetailsModalV2';

export default DossierDetailsModalV2;
