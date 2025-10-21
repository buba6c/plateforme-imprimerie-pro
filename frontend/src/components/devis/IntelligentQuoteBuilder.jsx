/**
 * Composant React: Constructeur de Devis Intelligent avec IA
 * Affiche le processus de réflexion et les propositions alternatives
 */

import React, { useState } from 'react';
import {
  SparklesIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export const IntelligentQuoteBuilder = ({ onSuccess }) => {
  const [step, setStep] = useState('input'); // input, analyzing, results, confirmation
  const [userInput, setUserInput] = useState('');
  const [currentForm] = useState({});

  // Résultats de l'analyse
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [expandedThinkingStep, setExpandedThinkingStep] = useState(null);

  // États UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Initier l'analyse intelligente
   */
  const handleAnalyze = async () => {
    if (!userInput.trim()) {
      setError('Veuillez décrire votre besoin');
      return;
    }

    setLoading(true);
    setError('');
    setStep('analyzing');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API_URL}/ai-agent/analyze`,
        {
          description: userInput,
          currentForm
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setAnalysisResult(response.data);
        if (response.data.proposals && response.data.proposals.length > 0) {
          setSelectedProposal(response.data.proposals[0]);
        }
        setStep('results');
      } else {
        setError(response.data.error || 'Erreur lors de l\'analyse');
        setStep('input');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'analyse IA');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Envoyer le feedback
   */
  const handleProposalAccepted = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/ai-agent/feedback`,
        {
          proposal_accepted: true,
          user_feedback: { score: 5 }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      onSuccess?.(selectedProposal);
    } catch (err) {
      // Erreur lors de l'envoi du feedback
      // Continuer malgré tout
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* ===== ÉTAPE 1: SAISIE ===== */}
      {step === 'input' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 p-8 rounded-lg border-2 border-blue-200 dark:border-blue-700">
            <div className="flex gap-4 mb-4">
              <SparklesIcon className="w-8 h-8 text-blue-600 dark:text-blue-300 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Assistant IA Intelligent
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Décrivez votre besoin d'imprimerie. L'IA analysera, réfléchira et proposera les meilleures solutions.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-lg font-semibold text-gray-900 dark:text-white mb-2 block">
                Décrivez votre besoin
              </span>
              <textarea
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  setError('');
                }}
                placeholder="Ex: J'ai besoin de 500 flyers A5 couleur brillant en format paysage pour une événement en 3 jours. Budget: ~100 000 FCFA"
                className="w-full h-40 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700"
              />
            </label>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200">
                <p className="font-semibold">Erreur</p>
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading || !userInput.trim()}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin">⚙️</div>
                  Analyse en cours...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Analyser et générer les propositions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===== ÉTAPE 2: ANALYSE EN COURS ===== */}
      {step === 'analyzing' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border-2 border-blue-300 dark:border-blue-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="animate-spin text-blue-600 dark:text-blue-300">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                IA en train de réfléchir...
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              L'IA analyse votre demande selon plusieurs angles. Veuillez patienter quelques secondes.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ÉTAPE 3: RÉSULTATS ===== */}
      {step === 'results' && analysisResult && (
        <div className="space-y-6">
          {/* Affichage du processus de réflexion */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LightBulbIcon className="w-6 h-6 text-yellow-500" />
              Processus de Réflexion (Confidence: {(analysisResult.confidence_score * 100).toFixed(0)}%)
            </h3>

            <div className="space-y-3">
              {analysisResult.thinking_process?.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-800 border-l-4 border-blue-500 p-4 rounded"
                >
                  <button
                    onClick={() =>
                      setExpandedThinkingStep(expandedThinkingStep === idx ? null : idx)
                    }
                    className="w-full text-left flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {step.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Statut: {step.status}
                        </p>
                      </div>
                    </div>
                    {expandedThinkingStep === idx ? (
                      <ChevronUpIcon className="w-5 h-5" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5" />
                    )}
                  </button>

                  {expandedThinkingStep === idx && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded text-xs overflow-auto max-h-48">
                        {JSON.stringify(step.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Affichage des propositions */}
          <div className="space-y-4 mt-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Propositions Recommandées
            </h3>

            <div className="space-y-3">
              {analysisResult.proposals?.map((proposal, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedProposal(proposal)}
                  className={`p-6 border-2 rounded-lg cursor-pointer transition ${
                    selectedProposal === proposal
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {proposal.title || `Proposition ${idx + 1}`}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Machine: {proposal.machine_recommended || proposal.machine}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {proposal.price_total || proposal.estimated_price || proposal.price}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">FCFA HT</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Délai</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {proposal.lead_time}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Qualité</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {proposal.quality_level}
                      </p>
                    </div>
                  </div>

                  {proposal.reasoning && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                      💡 {proposal.reasoning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bouton de confirmation */}
          {selectedProposal && (
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition"
              >
                Retour
              </button>
              <button
                onClick={() => {
                  handleProposalAccepted();
                  setStep('confirmation');
                }}
                className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                ✓ Accepter cette proposition
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== ÉTAPE 4: CONFIRMATION ===== */}
      {step === 'confirmation' && (
        <div className="bg-green-50 dark:bg-green-900 border-2 border-green-500 p-8 rounded-lg text-center space-y-4">
          <CheckCircleIcon className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto" />
          <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
            Proposition Acceptée! 🎉
          </h3>
          <p className="text-green-800 dark:text-green-200">
            Votre demande a été analysée et traitée par l'IA intelligente.
          </p>
          <button
            onClick={() => setStep('input')}
            className="mt-6 py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
          >
            Créer un autre devis
          </button>
        </div>
      )}
    </div>
  );
};

export default IntelligentQuoteBuilder;
