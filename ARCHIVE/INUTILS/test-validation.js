#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testValidation() {
  try {
    console.log('🔧 Test de validation de dossier...\n');

    // 1. Authentification 
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie');

    // 2. Récupération d'un dossier existant avec des fichiers
    const dossiersResponse = await axios.get(`${API_BASE_URL}/dossiers?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!dossiersResponse.data.dossiers || dossiersResponse.data.dossiers.length === 0) {
      console.log('❌ Aucun dossier trouvé');
      return;
    }

    const dossier = dossiersResponse.data.dossiers[0];
    console.log('✅ Dossier trouvé:', dossier.id, '-', dossier.client);
    console.log('   Statut actuel:', dossier.statut);
    console.log('   Created by:', dossier.created_by);
    console.log('   Preparateur ID:', dossier.preparateur_id);

    // 3. Vérifier les fichiers du dossier
    const filesResponse = await axios.get(`${API_BASE_URL}/files`, {
      params: { dossier_id: dossier.id },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('📁 Nombre de fichiers:', filesResponse.data.files.length);
    
    if (filesResponse.data.files.length === 0) {
      console.log('⚠️  Pas de fichiers - ajoutons-en un');
      
      // Créer un fichier temporaire et l'uploader
      const fs = require('fs');
      const FormData = require('form-data');
      const tempFile = '/tmp/test-validation-file.txt';
      fs.writeFileSync(tempFile, `Test file for validation - ${new Date().toISOString()}`);
      
      const form = new FormData();
      form.append('files', fs.createReadStream(tempFile));
      
      await axios.post(`${API_BASE_URL}/files/upload/${dossier.id}`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders()
        }
      });
      
      console.log('✅ Fichier ajouté pour le test');
      fs.unlinkSync(tempFile);
    }

    // 4. Test de validation
    console.log('\n📋 Test de validation du dossier...');
    
    try {
      const validationResponse = await axios.put(
        `${API_BASE_URL}/dossiers/${dossier.id}/valider`,
        { commentaire: 'Test de validation automatique' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ Validation réussie:', validationResponse.data.message);
      
    } catch (validationError) {
      console.log('❌ Erreur de validation:');
      console.log('   Status:', validationError.response?.status);
      console.log('   Message:', validationError.response?.data?.message || validationError.message);
      console.log('   Détails:', JSON.stringify(validationError.response?.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error?.response?.data || error.message);
  }
}

testValidation();