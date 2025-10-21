#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testGetFiles() {
  try {
    console.log('🔧 Test de récupération des fichiers...\n');

    // 1. Authentification
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie');

    // 2. Récupération d'un dossier existant  
    const dossiersResponse = await axios.get(`${API_BASE_URL}/dossiers?limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const dossier = dossiersResponse.data.dossiers[0];
    console.log('✅ Dossier trouvé:', dossier.id);

    // 3. Test de récupération des fichiers avec la nouvelle API
    const filesResponse = await axios.get(`${API_BASE_URL}/files`, {
      params: { dossier_id: dossier.id },
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('\n📄 Structure des fichiers retournés:');
    console.log('Nombre de fichiers:', filesResponse.data.files.length);
    
    if (filesResponse.data.files.length > 0) {
      const file = filesResponse.data.files[0];
      console.log('\n📋 Premier fichier:');
      console.log('- ID:', file.id);
      console.log('- Nom:', file.original_filename || file.filename);
      console.log('- MIME Type:', file.mimetype);
      console.log('- Taille:', file.size);
      console.log('- Chemin:', file.filepath);
      
      console.log('\n✅ Structure correcte - mimetype présent:', !!file.mimetype);
    } else {
      console.log('ℹ️  Aucun fichier dans ce dossier');
    }

  } catch (error) {
    console.error('❌ Erreur:', error?.response?.data || error.message);
  }
}

testGetFiles();