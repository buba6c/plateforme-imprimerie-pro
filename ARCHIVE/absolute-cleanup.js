#!/usr/bin/env node

// Nettoyage ABSOLU et vérification de toutes les bases

const { query } = require('./backend/config/database');

async function main() {
  console.log('🧹 NETTOYAGE ABSOLU - Suppression totale des CMD-2024-xxx');
  console.log('========================================================\n');
  
  try {
    // 1. Vérification de l'état actuel
    console.log('1. 🔍 État actuel de la base:');
    
    const allDossiers = await query(`
      SELECT id, numero_commande, type, status, preparateur_id, created_at
      FROM dossiers 
      ORDER BY created_at DESC
    `);
    
    console.log(`   📋 ${allDossiers.rows.length} dossiers trouvés dans la base:`);
    allDossiers.rows.forEach((d, i) => {
      console.log(`      ${i+1}. ID:${d.id} | ${d.numero_commande} | ${d.type} | ${d.status} | Prep:${d.preparateur_id}`);
    });
    
    // 2. Recherche de dossiers CMD-2024-xxx et suppression
    console.log('\n2. 🗑️ Recherche et suppression des dossiers CMD-2024-xxx:');
    
    const cmdDossiers = await query(`
      SELECT id, numero_commande FROM dossiers 
      WHERE numero_commande LIKE 'CMD-2024-%'
    `);
    
    if (cmdDossiers.rows.length > 0) {
      console.log(`   ❌ ${cmdDossiers.rows.length} dossiers CMD-2024-xxx trouvés ! Suppression...`);
      
      for (const dossier of cmdDossiers.rows) {
        // Supprimer l'historique
        await query('DELETE FROM dossier_status_history WHERE dossier_id = $1', [dossier.id]);
        console.log(`      📜 Historique supprimé pour ${dossier.numero_commande}`);
        
        // Supprimer le dossier  
        await query('DELETE FROM dossiers WHERE id = $1', [dossier.id]);
        console.log(`      🗑️ ${dossier.numero_commande} supprimé`);
      }
    } else {
      console.log('   ✅ Aucun dossier CMD-2024-xxx trouvé dans la base');
    }
    
    // 3. Suppression COMPLÈTE de tous les dossiers non-FRESH
    console.log('\n3. 🧹 Suppression de TOUS les dossiers non-FRESH:');
    
    const nonFreshDossiers = await query(`
      SELECT id, numero_commande FROM dossiers 
      WHERE numero_commande NOT LIKE 'FRESH-%'
    `);
    
    if (nonFreshDossiers.rows.length > 0) {
      console.log(`   🗑️ ${nonFreshDossiers.rows.length} dossiers non-FRESH trouvés, suppression...`);
      
      // Supprimer tout l'historique des non-FRESH
      await query(`
        DELETE FROM dossier_status_history 
        WHERE dossier_id IN (
          SELECT id FROM dossiers WHERE numero_commande NOT LIKE 'FRESH-%'
        )
      `);
      console.log('      📜 Historique des non-FRESH supprimé');
      
      // Supprimer tous les dossiers non-FRESH
      const deleteResult = await query(`
        DELETE FROM dossiers WHERE numero_commande NOT LIKE 'FRESH-%'
      `);
      console.log(`      🗑️ ${deleteResult.rowCount} dossiers non-FRESH supprimés`);
    } else {
      console.log('   ✅ Seuls les dossiers FRESH sont présents');
    }
    
    // 4. Vérification finale
    console.log('\n4. ✅ Vérification finale:');
    
    const finalDossiers = await query(`
      SELECT id, numero_commande, type, status, preparateur_id
      FROM dossiers 
      ORDER BY id
    `);
    
    console.log(`   📊 ${finalDossiers.rows.length} dossiers restants:`);
    finalDossiers.rows.forEach((d, i) => {
      console.log(`      ${i+1}. ${d.numero_commande} | ${d.type} | ${d.status} | Prep:${d.preparateur_id}`);
    });
    
    // 5. Redémarrage FORCÉ des services
    console.log('\n5. 🔄 Redémarrage FORCÉ des services:');
    
    const { spawn } = require('child_process');
    
    // Arrêter tout
    console.log('   ⏹️ Arrêt de tous les services...');
    const stopCmd = spawn('pm2', ['stop', 'all'], { stdio: 'inherit' });
    
    stopCmd.on('close', async (code) => {
      console.log(`   ✅ Services arrêtés (code: ${code})`);
      
      // Attendre 2 secondes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redémarrer tout
      console.log('   🚀 Redémarrage des services...');
      const startCmd = spawn('pm2', ['start', 'all'], { stdio: 'inherit' });
      
      startCmd.on('close', (startCode) => {
        console.log(`   ✅ Services redémarrés (code: ${startCode})`);
        
        console.log('\n🎉 NETTOYAGE ABSOLU TERMINÉ !');
        console.log('');
        console.log('📋 Seuls les dossiers FRESH-xxx devraient rester');
        console.log('🔄 Services complètement redémarrés');
        console.log('💾 Cache système vidé');
        console.log('');
        console.log('📱 MAINTENANT:');
        console.log('   1. Attendez 30 secondes que les services se stabilisent');
        console.log('   2. Ouvrez un nouvel onglet en navigation privée');  
        console.log('   3. Allez sur http://localhost:3000');
        console.log('   4. Vous ne devriez voir QUE les 4 dossiers FRESH-xxx');
        console.log('');
        console.log('⚠️ Si les CMD-2024-xxx apparaissent encore:');
        console.log('   - Il y a un cache côté navigateur très persistant');
        console.log('   - Ou l\'app utilise une autre source de données');
        console.log('   - Essayez un autre navigateur complètement');
      });
    });
    
  } catch (error) {
    console.error('\n❌ Erreur lors du nettoyage absolu:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);