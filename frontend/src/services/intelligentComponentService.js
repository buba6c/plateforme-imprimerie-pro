/**
 * Service IA pour intégrer l'intelligence sur les composants
 * Fournit des suggestions, optimisations et assistance contextuelles
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export const intelligentComponentService = {
  /**
   * 🤖 Analyse une description devis avec IA
   * Utilisé par: DevisCreation, CreateDossier
   */
  async analyzeDevisDescription(description, clientName, contact) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API_URL}/devis/analyze-description`,
        { description, client_name: clientName, contact },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('❌ IA Devis Analysis Error:', error);
      throw error;
    }
  },

  /**
   * 🤖 Obtient des suggestions IA pour remplir un formulaire
   * Utilisé par: CreateDossier
   */
  async getSuggestionsForForm(formType, currentData, description = '') {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API_URL}/ai-agent/analyze`,
        {
          request: description || `Analyse le formulaire ${formType}`,
          currentForm: currentData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('❌ IA Form Suggestions Error:', error);
      return null;
    }
  },

  /**
   * 🤖 Valide et optimise les données devis
   * Utilisé par: DevisList, confirmation
   */
  async optimizeDevisData(devisData) {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Préparer le contexte
      const context = `
        Optimise ce devis avec l'IA:
        - Vérifie la cohérence des données
        - Suggère des améliorations de prix
        - Propose des alternatives
        - Identifie les risques
      `;

      const response = await axios.post(
        `${API_URL}/ai-agent/refine`,
        {
          description: JSON.stringify(devisData),
          current_proposal: devisData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    } catch (error) {
      console.error('❌ IA Optimization Error:', error);
      return null;
    }
  },

  /**
   * 🤖 Génère des recommandations basées sur l'historique
   * Utilisé par: Dashboard, suggestions
   */
  async getRecommendations(userContext, previousDevis = []) {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(
        `${API_URL}/ai-agent/analyze`,
        {
          request: 'Propose des devis basés sur l\'historique',
          currentForm: {
            history: previousDevis.slice(-5), // Derniers 5 devis
            userContext
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data.proposals || [];
    } catch (error) {
      console.error('❌ IA Recommendations Error:', error);
      return [];
    }
  },

  /**
   * 🤖 Analyse la conformité d'un devis
   * Utilisé par: DevisList, vérification
   */
  async analyzeCompliance(devisData) {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(
        `${API_URL}/ai-agent/analyze`,
        {
          request: 'Analyse la conformité et les risques du devis',
          description: JSON.stringify(devisData)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return {
        isCompliant: response.data.success,
        issues: response.data.thinking_process?.filter(step => step.name.includes('Analyse')),
        confidence: response.data.confidence_score
      };
    } catch (error) {
      console.error('❌ IA Compliance Analysis Error:', error);
      return { isCompliant: true, issues: [], confidence: 0 };
    }
  },

  /**
   * 🤖 Suggestion d'amélioration rapide
   * Utilisé par: Quick actions, tooltips
   */
  async getQuickSuggestion(type, data) {
    try {
      const suggestions = {
        price_optimization: `Le prix peut être optimisé. Suggestion: ${data.price * 0.95}`,
        quantity_alert: `Attention: quantité élevée. Vérifiez la machine disponible`,
        deadline_warning: `Délai court. Considérez la surcharge`,
        format_suggestion: `Format recommandé pour cette machine: ${data.machine}`
      };

      return suggestions[type] || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * 🤖 Analyse compétitive avec l'IA
   * Utilisé par: Optimisations, benchmarking
   */
  async analyzeCompetitive(devisPrice, productType, quantity) {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(
        `${API_URL}/ai-agent/analyze`,
        {
          request: `Analyse compétitive: ${productType} x${quantity} @ ${devisPrice} XOF`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return {
        competitive: response.data.confidence_score > 0.7,
        priceRanking: response.data.final_recommendation?.proposals?.[0]?.prix_HT,
        recommendation: response.data.final_recommendation
      };
    } catch (error) {
      return { competitive: true, priceRanking: 'N/A', recommendation: null };
    }
  }
};

export default intelligentComponentService;
