import React from 'react';
import { XMarkIcon, ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline';

/**
 * Modal de prévisualisation de facture avant téléchargement
 */
const FacturePreviewModal = ({ facture, isOpen, onClose, onDownload }) => {
  if (!isOpen || !facture) return null;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatutColor = (statut) => {
    const colors = {
      non_paye: 'text-red-600 bg-red-50',
      paye: 'text-green-600 bg-green-50',
      partiellement_paye: 'text-yellow-600 bg-yellow-50',
      annule: 'text-gray-600 bg-gray-50'
    };
    return colors[statut] || 'text-gray-600 bg-gray-50';
  };

  const getStatutLabel = (statut) => {
    const labels = {
      non_paye: 'Non payé',
      paye: 'Payé',
      partiellement_paye: 'Partiellement payé',
      annule: 'Annulé'
    };
    return labels[statut] || statut;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-4xl overflow-hidden text-left align-bottom transition-all transform bg-white dark:bg-gray-800 rounded-2xl shadow-2xl sm:my-8 sm:align-middle">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Prévisualisation de la facture
                  </h3>
                  <p className="text-sm text-green-100">{facture.numero}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-green-100 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Body - Aperçu de la facture */}
          <div className="p-8 max-h-[600px] overflow-y-auto">
            {/* En-tête facture */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    FACTURE
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {facture.numero}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full font-semibold ${getStatutColor(facture.statut_paiement)}`}>
                  {getStatutLabel(facture.statut_paiement)}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Date d'émission
                  </h4>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {formatDate(facture.created_at)}
                  </p>
                </div>
                {facture.date_echeance && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Date d'échéance
                    </h4>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {formatDate(facture.date_echeance)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Informations client */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Facturé à
              </h4>
              <div className="space-y-2">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {facture.client_nom}
                </p>
                {facture.client_contact && (
                  <p className="text-gray-600 dark:text-gray-400">
                    📞 {facture.client_contact}
                  </p>
                )}
                {facture.client_email && (
                  <p className="text-gray-600 dark:text-gray-400">
                    ✉️ {facture.client_email}
                  </p>
                )}
              </div>
            </div>

            {/* Détails dossier */}
            {facture.dossier_numero && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6 mb-6">
                <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
                  Dossier lié
                </h4>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {facture.dossier_numero}
                </p>
                {facture.dossier_description && (
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                    {facture.dossier_description}
                  </p>
                )}
              </div>
            )}

            {/* Montants */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-600 p-6">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Détail des montants
              </h4>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Montant HT</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {parseFloat(facture.montant_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} FCFA
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">TVA (18%)</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {parseFloat(facture.montant_tva || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} FCFA
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg px-4 mt-4">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    Montant TTC
                  </span>
                  <span className="text-2xl font-extrabold text-green-600 dark:text-green-400">
                    {parseFloat(facture.montant_ttc || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} FCFA
                  </span>
                </div>
              </div>

              {/* Mode de paiement */}
              {facture.mode_paiement && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Mode de paiement
                    </span>
                    <span className="text-base font-semibold text-gray-900 dark:text-white capitalize">
                      {facture.mode_paiement.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {facture.notes && (
              <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                  📝 Notes
                </h4>
                <p className="text-sm text-yellow-900 dark:text-yellow-200">
                  {facture.notes}
                </p>
              </div>
            )}
          </div>

          {/* Footer - Actions */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Fermer
            </button>
            
            <button
              onClick={() => window.print()}
              className="px-6 py-2.5 text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors font-medium flex items-center gap-2"
            >
              <PrinterIcon className="w-5 h-5" />
              Imprimer
            </button>
            
            <button
              onClick={() => onDownload(facture.id, facture.numero)}
              className="px-6 py-2.5 text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-medium flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Télécharger PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacturePreviewModal;
