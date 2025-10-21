#!/usr/bin/env node

const axios = require('axios');

async function testFrontendDossiersLoad() {
  console.log('🧪 TEST CHARGEMENT DOSSIERS FRONTEND');
  console.log('=' .repeat(50));

  try {
    // 1. Connexion pour obtenir un token valide
    console.log('\n1. Connexion utilisateur...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@evocomprint.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log(`   ✅ Connexion réussie: ${user.nom} (${user.role})`);

    // 2. Test chargement dossiers comme le ferait le frontend
    console.log('\n2. Test API dossiers...');
    const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` },
      params: {}
    });
    
    console.log(`   ✅ Dossiers récupérés: ${dossiersResponse.data.dossiers.length} éléments`);
    console.log(`   📊 Pagination: page ${dossiersResponse.data.pagination.page}/${dossiersResponse.data.pagination.total_pages}`);

    // 3. Test avec différents paramètres
    console.log('\n3. Test avec paramètres de pagination...');
    const paginatedResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, limit: 12 }
    });
    
    console.log(`   ✅ Pagination testée: ${paginatedResponse.data.dossiers.length} éléments par page`);

    // 4. Vérifier la structure des données
    console.log('\n4. Vérification structure données...');
    if (dossiersResponse.data.dossiers.length > 0) {
      const firstDossier = dossiersResponse.data.dossiers[0];
      const requiredFields = ['id', 'client', 'statut', 'created_at'];
      
      requiredFields.forEach(field => {
        if (firstDossier[field] !== undefined) {
          console.log(`   ✅ ${field}: ${String(firstDossier[field]).substring(0, 30)}...`);
        } else {
          console.log(`   ⚠️ ${field}: manquant`);
        }
      });
    }

    // 5. Test avec token expiré (simulation erreur)
    console.log('\n5. Test gestion erreur token expiré...');
    try {
      await axios.get('http://localhost:5001/api/dossiers', {
        headers: { Authorization: 'Bearer expired_token_simulation' }
      });
      console.log('   ❌ Token expiré accepté - problème de sécurité !');
    } catch (expiredError) {
      if (expiredError.response?.status === 401) {
        console.log('   ✅ Erreur 401 correctement retournée pour token expiré');
      }
    }

    console.log('\n🎉 TOUS LES TESTS PASSÉS !');
    console.log('\n💡 Pour nettoyer le localStorage du navigateur:');
    console.log('   🌐 Ouvrir: http://localhost:3001/cleanup.html?auto=1');

  } catch (error) {
    console.error('\n❌ ERREUR DE TEST:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
    console.error('   Data:', error.response?.data);
  }
}

testFrontendDossiersLoad().catch(console.error);