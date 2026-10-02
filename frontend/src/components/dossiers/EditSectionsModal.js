import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import SectionsManager from './SectionsManager';
import SupportsManager from './SupportsManager';
import AmountField from './AmountField';

/**
 * Modal d'édition des sections/supports/amount d'un dossier
 * Permet de modifier après création
 */
const EditSectionsModal = ({ 
  isOpen, 
  onClose, 
  dossier, 
  onSave,
  userRole 
}) => {
  // États locaux
  const [sections, setSections] = useState([]);
  const [supports, setSupports] = useState([]);
  const [amount, setAmount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Type de formulaire
  const machineType = (dossier?.type_formulaire || dossier?.machine || '').toLowerCase();
  const isXerox = machineType.includes('xerox');
  const isRoland = machineType.includes('roland');

  // Initialiser les données au montage ou changement de dossier
  useEffect(() => {
    if (dossier) {
      // Sections
      if (Array.isArray(dossier.sections) && dossier.sections.length > 0) {
        setSections(dossier.sections);
      } else if (isXerox) {
        // Initialiser une section par défaut pour Xerox
        setSections([{
          type: 'Affiche',
          mode_impression: 'recto_simple',
          copies: 1,
          paper_types: [{
            format: 'A4',
            couleur: 'couleur',
            grammage: '80',
            pages: 1
          }],
          finitions: [],
          faconnage: []
        }]);
      }

      // Supports
      if (Array.isArray(dossier.supports) && dossier.supports.length > 0) {
        setSupports(dossier.supports);
      } else if (isRoland) {
        // Initialiser un support par défaut pour Roland
        setSupports([{
          type_support: 'bache',
          largeur: 1,
          hauteur: 1,
          unite: 'm',
          exemplaires: 1,
          finitions: []
        }]);
      }

      // Amount
      setAmount(dossier.amount || null);
    }
  }, [dossier, isXerox, isRoland]);

  // Gestion de la sauvegarde
  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const updateData = {
        ...(isXerox && sections.length > 0 && { sections }),
        ...(isRoland && supports.length > 0 && { supports }),
        ...(amount !== null && amount > 0 && { amount })
      };

      await onSave(updateData);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Ne rien afficher si modal fermée
  if (!isOpen || !dossier) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Modifier {isXerox ? 'les sections' : isRoland ? 'les supports' : 'le dossier'}
                </h2>
                <p className="text-sm text-blue-100">
                  Dossier #{dossier.id} - {dossier.type_formulaire}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">Erreur</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Amount Field */}
              <AmountField
                amount={amount}
                onChange={setAmount}
                userRole={userRole}
              />

              {/* Sections Manager (Xerox) */}
              {isXerox && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Sections Xerox
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Gérez les différentes sections de ce dossier d'impression
                    </p>
                  </div>

                  <SectionsManager
                    sections={sections}
                    onChange={setSections}
                  />
                </div>
              )}

              {/* Supports Manager (Roland) */}
              {isRoland && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-800">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Supports Roland
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Gérez les différents supports de ce dossier grand format
                    </p>
                  </div>

                  <SupportsManager
                    supports={supports}
                    onChange={setSupports}
                  />
                </div>
              )}

              {/* Message si ni Xerox ni Roland */}
              {!isXerox && !isRoland && (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">
                    Type de formulaire non supporté pour l'édition des sections
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Annuler
            </button>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {isXerox && `${sections.length} section${sections.length > 1 ? 's' : ''}`}
                {isRoland && `${supports.length} support${supports.length > 1 ? 's' : ''}`}
              </div>

              <button
                onClick={handleSave}
                disabled={saving || (!isXerox && !isRoland)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

EditSectionsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  dossier: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  userRole: PropTypes.string
};

export default EditSectionsModal;
