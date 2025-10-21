import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, BanknotesIcon, CalendarIcon } from '@heroicons/react/24/outline';

const ValiderLivraisonModal = ({ isOpen, onClose, dossier, onConfirm }) => {
  const [dateLivraison, setDateLivraison] = useState(
    new Date().toISOString().split('T')[0] // date format YYYY-MM-DD
  );
  const [modePaiement, setModePaiement] = useState('');
  const [montantCfa, setMontantCfa] = useState('');
  const [commentaire, setCommentaire] = useState('');

  if (!isOpen || !dossier) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!modePaiement) {
      alert('Veuillez sélectionner un mode de paiement');
      return;
    }
    
    if (!montantCfa || parseFloat(montantCfa) <= 0) {
      alert('Veuillez entrer un montant valide');
      return;
    }

    onConfirm({
      date_livraison: dateLivraison,
      mode_paiement: modePaiement,
      montant_cfa: parseFloat(montantCfa),
      commentaire: commentaire || `Livraison terminée - ${montantCfa} CFA par ${modePaiement}`
    });
  };

  const modesPaiement = [
    { value: 'Wave', label: 'Wave', icon: '📱', color: 'blue' },
    { value: 'Orange Money', label: 'Orange Money', icon: '🍊', color: 'orange' },
    { value: 'Virement bancaire', label: 'Virement bancaire', icon: '🏦', color: 'purple' },
    { value: 'Chèque', label: 'Chèque', icon: '📝', color: 'green' },
    { value: 'Espèces', label: 'Espèces', icon: '💵', color: 'emerald' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
              <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-white">
              Valider livraison
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XMarkIcon className="h-6 w-6 text-neutral-500" />
          </button>
        </div>

        {/* Info dossier */}
        <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl mb-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-1">Dossier</p>
          <p className="font-bold text-neutral-900 dark:text-white text-lg">
            {dossier.nom_client || dossier.client}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            N° {dossier.numero_dossier}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date de livraison */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
              <CalendarIcon className="h-4 w-4" />
              Date de livraison *
            </label>
            <input
              type="date"
              value={dateLivraison}
              onChange={(e) => setDateLivraison(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-gray-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Par défaut : aujourd'hui
            </p>
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-3">
              <BanknotesIcon className="h-4 w-4" />
              Mode de paiement *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {modesPaiement.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setModePaiement(mode.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    modePaiement === mode.value
                      ? `border-${mode.color}-500 bg-${mode.color}-50 dark:bg-${mode.color}-900/30`
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <span className="text-2xl">{mode.icon}</span>
                  <span className={`font-medium ${
                    modePaiement === mode.value
                      ? `text-${mode.color}-700 dark:text-${mode.color}-300`
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}>
                    {mode.label}
                  </span>
                  {modePaiement === mode.value && (
                    <CheckCircleIcon className={`h-5 w-5 ml-auto text-${mode.color}-600`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
              Montant payé (CFA) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="100"
                value={montantCfa}
                onChange={(e) => setMontantCfa(e.target.value)}
                placeholder="Ex: 50000"
                className="w-full px-4 py-3 pr-16 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-gray-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 font-medium">
                CFA
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Montant exact reçu du client
            </p>
          </div>

          {/* Commentaire optionnel */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
              Notes de livraison (optionnel)
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              placeholder="Commentaires sur la livraison..."
              className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-gray-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!modePaiement || !montantCfa}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Valider
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ValiderLivraisonModal;
