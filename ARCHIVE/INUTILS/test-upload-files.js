#!/usr/bin/env node

/**
 * Test d'upload de fichier et récupération
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5001/api';

async function authenticate() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    console.log('✅ Authentification réussie');
    return response.data.token;
  } catch (error) {
    console.log('❌ Échec authentification');
    return null;
  }
}

async function testFileUploadAndRetrieve() {
  console.log('🚀 TEST: Upload et récupération de fichiers\n');
  
  const token = await authenticate();
  if (!token) {
    return;
  }
  
  try {
    // Récupérer un dossier
    const dossiersResponse = await axios.get(`${API_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const dossiers = dossiersResponse.data.dossiers || [];
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier trouvé');
      return;
    }
    
    const testDossier = dossiers[0];
    console.log(`📁 Test avec dossier: ${testDossier.numero} (ID: ${testDossier.id})`);
    
    // 1. Récupérer les fichiers AVANT upload
    console.log('\n📋 Fichiers AVANT upload:');
    try {
      const filesBeforeResponse = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { dossier_id: testDossier.id }
      });
      const filesBefore = Array.isArray(filesBeforeResponse.data) ? filesBeforeResponse.data : filesBeforeResponse.data.files || [];
      console.log(`   Nombre de fichiers: ${filesBefore.length}`);
      filesBefore.forEach((file, i) => {
        console.log(`   ${i+1}. ${file.original_filename || file.nom || file.filename} (${file.size || file.taille} bytes)`);
      });
    } catch (error) {
      console.log(`   ❌ Erreur récupération fichiers avant: ${error.response?.data?.message || error.message}`);
    }
    
    // 2. Créer un fichier de test
    const testFileName = 'test-upload.txt';
    const testFileContent = `Test d'upload - ${new Date().toISOString()}`;
    const testFilePath = path.join(__dirname, testFileName);
    
    fs.writeFileSync(testFilePath, testFileContent);
    console.log(`\n📄 Fichier de test créé: ${testFileName}`);
    
    // 3. Upload du fichier
    console.log('\n📤 Upload en cours...');
    const formData = new FormData();
    formData.append('files', fs.createReadStream(testFilePath));
    
    try {
      const uploadResponse = await axios.post(`${API_URL}/files/upload/${testDossier.id}`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log(`   ✅ Upload réussi: ${uploadResponse.data.message}`);
      console.log(`   📋 Fichiers uploadés: ${uploadResponse.data.files?.length || 0}`);
      uploadResponse.data.files?.forEach((file, i) => {
        console.log(`      ${i+1}. ${file.nom || file.original_filename} - ID: ${file.id}`);
      });
      
    } catch (error) {
      console.log(`   ❌ Erreur upload: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      console.log(`   📋 Détails:`, error.response?.data);
    }
    
    // 4. Récupérer les fichiers APRÈS upload
    console.log('\n📋 Fichiers APRÈS upload:');
    try {
      const filesAfterResponse = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { dossier_id: testDossier.id }
      });
      const filesAfter = Array.isArray(filesAfterResponse.data) ? filesAfterResponse.data : filesAfterResponse.data.files || [];
      console.log(`   Nombre de fichiers: ${filesAfter.length}`);
      filesAfter.forEach((file, i) => {
        console.log(`   ${i+1}. ${file.original_filename || file.nom || file.filename} (${file.size || file.taille} bytes) - ID: ${file.id}`);
      });
      
      if (filesAfter.length > 0) {
        console.log('\n📊 Comparaison structure fichier:');
        const file = filesAfter[0];
        console.log('   Propriétés disponibles:', Object.keys(file).join(', '));
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur récupération fichiers après: ${error.response?.data?.message || error.message}`);
    }
    
    // 5. Nettoyer le fichier de test
    try {
      fs.unlinkSync(testFilePath);
      console.log(`\n🗑  Fichier de test supprimé: ${testFileName}`);
    } catch (error) {
      console.log(`\n⚠️  Erreur suppression fichier de test: ${error.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur test: ${error.message}`);
  }
}

testFileUploadAndRetrieve().catch(console.error);