#!/usr/bin/env node

/**
 * DIAGNOSTIC SIMPLE - Test connexion et base de données (sans dependencies externes)
 */

const { Pool } = require('pg');

// Configuration de la base de données (même que dans database.js)
const pool = new Pool({
  user: process.env.DB_USER || 'imprimerie_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'imprimerie_db',
  password: process.env.DB_PASSWORD || 'imprimerie_password',
  port: process.env.DB_PORT || 5432,
});

async function testDatabaseConnection() {
  console.log('🔗 Test connexion à la base de données...');
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Connexion BD réussie');
    console.log(`   Heure serveur: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.log('❌ Échec connexion BD');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

async function checkUsersTable() {
  console.log('\n👥 Vérification de la table users...');
  
  try {
    // Vérifier si la table existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table users inexistante');
      return false;
    }
    
    console.log('✅ Table users existe');
    
    // Compter les utilisateurs
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(countResult.rows[0].count);
    
    console.log(`   Nombre d'utilisateurs: ${userCount}`);
    
    if (userCount === 0) {
      console.log('⚠️  Aucun utilisateur en base !');
      return false;
    }
    
    // Lister les utilisateurs
    const usersResult = await pool.query('SELECT id, email, role, is_active, nom, created_at FROM users ORDER BY id');
    
    console.log('\n📋 Liste des utilisateurs:');
    usersResult.rows.forEach((user, index) => {
      const status = user.is_active ? '✅' : '❌';
      const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
      console.log(`   ${index + 1}. ${status} ${user.email} (${user.role}) - ${user.nom} - Créé: ${createdAt}`);
    });
    
    return true;
    
  } catch (error) {
    console.log('❌ Erreur lors de la vérification des utilisateurs');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

async function checkPasswordHashes() {
  console.log('\n🔐 Vérification des mots de passe hashés...');
  
  try {
    const result = await pool.query('SELECT email, password_hash FROM users LIMIT 5');
    
    console.log('📋 Mots de passe hashés:');
    result.rows.forEach(user => {
      const hashPreview = user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'VIDE!';
      console.log(`   ${user.email}: ${hashPreview}`);
    });
    
  } catch (error) {
    console.log('❌ Erreur lors de la vérification des mots de passe');
    console.log(`   Erreur: ${error.message}`);
  }
}

async function checkTableStructure() {
  console.log('\n🏗️ Structure de la table users...');
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Colonnes de la table:');
    result.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default || 'Aucun';
      console.log(`   ${col.column_name} (${col.data_type}) - ${nullable} - Défaut: ${defaultVal}`);
    });
    
  } catch (error) {
    console.log('❌ Erreur lors de la vérification de la structure');
    console.log(`   Erreur: ${error.message}`);
  }
}

async function runDiagnostic() {
  console.log('🏥 DIAGNOSTIC - Base de données et utilisateurs\n');
  console.log('=' .repeat(60));
  
  // 1. Test connexion BD
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log('\n❌ ARRÊT: Impossible de se connecter à la base de données');
    console.log('\n💡 Solutions possibles:');
    console.log('   1. Vérifier que PostgreSQL est démarré');
    console.log('   2. Vérifier les paramètres de connexion (host, port, database, user, password)');
    console.log('   3. Vérifier que la base "imprimerie" existe');
    await pool.end();
    process.exit(1);
  }
  
  // 2. Structure de table
  await checkTableStructure();
  
  // 3. Vérification table users
  const usersOk = await checkUsersTable();
  
  // 4. Vérification mots de passe
  if (usersOk) {
    await checkPasswordHashes();
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 POUR TESTER LA CONNEXION:');
  console.log('');
  console.log('1. Assurez-vous que le serveur backend tourne:');
  console.log('   cd backend && PORT=5002 node server.js');
  console.log('');
  console.log('2. Testez avec curl:');
  console.log('   curl -X POST http://localhost:5002/api/auth/login \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"email": "admin@imprimerie.local", "password": "test123"}\'');
  console.log('');
  console.log('3. Depuis le frontend, vérifiez les logs de la console navigateur');
  console.log('='.repeat(60));
  
  await pool.end();
}

runDiagnostic().catch(console.error);