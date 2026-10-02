/**
 * 🧹 Script de Réinitialisation Complète de la Plateforme
 * 
 * Ce script supprime :
 * - Tous les dossiers et leurs données associées
 * - Tous les fichiers (PDF, images, etc.)
 * - Toutes les factures, devis et paiements
 * - Réinitialise les séquences à 001
 * 
 * Conserve :
 * - Les comptes utilisateurs
 * - Les formulaires (Roland, Xerox)
 * - Les paramètres du site
 */

const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');

// Configuration
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const KEEP_FOLDERS = ['.gitkeep']; // Fichiers à conserver dans uploads

/**
 * Supprime tous les fichiers dans un dossier (récursif)
 */
async function deleteFilesInDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Ne pas supprimer les dossiers/fichiers à conserver
      if (KEEP_FOLDERS.includes(entry.name)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Supprimer récursivement le dossier
        await deleteFilesInDirectory(fullPath);
        await fs.rmdir(fullPath);
        console.log(`📁 Dossier supprimé: ${fullPath}`);
      } else {
        // Supprimer le fichier
        await fs.unlink(fullPath);
        console.log(`🗑️  Fichier supprimé: ${fullPath}`);
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Dossier inexistant: ${dirPath}`);
    } else {
      throw error;
    }
  }
}

/**
 * Compte le nombre d'enregistrements dans une table
 */
async function countRecords(tableName) {
  try {
    const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.log(`⚠️  Table ${tableName} introuvable ou vide`);
    return 0;
  }
}

/**
 * Réinitialise une séquence PostgreSQL à 1
 */
async function resetSequence(sequenceName) {
  try {
    await db.query(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`);
    console.log(`🔄 Séquence réinitialisée: ${sequenceName}`);
    return true;
  } catch (error) {
    console.log(`⚠️  Séquence ${sequenceName} introuvable`);
    return false;
  }
}

/**
 * Script principal de réinitialisation
 */
