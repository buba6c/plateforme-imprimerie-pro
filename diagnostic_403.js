#!/usr/bin/env node

/**
 * Script de diagnostic et résolution des erreurs 403 Forbidden
 * Détecte et résout les problèmes d'authentification
 */

const axios = require('axios');

const FRONTEND_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:5001/api';

console.log('🔍 Diagnostic des erreurs 403 Forbidden');
console.log('=====================================\n');

async function testEndpoints() {
  const tests = [
    { 
      name: 'Frontend principal', 
      url: FRONTEND_URL, 
      expectedStatus: [200] 
    },
    { 
      name: 'API racine', 
      url: API_URL, 
      expectedStatus: [200] 
    },
    { 
      name: 'Endpoint auth (sans token)', 
      url: `${API_URL}/auth/me`, 
      expectedStatus: [401] 
    },
    { 
      name: 'Statistiques (sans token)', 
      url: `${API_URL}/statistiques/summary`, 
      expectedStatus: [401] 
    },
    { 
      name: 'Dossiers (sans token)', 
      url: `${API_URL}/dossiers`, 
      expectedStatus: [401] 
    }
  ];

  for (const test of tests) {
    try {
      console.log(`📡 Test: ${test.name}`);
      const response = await axios.get(test.url, { 
        validateStatus: () => true,
        timeout: 5000 
      });
      
      const status = response.status;
      const isExpected = test.expectedStatus.includes(status);
      
      console.log(`  Status: ${status} ${isExpected ? '✅' : '❌'}`);
      
      if (status === 403) {
        console.log(`  ⚠️  ERREUR 403 DÉTECTÉE!`);
        console.log(`  Headers: ${JSON.stringify(response.headers, null, 2)}`);
        if (response.data) {
          console.log(`  Response: ${JSON.stringify(response.data, null, 2)}`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Erreur réseau: ${error.message}`);
    }
    console.log('');
  }
}

async function checkAuthToken() {
  console.log('🔑 Vérification des tokens d\'authentification');
  console.log('===========================================\n');
  
  // Simuler la récupération du token depuis le localStorage
  const testTokens = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMzQyNjc4NSwiZXhwIjoxNzM0MDMxNTg1fQ.rXcD8L6gtaqQw2t-s1Pcx8VYfkUiaW8bGTvTzRoY9OY',
    // Token de test généré
    'test_token_example'
  ];
  
  for (const token of testTokens) {
    console.log(`🔍 Test du token: ${token.substring(0, 50)}...`);
    
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`  ✅ Token valide!`);
        console.log(`  Utilisateur: ${response.data.data?.nom} (${response.data.data?.role})`);
        return token;
      } else if (response.status === 401) {
        console.log(`  ❌ Token expiré ou invalide`);
      } else if (response.status === 403) {
        console.log(`  ⚠️  Token valide mais accès interdit`);
      }
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
    console.log('');
  }
  
  return null;
}

async function generateNewToken() {
  console.log('🔧 Génération d\'un nouveau token');
  console.log('===============================\n');
  
  const loginData = {
    email: 'admin@evocom.fr',
    password: 'Admin123!'
  };
  
  try {
    console.log(`📝 Tentative de connexion avec: ${loginData.email}`);
    
    const response = await axios.post(`${API_URL}/auth/login`, loginData, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200 && response.data.token) {
      console.log(`✅ Connexion réussie!`);
      console.log(`Token: ${response.data.token.substring(0, 50)}...`);
      console.log(`Utilisateur: ${response.data.user?.nom} (${response.data.user?.role})`);
      
      // Tester le nouveau token
      const testResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${response.data.token}` },
        validateStatus: () => true
      });
      
      if (testResponse.status === 200) {
        console.log(`✅ Token fonctionne correctement!`);
        return response.data.token;
      } else {
        console.log(`❌ Token généré mais ne fonctionne pas (Status: ${testResponse.status})`);
      }
      
    } else {
      console.log(`❌ Échec de la connexion`);
      console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur lors de la connexion: ${error.message}`);
  }
  
  return null;
}

async function testWithValidToken(token) {
  if (!token) {
    console.log('⚠️  Aucun token valide disponible');
    return;
  }
  
  console.log('🧪 Test des endpoints protégés avec token valide');
  console.log('============================================\n');
  
  const protectedEndpoints = [
    `${API_URL}/statistiques/summary`,
    `${API_URL}/statistiques/dashboard?periode=today`,
    `${API_URL}/dossiers?page=1&limit=5`,
    `${API_URL}/users/me`
  ];
  
  for (const endpoint of protectedEndpoints) {
    try {
      console.log(`📡 Test: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true,
        timeout: 10000
      });
      
      const status = response.status;
      console.log(`  Status: ${status} ${status === 200 ? '✅' : status === 403 ? '⚠️ ' : '❌'}`);
      
      if (status === 403) {
        console.log(`  ❌ ERREUR 403: Accès interdit malgré le token valide`);
        console.log(`  Message: ${response.data?.message || 'Pas de message'}`);
      } else if (status === 200) {
        console.log(`  ✅ Accès autorisé`);
      }
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
    console.log('');
  }
}

async function provideSolutions() {
  console.log('💡 Solutions aux erreurs 403 Forbidden');
  console.log('====================================\n');
  
  console.log('1. 🔑 Authentification manquante:');
  console.log('   - Connectez-vous sur http://localhost:3001');
  console.log('   - Utilisez: admin@evocom.fr / Admin123!');
  console.log('');
  
  console.log('2. 🕐 Token expiré:');
  console.log('   - Déconnectez-vous et reconnectez-vous');
  console.log('   - Videz le localStorage du navigateur');
  console.log('');
  
  console.log('3. ⚡ Redémarrage des services:');
  console.log('   - pm2 restart backend-imprimerie');
  console.log('   - pm2 restart frontend-imprimerie');
  console.log('');
  
  console.log('4. 🌐 Vérification des URLs:');
  console.log('   - Frontend: http://localhost:3001 (pas 3000!)');
  console.log('   - API: http://localhost:5001/api');
  console.log('');
  
  console.log('5. 🔧 Cache et cookies:');
  console.log('   - Videz le cache du navigateur (Ctrl+Shift+R)');
  console.log('   - Supprimez les cookies du site');
  console.log('');
}

// Exécution du diagnostic
async function main() {
  await testEndpoints();
  
  const validToken = await checkAuthToken();
  
  if (!validToken) {
    const newToken = await generateNewToken();
    if (newToken) {
      await testWithValidToken(newToken);
    }
  } else {
    await testWithValidToken(validToken);
  }
  
  await provideSolutions();
  
  console.log('🎯 Diagnostic terminé!');
  console.log('===================');
  console.log('');
  console.log('Si l\'erreur 403 persiste:');
  console.log('1. Vérifiez que vous utilisez http://localhost:3001');
  console.log('2. Connectez-vous avec admin@evocom.fr / Admin123!');
  console.log('3. Redémarrez les services PM2 si nécessaire');
}

main().catch(console.error);