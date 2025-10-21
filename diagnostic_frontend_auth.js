#!/usr/bin/env node

const axios = require('axios');

async function diagnoseFrontendAuth() {
  console.log('🔍 DIAGNOSTIC D\'AUTHENTIFICATION FRONTEND');
  console.log('=' .repeat(50));

  // 1. Tester l'API sans authentification
  console.log('\n1. Test accès API sans auth...');
  try {
    const response = await axios.get('http://localhost:5001/api/dossiers');
    console.log('   ❌ API accessible sans auth - problème de sécurité !');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('   ✅ API protégée correctement');
    } else {
      console.log(`   ⚠️ Erreur inattendue: ${error.response?.status} - ${error.message}`);
    }
  }

  // 2. Connexion et récupération token
  console.log('\n2. Test connexion...');
  try {
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const token = loginResponse.data.token;
    console.log('   ✅ Connexion réussie');
    console.log(`   Token: ${token.substring(0, 20)}...`);

    // 3. Test API avec token valide
    console.log('\n3. Test API avec token valide...');
    const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`   ✅ API accessible avec token: ${dossiersResponse.data.dossiers.length} dossiers`);

    // 4. Test token expiré (simulation)
    console.log('\n4. Test avec token expiré...');
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmxvY2FsIiwicm9sZSI6ImFkbWluIiwibm9tIjoiQWRtaW5pc3RyYXRldXIiLCJpYXQiOjE3NTk4NDAwMDAsImV4cCI6MTc1OTg0MDAwMX0.invalid';
    
    try {
      await axios.get('http://localhost:5001/api/dossiers', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      console.log('   ❌ Token expiré accepté - problème de validation !');
    } catch (expiredError) {
      if (expiredError.response?.status === 401) {
        console.log('   ✅ Token expiré correctement rejeté');
      } else {
        console.log(`   ⚠️ Erreur inattendue: ${expiredError.response?.status}`);
      }
    }

    // 5. Test avec token malformé
    console.log('\n5. Test avec token malformé...');
    try {
      await axios.get('http://localhost:5001/api/dossiers', {
        headers: { Authorization: 'Bearer invalid-token' }
      });
      console.log('   ❌ Token malformé accepté - problème de validation !');
    } catch (malformedError) {
      if (malformedError.response?.status === 401) {
        console.log('   ✅ Token malformé correctement rejeté');
      } else {
        console.log(`   ⚠️ Erreur inattendue: ${malformedError.response?.status}`);
      }
    }

  } catch (error) {
    console.log(`   ❌ Erreur connexion: ${error.response?.data?.message || error.message}`);
  }

  // 6. Recommandations
  console.log('\n📋 RECOMMANDATIONS POUR LE FRONTEND:');
  console.log('   1. Vérifier que localStorage contient un token valide');
  console.log('   2. Implémenter la gestion automatique du refresh token');
  console.log('   3. Rediriger vers login si 401 detected');
  console.log('   4. Afficher un message d\'erreur clair à l\'utilisateur');
}

diagnoseFrontendAuth().catch(console.error);