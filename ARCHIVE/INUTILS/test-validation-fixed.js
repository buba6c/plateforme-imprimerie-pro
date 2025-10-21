#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testValidationFixed() {
  try {
    console.log('🔧 Test de validation corrigée...\n');

    // 1. Authentification avec un préparateur
    console.log('1️⃣ Authentification avec préparateur...');
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie');

    // 2. Récupération d'un dossier
    console.log('\n2️⃣ Récupération d\'un dossier...');
    const dossiersResponse = await axios.get(`${API_BASE_URL}/dossiers?limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!dossiersResponse.data.dossiers || dossiersResponse.data.dossiers.length === 0) {
      console.log('❌ Aucun dossier accessible');
      return;
    }

    const dossier = dossiersResponse.data.dossiers[0];
    console.log('✅ Dossier trouvé:', dossier.id);
    console.log('   Client:', dossier.client);
    console.log('   Statut:', dossier.statut);

    // 3. Vérification des fichiers
    console.log('\n3️⃣ Vérification des fichiers...');
    const filesResponse = await axios.get(`${API_BASE_URL}/files`, {
      params: { dossier_id: dossier.id },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('📁 Nombre de fichiers:', filesResponse.data.files.length);

    // 4. Test de validation
    console.log('\n4️⃣ Test de validation...');
    
    try {
      const validationResponse = await axios.put(
        `${API_BASE_URL}/dossiers/${dossier.id}/valider`,
        { commentaire: 'Test de validation après correctif' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('🎉 VALIDATION RÉUSSIE !');
      console.log('   Message:', validationResponse.data.message);
      console.log('   Nouveau statut:', validationResponse.data.dossier?.statut);
      
    } catch (validationError) {
      console.log('❌ Erreur de validation:');
      console.log('   Status:', validationError.response?.status);
      console.log('   Message:', validationError.response?.data?.message);
      
      if (validationError.response?.status === 403) {
        console.log('   → Problème d\'autorisation');
      } else if (validationError.response?.status === 404) {
        console.log('   → Dossier non trouvé');
      } else if (validationError.response?.status === 400) {
        console.log('   → Problème de validation (ex: pas de fichiers)');
      }
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error?.response?.data || error.message);
  }
}

testValidationFixed();