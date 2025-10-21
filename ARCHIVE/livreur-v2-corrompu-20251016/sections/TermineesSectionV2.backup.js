/**
 * ✅ TermineesSectionV2 - Section des livraisons terminées
 * Affichage des livraisons terminées
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const TermineesSectionV2 = memo(({
  dossiers = [],
  onVoirDetails,
  onNavigation,
  onAppel,
  viewMode = 'cards',
  refreshing = false
}) => {

  if (!dossiers || dossiers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className=\"bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center\"
      >
        <div className=\"w-24 h-24 mx-auto mb-6 bg-green-50 rounded-full flex items-center justify-center\">
          <CheckCircleIcon className=\"h-12 w-12 text-green-400\" />
        </div>
        <h3 className=\"text-xl font-semibold text-gray-700 mb-2\">
          Aucune livraison terminée
        </h3>
        <p className=\"text-gray-500 mb-4\">
          Vos livraisons terminées apparaîtront ici
        </p>
        <div className=\"text-4xl mb-4\">✅✨</div>
      </motion.div>
    );
  }

  return (
    <div className=\"space-y-6\">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className=\"bg-white rounded-2xl shadow-sm border border-gray-100 p-6\"
      >
        <div className=\"flex items-center gap-4\">
          <div className=\"p-3 bg-green-100 rounded-xl\">
            <CheckCircleIcon className=\"h-8 w-8 text-green-600\" />
          </div>
          <div>
            <h2 className=\"text-2xl font-bold text-gray-900\">
              Livraisons Terminées
            </h2>
            <p className=\"text-gray-600\">
              {dossiers.length} livraison{dossiers.length > 1 ? 's' : ''} terminée{dossiers.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </motion.div>

      <div className=\"bg-green-50 rounded-2xl p-8 text-center border border-green-200\">
        <p className=\"text-lg text-green-700 font-medium\">
          Section en développement...
        </p>
        <p className=\"text-green-600 mt-2\">
          L'historique des livraisons terminées sera bientôt disponible
        </p>
      </div>
    </div>
  );
});

TermineesSectionV2.displayName = 'TermineesSectionV2';

export default TermineesSectionV2;