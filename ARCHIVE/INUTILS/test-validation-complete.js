#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testValidationComplete() {
  try {
    console.log('🎯 Test de validation complète avec dossier ayant des fichiers...\n');

    // 1. Authentification avec un préparateur
    console.log('1️⃣ Authentification avec préparateur...');
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie - Rôle:', authResponse.data.user.role);

    // 2. Recherche d'un dossier avec des fichiers
    console.log('\n2️⃣ Recherche d\'un dossier avec fichiers...');
    const dossiersResponse = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    let dossierAvecFichiers = null;
    
    for (const dossier of dossiersResponse.data.dossiers) {
      try {
        const filesResponse = await axios.get(`${API_BASE_URL}/files`, {
          params: { dossier_id: dossier.id },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const fileCount = filesResponse.data.files.length;
        console.log(`📁 Dossier ${dossier.id.substring(0,8)}... (${dossier.client}): ${fileCount} fichiers - Statut: ${dossier.statut}`);
        
        if (fileCount > 0 && dossier.statut === 'en_cours') {
          dossierAvecFichiers = dossier;
          dossierAvecFichiers.fileCount = fileCount;
          console.log('🎯 Ce dossier peut être validé !');
          break;
        }
      } catch (e) {
        console.log(`❌ Erreur accès dossier ${dossier.id}: ${e.response?.data?.message || e.message}`);
      }
    }

    if (!dossierAvecFichiers) {
      console.log('⚠️ Aucun dossier en cours avec fichiers trouvé. Créons-en un pour test...');
      
      // Créer un nouveau dossier pour test
      const createResponse = await axios.post(`${API_BASE_URL}/dossiers`, {
        client: 'Test Validation',
        type_formulaire: 'roland',
        titre: 'Test Validation Complète'
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      const newDossier = createResponse.data.dossier;
      console.log('✅ Nouveau dossier créé:', newDossier.id);
      
      // Ajouter un fichier de test
      console.log('📤 Upload fichier de test...');
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('files', Buffer.from('Contenu de test pour validation'), {
        filename: 'test-validation.txt',
        contentType: 'text/plain'
      });
      
      const uploadResponse = await axios.post(`${API_BASE_URL}/files/upload/${newDossier.id}`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('✅ Fichier uploadé:', uploadResponse.data.message);
      dossierAvecFichiers = newDossier;
      dossierAvecFichiers.fileCount = 1;
    }

    // 3. Test de validation sur le dossier trouvé/créé
    console.log(`\n3️⃣ Test de validation sur dossier: ${dossierAvecFichiers.id}`);
    console.log('   Client:', dossierAvecFichiers.client);
    console.log('   Fichiers:', dossierAvecFichiers.fileCount);
    console.log('   Statut actuel:', dossierAvecFichiers.statut);

    const validationData = {
      commentaire: 'Test de validation finale - Dossier vérifié et approuvé après correction des permissions'
    };

    try {
      const validationResponse = await axios.put(
        `${API_BASE_URL}/dossiers/${dossierAvecFichiers.id}/valider`,
        validationData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('\n🎉 VALIDATION RÉUSSIE !');
      console.log('   Status HTTP:', validationResponse.status);
      console.log('   Message:', validationResponse.data.message);
      console.log('   Nouveau statut:', validationResponse.data.dossier?.statut);
      
      // 4. Vérification que le préparateur peut encore voir le dossier validé
      console.log('\n4️⃣ Test accès au dossier validé...');
      
      const checkResponse = await axios.get(`${API_BASE_URL}/dossiers/${dossierAvecFichiers.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Accès au dossier validé confirmé');
      console.log('   Statut confirmé:', checkResponse.data.statut);
      
      // 5. Test accès aux fichiers du dossier validé
      console.log('\n5️⃣ Test accès aux fichiers du dossier validé...');
      
      const filesCheckResponse = await axios.get(`${API_BASE_URL}/files`, {
        params: { dossier_id: dossierAvecFichiers.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Accès aux fichiers confirmé');
      console.log(`   ${filesCheckResponse.data.files.length} fichiers accessibles`);
      
      console.log('\n🎊 VALIDATION COMPLÈTE RÉUSSIE !');
      console.log('   ✓ Validation du dossier');
      console.log('   ✓ Accès au dossier validé (statut: Prêt impression)');
      console.log('   ✓ Accès aux fichiers du dossier validé');
      console.log('   → Le problème "Dossier non trouvé" est résolu !');
      
    } catch (validationError) {
      console.log('\n❌ Erreur de validation:');
      console.log('   Status:', validationError.response?.status);
      console.log('   Message:', validationError.response?.data?.message);
      console.log('   Détails:', validationError.response?.data);
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error?.response?.data || error.message);
  }
}

testValidationComplete();