/**
 * 📦 ALivrerSectionV2 - Section des dossiers à livrer
 * Affichage des dossiers prêts pour livraison avec les nouveaux composants modernes
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { TruckIcon } from '@heroicons/react/24/outline';
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

  // Composant de carte de dossier
  const DossierCard = ({ dossier, index }) => {
    const statusConfig = STATUS_CONFIGS[dossier.deliveryStatus] || STATUS_CONFIGS.imprime;
    const zoneConfig = ZONE_CONFIGS[dossier.deliveryZone] || ZONE_CONFIGS.autre;
    const priorityConfig = PRIORITY_CONFIGS[dossier.deliveryPriority] || PRIORITY_CONFIGS.low;
    
    const isLoading = actionLoading[`programmer_${dossier.id}`];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          delay: index * 0.05,
          duration: 0.3,
          type: "spring",
          stiffness: 120
        }}
        className={`bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden group ${
          dossier.isUrgentDelivery ? 'ring-2 ring-red-200' : ''
        }`}
      >
        {/* Barre de priorité */}
        <div className={`h-2 ${priorityConfig.bgColor.replace('bg-', 'bg-gradient-to-r from-').replace('-100', '-400 to-' + priorityConfig.color + '-500')}`} />
        
        <div className="p-6">
          {/* En-tête avec numéro et priorité */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-xl text-gray-900 group-hover:text-blue-600 transition-colors">
                  {dossier.displayNumber}
                </h3>
                {dossier.isUrgentDelivery && (
                  <span className={`${priorityConfig.bgColor} ${priorityConfig.textColor} px-2 py-1 rounded-full text-xs font-bold animate-pulse`}>
                    {priorityConfig.icon} URGENT
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold text-gray-700">{dossier.displayClient}</p>
            </div>
            
            {/* Badge de statut */}
            <span className={`${statusConfig.bgColor} ${statusConfig.textColor} px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1`}>
              <span>{statusConfig.icon}</span>
              {statusConfig.label}
            </span>
          </div>

          {/* Informations principales */}
          <div className="space-y-3 mb-6">
            {/* Adresse */}
            <div className="flex items-center gap-3 text-gray-600">
              <MapPinIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-base">{dossier.displayAdresse}</span>
            </div>

            {/* Zone de livraison */}
            <div className="flex items-center gap-3">
              <span className={`${zoneConfig.bgColor} ${zoneConfig.textColor} px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1`}>
                <span>{zoneConfig.icon}</span>
                {zoneConfig.label}
              </span>
              <span className="text-sm text-gray-500">
                ~{dossier.estimatedDistance}km • {dossier.estimatedDeliveryTime}min
              </span>
            </div>

            {/* Montant si disponible */}
            {dossier.displayMontant > 0 && (
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <span>💰</span>
                <span>{formatCurrency(dossier.displayMontant)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onProgrammer(dossier)}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CalendarDaysIcon className="h-5 w-5" />
                  <span>Programmer</span>
                </>
              )}
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => onVoirDetails(dossier)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
                <span className="hidden sm:block">Détails</span>
              </button>
              
              <button
                onClick={() => onNavigation(dossier)}
                className="px-3 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition-colors"
                title="Navigation GPS"
              >
                <MapPinIcon className="h-4 w-4" />
              </button>
              
              {dossier.displayTelephone && (
                <button
                  onClick={() => onAppel(dossier)}
                  className="px-3 py-3 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl transition-colors"
                  title="Appeler le client"
                >
                  <PhoneIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // État vide
  if (!dossiers || dossiers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center"
      >
        <div className="w-24 h-24 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
          <DocumentCheckIcon className="h-12 w-12 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Aucun dossier à livrer
        </h3>
        <p className="text-gray-500 mb-4">
          Tous les dossiers imprimés ont été programmés pour livraison
        </p>
        <div className="text-4xl mb-4">📦✨</div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <TruckIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Dossiers à Livrer
              </h2>
              <p className="text-gray-600">
                {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} prêt{dossiers.length > 1 ? 's' : ''} pour programmation
              </p>
            </div>
          </div>
          
          {/* Indicateur de rafraîchissement */}
          {refreshing && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Mise à jour...</span>
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
        <AnimatePresence>
          {dossiers.map((dossier, index) => (
            <DossierCard 
              key={dossier.id} 
              dossier={dossier} 
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Résumé en bas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-600">{dossiers.length}</p>
            <p className="text-blue-700 font-medium">Dossiers à programmer</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-orange-600">
              {dossiers.filter(d => d.isUrgentDelivery).length}
            </p>
            <p className="text-orange-700 font-medium">Urgents</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600">
              {Math.round(dossiers.reduce((sum, d) => sum + d.estimatedDistance, 0))}km
            </p>
            <p className="text-green-700 font-medium">Distance totale estimée</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

ALivrerSectionV2.displayName = 'ALivrerSectionV2';

export default ALivrerSectionV2;