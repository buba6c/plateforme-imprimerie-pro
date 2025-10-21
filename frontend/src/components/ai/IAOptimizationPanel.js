/**
 * Composant IA Intelligent - Suggestions & Optimisations
 * Peut être intégré dans n'importe quel formulaire
 */

import React, { useState, useCallback } from 'react';
import { SparklesIcon, CheckIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import intelligentComponentService from '../../services/intelligentComponentService';

const IAOptimizationPanel = ({ 
  formData, 
  formType = 'devis',
  description = '',
  onSuggestionSelect = null,
  compact = false 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [showPanel, setShowPanel] = useState(!compact);

  // Charger les suggestions IA
  const loadSuggestions = useCallback(async () => {
    if (!description.trim() && !formData) return;

    setLoading(true);
    try {
      const result = await intelligentComponentService.getSuggestionsForForm(
        formType,
        formData,
        description
      );

      if (result) {
        setSuggestions(result.proposals || []);
        setAiInsights(result);
      }
    } catch (error) {
      // IA suggestions not available - fallback to manual form
    } finally {
      setLoading(false);
    }
  }, [formData, formType, description]);

  // Mode compact: Bouton pour afficher panel
  if (compact) {
    return (
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium transition-all"
          title="Obtenir les suggestions IA"
        >
          <SparklesIcon className="w-4 h-4" />
          {!showPanel ? '🤖 IA' : '✕'}
        </button>

        {showPanel && (
          <IAOptimizationPanel 
            formData={formData}
            formType={formType}
            description={description}
            onSuggestionSelect={onSuggestionSelect}
            compact={false}
          />
        )}
      </div>
    );
  }

  // Mode complet: Panneau d'suggestions
  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 rounded-xl border-2 border-purple-200 dark:border-purple-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Suggestions IA Intelligentes
          </h3>
        </div>
        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? '⏳ Analyse...' : '🔍 Analyser'}
        </button>
      </div>

      {/* Confidence Score */}
      {aiInsights?.confidence_score && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Confiance IA:
          </span>
          <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-blue-500"
              style={{ width: `${(aiInsights.confidence_score * 100)}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {Math.round(aiInsights.confidence_score * 100)}%
          </span>
        </div>
      )}

      {/* Insights */}
      {aiInsights?.thinking_process && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            Analyse IA (5 étapes):
          </p>
          {aiInsights.thinking_process.map((step, idx) => (
            <div key={idx} className="text-xs">
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {idx + 1}. {step.name}:
              </span>
              <span className="text-gray-700 dark:text-gray-300 ml-2">
                {step.status === 'completed' ? '✓' : '⏳'} 
                {typeof step.result === 'string' 
                  ? step.result.substring(0, 50) + '...' 
                  : 'Analyse complète'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            💡 Propositions Recommandées:
          </p>
          <div className="grid gap-2">
            {suggestions.map((suggestion, idx) => (
              <div 
                key={idx}
                onClick={() => onSuggestionSelect?.(suggestion)}
                className="bg-white dark:bg-gray-800 rounded-lg p-3 cursor-pointer hover:shadow-lg hover:border-purple-400 border-2 border-transparent transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {typeof suggestion === 'string' ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300">{suggestion}</p>
                    ) : (
                      <>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                          {suggestion.titre || suggestion.machine_recommandee}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {suggestion.raison || suggestion.reasoning}
                        </p>
                        {suggestion.prix_HT && (
                          <p className="text-xs font-bold text-green-600 dark:text-green-400 mt-1">
                            💰 {suggestion.prix_HT} XOF
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin">
            <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Analyse IA en cours...
          </span>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          👉 Cliquez sur "Analyser" pour obtenir des suggestions IA personnalisées
        </p>
      )}

      {/* Quick Tips */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-3 rounded text-sm">
        <div className="flex items-start gap-2">
          <LightBulbIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800 dark:text-yellow-300">💡 Conseil IA:</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
              Plus vous décrivez précisément le besoin, meilleures seront les suggestions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IAOptimizationPanel;
