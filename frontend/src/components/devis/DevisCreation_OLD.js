import React, { useState, useMemo, useEffect } from 'react';
import {
  DocumentTextIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  PrinterIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const DevisCreation = ({ user, onNavigate }) => {
  const [step, setStep] = useState(1);
  const [machineType, setMachineType] = useState(null);
  const [formData, setFormData] = useState({
    client_nom: '',
    client_contact: '',
    notes: ''
  });
  const [rolandData, setRolandData] = useState({
    largeur: '',
    hauteur: '',
    support: 'bache',
    finitions: []
  });
  const [xeroxData, setXeroxData] = useState({
    format: 'a4',
    nombre_pages: '',
    couleur: true,
    finitions: []
  });
  const [estimation, setEstimation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const dataJson = machineType === 'roland' ? rolandData : xeroxData;
      
      const response = await axios.post(`${API_URL}/devis`, {
        machine_type: machineType,
        data_json: JSON.stringify(dataJson),
        client_nom: formData.client_nom,
        client_contact: formData.client_contact,
        notes: formData.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Devis créé avec succès !');
      if (onNavigate) onNavigate('mes-devis');
    } catch (error) {
      console.error('Erreur création devis:', error);
      alert('Erreur lors de la création du devis');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Choisir le type de machine
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sélectionnez la machine pour créer votre devis
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Roland */}
        <button
          onClick={() => { setMachineType('roland'); setStep(2); }}
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <DocumentTextIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Roland
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Impression grand format, bâches, vinyle, etc.
            </p>
          </div>
        </button>

        {/* Xerox */}
        <button
          onClick={() => { setMachineType('xerox'); setStep(2); }}
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <DocumentTextIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Xerox
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Impression numérique, documents, brochures, etc.
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Informations du devis - {machineType === 'roland' ? 'Roland' : 'Xerox'}
        </h2>

        {/* Informations client */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Client</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nom du client *
            </label>
            <input
              type="text"
              value={formData.client_nom}
              onChange={(e) => setFormData({...formData, client_nom: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact
            </label>
            <input
              type="text"
              value={formData.client_contact}
              onChange={(e) => setFormData({...formData, client_contact: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Spécifications Roland */}
        {machineType === 'roland' && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Spécifications</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Largeur (cm) *
                </label>
                <input
                  type="number"
                  value={rolandData.largeur}
                  onChange={(e) => setRolandData({...rolandData, largeur: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hauteur (cm) *
                </label>
                <input
                  type="number"
                  value={rolandData.hauteur}
                  onChange={(e) => setRolandData({...rolandData, hauteur: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support
              </label>
              <select
                value={rolandData.support}
                onChange={(e) => setRolandData({...rolandData, support: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="bache">Bâche standard</option>
                <option value="vinyle">Vinyle adhésif</option>
                <option value="papier_photo">Papier photo</option>
                <option value="toile_canvas">Toile Canvas</option>
              </select>
            </div>
          </div>
        )}

        {/* Spécifications Xerox */}
        {machineType === 'xerox' && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Spécifications</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <select
                  value={xeroxData.format}
                  onChange={(e) => setXeroxData({...xeroxData, format: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="a4">A4</option>
                  <option value="a3">A3</option>
                  <option value="a5">A5</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre de pages *
                </label>
                <input
                  type="number"
                  value={xeroxData.nombre_pages}
                  onChange={(e) => setXeroxData({...xeroxData, nombre_pages: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={xeroxData.couleur}
                onChange={(e) => setXeroxData({...xeroxData, couleur: e.target.checked})}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Impression couleur
              </label>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (optionnel)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Boutons */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(1)}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Retour
          </button>

          <button
            onClick={handleCreate}
            disabled={loading || !formData.client_nom}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Création en cours...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                Créer le devis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {step > 1 ? <CheckIcon className="w-5 h-5" /> : '1'}
          </div>
          <span className="text-sm font-medium">Type</span>
        </div>
        
        <div className={`w-16 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
        
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            2
          </div>
          <span className="text-sm font-medium">Détails</span>
        </div>
      </div>

      {/* Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </div>
  );
};

export default DevisCreation;
