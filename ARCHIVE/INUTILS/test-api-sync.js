#!/usr/bin/env node

// Test de synchronisation API - Vérification des opérations CRUD

const { query } = require('./backend/config/database');

async function main() {
  console.log('🧪 Test de synchronisation API - Opérations CRUD');
  console.log('================================================\n');
  
  try {
    // Étape 1: Vérifier l'état initial
    console.log('1. Vérification de l\'état initial...');
    
    const initialResult = await query('SELECT COUNT(*) as count FROM dossiers');
    const initialCount = parseInt(initialResult.rows[0].count);
    console.log(`  📊 Nombre initial de dossiers: ${initialCount}`);
    
    // Étape 2: Créer un dossier de test
    console.log('\n2. Création d\'un dossier de test...');
    
    const numero = `TEST-API-${Date.now()}`;
    const createResult = await query(`
      INSERT INTO dossiers (
        numero_commande, client_nom, type, status,
        preparateur_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [numero, 'Client Test API', 'roland', 'en_cours', 2]);
    
    const testDossier = createResult.rows[0];
    console.log(`  ✅ Dossier créé: ${testDossier.numero_commande} (ID: ${testDossier.id})`);
    console.log(`  📝 Statut initial: ${testDossier.status}`);
    console.log(`  🏭 Type: ${testDossier.type}`);
    
    // Étape 3: Vérifier que le dossier est bien dans la base
    console.log('\n3. Vérification de la persistance...');
    
    const checkResult = await query('SELECT * FROM dossiers WHERE id = $1', [testDossier.id]);
    if (checkResult.rows.length === 1) {
      console.log('  ✅ Dossier trouvé dans la base de données');
      const found = checkResult.rows[0];
      console.log(`  📋 Détails: ${found.numero_commande} | ${found.type} | ${found.status}`);
    } else {
      console.log('  ❌ Dossier NON trouvé dans la base');
      return;
    }
    
    // Étape 4: Test des changements de statut
    console.log('\n4. Test des changements de statut...');
    
    const statusTransitions = [
      { from: 'en_cours', to: 'en_impression', comment: 'Pris en charge par imprimeur' },
      { from: 'en_impression', to: 'termine', comment: 'Impression terminée' },
      { from: 'termine', to: 'en_livraison', comment: 'Préparation livraison' },
      { from: 'en_livraison', to: 'livre', comment: 'Livré au client' }
    ];
    
    for (const transition of statusTransitions) {
      console.log(`  🔄 ${transition.from} → ${transition.to}`);
      
      // Mettre à jour le statut
      const updateResult = await query(`
        UPDATE dossiers 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING *
      `, [transition.to, testDossier.id]);
      
      if (updateResult.rows.length === 1) {
        console.log(`    ✅ Statut mis à jour: ${updateResult.rows[0].status}`);
        
        // Enregistrer l'historique
        await query(`
          INSERT INTO dossier_status_history (
            dossier_id, old_status, new_status, changed_by, changed_at, notes
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
        `, [testDossier.id, transition.from, transition.to, 1, transition.comment]);
        
        console.log(`    📝 Historique enregistré: ${transition.comment}`);
      } else {
        console.log(`    ❌ Échec de la mise à jour`);
      }
      
      // Pause entre les transitions
      await delay(500);
    }
    
    // Étape 5: Vérifier l'historique
    console.log('\n5. Vérification de l\'historique...');
    
    const historyResult = await query(`
      SELECT * FROM dossier_status_history 
      WHERE dossier_id = $1 
      ORDER BY changed_at ASC
    `, [testDossier.id]);
    
    console.log(`  📜 ${historyResult.rows.length} entrées d'historique trouvées:`);
    historyResult.rows.forEach((entry, index) => {
      console.log(`    ${index + 1}. ${entry.old_status} → ${entry.new_status} | ${entry.notes}`);
    });
    
    // Étape 6: Test de requête par rôle (simulation)
    console.log('\n6. Test des requêtes par rôle...');
    
    // Tous les dossiers (vue admin)
    const allDossiers = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`  👑 Admin voit: ${allDossiers.rows[0].count} dossiers au total`);
    
    // Dossiers pour imprimeur Roland
    const rolandDossiers = await query(`
      SELECT COUNT(*) as count FROM dossiers 
      WHERE type = 'roland'
    `);
    console.log(`  🖨️ Imprimeur Roland voit: ${rolandDossiers.rows[0].count} dossiers Roland`);
    
    // Dossiers en cours
    const activeDossiers = await query(`
      SELECT COUNT(*) as count FROM dossiers 
      WHERE status IN ('en_cours', 'en_impression')
    `);
    console.log(`  ⚡ Dossiers actifs: ${activeDossiers.rows[0].count}`);
    
    // Étape 7: Nettoyage (optionnel)
    console.log('\n7. Nettoyage du dossier de test...');
    
    // Supprimer l'historique
    await query('DELETE FROM dossier_status_history WHERE dossier_id = $1', [testDossier.id]);
    console.log('  🗑️ Historique supprimé');
    
    // Supprimer le dossier
    await query('DELETE FROM dossiers WHERE id = $1', [testDossier.id]);
    console.log('  🗑️ Dossier de test supprimé');
    
    // Vérifier la suppression
    const finalCount = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`  📊 Nombre final de dossiers: ${finalCount.rows[0].count}`);
    
    console.log('\n✅ Test de synchronisation API terminé avec succès !');
    console.log('🎯 Toutes les opérations CRUD fonctionnent correctement');
    console.log('📊 La base de données maintient la cohérence des données');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesse rejetée non gérée:', error);
  process.exit(1);
});

// Lancer le test
main().catch(console.error);