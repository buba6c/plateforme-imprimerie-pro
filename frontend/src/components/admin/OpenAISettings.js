import React, { useState, useEffect } from 'react';
import { SparklesIcon, KeyIcon, CheckCircleIcon, XCircleIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const OpenAISettings = () => {
  const [config, setConfig] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [knowledgeBaseText, setKnowledgeBaseText] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/settings/openai`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConfig(response.data);
      setIsActive(response.data.is_active);
      setKnowledgeBaseText(response.data.knowledge_base_text || '');
    } catch (error) {
      console.error('Erreur chargement config:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!apiKey) {
      alert('Veuillez entrer une clé API');
      return;
    }

    try {
      setTesting(true);
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(`${API_URL}/settings/openai/test`, {
        api_key: apiKey
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        alert('✅ Connexion réussie à OpenAI !');
      } else {
        alert('❌ Erreur: ' + response.data.message);
      }
    } catch (error) {
      alert('❌ Erreur lors du test: ' + (error.response?.data?.error || error.message));
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      await axios.put(`${API_URL}/settings/openai`, {
        api_key: apiKey || undefined,
        knowledge_base_text: knowledgeBaseText,
        is_active: isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('✅ Configuration sauvegardée avec succès !');
      fetchConfig();
      setApiKey(''); // Effacer la clé du champ
    } catch (error) {
      alert('❌ Erreur lors de la sauvegarde: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const uploadPDF = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      setUploading(true);
      const token = localStorage.getItem('auth_token');
      
      await axios.post(`${API_URL}/settings/openai/upload-pdf`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      alert('✅ PDF uploadé avec succès !');
      fetchConfig();
    } catch (error) {
      alert('❌ Erreur lors de l\'upload: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <SparklesIcon className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Configuration OpenAI</h1>
        </div>
        <p className="text-purple-100">
          Configurez l'IA pour l'estimation intelligente des devis
        </p>
      </div>

      {/* Statut */}
      {config && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Statut actuel</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              {config.is_active ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-gray-900 dark:text-white">
                IA {config.is_active ? 'activée' : 'désactivée'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {config.has_api_key ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-gray-900 dark:text-white">
                Clé API {config.has_api_key ? 'configurée' : 'non configurée'}
              </span>
            </div>

            {config.total_requests > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Requêtes totales:</span>
                <span className="ml-2 text-gray-900 dark:text-white font-semibold">
                  {config.total_requests}
                </span>
              </div>
            )}

            {config.knowledge_base_pdf_name && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">PDF:</span>
                <span className="ml-2 text-gray-900 dark:text-white font-semibold">
                  {config.knowledge_base_pdf_name}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clé API */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <KeyIcon className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clé API OpenAI</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Clé API (commence par sk-...)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.has_api_key ? "••••••••••••" : "Entrez votre clé OpenAI"}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Obtenez votre clé sur <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a>
            </p>
          </div>

          <button
            onClick={testConnection}
            disabled={testing || !apiKey}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Test en cours...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                Tester la connexion
              </>
            )}
          </button>
        </div>
      </div>

      {/* Base de connaissance texte */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Base de connaissance tarifaire (Texte)
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Règles tarifaires (optionnel)
            </label>
            <textarea
              value={knowledgeBaseText}
              onChange={(e) => setKnowledgeBaseText(e.target.value)}
              rows="8"
              placeholder="Exemple:&#10;Prix Roland : 7000 F/m² pour bâche, 9500 F/m² pour vinyle&#10;Pelliculage : +1500 F/m²&#10;Remise volume : -10% à partir de 20m²"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Upload PDF */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Base de connaissance tarifaire (PDF)
        </h3>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
            <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Importer un document PDF contenant vos tarifs
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => uploadPDF(e.target.files[0])}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
            >
              {uploading ? 'Upload en cours...' : 'Choisir un PDF'}
            </label>
          </div>
        </div>
      </div>

      {/* Activation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Activer l'IA pour les estimations
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              L'IA sera utilisée automatiquement lors de la création de devis
            </p>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Sauvegarde...
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Sauvegarder la configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OpenAISettings;
