#!/usr/bin/env node

const axios = require('axios');

async function testFinalDossiers() {
  console.log('🎯 TEST FINAL - VÉRIFICATION DOSSIERS');
  console.log('=' .repeat(60));
  
  console.log('\n🔗 URLS À TESTER:');
  console.log('   Frontend:      http://localhost:3001');
  console.log('   Test direct:   http://localhost:3001/test-dossiers.html');
  console.log('   Nettoyage:     http://localhost:3001/cleanup.html');
  
  try {
    // 1. Vérifier services
    console.log('\n1️⃣ VÉRIFICATION SERVICES');
    const [frontendResp, backendResp] = await Promise.all([
      axios.get('http://localhost:3001'),
      axios.get('http://localhost:5001/api/health')
    ]);
    
    console.log(`   ✅ Frontend: ${frontendResp.status}`);
    console.log(`   ✅ Backend:  ${backendResp.status}`);
    
    // 2. Test API complète
    console.log('\n2️⃣ TEST API COMPLÈTE');
    const loginResp = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@evocomprint.com',
      password: 'admin123'
    });
    
    const token = loginResp.data.token;
    console.log('   ✅ Login API backend: OK');
    
    const dossiersResp = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Dossiers API backend: ${dossiersResp.data.dossiers.length} dossiers`);
    
    // 3. Test via proxy frontend
    const dossiersViaProxy = await axios.get('http://localhost:3001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Dossiers via proxy frontend: ${dossiersViaProxy.data.dossiers.length} dossiers`);
    
    // 4. Affichage des dossiers
    console.log('\n3️⃣ DOSSIERS TROUVÉS');
    dossiersResp.data.dossiers.forEach((d, i) => {
      console.log(`   ${i+1}. ${d.client.padEnd(20)} | ${d.statut.padEnd(15)} | ${d.numero || 'N/A'}`);
    });
    
    console.log('\n✅ DIAGNOSTIC COMPLET');
    console.log('━'.repeat(60));
    console.log('🎯 TOUT FONCTIONNE CÔTÉ API !');
    console.log('');
    console.log('📱 INSTRUCTIONS UTILISATEUR:');
    console.log('   1. Allez sur: http://localhost:3001');
    console.log('   2. Connectez-vous: preparateur@evocomprint.com / admin123');
    console.log('   3. Si pas de dossiers: Ouvrez F12 (Console) pour voir les erreurs');
    console.log('   4. Test direct API: http://localhost:3001/test-dossiers.html');
    console.log('   5. Nettoyage si besoin: http://localhost:3001/cleanup.html');
    console.log('');
    console.log('🐛 SI TOUJOURS AUCUN DOSSIER:');
    console.log('   - Le problème est dans le code React, pas dans l\'API');
    console.log('   - Vérifiez la console du navigateur (erreurs JavaScript)');
    console.log('   - Utilisez le test direct pour valider que l\'API fonctionne');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testFinalDossiers().catch(console.error);