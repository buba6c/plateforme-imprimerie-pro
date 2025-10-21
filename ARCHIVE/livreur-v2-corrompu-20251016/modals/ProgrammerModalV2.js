/**
 * 📅 ProgrammerModalV2 - Modale de programmation de livraison
 * Interface moderne pour programmer une livraison
 */

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

const ProgrammerModalV2 = memo(({
  dossier = null,
  isOpen = false,
  onClose,
  onProgrammer,
  onModifier,
  loading = false
}) => {

  if (!isOpen || !dossier) return null;

  const isModification = dossier.deliveryStatus === 'en_livraison';

  return (
    <AnimatePresence>
      <div className=\"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50\">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className=\"bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto\"
        >
          {/* Header */}
          <div className=\"flex items-center justify-between p-6 border-b border-gray-100\">
            <div className=\"flex items-center gap-3\">
              <div className=\"p-2 bg-blue-100 rounded-lg\">
                <CalendarDaysIcon className=\"h-6 w-6 text-blue-600\" />
              </div>
              <div>
                <h3 className=\"text-xl font-bold text-gray-900\">
                  {isModification ? 'Modifier Livraison' : 'Programmer Livraison'}
                </h3>
                <p className=\"text-gray-600 text-sm\">
                  {dossier.displayNumber} • {dossier.displayClient}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className=\"p-2 hover:bg-gray-100 rounded-lg transition-colors\"
            >
              <XMarkIcon className=\"h-6 w-6 text-gray-500\" />
            </button>
          </div>

          {/* Content */}
          <div className=\"p-6\">
            <div className=\"bg-blue-50 rounded-xl p-6 text-center border border-blue-200\">
              <div className=\"text-6xl mb-4\">📅</div>
              <h4 className=\"text-lg font-semibold text-blue-800 mb-2\">
                Modale en développement
              </h4>
              <p className=\"text-blue-600\">
                L'interface de programmation des livraisons sera bientôt disponible avec :
              </p>
              <ul className=\"text-left text-blue-700 mt-4 space-y-1 text-sm\">
                <li>• Sélection de date et heure</li>
                <li>• Vérification d'adresse</li>
                <li>• Instructions de livraison</li>
                <li>• Confirmation client</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className=\"flex gap-3 p-6 border-t border-gray-100\">
            <button
              onClick={onClose}
              className=\"flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors\"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                // Simulation de programmation
                if (isModification && onModifier) {
                  onModifier(dossier, {
                    date_livraison_prevue: new Date().toISOString(),
                    adresse_livraison: dossier.displayAdresse
                  });
                } else if (onProgrammer) {
                  onProgrammer(dossier, {
                    date_livraison_prevue: new Date().toISOString(),
                    adresse_livraison: dossier.displayAdresse
                  });
                }
              }}
              disabled={loading}
              className=\"flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold\"
            >
              {loading ? 'En cours...' : (isModification ? 'Modifier' : 'Programmer')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

ProgrammerModalV2.displayName = 'ProgrammerModalV2';

export default ProgrammerModalV2;