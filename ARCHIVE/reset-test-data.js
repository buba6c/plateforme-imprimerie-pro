#!/usr/bin/env node

// Script de nettoyage et création de dossiers de test

const { query } = require('./backend/config/database');

async function main() {
  console.log('🧹 Nettoyage et création de dossiers de test');
  console.log('============================================\n');
  
  try {
    // 1. Supprimer tous les dossiers existants
    console.log('1. 🗑️ Suppression des dossiers existants...');
    
    // D'abord supprimer l'historique pour éviter les contraintes de clé étrangère
    const historyDeleteResult = await query('DELETE FROM dossier_status_history');
    console.log(`   📜 ${historyDeleteResult.rowCount || 0} entrées d'historique supprimées`);
    
    // Ensuite supprimer les dossiers
    const dossiersDeleteResult = await query('DELETE FROM dossiers');
    console.log(`   📋 ${dossiersDeleteResult.rowCount || 0} dossiers supprimés`);
    
    // 2. Vérifier que Jean Préparateur existe
    console.log('\n2. 👨‍🔧 Vérification du préparateur...');
    
    const preparateurCheck = await query(`
      SELECT id, nom, role FROM users 
      WHERE role = 'preparateur' 
      ORDER BY id 
      LIMIT 1
    `);
    
    let preparateurId;
    if (preparateurCheck.rows.length > 0) {
      const prep = preparateurCheck.rows[0];
      preparateurId = prep.id;
      console.log(`   ✅ Préparateur trouvé: ${prep.nom} (ID: ${prep.id})`);
    } else {
      console.log('   ❌ Aucun préparateur trouvé, création d\'un préparateur de test...');
      
      const newPrepResult = await query(`
        INSERT INTO users (nom, email, password_hash, role, created_at, updated_at)
        VALUES ('Jean Préparateur', 'jean.preparateur@evocomprint.com', 'hash123', 'preparateur', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, nom
      `);
      
      preparateurId = newPrepResult.rows[0].id;
      console.log(`   ✅ Préparateur créé: ${newPrepResult.rows[0].nom} (ID: ${preparateurId})`);
    }
    
    // 3. Créer 5 nouveaux dossiers de test
    console.log('\n3. 📄 Création de 5 dossiers de test...');
    
    const testDossiers = [
      {
        numero: 'TEST-001',
        client: 'Client Roland Test 1',
        type: 'roland',
        status: 'en_cours'
      },
      {
        numero: 'TEST-002', 
        client: 'Client Roland Test 2',
        type: 'roland',
        status: 'en_impression'
      },
      {
        numero: 'TEST-003',
        client: 'Client Xerox Test 1', 
        type: 'xerox',
        status: 'en_cours'
      },
      {
        numero: 'TEST-004',
        client: 'Client Roland Test 3',
        type: 'roland', 
        status: 'termine'
      },
      {
        numero: 'TEST-005',
        client: 'Client Xerox Test 2',
        type: 'xerox',
        status: 'a_revoir'
      }
    ];
    
    const createdDossiers = [];
    
    for (let i = 0; i < testDossiers.length; i++) {
      const dossier = testDossiers[i];
      
      const result = await query(`
        INSERT INTO dossiers (
          numero_commande, 
          client_nom, 
          type, 
          status,
          preparateur_id,
          created_at, 
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [dossier.numero, dossier.client, dossier.type, dossier.status, preparateurId]);
      
      const created = result.rows[0];
      createdDossiers.push(created);
      
      console.log(`   ✅ ${created.numero_commande} | ${created.type} | ${created.status} | ID: ${created.id}`);
      
      // Ajouter une entrée d'historique initial
      await query(`
        INSERT INTO dossier_status_history (
          dossier_id, old_status, new_status, changed_by, changed_at, notes
        ) VALUES ($1, NULL, $2, $3, CURRENT_TIMESTAMP, 'Création du dossier')
      `, [created.id, created.status, preparateurId]);
    }
    
    // 4. Vérifier la création
    console.log('\n4. 🔍 Vérification des données créées...');
    
    const countResult = await query('SELECT COUNT(*) as count FROM dossiers');
    const totalCreated = parseInt(countResult.rows[0].count);
    
    console.log(`   📊 Total dossiers créés: ${totalCreated}`);
    
    // Répartition par type
    const typeStats = await query(`
      SELECT type, COUNT(*) as count 
      FROM dossiers 
      GROUP BY type 
      ORDER BY type
    `);
    
    console.log('   📈 Répartition par type:');
    typeStats.rows.forEach(stat => {
      console.log(`      ${stat.type}: ${stat.count} dossier(s)`);
    });
    
    // Répartition par statut  
    const statusStats = await query(`
      SELECT status, COUNT(*) as count 
      FROM dossiers 
      GROUP BY status 
      ORDER BY status
    `);
    
    console.log('   📈 Répartition par statut:');
    statusStats.rows.forEach(stat => {
      console.log(`      ${stat.status}: ${stat.count} dossier(s)`);
    });
    
    // 5. Test de visibilité par rôle
    console.log('\n5. 👀 Test de visibilité par rôle...');
    
    // ADMIN - Tous les dossiers
    const adminView = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`   👑 ADMIN voit: ${adminView.rows[0].count}/${totalCreated} dossiers`);
    
    // PRÉPARATEUR - Tous les dossiers (après correction)
    const prepView = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`   👨‍🔧 PRÉPARATEUR voit: ${prepView.rows[0].count}/${totalCreated} dossiers`);
    
    // IMPRIMEUR ROLAND - Type roland seulement
    const rolandView = await query(`SELECT COUNT(*) as count FROM dossiers WHERE type = 'roland'`);
    console.log(`   🖨️ IMPRIMEUR ROLAND voit: ${rolandView.rows[0].count} dossiers Roland`);
    
    // IMPRIMEUR XEROX - Type xerox seulement  
    const xeroxView = await query(`SELECT COUNT(*) as count FROM dossiers WHERE type = 'xerox'`);
    console.log(`   🖨️ IMPRIMEUR XEROX voit: ${xeroxView.rows[0].count} dossiers Xerox`);
    
    // 6. Résumé final
    console.log('\n6. 🎯 Résumé des données de test:');
    console.log('=' .repeat(40));
    
    createdDossiers.forEach((dossier, index) => {
      console.log(`${index + 1}. 📄 ${dossier.numero_commande}`);
      console.log(`   👤 Client: ${dossier.client_nom}`);
      console.log(`   🏭 Type: ${dossier.type}`);
      console.log(`   📊 Status: ${dossier.status}`);
      console.log(`   👨‍🔧 Préparateur ID: ${dossier.preparateur_id}`);
      console.log(`   📅 Créé: ${dossier.created_at}`);
      console.log('');
    });
    
    console.log('✅ Base de données nettoyée et données de test créées !');
    console.log('🧪 Prêt pour tester la synchronisation');
    console.log('🔄 Tous les dossiers sont maintenant assignés au même préparateur');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du nettoyage/création:', error.message);
    console.error('Stack trace:', error.stack);
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

// Lancer le script
main().catch(console.error);