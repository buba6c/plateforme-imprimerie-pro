/**
 * 📦 Carte de dossier de livraison V2
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MapPinIcon, 
  PhoneIcon, 
  CalendarIcon,
  TruckIcon,
  CheckCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import DeliveryStatusBadge from './DeliveryStatusBadge';
import DeliveryPriorityBadge from './DeliveryPriorityBadge';
import ZoneBadge from './ZoneBadge';
import { formatDate, formatCurrency, formatAdresse } from '../utils/livreurUtils';

const DeliveryDossierCardV2 = ({ 
  dossier, 
  onClick,
  onStartDelivery,
  onShowDetails,
  onMarkComplete,
  onMarkFailed,
  onReschedule,
  onNavigateToAddress,
  onCallClient,
  showActions = true
}) => {
  if (!dossier) return null;

  // Debug: afficher les dates disponibles
  if (dossier.statut === 'livre') {
    console.log('🔍 Dossier livré:', {
      id: dossier.id,
      numero: dossier.numero,
      statut: dossier.statut,
      date_livraison_reelle: dossier.date_livraison_reelle,
      date_livraison_prevue: dossier.date_livraison_prevue,
      date_livraison: dossier.date_livraison,
      created_at: dossier.created_at
    });
  }

  // Vérifier si une livraison est programmée (date_livraison OU date_livraison_prevue)
  const dateLivraison = dossier.date_livraison_prevue || dossier.date_livraison;
  const hasScheduledDelivery = dateLivraison || dossier.livreur_id;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-4 border border-gray-200 relative"
    >
      {/* Badge livraison programmée en haut à droite */}
      {hasScheduledDelivery && (
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
            <CheckCircleIcon className="h-3 w-3" />
            <span>Programmée</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-20">
          <h3 className="font-semibold text-gray-900 text-lg">
            {dossier.nom_client || dossier.client || 'Client inconnu'}
          </h3>
          <p className="text-sm text-gray-500">
            Réf: {dossier.reference || dossier.numero || dossier.id}
          </p>
        </div>
        
        <div className="flex flex-col gap-1 items-end">
          <DeliveryStatusBadge status={dossier.statut} />
          <DeliveryPriorityBadge priority={dossier.priorite || dossier.priority} />
        </div>
      </div>

      {/* Date de livraison programmée - Badge proéminent */}
      {dateLivraison && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-3 py-2 rounded-md">
          <TruckIcon className="h-5 w-5 font-bold" />
          <div className="flex-1">
            <div className="text-xs font-medium text-blue-600">Livraison programmée</div>
            <div className="font-semibold">{formatDate(dateLivraison)}</div>
          </div>
        </div>
      )}

      {/* Adresse */}
      <div className="flex items-start gap-2 mb-2 text-sm">
        <MapPinIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-gray-700">
            {formatAdresse(dossier) || dossier.adresse_livraison || 'Adresse non renseignée'}
          </p>
          <ZoneBadge zone={dossier.zone} />
        </div>
      </div>

      {/* Contact */}
      {(dossier.telephone || dossier.telephone_client) && (
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
          <PhoneIcon className="h-5 w-5 text-gray-400" />
          <span>{dossier.telephone || dossier.telephone_client}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarIcon className="h-4 w-4" />
          {dossier.statut === 'livre' && dossier.date_livraison_reelle ? (
            <span>Livré le: {formatDate(dossier.date_livraison_reelle)}</span>
          ) : dossier.statut === 'en_livraison' && dateLivraison ? (
            <span>Livraison: {formatDate(dateLivraison)}</span>
          ) : dossier.created_at || dossier.date_creation ? (
            <span>Créé: {formatDate(dossier.created_at || dossier.date_creation)}</span>
          ) : (
            <span className="text-gray-400">Date non renseignée</span>
          )}
        </div>

        {(dossier.montant || dossier.montant_cfa) && (
          <div className="font-semibold text-gray-900">
            {formatCurrency(dossier.montant || dossier.montant_cfa)}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-3 flex gap-2">
          {onShowDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowDetails(dossier);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
              Détails
            </button>
          )}
          
          {/* Bouton "Livrer maintenant" pour dossiers en_livraison */}
          {onMarkComplete && dossier.statut === 'en_livraison' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(dossier);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Livrer maintenant
            </button>
          )}
          
          {/* Bouton "Programmer" pour dossiers pret_livraison */}
          {onStartDelivery && !hasScheduledDelivery && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartDelivery(dossier);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <TruckIcon className="h-4 w-4" />
              Programmer
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DeliveryDossierCardV2;
