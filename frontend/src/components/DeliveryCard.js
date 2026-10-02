import React from 'react';
import {
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  DocumentTextIcon,
  EyeIcon,
  UserIcon,
  CreditCardIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';

const DeliveryCard = ({ dossier, actions, onOpenDetails }) => {
  const hasPhone = (dossier.telephone_client || dossier.telephone || dossier.displayTelephone || '').trim() !== '';
  const hasAddress = (dossier.adresse_livraison || dossier.adresse || '').trim() !== '';
  
  // Système de couleurs unifié pour le statut
  const statusColors = getStatusColor(dossier.statut || dossier.status);
  
  // Vérifier si le dossier est livré
  const isLivre = (dossier.statut || dossier.status || '').toLowerCase() === 'livre';
  
  // Configuration des badges de paiement (synchronisée avec DossierDetails)
  const getPaymentStatusBadge = (dossier) => {
    const isPaye = dossier.statut_paiement === 'paye' || dossier.statut_paiement === 'encaisse';
    const montant = dossier.montant_cfa ? new Intl.NumberFormat('fr-FR').format(dossier.montant_cfa) : '';
    const montantDisplay = montant ? ` - ${montant} FCFA` : '';
    const aLaLivraison = dossier.mode_paiement_final === 'a_la_livraison';
    const isPartiel = dossier.statut_paiement === 'acompte' || dossier.statut_paiement === 'partiellement_paye';

    const paymentConfig = {
      paye: {
        gradient: 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700',
        icon: '✅',
        label: `Payé${montantDisplay}`,
        ring: 'ring-green-300/50 dark:ring-green-400/40',
        shadow: 'shadow-green-500/50 dark:shadow-green-600/40'
      },
      a_encaisser: {
        gradient: 'bg-gradient-to-r from-orange-500 to-amber-600 dark:from-orange-600 dark:to-amber-700',
        icon: '💰',
        label: `À encaisser: ${montant || '0'} FCFA`,
        ring: 'ring-orange-300/50 dark:ring-orange-400/40',
        shadow: 'shadow-orange-500/50 dark:shadow-orange-600/40',
        animate: 'animate-pulse'
      },
      partiel: {
        gradient: 'bg-gradient-to-r from-yellow-500 to-orange-600 dark:from-yellow-600 dark:to-orange-700',
        icon: '💰',
        label: 'Paiement partiel',
        ring: 'ring-yellow-300/50 dark:ring-yellow-400/40',
        shadow: 'shadow-yellow-500/50 dark:shadow-yellow-600/40'
      },
      non_paye: {
        gradient: 'bg-gradient-to-r from-red-500 to-rose-600 dark:from-red-600 dark:to-rose-700',
        icon: '💳',
        label: `Non payé${montantDisplay}`,
        ring: 'ring-red-300/50 dark:ring-red-400/40',
        shadow: 'shadow-red-500/50 dark:shadow-red-600/40',
        animate: 'animate-pulse'
      }
    };

    let configKey;
    if (isPaye) {
      configKey = 'paye';
    } else if (aLaLivraison && !isPaye) {
      configKey = 'a_encaisser';
    } else if (isPartiel) {
      configKey = 'partiel';
    } else {
      configKey = 'non_paye';
    }

    const config = paymentConfig[configKey];

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs text-white ${config.gradient} shadow-md ${config.shadow} ring-2 ${config.ring} transform transition-all duration-300 hover:scale-105 ${config.animate || ''}`}>
        <span className="text-sm">{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };
  
  // Type de machine si disponible - SANS ICÔNES
  const normalizedType = (dossier.machine_impression || dossier.machine_imprimante || dossier.type || '').toString().trim().toLowerCase();
  const typeConfig = {
    roland: {
      bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      text: 'text-white',
      label: 'Roland'
    },
    xerox: {
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      text: 'text-white',
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
              {dossier.numero || dossier.numero_commande || dossier.numero_dossier || `Dossier #${dossier.id}`}
            </h3>
            <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
              <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">{dossier.client || dossier.nom_client || 'Client non renseigné'}</span>
            </div>
          </div>
          
          {/* Badges de statut et paiement */}
          <div className="flex flex-col gap-1.5 ml-3 items-end">
            {/* Badge de statut avec couleurs unifiées */}
            <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors.light} ${statusColors.text} ${statusColors.border}`}>
              {getStatusLabel(dossier.statut || dossier.status)}
            </span>
            
            {/* Badge Payé / Acompte / Non payé - uniquement pour les dossiers livrés */}
            {isLivre && getPaymentStatusBadge(dossier)}
          </div>
        </div>

        {/* Informations détaillées */}
        <div className="space-y-2 mb-4">
          {/* Badge URGENT - Ne PAS afficher si le dossier est livré */}
          {dossier.urgent && !isLivre && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-md text-xs font-bold border border-red-400 shadow-md animate-pulse">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span>URGENT</span>
            </div>
          )}
          
          {/* Badge Programmé si date de livraison prévue */}
          {dossier.date_livraison_prevue && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-xs font-semibold border border-blue-300 dark:border-blue-700">
              <CalendarIcon className="h-4 w-4" />
              <span>
                Programmé: {new Date(dossier.date_livraison_prevue).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
          
          {/* Badge À encaisser si paiement à la livraison */}
          {dossier.mode_paiement_final === 'a_la_livraison' && 
           dossier.statut_paiement !== 'paye' && 
           dossier.statut_paiement !== 'encaisse' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md text-xs font-semibold border border-orange-300 dark:border-orange-700">
              <CreditCardIcon className="h-4 w-4" />
              <span>À encaisser: {dossier.montant_cfa ? new Intl.NumberFormat('fr-FR').format(dossier.montant_cfa) : '0'} FCFA</span>
            </div>
          )}
          
          {/* Type de machine si disponible - SANS ICÔNE */}
          {machineConfig && (
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${machineConfig.bg} ${machineConfig.text} shadow-sm`}>
                <span>{machineConfig.label}</span>
              </span>
            </div>
          )}
          
          {/* Téléphone */}
          <div className="flex items-center text-sm">
            <PhoneIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
            {hasPhone ? (
              <a
                href={`tel:${dossier.telephone_client || dossier.telephone || dossier.displayTelephone}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {dossier.telephone_client || dossier.telephone || dossier.displayTelephone}
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
          
          {/* Date de livraison ou création */}
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
            {isLivre && (dossier.date_livraison_reelle || dossier.date_livraison) ? (
              <span className="font-medium">
                Livré le: {formatDate(dossier.date_livraison_reelle || dossier.date_livraison)}
              </span>
            ) : dossier.date_livraison_prevue ? (
              <span>
                Livraison prévue: {formatDate(dossier.date_livraison_prevue)}
              </span>
            ) : (
              <span>Créé le: {formatDate(dossier.date_creation || dossier.created_at)}</span>
            )}
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
