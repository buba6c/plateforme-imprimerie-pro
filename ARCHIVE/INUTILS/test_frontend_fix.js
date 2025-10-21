#!/usr/bin/env node

const axios = require('axios');

async function testFrontendFix() {
  console.log('🧪 TEST CORRECTION AFFICHAGE DOSSIERS');
  console.log('=' .repeat(50));
  
  try {
    // 1. Test frontend accessible
    console.log('\n1. Test accessibilité frontend...');
    const frontendResponse = await axios.get('http://localhost:3001');
    console.log(`   ✅ Frontend accessible (${frontendResponse.status})`);

    // 2. Test API backend direct
    console.log('\n2. Test API backend...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@evocomprint.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('   ✅ Connexion API réussie');

    const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`   ✅ API dossiers: ${dossiersResponse.data.dossiers.length} dossiers trouvés`);
    
    // 3. Afficher quelques dossiers pour vérification
    if (dossiersResponse.data.dossiers.length > 0) {
      console.log('\n3. Exemples de dossiers:');
      dossiersResponse.data.dossiers.slice(0, 3).forEach((dossier, i) => {
        console.log(`   ${i+1}. ${dossier.client} - ${dossier.statut} (${dossier.numero || 'N/A'})`);
      });
    }

    console.log('\n✅ CORRECTION APPLIQUÉE - Les dossiers devraient maintenant s\'afficher !');
    console.log('\n🌐 Testez sur: http://localhost:3001');
    console.log('🧹 Si problème persiste: http://localhost:3001/cleanup.html?auto=1');

  } catch (error) {
    console.error('\n❌ ERREUR:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
  }
}

testFrontendFix().catch(console.error);