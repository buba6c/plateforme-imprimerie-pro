#!/usr/bin/env node

const axios = require('axios');

async function debugFrontendAuth() {
  console.log('🔍 DEBUG AUTHENTIFICATION FRONTEND');
  console.log('=' .repeat(50));
  
  try {
    // 1. Vérifier le localStorage (simulation)
    console.log('\n1. Test connexion API...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@evocomprint.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    
    console.log(`   ✅ Connexion OK - Token: ${token.substring(0, 20)}...`);
    console.log(`   👤 Utilisateur: ${user.nom} (${user.role})`);

    // 2. Test API dossiers avec token
    console.log('\n2. Test API dossiers avec token...');
    const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    
    console.log(`   ✅ API dossiers: ${dossiersResponse.data.dossiers.length} dossiers`);
    console.log(`   📊 Status code: ${dossiersResponse.status}`);

    // 3. Vérifier la structure de réponse
    console.log('\n3. Structure des dossiers:');
    if (dossiersResponse.data.dossiers.length > 0) {
      const firstDossier = dossiersResponse.data.dossiers[0];
      console.log('   Premier dossier:');
      console.log(`   - ID: ${firstDossier.id}`);
      console.log(`   - Client: ${firstDossier.client}`);
      console.log(`   - Statut: ${firstDossier.statut}`);
      console.log(`   - Créé: ${firstDossier.created_at}`);
    }

    // 4. Test direct frontend si possible
    console.log('\n4. Test frontend direct...');
    try {
      const frontendResponse = await axios.get('http://localhost:3001', {
        timeout: 5000
      });
      console.log(`   ✅ Frontend accessible (${frontendResponse.status})`);
      
      // Vérifier si le frontend a des erreurs dans les logs
      console.log('\n💡 INSTRUCTIONS POUR DÉBOGUER:');
      console.log('   1. Ouvrez http://localhost:3001 dans votre navigateur');
      console.log('   2. Connectez-vous avec preparateur@evocomprint.com / admin123');
      console.log('   3. Ouvrez les outils de développeur (F12)');
      console.log('   4. Regardez l\'onglet Console pour les erreurs JavaScript');
      console.log('   5. Regardez l\'onglet Network pour les requêtes API échouées');
      
    } catch (frontendError) {
      console.log(`   ❌ Frontend non accessible: ${frontendError.message}`);
    }

    console.log('\n✅ BACKEND FONCTIONNEL - Problème probablement côté frontend');

  } catch (error) {
    console.error('\n❌ ERREUR:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SOLUTION: Le backend n\'est pas démarré');
      console.log('   Démarrez avec: pm2 restart plateforme-backend');
    }
  }
}

debugFrontendAuth().catch(console.error);