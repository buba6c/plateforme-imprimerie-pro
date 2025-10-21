#!/usr/bin/env node

const axios = require('axios');

async function debugFrontendValidation() {
  try {
    console.log('🔍 Debug validation frontend - Simulation exacte...\n');

    // 1. Authentification préparateur
    const authResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie');
    console.log('   User ID:', authResponse.data.user.id);
    console.log('   Role:', authResponse.data.user.role);

    // 2. Récupérer les dossiers visibles pour ce préparateur
    console.log('\n📋 Récupération des dossiers visibles...');
    const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`   Dossiers trouvés: ${dossiersResponse.data.dossiers.length}`);
    
    // Afficher les premiers dossiers pour que vous puissiez identifier celui que vous utilisez
    console.log('\n📁 Premiers dossiers disponibles:');
    dossiersResponse.data.dossiers.slice(0, 5).forEach((d, i) => {
      console.log(`   ${i+1}. ${d.id.substring(0,8)}... - ${d.client} - Statut: ${d.statut}`);
    });

    // 3. Demander quel dossier vous utilisez ou prendre le premier en cours
    let testDossier = dossiersResponse.data.dossiers.find(d => d.statut === 'en_cours');
    
    if (!testDossier) {
      console.log('⚠️ Aucun dossier en cours trouvé');
      return;
    }

    console.log(`\n🎯 Test sur dossier: ${testDossier.id}`);
    console.log(`   Client: ${testDossier.client}`);
    console.log(`   Statut: ${testDossier.statut}`);
    
    // 4. Vérifier les fichiers de ce dossier
    console.log('\n📄 Vérification des fichiers...');
    try {
      const filesResponse = await axios.get('http://localhost:5001/api/files', {
        params: { dossier_id: testDossier.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`   Fichiers trouvés: ${filesResponse.data.files.length}`);
      
      if (filesResponse.data.files.length === 0) {
        console.log('⚠️ Ce dossier n\'a pas de fichiers. Upload requis pour validation.');
        return;
      }
      
      filesResponse.data.files.forEach((f, i) => {
        console.log(`   ${i+1}. ${f.nom_original || f.nom} (${f.taille_originale || f.taille} bytes)`);
      });
      
    } catch (filesError) {
      console.log('❌ Erreur accès fichiers:', filesError.response?.data?.message || filesError.message);
      return;
    }

    // 5. Test de validation exactement comme le frontend
    console.log('\n🔄 Test de validation (comme frontend)...');
    
    try {
      const validationResponse = await axios.put(
        `http://localhost:5001/api/dossiers/${testDossier.id}/valider`,
        { commentaire: 'Test validation via debug frontend' },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('🎉 VALIDATION RÉUSSIE !');
      console.log('   Status HTTP:', validationResponse.status);
      console.log('   Message:', validationResponse.data.message);
      console.log('   Nouveau statut:', validationResponse.data.dossier?.statut);
      
    } catch (validationError) {
      console.log('\n❌ ERREUR DE VALIDATION (comme vous l\'avez):');
      console.log('   Status HTTP:', validationError.response?.status);
      console.log('   Message:', validationError.response?.data?.message);
      console.log('   Code:', validationError.response?.data?.code);
      console.log('   Détails:', JSON.stringify(validationError.response?.data, null, 2));
      
      // Diagnostic approfondi
      if (validationError.response?.status === 404) {
        console.log('\n🔍 DIAGNOSTIC 404 - Dossier non trouvé:');
        
        // Test direct d'accès au dossier
        try {
          const directResponse = await axios.get(`http://localhost:5001/api/dossiers/${testDossier.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('   ✅ Accès direct au dossier: OK');
          console.log('   Statut actuel:', directResponse.data.statut);
        } catch (directError) {
          console.log('   ❌ Accès direct échoue aussi:', directError.response?.data?.message);
        }
        
        // Vérifier si l'ID est correct
        console.log('   ID utilisé:', testDossier.id);
        console.log('   Longueur ID:', testDossier.id.length);
        console.log('   Format UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testDossier.id));
      }
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error?.response?.data || error.message);
  }
}

debugFrontendValidation();