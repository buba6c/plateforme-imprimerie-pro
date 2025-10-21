#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testValidationFrontendFlow() {
  try {
    console.log('🌐 Test du flux de validation Frontend...\n');

    // 1. Authentification avec un préparateur
    console.log('1️⃣ Authentification avec préparateur...');
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie - Rôle:', authResponse.data.user.role);

    // 2. Récupération des dossiers en cours
    console.log('\n2️⃣ Récupération des dossiers en cours...');
    const dossiersResponse = await axios.get(`${API_BASE_URL}/dossiers?statut=en_cours`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const dossiersEnCours = dossiersResponse.data.dossiers.filter(d => d.statut === 'en_cours');
    console.log(`📋 Dossiers en cours trouvés: ${dossiersEnCours.length}`);

    if (dossiersEnCours.length === 0) {
      console.log('ℹ️ Aucun dossier en cours à valider');
      return;
    }

    // 3. Test sur le premier dossier en cours
    const dossier = dossiersEnCours[0];
    console.log('\n3️⃣ Test de validation sur dossier:', dossier.id);
    console.log('   Client:', dossier.client);
    console.log('   Créé par:', dossier.created_by || 'NULL (legacy data)');

    // 4. Vérification des fichiers (comme le ferait le frontend)
    console.log('\n4️⃣ Vérification des fichiers...');
    const filesResponse = await axios.get(`${API_BASE_URL}/files`, {
      params: { dossier_id: dossier.id },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const files = filesResponse.data.files;
    console.log(`📁 Fichiers trouvés: ${files.length}`);
    
    if (files.length === 0) {
      console.log('⚠️ Aucun fichier - validation impossible');
      return;
    }

    // 5. Simulation de la validation comme le ferait le frontend
    console.log('\n5️⃣ Simulation validation frontend...');
    
    const validationData = {
      commentaire: 'Validation via test frontend - Dossier vérifié et approuvé'
    };

    try {
      const validationResponse = await axios.put(
        `${API_BASE_URL}/dossiers/${dossier.id}/valider`,
        validationData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('🎉 VALIDATION FRONTEND RÉUSSIE !');
      console.log('   Status:', validationResponse.status);
      console.log('   Message:', validationResponse.data.message);
      console.log('   Nouveau statut:', validationResponse.data.dossier?.statut);
      
      // 6. Vérification que le changement a bien été appliqué
      console.log('\n6️⃣ Vérification du changement...');
      const checkResponse = await axios.get(`${API_BASE_URL}/dossiers/${dossier.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Statut confirmé dans la base:', checkResponse.data.statut);
      
    } catch (validationError) {
      console.log('❌ Erreur de validation frontend:');
      console.log('   Status:', validationError.response?.status);
      console.log('   Message:', validationError.response?.data?.message);
      console.log('   Détails:', validationError.response?.data);
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error?.response?.data || error.message);
  }
}

testValidationFrontendFlow();