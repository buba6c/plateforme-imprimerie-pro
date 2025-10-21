import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDaysIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { dossiersService } from '../../services/apiAdapter';
import notificationService from '../../services/notificationService';

const ProgrammerModal = ({ dossier, user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    date_livraison_prevue: new Date().toISOString().slice(0, 16),
    adresse_livraison: dossier.adresse_livraison || '',
    mode_paiement_prevu: dossier.mode_paiement_prevu || '',
    montant_a_encaisser: dossier.montant_prevu || '',
    commentaire: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!data.adresse_livraison || !data.date_livraison_prevue) {
      notificationService.error('Date et adresse requis');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date_livraison_prevue: data.date_livraison_prevue,
        adresse_livraison: data.adresse_livraison,
        mode_paiement_prevu: data.mode_paiement_prevu,
        montant_a_encaisser: data.montant_a_encaisser ? parseFloat(data.montant_a_encaisser) : undefined,
        comment: data.commentaire || `Programmation par ${user?.nom || 'Livreur'}`,
      };

      try {
        await dossiersService.scheduleDelivery(dossier.id, payload);
      } catch (e) {
        await dossiersService.updateDossierStatus(dossier.id, 'en_livraison', payload);
      }

      notificationService.success('✅ Livraison programmée');
      onSuccess();
    } catch (error) {
      notificationService.error('Erreur programmation');
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
            <CalendarDaysIcon className="h-6 w-6 text-emerald-600" />
            Programmer une livraison
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Dossier</p>
            <p className="font-semibold text-neutral-900 dark:text-white">{dossier.client || dossier.nom}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Date et heure prévues *</label>
            <input
              type="datetime-local"
              required
              min={new Date().toISOString().slice(0, 16)}
              value={data.date_livraison_prevue}
              onChange={(e) => setData({ ...data, date_livraison_prevue: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Adresse *</label>
            <input
              type="text"
              required
              value={data.adresse_livraison}
              onChange={(e) => setData({ ...data, adresse_livraison: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Mode paiement</label>
              <select
                value={data.mode_paiement_prevu}
                onChange={(e) => setData({ ...data, mode_paiement_prevu: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Montant (CFA)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={data.montant_a_encaisser}
                onChange={(e) => setData({ ...data, montant_a_encaisser: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Notes</label>
            <textarea
              rows={3}
              value={data.commentaire}
              onChange={(e) => setData({ ...data, commentaire: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
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
              className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? 'Programmation...' : 'Confirmer'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default ProgrammerModal;
