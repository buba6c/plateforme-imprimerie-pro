/**
 * ❌ EchecLivraisonModalV2 - Modale pour marquer un échec de livraison
 * Interface complète pour documenter l'échec et planifier un nouveau passage
 */

import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  XCircleIcon, 
  CameraIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const EchecLivraisonModalV2 = memo(({
  dossier = null,
  isOpen = false,
  onClose,
  onMarquerEchec,
  loading = false
}) => {
  const [raisonEchec, setRaisonEchec] = useState('');
  const [detailsEchec, setDetailsEchec] = useState('');
  const [photoPreuve, setPhotoPreuve] = useState(null);
  const [reprogrammer, setReprogrammer] = useState(true);
  const [dateReprogrammation, setDateReprogrammation] = useState('');

  if (!isOpen || !dossier) return null;

  const raisonsEchec = [
    { value: 'absent', label: 'Client absent', icon: '🚪', color: 'orange' },
    { value: 'adresse_incorrecte', label: 'Adresse incorrecte', icon: '📍', color: 'red' },
    { value: 'refus', label: 'Refus de réception', icon: '🚫', color: 'red' },
    { value: 'acces_impossible', label: 'Accès impossible', icon: '🔒', color: 'amber' },
    { value: 'destinataire_absent', label: 'Destinataire absent', icon: '❌', color: 'orange' },
    { value: 'autre', label: 'Autre raison', icon: '📝', color: 'gray' }
  ];

  const handleSubmit = () => {
    const echecData = {
      raison: raisonEchec,
      details: detailsEchec,
      photo_preuve: photoPreuve,
      reprogrammer,
      date_reprogrammation: reprogrammer ? dateReprogrammation : null,
      date_echec: new Date().toISOString()
    };
    onMarquerEchec?.(dossier, echecData);
  };

  const canSubmit = raisonEchec && (!reprogrammer || dateReprogrammation);

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
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Échec de livraison</h3>
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
            {/* Raison de l'échec */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-gray-900">Raison de l'échec</h4>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {raisonsEchec.map(raison => (
                  <button
                    key={raison.value}
                    onClick={() => setRaisonEchec(raison.value)}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                      ${
                        raisonEchec === raison.value
                          ? `bg-${raison.color}-600 text-white shadow-sm`
                          : `bg-gray-100 text-gray-700 hover:bg-gray-200`
                      }
                    `}
                  >
                    <span className="text-lg">{raison.icon}</span>
                    <span className="flex-1">{raison.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Détails complémentaires */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Détails complémentaires
              </label>
              <textarea
                value={detailsEchec}
                onChange={(e) => setDetailsEchec(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                placeholder="Informations supplémentaires sur l'échec..."
              />
            </div>

            {/* Photo de preuve */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo de preuve (optionnel)
              </label>
              <button
                type="button"
                onClick={() => {
                  // TODO: Intégrer caméra
                  setPhotoPreuve('echec-proof.jpg');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all font-medium"
              >
                <CameraIcon className="h-5 w-5" />
                {photoPreuve ? 'Photo prise ✓' : 'Prendre une photo'}
              </button>
            </div>

            {/* Reprogrammation */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Reprogrammation</h4>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reprogrammer}
                  onChange={(e) => setReprogrammer(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Planifier un nouveau passage
                </span>
              </label>

              {reprogrammer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de reprogrammation
                  </label>
                  <input
                    type="date"
                    value={dateReprogrammation}
                    onChange={(e) => setDateReprogrammation(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Avertissement */}
            {!reprogrammer && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Sans reprogrammation, le dossier sera marqué comme échec définitif et retourné à l'expéditeur.
                  </span>
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
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Enregistrement...' : '❌ Marquer comme échec'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

EchecLivraisonModalV2.displayName = 'EchecLivraisonModalV2';

export default EchecLivraisonModalV2;
