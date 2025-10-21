/**
 * 🔍 Script de diagnostic pour la conversion de devis
 * Ce script teste la conversion avec une authentification réelle
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function authenticateAndTest() {
  try {
    console.log('🔐 Authentification...');
    
    // Authentification avec un utilisateur admin/préparateur
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@test.com', // ou un compte préparateur
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Authentification réussie');
    
    // Headers avec token
    const headers = { Authorization: `Bearer ${token}` };
    
    // 1. Lister les devis
    console.log('\n📋 Récupération des devis...');
    const devisResponse = await axios.get(`${API_URL}/devis`, { headers });
    const devis = devisResponse.data.devis || [];
    
    console.log(`Trouvé ${devis.length} devis`);
    
    if (devis.length === 0) {
      console.log('⚠️ Aucun devis trouvé. Création d\'un devis de test...');
      
      // Créer un devis de test
      const newDevis = await axios.post(`${API_URL}/devis`, {
        machine_type: 'xerox',
        data_json: {
          type_document: 'Test',
          format: 'A4',
          nombre_exemplaires: 10,
          mode_impression: 'recto_simple',
          couleur_impression: 'couleur'
        },
        client_nom: 'Client Test',
        notes: 'Devis de test pour diagnostic'
      }, { headers });
      
      console.log('✅ Devis de test créé:', newDevis.data.devis.id);
      devis.push(newDevis.data.devis);
    }
    
    // 2. Prendre le premier devis
    const devisToConvert = devis[0];
    console.log(`\n🎯 Test avec devis ID: ${devisToConvert.id}`);
    console.log(`   Statut: ${devisToConvert.statut}`);
    console.log(`   Numéro: ${devisToConvert.numero}`);
    
    // 3. Vérifier/changer le statut si nécessaire
    if (devisToConvert.statut !== 'valide') {
      console.log('📝 Validation du devis...');
      await axios.put(`${API_URL}/devis/${devisToConvert.id}`, {
        statut: 'valide',
        prix_final: 15000
      }, { headers });
      console.log('✅ Devis validé');
    }
    
    if (devisToConvert.statut === 'converti') {
      console.log('⚠️ Ce devis est déjà converti, impossible de le reconvertir');
      return;
    }
    
    // 4. Tenter la conversion
    console.log('\n🔄 Tentative de conversion...');
    const conversionResponse = await axios.post(
      `${API_URL}/devis/${devisToConvert.id}/convert`,
      {},
      { headers }
    );
    
    console.log('✅ Conversion réussie !');
    console.log('Réponse:', conversionResponse.data);
    
  } catch (error) {
    console.log('\n❌ ERREUR DÉTAILLÉE:');
    console.log('Status:', error.response?.status || 'Pas de status');
    console.log('URL:', error.config?.url || 'Pas d\'URL');
    console.log('Méthode:', error.config?.method || 'Pas de méthode');
    
    if (error.response?.data) {
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Message:', error.message);
    }
    
    if (error.response?.data?.stack) {
      console.log('Stack trace:', error.response.data.stack);
    }
  }
}

// Lancer le test
authenticateAndTest();