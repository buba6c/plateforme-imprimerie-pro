import React from 'react';
import {
  EyeIcon,
  ClockIcon,
  DocumentTextIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import PropTypes from 'prop-types';

/**
 * Composant DossierCard unifié et responsive
 * Utilisé par tous les dashboards (Préparateur, Imprimeur, Livreur)
 */
const DossierCard = ({ 
  dossier, 
  onViewDetails, 
  badge,
  additionalInfo,
  actions,
  variant = 'default' 
}) => {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-neutral-200 hover:border-neutral-300">
      {/* En-tête avec nom client */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-1 truncate">
            {dossier.nom_client || dossier.client || 'Client inconnu'}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-600">
            Dossier #{dossier.numero || dossier.id}
            {dossier.reference && (
              <span className="ml-2 text-neutral-500">• Réf: {dossier.reference}</span>
            )}
          </p>
        </div>
      </div>

      {/* Badge personnalisé (statut, machine, etc.) */}
      {badge && (
        <div className="mb-3">
          {badge}
        </div>
      )}

      {/* Informations additionnelles */}
      {additionalInfo && (
        <div className="mb-4">
          {additionalInfo}
        </div>
      )}

      {/* Informations standards */}
      <div className="space-y-2 mb-4">
        {/* Date de création */}
        {dossier.date_creation && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
            <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span>
              {new Date(dossier.date_creation).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        )}

        {/* Nombre de fichiers */}
        {dossier.nombre_fichiers > 0 && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
            <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span>
              {dossier.nombre_fichiers} fichier{dossier.nombre_fichiers > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Créé par (préparateur) */}
        {dossier.nom_preparateur && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
            <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span>Par {dossier.nom_preparateur}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Bouton "Voir détails" toujours présent */}
        <button
          onClick={onViewDetails}
          className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
        >
          <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          Voir détails
        </button>

        {/* Actions personnalisées */}
        {actions}
      </div>
    </div>
  );
};

DossierCard.propTypes = {
  dossier: PropTypes.shape({
    id: PropTypes.number,
    numero: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    reference: PropTypes.string,
    nom_client: PropTypes.string,
    client: PropTypes.string,
    date_creation: PropTypes.string,
    nombre_fichiers: PropTypes.number,
    nom_preparateur: PropTypes.string,
  }).isRequired,
  onViewDetails: PropTypes.func.isRequired,
  badge: PropTypes.node,
  additionalInfo: PropTypes.node,
  actions: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'compact', 'expanded']),
};

export default DossierCard;
