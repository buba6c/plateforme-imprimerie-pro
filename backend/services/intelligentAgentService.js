/**
 * Service Agent IA Intelligent
 * Analyse intelligente des demandes avec réflexion multi-étapes
 * et propositions optimisées basées sur la base de données tarifaire
 */

const dbHelper = require('../utils/dbHelper');
const { getOpenAIClient } = require('./openaiService');

class IntelligentQuoteAgent {
  constructor() {
    this.tariffCache = null;
    this.lastCacheBuild = 0;
    this.CACHE_DURATION = 3600000; // 1 heure
  }

  /**
   * Analyse complète avec réflexion multi-étapes
   */
  async reflectiveAnalysis(userDescription, currentForm = {}) {
    try {
      console.log('🤖 Démarrage de l\'analyse réflexive intelligente...');
      
      // Construire le contexte
      const context = await this.buildContext();
      
      // Étapes de réflexion
      const thinkingSteps = [];

      // Étape 1: Compréhension du besoin
      console.log('📊 Étape 1: Compréhension du besoin');
      thinkingSteps.push({
        name: 'Compréhension du Besoin',
        status: 'completed',
        result: await this.understandNeed(userDescription, context)
      });

      // Étape 2: Analyse des contraintes
      console.log('📊 Étape 2: Analyse des contraintes');
      thinkingSteps.push({
        name: 'Analyse des Contraintes',
        status: 'completed',
        result: await this.analyzeConstraints(
          userDescription, 
          thinkingSteps[0].result, 
          context
        )
      });

      // Étape 3: Recherche des solutions
      console.log('📊 Étape 3: Recherche des solutions');
      thinkingSteps.push({
        name: 'Recherche des Solutions',
        status: 'completed',
        result: await this.findSolutions(
          thinkingSteps[0].result,
          thinkingSteps[1].result,
          context
        )
      });

      // Étape 4: Évaluation des solutions
      console.log('📊 Étape 4: Évaluation des solutions');
      thinkingSteps.push({
        name: 'Évaluation des Solutions',
        status: 'completed',
        result: await this.evaluateSolutions(
          thinkingSteps[2].result,
          context
        )
      });

      // Étape 5: Recommandations finales
      console.log('📊 Étape 5: Recommandations finales');
      thinkingSteps.push({
        name: 'Recommandations Finales',
        status: 'completed',
        result: await this.generateRecommendations(
          thinkingSteps,
          context
        )
      });

      // Calculer la confiance globale
      const confidence = this.calculateConfidence(thinkingSteps);

      return {
        success: true,
        thinking_process: thinkingSteps,
        final_recommendation: thinkingSteps[4].result,
        proposals: thinkingSteps[4].result.proposals || [],
        confidence_score: confidence,
        reasoning_explanation: this.generateExplanation(thinkingSteps)
      };

    } catch (error) {
      console.error('❌ Erreur analyse réflexive:', error.message);
      return {
        success: false,
        error: error.message,
        fallback_proposal: this.generateFallbackProposal()
      };
    }
  }

  /**
   * Construire le contexte complet
   */
  async buildContext() {
    // Vérifier le cache
    if (this.tariffCache && (Date.now() - this.lastCacheBuild) < this.CACHE_DURATION) {
      return this.tariffCache;
    }

    console.log('🔄 Reconstruction du contexte tarifaire...');

    const context = {
      xeroxTariffs: await this.getXeroxTariffs(),
      rolandTariffs: await this.getRolandTariffs(),
      finitions: await this.getFinitions(),
      recentQuotes: await this.getRecentQuotes(),
      successPatterns: await this.getSuccessPatterns()
    };

    this.tariffCache = context;
    this.lastCacheBuild = Date.now();

    return context;
  }

