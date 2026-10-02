/**
 * Service OpenAI - Estimation intelligente et optimisation tarifaire
 * Intégration avec l'API OpenAI pour:
 * - Estimation automatique des devis
 * - Optimisation des tarifs basée sur l'IA
 * - Analyse de la base de connaissance tarifaire
 */

const OpenAI = require('openai');
const crypto = require('crypto');
const dbHelper = require('../utils/dbHelper');

// Constantes de chiffrement
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
// Clé de chiffrement fixe pour éviter les problèmes de déchiffrement
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
// Convertir la clé hexadécimale en Buffer de 32 bytes
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex').slice(0, 32);

/**
 * Chiffre une clé API
 * @param {string} apiKey - Clé API en clair
 * @returns {object} - { encrypted, iv }
 */
function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY,
    iv
  );
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

/**
 * Déchiffre une clé API
 * @param {string} encryptedKey - Clé chiffrée
 * @param {string} iv - Vecteur d'initialisation
 * @returns {string} - Clé API en clair
 */
function decryptApiKey(encryptedKey, iv) {
  try {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Erreur déchiffrement clé API:', error.message);
    throw new Error('Impossible de déchiffrer la clé API. Configuration corrompue ou clé de chiffrement modifiée.');
  }
}

/**
 * Récupère la configuration OpenAI depuis la base de données
 * @returns {Promise<object|null>}
 */
async function getOpenAIConfig() {
  try {
    const [rows] = await dbHelper.query(
      'SELECT * FROM openai_config ORDER BY id DESC LIMIT 1'
    );
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    console.error('❌ Erreur récupération config OpenAI:', error);
    return null;
  }
}

/**
 * Initialise le client OpenAI avec la clé depuis la DB
 * @returns {Promise<OpenAI|null>}
 */
async function getOpenAIClient() {
  const config = await getOpenAIConfig();
  
  if (!config || !config.is_active) {
    console.log('🔍 OpenAI désactivé ou non configuré');
    return null;
  }
  
  // Utilisation directe de api_key (sans encryption)
  if (!config.api_key) {
    console.log('🔑 Clé API OpenAI manquante - configurez-la depuis l\'interface admin');
    return null;
  }
  
  try {
    console.log('✅ Initialisation client OpenAI avec clé de longueur:', config.api_key.length);
    return new OpenAI({ apiKey: config.api_key });
  } catch (error) {
    console.error('❌ Erreur initialisation client OpenAI:', error.message);
    console.log('💡 Solution: Reconfigurer la clé API depuis l\'interface admin');
    return null;
  }
}

/**
 * Teste la connexion à l'API OpenAI
 * @param {string} apiKey - Clé API à tester
 * @returns {Promise<object>} - { success, message, model }
 */
async function testConnection(apiKey) {
  try {
    const client = new OpenAI({ apiKey });
    
    // Test simple avec un prompt minimal
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant test.' },
        { role: 'user', content: 'Réponds juste "OK"' }
      ],
      max_tokens: 10,
      temperature: 0
    });
    
    return {
      success: true,
      message: 'Connexion réussie à l\'API OpenAI',
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    console.error('❌ Test connexion OpenAI échoué:', error.message);
    return {
      success: false,
      message: error.message || 'Erreur de connexion',
      error: error.code
    };
  }
}

/**
 * Estime le prix d'un devis avec l'IA
 * @param {object} formulaireData - Données du formulaire (Roland ou Xerox)
 * @param {string} machineType - 'roland' ou 'xerox'
 * @param {array} tarifs - Grille tarifaire depuis la DB
 * @param {string} knowledgeBase - Base de connaissance tarifaire (optionnel)
 * @returns {Promise<object>} - { prix_estime, details, explanation }
 */
async function estimateQuote(formulaireData, machineType, tarifs, knowledgeBase = null) {
  const client = await getOpenAIClient();
  
  if (!client) {
    // Fallback: calcul manuel si IA indisponible
    return await estimateQuoteManually(formulaireData, machineType, tarifs);
  }
  
  try {
    // Incrémenter le compteur de requêtes
    await dbHelper.query(
      'UPDATE openai_config SET total_requests = total_requests + 1, last_request_at = NOW() WHERE id = 1'
    );
    
    // Construction du prompt
    const systemPrompt = buildEstimationSystemPrompt(knowledgeBase);
    const userPrompt = buildEstimationUserPrompt(formulaireData, machineType, tarifs);
    
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      prix_estime: parseFloat(result.prix_total) || 0,
      details: result.details || {},
      explanation: result.explication || '',
      marge_suggeree: result.marge_suggeree || null,
      recommendations: result.recommandations || [],
      ia_used: true,
      model: response.model
    };
  } catch (error) {
    console.error('❌ Erreur estimation IA:', error);
    // Fallback vers calcul manuel
    return await estimateQuoteManually(formulaireData, machineType, tarifs);
  }
}

