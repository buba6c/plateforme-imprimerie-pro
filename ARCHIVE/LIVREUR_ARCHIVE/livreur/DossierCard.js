import React from 'react';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  MapIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

const DossierCard = ({ dossier, index, type, onProgrammer, onModifier, onValider, onVoirDetails }) => {
  const isUrgent = dossier.urgent || dossier.priorite === 'high';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border group ${
        isUrgent ? 'border-red-300 bg-error-50/30' : 'border-neutral-100'
      }`}
    >
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-neutral-900 dark:text-white text-lg group-hover:text-emerald-600 transition-colors">
              {dossier.numero_commande || dossier.numero || `#${dossier.id?.toString().slice(-8)}`}
            </h3>
            {isUrgent && (
              <span className="bg-error-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                🚨 URGENT
              </span>
            )}
          </div>
          <p className="text-neutral-600 dark:text-neutral-300 font-medium">{dossier.client || dossier.client_nom || 'Client'}</p>
        </div>
      </div>

      {/* Informations */}
      <div className="space-y-3 mb-6">
        {/* Adresse */}
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <MapPinIcon className="h-4 w-4 text-error-500" />
          <span className="truncate">{dossier.adresse_livraison || '⚠️ Adresse à compléter'}</span>
        </div>

        {/* Type machine */}
        {dossier.type_formulaire && (
          <div className="flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-neutral-400" />
            <span
              className={`px-2 py-1 rounded-lg text-xs font-medium ${
                dossier.type_formulaire === 'roland'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {dossier.type_formulaire === 'roland' ? '🖨️ Roland' : '🖨️ Xerox'}
            </span>
          </div>
        )}

        {/* Informations spécifiques selon le type */}
        {type === 'programmees' && (
          <div className="grid grid-cols-1 gap-2 mt-3">
            {dossier.date_livraison_prevue && (
              <div className="text-sm p-2 rounded-lg bg-blue-50 text-blue-700 flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4" />
                <span className="font-medium">
                  {new Date(dossier.date_livraison_prevue).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {dossier.montant_prevu && (
              <div className="text-sm p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <span className="font-medium">
                  {new Intl.NumberFormat('fr-FR').format(dossier.montant_prevu)} CFA
                </span>
              </div>
            )}
          </div>
        )}

        {type === 'terminees' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="text-xs p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <div className="font-medium">
                {new Intl.NumberFormat('fr-FR').format(dossier.montant_encaisse || 0)} CFA
              </div>
              <div className="text-emerald-600">{dossier.mode_paiement || 'Non spec.'}</div>
            </div>
            <div className="text-xs p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200">
              <div className="font-medium">Livré le</div>
              <div>
                {dossier.date_livraison
                  ? new Date(dossier.date_livraison).toLocaleDateString()
                  : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onVoirDetails(dossier)}
          className="flex-1 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 rounded-lg font-medium hover:bg-neutral-100 dark:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
        >
          <EyeIcon className="h-4 w-4" />
          Détails
        </button>

        {type === 'a_livrer' && onProgrammer && (
          <>
            <button
              onClick={() => onProgrammer(dossier)}
              className="flex-1 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
              <CalendarDaysIcon className="h-4 w-4" />
              Programmer
            </button>
            <button
              onClick={() => {
                const address = dossier.adresse_livraison || `${dossier.client}, Paris`;
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
                  '_blank'
                );
              }}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Naviguer"
            >
              <MapIcon className="h-4 w-4" />
            </button>
          </>
        )}

        {type === 'programmees' && onModifier && onValider && (
          <>
            <button
              onClick={() => onModifier(dossier)}
              className="px-3 py-2 bg-white dark:bg-neutral-800 text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-1"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => onValider(dossier)}
              className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Livrer
            </button>
            <button
              onClick={() => {
                const address = dossier.adresse_livraison || `${dossier.client}, Paris`;
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
                  '_blank'
                );
              }}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Naviguer"
            >
              <MapIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default DossierCard;
