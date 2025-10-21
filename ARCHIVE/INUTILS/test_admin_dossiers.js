#!/usr/bin/env node

const axios = require('axios');

async function testAdminDossiers() {
  console.log('👑 TEST ADMIN - DOSSIERS');
  console.log('=' .repeat(50));
  
  try {
    // 1. Test connexion admin
    console.log('\n1. Test connexion admin...');
    const adminLoginResp = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@evocomprint.com',
      password: 'admin123'
    });
    
    if (!adminLoginResp.data.token) {
      throw new Error('Pas de token admin reçu');
    }
    
    const adminToken = adminLoginResp.data.token;
    const adminUser = adminLoginResp.data.user;
    
    console.log(`   ✅ Admin connecté: ${adminUser.nom} (${adminUser.role})`);
    console.log(`   🔑 Token: ${adminToken.substring(0, 20)}...`);

    // 2. Test API dossiers avec compte admin
    console.log('\n2. Test API dossiers avec compte admin...');
    const dossiersResp = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log(`   ✅ Dossiers admin: ${dossiersResp.data.dossiers.length} dossiers`);
    console.log(`   📊 Role API: ${dossiersResp.data.user_role}`);

    // 3. Affichage des dossiers pour admin
    console.log('\n3. Dossiers visibles pour admin:');
    dossiersResp.data.dossiers.forEach((d, i) => {
      console.log(`   ${i+1}. ${d.client.padEnd(20)} | ${d.statut.padEnd(15)} | ${d.numero || 'N/A'}`);
    });

    // 4. Test via proxy frontend avec admin
    console.log('\n4. Test via proxy frontend avec token admin...');
    const proxyResp = await axios.get('http://localhost:3001/api/dossiers', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log(`   ✅ Proxy frontend: ${proxyResp.data.dossiers.length} dossiers`);

    console.log('\n✅ ADMIN PEUT ACCÉDER AUX DOSSIERS');
    console.log('━'.repeat(50));
    console.log('📱 INSTRUCTIONS POUR ADMIN:');
    console.log('   1. Allez sur: http://localhost:3001');
    console.log('   2. Connectez-vous: admin@evocomprint.com / admin123');
    console.log('   3. Vérifiez le dashboard admin');
    console.log('   4. Cliquez sur "Voir les dossiers" ou naviguez vers Dossiers');
    console.log('   5. Ouvrez F12 pour voir les logs de debug');

  } catch (error) {
    console.error('\n❌ ERREUR ADMIN:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    
    if (error.response?.status === 401) {
      console.log('\n💡 Le compte admin n\'existe peut-être pas');
      console.log('   Essayez avec le compte preparateur pour tester');
    }
  }
}

testAdminDossiers().catch(console.error);