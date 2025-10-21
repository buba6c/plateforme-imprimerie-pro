#!/usr/bin/env node

/**
 * DIAGNOSTIC SIMPLE - Test connexion et base de données
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Configuration de la base de données (même que dans database.js)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'imprimerie',
  password: process.env.DB_PASSWORD || 'postgres',
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
    const usersResult = await pool.query('SELECT id, email, role, is_active, nom, prenom FROM users');
    
    console.log('\n📋 Liste des utilisateurs:');
    usersResult.rows.forEach(user => {
      const status = user.is_active ? '✅' : '❌';
      console.log(`   ${status} ${user.email} (${user.role}) - ${user.nom} ${user.prenom}`);
    });
    
    return true;
    
  } catch (error) {
    console.log('❌ Erreur lors de la vérification des utilisateurs');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

async function testUserPassword() {
  console.log('\n🔐 Test des mots de passe hashés...');
  
  try {
    const result = await pool.query('SELECT email, password_hash FROM users LIMIT 3');
    
    for (const user of result.rows) {
      console.log(`\n   User: ${user.email}`);
      console.log(`   Hash: ${user.password_hash.substring(0, 20)}...`);
      
      // Tester avec le mot de passe par défaut
      const isValid = await bcrypt.compare('test123', user.password_hash);
      console.log(`   Test 'test123': ${isValid ? '✅ Valide' : '❌ Invalide'}`);
      
      if (!isValid) {
        // Tester d'autres mots de passe possibles
        const otherPasswords = ['admin', 'password', '123456', 'imprimerie'];
        for (const pwd of otherPasswords) {
          const testResult = await bcrypt.compare(pwd, user.password_hash);
          if (testResult) {
            console.log(`   Test '${pwd}': ✅ Valide`);
            break;
          }
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Erreur lors du test des mots de passe');
    console.log(`   Erreur: ${error.message}`);
  }
}

async function createMissingUsers() {
  console.log('\n🛠️ Création des utilisateurs manquants...');
  
  const defaultUsers = [
    { email: 'admin@imprimerie.local', role: 'admin', nom: 'Admin', prenom: 'Système' },
    { email: 'preparateur@imprimerie.local', role: 'preparateur', nom: 'Préparateur', prenom: 'Test' },
    { email: 'imprimeur_roland@imprimerie.local', role: 'imprimeur_roland', nom: 'Imprimeur', prenom: 'Roland' },
    { email: 'imprimeur_xerox@imprimerie.local', role: 'imprimeur_xerox', nom: 'Imprimeur', prenom: 'Xerox' },
    { email: 'livreur@imprimerie.local', role: 'livreur', nom: 'Livreur', prenom: 'Test' }
  ];
  
  const passwordHash = await bcrypt.hash('test123', 10);
  
  for (const userData of defaultUsers) {
    try {
      // Vérifier si l'utilisateur existe
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [userData.email]);
      
      if (existing.rows.length === 0) {
        // Créer l'utilisateur
        await pool.query(`
          INSERT INTO users (email, password_hash, role, nom, prenom, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, true, NOW())
        `, [userData.email, passwordHash, userData.role, userData.nom, userData.prenom]);
        
        console.log(`   ✅ Créé: ${userData.email} (${userData.role})`);
      } else {
        console.log(`   ℹ️  Existe: ${userData.email}`);
      }
    } catch (error) {
      console.log(`   ❌ Erreur pour ${userData.email}: ${error.message}`);
    }
  }
}

async function runDiagnostic() {
  console.log('🏥 DIAGNOSTIC - Problèmes de connexion login\n');
  
  // 1. Test connexion BD
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log('\n❌ ARRÊT: Impossible de se connecter à la base de données');
    process.exit(1);
  }
  
  // 2. Vérification table users
  const usersOk = await checkUsersTable();
  
  if (!usersOk) {
    console.log('\n🛠️ Tentative de création des utilisateurs par défaut...');
    await createMissingUsers();
    await checkUsersTable();
  }
  
  // 3. Test mots de passe
  await testUserPassword();
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMMANDATIONS:');
  console.log('1. Vérifiez que les utilisateurs sont actifs (is_active = true)');
  console.log('2. Le mot de passe par défaut est: test123');
  console.log('3. Testez la connexion avec: curl -X POST http://localhost:5002/api/auth/login \\');
  console.log('   -H "Content-Type: application/json" \\');
  console.log('   -d \'{"email": "admin@imprimerie.local", "password": "test123"}\'');
  console.log('='.repeat(60));
  
  await pool.end();
}

runDiagnostic().catch(console.error);