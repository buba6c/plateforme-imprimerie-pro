/**
 * 💰 Modal d'encaissement à la livraison
 * Permet au livreur d'enregistrer un paiement client
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import paiementsService from '../../services/paiementsService';

const EncaissementModal = ({ isOpen, onClose, dossier, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState('especes');
  const [reference, setReference] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [errors, setErrors] = useState([]);

  // Initialiser le montant avec le montant du dossier
  useEffect(() => {
    if (!dossier) return;
    
    console.log('🔍 [EncaissementModal] useEffect triggered');
    console.log('🔍 [EncaissementModal] dossier:', dossier);
    
    // 1. Priorité : montant_cfa direct
    if (dossier.montant_cfa) {
      console.log('✅ [EncaissementModal] Setting from montant_cfa:', dossier.montant_cfa);
      setMontant(dossier.montant_cfa.toString());
      return;
    }
    
    // 2. Essayer amount
    if (dossier.amount) {
      console.log('✅ [EncaissementModal] Setting from amount:', dossier.amount);
      setMontant(dossier.amount.toString());
      return;
    }
    
    // 3. Essayer montant
    if (dossier.montant) {
      console.log('✅ [EncaissementModal] Setting from montant:', dossier.montant);
      setMontant(dossier.montant.toString());
      return;
    }
    
    // 4. Extraire du data_formulaire (prix_total_cfa)
    if (dossier.data_formulaire) {
      try {
        const formData = typeof dossier.data_formulaire === 'string' 
          ? JSON.parse(dossier.data_formulaire) 
          : dossier.data_formulaire;
        
        const montantFromForm = formData.prix_total_cfa || formData.montant_total || formData.total || formData.prix;
        
        if (montantFromForm) {
          console.log('✅ [EncaissementModal] Setting from data_formulaire:', montantFromForm);
          setMontant(montantFromForm.toString());
          return;
        }
      } catch (e) {
        console.warn('⚠️ [EncaissementModal] Erreur parsing data_formulaire:', e);
      }
    }
    
    console.log('⚠️ [EncaissementModal] No montant field found, leaving empty');
  }, [dossier]);

  // Modes de paiement disponibles
  const modesPaiement = [
    {
      value: 'especes',
      label: 'Espèces',
      icon: BanknotesIcon,
      color: 'bg-green-100 text-green-700 border-green-300',
      needsRef: false
    },
    {
      value: 'cb',
      label: 'Carte Bancaire',
      icon: CreditCardIcon,
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      needsRef: true
    },
    {
      value: 'wave',
      label: 'Wave',
      icon: DevicePhoneMobileIcon,
      color: 'bg-purple-100 text-purple-700 border-purple-300',
      needsRef: true
    },
    {
      value: 'orange_money',
      label: 'Orange Money',
      icon: DevicePhoneMobileIcon,
      color: 'bg-orange-100 text-orange-700 border-orange-300',
      needsRef: true
    }
  ];

  const selectedMode = modesPaiement.find(m => m.value === modePaiement);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setLoading(true);

    try {
      // Préparer les données
      const data = {
        montant: parseFloat(montant),
        mode_paiement_final: modePaiement,
        reference_transaction: reference.trim() || null,
        commentaire: commentaire.trim() || null
      };

      // Valider
      const validation = paiementsService.validateEncaissement(data);
      if (!validation.isValid) {
        setErrors(validation.errors);
        setLoading(false);
        return;
      }

      // Encaisser
      await paiementsService.encaisserLivraison(dossier.id, data);

      // Succès
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Erreur encaissement:', error);
      setErrors([error.response?.data?.error || 'Erreur lors de l\'encaissement']);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setErrors([]);
      setMontant('');
      setModePaiement('especes');
      setReference('');
      setCommentaire('');
      onClose();
    }
  };

  if (!isOpen || !dossier) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
                  <CurrencyDollarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Encaisser le paiement
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {dossier.numero || `Dossier #${dossier.id}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Informations dossier */}
            <div className="p-6 bg-gray-50 dark:bg-neutral-900/50 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Client</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {dossier.client || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Montant initial</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {paiementsService.formatMontant(dossier.montant_cfa)}
                </span>
              </div>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Affichage des erreurs */}
              {errors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Montant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Montant encaissé <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    placeholder="Ex: 25000"
                    min="0"
                    step="0.01"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-20 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-neutral-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    FCFA
                  </span>
                </div>
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Mode de paiement <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {modesPaiement.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = modePaiement === mode.value;
                    
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setModePaiement(mode.value)}
                        disabled={loading}
                        className={`relative p-4 border-2 rounded-xl transition-all ${
                          isSelected
                            ? `${mode.color} border-current shadow-md`
                            : 'bg-white dark:bg-neutral-700 border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-neutral-500'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <Icon className="h-6 w-6" />
                          <span className="text-sm font-medium">{mode.label}</span>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2"
                          >
                            <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 bg-white dark:bg-neutral-800 rounded-full" />
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Référence transaction (si nécessaire) */}
              {selectedMode?.needsRef && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Référence de transaction <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex: TRX123456789"
                    required={selectedMode?.needsRef}
                    disabled={loading}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-neutral-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Numéro de transaction ou code de confirmation
                  </p>
                </motion.div>
              )}

              {/* Commentaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Commentaire <span className="text-gray-400">(optionnel)</span>
                </label>
                <textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Notes additionnelles..."
                  rows={2}
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-neutral-700 dark:text-white resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      <span>Confirmer l'encaissement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default EncaissementModal;