/**
 * Construit le prompt système pour l'estimation
 */
function buildEstimationSystemPrompt(knowledgeBase) {
  let prompt = `Tu es un expert en tarification d'imprimerie numérique.
Ta mission est d'estimer le prix d'un devis avec précision en te basant sur:
1. Les données du formulaire client
2. La grille tarifaire fournie
3. Les spécificités techniques du projet

IMPORTANT:
- Retourne TOUJOURS un JSON valide
- Sois précis dans les calculs
- Explique ta méthodologie détaillée
- Propose des suggestions de marge (fourchette de prix conseillée)
- Donne des recommandations commerciales pertinentes

Format de réponse attendu:
{
  "prix_total": <nombre>,
  "details": {
    "base": <prix_de_base>,
    "finitions": <total_finitions>,
    "options": <total_options>,
    "remises": <total_remises>
  },
  "explication": "<texte_explicatif_detaille_sur_le_calcul_avec_surface_et_tarifs>",
  "marge_suggeree": {
    "min": <prix_minimum_conseille>,
    "max": <prix_maximum_conseille>,
    "conseil": "<explication_de_la_marge>"
  },
  "recommandations": [
    "<conseil_commercial_1>",
    "<conseil_commercial_2>",
    "<suggestion_amelioration_ou_option>"
  ]
}

EXEMPLE de recommandations attendues:
- "Vous pouvez facturer entre X et Y FCFA selon l'urgence du client"
- "Pour ce type de commande, une marge de 15-20% est appropriée"
- "Proposez une remise de X% si le client commande plus de Y unités"
- "Prix approximatif selon la surface de X m² à Y F/m²"`;

  if (knowledgeBase) {
    prompt += `\n\nBASE DE CONNAISSANCE TARIFAIRE:\n${knowledgeBase}`;
  }
  
  return prompt;
}

/**
 * Construit le prompt utilisateur avec les données du devis
 */
function buildEstimationUserPrompt(formulaireData, machineType, tarifs) {
  const tarifsText = tarifs.map(t => 
    `- ${t.label}: ${t.valeur} FCFA${t.unite ? ' / ' + t.unite : ''}`
  ).join('\n');
  
  return `DEMANDE D'ESTIMATION:

Type de machine: ${machineType.toUpperCase()}

Données du formulaire:
${JSON.stringify(formulaireData, null, 2)}

Grille tarifaire applicable:
${tarifsText}

Calcule le prix estimé total et détaille chaque poste de coût.`;
}

/**
 * Estimation manuelle (fallback sans IA)
 */
async function estimateQuoteManually(formulaireData, machineType, tarifs) {
  let prixBase = 0;
  let prixFinitions = 0;
  let prixOptions = 0;
  let details = {};
  
  if (machineType === 'roland') {
    // Calcul Roland basé sur surface
    const surface = parseFloat(formulaireData.surface || formulaireData.largeur * formulaireData.hauteur / 10000) || 0;
    const tarifSupport = tarifs.find(t => t.cle === formulaireData.support + '_m2');
    
    if (tarifSupport) {
      prixBase = surface * tarifSupport.valeur;
      details.base = { surface, prix_m2: tarifSupport.valeur, total: prixBase };
    }
    
    // Finitions
    if (formulaireData.finitions) {
      formulaireData.finitions.forEach(finition => {
        const tarifFinition = tarifs.find(t => t.cle === finition);
        if (tarifFinition) {
          const montant = tarifFinition.unite === 'm²' 
            ? surface * tarifFinition.valeur 
            : tarifFinition.valeur;
          prixFinitions += montant;
        }
      });
    }
    
  } else if (machineType === 'xerox') {
    // Calcul Xerox basé sur pages
    const nbPages = parseInt(formulaireData.nombre_pages || formulaireData.exemplaires) || 0;
    const tarifPage = tarifs.find(t => t.cle === formulaireData.papier);
    
    if (tarifPage) {
      prixBase = nbPages * tarifPage.valeur;
      details.base = { pages: nbPages, prix_page: tarifPage.valeur, total: prixBase };
    }
    
    // Finitions
    if (formulaireData.finitions) {
      formulaireData.finitions.forEach(finition => {
        const tarifFinition = tarifs.find(t => t.cle === finition);
        if (tarifFinition) {
          prixFinitions += tarifFinition.valeur;
        }
      });
    }
  }
  
  const prixTotal = prixBase + prixFinitions + prixOptions;
  
  return {
    prix_estime: Math.round(prixTotal),
    details: {
      base: prixBase,
      finitions: prixFinitions,
      options: prixOptions,
      ...details
    },
    explanation: 'Calcul automatique basé sur la grille tarifaire',
    recommendations: [],
    ia_used: false
  };
}

