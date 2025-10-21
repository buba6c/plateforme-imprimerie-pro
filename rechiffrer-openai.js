/**
 * Script pour rechiffrer la clé API OpenAI
 */

const dbHelper = require('./backend/utils/dbHelper');
const openaiService = require('./backend/services/openaiService');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== RECHIFFREMENT CLE API OPENAI ===\n');

(async () => {
  try {
    console.log('⚠️  Ce script va vous demander de saisir à nouveau votre clé API OpenAI');
    console.log('   pour la rechiffrer avec la bonne clé de chiffrement.\n');
    
    // 1. Récupérer la configuration actuelle
    const [configs] = await dbHelper.query('SELECT * FROM openai_config WHERE id = 1');
    
    if (configs.length === 0) {
      console.log('❌ Aucune configuration OpenAI trouvée');
      process.exit(1);
    }
    
    const config = configs[0];
    console.log('✅ Configuration OpenAI trouvée');
    console.log(`   - Actif: ${config.is_active}`);
    console.log(`   - Clé chiffrée: ${config.api_key_encrypted ? 'Oui' : 'Non'}`);
    
    // 2. Demander la clé API
    rl.question('\n🔑 Saisissez votre clé API OpenAI (sk-...): ', async (apiKey) => {
      try {
        if (!apiKey || !apiKey.startsWith('sk-')) {
          console.log('❌ Clé API invalide (doit commencer par sk-)');
          rl.close();
          process.exit(1);
        }
        
        console.log('\n🧪 Test de la clé API...');
        
        // 3. Tester la clé API
        const testResult = await openaiService.testConnection(apiKey);
        
        if (!testResult.success) {
          console.log('❌ Clé API invalide ou problème de connexion');
          console.log(`   Erreur: ${testResult.message}`);
          rl.close();
          process.exit(1);
        }
        
        console.log('✅ Clé API valide!');
        console.log(`   Modèle: ${testResult.model}`);
        
        // 4. Chiffrer la clé
        console.log('\n🔐 Chiffrement de la clé API...');
        const { encrypted, iv } = openaiService.encryptApiKey(apiKey);
        
        // 5. Mettre à jour en base
        console.log('💾 Sauvegarde en base de données...');
        await dbHelper.query(`
          UPDATE openai_config 
          SET api_key_encrypted = $1, 
              api_key_iv = $2, 
              is_active = true,
              last_test_at = NOW(),
              last_test_status = 'success',
              updated_at = NOW() 
          WHERE id = 1
        `, [encrypted, iv]);
        
        console.log('✅ Configuration mise à jour avec succès!');
        
        // 6. Test final
        console.log('\n🧪 Test final avec la nouvelle configuration...');
        const finalClient = await openaiService.getOpenAIClient();
        
        if (finalClient) {
          console.log('🎉 Succès! La clé API est maintenant correctement chiffrée et fonctionnelle');
          
          // Test d'estimation
          console.log('\n🔍 Test d\'estimation rapide...');
          const testData = {
            type_support: 'Bâche',
            largeur: '100',
            hauteur: '100',
            unite: 'cm',
            nombre_exemplaires: '1'
          };
          
          const [tarifs] = await dbHelper.query('SELECT * FROM tarifs_config WHERE actif = TRUE AND type_machine = $1 LIMIT 5', ['roland']);
          const estimation = await openaiService.estimateQuote(testData, 'roland', tarifs, config.knowledge_base_text);
          
          console.log(`   - Prix estimé: ${estimation.prix_estime} FCFA`);
          console.log(`   - IA utilisée: ${estimation.ia_used ? '✅ OUI' : '❌ NON'}`);
          
          if (estimation.ia_used) {
            console.log('\n🎯 OpenAI fonctionne parfaitement!');
            console.log('📋 Vous pouvez maintenant créer des devis avec estimation IA');
          }
          
        } else {
          console.log('❌ Erreur: impossible de créer le client OpenAI après mise à jour');
        }
        
      } catch (error) {
        console.error('❌ Erreur lors du rechiffrement:', error.message);
      } finally {
        rl.close();
        process.exit(0);
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    rl.close();
    process.exit(1);
  }
})();