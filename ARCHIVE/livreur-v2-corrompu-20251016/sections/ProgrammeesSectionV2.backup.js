/**
 * 🚚 ProgrammeesSectionV2 - Section des livraisons programmées
 * Affichage des livraisons en cours
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { TruckIcon } from '@heroicons/react/24/outline';

const ProgrammeesSectionV2 = memo(({
  dossiers = [],
  onModifier,
  onValider,
  onVoirDetails,
  onNavigation,
  onAppel,
  viewMode = 'cards',
  refreshing = false,
  actionLoading = {}
}) => {

  if (!dossiers || dossiers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className=\"bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center\"
      >
        <div className=\"w-24 h-24 mx-auto mb-6 bg-orange-50 rounded-full flex items-center justify-center\">
          <TruckIcon className=\"h-12 w-12 text-orange-400\" />
        </div>
        <h3 className=\"text-xl font-semibold text-gray-700 mb-2\">
          Aucune livraison programmée
        </h3>
        <p className=\"text-gray-500 mb-4\">
          Les livraisons programmées apparaîtront ici
        </p>
        <div className=\"text-4xl mb-4\">🚚✨</div>
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
          <div className=\"p-3 bg-orange-100 rounded-xl\">
            <TruckIcon className=\"h-8 w-8 text-orange-600\" />
          </div>
          <div>
            <h2 className=\"text-2xl font-bold text-gray-900\">
              Livraisons Programmées
            </h2>
            <p className=\"text-gray-600\">
              {dossiers.length} livraison{dossiers.length > 1 ? 's' : ''} en cours
            </p>
          </div>
        </div>
      </motion.div>

      <div className=\"bg-orange-50 rounded-2xl p-8 text-center border border-orange-200\">
        <p className=\"text-lg text-orange-700 font-medium\">
          Section en développement...
        </p>
        <p className=\"text-orange-600 mt-2\">
          L'interface des livraisons programmées sera bientôt disponible
        </p>
      </div>
    </div>
  );
});

ProgrammeesSectionV2.displayName = 'ProgrammeesSectionV2';

export default ProgrammeesSectionV2;