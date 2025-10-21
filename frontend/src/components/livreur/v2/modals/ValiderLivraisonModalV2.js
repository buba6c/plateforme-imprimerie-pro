/**
 * ✅ ValiderLivraisonModalV2 - Modale de validation de livraison complète
 * Interface professionnelle pour valider une livraison avec paiement et preuve
 */

import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  CheckCircleIcon, 
  CurrencyEuroIcon,
  CameraIcon
} from '@heroicons/react/24/outline';

const ValiderLivraisonModalV2 = memo(({
  dossier = null,
  isOpen = false,
  onClose,
  onValider,
  loading = false
}) => {
  // États du formulaire
  const [modePaiement, setModePaiement] = useState('especes');
  const [montantEncaisse, setMontantEncaisse] = useState(dossier?.amount || 0);
  const [photoPreuve, setPhotoPreuve] = useState(null);
  const [commentaires, setCommentaires] = useState('');
  const [signatureRecue, setSignatureRecue] = useState(false);

  if (!isOpen || !dossier) return null;

  const modesPaiement = [
    { value: 'wave', label: 'Wave', icon: '📱', color: 'blue' },
    { value: 'orange_money', label: 'Orange Money', icon: '🍊', color: 'orange' },
    { value: 'virement', label: 'Virement bancaire', icon: '🏦', color: 'purple' },
    { value: 'cheque', label: 'Chèque', icon: '📝', color: 'green' },
    { value: 'especes', label: 'Espèces', icon: '💵', color: 'emerald' }
  ];

  const handleValidation = () => {
    const validationData = {
      montant_encaisse: montantEncaisse,
      mode_paiement: modePaiement,
      photo_preuve: photoPreuve,
      commentaires,
      signature_recue: signatureRecue,
      date_livraison: new Date().toISOString()
    };
    onValider?.(dossier, validationData);
  };

  const canValidate = montantEncaisse >= 0 && (photoPreuve || signatureRecue);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Valider Livraison</h3>
                <p className="text-sm text-gray-600">
                  {dossier.displayNumber} • {dossier.displayClient}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Étape 1: Paiement */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CurrencyEuroIcon className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Informations de paiement</h4>
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de paiement
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {modesPaiement.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setModePaiement(mode.value)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${
                          modePaiement === mode.value
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      <span>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Montant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant encaissé (CFA)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">CFA</span>
                  <input
                    type="number"
                    value={montantEncaisse}
                    onChange={(e) => setMontantEncaisse(parseFloat(e.target.value) || 0)}
                    className="w-full pl-14 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-lg"
                    placeholder="0"
                    step="100"
                  />
                </div>
                {dossier.amount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Montant attendu : {dossier.amount.toLocaleString()} CFA
                  </p>
                )}
              </div>
            </div>

            {/* Étape 2: Preuve de livraison */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <CameraIcon className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">Preuve de livraison</h4>
              </div>

              {/* Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo de preuve
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: Intégrer caméra
                      setPhotoPreuve('camera-capture.jpg');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all font-medium"
                  >
                    <CameraIcon className="h-5 w-5" />
                    {photoPreuve ? 'Photo prise ✓' : 'Prendre une photo'}
                  </button>
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signatureRecue}
                    onChange={(e) => setSignatureRecue(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Signature client reçue
                  </span>
                </label>
              </div>

              {/* Commentaires */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commentaires (optionnel)
                </label>
                <textarea
                  value={commentaires}
                  onChange={(e) => setCommentaires(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Notes sur la livraison..."
                />
              </div>
            </div>

            {/* Validation requise */}
            {!canValidate && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  ⚠️ Une photo ou une signature est requise pour valider
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-all font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleValidation}
              disabled={!canValidate || loading}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Validation...' : '✅ Valider la livraison'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

ValiderLivraisonModalV2.displayName = 'ValiderLivraisonModalV2';

export default ValiderLivraisonModalV2;
