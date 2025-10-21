/**
 * 🚚 ProgrammeesSectionV2 - Section des livraisons en cours
 * Affichage des dossiers actuellement en livraison
 */

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TruckIcon } from '@heroicons/react/24/outline';
import { DeliveryDossierCardV2 } from '../cards';
import { EmptyState, LoadingState } from '../common';

const ProgrammeesSectionV2 = memo(({
  dossiers = [],
  loading = false,
  refreshing = false,
  onValider,
  onEchec,
  onReporter,
  onVoirDetails,
  onNavigation,
  onAppel,
  viewMode = 'cards'
}) => {

  // Calcul des statistiques
  const stats = useMemo(() => {
    const totalDistance = dossiers.reduce((sum, d) => sum + (d.distance || 0), 0);
    const totalTime = dossiers.reduce((sum, d) => sum + (d.estimatedTime || 0), 0);
    const avgProgress = dossiers.length > 0
      ? Math.round(dossiers.reduce((sum, d) => sum + (d.progress || 0), 0) / dossiers.length)
      : 0;

    return {
      total: dossiers.length,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime: Math.round(totalTime),
      avgProgress
    };
  }, [dossiers]);

  // Affichage du chargement initial
  if (loading) {
    return <LoadingState type="skeleton" />;
  }

  // Affichage de l'état vide
  if (!dossiers || dossiers.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Aucune livraison en cours"
        description="Programmez des dossiers pour commencer vos tournées"
        variant="default"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête de section avec statistiques */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Titre et compteur */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <TruckIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Livraisons en cours
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {stats.total} livraison{stats.total > 1 ? 's' : ''} en cours de réalisation
              </p>
            </div>
          </div>

          {/* Indicateur de rafraîchissement */}
          {refreshing && (
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <div className="w-4 h-4 border-2 border-orange-200 dark:border-orange-800 border-t-orange-600 dark:border-t-orange-400 rounded-full animate-spin" />
              <span className="text-sm font-medium">Mise à jour...</span>
            </div>
          )}

          {/* Badge progression moyenne */}
          {stats.avgProgress > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <div className="w-20 h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300"
                  style={{ width: `${stats.avgProgress}%` }}
                />
              </div>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                {stats.avgProgress}%
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Grille des dossiers */}
      <div className={`${
        viewMode === 'cards' 
          ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' 
          : 'space-y-4'
      }`}>
        {dossiers.map((dossier, index) => (
          <DeliveryDossierCardV2
            key={dossier.id || `dossier-${index}`}
            dossier={dossier}
            index={index}
            onMarkComplete={onValider}
            onMarkFailed={onEchec}
            onReschedule={onReporter}
            onShowDetails={onVoirDetails}
            onNavigateToAddress={onNavigation}
            onCallClient={onAppel}
            showActions={true}
            showMetadata={true}
          />
        ))}
      </div>

      {/* Résumé statistiques */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl p-6 border border-orange-100 dark:border-orange-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {stats.total}
            </p>
            <p className="text-orange-700 dark:text-orange-300 font-medium text-sm">
              En cours
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.totalDistance}km
            </p>
            <p className="text-green-700 dark:text-green-300 font-medium text-sm">
              Distance restante
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              ~{stats.totalTime}min
            </p>
            <p className="text-purple-700 dark:text-purple-300 font-medium text-sm">
              Temps estimé
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

ProgrammeesSectionV2.displayName = 'ProgrammeesSectionV2';

export default ProgrammeesSectionV2;
