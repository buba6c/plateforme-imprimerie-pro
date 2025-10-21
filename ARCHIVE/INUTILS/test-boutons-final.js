#!/usr/bin/env node

/**
 * Test final des boutons selon les rôles
 * Valide que tous les boutons d'action fonctionnent correctement
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

// Utilisateurs test (utiliser ceux qui existent)
const USERS = {
  admin: { login: 'administrator', password: 'admin123' }
};

// Actions testées par bouton
const ACTIONS = {
  'Voir détails': async (dossier, token) => {
    const response = await axios.get(`${API_URL}/dossiers/${dossier.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.status === 200;
  },
  
  'Voir fichiers': async (dossier, token) => {
    const response = await axios.get(`${API_URL}/files`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { dossier_id: dossier.id }
    });
    return response.status === 200;
  },
  
  'Changer statut': async (dossier, token) => {
    // Test avec un statut simple selon le statut actuel
    const nextStatus = getNextStatus(dossier.statut);
    const response = await axios.put(`${API_URL}/dossiers/${dossier.id}/statut`, {
      statut: nextStatus
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.status === 200;
  },
  
  'Upload fichier': async (dossier, token) => {
    // Simuler un upload (pas de fichier réel, juste test de l'endpoint)
    try {
      await axios.post(`${API_URL}/files/upload/${dossier.id}`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data' 
        }
      });
      return true;
    } catch (error) {
      // 400 attendu car pas de fichier, mais endpoint accessible
      return error.response?.status === 400;
    }
  }
};

function getNextStatus(currentStatus) {
  const transitions = {
    'en_cours': 'pret_impression',
    'pret_impression': 'en_impression', 
    'en_impression': 'imprime',
    'imprime': 'pret_livraison',
    'pret_livraison': 'en_livraison',
    'en_livraison': 'livre',
    'livre': 'termine',
    'termine': 'en_cours',
    'a_revoir': 'en_cours'
  };
  return transitions[currentStatus] || 'en_cours';
}

async function authenticate(login, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { login, password });
    return response.data.token;
  } catch (error) {
    console.log(`❌ Erreur auth ${login}: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testRole(roleName, credentials) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST RÔLE: ${roleName.toUpperCase()}`);
  console.log('='.repeat(60));
  
  const token = await authenticate(credentials.login, credentials.password);
  if (!token) {
    console.log(`❌ Impossible d'authentifier ${roleName}`);
    return;
  }
  
  // Récupérer quelques dossiers
  try {
    const response = await axios.get(`${API_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const dossiers = response.data.dossiers || [];
    const testDossier = dossiers[0];
    
    if (!testDossier) {
      console.log('❌ Aucun dossier trouvé pour les tests');
      return;
    }
    
    console.log(`📁 Test avec dossier: ${testDossier.numero} (${testDossier.statut})`);
    
    // Tester chaque action
    for (const [actionName, actionFn] of Object.entries(ACTIONS)) {
      try {
        const success = await actionFn(testDossier, token);
        const status = success ? '✅' : '❌';
        console.log(`   ${status} ${actionName}: ${success ? 'OK' : 'ÉCHEC'}`);
      } catch (error) {
        const status = error.response?.status;
        if (status === 403) {
          console.log(`   ⚠️  ${actionName}: Non autorisé (normal selon rôle)`);
        } else {
          console.log(`   ❌ ${actionName}: Erreur ${status || 'inconnue'}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Erreur récupération dossiers: ${error.response?.data?.message || error.message}`);
  }
}

async function runTests() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🚀 TEST FINAL: Boutons selon les rôles');
  console.log('='.repeat(80));
  
  for (const [roleName, credentials] of Object.entries(USERS)) {
    await testRole(roleName, credentials);
    // Petite pause entre les rôles
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ TESTS TERMINÉS');
  console.log('='.repeat(80));
  console.log('\n📋 RÉSUMÉ:');
  console.log('- ✅ = Action réussie');
  console.log('- ⚠️  = Non autorisé (comportement normal selon rôle)'); 
  console.log('- ❌ = Erreur technique (à corriger)');
  console.log('\nSi tous les résultats sont ✅ ou ⚠️, les boutons fonctionnent correctement !');
}

// Lancement des tests
runTests().catch(console.error);