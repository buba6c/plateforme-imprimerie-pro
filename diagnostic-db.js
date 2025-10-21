#!/usr/bin/env node
/**
 * 🔍 Script de diagnostic de la base de données
 * 
 * Vérifie:
 * - Type de colonne ID dans dossiers (INTEGER vs UUID)
 * - Existence des colonnes nécessaires
 * - Chemins des fichiers (absolus vs relatifs)
 * - Dossiers validés
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'imprimerie_user',
  password: process.env.DB_PASSWORD || 'imprimerie_password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'imprimerie_db',
});

async function runDiagnostic() {
  console.log('🔍 DIAGNOSTIC DE LA BASE DE DONNÉES\n');
  console.log('='.repeat(60));

  try {
    // Test de connexion
    console.log('\n1️⃣  Test de connexion...');
    const testResult = await pool.query('SELECT NOW() as time');
    console.log(`✅ Connexion réussie: ${testResult.rows[0].time}`);

    // Vérifier le type de colonne ID dans dossiers
    console.log('\n2️⃣  Type de colonne dossiers.id...');
    const idTypeResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'dossiers' 
        AND column_name = 'id'
    `);
    
    if (idTypeResult.rows.length > 0) {
      const col = idTypeResult.rows[0];
      console.log(`✅ dossiers.id: ${col.data_type.toUpperCase()}`);
      if (col.data_type === 'uuid') {
        console.log('   ⚠️  ATTENTION: Les IDs sont des UUID, assurez-vous que le frontend envoie des UUID valides');
      } else if (col.data_type === 'integer' || col.data_type === 'bigint') {
        console.log('   ✅ Les IDs sont des entiers, pas besoin de validation UUID');
      }
    } else {
      console.log('❌ Colonne dossiers.id non trouvée');
    }

    // Vérifier les colonnes importantes
    console.log('\n3️⃣  Colonnes importantes dans dossiers...');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'dossiers' 
        AND column_name IN ('id', 'numero', 'numero_commande', 'statut', 'preparateur_id', 'created_by', 'validé_preparateur', 'type_formulaire', 'machine')
      ORDER BY column_name
    `);
    
    const foundColumns = columnsResult.rows.map(r => r.column_name);
    console.log('   Colonnes trouvées:', foundColumns.join(', '));
    
    const expectedColumns = ['id', 'statut', 'preparateur_id', 'validé_preparateur', 'type_formulaire'];
    const missingColumns = expectedColumns.filter(c => !foundColumns.includes(c));
    if (missingColumns.length > 0) {
      console.log('   ⚠️  Colonnes manquantes:', missingColumns.join(', '));
    } else {
      console.log('   ✅ Toutes les colonnes critiques présentes');
    }

    // Compter les dossiers
    console.log('\n4️⃣  Statistiques dossiers...');
    const countResult = await pool.query('SELECT COUNT(*) as total FROM dossiers');
    const total = parseInt(countResult.rows[0].total);
    console.log(`   Total de dossiers: ${total}`);

    if (total > 0) {
      // Afficher quelques exemples
      const sampleResult = await pool.query(`
        SELECT id, numero, statut, "validé_preparateur" as valide_preparateur, type_formulaire, created_by, preparateur_id
        FROM dossiers 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      console.log('\n   Exemples (5 derniers dossiers):');
      sampleResult.rows.forEach((d, i) => {
        console.log(`   ${i+1}. ID=${d.id}, Numéro=${d.numero}, Statut=${d.statut}, Validé=${d.valide_preparateur}, Type=${d.type_formulaire}`);
      });

      // Vérifier les dossiers validés
      const validatedResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM dossiers 
        WHERE "validé_preparateur" = true
      `);
      const validatedCount = parseInt(validatedResult.rows[0].count);
      console.log(`\n   Dossiers validés: ${validatedCount}/${total} (${((validatedCount/total)*100).toFixed(1)}%)`);
    }

    // Vérifier la table fichiers
    console.log('\n5️⃣  Statistiques fichiers...');
    const filesCountResult = await pool.query('SELECT COUNT(*) as total FROM fichiers');
    const filesTotal = parseInt(filesCountResult.rows[0].total);
    console.log(`   Total de fichiers: ${filesTotal}`);

    if (filesTotal > 0) {
      // Vérifier les colonnes de fichiers
      const fileColumnsResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'fichiers' 
          AND column_name IN ('id', 'dossier_id', 'nom', 'chemin', 'taille', 'uploaded_by', 'mime_type', 'uploaded_at')
        ORDER BY column_name
      `);
      
      const fileColumns = fileColumnsResult.rows.map(r => r.column_name);
      console.log('   Colonnes trouvées:', fileColumns.join(', '));

      // Échantillon de chemins de fichiers
      const pathsResult = await pool.query(`
        SELECT id, dossier_id, nom, chemin
        FROM fichiers 
        ORDER BY uploaded_at DESC 
        LIMIT 3
      `);
      
      console.log('\n   Exemples de chemins (3 derniers fichiers):');
      pathsResult.rows.forEach((f, i) => {
        const isAbsolute = f.chemin && f.chemin.startsWith('/');
        const isRelative = f.chemin && f.chemin.startsWith('uploads/');
        const status = isRelative ? '✅ RELATIF' : isAbsolute ? '⚠️  ABSOLU' : '❓ AUTRE';
        console.log(`   ${i+1}. ${status} - ${f.chemin}`);
      });

      // Compter les chemins absolus vs relatifs
      const absoluteResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN chemin LIKE '/%' THEN 1 END) as absolus,
          COUNT(CASE WHEN chemin LIKE 'uploads/%' THEN 1 END) as relatifs,
          COUNT(CASE WHEN chemin NOT LIKE '/%' AND chemin NOT LIKE 'uploads/%' THEN 1 END) as autres
        FROM fichiers
      `);
      
      const pathStats = absoluteResult.rows[0];
      console.log(`\n   Chemins: ${pathStats.absolus} absolus, ${pathStats.relatifs} relatifs, ${pathStats.autres} autres`);
      
      if (parseInt(pathStats.absolus) > 0) {
        console.log('   ⚠️  ATTENTION: Des chemins absolus existent, ils devraient être migrés en relatifs');
      } else {
        console.log('   ✅ Tous les chemins sont relatifs (ou autres formats cohérents)');
      }
    }

    // Vérifier les utilisateurs
    console.log('\n6️⃣  Statistiques utilisateurs...');
    const usersResult = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);
    
    console.log('   Utilisateurs par rôle:');
    usersResult.rows.forEach(r => {
      console.log(`   - ${r.role}: ${r.count}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTIC TERMINÉ');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

// Exécuter le diagnostic
runDiagnostic().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
