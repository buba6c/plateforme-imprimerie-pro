#!/usr/bin/env node

/**
 * Script pour analyser la structure de la table users
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'imprimerie_user',
  host: 'localhost',
  database: 'imprimerie_db',
  password: 'imprimerie_password',
  port: 5432,
});

async function analyzeUsersTable() {
  console.log('🔍 Analyse de la structure de la table users');
  console.log('==========================================\n');
  
  try {
    // Obtenir la structure de la table
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Structure de la table users:');
    structure.rows.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name}`);
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Défaut: ${col.column_default || 'null'}`);
      console.log('');
    });
    
    // Vérifier quelques utilisateurs avec tous leurs champs
    const users = await pool.query('SELECT * FROM users LIMIT 3');
    
    console.log('📊 Exemple d\'utilisateurs (3 premiers):');
    users.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${JSON.stringify(user, null, 2)}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

async function testExistingCredentials() {
  console.log('\n🧪 Test des credentials existants');
  console.log('===============================\n');
  
  const axios = require('axios');
  
  const testAccounts = [
    { email: 'admin@imprimerie.local', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' },
    { email: 'admin@imprimerie.com', password: 'admin123' },
    { email: 'admin@evocomprint.com', password: 'admin123' },
    { email: 'admin@test.local', password: 'admin123' },
    { email: 'admin@imprimerie.local', password: 'Admin123!' },
    { email: 'admin@test.com', password: 'Admin123!' }
  ];
  
  for (const account of testAccounts) {
    try {
      console.log(`📝 Test: ${account.email} / ${account.password}`);
      
      const response = await axios.post('http://localhost:5001/api/auth/login', account, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 && response.data.token) {
        console.log(`   ✅ CONNEXION RÉUSSIE!`);
        console.log(`   Token: ${response.data.token.substring(0, 50)}...`);
        console.log(`   Utilisateur: ${response.data.user?.nom} (${response.data.user?.role})`);
        
        // Tester l'accès aux statistiques
        const statsResponse = await axios.get('http://localhost:5001/api/statistiques/summary', {
          headers: { 'Authorization': `Bearer ${response.data.token}` },
          validateStatus: () => true
        });
        
        console.log(`   📊 Accès statistiques: ${statsResponse.status === 200 ? '✅' : '❌'}`);
        
        console.log('\n🎯 CREDENTIALS FONCTIONNELS TROUVÉS:');
        console.log(`📧 Email: ${account.email}`);
        console.log(`🔑 Password: ${account.password}`);
        console.log('');
        
        return { token: response.data.token, credentials: account };
        
      } else {
        console.log(`   ❌ Échec (${response.data?.error || response.data?.message || 'Erreur inconnue'})`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur réseau: ${error.message}`);
    }
  }
  
  return null;
}

async function main() {
  await analyzeUsersTable();
  
  const validAuth = await testExistingCredentials();
  
  if (validAuth) {
    console.log('🎉 PROBLÈME RÉSOLU!');
    console.log('==================');
    console.log('');
    console.log('Utilisez ces credentials sur http://localhost:3001:');
    console.log(`Email: ${validAuth.credentials.email}`);
    console.log(`Password: ${validAuth.credentials.password}`);
  } else {
    console.log('\n❌ Aucun credential fonctionnel trouvé');
    console.log('Vérifiez les mots de passe dans la base de données');
  }
  
  await pool.end();
}

main().catch(console.error);