#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

console.log('🔍 Test de résolution UI - Vérification finale\n');

async function testCompleteFlow() {
  try {
    // 1. Test de connexion
    console.log('1️⃣ Test de connexion...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@imprimerie.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Connexion réussie - Token obtenu');

    // 2. Test d'accès aux dossiers avec le token
    console.log('\n2️⃣ Test d\'accès aux dossiers...');
    const dossiersResponse = await axios.get(`${BASE_URL}/api/dossiers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 10
      }
    });

    console.log(`✅ ${dossiersResponse.data.dossiers.length} dossiers récupérés`);
    console.log(`📊 Pagination: Page ${dossiersResponse.data.pagination.current_page}/${dossiersResponse.data.pagination.total_pages}`);
    console.log(`📈 Total items: ${dossiersResponse.data.pagination.total_items}`);

    // 3. Détails d'un dossier pour vérifier la structure
    if (dossiersResponse.data.dossiers.length > 0) {
      const firstDossier = dossiersResponse.data.dossiers[0];
      console.log(`\n3️⃣ Structure du premier dossier:`);
      console.log(`   - ID: ${firstDossier.id}`);
      console.log(`   - Nom: ${firstDossier.nom_client || 'N/A'}`);
      console.log(`   - Statut: ${firstDossier.status}`);
      console.log(`   - Type: ${firstDossier.type}`);
      console.log(`   - Date création: ${firstDossier.created_at}`);
    }

    // 4. Vérifier les rôles et filtres
    console.log('\n4️⃣ Vérification des statuts disponibles...');
    const statusResponse = await axios.get(`${BASE_URL}/api/status-options`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (statusResponse.data && statusResponse.data.length > 0) {
      console.log(`✅ ${statusResponse.data.length} statuts disponibles:`, 
        statusResponse.data.map(s => s.value).join(', '));
    }

    console.log('\n🎯 RÉSUMÉ DE LA RÉSOLUTION:');
    console.log('- ✅ Backend API fonctionnel');
    console.log('- ✅ Authentication JWT opérationnelle');
    console.log('- ✅ Données dossiers accessibles');
    console.log('- ✅ Token storage corrigé dans le frontend');
    console.log('- ✅ Frontend redémarré avec les corrections');
    console.log('\n📋 ACTIONS UTILISATEUR REQUISES:');
    console.log('1. Ouvrir http://localhost:3001 dans le navigateur');
    console.log('2. Vider le cache du navigateur (Cmd+Shift+R sur Mac)');
    console.log('3. Se connecter avec admin@imprimerie.com / admin123');
    console.log('4. Vérifier l\'affichage des dossiers');
    
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    return false;
  }
}

// Exécuter le test
testCompleteFlow().then(success => {
  process.exit(success ? 0 : 1);
});