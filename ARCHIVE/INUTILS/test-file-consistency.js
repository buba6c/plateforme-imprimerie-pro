#!/usr/bin/env node

/**
 * Diagnostic: vérification de la correspondance upload/récupération avec différents IDs
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

async function testFileConsistency() {
  console.log('🔍 DIAGNOSTIC: Cohérence upload/récupération avec différents IDs\n');
  
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
    console.log(`📁 Test avec dossier:`);
    console.log(`   - UUID: ${testDossier.id}`);
    console.log(`   - Folder ID: ${testDossier.folder_id}`);
    console.log(`   - Numéro: ${testDossier.numero}`);
    
    // Types d'ID à tester
    const idTypes = [
      { name: 'UUID', value: testDossier.id },
      { name: 'Folder ID', value: testDossier.folder_id }, 
      { name: 'Numéro', value: testDossier.numero },
    ];
    
    // Créer fichier de test
    const testFileName = 'diagnostic-consistency.txt';
    const testFileContent = `Diagnostic cohérence - ${new Date().toISOString()}`;
    const testFilePath = path.join(__dirname, testFileName);
    fs.writeFileSync(testFilePath, testFileContent);
    
    for (const idType of idTypes) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🧪 Test avec ${idType.name}: ${idType.value}`);
      
      // 1. Compter fichiers AVANT upload
      console.log(`\\n📋 Fichiers AVANT upload avec ${idType.name}:`);
      try {
        const filesBeforeResponse = await axios.get(`${API_URL}/files`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { dossier_id: idType.value }
        });
        const filesBefore = Array.isArray(filesBeforeResponse.data) ? filesBeforeResponse.data : filesBeforeResponse.data.files || [];
        console.log(`   Nombre: ${filesBefore.length}`);
      } catch (error) {
        console.log(`   ❌ Erreur: ${error.response?.data?.message || error.message}`);
        continue; // Passer au type d'ID suivant
      }
      
      // 2. Upload avec cet ID  
      console.log(`\\n📤 Upload avec ${idType.name}...`);
      const formData = new FormData();
      formData.append('files', fs.createReadStream(testFilePath));
      
      let uploadSuccess = false;
      try {
        const uploadResponse = await axios.post(`${API_URL}/files/upload/${idType.value}`, formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`
          }
        });
        console.log(`   ✅ Upload réussi: ${uploadResponse.data.message}`);
        uploadSuccess = true;
      } catch (error) {
        console.log(`   ❌ Upload échoué: ${error.response?.data?.message || error.message}`);
        continue;
      }
      
      // 3. Récupérer fichiers APRÈS upload avec TOUS les types d'ID
      if (uploadSuccess) {
        console.log(`\\n📋 Fichiers APRÈS upload:`);
        
        for (const checkIdType of idTypes) {
          try {
            const filesAfterResponse = await axios.get(`${API_URL}/files`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { dossier_id: checkIdType.value }
            });
            const filesAfter = Array.isArray(filesAfterResponse.data) ? filesAfterResponse.data : filesAfterResponse.data.files || [];
            
            const newFiles = filesAfter.filter(f => (f.original_filename || f.nom || '').includes('diagnostic-consistency'));
            console.log(`   ${checkIdType.name}: ${filesAfter.length} total, ${newFiles.length} nouveaux`);
            
          } catch (error) {
            console.log(`   ${checkIdType.name}: ❌ ${error.response?.data?.message || error.message}`);
          }
        }
      }
    }
    
    // Nettoyer le fichier de test
    try {
      fs.unlinkSync(testFilePath);
      console.log(`\\n🗑  Fichier de test supprimé`);
    } catch (error) {
      console.log(`\\n⚠️  Erreur suppression fichier de test`);
    }
    
    console.log(`\\n${'='.repeat(80)}`);
    console.log('🎯 RÉSUMÉ DU DIAGNOSTIC');
    console.log('='.repeat(80));
    console.log('Si vous voyez des incohérences entre les types d\'ID,');
    console.log('cela explique pourquoi les fichiers uploadés ne s\'affichent pas !');
    
  } catch (error) {
    console.log(`❌ Erreur diagnostic: ${error.message}`);
  }
}

testFileConsistency().catch(console.error);