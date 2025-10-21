/**
 * TEST DIAGNOSTIC - Vérifier les boutons et liaisons dossiers/fichiers
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTY2MjIxMywiZXhwIjoxNzU5NzQ4NjEzfQ.EfFlkspaV6tsQ99Jc4HQ5nCClbMFbNATIzCXkq92bw4';

async function diagnosticTest() {
  console.log('🔍 DIAGNOSTIC - Boutons d\'action et liens dossiers/fichiers');
  console.log('='.repeat(65));

  try {
    // 1. Test de récupération des dossiers
    console.log('\n📂 1. TEST - Récupération des dossiers...');
    const dossiersResponse = await axios.get(`${API_BASE}/dossiers`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    
    if (!dossiersResponse.data.success) {
      console.log('❌ Erreur récupération dossiers:', dossiersResponse.data.error);
      return;
    }
    
    const dossiers = dossiersResponse.data.dossiers || [];
    console.log(`✅ ${dossiers.length} dossier(s) récupéré(s)`);
    
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier disponible pour les tests');
      return;
    }

    const testDossier = dossiers[0];
    const dossierId = testDossier.folder_id || testDossier.id;
    
    console.log(`📋 Dossier de test: "${testDossier.client}" (${dossierId})`);
    console.log(`   Status: ${testDossier.statut || testDossier.status}`);
    console.log(`   Type: ${testDossier.type || 'Non spécifié'}`);

    // 2. Test de liaison dossier-fichiers
    console.log('\n🔗 2. TEST - Liaison dossier-fichiers...');
    const filesResponse = await axios.get(`${API_BASE}/dossiers/${dossierId}/fichiers`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    
    let files = [];
    if (filesResponse.data.success) {
      files = filesResponse.data.files || filesResponse.data.data || [];
    } else {
      console.log('⚠️ Réponse fichiers:', filesResponse.data);
      files = filesResponse.data || [];
    }
    
    console.log(`✅ ${files.length} fichier(s) associé(s) au dossier`);
    
    if (files.length > 0) {
      console.log('\n📄 DÉTAILS DES FICHIERS:');
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.nom || file.nom_original || 'Sans nom'}`);
        console.log(`      ID: ${file.id}`);
        console.log(`      Taille: ${file.taille || file.size || 'Inconnue'} bytes`);
        console.log(`      Type: ${file.type || file.mimetype || 'Inconnu'}`);
        console.log(`      Dossier ID: ${file.dossier_id || 'Non spécifié'}`);
      });
    }

    // 3. Test des endpoints de prévisualisation
    console.log('\n👁️ 3. TEST - Endpoints de prévisualisation...');
    if (files.length > 0) {
      const testFile = files[0];
      
      // Test endpoint preview
      console.log(`🔍 Test endpoint: GET /api/files/preview/${testFile.id}`);
      try {
        const previewResponse = await axios.head(`${API_BASE}/files/preview/${testFile.id}`, {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
        });
        console.log('✅ Endpoint preview accessible');
      } catch (previewError) {
        console.log(`❌ Endpoint preview inaccessible: ${previewError.response?.status || previewError.message}`);
      }

      // Test endpoint download
      console.log(`💾 Test endpoint: GET /api/files/download/${testFile.id}`);
      try {
        const downloadResponse = await axios.head(`${API_BASE}/files/download/${testFile.id}`, {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
        });
        console.log('✅ Endpoint download accessible');
      } catch (downloadError) {
        console.log(`❌ Endpoint download inaccessible: ${downloadError.response?.status || downloadError.message}`);
      }
    }

    // 4. Test des actions disponibles sur le dossier
    console.log('\n⚡ 4. TEST - Actions disponibles...');
    const status = testDossier.statut || testDossier.status;
    console.log(`📊 Status actuel: "${status}"`);
    
    // Test changement de statut (simulation)
    console.log('🔄 Test simulation changement de statut...');
    const availableStatuses = [
      'en_preparation', 'valide_preparateur', 'en_impression', 
      'termine', 'livre', 'a_revoir'
    ];
    
    console.log('   Actions théoriquement possibles:');
    availableStatuses.forEach(newStatus => {
      if (newStatus !== status) {
        console.log(`      ▶️ Passer à "${newStatus}"`);
      }
    });

    // 5. Vérification de la structure des données
    console.log('\n🏗️ 5. STRUCTURE DES DONNÉES:');
    console.log('\n📂 Structure dossier:');
    console.log(`   ID/folder_id: ${testDossier.id || testDossier.folder_id}`);
    console.log(`   Client: ${testDossier.client || testDossier.client_nom}`);
    console.log(`   Numéro: ${testDossier.numero || testDossier.numero_commande}`);
    console.log(`   Status: ${testDossier.statut || testDossier.status}`);
    
    if (files.length > 0) {
      console.log('\n📄 Structure fichier type:');
      const sampleFile = files[0];
      Object.keys(sampleFile).forEach(key => {
        console.log(`   ${key}: ${sampleFile[key]}`);
      });
    }

    // 6. Recommandations
    console.log('\n💡 RECOMMANDATIONS:');
    console.log('1. ✅ Vérifier que les IDs de dossiers correspondent');
    console.log('2. ✅ S\'assurer que les endpoints backend existent');
    console.log('3. ✅ Contrôler les permissions d\'accès aux fichiers');
    console.log('4. ✅ Tester la prévisualisation dans le navigateur');
    console.log('5. ✅ Vérifier les boutons d\'action dans l\'interface');

  } catch (error) {
    console.log(`❌ Erreur lors du diagnostic: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, error.response.data);
    }
  }
}

diagnosticTest();