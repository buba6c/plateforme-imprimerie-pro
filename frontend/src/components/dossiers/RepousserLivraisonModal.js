import React, { useState, useEffect } from 'react';
import { XMarkIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

const RepousserLivraisonModal = ({ isOpen, onClose, dossier, onRepousser }) => {
  const [nouvelleDate, setNouvelleDate] = useState('');
  const [nouvelleHeure, setNouvelleHeure] = useState('');
  const [raison, setRaison] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && dossier?.date_livraison_prevue) {
      // Initialiser avec la date actuelle + 1 jour par défaut
      const demain = new Date();
      demain.setDate(demain.getDate() + 1);
      setNouvelleDate(demain.toISOString().split('T')[0]);
      
      // Conserver l'heure actuelle ou mettre 14h par défaut
      const currentDate = new Date(dossier.date_livraison_prevue);
      const heureStr = currentDate.toTimeString().slice(0, 5);
      setNouvelleHeure(heureStr);
    }
  }, [isOpen, dossier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!nouvelleDate || !nouvelleHeure) {
      alert('Veuillez renseigner la date et l\'heure');
      return;
    }

    setLoading(true);
    try {
      const nouvelleDateComplete = `${nouvelleDate}T${nouvelleHeure}:00`;
      await onRepousser(dossier.id, nouvelleDateComplete, raison);
      onClose();
    } catch (error) {
      console.error('Erreur lors du report de la livraison:', error);
      alert('Erreur lors du report de la livraison');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Repousser la livraison
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Dossier #{dossier?.numero || dossier?.numero_dossier || dossier?.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date actuelle */}
          {dossier?.date_livraison_prevue && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-medium">Livraison actuelle :</span>
                <br />
                {new Date(dossier.date_livraison_prevue).toLocaleString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          {/* Nouvelle date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              Nouvelle date
            </label>
            <input
              type="date"
              value={nouvelleDate}
              onChange={(e) => setNouvelleDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent"
              required
            />
          </div>

          {/* Nouvelle heure */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <ClockIcon className="w-4 h-4 inline mr-1" />
              Nouvelle heure
            </label>
            <input
              type="time"
              value={nouvelleHeure}
              onChange={(e) => setNouvelleHeure(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent"
              required
            />
          </div>

          {/* Raison */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Raison du report (optionnel)
            </label>
            <textarea
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              rows={3}
              placeholder="Ex: Client non disponible, problème de circulation..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent resize-none"
            />
          </div>

          {/* Raccourcis rapides */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Raccourcis :</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const demain = new Date();
                  demain.setDate(demain.getDate() + 1);
                  setNouvelleDate(demain.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Demain
              </button>
              <button
                type="button"
                onClick={() => {
                  const apres2j = new Date();
                  apres2j.setDate(apres2j.getDate() + 2);
                  setNouvelleDate(apres2j.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Après-demain
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setNouvelleDate(nextWeek.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Semaine prochaine
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RepousserLivraisonModal;
