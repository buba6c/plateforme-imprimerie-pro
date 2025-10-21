#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configuration de la base de données
const pool = new Pool({
  user: 'imprimerie_user',
  password: 'imprimerie_password_2024',
  host: 'localhost',
  port: 5432,
  database: 'imprimerie_db',
});

async function cleanupOrphanedFiles() {
  console.log('🧹 NETTOYAGE DES FICHIERS ORPHELINS');
  console.log('=' .repeat(50));
  
  try {
    // 1. Récupérer tous les fichiers de la base de données
    console.log('\n📋 1. Récupération des fichiers en base...');
    const filesResult = await pool.query(`
      SELECT id, nom, chemin, type, dossier_id, uploaded_at 
      FROM fichiers 
      ORDER BY uploaded_at DESC
    `);
    
    const dbFiles = filesResult.rows;
    console.log(`   Trouvés: ${dbFiles.length} fichiers en base`);
    
    // 2. Vérifier l'existence physique
    console.log('\n🔍 2. Vérification des fichiers physiques...');
    
    const orphanedFiles = [];
    const validFiles = [];
    
    for (const file of dbFiles) {
      let physicalPath = file.chemin;
      
      // Essayer plusieurs chemins possibles
      const possiblePaths = [
        physicalPath,
        path.join(process.cwd(), physicalPath),
        path.join(process.cwd(), 'uploads', path.basename(physicalPath)),
        path.join(process.cwd(), '../uploads', path.basename(physicalPath))
      ];
      
      let exists = false;
      for (const testPath of possiblePaths) {
        try {
          if (testPath) {
            await fs.access(testPath);
            exists = true;
            break;
          }
        } catch {
          // Continue testing
        }
      }
      
      if (exists) {
        validFiles.push(file);
      } else {
        orphanedFiles.push(file);
        console.log(`   ❌ Manquant: ${file.nom} (ID: ${file.id})`);
      }
    }
    
    console.log(`   ✅ Fichiers valides: ${validFiles.length}`);
    console.log(`   ❌ Fichiers orphelins: ${orphanedFiles.length}`);
    
    // 3. Demander confirmation pour supprimer les orphelins
    if (orphanedFiles.length > 0) {
      console.log('\n🗑️ 3. Suppression des entrées orphelines...');
      
      // Supprimer les fichiers orphelins de la base
      const orphanIds = orphanedFiles.map(f => f.id);
      
      const deleteResult = await pool.query(`
        DELETE FROM fichiers 
        WHERE id = ANY($1::uuid[])
        RETURNING id, nom
      `, [orphanIds]);
      
      console.log(`   ✅ Supprimés: ${deleteResult.rows.length} entrées orphelines`);
      
      deleteResult.rows.forEach(deleted => {
        console.log(`      - ${deleted.nom} (${deleted.id})`);
      });
      
    } else {
      console.log('\n✅ Aucun fichier orphelin trouvé !');
    }
    
    // 4. Vérifier la cohérence des données
    console.log('\n🔄 4. Vérification post-nettoyage...');
    
    const remainingResult = await pool.query(`
      SELECT COUNT(*) as remaining_files FROM fichiers
    `);
    
    console.log(`   ✅ Fichiers restants en base: ${remainingResult.rows[0].remaining_files}`);
    
    // 5. Résumé
    console.log('\n📊 RÉSUMÉ DU NETTOYAGE');
    console.log('=' .repeat(30));
    console.log(`• Fichiers initiaux en base: ${dbFiles.length}`);
    console.log(`• Fichiers valides conservés: ${validFiles.length}`);
    console.log(`• Fichiers orphelins supprimés: ${orphanedFiles.length}`);
    
    if (orphanedFiles.length === 0) {
      console.log('\n🎉 Base de données propre !');
    } else {
      console.log('\n✅ Nettoyage terminé avec succès !');
    }
    
  } catch (error) {
    console.error('❌ Erreur durant le nettoyage:', error);
  } finally {
    await pool.end();
  }
}

// Exécuter le nettoyage
cleanupOrphanedFiles().catch(console.error);