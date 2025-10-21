#!/usr/bin/env node

/**
 * TEST DE DIAGNOSTIC - Problèmes de connexion depuis la page login
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

// Utilisateurs à tester
const TEST_USERS = [
  { email: 'admin@imprimerie.local', password: 'test123', role: 'admin' },
  { email: 'preparateur@imprimerie.local', password: 'test123', role: 'preparateur' },
  { email: 'imprimeur_roland@imprimerie.local', password: 'test123', role: 'imprimeur_roland' },
  { email: 'imprimeur_xerox@imprimerie.local', password: 'test123', role: 'imprimeur_xerox' },
  { email: 'livreur@imprimerie.local', password: 'test123', role: 'livreur' }
];

async function testServerHealth() {
  console.log('🏥 Test de santé du serveur...');
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 3000 });
    console.log('✅ Serveur backend accessible');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Environment: ${response.data.environment}`);
    console.log(`   Database: ${response.data.database}`);
    return true;
  } catch (error) {
    console.log('❌ Serveur backend inaccessible');
    console.log(`   Erreur: ${error.message}`);
    return false;
  }
}

async function testUserLogin(user) {
  console.log(`\n👤 Test connexion: ${user.role} (${user.email})`);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: user.email,
      password: user.password
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success && response.data.token) {
      console.log('✅ Connexion réussie');
      console.log(`   Token reçu: ${response.data.token.substring(0, 20)}...`);
      console.log(`   Utilisateur: ${response.data.user?.nom || 'N/A'} ${response.data.user?.prenom || 'N/A'}`);
      console.log(`   Rôle: ${response.data.user?.role || 'N/A'}`);
      return { success: true, token: response.data.token, user: response.data.user };
    } else {
      console.log('❌ Réponse inattendue du serveur');
      console.log(`   Data: ${JSON.stringify(response.data)}`);
      return { success: false, error: 'Réponse inattendue' };
    }
    
  } catch (error) {
    console.log('❌ Échec de connexion');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data?.message || error.response.data?.error || 'Aucun message'}`);
      
      // Analyser le type d'erreur
      if (error.response.status === 401) {
        console.log('   🔍 Analyse: Identifiants incorrects ou utilisateur inexistant');
      } else if (error.response.status === 500) {
        console.log('   🔍 Analyse: Erreur serveur interne (vérifier la base de données)');
      } else if (error.response.status === 400) {
        console.log('   🔍 Analyse: Données de requête invalides');
      }
      
      return { success: false, error: error.response.data?.message || 'Erreur HTTP', status: error.response.status };
    } else if (error.request) {
      console.log('   🔍 Analyse: Pas de réponse du serveur (timeout ou serveur arrêté)');
      return { success: false, error: 'Pas de réponse du serveur' };
    } else {
      console.log(`   Erreur: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function testDatabaseUsers() {
  console.log('\n🗄️ Test de récupération des utilisateurs depuis la DB...');
  try {
    // Test avec un token admin valide d'abord
    const adminLogin = await testUserLogin(TEST_USERS[0]); // admin
    if (adminLogin.success) {
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${adminLogin.token}`
        }
      });
      
      console.log('✅ Liste des utilisateurs récupérée');
      console.log(`   Nombre d'utilisateurs: ${response.data.length || 0}`);
      
      if (response.data.length > 0) {
        response.data.forEach(user => {
          console.log(`   - ${user.email} (${user.role}) - Actif: ${user.actif ? 'Oui' : 'Non'}`);
        });
      }
      
      return response.data;
    }
  } catch (error) {
    console.log('❌ Impossible de récupérer la liste des utilisateurs');
    console.log(`   Erreur: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function runDiagnostic() {
  console.log('🔍 DIAGNOSTIC - Problèmes de connexion depuis la page login\n');
  console.log('=' .repeat(80));
  
  // 1. Test santé serveur
  const serverOk = await testServerHealth();
  if (!serverOk) {
    console.log('\n❌ ARRÊT DU DIAGNOSTIC: Serveur backend non accessible');
    console.log('💡 Vérifiez que le serveur est démarré avec: cd backend && PORT=5002 node server.js');
    process.exit(1);
  }
  
  // 2. Test base de données
  const users = await testDatabaseUsers();
  
  // 3. Test connexion pour chaque utilisateur
  console.log('\n' + '=' .repeat(80));
  console.log('🧪 TESTS DE CONNEXION PAR UTILISATEUR');
  console.log('=' .repeat(80));
  
  const results = {};
  
  for (const user of TEST_USERS) {
    const result = await testUserLogin(user);
    results[user.role] = result;
  }
  
  // 4. Résumé
  console.log('\n' + '=' .repeat(80));
  console.log('📊 RÉSUMÉ DU DIAGNOSTIC');
  console.log('=' .repeat(80));
  
  const successful = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => !r.success).length;
  
  console.log(`✅ Connexions réussies: ${successful}/${TEST_USERS.length}`);
  console.log(`❌ Connexions échouées: ${failed}/${TEST_USERS.length}`);
  
  if (failed > 0) {
    console.log('\n🔧 PROBLÈMES IDENTIFIÉS:');
    Object.entries(results).forEach(([role, result]) => {
      if (!result.success) {
        console.log(`   ${role}: ${result.error} ${result.status ? `(${result.status})` : ''}`);
      }
    });
    
    console.log('\n💡 SOLUTIONS POSSIBLES:');
    console.log('   1. Vérifier que les utilisateurs existent en base de données');
    console.log('   2. Vérifier les mots de passe (par défaut: test123)');
    console.log('   3. Vérifier que les utilisateurs sont actifs (actif=true)');
    console.log('   4. Vérifier la configuration de la base de données');
    console.log('   5. Vérifier les logs du serveur pour plus de détails');
  } else {
    console.log('\n🎉 TOUTES LES CONNEXIONS FONCTIONNENT CORRECTEMENT !');
  }
  
  return results;
}

// Exécution
runDiagnostic().catch(error => {
  console.error('💥 Erreur lors du diagnostic:', error);
  process.exit(1);
});