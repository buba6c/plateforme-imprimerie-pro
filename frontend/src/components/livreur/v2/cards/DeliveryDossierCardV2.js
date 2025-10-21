/**
 * 📦 Carte de dossier de livraison V2
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MapPinIcon, 
  PhoneIcon, 
  CalendarIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import DeliveryStatusBadge from './DeliveryStatusBadge';
import DeliveryPriorityBadge from './DeliveryPriorityBadge';
import ZoneBadge from './ZoneBadge';
import { formatDate, formatCurrency, formatAdresse } from '../utils/livreurUtils';

const DeliveryDossierCardV2 = ({ dossier, onClick }) => {
  if (!dossier) return null;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick && onClick(dossier)}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-4 cursor-pointer border border-gray-200"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">
            {dossier.nom_client || dossier.client || 'Client inconnu'}
          </h3>
          <p className="text-sm text-gray-500">
            Réf: {dossier.reference || dossier.id}
          </p>
        </div>
        
        <div className="flex flex-col gap-1 items-end">
          <DeliveryStatusBadge status={dossier.statut} />
          <DeliveryPriorityBadge priority={dossier.priorite || dossier.priority} />
        </div>
      </div>

      {/* Adresse */}
      <div className="flex items-start gap-2 mb-2 text-sm">
        <MapPinIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-gray-700">
            {formatAdresse(dossier) || 'Adresse non renseignée'}
          </p>
          <ZoneBadge zone={dossier.zone} />
        </div>
      </div>

      {/* Contact */}
      {dossier.telephone && (
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
          <PhoneIcon className="h-5 w-5 text-gray-400" />
          <span>{dossier.telephone}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarIcon className="h-4 w-4" />
          <span>{formatDate(dossier.created_at)}</span>
        </div>

        {dossier.montant && (
          <div className="font-semibold text-gray-900">
            {formatCurrency(dossier.montant)}
          </div>
        )}
      </div>

      {/* Indicateur de livraison programmée */}
      {dossier.date_livraison && (
        <div className="mt-2 flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm">
          <TruckIcon className="h-4 w-4" />
          <span>Programmée le {formatDate(dossier.date_livraison)}</span>
        </div>
      )}
    </motion.div>
  );
};

export default DeliveryDossierCardV2;
