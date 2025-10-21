#!/usr/bin/env node
// Script de correction rapide pour la base de données Render
// Exécute le fichier quick_fix.sql sur PostgreSQL

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyQuickFix() {
  console.log('🔧 CORRECTION RAPIDE DE LA BASE DE DONNÉES');
  console.log('═══════════════════════════════════════════════════\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://imprimerixbackend_user:rl1rEaokB2Vk1YRVGPVN9TxXxJnwUyKM@dpg-csmb3c3tq21c73bqpbtg-a.oregon-postgres.render.com:5432/imprimerixbackend',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  let client;
  try {
    console.log('📡 Connexion à PostgreSQL Render...');
    client = await pool.connect();
    console.log('✅ Connexion établie\n');

    // Lire le script SQL
    const sqlPath = path.join(__dirname, 'database', 'quick_fix.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Exécution du script de correction...\n');
    await client.query(sqlScript);
    
    console.log('\n✅ Script exécuté avec succès\n');
    
    // Vérification finale
    console.log('🔍 Vérification des corrections...\n');
    
    const verifyUploaded = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fichiers' AND column_name IN ('uploaded_at', 'created_at')
      ORDER BY column_name
    `);
    
    console.log('📋 Colonnes de la table fichiers:');
    verifyUploaded.rows.forEach(col => {
      console.log(`   ✓ ${col.column_name} (${col.data_type})`);
    });
    
    const verifyTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('fichiers', 'dossier_formulaires', 'dossier_status_history')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables vérifiées:');
    verifyTables.rows.forEach(table => {
      console.log(`   ✓ ${table.table_name}`);
    });
    
    // Test de la requête qui échouait
    console.log('\n🧪 Test de la requête problématique...');
    const testQuery = await client.query(`
      SELECT f.*, u.nom as uploaded_by_name 
      FROM fichiers f
      LEFT JOIN users u ON f.uploaded_by = u.id
      ORDER BY f.uploaded_at DESC
      LIMIT 1
    `);
    
    console.log(`✅ Requête fichiers testée avec succès (${testQuery.rows.length} résultat)\n`);
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 CORRECTION TERMINÉE AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error('Stack:', error.stack);
    return false;
    
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Exécution
if (require.main === module) {
  applyQuickFix()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 ERREUR FATALE:', error);
      process.exit(1);
    });
}

module.exports = applyQuickFix;
