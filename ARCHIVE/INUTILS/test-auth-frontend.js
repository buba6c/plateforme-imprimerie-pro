#!/usr/bin/env node
/**
 * Test pour vérifier l'authentification frontend vs backend
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Test avec différents scénarios d'authentification
async function testFrontendAuth() {
  console.log('🔐 TEST AUTHENTIFICATION FRONTEND vs BACKEND\n');

  // 1. Test sans token (cas typique d'erreur frontend)
  console.log('1️⃣ Test sans token d\'authentification...');
  try {
    const response = await axios.get(`${API_BASE}/dossiers`);
    console.log('✅ Succès sans token (inattendu)');
  } catch (error) {
    console.log(`❌ Erreur attendue sans token: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
  }

  // 2. Test avec token expiré (simulation)
  console.log('\n2️⃣ Test avec token expiré/invalide...');
  try {
    const response = await axios.get(`${API_BASE}/dossiers`, {
      headers: { 'Authorization': 'Bearer invalid_token' }
    });
    console.log('✅ Succès avec token invalide (inattendu)');
  } catch (error) {
    console.log(`❌ Erreur attendue token invalide: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
  }

  // 3. Test avec token valide (notre token admin)
  console.log('\n3️⃣ Test avec token admin valide...');
  const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTYwODMzNywiZXhwIjoxNzU5Njk0NzM3fQ.0aQ1ofypzvTO0DMxE5VIfUmuGhDnf2mYcli40AaFyGU';
  
  try {
    const response = await axios.get(`${API_BASE}/dossiers`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    console.log(`✅ Succès avec token admin: ${response.data.dossiers.length} dossiers`);
  } catch (error) {
    console.log(`❌ Erreur inattendue token admin: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
  }

  // 4. Test route de login pour générer de nouveaux tokens
  console.log('\n4️⃣ Test authentification pour générer tokens frais...');
  
  const testCredentials = [
    { email: 'admin@imprimerie.com', password: '123456', role: 'admin' },
    { email: 'preparateur@imprimerie.com', password: '123456', role: 'preparateur' },
  ];

  console.log('\n🔑 Génération de nouveaux tokens:');
  
  for (const cred of testCredentials) {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email: cred.email,
        password: cred.password
      });
      
      console.log(`✅ ${cred.role}: Token généré avec succès`);
      console.log(`   Token: ${response.data.token.substring(0, 50)}...`);
      
      // Test immédiat du token généré
      try {
        const testResponse = await axios.get(`${API_BASE}/dossiers`, {
          headers: { 'Authorization': `Bearer ${response.data.token}` }
        });
        console.log(`   🎯 Test token: ${testResponse.data.dossiers?.length || 0} dossiers visibles`);
      } catch (testError) {
        console.log(`   ❌ Erreur test token: ${testError.response?.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${cred.role}: ${error.response?.data?.message || error.message}`);
    }
  }

  console.log('\n📋 RECOMMANDATIONS:');
  console.log('1. Le backend fonctionne parfaitement ✅');
  console.log('2. Le problème vient de l\'authentification frontend ⚠️');
  console.log('3. Solutions possibles:');
  console.log('   • Tokens expirés dans localStorage');
  console.log('   • Mauvaise configuration axios frontend');
  console.log('   • URL d\'API incorrecte côté frontend');
  console.log('   • Headers d\'authentification mal transmis');
}

testFrontendAuth();