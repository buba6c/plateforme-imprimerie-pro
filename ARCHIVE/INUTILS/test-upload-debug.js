#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5001/api';

async function testUploadFlow() {
  try {
    console.log('🔧 Test du flux d\'upload complet...\n');

    // 1. Test de santé de l'API
    console.log('1️⃣ Test de santé de l\'API...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API disponible:', healthResponse.data.status);

    // 2. Authentification (essayons avec différents comptes)
    console.log('\n2️⃣ Test d\'authentification...');
    let token = null;
    
    const users = [
      { email: 'admin@imprimerie.local', password: 'admin123' },
      { email: 'admin@imprimerie.local', password: '123456' },
      { email: 'admin@imprimerie.local', password: 'password' },
      { email: 'admin@imprimerie.com', password: 'admin123' },
      { email: 'admin@imprimerie.com', password: '123456' },
      { email: 'admin@imprimerie.com', password: 'password' }
    ];

    for (const user of users) {
      try {
        const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, user);
        token = authResponse.data.token;
        console.log('✅ Authentification réussie avec:', user.email);
        break;
      } catch (error) {
        console.log(`❌ Échec avec ${user.email}:${user.password}`);
      }
    }

    if (!token) {
      console.log('❌ Impossible de s\'authentifier avec les comptes testés');
      return;
    }

    // 3. Récupération d'un dossier existant
    console.log('\n3️⃣ Récupération d\'un dossier existant...');
    const dossiersResponse = await axios.get(`${API_BASE_URL}/dossiers?limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!dossiersResponse.data.dossiers || dossiersResponse.data.dossiers.length === 0) {
      console.log('❌ Aucun dossier trouvé');
      return;
    }

    const dossier = dossiersResponse.data.dossiers[0];
    console.log('✅ Dossier trouvé:', dossier.id, '-', dossier.client);

    // 4. Création d'un fichier de test
    console.log('\n4️⃣ Création d\'un fichier de test...');
    const testFilePath = path.join(__dirname, 'temp-test-upload.txt');
    fs.writeFileSync(testFilePath, `Test d'upload - ${new Date().toISOString()}`);
    console.log('✅ Fichier de test créé:', testFilePath);

    // 5. Test d'upload via /api/files/upload/:dossierId
    console.log('\n5️⃣ Test d\'upload via /api/files/upload...');
    try {
      const form = new FormData();
      form.append('files', fs.createReadStream(testFilePath));

      const uploadResponse = await axios.post(
        `${API_BASE_URL}/files/upload/${dossier.id}`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...form.getHeaders()
          }
        }
      );
      console.log('✅ Upload réussi via /api/files/upload:', uploadResponse.data.message);
    } catch (error) {
      console.log('❌ Erreur upload via /api/files/upload:', error?.response?.data || error.message);
    }

    // 6. Test d'upload via /api/dossiers/:id/fichiers
    console.log('\n6️⃣ Test d\'upload via /api/dossiers/fichiers...');
    try {
      const form2 = new FormData();
      form2.append('files', fs.createReadStream(testFilePath));

      const uploadResponse2 = await axios.post(
        `${API_BASE_URL}/dossiers/${dossier.id}/fichiers`,
        form2,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...form2.getHeaders()
          }
        }
      );
      console.log('✅ Upload réussi via /api/dossiers/fichiers:', uploadResponse2.data.message);
    } catch (error) {
      console.log('❌ Erreur upload via /api/dossiers/fichiers:', error?.response?.data || error.message);
    }

    // 7. Nettoyage
    console.log('\n7️⃣ Nettoyage...');
    fs.unlinkSync(testFilePath);
    console.log('✅ Fichier temporaire supprimé');

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
}

// Exécuter le test
testUploadFlow();