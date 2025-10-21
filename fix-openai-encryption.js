/**
 * Script pour corriger le problème de chiffrement de la clé OpenAI
 */

const dbHelper = require('./backend/utils/dbHelper');
const openaiService = require('./backend/services/openaiService');

console.log('=== CORRECTION CHIFFREMENT OPENAI ===\n');

(async () => {
  try {
    // 1. Récupérer la configuration actuelle
    console.log('1. Récupération de la configuration actuelle...');
    const [configs] = await dbHelper.query('SELECT * FROM openai_config ORDER BY id DESC LIMIT 1');
    
    if (configs.length === 0) {
      console.log('❌ Aucune configuration OpenAI trouvée');
      process.exit(1);
    }
    
    const config = configs[0];
    console.log(`✅ Configuration trouvée (ID: ${config.id})`);
    
    if (!config.api_key_encrypted || !config.api_key_iv) {
      console.log('❌ Aucune clé API chiffrée trouvée dans la configuration');
      console.log('📋 Veuillez configurer une nouvelle clé API depuis l\'interface admin');
      process.exit(1);
    }
    
    // 2. Tentative de test de la clé actuelle
    console.log('\n2. Test de la clé API actuelle...');
    try {
      const client = await openaiService.getOpenAIClient();
      if (client) {
        console.log('✅ La clé API fonctionne déjà correctement');
        process.exit(0);
      }
    } catch (error) {
      console.log('❌ La clé API actuelle ne peut pas être déchiffrée');
    }
    
    // 3. Demander une nouvelle clé API
    console.log('\n3. Pour corriger le problème, vous devez:');
    console.log('   1. Aller dans l\'interface admin');
    console.log('   2. Accéder aux Paramètres OpenAI');
    console.log('   3. Saisir à nouveau votre clé API OpenAI');
    console.log('   4. Cliquer sur "Tester la connexion"');
    console.log('   5. Sauvegarder la configuration');
    console.log('\n⚠️  Cela rechiffrera automatiquement la clé avec la bonne clé de chiffrement');
    
    // 4. Alternative: réinitialiser la configuration pour forcer une nouvelle saisie
    console.log('\n4. Ou bien, réinitialiser automatiquement la configuration:');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Voulez-vous réinitialiser la configuration OpenAI (O/N)? ', async (answer) => {
      if (answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui') {
        try {
          // Réinitialiser seulement les champs de clé API
          await dbHelper.query(`
            UPDATE openai_config 
            SET api_key_encrypted = NULL, 
                api_key_iv = NULL, 
                is_active = FALSE,
                updated_at = NOW() 
            WHERE id = $1
          `, [config.id]);
          
          console.log('✅ Configuration réinitialisée avec succès');
          console.log('📋 Vous devez maintenant configurer une nouvelle clé API depuis l\'interface admin');
        } catch (error) {
          console.error('❌ Erreur lors de la réinitialisation:', error.message);
        }
      } else {
        console.log('ℹ️  Configuration non modifiée');
        console.log('📋 Configurez manuellement une nouvelle clé API depuis l\'interface admin');
      }
      
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
})();