/**
 * ✅ TermineesSectionV2 - Section des livraisons terminées
 * Affichage de l'historique des livraisons réalisées et échecs
 */

import React, { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { DeliveryDossierCardV2 } from '../cards';
import { EmptyState, LoadingState } from '../common';

const TermineesSectionV2 = memo(({
  dossiers = [],
  loading = false,
  refreshing = false,
  onVoirDetails,
  onReessayer,
  viewMode = 'cards'
}) => {

  const [filterType, setFilterType] = useState('all'); // all, livre, echec, retour

  // Filtrage et calcul des statistiques
  const { filteredDossiers, stats } = useMemo(() => {
    // Filtrage
    let filtered = dossiers;
    if (filterType !== 'all') {
      filtered = dossiers.filter(d => {
        if (filterType === 'livre') return d.deliveryStatus === 'livre';
        if (filterType === 'echec') return d.deliveryStatus === 'echec_livraison';
        if (filterType === 'retour') return d.deliveryStatus === 'retour';
        return true;
      });
    }

    // Statistiques
    const livre = dossiers.filter(d => d.deliveryStatus === 'livre').length;
    const echec = dossiers.filter(d => d.deliveryStatus === 'echec_livraison').length;
    const retour = dossiers.filter(d => d.deliveryStatus === 'retour').length;
    const successRate = dossiers.length > 0 
      ? Math.round((livre / dossiers.length) * 100)
      : 0;

    return {
      filteredDossiers: filtered,
      stats: {
        total: dossiers.length,
        livre,
        echec,
        retour,
        successRate
      }
    };
  }, [dossiers, filterType]);

  // Affichage du chargement initial
  if (loading) {
    return <LoadingState type="skeleton" />;
  }

  // Affichage de l'état vide
  if (!dossiers || dossiers.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="Aucune livraison terminée"
        description="Les livraisons terminées apparaîtront ici"
        variant="info"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête de section avec statistiques et filtres */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
      >
        <div className="space-y-4">
          {/* Titre et compteur */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Livraisons Terminées
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {filteredDossiers.length} sur {stats.total} livraison{stats.total > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Indicateur de rafraîchissement */}
            {refreshing && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="w-4 h-4 border-2 border-green-200 dark:border-green-800 border-t-green-600 dark:border-t-green-400 rounded-full animate-spin" />
                <span className="text-sm font-medium">Mise à jour...</span>
              </div>
            )}

            {/* Taux de réussite */}
            {stats.successRate > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {stats.successRate}% de réussite
                </span>
              </div>
            )}
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Filtrer :
            </span>
            
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tout', count: stats.total, color: 'gray' },
                { value: 'livre', label: 'Livrés', count: stats.livre, color: 'green' },
                { value: 'echec', label: 'Échecs', count: stats.echec, color: 'red' },
                { value: 'retour', label: 'Retours', count: stats.retour, color: 'amber' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${filterType === filter.value
                      ? `bg-${filter.color}-600 dark:bg-${filter.color}-700 text-white shadow-sm`
                      : `bg-${filter.color}-100 dark:bg-${filter.color}-900/30 text-${filter.color}-700 dark:text-${filter.color}-300 hover:bg-${filter.color}-200 dark:hover:bg-${filter.color}-900/50`
                    }
                  `}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grille des dossiers */}
      {filteredDossiers.length > 0 ? (
        <>
          <div className={`${
            viewMode === 'cards' 
              ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' 
              : 'space-y-4'
          }`}>
            {filteredDossiers.map((dossier, index) => (
              <DeliveryDossierCardV2
                key={dossier.id || `dossier-${index}`}
                dossier={dossier}
                index={index}
                onShowDetails={onVoirDetails}
                onStartDelivery={dossier.deliveryStatus !== 'livre' ? onReessayer : undefined}
                showActions={dossier.deliveryStatus !== 'livre'}
                showMetadata={true}
              />
            ))}
          </div>

          {/* Résumé statistiques */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-green-100 dark:border-green-800"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.livre}
                </p>
                <p className="text-green-700 dark:text-green-300 font-medium text-sm">
                  Livrés
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {stats.echec}
                </p>
                <p className="text-red-700 dark:text-red-300 font-medium text-sm">
                  Échecs
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.retour}
                </p>
                <p className="text-amber-700 dark:text-amber-300 font-medium text-sm">
                  Retours
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.successRate}%
                </p>
                <p className="text-emerald-700 dark:text-emerald-300 font-medium text-sm">
                  Taux de réussite
                </p>
              </div>
            </div>
          </motion.div>
        </>
      ) : (
        <EmptyState
          icon="🔍"
          title="Aucun résultat"
          description={`Aucune livraison ${filterType !== 'all' ? `avec le statut "${filterType}"` : ''} trouvée`}
          variant="info"
        />
      )}
    </div>
  );
});

TermineesSectionV2.displayName = 'TermineesSectionV2';

export default TermineesSectionV2;