  /**
   * Étape 1: Comprendre le besoin
   */
  async understandNeed(description, context) {
    const client = await getOpenAIClient();
    
    if (!client) {
      return { error: 'OpenAI non disponible' };
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en imprimerie. Analyse cette demande et extrais en JSON:
          - Type de produit
          - Quantité exacte
          - Format/Taille
          - Couleur (couleur ou N&B)
          - Délai souhaité
          - Budget estimé
          - Besoins spécifiques
          
          Retourne un JSON valide et structuré.`
        },
        {
          role: 'user',
          content: description
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      return { raw_understanding: response.choices[0].message.content };
    }
  }

  /**
   * Étape 2: Analyser les contraintes
   */
  async analyzeConstraints(description, understanding, context) {
    const client = await getOpenAIClient();
    
    if (!client) {
      return { constraints: [] };
    }

    const constraintPrompt = `
    Basé sur cette demande client: "${description}"
    
    Identifie les contraintes en JSON:
    1. Technique (machine compatible)
    2. Délai (urgent? normal?)
    3. Budget (limité? flexible?)
    4. Qualité (standard? premium?)
    5. Logistique (livraison?)
    
    Retourne un JSON structuré et valide.
    `;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: constraintPrompt }],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      return { constraints: response.choices[0].message.content };
    }
  }

  /**
   * Étape 3: Trouver les solutions possibles
   */
  async findSolutions(understanding, constraints, context) {
    console.log('🔍 Recherche des solutions compatibles...');

    const solutions = [];

    // Solution Xerox
    if (this.isXeroxEligible(understanding, constraints)) {
      solutions.push({
        machine: 'xerox',
        eligibility_score: 0.95,
        reason: 'Xerox est idéal pour les petits à moyens volumes',
        estimated_price: await this.estimateXeroxPrice(understanding),
        lead_time: '2-3 jours',
        quality_level: 'Standard'
      });
    }

    // Solution Roland
    if (this.isRolandEligible(understanding, constraints)) {
      solutions.push({
        machine: 'roland',
        eligibility_score: 0.90,
        reason: 'Roland offre une meilleure qualité pour les grands formats',
        estimated_price: await this.estimateRolandPrice(understanding),
        lead_time: '4-5 jours',
        quality_level: 'Premium'
      });
    }

    // Solution combinée (si pertinente)
    if (solutions.length > 1) {
      solutions.push({
        machine: 'combined',
        eligibility_score: 0.85,
        reason: 'Combinaison pour optimiser le prix/qualité',
        estimated_price: await this.estimateCombinedPrice(understanding),
        lead_time: '3-4 jours',
        quality_level: 'Optimisée',
        split_strategy: this.calculateOptimalSplit(understanding)
      });
    }

    return { solutions, total_options: solutions.length };
  }

  /**
   * Étape 4: Évaluer les solutions
   */
  async evaluateSolutions(solutionsData, context) {
    const client = await getOpenAIClient();
    
    if (!client) {
      return { evaluations: [] };
    }

    const evaluationPrompt = `
    Évalue en JSON ces solutions d'imprimerie:
    ${JSON.stringify(solutionsData.solutions, null, 2)}
    
    Pour chacune, fournis dans le JSON:
    - Score de qualité (0-100)
    - Score de coût-efficacité (0-100)
    - Pros et cons
    - Recommandation (1e, 2e, 3e choix)
    
    Retourne un JSON valide avec ces champs.
    `;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: evaluationPrompt }],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      return { evaluations: response.choices[0].message.content };
    }
  }

  /**
   * Étape 5: Générer les recommandations
   */
  async generateRecommendations(thinkingSteps, context) {
    const client = await getOpenAIClient();
    
    if (!client) {
      return { proposals: [] };
    }

    const thinking = thinkingSteps.map(s => `${s.name}: ${JSON.stringify(s.result)}`).join('\n\n');

    const recommendationPrompt = `
    Basé sur ce processus de réflexion complet:
    ${thinking}
    
    Génère en JSON 3 propositions finales CLASSÉES PAR PERTINENCE:
    
    Pour chaque proposition dans le JSON:
    - Titre clair
    - Machine recommandée
    - Configuration détaillée
    - Prix HT
    - Délai
    - Avantages spécifiques
    - Cas d'usage idéal
    
    Sois pratique et actionnable dans ta réponse JSON.
    `;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: recommendationPrompt }],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    try {
      const parsed = JSON.parse(response.choices[0].message.content);
      return {
        proposals: parsed.proposals || [parsed],
        primary_recommendation: (parsed.proposals || [parsed])[0],
        alternatives: (parsed.proposals || [parsed]).slice(1)
      };
    } catch (e) {
      return {
        proposals: [response.choices[0].message.content],
        raw_response: true
      };
    }
  }

  // ========== HELPERS ==========

  async getXeroxTariffs() {
    try {
      const [tariffs] = await dbHelper.query(`
        SELECT cle, libelle, valeur, unite, categorie
        FROM tarifs_config
        WHERE machine = 'xerox' AND is_active = true
        ORDER BY categorie, libelle
      `);
      return tariffs || [];
    } catch (e) {
      console.error('Erreur lecture tarifs Xerox:', e);
      return [];
    }
  }

  async getRolandTariffs() {
    try {
      const [tariffs] = await dbHelper.query(`
        SELECT cle, libelle, valeur, unite, categorie
        FROM tarifs_config
        WHERE machine = 'roland' AND is_active = true
        ORDER BY categorie, libelle
      `);
      return tariffs || [];
    } catch (e) {
      console.error('Erreur lecture tarifs Roland:', e);
      return [];
    }
  }

  async getFinitions() {
    try {
      const [finitions] = await dbHelper.query(`
        SELECT cle, libelle, valeur
        FROM tarifs_config
        WHERE categorie = 'finition' AND is_active = true
      `);
      return finitions || [];
    } catch (e) {
      return [];
    }
  }

  async getRecentQuotes(limit = 50) {
    try {
      const [quotes] = await dbHelper.query(`
        SELECT id, machine_type, prix_estime, created_at
        FROM devis
        ORDER BY created_at DESC
        LIMIT ?
      `, [limit]);
      return quotes || [];
    } catch (e) {
      return [];
    }
  }

  async getSuccessPatterns() {
    try {
      const [patterns] = await dbHelper.query(`
        SELECT 
          machine_type,
          COUNT(*) as frequency,
          AVG(prix_estime) as avg_price
        FROM devis
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        GROUP BY machine_type
      `);
      return patterns || [];
    } catch (e) {
      return [];
    }
  }

  async estimateXeroxPrice(understanding) {
    // Estimation simplifiée - à affiner
    const quantity = understanding.quantity || 100;
    const pricePerPage = 100; // FCFA
    return quantity * pricePerPage;
  }

  async estimateRolandPrice(understanding) {
    // Estimation simplifiée - à affiner
    const quantity = understanding.quantity || 100;
    const pricePerM2 = 50000; // FCFA
    return Math.max(quantity * pricePerM2 / 1000, 100000);
  }

  async estimateCombinedPrice(understanding) {
    const xerox = await this.estimateXeroxPrice(understanding);
    const roland = await this.estimateRolandPrice(understanding);
    return Math.min(xerox, roland) * 0.95; // Remise de 5%
  }

  isXeroxEligible(understanding, constraints) {
    const quantity = understanding.quantity || 100;
    return quantity < 10000; // Xerox pour petits/moyens volumes
  }

  isRolandEligible(understanding, constraints) {
    const size = understanding.size || 'A4';
    return ['A3', 'A2', 'A1', 'custom'].includes(size?.toUpperCase());
  }

  calculateOptimalSplit(understanding) {
    return {
      xerox_percentage: 60,
      roland_percentage: 40,
      reason: 'Distribution optimale pour ce volume'
    };
  }

  calculateConfidence(thinkingSteps) {
    // Calculer un score de confiance basé sur la cohérence des étapes
    return Math.min(0.95, 0.7 + (thinkingSteps.length * 0.05));
  }

  generateExplanation(thinkingSteps) {
    return thinkingSteps
      .map(step => `${step.name}: ${JSON.stringify(step.result).substring(0, 100)}...`)
      .join('\n');
  }

  generateFallbackProposal() {
    return {
      proposals: [
        {
          title: 'Option Standard',
          machine: 'xerox',
          price: 50000,
          lead_time: '2-3 jours',
          notes: 'Configuration par défaut'
        }
      ],
      confidence_score: 0.3,
      note: 'Analyse IA non disponible - proposition par défaut'
    };
  }
}

module.exports = new IntelligentQuoteAgent();
