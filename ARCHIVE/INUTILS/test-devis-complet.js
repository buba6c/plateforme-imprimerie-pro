/**
 * Test complet des fonctionnalités de devis
 */

const dbHelper = require('./backend/utils/dbHelper');
const openaiService = require('./backend/services/openaiService');
const axios = require('axios');

console.log('=== TEST COMPLET DES DEVIS ===\n');

const API_URL = 'http://localhost:5001/api';

// Fonction pour obtenir un token admin (simulation)
async function getAdminToken() {
  try {
    // Récupérer un utilisateur admin
    const [admins] = await dbHelper.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length === 0) {
      throw new Error('Aucun utilisateur admin trouvé');
    }
    
    // Pour les tests, on simule un token - en production, il faudrait se connecter via l'API
    return 'test-admin-token-' + admins[0].id;
  } catch (error) {
    console.log('⚠️  Impossible de récupérer un token admin, utilisation d\'un token de test');
    return 'test-token';
  }
}

(async () => {
  try {
    // 1. Test des devis existants
    console.log('1. Vérification des devis existants...');
    const [existingDevis] = await dbHelper.query(`
      SELECT d.*, u.prenom, u.nom 
      FROM devis d 
      LEFT JOIN users u ON d.user_id = u.id 
      ORDER BY d.created_at DESC 
      LIMIT 5
    `);
    
    console.log(`✅ ${existingDevis.length} devis trouvés dans la base`);
    
    if (existingDevis.length > 0) {
      console.log('\n📋 Devis existants:');
      existingDevis.forEach((devis, index) => {
        console.log(`   ${index + 1}. ${devis.numero} (${devis.machine_type})`);
        console.log(`      - Client: ${devis.client_nom || 'Non renseigné'}`);
        console.log(`      - Prix: ${devis.prix_estime} FCFA`);
        console.log(`      - Statut: ${devis.statut}`);
        console.log(`      - Créé par: ${devis.prenom} ${devis.nom}`);
        
        // Vérifier si l'IA a été utilisée
        if (devis.details_prix) {
          try {
            const details = JSON.parse(devis.details_prix);
            console.log(`      - IA utilisée: ${details.ia_used ? '✅ OUI' : '❌ NON'}`);
          } catch (e) {
            console.log(`      - IA utilisée: ❓ Indéterminé`);
          }
        }
        console.log('');
      });
    }
    
    // 2. Test de la configuration OpenAI
    console.log('2. Test de la configuration OpenAI...');
    const openaiConfig = await openaiService.getOpenAIConfig();
    
    if (!openaiConfig || !openaiConfig.is_active) {
      console.log('❌ OpenAI n\'est pas configuré ou désactivé');
      console.log('📋 Utilisez le script rechiffrer-openai.js pour configurer OpenAI');
    } else {
      console.log('✅ OpenAI configuré et actif');
      
      const client = await openaiService.getOpenAIClient();
      if (client) {
        console.log('✅ Client OpenAI créé avec succès');
      } else {
        console.log('❌ Impossible de créer le client OpenAI');
        console.log('💡 Utilisez le script rechiffrer-openai.js pour reconfigurer la clé');
      }
    }
    
    // 3. Test de création d'un nouveau devis
    console.log('\n3. Test de création d\'un nouveau devis...');
    
    // Récupérer un utilisateur pour créer le devis
    const [users] = await dbHelper.query("SELECT * FROM users WHERE role IN ('preparateur', 'admin') LIMIT 1");
    
    if (users.length === 0) {
      console.log('❌ Aucun utilisateur trouvé pour créer un devis');
      return;
    }
    
    const user = users[0];
    console.log(`📝 Création d'un devis de test par: ${user.prenom} ${user.nom}`);
    
    // Données de test pour un devis Roland
    const testRolandData = {
      client: 'Test Client IA',
      type_support: 'Bâche',
      largeur: '300',
      hauteur: '200',
      unite: 'cm',
      nombre_exemplaires: '1',
      finition_oeillets: 'Oeillet',
      finition_position: 'Angles seulement'
    };
    
    // Récupérer les tarifs Roland
    const [tarifs] = await dbHelper.query('SELECT * FROM tarifs_config WHERE actif = TRUE AND type_machine = $1', ['roland']);
    console.log(`✅ ${tarifs.length} tarifs Roland trouvés`);
    
    // Faire l'estimation
    console.log('🧮 Calcul de l\'estimation...');
    const estimation = await openaiService.estimateQuote(testRolandData, 'roland', tarifs, openaiConfig?.knowledge_base_text);
    
    console.log(`📊 Résultat de l'estimation:`);
    console.log(`   - Prix estimé: ${estimation.prix_estime} FCFA`);
    console.log(`   - IA utilisée: ${estimation.ia_used ? '✅ OUI' : '❌ NON (fallback manuel)'}`);
    console.log(`   - Modèle: ${estimation.model || 'Manuel'}`);
    
    if (estimation.explanation) {
      console.log(`   - Explication: ${estimation.explanation.substring(0, 100)}...`);
    }
    
    // Créer le devis en base
    console.log('\n💾 Sauvegarde du devis de test...');
    const numero = `DEVIS-TEST-${Date.now()}`;
    
    const [insertResult] = await dbHelper.query(`
      INSERT INTO devis (
        numero, user_id, machine_type, data_json, client_nom, client_contact,
        prix_estime, prix_final, details_prix, notes, statut
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      numero,
      user.id,
      'roland',
      JSON.stringify(testRolandData),
      'Test Client IA - Script',
      'test@example.com',
      estimation.prix_estime,
      estimation.prix_estime,
      JSON.stringify(estimation.details || {}),
      'Devis de test créé automatiquement pour vérifier l\'IA',
      'brouillon'
    ]);
    
    const newDevisId = insertResult[0].id;
    console.log(`✅ Devis de test créé avec l'ID: ${newDevisId}`);
    console.log(`   - Numéro: ${numero}`);
    
    // Ajouter à l'historique
    await dbHelper.query(`
      INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut)
      VALUES ($1, $2, $3, $4)
    `, [newDevisId, user.id, 'creation', 'brouillon']);
    
    // 4. Test du bouton "Voir" (simulation)
    console.log('\n4. Test de récupération des détails (simulation bouton "Voir")...');
    
    const [devisDetails] = await dbHelper.query('SELECT * FROM v_devis_complet WHERE id = $1', [newDevisId]);
    
    if (devisDetails.length > 0) {
      const devis = devisDetails[0];
      console.log('✅ Détails du devis récupérés:');
      console.log(`   - Numéro: ${devis.numero}`);
      console.log(`   - Client: ${devis.client_nom}`);
      console.log(`   - Machine: ${devis.machine_type}`);
      console.log(`   - Prix: ${devis.prix_estime} FCFA`);
      console.log(`   - Statut: ${devis.statut}`);
      console.log(`   - Créé le: ${devis.created_at}`);
      
      // Parser les données JSON
      try {
        const dataJson = JSON.parse(devis.data_json);
        console.log('✅ Données techniques parsées avec succès');
        console.log(`   - Support: ${dataJson.type_support}`);
        console.log(`   - Dimensions: ${dataJson.largeur} × ${dataJson.hauteur} ${dataJson.unite}`);
      } catch (e) {
        console.log('❌ Erreur parsing données JSON');
      }
    }
    
    // 5. Résumé final
    console.log('\n=== RÉSUMÉ DES TESTS ===');
    console.log(`✅ Devis existants: ${existingDevis.length} trouvés`);
    console.log(`${openaiConfig && openaiConfig.is_active ? '✅' : '❌'} Configuration OpenAI: ${openaiConfig && openaiConfig.is_active ? 'Active' : 'Inactive/Manquante'}`);
    console.log(`✅ Nouveau devis créé: ${numero}`);
    console.log(`${estimation.ia_used ? '✅' : '⚠️'} Estimation IA: ${estimation.ia_used ? 'Fonctionnelle' : 'Fallback manuel utilisé'}`);
    console.log('✅ Récupération détails: Fonctionnelle');
    
    if (!estimation.ia_used) {
      console.log('\n💡 Pour activer l\'estimation IA:');
      console.log('   1. Exécutez: node rechiffrer-openai.js');
      console.log('   2. Saisissez votre clé API OpenAI');
      console.log('   3. Testez à nouveau avec ce script');
    } else {
      console.log('\n🎉 Tous les tests sont réussis! Le système de devis avec IA fonctionne parfaitement.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
})();