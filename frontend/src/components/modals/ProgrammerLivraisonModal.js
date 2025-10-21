import React, { useState } from 'react';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import AnimatedModal from '../transitions/AnimatedModal';
import LoadingButton from '../transitions/LoadingButton';

const ProgrammerLivraisonModal = ({ isOpen, onClose, dossier, onConfirm }) => {
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState(
    new Date().toISOString().slice(0, 16) // datetime-local format
  );
  const [commentaire, setCommentaire] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !dossier) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dateLivraisonPrevue) {
      alert('Veuillez choisir une date de livraison');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onConfirm({
        date_livraison_prevue: dateLivraisonPrevue,
        commentaire: commentaire || `Livraison programmée pour le ${new Date(dateLivraisonPrevue).toLocaleString('fr-FR')}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={true}
      closeOnBackdrop={!isSubmitting}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl">
            <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <span>Programmer livraison</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <LoadingButton
            onClick={onClose}
            variant="secondary"
            size="md"
            disabled={isSubmitting}
          >
            Annuler
          </LoadingButton>
          <LoadingButton
            onClick={handleSubmit}
            variant="primary"
            size="md"
            loading={isSubmitting}
            loadingText="Programmation..."
            icon={CalendarIcon}
          >
            Programmer
          </LoadingButton>
        </div>
      }
    >
      {/* Info dossier */}
      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl mb-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-1">Dossier</p>
        <p className="font-bold text-neutral-900 dark:text-white text-lg">
          {dossier.nom_client || dossier.client}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
          N° {dossier.numero_dossier}
        </p>
        {dossier.adresse_livraison && (
          <div className="flex items-start gap-2 mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            <MapPinIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{dossier.adresse_livraison}</span>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date/heure prévue */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
            Date et heure de livraison prévue *
          </label>
          <input
            type="datetime-local"
            value={dateLivraisonPrevue}
            onChange={(e) => setDateLivraisonPrevue(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-gray-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            required
            disabled={isSubmitting}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Choisissez la date et l'heure souhaitées pour la livraison
          </p>
        </div>

        {/* Commentaire optionnel */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
            Commentaire (optionnel)
          </label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={3}
            placeholder="Notes sur la livraison..."
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-gray-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
            disabled={isSubmitting}
          />
        </div>
      </form>
    </AnimatedModal>
  );
};

export default ProgrammerLivraisonModal;
