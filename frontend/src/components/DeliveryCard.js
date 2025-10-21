import React from 'react';
import {
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  DocumentTextIcon,
  EyeIcon,
  UserIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';

const DeliveryCard = ({ dossier, actions, onOpenDetails }) => {
  const hasAddress = dossier.adresse_livraison && dossier.adresse_livraison.trim() !== '';
  const hasPhone = dossier.telephone_contact && dossier.telephone_contact.trim() !== '';

  // Système de couleurs unifié pour le statut
  const statusColors = getStatusColor(dossier.statut || dossier.status);
  
  // Type de machine si disponible
  const normalizedType = (dossier.machine_impression || dossier.machine_imprimante || dossier.type || '').toString().trim().toLowerCase();
  const typeConfig = {
    roland: {
      bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      text: 'text-white',
      icon: '🖨️',
      label: 'Roland'
    },
    xerox: {
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      text: 'text-white',
      icon: '📄',
      label: 'Xerox'
    }
  };
  
  const machineConfig = typeConfig[normalizedType];

  const formatDate = (dateString) => {
    if (!dateString) return 'Non renseigné';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  const handleViewDetails = () => {
    if (onOpenDetails) {
      onOpenDetails(dossier);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Bande de statut colorée en haut */}
      <div className={`h-1.5 ${statusColors.bg}`}></div>
      
      <div className="p-4">
        {/* En-tête avec numéro de commande et statut */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
              {dossier.nom_client || dossier.numero_dossier || dossier.numero || `Dossier #${dossier.id}`}
            </h3>
            <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
              <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">{dossier.preparateur_name || 'Non assigné'}</span>
            </div>
          </div>
          
          {/* Badge de statut avec couleurs unifiées */}
          <span className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors.light} ${statusColors.text} ${statusColors.border}`}>
            {getStatusLabel(dossier.statut || dossier.status)}
          </span>
        </div>

        {/* Informations détaillées */}
        <div className="space-y-2 mb-4">
          {/* Type de machine si disponible */}
          {machineConfig && (
            <div className="flex items-center">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${machineConfig.bg} ${machineConfig.text} shadow-sm`}>
                <span>{machineConfig.icon}</span>
                <span>{machineConfig.label}</span>
              </span>
            </div>
          )}
          
          {/* Adresse de livraison */}
          <div className="flex items-start text-sm">
            <MapPinIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
            {hasAddress ? (
              <span className="text-gray-700 dark:text-gray-300">
                {dossier.adresse_livraison}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Adresse manquante
              </span>
            )}
          </div>
          
          {/* Téléphone */}
          <div className="flex items-center text-sm">
            <PhoneIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
            {hasPhone ? (
              <a
                href={`tel:${dossier.telephone_contact}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {dossier.telephone_contact}
              </a>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Numéro manquant
              </span>
            )}
          </div>
          
          {/* Mode de paiement */}
          {dossier.mode_paiement && (
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <CreditCardIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              <span className="font-medium capitalize">
                {dossier.mode_paiement}
                {dossier.montant_a_encaisser && ` - ${dossier.montant_a_encaisser}€`}
              </span>
            </div>
          )}
          
          {/* Date de création */}
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
            <span>{formatDate(dossier.date_creation || dossier.created_at)}</span>
          </div>

          {/* Nombre de fichiers */}
          {dossier.nombre_fichiers > 0 && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <DocumentTextIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              <span>{dossier.nombre_fichiers} fichier{dossier.nombre_fichiers > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleViewDetails}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
          >
            <EyeIcon className="h-4 w-4" />
            <span>Détails</span>
          </button>
          
          {actions}
        </div>
      </div>
      
      {/* Effet de hover */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 dark:group-hover:border-blue-400/20 rounded-xl transition-colors duration-300 pointer-events-none"></div>
    </div>
  );
};

export default DeliveryCard;
