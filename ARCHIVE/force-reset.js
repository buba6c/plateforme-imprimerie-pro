#!/usr/bin/env node

// Force une vraie suppression et recréation des dossiers

const { query } = require('./backend/config/database');

async function main() {
  console.log('🔧 Force Reset - Suppression et recréation complète');
  console.log('=================================================\n');
  
  try {
    // 1. État actuel
    console.log('1. 📊 État actuel:');
    const currentResult = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`   Dossiers actuels: ${currentResult.rows[0].count}`);
    
    // 2. VRAIE suppression complète
    console.log('\n2. 🗑️ Suppression FORCÉE:');
    
    // Désactiver temporairement les contraintes
    await query('SET session_replication_role = replica;');
    
    // Supprimer TOUT l'historique
    const historyDelete = await query('TRUNCATE TABLE dossier_status_history CASCADE');
    console.log('   📜 Historique des statuts vidé');
    
    // Supprimer TOUS les dossiers 
    const dossiersDelete = await query('TRUNCATE TABLE dossiers RESTART IDENTITY CASCADE');
    console.log('   📋 Table dossiers vidée et compteur remis à zéro');
    
    // Réactiver les contraintes
    await query('SET session_replication_role = DEFAULT;');
    
    // 3. Vérification que c'est vraiment vide
    const emptyCheck = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`   ✅ Vérification: ${emptyCheck.rows[0].count} dossiers (doit être 0)`);
    
    if (parseInt(emptyCheck.rows[0].count) > 0) {
      throw new Error('La suppression a échoué !');
    }
    
    // 4. Recréation avec nouveaux IDs
    console.log('\n3. 📄 Recréation des dossiers:');
    
    // Vérifier le préparateur
    const prepCheck = await query("SELECT id, nom FROM users WHERE role = 'preparateur' LIMIT 1");
    const prepId = prepCheck.rows[0]?.id;
    
    if (!prepId) {
      throw new Error('Aucun préparateur trouvé !');
    }
    
    console.log(`   👨‍🔧 Préparateur: ${prepCheck.rows[0].nom} (ID: ${prepId})`);
    
    const nouveauxDossiers = [
      { numero: 'NOUVEAU-001', client: 'Client Fresh 1', type: 'roland', status: 'en_cours' },
      { numero: 'NOUVEAU-002', client: 'Client Fresh 2', type: 'roland', status: 'en_impression' },
      { numero: 'NOUVEAU-003', client: 'Client Fresh 3', type: 'xerox', status: 'en_cours' },
      { numero: 'NOUVEAU-004', client: 'Client Fresh 4', type: 'xerox', status: 'a_revoir' },
      { numero: 'NOUVEAU-005', client: 'Client Fresh 5', type: 'roland', status: 'termine' }
    ];
    
    for (const dossier of nouveauxDossiers) {
      const result = await query(`
        INSERT INTO dossiers (numero_commande, client_nom, type, status, preparateur_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, numero_commande
      `, [dossier.numero, dossier.client, dossier.type, dossier.status, prepId]);
      
      console.log(`   ✅ ${result.rows[0].numero_commande} créé (ID: ${result.rows[0].id})`);
      
      // Ajouter historique initial
      await query(`
        INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, notes)
        VALUES ($1, NULL, $2, $3, CURRENT_TIMESTAMP, 'Création initiale')
      `, [result.rows[0].id, dossier.status, prepId]);
    }
    
    // 5. Vérification finale
    console.log('\n4. ✅ Vérification finale:');
    const finalCount = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`   📊 Nouveaux dossiers créés: ${finalCount.rows[0].count}`);
    
    const detailResult = await query(`
      SELECT numero_commande, type, status FROM dossiers ORDER BY id
    `);
    
    console.log('   📋 Détail:');
    detailResult.rows.forEach((d, i) => {
      console.log(`      ${i+1}. ${d.numero_commande} | ${d.type} | ${d.status}`);
    });
    
    // 6. Test API direct
    console.log('\n5. 🧪 Test API Backend:');
    
    // Simuler une requête API
    const apiTest = await query(`
      SELECT 
        id, numero_commande, client_nom, type, status, preparateur_id, created_at
      FROM dossiers 
      ORDER BY created_at DESC
    `);
    
    console.log(`   📡 API retournerait: ${apiTest.rows.length} dossiers`);
    apiTest.rows.forEach((d, i) => {
      console.log(`      ${i+1}. ${d.numero_commande} (${d.type}, ${d.status})`);
    });
    
    console.log('\n🎉 RESET COMPLET TERMINÉ !');
    console.log('📱 Maintenant allez sur http://localhost:3000 et faites F5 (refresh)');
    console.log('🔄 Les nouveaux dossiers devraient apparaître');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du reset:', error.message);
    console.error(error.stack);
  }
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

// Lancer le reset
main().catch(console.error);