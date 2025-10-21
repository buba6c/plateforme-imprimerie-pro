#!/usr/bin/env node
/**
 * 🧪 TEST DEBUG APIADAPTER
 * Tester directement l'apiAdapter comme le ferait le frontend
 */

// Simuler l'environnement React dans Node.js
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

global.window = {
  dispatchEvent: () => {}
};

// Simuler axios pour l'import ESM/CommonJS
const axios = require('axios');

// Variables d'environnement simulées
process.env.REACT_APP_API_URL = 'http://localhost:5001/api';

async function testApiAdapter() {
  console.log('🔧 TEST DEBUG APIADAPTER');
  console.log('========================\n');
  
  try {
    // Simuler la vérification de disponibilité backend
    console.log('🌐 1. Test disponibilité backend...');
    const healthResponse = await axios.get('http://localhost:5001/api/health', { timeout: 2000 });
    console.log('   ✅ Backend disponible');
    
    // Test authentification
    console.log('🔐 2. Test authentification...');
    const authResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('   ✅ Authentification réussie');
    
    // Test création dossier directe
    console.log('📝 3. Test création dossier API directe...');
    const createResponse = await axios.post('http://localhost:5001/api/dossiers', {
      client: 'Test ApiAdapter',
      machine: 'Roland',
      description: 'Test depuis simulation apiAdapter',
      quantite: 99
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   ✅ Création réussie:', createResponse.data.dossier.numero_commande);
    
    console.log('\n🎯 DIAGNOSTIC:');
    console.log('✅ API Backend: Fonctionnelle');
    console.log('✅ Authentification: OK');
    console.log('✅ Création dossier: OK');
    console.log('\n🔍 Le problème frontend vient probablement de:');
    console.log('   1. Configuration baseURL incorrecte');
    console.log('   2. Headers manquants ou incorrects');
    console.log('   3. Utilisation du mock au lieu de l\'API réelle');
    console.log('   4. Token non transmis correctement');
    
    console.log('\n📋 Vérifications à faire dans le navigateur:');
    console.log('   - Ouvrir Developer Tools > Network');
    console.log('   - Voir si les requêtes vont vers /api/dossiers');
    console.log('   - Vérifier les headers Authorization');
    console.log('   - Contrôler les erreurs console');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testApiAdapter();