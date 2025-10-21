#!/usr/bin/env node
/**
 * 🧪 TEST SPÉCIFIQUE CRÉATION DOSSIER FRONTEND
 * Simuler exactement ce que fait le frontend
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testFrontendCreateDossier() {
  console.log('🧪 TEST CRÉATION DOSSIER FRONTEND');
  console.log('=================================\n');
  
  try {
    // 1. Authentification admin
    console.log('🔐 1. Authentification admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    console.log('   ✅ Token récupéré');
    const token = loginResponse.data.token;
    
    // 2. Créer une instance axios comme le frontend
    console.log('🔧 2. Configuration axios comme frontend...');
    const api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 3. Test création dossier
    console.log('📝 3. Test création dossier...');
    const dossierData = {
      client: 'Test Frontend Debug',
      machine: 'Roland',
      description: 'Test création depuis simulation frontend',
      quantite: 123,
      client_email: 'test@client.com',
      client_telephone: '0123456789',
      commentaires: 'Test de débogage'
    };
    
    console.log('   Données envoyées:', JSON.stringify(dossierData, null, 2));
    
    const createResponse = await api.post('/dossiers', dossierData);
    
    if (createResponse.data.success) {
      console.log('   ✅ Dossier créé avec succès !');
      console.log('   📋 Détails:', {
        id: createResponse.data.dossier.id,
        numero: createResponse.data.dossier.numero_commande,
        client: createResponse.data.dossier.client,
        machine: createResponse.data.dossier.machine
      });
    } else {
      console.log('   ❌ Échec création:', createResponse.data.message);
    }
    
    console.log('\n🎉 TEST RÉUSSI - La création de dossier fonctionne !');
    console.log('🔍 Si erreur frontend, vérifier:');
    console.log('   - Configuration baseURL dans services/api.js');
    console.log('   - Token d\'authentification valide');
    console.log('   - Headers Content-Type et Authorization');
    console.log('   - Données du formulaire correctes');
    
  } catch (error) {
    console.error('❌ Erreur durant le test:', error.message);
    
    if (error.response) {
      console.error('📋 Détails erreur:');
      console.error('   Status:', error.response.status);
      console.error('   URL appelée:', error.config?.url || 'N/A');
      console.error('   Base URL:', error.config?.baseURL || 'N/A');
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Headers:', JSON.stringify(error.config?.headers || {}, null, 2));
    }
  }
}

testFrontendCreateDossier();