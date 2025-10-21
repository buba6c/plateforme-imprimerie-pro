#!/usr/bin/env node

/**
 * Test de validation complète des boutons d'actions pour tous les rôles
 * Vérifie que toutes les corrections d'API routes sont appliquées
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Configuration des tests par rôle
const ROLE_TESTS = {
  admin: {
    email: 'admin@imprimerie.local',
    password: 'test123',
    actions: ['changeStatus', 'validateDossier', 'scheduleDelivery', 'confirmDelivery'],
    expectedSuccess: true
  },
  preparateur: {
    email: 'preparateur@imprimerie.local', 
    password: 'test123',
    actions: ['changeStatus', 'validateDossier'],
    expectedSuccess: true
  },
  imprimeur_roland: {
    email: 'roland@imprimerie.local',
    password: 'test123', 
    actions: ['changeStatus'],
    expectedSuccess: true
  },
  imprimeur_xerox: {
    email: 'xerox@imprimerie.local',
    password: 'test123',
    actions: ['changeStatus'],
    expectedSuccess: true
  },
  livreur: {
    email: 'livreur@imprimerie.local',
    password: 'test123',
    actions: ['changeStatus', 'scheduleDelivery', 'confirmDelivery'],
    expectedSuccess: true
  }
};

const TEST_DOSSIER_ID = '0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1';

// Simulation des fonctions API corrigées
const simulateApiCalls = {
  changeStatus: async (token, dossierId) => {
    console.log('  📤 Test changeStatus -> PATCH /dossiers/ID/status (permission: change_status)');
    try {
      const response = await axios.patch(
        `${BASE_URL}/dossiers/${dossierId}/status`,
        { status: 'en_cours', comment: 'Test correction boutons' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },

  validateDossier: async (token, dossierId) => {
    console.log('  📤 Test validateDossier -> PUT /dossiers/ID/valider (permission: preparateur role)');
    try {
      const response = await axios.put(
        `${BASE_URL}/dossiers/${dossierId}/valider`,
        { commentaire: 'Test validation' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },

  scheduleDelivery: async (token, dossierId) => {
    console.log('  📤 Test scheduleDelivery -> PATCH /dossiers/ID/status (permission: change_status)');
    try {
      const response = await axios.patch(
        `${BASE_URL}/dossiers/${dossierId}/status`,
        { 
          status: 'en_livraison', 
          comment: 'Test programmation livraison',
          date_livraison_prevue: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },

  confirmDelivery: async (token, dossierId) => {
    console.log('  📤 Test confirmDelivery -> PATCH /dossiers/ID/status (permission: change_status)');
    try {
      const response = await axios.patch(
        `${BASE_URL}/dossiers/${dossierId}/status`,
        { 
          status: 'termine', 
          comment: 'Test confirmation livraison',
          date_livraison: new Date().toISOString(),
          mode_paiement: 'cash',
          montant_cfa: 25000
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }
};

async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return { success: true, token: response.data.token, user: response.data.user };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

async function testRoleActions(role, config) {
  console.log(`\n🧪 Test du rôle: ${role.toUpperCase()}`);
  console.log(`   Email: ${config.email}`);
  
  // 1. Login
  const loginResult = await login(config.email, config.password);
  if (!loginResult.success) {
    console.log(`   ❌ Échec login: ${JSON.stringify(loginResult.error)}`);
    return false;
  }
  
  console.log(`   ✅ Login réussi - User: ${loginResult.user.nom} (${loginResult.user.role})`);
  
  let allTestsPassed = true;
  
  // 2. Test des actions
  for (const action of config.actions) {
    console.log(`\n   🎯 Test action: ${action}`);
    
    const result = await simulateApiCalls[action](loginResult.token, TEST_DOSSIER_ID);
    
    if (result.success) {
      console.log(`   ✅ ${action} réussi !`);
      console.log(`      Réponse: ${JSON.stringify(result.data, null, 2).substring(0, 100)}...`);
    } else {
      console.log(`   ❌ ${action} échoué: ${JSON.stringify(result.error)}`);
      allTestsPassed = false;
    }
  }
  
  return allTestsPassed;
}

async function runAllTests() {
  console.log('🚀 DÉBUT DU TEST COMPLET DES CORRECTIONS DE BOUTONS POUR TOUS LES RÔLES');
  console.log('=' * 70);
  
  // Vérification serveur
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Serveur backend accessible');
  } catch (error) {
    console.log('❌ Serveur backend non accessible. Démarrez le serveur avec: cd backend && node server.js');
    process.exit(1);
  }
  
  let overallSuccess = true;
  const results = {};
  
  // Test de chaque rôle
  for (const [role, config] of Object.entries(ROLE_TESTS)) {
    const success = await testRoleActions(role, config);
    results[role] = success;
    if (!success) overallSuccess = false;
  }
  
  // Résumé final
  console.log('\n📊 RÉSUMÉ FINAL DES TESTS');
  console.log('=' * 50);
  
  for (const [role, success] of Object.entries(results)) {
    const status = success ? '✅ RÉUSSI' : '❌ ÉCHEC';
    console.log(`${role.padEnd(20)} : ${status}`);
  }
  
  console.log('\n🎯 CONCLUSION:');
  if (overallSuccess) {
    console.log('✅ TOUS LES BOUTONS D\'ACTIONS FONCTIONNENT CORRECTEMENT POUR TOUS LES RÔLES !');
    console.log('   Les corrections d\'API routes ont été appliquées avec succès.');
  } else {
    console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ - VÉRIFIEZ LES ERREURS CI-DESSUS');
  }
  
  process.exit(overallSuccess ? 0 : 1);
}

// Exécution
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Erreur inattendue:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests, testRoleActions, simulateApiCalls };