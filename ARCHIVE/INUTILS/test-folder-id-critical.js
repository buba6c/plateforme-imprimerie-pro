#!/usr/bin/env node

/**
 * Test critique: Upload avec folder_id vs récupération
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

async function testFolderIdUpload() {
  console.log('🎯 TEST CRITIQUE: Upload avec folder_id (comme le frontend)\n');
  
  const token = await authenticate();
  if (!token) return;
  
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
    console.log(`📁 Dossier de test:`);
    console.log(`   - Numéro: ${testDossier.numero}`);
    console.log(`   - UUID principal: ${testDossier.id}`);
    console.log(`   - Folder ID: ${testDossier.folder_id}`);
    
    // ID que le frontend utilise (folder_id prioritaire comme dans PreparateurDashboard)
    const frontendId = testDossier.folder_id || testDossier.id;
    console.log(`   - ID utilisé par frontend: ${frontendId}`);
    
    // Créer fichier de test
    const testFileName = 'test-folder-id-fix.txt';
    const testFileContent = `Test avec folder_id - ${new Date().toISOString()}`;
    const testFilePath = path.join(__dirname, testFileName);
    fs.writeFileSync(testFilePath, testFileContent);
    
    // 1. Vérifier les fichiers AVANT avec l'ID frontend
    console.log(`\\n📋 AVANT upload (avec ID frontend ${frontendId}):`);
    try {
      const filesBeforeResponse = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { dossier_id: frontendId }
      });
      const filesBefore = Array.isArray(filesBeforeResponse.data) ? filesBeforeResponse.data : filesBeforeResponse.data.files || [];
      console.log(`   Fichiers trouvés: ${filesBefore.length}`);
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.response?.data?.message || error.message}`);
    }
    
    // 2. Upload avec l'ID frontend (comme le ferait le composant)
    console.log(`\\n📤 UPLOAD avec ID frontend ${frontendId}:`);
    const formData = new FormData();
    formData.append('files', fs.createReadStream(testFilePath));
    
    try {
      const uploadResponse = await axios.post(`${API_URL}/files/upload/${frontendId}`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      });
      console.log(`   ✅ Upload réussi: ${uploadResponse.data.message}`);
      console.log(`   📁 Dossier ID utilisé en backend: ${uploadResponse.data.files?.[0]?.dossier_id}`);
    } catch (error) {
      console.log(`   ❌ Upload échoué: ${error.response?.data?.message || error.message}`);
      return;
    }
    
    // 3. Récupérer les fichiers APRÈS avec l'ID frontend
    console.log(`\\n📋 APRÈS upload (avec ID frontend ${frontendId}):`);
    try {
      const filesAfterResponse = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { dossier_id: frontendId }
      });
      const filesAfter = Array.isArray(filesAfterResponse.data) ? filesAfterResponse.data : filesAfterResponse.data.files || [];
      console.log(`   Fichiers trouvés: ${filesAfter.length}`);
      
      const newFile = filesAfter.find(f => (f.original_filename || f.nom || '').includes('test-folder-id-fix'));
      if (newFile) {
        console.log(`   ✅ NOUVEAU FICHIER TROUVÉ: ${newFile.original_filename || newFile.nom}`);
        console.log(`   📁 Stocké avec dossier_id: ${newFile.dossier_id}`);
      } else {
        console.log(`   ❌ NOUVEAU FICHIER NON TROUVÉ !`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur récupération: ${error.response?.data?.message || error.message}`);
    }
    
    // 4. Test avec l'UUID principal pour comparaison
    console.log(`\\n🔍 VÉRIFICATION avec UUID principal ${testDossier.id}:`);
    try {
      const filesUuidResponse = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { dossier_id: testDossier.id }
      });
      const filesUuid = Array.isArray(filesUuidResponse.data) ? filesUuidResponse.data : filesUuidResponse.data.files || [];
      console.log(`   Fichiers avec UUID principal: ${filesUuid.length}`);
      
      const newFileUuid = filesUuid.find(f => (f.original_filename || f.nom || '').includes('test-folder-id-fix'));
      if (newFileUuid) {
        console.log(`   ✅ Fichier trouvé avec UUID principal aussi`);
      } else {
        console.log(`   ❌ Fichier PAS trouvé avec UUID principal`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur avec UUID: ${error.response?.data?.message || error.message}`);
    }
    
    // Nettoyer
    try {
      fs.unlinkSync(testFilePath);
      console.log(`\\n🗑  Fichier de test supprimé`);
    } catch (error) {
      console.log(`\\n⚠️  Erreur suppression fichier de test`);
    }
    
    console.log(`\\n${'='.repeat(80)}`);
    console.log('🎯 DIAGNOSTIC DU PROBLÈME');
    console.log('='.repeat(80));
    console.log('Si "NOUVEAU FICHIER TROUVÉ" apparaît ci-dessus, le problème est RÉSOLU ! ✅');
    console.log('Si "NOUVEAU FICHIER NON TROUVÉ", il reste un problème de mapping d\'ID. ❌');
    console.log('');
    console.log('Le frontend utilise folder_id mais doit pouvoir récupérer les fichiers');
    console.log('uploadés avec le même ID.');
    
  } catch (error) {
    console.log(`❌ Erreur test: ${error.message}`);
  }
}

testFolderIdUpload().catch(console.error);