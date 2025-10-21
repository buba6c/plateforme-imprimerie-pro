#!/usr/bin/env node

// Comparaison des dossiers visibles par rôle - Préparateurs vs Admins

const { query } = require('./backend/config/database');

async function main() {
  console.log('🔍 Analyse de la visibilité des dossiers par rôle');
  console.log('================================================\n');
  
  try {
    // 1. Récupérer TOUS les dossiers (vue admin)
    console.log('📋 ADMIN - Vue complète de tous les dossiers:');
    console.log('=' .repeat(50));
    
    const adminResult = await query(`
      SELECT 
        d.id,
        d.numero_commande,
        d.client_nom,
        d.type,
        d.status,
        d.preparateur_id,
        u.nom as preparateur_nom,
        d.created_at,
        d.updated_at
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      ORDER BY d.created_at DESC
    `);
    
    console.log(`Total dossiers (ADMIN): ${adminResult.rows.length}\n`);
    
    adminResult.rows.forEach((dossier, index) => {
      console.log(`${index + 1}. 📄 ${dossier.numero_commande}`);
      console.log(`   👤 Client: ${dossier.client_nom || 'Non renseigné'}`);
      console.log(`   🏭 Type: ${dossier.type}`);
      console.log(`   📊 Status: ${dossier.status}`);
      console.log(`   👨‍🔧 Préparateur: ${dossier.preparateur_nom || `ID ${dossier.preparateur_id}` || 'Non assigné'}`);
      console.log(`   📅 Créé: ${dossier.created_at}`);
      console.log(`   🔄 MAJ: ${dossier.updated_at}`);
      console.log('   ' + '-'.repeat(40));
    });
    
    // 2. Vue par préparateur (ce qu'ils voient de leurs propres dossiers)
    console.log('\n📋 PRÉPARATEUR - Vue de leurs dossiers assignés:');
    console.log('=' .repeat(50));
    
    // Récupérer les préparateurs actifs
    const preparateursResult = await query(`
      SELECT DISTINCT u.id, u.nom, u.role
      FROM users u
      WHERE u.role = 'preparateur' 
      AND u.id IN (SELECT DISTINCT preparateur_id FROM dossiers WHERE preparateur_id IS NOT NULL)
    `);
    
    console.log(`Préparateurs actifs: ${preparateursResult.rows.length}\n`);
    
    for (const preparateur of preparateursResult.rows) {
      console.log(`👨‍🔧 PRÉPARATEUR: ${preparateur.nom} (ID: ${preparateur.id})`);
      console.log('-'.repeat(30));
      
      const prepDossiers = await query(`
        SELECT 
          d.id,
          d.numero_commande,
          d.client_nom,
          d.type,
          d.status,
          d.created_at
        FROM dossiers d
        WHERE d.preparateur_id = $1
        ORDER BY d.created_at DESC
      `, [preparateur.id]);
      
      console.log(`Ses dossiers: ${prepDossiers.rows.length}`);
      
      prepDossiers.rows.forEach((dossier, index) => {
        console.log(`  ${index + 1}. ${dossier.numero_commande} | ${dossier.type} | ${dossier.status}`);
      });
      console.log('');
    }
    
    // 3. Vue par type d'imprimeur (ce qu'ils voient selon leur spécialité)
    console.log('\n📋 IMPRIMEUR - Vue par spécialité:');
    console.log('=' .repeat(50));
    
    const types = ['roland', 'kba', 'numerique'];
    
    for (const type of types) {
      console.log(`🖨️ IMPRIMEUR ${type.toUpperCase()}:`);
      console.log('-'.repeat(25));
      
      const typeDossiers = await query(`
        SELECT 
          d.id,
          d.numero_commande,
          d.client_nom,
          d.status,
          u.nom as preparateur_nom,
          d.created_at
        FROM dossiers d
        LEFT JOIN users u ON d.preparateur_id = u.id
        WHERE d.type = $1
        ORDER BY d.created_at DESC
      `, [type]);
      
      console.log(`Dossiers ${type}: ${typeDossiers.rows.length}`);
      
      typeDossiers.rows.forEach((dossier, index) => {
        console.log(`  ${index + 1}. ${dossier.numero_commande} | ${dossier.status} | par ${dossier.preparateur_nom || 'Non assigné'}`);
      });
      console.log('');
    }
    
    // 4. Analyse des discrepances potentielles
    console.log('\n🔍 ANALYSE DES DISCREPANCES:');
    console.log('=' .repeat(50));
    
    // Vérifier les dossiers orphelins (sans préparateur)
    const orphanResult = await query(`
      SELECT COUNT(*) as count FROM dossiers WHERE preparateur_id IS NULL
    `);
    
    // Vérifier les dossiers avec préparateur inexistant  
    const invalidPrepResult = await query(`
      SELECT COUNT(*) as count FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      WHERE d.preparateur_id IS NOT NULL AND u.id IS NULL
    `);
    
    // Statistiques par statut
    const statusStats = await query(`
      SELECT status, COUNT(*) as count
      FROM dossiers
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log(`📊 Dossiers orphelins (sans préparateur): ${orphanResult.rows[0].count}`);
    console.log(`❌ Dossiers avec préparateur invalide: ${invalidPrepResult.rows[0].count}`);
    console.log('\n📈 Répartition par statut:');
    statusStats.rows.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count} dossier(s)`);
    });
    
    // 5. Résumé des problèmes potentiels
    console.log('\n🚨 PROBLÈMES POTENTIELS DÉTECTÉS:');
    console.log('=' .repeat(50));
    
    let problemsFound = 0;
    
    if (parseInt(orphanResult.rows[0].count) > 0) {
      console.log(`❌ ${orphanResult.rows[0].count} dossier(s) sans préparateur assigné`);
      problemsFound++;
    }
    
    if (parseInt(invalidPrepResult.rows[0].count) > 0) {
      console.log(`❌ ${invalidPrepResult.rows[0].count} dossier(s) avec préparateur inexistant`);
      problemsFound++;
    }
    
    // Vérifier la cohérence des dates
    const dateIssues = await query(`
      SELECT COUNT(*) as count FROM dossiers 
      WHERE updated_at < created_at
    `);
    
    if (parseInt(dateIssues.rows[0].count) > 0) {
      console.log(`❌ ${dateIssues.rows[0].count} dossier(s) avec dates incohérentes`);
      problemsFound++;
    }
    
    if (problemsFound === 0) {
      console.log('✅ Aucun problème de cohérence détecté !');
      console.log('🎯 La synchronisation des données semble fonctionnelle');
    } else {
      console.log(`\n⚠️ ${problemsFound} problème(s) de cohérence détecté(s)`);
      console.log('🔧 Ces problèmes peuvent affecter la synchronisation');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:', error.message);
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

// Lancer l'analyse
main().catch(console.error);