import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { dossiersService } from '../../services/apiAdapter';
import notificationService from '../../services/notificationService';

const ValiderLivraisonModal = ({ dossier, user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    date_livraison_reelle: new Date().toISOString().slice(0, 16),
    mode_paiement_reel: dossier.mode_paiement_prevu || '',
    montant_encaisse: dossier.montant_a_encaisser || '',
    commentaire: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!data.mode_paiement_reel || !data.montant_encaisse) {
      notificationService.error('Mode de paiement et montant requis');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date_livraison_reelle: data.date_livraison_reelle,
        mode_paiement_reel: data.mode_paiement_reel,
        montant_encaisse: parseFloat(data.montant_encaisse),
        comment: data.commentaire || `Livraison validée par ${user?.nom || 'Livreur'}`,
      };

      try {
        await dossiersService.confirmDelivery(dossier.id, payload);
      } catch (e) {
        await dossiersService.updateDossierStatus(dossier.id, 'livre', payload);
      }

      notificationService.success('✅ Livraison validée');
      onSuccess();
    } catch (error) {
      notificationService.error('Erreur validation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 text-success-600" />
            Valider la livraison
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Dossier</p>
            <p className="font-semibold text-neutral-900 dark:text-white">{dossier.client || dossier.nom}</p>
            {dossier.adresse_livraison && (
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">📍 {dossier.adresse_livraison}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Date et heure de livraison</label>
            <input
              type="datetime-local"
              required
              value={data.date_livraison_reelle}
              onChange={(e) => setData({ ...data, date_livraison_reelle: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-success-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Mode paiement *</label>
              <select
                required
                value={data.mode_paiement_reel}
                onChange={(e) => setData({ ...data, mode_paiement_reel: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-success-500"
              >
                <option value="">Sélectionnez</option>
                <option value="Wave">📱 Wave</option>
                <option value="Orange Money">📱 Orange Money</option>
                <option value="Virement bancaire">🏦 Virement</option>
                <option value="Chèque">📝 Chèque</option>
                <option value="Espèces">💵 Espèces</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Montant encaissé *</label>
              <input
                type="number"
                required
                min="0"
                step="100"
                value={data.montant_encaisse}
                onChange={(e) => setData({ ...data, montant_encaisse: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-success-500"
              />
            </div>
          </div>

          {dossier.montant_a_encaisser && parseFloat(data.montant_encaisse) !== parseFloat(dossier.montant_a_encaisser) && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Le montant diffère du montant prévu ({dossier.montant_a_encaisser} CFA)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Notes de livraison</label>
            <textarea
              rows={3}
              value={data.commentaire}
              onChange={(e) => setData({ ...data, commentaire: e.target.value })}
              placeholder="Remarques, observations, signature reçue..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-success-500"
            />
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 dark:bg-neutral-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-success-500 text-white rounded-lg font-medium hover:bg-success-600 disabled:opacity-50"
            >
              {loading ? 'Validation...' : 'Valider la livraison'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default ValiderLivraisonModal;
