#!/usr/bin/env node

/**
 * Test d'upload/récupération avec le service frontend corrigé
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5001/api';

// Simulation du DossierIdResolver
const DossierIdResolver = {
  resolve: (input) => {
    if (typeof input === 'string' && (input.length === 36 || input.startsWith('DOSS-') || input.startsWith('CMD-'))) {
      return input;
    }
    if (input && typeof input === 'object') {
      return input.id || input.folder_id || input.numero;
    }
    return input;
  }
};

// Simulation du httpClient avec token
let authToken = null;

const api = {
  get: async (url, config = {}) => {
    return axios.get(`${API_URL}${url}`, {
      ...config,
      headers: {
        ...config.headers,
        Authorization: authToken ? `Bearer ${authToken}` : undefined
      }
    });
  },
  post: async (url, data, config = {}) => {
    return axios.post(`${API_URL}${url}`, data, {
      ...config,
      headers: {
        ...config.headers,
        Authorization: authToken ? `Bearer ${authToken}` : undefined
      }
    });
  }
};

// Service de fichiers simulé (version corrigée)
const realFilesService = {
  uploadFiles: async (dossierLike, files) => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      const response = await api.post(`/files/upload/${dossierId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur upload' };
    }
  },

  getFiles: async dossierLike => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    try {
      const response = await api.get('/files', { params: { dossier_id: dossierId } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Erreur récupération' };
    }
  }
};

async function authenticate() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    authToken = response.data.token;
    console.log('✅ Authentification réussie');
    return true;
  } catch (error) {
    console.log('❌ Échec authentification');
    return false;
  }
}

async function testFrontendUploadFlow() {
  console.log('🚀 TEST: Simulation du flow frontend complet\n');
  
  if (!await authenticate()) return;
  
  try {
    // Récupérer un dossier (comme le fait le frontend)
    const dossiersResponse = await api.get('/dossiers');
    const dossiers = dossiersResponse.data.dossiers || [];
    
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier trouvé');
      return;
    }
    
    const testDossier = dossiers[0];
    console.log(`📁 Test avec dossier: ${testDossier.numero}`);
    console.log(`   ID utilisé: ${testDossier.id}`);
    
    // Créer fichier de test
    const testFileName = 'test-frontend-flow.txt';
    const testFileContent = `Test frontend flow - ${new Date().toISOString()}`;
    const testFilePath = path.join(__dirname, testFileName);
    fs.writeFileSync(testFilePath, testFileContent);
    
    // 1. État initial - récupérer les fichiers
    console.log('\n📋 AVANT upload - fichiers existants:');
    try {
      const filesBefore = await realFilesService.getFiles(testDossier.id);
      console.log(`   Nombre: ${filesBefore.files?.length || 0}`);
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.error || error.message}`);
    }
    
    // 2. Upload comme le fait le frontend
    console.log('\n📤 UPLOAD en cours...');
    try {
      const uploadResult = await realFilesService.uploadFiles(testDossier.id, [fs.createReadStream(testFilePath)]);
      console.log('   ✅ Upload réussi:', uploadResult.message);
      console.log('   📋 Fichiers uploadés:', uploadResult.files?.length || 0);
    } catch (error) {
      console.log('   ❌ Upload échoué:', error.error || error.message);
      return;
    }
    
    // 3. Attendre un peu (comme le setTimeout du frontend)
    console.log('\n⏳ Attente 500ms (comme le frontend)...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 4. Recharger les fichiers (comme loadFiles())
    console.log('\n🔄 APRÈS upload - rechargement fichiers:');
    try {
      const filesAfter = await realFilesService.getFiles(testDossier.id);
      console.log(`   Nombre total: ${filesAfter.files?.length || 0}`);
      
      const newFiles = filesAfter.files?.filter(f => 
        (f.original_filename || f.nom || '').includes('test-frontend-flow')
      ) || [];
      console.log(`   Nouveaux fichiers trouvés: ${newFiles.length}`);
      
      newFiles.forEach(file => {
        console.log(`      - ${file.original_filename || file.nom} (ID: ${file.id})`);
      });
      
    } catch (error) {
      console.log(`   ❌ Erreur rechargement: ${error.error || error.message}`);
    }
    
    // Nettoyer
    try {
      fs.unlinkSync(testFilePath);
      console.log('\n🗑  Fichier de test supprimé');
    } catch (error) {
      console.log('\n⚠️  Erreur suppression fichier de test');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 DIAGNOSTIC');
    console.log('='.repeat(80));
    console.log('Si vous voyez "Nouveaux fichiers trouvés: 1" ci-dessus,');
    console.log('alors le problème est RÉSOLU ! ✅');
    console.log('');
    console.log('Si vous voyez "Nouveaux fichiers trouvés: 0",');
    console.log('alors il y a encore un problème de synchronisation. ❌');
    
  } catch (error) {
    console.log(`❌ Erreur test: ${error.message}`);
  }
}

testFrontendUploadFlow().catch(console.error);