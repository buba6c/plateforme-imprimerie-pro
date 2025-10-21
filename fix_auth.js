#!/usr/bin/env node

/**
 * Script pour créer/vérifier les utilisateurs admin
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: 'imprimerie_user',
  host: 'localhost',
  database: 'imprimerie_db',
  password: 'imprimerie_password',
  port: 5432,
});

async function checkUsers() {
  console.log('👥 Vérification des utilisateurs existants');
  console.log('========================================\n');
  
  try {
    const result = await pool.query('SELECT id, nom, email, role, created_at FROM users ORDER BY id');
    
    if (result.rows.length === 0) {
      console.log('❌ Aucun utilisateur trouvé dans la base de données');
      return [];
    }
    
    console.log(`✅ ${result.rows.length} utilisateur(s) trouvé(s):`);
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Nom: ${user.nom}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rôle: ${user.role}`);
      console.log(`   Créé: ${user.created_at}`);
      console.log('');
    });
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des utilisateurs:', error.message);
    return [];
  }
}

async function createAdminUser() {
  console.log('🔧 Création d\'un utilisateur admin de test');
  console.log('=========================================\n');
  
  const adminData = {
    nom: 'Administrateur',
    email: 'admin@evocom.fr',
    password: 'Admin123!',
    role: 'admin'
  };
  
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [adminData.email]);
    
    if (existingUser.rows.length > 0) {
      console.log(`⚠️  L'utilisateur ${adminData.email} existe déjà (ID: ${existingUser.rows[0].id})`);
      
      // Mettre à jour le mot de passe
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      await pool.query(
        'UPDATE users SET password = $1, role = $2 WHERE email = $3',
        [hashedPassword, adminData.role, adminData.email]
      );
      
      console.log(`✅ Mot de passe mis à jour pour ${adminData.email}`);
      return existingUser.rows[0].id;
    } else {
      // Créer un nouvel utilisateur
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      const result = await pool.query(
        'INSERT INTO users (nom, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [adminData.nom, adminData.email, hashedPassword, adminData.role]
      );
      
      console.log(`✅ Utilisateur admin créé avec l'ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur admin:', error.message);
    return null;
  }
}

async function testLogin() {
  console.log('🧪 Test de connexion avec les nouveaux credentials');
  console.log('===============================================\n');
  
  const axios = require('axios');
  
  const loginData = {
    email: 'admin@evocom.fr',
    password: 'Admin123!'
  };
  
  try {
    console.log(`📝 Tentative de connexion: ${loginData.email}`);
    
    const response = await axios.post('http://localhost:5001/api/auth/login', loginData, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200 && response.data.token) {
      console.log(`✅ Connexion réussie!`);
      console.log(`Token: ${response.data.token.substring(0, 50)}...`);
      console.log(`Utilisateur: ${response.data.user?.nom} (${response.data.user?.role})`);
      
      // Tester l'accès aux statistiques
      const statsResponse = await axios.get('http://localhost:5001/api/statistiques/summary', {
        headers: { 'Authorization': `Bearer ${response.data.token}` },
        validateStatus: () => true
      });
      
      console.log(`\n📊 Test accès statistiques: Status ${statsResponse.status}`);
      if (statsResponse.status === 200) {
        console.log('✅ Accès aux statistiques autorisé!');
      } else {
        console.log(`❌ Erreur d'accès aux statistiques: ${statsResponse.status}`);
      }
      
      return response.data.token;
      
    } else {
      console.log(`❌ Échec de la connexion`);
      console.log(`Response:`, response.data);
    }
    
  } catch (error) {
    console.log(`❌ Erreur réseau: ${error.message}`);
  }
  
  return null;
}

async function main() {
  console.log('🔧 Résolution des problèmes d\'authentification');
  console.log('==============================================\n');
  
  // Vérifier les utilisateurs existants
  const existingUsers = await checkUsers();
  
  // Créer/mettre à jour l'utilisateur admin
  const adminId = await createAdminUser();
  
  if (adminId) {
    // Tester la connexion
    const token = await testLogin();
    
    if (token) {
      console.log('\n🎯 RÉSOLUTION RÉUSSIE!');
      console.log('====================');
      console.log('✅ Utilisateur admin configuré');
      console.log('✅ Connexion fonctionnelle');
      console.log('✅ Accès aux API protégées');
      console.log('');
      console.log('Credentials à utiliser:');
      console.log('📧 Email: admin@evocom.fr');
      console.log('🔑 Password: Admin123!');
      console.log('');
      console.log('Connectez-vous sur: http://localhost:3001');
    } else {
      console.log('\n❌ La connexion ne fonctionne toujours pas');
      console.log('Vérifiez les logs du backend pour plus de détails');
    }
  }
  
  await pool.end();
}

main().catch(console.error);