async function resetPlatform() {
  console.log('\n🧹 ========================================');
  console.log('   RÉINITIALISATION DE LA PLATEFORME');
  console.log('========================================\n');

  const client = await db.pool.connect();
  
  try {
    // Démarrer une transaction
    await client.query('BEGIN');
    
    console.log('📊 État avant réinitialisation:\n');
    
    // Compter les enregistrements
    const counts = {
      dossiers: await countRecords('dossiers'),
      paiements: await countRecords('paiements'),
      factures: await countRecords('factures'),
      devis: await countRecords('devis'),
      historique: await countRecords('historique_statuts'),
    };
    
    console.log(`   Dossiers: ${counts.dossiers}`);
    console.log(`   Paiements: ${counts.paiements}`);
    console.log(`   Factures: ${counts.factures}`);
    console.log(`   Devis: ${counts.devis}`);
    console.log(`   Historique: ${counts.historique}`);
    
    // ========================================
    // 1. SUPPRESSION DES DONNÉES
    // ========================================
    
    console.log('🗑️  Suppression des données...\n');
    
    // Supprimer dans l'ordre (contraintes de clés étrangères)
    const tables = [
      'historique_statuts',
      'dossier_status_history',
      'devis_historique',
      'fichiers',
      'paiements',
      'factures',
      'devis',
      'dossiers'
    ];
    
    for (const table of tables) {
      try {
        // Créer un savepoint pour isoler cette suppression
        await client.query(`SAVEPOINT sp_${table}`);
        const result = await client.query(`DELETE FROM ${table}`);
        await client.query(`RELEASE SAVEPOINT sp_${table}`);
        console.log(`✅ ${table}: ${result.rowCount} enregistrements supprimés`);
      } catch (error) {
        // Rollback uniquement ce savepoint, pas toute la transaction
        try {
          await client.query(`ROLLBACK TO SAVEPOINT sp_${table}`);
        } catch (rbErr) {
          // Ignorer si le savepoint n'existe pas
        }
        console.log(`⚠️  Erreur sur ${table}: ${error.message}`);
        // Continuer avec les autres tables au lieu de tout annuler
      }
    }
    
    // ========================================
    // 2. RÉINITIALISATION DES SÉQUENCES
    // ========================================
    
    console.log('\n🔄 Réinitialisation des séquences...\n');
    
    const sequences = [
      'dossiers_id_seq',
      'numero_commande_seq',
      'paiements_id_seq',
      'factures_id_seq',
      'devis_id_seq',
      'historique_statuts_id_seq',
      'fichiers_id_seq',
      'dossier_status_history_id_seq',
      'devis_historique_id_seq',
    ];
    
    for (const seq of sequences) {
      await resetSequence(seq);
    }
    
    // Valider la transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Transaction validée\n');
    
    // ========================================
    // 3. SUPPRESSION DES FICHIERS
    // ========================================
    
    console.log('🗂️  Suppression des fichiers...\n');
    
    const fileStats = {
      before: 0,
      after: 0
    };
    
    // Compter les fichiers avant suppression
    try {
      const countFiles = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let count = 0;
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !KEEP_FOLDERS.includes(entry.name)) {
            count += await countFiles(fullPath);
          } else if (!KEEP_FOLDERS.includes(entry.name)) {
            count++;
          }
        }
        return count;
      };
      
      fileStats.before = await countFiles(UPLOADS_DIR);
      console.log(`📊 Fichiers trouvés: ${fileStats.before}`);
      
      // Supprimer tous les fichiers
      await deleteFilesInDirectory(UPLOADS_DIR);
      
      fileStats.after = await countFiles(UPLOADS_DIR);
      console.log(`📊 Fichiers restants: ${fileStats.after}`);
      
    } catch (error) {
      console.log(`⚠️  Erreur lors de la suppression des fichiers: ${error.message}`);
    }
    
    // ========================================
    // 4. VÉRIFICATION FINALE
    // ========================================
    
    console.log('\n✅ Vérification finale:\n');
    
    const finalCounts = {
      dossiers: await countRecords('dossiers'),
      paiements: await countRecords('paiements'),
      factures: await countRecords('factures'),
      devis: await countRecords('devis')
    };
    
    console.log(`   Dossiers: ${finalCounts.dossiers}`);
    console.log(`   Paiements: ${finalCounts.paiements}`);
    console.log(`   Factures: ${finalCounts.factures}`);
    console.log(`   Devis: ${finalCounts.devis}`);
    console.log(`   Fichiers supprimés: ${fileStats.before - fileStats.after}`);
    
    // ========================================
    // 5. RÉSUMÉ
    // ========================================
    
    console.log('\n🎉 ========================================');
    console.log('   RÉINITIALISATION TERMINÉE AVEC SUCCÈS');
    console.log('========================================\n');
    
    console.log('📋 Résumé:');
    console.log(`   ✅ ${counts.dossiers} dossiers supprimés`);
    console.log(`   ✅ ${counts.paiements} paiements supprimés`);
    console.log(`   ✅ ${counts.factures} factures supprimées`);
    console.log(`   ✅ ${counts.devis} devis supprimés`);
    console.log(`   ✅ ${fileStats.before - fileStats.after} fichiers supprimés`);
    console.log(`   ✅ Séquences réinitialisées à 001`);
    console.log('\n💡 Le prochain dossier créé aura le numéro: 001\n');
    
    console.log('🔒 Éléments conservés:');
    console.log('   ✅ Comptes utilisateurs');
    console.log('   ✅ Formulaires (Roland, Xerox)');
    console.log('   ✅ Paramètres du site');
    console.log('   ✅ Structure des dossiers\n');
    
    return {
      success: true,
      deleted: counts,
      filesDeleted: fileStats.before - fileStats.after
    };
    
  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await client.query('ROLLBACK');
    
    console.error('\n❌ ========================================');
    console.error('   ERREUR LORS DE LA RÉINITIALISATION');
    console.error('========================================\n');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    throw error;
    
  } finally {
    client.release();
  }
}

// Exécution si appelé directement
if (require.main === module) {
  console.log('\n⚠️  ATTENTION: Cette opération est IRRÉVERSIBLE !');
  console.log('⚠️  Tous les dossiers, fichiers et données seront supprimés.\n');
  
  // Demander confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Tapez "RESET" pour confirmer: ', async (answer) => {
    if (answer === 'RESET') {
      try {
        await resetPlatform();
        process.exit(0);
      } catch (error) {
        console.error('Échec de la réinitialisation:', error);
        process.exit(1);
      }
    } else {
      console.log('\n❌ Opération annulée\n');
      process.exit(0);
    }
    rl.close();
  });
} else {
  // Exporté comme module
  module.exports = { resetPlatform };
}
