#!/usr/bin/env node
/**
 * Réinitialisation d'un utilisateur admin pour les tests
 */

const bcrypt = require('bcrypt');
const { Client } = require('pg');

// Configuration de la base de données
const dbConfig = {
  user: 'imprimerie_user',
  host: 'localhost',  
  database: 'imprimerie_db',
  password: 'imprimerie_password',
  port: 5432,
};

async function resetAdminUser() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('🔗 Connexion à la base de données...');

    // 1. Créer/mettre à jour un utilisateur admin test
    const email = 'admin@test.local';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 12);

    console.log(`🔐 Création utilisateur admin test...`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
    // Supprimer l'utilisateur s'il existe déjà
    await client.query('DELETE FROM users WHERE email = $1', [email]);
    
    // Créer le nouvel utilisateur
    const insertQuery = `
      INSERT INTO users (nom, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, nom, email, role
    `;
    
    const result = await client.query(insertQuery, [
      'Admin Test Reset',
      email,
      hashedPassword,
      'admin',
      true
    ]);

    const newUser = result.rows[0];
    console.log(`✅ Utilisateur créé:`, newUser);

    // 2. Tester l'authentification immédiatement
    console.log(`\n🧪 Test d'authentification...`);
    
    const axios = require('axios');
    const API_BASE = 'http://localhost:5001/api';
    
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: email,
        password: password
      });
      
      console.log(`✅ Login réussi !`);
      console.log(`🎯 Token: ${loginResponse.data.token.substring(0, 50)}...`);
      
      // Tester le token immédiatement
      const testResponse = await axios.get(`${API_BASE}/dossiers`, {
        headers: { 'Authorization': `Bearer ${loginResponse.data.token}` }
      });
      
      console.log(`🎉 Test API réussi: ${testResponse.data.dossiers.length} dossiers trouvés`);
      
      // Sauvegarder les credentials pour les tests
      console.log(`\n📋 CREDENTIALS POUR LES TESTS FRONTEND:`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log(`Token: ${loginResponse.data.token}`);
      
    } catch (authError) {
      console.log(`❌ Erreur authentification: ${authError.response?.data?.message || authError.message}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
    console.log('🔚 Connexion fermée');
  }
}

// Exécuter uniquement si appelé directement
if (require.main === module) {
  resetAdminUser();
}

module.exports = resetAdminUser;