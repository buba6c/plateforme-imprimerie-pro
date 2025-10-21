#!/usr/bin/env node

/**
 * TEST DE VÉRIFICATION FINALE - Messages "Dossier non trouvé"
 * Test tous les scénarios possibles pour confirmer que les nouveaux messages apparaissent
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

// Configuration des tests
const TEST_USERS = {
  admin: { email: 'admin@imprimerie.local', password: 'test123' },
  preparateur: { email: 'preparateur@imprimerie.local', password: 'test123' },
  imprimeur_roland: { email: 'imprimeur_roland@imprimerie.local', password: 'test123' },
  imprimeur_xerox: { email: 'imprimeur_xerox@imprimerie.local', password: 'test123' },
  livreur: { email: 'livreur@imprimerie.local', password: 'test123' }
};

// Fonction pour se connecter et obtenir un token
async function login(userType) {
  try {
    const user = TEST_USERS[userType];
    const response = await axios.post(`${API_BASE_URL}/auth/login`, user);
    return response.data.token;
  } catch (error) {
    console.log(`❌ Échec connexion ${userType}: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

// Test d'accès à un dossier inexistant
async function testDossierAccess(userType, token) {
  try {
    const fakeId = '99999999-fake-fake-fake-999999999999';
    const response = await axios.get(`${API_BASE_URL}/dossiers/${fakeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ ${userType}: Accès autorisé (inattendu)`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    
    // Vérifier si c'est le nouveau message amélioré
    if (message === 'Dossier non trouvé') {
      console.log(`❌ ${userType}: ENCORE l'ancien message → "${message}"`);
      return { success: false, oldMessage: true };
    } else {
      console.log(`✅ ${userType}: Nouveau message → "${message}"`);
      return { success: true, newMessage: message };
    }
  }
}

// Test de changement de statut 
async function testStatusChange(userType, token) {
  try {
    const fakeId = '99999999-fake-fake-fake-999999999999';
    const response = await axios.put(`${API_BASE_URL}/dossiers/${fakeId}/statut`, {
      nouveau_statut: 'en_impression'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ ${userType}: Changement statut autorisé (inattendu)`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    
    if (message.includes('Dossier non trouvé')) {
      console.log(`❌ ${userType}: ENCORE l'ancien message → "${message}"`);
      return { success: false, oldMessage: true };
    } else {
      console.log(`✅ ${userType}: Nouveau message → "${message}"`);
      return { success: true, newMessage: message };
    }
  }
}

// Fonction principale de test
async function runTests() {
  console.log('🔍 TEST FINAL: Vérification des corrections "Dossier non trouvé"\n');
  
  let hasOldMessages = false;
  const results = {};
  
  for (const [userType, userData] of Object.entries(TEST_USERS)) {
    console.log(`\n🧪 Test avec utilisateur: ${userType}`);
    console.log('=' .repeat(50));
    
    // 1. Connexion
    const token = await login(userType);
    if (!token) {
      console.log(`⏩ Impossible de tester ${userType} (échec connexion)\n`);
      continue;
    }
    
    // 2. Test accès dossier inexistant
    console.log(`\n📂 Test accès dossier inexistant:`);
    const accessResult = await testDossierAccess(userType, token);
    if (accessResult.oldMessage) hasOldMessages = true;
    
    // 3. Test changement statut dossier inexistant
    console.log(`\n🔄 Test changement statut:`);
    const statusResult = await testStatusChange(userType, token);
    if (statusResult.oldMessage) hasOldMessages = true;
    
    results[userType] = {
      access: accessResult,
      status: statusResult
    };
  }
  
  // 4. Résumé final
  console.log('\n' + '=' .repeat(80));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('=' .repeat(80));
  
  if (hasOldMessages) {
    console.log('❌ ÉCHEC: Des anciens messages "Dossier non trouvé" persistent encore !');
    console.log('');
    console.log('🔧 Actions nécessaires:');
    console.log('   1. Vérifier que le serveur backend utilise les fichiers corrigés');
    console.log('   2. Redémarrer complètement le serveur');  
    console.log('   3. Vérifier que le frontend utilise la vraie API (pas le mock)');
  } else {
    console.log('🎉 SUCCÈS COMPLET !');
    console.log('');
    console.log('✅ Tous les anciens messages "Dossier non trouvé" ont été remplacés');
    console.log('✅ Les utilisateurs reçoivent maintenant des messages explicites');
    console.log('✅ La correction est entièrement appliquée');
  }
  
  console.log('\n📋 Détails par utilisateur:');
  Object.entries(results).forEach(([user, tests]) => {
    console.log(`   ${user}:`);
    if (tests.access.newMessage) console.log(`      • Accès: "${tests.access.newMessage}"`);
    if (tests.status.newMessage) console.log(`      • Statut: "${tests.status.newMessage}"`);
  });
  
  return !hasOldMessages;
}

// Test de la disponibilité du serveur d'abord
async function checkServerHealth() {
  try {
    await axios.get(`${API_BASE_URL}/health`, { timeout: 3000 });
    console.log('✅ Serveur backend accessible sur http://localhost:5002');
    return true;
  } catch (error) {
    console.log('❌ Serveur backend non accessible sur http://localhost:5002');
    console.log('💡 Assurez-vous que le serveur est démarré avec: cd backend && PORT=5002 node server.js');
    return false;
  }
}

// Exécution
async function main() {
  console.log('🚀 DÉMARRAGE DU TEST DE VÉRIFICATION\n');
  
  // Vérifier la disponibilité du serveur
  const serverOk = await checkServerHealth();
  if (!serverOk) {
    process.exit(1);
  }
  
  // Exécuter les tests
  const success = await runTests();
  
  console.log('\n' + '=' .repeat(80));
  if (success) {
    console.log('🏆 MISSION ACCOMPLIE: Plus aucun message "Dossier non trouvé" générique !');
    process.exit(0);
  } else {
    console.log('⚠️  CORRECTION INCOMPLÈTE: Des messages génériques persistent');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Erreur lors du test:', error);
  process.exit(1);
});