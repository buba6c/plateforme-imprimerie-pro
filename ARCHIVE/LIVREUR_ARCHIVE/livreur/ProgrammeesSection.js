import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DossierCard from './DossierCard';

const ProgrammeesSection = ({ dossiers, onModifier, onValider, onVoirDetails, refreshing }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 border border-neutral-100">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
          🚚 Livraisons programmées
          <span className="text-lg font-normal text-neutral-500 dark:text-neutral-400 ml-3">({dossiers.length})</span>
        </h2>
        <p className="text-neutral-600 dark:text-neutral-300 mt-2">
          Livraisons planifiées en attente de validation
        </p>
      </div>

      {/* Grid de cartes */}
      {dossiers.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-12 shadow-lg dark:shadow-secondary-900/25 text-center">
          <div className="text-6xl mb-4">🚚</div>
          <h3 className="text-xl font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
            Aucune livraison programmée
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400">
            Toutes les livraisons sont terminées
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {dossiers.map((dossier, index) => (
              <DossierCard
                key={dossier.id}
                dossier={dossier}
                index={index}
                onModifier={onModifier}
                onValider={onValider}
                onVoirDetails={onVoirDetails}
                type="programmees"
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default ProgrammeesSection;
