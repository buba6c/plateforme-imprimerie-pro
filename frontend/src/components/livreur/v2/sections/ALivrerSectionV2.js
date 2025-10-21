/**
 * 📦 ALivrerSectionV2 - Section des dossiers à livrer
 * Affichage des dossiers prêts pour livraison avec les nouveaux composants modernes
 */

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TruckIcon, FireIcon } from '@heroicons/react/24/outline';
import { DeliveryDossierCardV2 } from '../cards';
import { EmptyState, LoadingState } from '../common';

const ALivrerSectionV2 = memo(({
  dossiers = [],
  loading = false,
  refreshing = false,
  onProgrammer,
  onVoirDetails,
  onNavigation,
  onAppel,
  viewMode = 'cards'
}) => {

  // Calcul des statistiques
  const stats = useMemo(() => {
    const urgent = dossiers.filter(d => d.isUrgentDelivery).length;
    const totalDistance = dossiers.reduce((sum, d) => sum + (d.distance || 0), 0);
    const avgTime = dossiers.length > 0 
      ? Math.round(dossiers.reduce((sum, d) => sum + (d.estimatedTime || 0), 0) / dossiers.length)
      : 0;

    return {
      total: dossiers.length,
      urgent,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgTime
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
        icon="✅"
        title="Aucun dossier à livrer"
        description="Tous les dossiers imprimés ont été programmés pour livraison"
        variant="success"
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
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <TruckIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Dossiers à Livrer
              </h2>
              <p className="text-sm text-gray-600">
                {stats.total} dossier{stats.total > 1 ? 's' : ''} prêt{stats.total > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Indicateur de rafraîchissement */}
          {refreshing && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
              <span className="text-sm font-medium">Mise à jour...</span>
            </div>
          )}

          {/* Badge urgents */}
          {stats.urgent > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <FireIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-sm font-bold text-red-700 dark:text-red-300">
                {stats.urgent} urgent{stats.urgent > 1 ? 's' : ''}
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
            onStartDelivery={onProgrammer}
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
        className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-100"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {stats.total}
            </p>
            <p className="text-blue-700 font-semibold text-xs">
              Dossiers
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {stats.urgent}
            </p>
            <p className="text-orange-700 font-semibold text-xs">
              Urgents
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {stats.totalDistance}km
            </p>
            <p className="text-green-700 font-semibold text-xs">
              Distance
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              ~{stats.avgTime}min
            </p>
            <p className="text-purple-700 font-semibold text-xs">
              Temps moyen
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

ALivrerSectionV2.displayName = 'ALivrerSectionV2';

export default ALivrerSectionV2;
