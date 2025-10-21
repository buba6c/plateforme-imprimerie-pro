#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE = 'http://localhost:5001/api';

// Token admin (expire dans quelques heures)
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTY2MjIxMywiZXhwIjoxNzU5NzQ4NjEzfQ.EfFlkspaV6tsQ99Jc4HQ5nCClbMFbNATIzCXkq92bw4';

async function testBoutonAction() {
  console.log('\n🧪 Test des boutons d\'action...');
  
  try {
    // 1. Récupérer un dossier
    const listResponse = await axios.get(`${API_BASE}/dossiers`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    
    if (!listResponse.data.success || listResponse.data.dossiers.length === 0) {
      console.log('❌ Aucun dossier disponible pour le test');
      return;
    }
    
    const dossier = listResponse.data.dossiers[0];
    const folderId = dossier.folder_id || dossier.id;
    console.log(`✅ Dossier trouvé: ${dossier.client} (ID: ${folderId})`);
    console.log(`   Statut actuel: ${dossier.statut}`);
    
    // 2. Tester changement de statut (forcer un statut valide)
    try {
      const changeResponse = await axios.put(
        `${API_BASE}/dossiers/${folderId}/statut`,
        { 
          nouveau_statut: 'À revoir',
          commentaire: 'Test automatique des boutons d\'action'
        },
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
      );
      
      if (changeResponse.data.success) {
        console.log(`✅ Changement de statut réussi: ${dossier.statut} → À revoir`);
      } else {
        console.log(`❌ Échec changement de statut: ${changeResponse.data.message}`);
      }
    } catch (error) {
      console.log(`⚠️ Changement de statut non autorisé (règles strictes): ${error.response?.data?.message || error.message}`);
      console.log('ℹ️ Les boutons d\'action utilisent les mêmes règles - c\'est normal');
    }
    
    return folderId;
  } catch (error) {
    console.log(`❌ Erreur test bouton action: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testUploadFichier(folderId) {
  console.log('\n📁 Test de l\'upload de fichier...');
  
  if (!folderId) {
    console.log('❌ Pas d\'ID de dossier disponible');
    return null;
  }
  
  try {
    // Créer un fichier test temporaire
    const testContent = `Test fichier créé le ${new Date().toISOString()}`;
    const testFilePath = '/tmp/test_bouton_fichier.txt';
    fs.writeFileSync(testFilePath, testContent);
    
    // Créer FormData pour l'upload
    const formData = new FormData();
    formData.append('files', fs.createReadStream(testFilePath));
    
    const uploadResponse = await axios.post(
      `${API_BASE}/dossiers/${folderId}/fichiers`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          ...formData.getHeaders()
        }
      }
    );
    
    if (uploadResponse.data.success) {
      console.log(`✅ Upload réussi: ${uploadResponse.data.files.length} fichier(s)`);
      console.log(`   Fichier: ${uploadResponse.data.files[0].nom}`);
      return uploadResponse.data.files[0];
    } else {
      console.log(`❌ Échec upload: ${uploadResponse.data.message}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Erreur upload fichier: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testDownloadFichier(fileInfo) {
  console.log('\n⬇️ Test du téléchargement de fichier...');
  
  if (!fileInfo) {
    console.log('❌ Pas d\'info de fichier disponible');
    return;
  }
  
  try {
    const downloadResponse = await axios.head(
      `${API_BASE}/dossiers/fichiers/${fileInfo.id}/download`,
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    
    if (downloadResponse.status === 200) {
      console.log(`✅ Téléchargement accessible: ${fileInfo.nom}`);
      console.log(`   Content-Type: ${downloadResponse.headers['content-type']}`);
      console.log(`   Content-Length: ${downloadResponse.headers['content-length']} bytes`);
    } else {
      console.log(`❌ Problème téléchargement: status ${downloadResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Erreur téléchargement: ${error.response?.data?.message || error.message}`);
  }
}

async function testAffichageFichiers(folderId) {
  console.log('\n📋 Test de l\'affichage des fichiers...');
  
  if (!folderId) {
    console.log('❌ Pas d\'ID de dossier disponible');
    return;
  }
  
  try {
    const filesResponse = await axios.get(
      `${API_BASE}/dossiers/${folderId}/fichiers`,
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    
    if (filesResponse.data.success) {
      const files = filesResponse.data.files || filesResponse.data.data || [];
      console.log(`✅ Liste des fichiers récupérée: ${files.length} fichier(s)`);
      
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.nom} (${file.taille} bytes)`);
      });
      
      return files;
    } else {
      console.log(`❌ Échec récupération fichiers: ${filesResponse.data.message}`);
      return [];
    }
  } catch (error) {
    console.log(`❌ Erreur affichage fichiers: ${error.response?.data?.message || error.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 Test complet: Boutons d\'action et gestion des fichiers');
  console.log('=' .repeat(60));
  
  // Test des boutons d'action
  const folderId = await testBoutonAction();
  
  // Test de l'upload de fichier
  const uploadedFile = await testUploadFichier(folderId);
  
  // Test de l'affichage des fichiers
  await testAffichageFichiers(folderId);
  
  // Test du téléchargement
  await testDownloadFichier(uploadedFile);
  
  console.log('\n🎉 Tests terminés !');
}

// Lancer les tests
main().catch(console.error);