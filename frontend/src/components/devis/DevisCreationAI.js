import React, { useState } from 'react';
import {
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const DevisCreationAI = ({ user, onBack, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Description, 2: Analyse IA, 3: Vérification
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [errors, setErrors] = useState('');
  const [clientInfo, setClientInfo] = useState({
    client_nom: '',
    client_contact: '',
    notes: '',
  });

  const handleAnalyzeDescription = async () => {
    if (!description.trim()) {
      setErrors('Veuillez décrire votre besoin');
      return;
    }

    if (!clientInfo.client_nom.trim()) {
      setErrors('Veuillez entrer le nom du client');
      return;
    }

    setLoading(true);
    setErrors('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(`${API_URL}/devis/analyze-description`, {
        description,
        client_name: clientInfo.client_nom,
        contact: clientInfo.client_contact,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAiResponse(response.data);
      setStep(2);
    } catch (error) {
      setErrors(error.response?.data?.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDevis = async () => {
    if (!aiResponse) return;

    setLoading(true);
    setErrors('');

    try {
      const token = localStorage.getItem('auth_token');
      const devisData = {
        ...aiResponse,
        client_nom: clientInfo.client_nom,
        client_contact: clientInfo.client_contact,
        notes: clientInfo.notes,
        created_by: user?.id,
      };

      const response = await axios.post(`${API_URL}/devis/create`, devisData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Appel du callback de succès
      onSuccess?.(response.data);
    } catch (error) {
      setErrors(error.response?.data?.message || 'Erreur lors de la création du devis');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAiResponse = (field, value) => {
    setAiResponse({
      ...aiResponse,
      [field]: value,
    });
  };

  const handleUpdateLineItem = (index, field, value) => {
    const updatedItems = [...(aiResponse.items || [])];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setAiResponse({
      ...aiResponse,
      items: updatedItems,
    });
  };

  // Step 1: Demande de description
  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Retour
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <SparklesIcon className="w-6 h-6 text-blue-500" />
              Créer un devis par description
            </h2>
            <div className="w-20"></div>
          </div>

          {/* Informations client */}
          <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📋 Informations Client
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom du client *
                </label>
                <input
                  type="text"
                  value={clientInfo.client_nom}
                  onChange={e => setClientInfo({ ...clientInfo, client_nom: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Nom du client"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact
                </label>
                <input
                  type="text"
                  value={clientInfo.client_contact}
                  onChange={e => setClientInfo({ ...clientInfo, client_contact: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Téléphone ou email"
                />
              </div>
            </div>
          </div>

          {/* Description du besoin */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📝 Décrivez votre besoin d'impression *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              rows="6"
              placeholder="Exemple: J'ai besoin de 1000 flyers A5 en couleur sur papier 250g, finition avec vernis..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Plus vous êtes détaillé, mieux l'IA pourra estimer le prix
            </p>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes supplémentaires
            </label>
            <textarea
              value={clientInfo.notes}
              onChange={e => setClientInfo({ ...clientInfo, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows="3"
              placeholder="Instructions particulières, délais, etc..."
            />
          </div>

          {/* Messages d'erreur */}
          {errors && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{errors}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex justify-end gap-4">
            <button
              onClick={onBack}
              className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleAnalyzeDescription}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              <SparklesIcon className="w-4 h-4" />
              {loading ? 'Analyse en cours...' : 'Analyser avec l\'IA'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Résultat IA et ajustements
  if (step === 2 && aiResponse) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Modifier
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vérification du devis IA
            </h2>
            <div className="w-20"></div>
          </div>

          {/* Résumé client */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm">
              <strong>Client:</strong> {clientInfo.client_nom}
              {clientInfo.client_contact && ` • ${clientInfo.client_contact}`}
            </p>
          </div>

          {/* Détails du produit */}
          <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📦 Détails proposés par l'IA
            </h3>

            <div className="space-y-4">
              {/* Type de produit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type de produit
                </label>
                <input
                  type="text"
                  value={aiResponse.product_type || ''}
                  onChange={e => handleUpdateAiResponse('product_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Détails */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Détails
                </label>
                <textarea
                  value={aiResponse.details || ''}
                  onChange={e => handleUpdateAiResponse('details', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  rows="4"
                />
              </div>

              {/* Articles du devis */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Articles</h4>
                <div className="space-y-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-300 dark:border-gray-700">
                        <th className="text-left py-2 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                        <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300 w-20">Quantité</th>
                        <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Prix unitaire</th>
                        <th className="text-right py-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(aiResponse.items || []).map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2">
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={e => handleUpdateLineItem(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={item.quantity || 1}
                              onChange={e => handleUpdateLineItem(idx, 'quantity', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={item.unit_price || 0}
                              onChange={e => handleUpdateLineItem(idx, 'unit_price', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-white">
                            {(item.quantity * item.unit_price).toFixed(2)} XOF
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg min-w-64 border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Montant total:</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {(aiResponse.items || []).reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)} XOF
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages d'erreur */}
          {errors && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{errors}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Retour
            </button>
            <button
              onClick={handleConfirmDevis}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              <CheckIcon className="w-4 h-4" />
              {loading ? 'Création en cours...' : 'Créer le devis'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default DevisCreationAI;
