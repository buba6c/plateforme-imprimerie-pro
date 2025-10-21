#!/usr/bin/env node

/**
 * Script d'exécution de migration PostgreSQL pour l'IA intelligente
 * Exécute directement via la connexion DB existante
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la base de données PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'imprimerie_user',
  password: process.env.DB_PASSWORD || 'imprimerie_password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'imprimerie_db',
  ssl: false,
});

const migrationPath = path.join(__dirname, 'backend/migrations/009_postgresql_intelligent_ai_tables.sql');

async function runMigration() {
  console.log('🔄 Démarrage de la migration PostgreSQL...');
  
  try {
    // Test de connexion
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ Connexion établie: ${testResult.rows[0].current_time}`);
    
    // Lire le fichier SQL
    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Diviser en requêtes individuelles
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    let executedCount = 0;
    let skippedCount = 0;
    
    // Exécuter chaque statement
    for (const statement of statements) {
      try {
        if (statement.length > 5) {
          const preview = statement.substring(0, 70).replace(/\n/g, ' ');
          console.log(`⏳ ${preview}...`);
          
          await pool.query(statement);
          executedCount++;
          console.log(`   ✅ OK`);
        }
      } catch (err) {
        // Les indices peuvent exister, ce n'est pas fatal
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate') ||
            err.message.includes('relation') ||
            err.code === '42P07') {
          console.log(`   ⚠️  (Élément existant, ignoré)`);
          skippedCount++;
        } else {
          console.error(`   ❌ Erreur: ${err.message}`);
          console.error(`   Code: ${err.code}`);
        }
      }
    }
    
    console.log(`\n✅ Migration complétée!`);
    console.log(`   ✅ Exécutés: ${executedCount}`);
    console.log(`   ⚠️  Ignorés: ${skippedCount}`);
    
    // Vérifier les tables créées
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'ai_%'
    `);
    
    console.log(`\n📊 Tables créées:`);
    checkResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

// Exécuter
runMigration();
