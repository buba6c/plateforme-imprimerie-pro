/**
 * Script de diagnostic pour OpenAI
 */

const path = require('path');

console.log('=== DIAGNOSTIC OPENAI ===\n');

// Test 1: Vérification des modules
console.log('1. Vérification des modules...');
try {
  const dbHelper = require('./backend/utils/dbHelper');
  console.log('✅ dbHelper importé');
  
  const openaiService = require('./backend/services/openaiService');
  console.log('✅ openaiService importé');
  
  // Test 2: Configuration base de données
  console.log('\n2. Test de la configuration OpenAI...');
  
  (async () => {
    try {
      // Récupérer la config OpenAI
      const config = await openaiService.getOpenAIConfig();
      
      if (!config) {
        console.log('❌ Aucune configuration OpenAI trouvée');
        console.log('📋 Actions requises:');
        console.log('   1. Aller dans l\'interface admin');
        console.log('   2. Configurer une clé API OpenAI');
        console.log('   3. Activer l\'IA');
        return;
      }
      
      console.log('✅ Configuration OpenAI trouvée:');
      console.log(`   - Actif: ${config.is_active ? '✅' : '❌'}`);
      console.log(`   - Clé API: ${config.api_key_encrypted ? '✅ Configurée' : '❌ Manquante'}`);
      console.log(`   - Base de connaissance: ${config.knowledge_base_text ? config.knowledge_base_text.length + ' caractères' : '❌ Vide'}`);
      console.log(`   - Requêtes totales: ${config.total_requests || 0}`);
      
      if (!config.is_active) {
        console.log('\n⚠️  OpenAI est DÉSACTIVÉ');
        console.log('📋 Pour activer:');
        console.log('   1. Interface Admin > Paramètres OpenAI');
        console.log('   2. Cocher "Activer l\'IA"');
        console.log('   3. Sauvegarder');
        return;
      }
      
      if (!config.api_key_encrypted) {
        console.log('\n❌ Clé API manquante');
        console.log('📋 Pour configurer:');
        console.log('   1. Obtenir une clé API sur platform.openai.com');
        console.log('   2. Interface Admin > Paramètres OpenAI');
        console.log('   3. Saisir la clé API');
        console.log('   4. Tester la connexion');
        console.log('   5. Sauvegarder');
        return;
      }
      
      console.log('\n3. Test d\'estimation...');
      
      // Test avec données fictives
      const testData = {
        type_support: 'Bâche',
        largeur: '200',
        hauteur: '100', 
        unite: 'cm',
        nombre_exemplaires: '1'
      };
      
      // Récupérer les tarifs
      const [tarifs] = await dbHelper.query('SELECT * FROM tarifs_config WHERE actif = TRUE AND type_machine = $1', ['roland']);
      console.log(`✅ ${tarifs.length} tarifs trouvés pour Roland`);
      
      // Faire l'estimation
      const estimation = await openaiService.estimateQuote(testData, 'roland', tarifs, config.knowledge_base_text);
      
      console.log('🎉 Test d\'estimation réussi!');
      console.log(`   - Prix estimé: ${estimation.prix_estime} FCFA`);
      console.log(`   - IA utilisée: ${estimation.ia_used ? 'OUI' : 'NON (fallback manuel)'}`);
      console.log(`   - Modèle: ${estimation.model || 'Non spécifié'}`);
      
      if (estimation.explanation) {
        console.log(`   - Explication: ${estimation.explanation.substring(0, 150)}...`);
      }
      
      if (!estimation.ia_used) {
        console.log('\n⚠️  L\'estimation utilise le fallback manuel');
        console.log('🔍 Causes possibles:');
        console.log('   - Clé API invalide');
        console.log('   - Problème de réseau');
        console.log('   - Quota OpenAI dépassé');
        console.log('   - Service OpenAI indisponible');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du diagnostic:', error.message);
      
      if (error.code === 'invalid_api_key') {
        console.log('\n🔑 Problème de clé API:');
        console.log('   - La clé API OpenAI est invalide ou expirée');
        console.log('   - Vérifiez votre clé sur platform.openai.com');
      } else if (error.code === 'insufficient_quota') {
        console.log('\n💰 Problème de quota:');
        console.log('   - Votre quota OpenAI est épuisé');
        console.log('   - Ajoutez des crédits sur votre compte OpenAI');
      } else {
        console.log('\n🔍 Erreur technique détaillée:');
        console.log(error);
      }
    }
    
    process.exit(0);
  })();
  
} catch (error) {
  console.error('❌ Erreur lors de l\'importation:', error.message);
  process.exit(1);
}