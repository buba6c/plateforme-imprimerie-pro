/**
 * Test spécifique de la connexion OpenAI
 */

const openaiService = require('./backend/services/openaiService');
const dbHelper = require('./backend/utils/dbHelper');

console.log('=== TEST CONNEXION OPENAI ===\n');

(async () => {
  try {
    // 1. Test de la configuration
    console.log('1. Récupération de la configuration...');
    const config = await openaiService.getOpenAIConfig();
    
    if (!config) {
      console.log('❌ Aucune configuration trouvée');
      return;
    }
    
    console.log(`✅ Configuration trouvée:`);
    console.log(`   - ID: ${config.id}`);
    console.log(`   - Actif: ${config.is_active}`);
    console.log(`   - Clé chiffrée: ${config.api_key_encrypted ? 'Oui' : 'Non'}`);
    console.log(`   - IV: ${config.api_key_iv ? 'Oui' : 'Non'}`);
    console.log(`   - Base de connaissance: ${config.knowledge_base_text ? config.knowledge_base_text.length + ' caractères' : 'Non'}`);
    
    if (!config.is_active) {
      console.log('\n❌ OpenAI est désactivé');
      return;
    }
    
    if (!config.api_key_encrypted || !config.api_key_iv) {
      console.log('\n❌ Clé API manquante');
      return;
    }
    
    // 2. Test de déchiffrement
    console.log('\n2. Test de déchiffrement...');
    try {
      const client = await openaiService.getOpenAIClient();
      if (!client) {
        console.log('❌ Échec de création du client OpenAI');
        console.log('💡 La clé API n\'a pas pu être déchiffrée');
        console.log('📋 Solution: Reconfigurez la clé API depuis l\'interface admin');
        return;
      }
      
      console.log('✅ Client OpenAI créé avec succès');
      
      // 3. Test de connexion simple
      console.log('\n3. Test de connexion API...');
      const testResult = await openaiService.testConnection(await getDecryptedKey(config));
      
      if (testResult.success) {
        console.log('✅ Connexion OpenAI réussie!');
        console.log(`   - Modèle: ${testResult.model}`);
        console.log(`   - Usage: ${JSON.stringify(testResult.usage)}`);
        
        // 4. Test d'estimation complète
        console.log('\n4. Test d\'estimation complète...');
        
        const testData = {
          type_support: 'Bâche',
          largeur: '200',
          hauteur: '150',
          unite: 'cm',
          nombre_exemplaires: '2'
        };
        
        const [tarifs] = await dbHelper.query('SELECT * FROM tarifs_config WHERE actif = TRUE AND type_machine = $1', ['roland']);
        
        const estimation = await openaiService.estimateQuote(testData, 'roland', tarifs, config.knowledge_base_text);
        
        console.log('🎉 Estimation réussie!');
        console.log(`   - Prix estimé: ${estimation.prix_estime} FCFA`);
        console.log(`   - IA utilisée: ${estimation.ia_used ? '✅ OUI' : '❌ NON'}`);
        console.log(`   - Modèle: ${estimation.model || 'Non spécifié'}`);
        
        if (estimation.explanation) {
          console.log(`   - Explication: ${estimation.explanation.substring(0, 200)}...`);
        }
        
        if (estimation.recommendations && estimation.recommendations.length > 0) {
          console.log(`   - Recommandations: ${estimation.recommendations.join(', ')}`);
        }
        
        // Vérifier la mise à jour du compteur
        const [newConfig] = await dbHelper.query('SELECT total_requests FROM openai_config WHERE id = $1', [config.id]);
        console.log(`   - Compteur requêtes: ${newConfig[0].total_requests}`);
        
      } else {
        console.log('❌ Échec de connexion OpenAI');
        console.log(`   - Message: ${testResult.message}`);
        console.log(`   - Code erreur: ${testResult.error}`);
      }
      
    } catch (error) {
      console.log('❌ Erreur lors du test de déchiffrement:', error.message);
      console.log('💡 La clé de chiffrement a peut-être changé');
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  } finally {
    process.exit(0);
  }
})();

// Fonction helper pour récupérer la clé déchiffrée (pour les tests)
async function getDecryptedKey(config) {
  try {
    const crypto = require('crypto');
    const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
    const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
    const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex').slice(0, 32);
    
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(config.api_key_iv, 'hex')
    );
    
    let decrypted = decipher.update(config.api_key_encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Déchiffrement impossible');
  }
}