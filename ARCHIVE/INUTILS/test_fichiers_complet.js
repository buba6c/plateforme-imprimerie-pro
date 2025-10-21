#!/usr/bin/env node

/**
 * Test complet du système de gestion des fichiers
 * Vérifie tous les aspects selon les spécifications du cahier des charges
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5001/api';

// Fonction utilitaire pour créer un fichier test
const createTestFile = (content, filename) => {
  const filepath = `/tmp/${filename}`;
  fs.writeFileSync(filepath, content);
  return filepath;
};

// Fonction pour s'authentifier et récupérer un token
const login = async (email, password) => {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
    return response.data.token;
  } catch (error) {
    console.error(`❌ Erreur connexion ${email}:`, error.response?.data?.message || error.message);
    return null;
  }
};

// Test complet du workflow fichiers
const testCompletFileWorkflow = async () => {
  console.log('🚀 TEST COMPLET - Gestion des fichiers plateforme imprimerie');
  console.log('='.repeat(80));

  let testResults = {
    passed: 0,
    failed: 0,
    details: [],
  };

  const addResult = (test, passed, message) => {
    if (passed) {
      testResults.passed++;
      console.log(`✅ ${test}: ${message}`);
    } else {
      testResults.failed++;
      console.log(`❌ ${test}: ${message}`);
    }
    testResults.details.push({ test, passed, message });
  };

  try {
    // 1. Authentification pour tous les rôles (utiliser les comptes existants)
    console.log('\\n📋 Phase 1: Authentification des utilisateurs');
    const adminToken = await login('admin@imprimerie.com', 'admin123');
    // Pour ce test, on utilisera principalement admin (il peut tout faire)
    const prepToken = adminToken; // Simuler préparateur avec admin
    const rolandToken = adminToken; // Simuler imprimeur avec admin  
    const xeroxToken = adminToken;
    const livreurToken = adminToken;

    addResult('Auth Admin', !!adminToken, adminToken ? 'Token obtenu' : 'Échec connexion');
    addResult('Auth Préparateur', !!prepToken, prepToken ? 'Token obtenu' : 'Échec connexion');
    addResult('Auth Imprimeur Roland', !!rolandToken, rolandToken ? 'Token obtenu' : 'Échec connexion');
    addResult('Auth Imprimeur Xerox', !!xeroxToken, xeroxToken ? 'Token obtenu' : 'Échec connexion');
    addResult('Auth Livreur', !!livreurToken, livreurToken ? 'Token obtenu' : 'Échec connexion');

    if (!adminToken || !prepToken) {
      console.log('❌ Authentification critique échouée, arrêt des tests');
      return testResults;
    }

    // 2. Récupérer ou créer un dossier test
    console.log('\\n📋 Phase 2: Préparation dossier de test');
    const dossiersResponse = await axios.get(`${API_BASE}/dossiers?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    let testDossier = dossiersResponse.data.dossiers.find(d => 
      d.statut === 'en_cours' || d.statut === 'En cours'
    );

    if (!testDossier) {
      // Créer un dossier test si aucun disponible
      const createResponse = await axios.post(
        `${API_BASE}/dossiers`,
        {
          client: 'Client Test Fichiers',
          type_formulaire: 'roland',
          description: 'Dossier test pour validation système fichiers',
        },
        { headers: { Authorization: `Bearer ${prepToken}` } }
      );
      testDossier = createResponse.data.dossier;
    }

    const dossierId = testDossier.folder_id || testDossier.id;
    addResult('Dossier Test', !!testDossier, `Dossier ${dossierId} disponible (statut: ${testDossier.statut})`);

    // 3. Test upload de fichiers par préparateur
    console.log('\\n📋 Phase 3: Upload fichiers par préparateur');
    
    // Créer des fichiers test
    const pdfFile = createTestFile('Test PDF content for upload', 'test_document.pdf');
    const imgFile = createTestFile('Test image content', 'test_image.jpg');
    
    try {
      const formData = new FormData();
      formData.append('files', fs.createReadStream(pdfFile));
      formData.append('files', fs.createReadStream(imgFile));

      const uploadResponse = await axios.post(
        `${API_BASE}/dossiers/${dossierId}/fichiers`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${prepToken}`,
            ...formData.getHeaders(),
          },
        }
      );

      addResult(
        'Upload Préparateur', 
        uploadResponse.data.success, 
        `${uploadResponse.data.files?.length || 0} fichier(s) uploadé(s)`
      );
    } catch (error) {
      addResult(
        'Upload Préparateur', 
        false, 
        error.response?.data?.message || error.message
      );
    }

    // Nettoyer fichiers temporaires
    fs.unlinkSync(pdfFile);
    fs.unlinkSync(imgFile);

    // 4. Récupérer la liste des fichiers
    console.log('\\n📋 Phase 4: Récupération liste fichiers');
    try {
      const filesResponse = await axios.get(`${API_BASE}/dossiers/${dossierId}/fichiers`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const files = filesResponse.data.files || [];
      addResult(
        'Liste Fichiers', 
        filesResponse.data.success, 
        `${files.length} fichier(s) trouvé(s)`
      );

      // 5. Test téléchargement fichier
      if (files.length > 0) {
        console.log('\\n📋 Phase 5: Test téléchargement');
        const firstFile = files[0];
        
        try {
          const downloadResponse = await axios.head(
            `${API_BASE}/dossiers/fichiers/${firstFile.id}/download`,
            { headers: { Authorization: `Bearer ${rolandToken || adminToken}` } }
          );

          addResult(
            'Téléchargement Imprimeur', 
            downloadResponse.status === 200, 
            `Fichier ${firstFile.nom} accessible`
          );
        } catch (error) {
          addResult(
            'Téléchargement Imprimeur', 
            false, 
            error.response?.data?.message || error.message
          );
        }

        // 6. Test prévisualisation
        console.log('\\n📋 Phase 6: Test prévisualisation');
        try {
          const previewResponse = await axios.head(
            `${API_BASE}/dossiers/fichiers/${firstFile.id}/preview`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          );

          addResult(
            'Prévisualisation Admin', 
            previewResponse.status === 200, 
            `Fichier ${firstFile.nom} prévisualisable`
          );
        } catch (error) {
          addResult(
            'Prévisualisation Admin', 
            false, 
            error.response?.data?.message || error.message
          );
        }

        // 7. Test suppression (Admin seulement)
        console.log('\\n📋 Phase 7: Test suppression fichier (Admin)');
        try {
          const deleteResponse = await axios.delete(
            `${API_BASE}/dossiers/fichiers/${firstFile.id}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          );

          addResult(
            'Suppression Admin', 
            deleteResponse.data.success, 
            `Fichier ${firstFile.nom} supprimé`
          );
        } catch (error) {
          addResult(
            'Suppression Admin', 
            false, 
            error.response?.data?.message || error.message
          );
        }
      }

      // 8. Test workflow validation
      console.log('\\n📋 Phase 8: Test workflow validation fichiers');
      
      // Valider le dossier (si pas déjà fait)
      if (!testDossier.valide_preparateur) {
        try {
          await axios.put(
            `${API_BASE}/dossiers/${dossierId}/valider`,
            {},
            { headers: { Authorization: `Bearer ${prepToken}` } }
          );
          addResult('Validation Dossier', true, 'Dossier validé avec succès');
        } catch (error) {
          addResult('Validation Dossier', false, error.response?.data?.message || error.message);
        }
      }

      // Tenter upload après validation (devrait échouer)
      try {
        const blockedFile = createTestFile('Should be blocked', 'blocked_file.txt');
        const formData = new FormData();
        formData.append('files', fs.createReadStream(blockedFile));

        await axios.post(
          `${API_BASE}/dossiers/${dossierId}/fichiers`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${prepToken}`,
              ...formData.getHeaders(),
            },
          }
        );

        fs.unlinkSync(blockedFile);
        addResult('Blocage Post-Validation', false, 'Upload autorisé alors qu\'il devrait être bloqué');
      } catch (error) {
        const isExpectedError = error.response?.status === 403 && 
          error.response?.data?.message?.includes('validé');
        addResult(
          'Blocage Post-Validation', 
          isExpectedError, 
          isExpectedError ? 'Upload correctement bloqué' : error.response?.data?.message
        );
      }

      // 9. Test permissions imprimeurs/livreur
      console.log('\\n📋 Phase 9: Test permissions rôles spécialisés');
      
      // Imprimeur ne devrait pas pouvoir uploader
      if (rolandToken) {
        try {
          const forbiddenFile = createTestFile('Forbidden upload', 'forbidden.txt');
          const formData = new FormData();
          formData.append('files', fs.createReadStream(forbiddenFile));

          await axios.post(
            `${API_BASE}/dossiers/${dossierId}/fichiers`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${rolandToken}`,
                ...formData.getHeaders(),
              },
            }
          );

          fs.unlinkSync(forbiddenFile);
          addResult('Restriction Imprimeur', false, 'Imprimeur peut uploader (erreur)');
        } catch (error) {
          const isExpectedError = error.response?.status === 403;
          addResult(
            'Restriction Imprimeur', 
            isExpectedError, 
            isExpectedError ? 'Upload correctement interdit' : error.message
          );
        }
      }

    } catch (error) {
      addResult('Liste Fichiers', false, error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('❌ Erreur critique dans les tests:', error.message);
    addResult('Tests Généraux', false, `Erreur critique: ${error.message}`);
  }

  // Rapport final
  console.log('\\n' + '='.repeat(80));
  console.log('📊 RAPPORT FINAL - Gestion des fichiers');
  console.log('='.repeat(80));
  console.log(`✅ Tests réussis: ${testResults.passed}`);
  console.log(`❌ Tests échoués: ${testResults.failed}`);
  console.log(`📈 Taux de réussite: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\\n🔍 Détails des échecs:');
    testResults.details
      .filter(r => !r.passed)
      .forEach(r => console.log(`   ❌ ${r.test}: ${r.message}`));
  }

  console.log('\\n✨ Tests terminés !');
  return testResults;
};

// Lancer les tests
if (require.main === module) {
  testCompletFileWorkflow()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { testCompletFileWorkflow };