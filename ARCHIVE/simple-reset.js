#!/usr/bin/env node

// Reset simple et efficace

const { query } = require('./backend/config/database');

async function main() {
  console.log('🧹 Reset Simple - Nettoyage et recréation');
  console.log('=========================================\n');
  
  try {
    // 1. Suppression classique
    console.log('1. 🗑️ Suppression des données existantes:');
    
    const historyDelete = await query('DELETE FROM dossier_status_history');
    console.log(`   📜 ${historyDelete.rowCount || 0} entrées d'historique supprimées`);
    
    const dossiersDelete = await query('DELETE FROM dossiers');
    console.log(`   📋 ${dossiersDelete.rowCount || 0} dossiers supprimés`);
    
    // 2. Vérification que c'est vide
    const emptyCheck = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`   ✅ Vérification: ${emptyCheck.rows[0].count} dossiers restants`);
    
    // 3. Recréation immédiate
    console.log('\n2. 📄 Création des nouveaux dossiers:');
    
    const prepCheck = await query("SELECT id, nom FROM users WHERE role = 'preparateur' LIMIT 1");
    const prepId = prepCheck.rows[0]?.id;
    console.log(`   👨‍🔧 Préparateur: ${prepCheck.rows[0].nom} (ID: ${prepId})`);
    
    const dossiers = [
      { numero: 'FRESH-001', client: 'Client Alpha', type: 'roland', status: 'en_cours' },
      { numero: 'FRESH-002', client: 'Client Beta', type: 'roland', status: 'en_impression' },
      { numero: 'FRESH-003', client: 'Client Gamma', type: 'xerox', status: 'en_cours' },
      { numero: 'FRESH-004', client: 'Client Delta', type: 'xerox', status: 'a_revoir' }
    ];
    
    const createdIds = [];
    
    for (const d of dossiers) {
      const result = await query(`
        INSERT INTO dossiers (numero_commande, client_nom, type, status, preparateur_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, numero_commande
      `, [d.numero, d.client, d.type, d.status, prepId]);
      
      const newId = result.rows[0].id;
      createdIds.push(newId);
      
      console.log(`   ✅ ${result.rows[0].numero_commande} créé (ID: ${newId})`);
      
      // Historique initial
      await query(`
        INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, notes)
        VALUES ($1, NULL, $2, $3, NOW(), 'Création du dossier')
      `, [newId, d.status, prepId]);
    }
    
    // 4. Vérification finale avec détails
    console.log('\n3. 📊 Vérification finale:');
    
    const finalResult = await query(`
      SELECT 
        d.id, d.numero_commande, d.client_nom, d.type, d.status,
        u.nom as preparateur_nom, d.created_at
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      ORDER BY d.id
    `);
    
    console.log(`   📋 Total: ${finalResult.rows.length} dossiers créés`);
    finalResult.rows.forEach((row) => {
      console.log(`      ID ${row.id}: ${row.numero_commande} | ${row.type} | ${row.status} | ${row.preparateur_nom}`);
    });
    
    // 5. Redémarrer les services pour forcer le refresh
    console.log('\n4. 🔄 Redémarrage des services...');
    
    const { spawn } = require('child_process');
    
    // Redémarrer le backend
    const restartCmd = spawn('pm2', ['restart', 'imprimerie-backend-dev'], { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    restartCmd.on('close', (code) => {
      console.log(`   ✅ Backend redémarré (code: ${code})`);
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🎉 RESET TERMINÉ !');
    console.log('');
    console.log('📱 Instructions pour voir les changements:');
    console.log('   1. Allez sur http://localhost:3000');
    console.log('   2. Appuyez sur CTRL+F5 (ou CMD+SHIFT+R sur Mac) pour vider le cache');
    console.log('   3. Connectez-vous avec un compte préparateur');
    console.log('   4. Vous devriez voir les 4 nouveaux dossiers FRESH-xxx');
    console.log('');
    console.log('🔍 Si ça ne fonctionne toujours pas:');
    console.log('   - Ouvrez les outils développeur (F12)');
    console.log('   - Onglet Network > Cochez "Disable cache"');
    console.log('   - Rechargez la page');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);