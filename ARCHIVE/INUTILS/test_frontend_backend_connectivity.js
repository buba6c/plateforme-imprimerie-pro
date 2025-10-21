#!/usr/bin/env node
/**
 * Diagnostic connectivité Frontend -> Backend
 */

const axios = require('axios');

async function testConnectivite() {
  console.log('🔍 Test de connectivité Frontend -> Backend...\n');
  
  const tests = [
    { name: 'Health Check', url: 'http://localhost:5001/api/health' },
    { name: 'API Base', url: 'http://localhost:5001/api' },
    { name: 'Workflow Meta', url: 'http://localhost:5001/api/workflow/meta' },
    { name: 'Dossiers (sans auth)', url: 'http://localhost:5001/api/dossiers' },
  ];
  
  for (const test of tests) {
    try {
      console.log(`📡 Test: ${test.name}`);
      
      const response = await axios.get(test.url, { 
        timeout: 5000,
        validateStatus: () => true // Accepter tous les codes de statut
      });
      
      console.log(`   ✅ Status: ${response.status}`);
      
      if (response.status === 200) {
        const data = typeof response.data === 'object' 
          ? JSON.stringify(response.data).substring(0, 100) + '...'
          : response.data.substring(0, 100) + '...';
        console.log(`   📄 Data: ${data}`);
      } else if (response.status === 401) {
        console.log(`   🔒 Authentification requise (normal)`);
      } else {
        console.log(`   ⚠️  Réponse: ${response.data?.message || response.statusText}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   🔌 Backend non accessible - vérifier si le serveur est démarré');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   ⏱️  Timeout - backend lent ou bloqué');
      }
    }
    
    console.log('');
  }
  
  // Test depuis le frontend
  console.log('🌐 Test depuis le frontend (port 3001)...');
  
  try {
    const frontendResponse = await axios.get('http://localhost:3001', {
      timeout: 3000
    });
    
    console.log(`✅ Frontend accessible: ${frontendResponse.status}`);
    
    if (frontendResponse.data.includes('id="root"')) {
      console.log('✅ React app structure détectée');
    }
    
  } catch (error) {
    console.log(`❌ Frontend inaccessible: ${error.message}`);
  }
  
  console.log('\n📋 Résumé du diagnostic:');
  console.log('- Backend: port 5001');
  console.log('- Frontend: port 3001'); 
  console.log('- Configuration API: REACT_APP_API_URL=http://localhost:5001/api');
  console.log('- Configuration Socket: REACT_APP_SOCKET_URL=http://localhost:5001');
}

if (require.main === module) {
  testConnectivite().catch(console.error);
}

module.exports = { testConnectivite };