/**
 * Optimise les tarifs avec l'IA basée sur les statistiques
 * @param {array} currentPrices - Tarifs actuels
 * @param {object} statistics - Statistiques de production
 * @returns {Promise<object>} - Suggestions d'optimisation
 */
async function optimizePricing(currentPrices, statistics) {
  const client = await getOpenAIClient();
  
  if (!client) {
    return {
      success: false,
      message: 'IA non disponible'
    };
  }
  
  try {
    const config = await getOpenAIConfig();
    
    const systemPrompt = `Tu es un consultant en tarification pour imprimerie numérique.
Analyse les tarifs actuels et les statistiques de production pour proposer des optimisations.

${config?.knowledge_base_text ? 'BASE DE CONNAISSANCE:\n' + config.knowledge_base_text : ''}

Retourne un JSON avec:
{
  "suggestions": [
    {
      "tarif_id": <id>,
      "tarif_nom": "<nom>",
      "valeur_actuelle": <prix>,
      "valeur_suggeree": <nouveau_prix>,
      "justification": "<raison>"
    }
  ],
  "analyse_generale": "<texte>",
  "tendances": ["<tendance1>", "<tendance2>"]
}`;

    const userPrompt = `TARIFS ACTUELS:
${JSON.stringify(currentPrices, null, 2)}

STATISTIQUES DE PRODUCTION:
${JSON.stringify(statistics, null, 2)}

Propose des ajustements tarifaires pertinents.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1500
    });
    
    await dbHelper.query(
      'UPDATE openai_config SET total_requests = total_requests + 1, last_request_at = NOW() WHERE id = 1'
    );
    
    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('❌ Erreur optimisation tarifs:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Analyse une description en langage naturel pour extraire les informations de devis
 * @param {string} prompt - Le prompt contenant la description
 * @returns {Promise<object>} - Résultat structuré
 */
async function analyzeWithGPT(prompt) {
  try {
    const client = await getOpenAIClient();
    
    if (!client) {
      // Fallback: retourner une structure par défaut
      console.log('⚠️  OpenAI non disponible, utilisant fallback');
      return {
        product_type: 'Produit personnalisé',
        machine_recommended: 'xerox',
        details: 'Estimation manuelle requise',
        items: [
          {
            description: 'Produit personnalisé',
            quantity: 1,
            unit_price: 50000,
            notes: 'Contactez le responsable pour une estimation précise'
          }
        ],
        total_ht: 50000,
        notes: 'Estimation par défaut - OpenAI non configuré'
      };
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en services d'impression et de reprographie. Tu analyses les demandes des clients en français pour proposer des estimations détaillées et réalistes.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parser la réponse JSON
    let result;
    try {
      // Essayer de parser directement
      result = JSON.parse(content);
    } catch (parseError) {
      // Essayer d'extraire le JSON du texte
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser la réponse IA');
      }
    }

    // Valider et nettoyer la structure
    return {
      product_type: result.product_type || 'Produit personnalisé',
      machine_recommended: result.machine_recommended || 'xerox',
      details: result.details || '',
      items: Array.isArray(result.items) ? result.items : [],
      total_ht: result.total_ht || 0,
      notes: result.notes || ''
    };

  } catch (error) {
    console.error('❌ Erreur analyse GPT:', error.message);
    
    // Retourner une structure par défaut en cas d'erreur
    return {
      product_type: 'Produit personnalisé',
      machine_recommended: 'xerox',
      details: 'Estimation manuelle requise',
      items: [
        {
          description: 'Produit personnalisé',
          quantity: 1,
          unit_price: 50000,
          notes: 'Erreur lors de l\'analyse - estimation par défaut'
        }
      ],
      total_ht: 50000,
      notes: `Erreur lors de l'analyse IA: ${error.message}`
    };
  }
}

module.exports = {
  encryptApiKey,
  decryptApiKey,
  getOpenAIConfig,
  getOpenAIClient,
  testConnection,
  estimateQuote,
  optimizePricing,
  analyzeWithGPT
};
