/**
 * DevisCreation Amélioré avec IA Intelligente
 * Intègre les suggestions IA et optimisations
 */

import React, { useState } from 'react';
import DevisCreation from './DevisCreation';
import IAOptimizationPanel from '../ai/IAOptimizationPanel';
import intelligentComponentService from '../../services/intelligentComponentService';

const DevisCreationWithAI = ({ user, onSuccess }) => {
  const [formData, setFormData] = useState({});
  const [description, setDescription] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  // Analyser la description avec IA
  const analyzeWithAI = async () => {
    if (!description.trim()) return;

    try {
      const analysis = await intelligentComponentService.analyzeDevisDescription(
        description,
        'Auto-analysé par IA',
        'ai@system.local'
      );

      setAiSuggestions(analysis);
      setShowAISuggestions(true);
    } catch (error) {
      // IA analysis not available - continue with manual form
    }
  };

  // Appliquer les suggestions de l'IA
  const applySuggestion = (suggestion) => {
    if (suggestion.items && Array.isArray(suggestion.items)) {
      setFormData({
        ...formData,
        items: suggestion.items,
        total: suggestion.total_ht,
        machine_recommended: suggestion.machine_recommended
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Panneau IA - Suggestions */}
      {showAISuggestions && aiSuggestions && (
        <div className="grid gap-4 md:grid-cols-3">
          <IAOptimizationPanel 
            formData={formData}
            description={description}
            onSuggestionSelect={applySuggestion}
          />
        </div>
      )}

      {/* Formulaire Devis Standard */}
      <DevisCreation 
        user={user}
        onBack={() => {}}
        onSuccess={onSuccess}
        onDescriptionChange={(desc) => {
          setDescription(desc);
          if (desc.length > 20) {
            analyzeWithAI();
          }
        }}
        aiSuggestions={aiSuggestions}
      />
    </div>
  );
};

export default DevisCreationWithAI;
