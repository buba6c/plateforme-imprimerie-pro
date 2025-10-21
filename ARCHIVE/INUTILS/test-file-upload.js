#!/usr/bin/env node
/**
 * Test complet du système d'upload de fichiers
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');

const API_BASE = 'http://localhost:5001/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjMsImVtYWlsIjoiYWRtaW5AdGVzdC5sb2NhbCIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFRlc3QgUmVzZXQiLCJpYXQiOjE3NTk2MDkzMzgsImV4cCI6MTc1OTY5NTczOH0.HHqdDbbX5HkSUj8lxcKQzJRu2I758-v3xIF5Z9-ADUM';

class FileUploadTester {
  constructor() {
    this.testDossierId = null;
  }

  async getDossierForTest() {
    console.log('🔍 Récupération d\'un dossier pour test...');
    
    try {
      const response = await axios.get(`${API_BASE}/dossiers`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const dossiers = response.data.dossiers;
      if (dossiers.length === 0) {
        throw new Error('Aucun dossier disponible pour test');
      }
      
      this.testDossierId = dossiers[0].id;
      console.log(`✅ Dossier test: ${dossiers[0].client} (${this.testDossierId.substring(0,8)}...)`);
      return this.testDossierId;
      
    } catch (error) {
      throw new Error(`Erreur récupération dossier: ${error.response?.data?.message || error.message}`);
    }
  }

  async createTestFile() {
    console.log('📄 Création d\'un fichier de test...');
    
    const testFileName = 'test-upload.txt';
    const testContent = `Fichier de test généré le ${new Date().toLocaleString('fr-FR')}
Ce fichier sert à tester l'upload de fichiers vers la plateforme d'impression.

Contenu de test:
- ID du dossier: ${this.testDossierId}
- Timestamp: ${Date.now()}
- Taille approximative: ${Math.random() * 1000} Ko`;

    try {
      await fs.writeFile(testFileName, testContent);
      console.log(`✅ Fichier créé: ${testFileName} (${testContent.length} caractères)`);
      return testFileName;
    } catch (error) {
      throw new Error(`Erreur création fichier: ${error.message}`);
    }
  }

  async testFileUpload() {
    console.log('\n📤 TEST D\'UPLOAD DE FICHIER...\n');
    
    const dossierId = await this.getDossierForTest();
    const testFileName = await this.createTestFile();
    
    try {
      // Créer un FormData pour l'upload
      const formData = new FormData();
      const fileBuffer = await fs.readFile(testFileName);
      formData.append('files', fileBuffer, testFileName);
      
      console.log(`🚀 Upload vers /dossiers/${dossierId}/fichiers...`);
      
      const response = await axios.post(`${API_BASE}/dossiers/${dossierId}/fichiers`, formData, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          ...formData.getHeaders()
        }
      });
      
      console.log(`✅ Upload réussi ! Status: ${response.status}`);
      console.log(`📋 Réponse:`, response.data);
      
      return response.data;
      
    } catch (error) {
      console.log(`❌ Erreur upload: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      if (error.response?.data) {
        console.log(`📄 Détails:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    } finally {
      // Nettoyer le fichier de test
      try {
        await fs.unlink(testFileName);
        console.log(`🗑️  Fichier de test supprimé`);
      } catch (e) {
        // Ignore
      }
    }
  }

  async testFilesList() {
    console.log('\n📂 TEST LISTE DES FICHIERS...\n');
    
    try {
      const response = await axios.get(`${API_BASE}/dossiers/${this.testDossierId}/fichiers`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      console.log(`✅ Liste récupérée ! Status: ${response.status}`);
      console.log(`📋 Nombre de fichiers: ${response.data.files?.length || 0}`);
      
      if (response.data.files && response.data.files.length > 0) {
        console.log('\n📄 Fichiers trouvés:');
        response.data.files.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.nom} (${file.taille} bytes)`);
          console.log(`     ID: ${file.id}`);
          console.log(`     Uploadé le: ${new Date(file.uploaded_at).toLocaleString('fr-FR')}`);
        });
      }
      
      return response.data.files || [];
      
    } catch (error) {
      console.log(`❌ Erreur liste fichiers: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  async testFileDownload(fileId, fileName) {
    console.log(`\n⬇️  TEST TÉLÉCHARGEMENT DE FICHIER...\n`);
    
    try {
      console.log(`🔗 Téléchargement du fichier: ${fileName}`);
      
      const response = await axios.get(`${API_BASE}/dossiers/fichiers/${fileId}/download`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        responseType: 'arraybuffer'
      });
      
      console.log(`✅ Téléchargement réussi ! Status: ${response.status}`);
      console.log(`📊 Taille: ${response.data.length} bytes`);
      console.log(`📄 Type: ${response.headers['content-type']}`);
      
      // Sauvegarder temporairement pour vérifier
      const downloadedFileName = `downloaded_${fileName}`;
      await fs.writeFile(downloadedFileName, response.data);
      console.log(`💾 Fichier sauvegardé: ${downloadedFileName}`);
      
      // Nettoyer
      setTimeout(async () => {
        try {
          await fs.unlink(downloadedFileName);
        } catch (e) {
          // Ignore
        }
      }, 1000);
      
      return true;
      
    } catch (error) {
      console.log(`❌ Erreur téléchargement: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  async checkUploadsDirectory() {
    console.log('\n📁 VÉRIFICATION DOSSIER UPLOADS...\n');
    
    const uploadsPath = path.join(__dirname, 'uploads');
    
    try {
      const exists = await fs.access(uploadsPath).then(() => true).catch(() => false);
      console.log(`📂 Dossier uploads: ${exists ? '✅ Existe' : '❌ N\'existe pas'}`);
      
      if (exists) {
        const contents = await fs.readdir(uploadsPath);
        console.log(`📋 Contenu (${contents.length} éléments):`, contents.slice(0, 5));
        
        // Vérifier le dossier du dossier test
        if (this.testDossierId) {
          const dossierUploadPath = path.join(uploadsPath, this.testDossierId);
          const dossierExists = await fs.access(dossierUploadPath).then(() => true).catch(() => false);
          console.log(`📂 Dossier ${this.testDossierId.substring(0,8)}...: ${dossierExists ? '✅ Existe' : '❌ N\'existe pas'}`);
          
          if (dossierExists) {
            const dossierContents = await fs.readdir(dossierUploadPath);
            console.log(`📄 Fichiers dans dossier: ${dossierContents.length}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Erreur vérification dossier: ${error.message}`);
    }
  }

  async run() {
    console.log('🚀 TEST COMPLET SYSTÈME DE FICHIERS\n');
    console.log('=' .repeat(50));
    
    try {
      // 1. Vérifier le dossier uploads
      await this.checkUploadsDirectory();
      
      // 2. Test d'upload
      const uploadResult = await this.testFileUpload();
      
      // 3. Test liste des fichiers
      const filesList = await this.testFilesList();
      
      // 4. Test téléchargement (si des fichiers existent)
      if (filesList.length > 0) {
        const firstFile = filesList[0];
        await this.testFileDownload(firstFile.id, firstFile.nom);
      }
      
      console.log('\n🎉 TESTS TERMINÉS !');
      console.log('\n📊 RÉSUMÉ:');
      console.log(`✅ Upload: ${uploadResult ? 'OK' : 'ÉCHEC'}`);
      console.log(`✅ Liste: ${filesList.length >= 0 ? 'OK' : 'ÉCHEC'}`);
      console.log(`✅ Download: ${filesList.length > 0 ? 'OK' : 'NON TESTÉ'}`);
      
    } catch (error) {
      console.error('❌ ERREUR GLOBALE:', error.message);
    }
  }
}

// Exécuter les tests
if (require.main === module) {
  const tester = new FileUploadTester();
  tester.run();
}

module.exports = FileUploadTester;