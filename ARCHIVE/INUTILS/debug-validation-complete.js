#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');

async function debugValidationProblem() {
  try {
    console.log('🔍 Debug du problème de validation "Dossier non trouvé"...\n');

    // 1. Auth
    const auth = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    
    const token = auth.data.token;
    console.log('✅ Authentification réussie');

    // 2. Créer un nouveau dossier pour test
    console.log('\n📋 Création d\'un nouveau dossier pour test...');
    const newDossier = await axios.post('http://localhost:5001/api/dossiers', {
      client: 'Test Debug Validation',
      type_formulaire: 'roland',
      titre: 'Dossier de test pour reproduction du bug'
    }, { headers: { Authorization: `Bearer ${token}` } });
    
    const dossierId = newDossier.data.dossier.id;
    console.log(`✅ Dossier créé: ${dossierId}`);
    console.log(`   Client: ${newDossier.data.dossier.client}`);
    console.log(`   Statut: ${newDossier.data.dossier.statut}`);

    // 3. Upload un fichier sur ce dossier
    console.log('\n📤 Upload d\'un fichier...');
    const form = new FormData();
    form.append('files', Buffer.from('Contenu du fichier de test pour validation'), {
      filename: 'test-validation-debug.txt',
      contentType: 'text/plain'
    });
    
    const uploadResponse = await axios.post(`http://localhost:5001/api/files/upload/${dossierId}`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('✅ Fichier uploadé:', uploadResponse.data.message);

    // 4. Vérifier que le dossier est bien accessible
    console.log('\n🔍 Vérification d\'accès au dossier...');
    const checkDossier = await axios.get(`http://localhost:5001/api/dossiers/${dossierId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Accès au dossier: OK');
    console.log(`   Statut actuel: ${checkDossier.data.statut}`);

    // 5. Tentative de validation - Ici on va capturer l'erreur
    console.log('\n🔄 Tentative de validation...');
    
    try {
      const validationResponse = await axios.put(
        `http://localhost:5001/api/dossiers/${dossierId}/valider`,
        { commentaire: 'Test validation - reproduction du bug' },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('🎉 VALIDATION RÉUSSIE !');
      console.log('   Message:', validationResponse.data.message);
      console.log('   Nouveau statut:', validationResponse.data.dossier?.statut);
      console.log('\n✅ Le problème ne se reproduit pas avec ce test automatique');
      
    } catch (validationError) {
      console.log('\n❌ ERREUR DE VALIDATION REPRODUITE !');
      console.log('   Status HTTP:', validationError.response?.status);
      console.log('   Message:', validationError.response?.data?.message);
      console.log('   Code:', validationError.response?.data?.code);
      
      if (validationError.response?.data) {
        console.log('\n📄 Détails complets de l\'erreur:');
        console.log(JSON.stringify(validationError.response.data, null, 2));
      }

      // Analyse du problème
      if (validationError.response?.status === 404) {
        console.log('\n🔍 ANALYSE du "Dossier non trouvé" (404):');
        console.log('   → Le dossier existe mais n\'est pas accessible en validation');
        console.log('   → Problème probable: logique d\'autorisation dans la route de validation');
        
        // Test d'accès direct pour confirmer
        try {
          await axios.get(`http://localhost:5001/api/dossiers/${dossierId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('   → Accès direct au dossier: ✅ OK');
          console.log('   → Le problème est spécifique à la route de validation');
        } catch {
          console.log('   → Accès direct au dossier: ❌ Échoue aussi');
        }
      }
    }

    // 6. Information pour reproduire manuellement
    console.log(`\n📝 Pour reproduire manuellement:`);
    console.log(`   1. Ouvrez http://localhost:3001`);
    console.log(`   2. Connectez-vous avec preparateur@imprimerie.local / admin123`);
    console.log(`   3. Cherchez le dossier "Test Debug Validation"`);
    console.log(`   4. Cliquez sur "Voir" puis "Valider"`);
    console.log(`   5. Observez si l'erreur "Dossier non trouvé" apparaît`);

  } catch (error) {
    console.log('\n❌ Erreur générale:', error?.response?.data || error.message);
    
    if (error?.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugValidationProblem();