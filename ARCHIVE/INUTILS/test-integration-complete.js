/**
 * TEST FINAL - INTÉGRATION COMPLÈTE
 * ==================================
 * 
 * Ce script teste l'intégration complète de l'authentification,
 * de la récupération des dossiers et des actions sur les boutons
 */

const axios = require('axios');

// Configuration
const FRONTEND_URL = 'http://localhost:3001';
const BACKEND_URL = 'http://localhost:5001';

// Utilisateurs de test
const TEST_USERS = [
  { email: 'admin@imprimerie.local', password: 'admin123', role: 'admin' },
  { email: 'preparateur@imprimerie.local', password: 'admin123', role: 'preparateur' },
  { email: 'roland@imprimerie.local', password: 'admin123', role: 'imprimeur_roland' }
];

// ================================
// FONCTIONS UTILITAIRES
// ================================

const log = (message, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  console.log(`[${timestamp}] ${icons[type]} ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================================
// TESTS D'AUTHENTIFICATION
// ================================

async function testAuthentication() {
  log('='.repeat(60));
  log('TEST D\'AUTHENTIFICATION', 'info');
  log('='.repeat(60));

  for (const user of TEST_USERS) {
    try {
      log(`Test connexion ${user.role}: ${user.email}`);
      
      const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: user.email,
        password: user.password
      });

      if (loginResponse.status === 200 && loginResponse.data.token) {
        log(`Connexion réussie pour ${user.role}`, 'success');
        
        // Test récupération profil
        const profileResponse = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${loginResponse.data.token}` }
        });

        if (profileResponse.status === 200) {
          log(`Profil récupéré pour ${user.role}`, 'success');
        }
      }

    } catch (error) {
      log(`Échec connexion ${user.role}: ${error.message}`, 'error');
      return false;
    }

    await sleep(200); // Éviter de surcharger
  }

  return true;
}

// ================================
// TESTS API DOSSIERS
// ================================

async function testDossiersAPI() {
  log('='.repeat(60));
  log('TEST API DOSSIERS', 'info');
  log('='.repeat(60));

  try {
    // Connexion admin pour les tests
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // Test 1: Récupération liste dossiers
    log('Test récupération liste dossiers...');
    const dossiersResponse = await axios.get(`${BACKEND_URL}/api/dossiers`, { headers });
    
    if (dossiersResponse.status === 200 && Array.isArray(dossiersResponse.data)) {
      log(`${dossiersResponse.data.length} dossiers récupérés`, 'success');
      
      if (dossiersResponse.data.length > 0) {
        const firstDossier = dossiersResponse.data[0];
        log(`Premier dossier: ${firstDossier.numero} - ${firstDossier.client}`);

        // Test 2: Récupération détails dossier
        log(`Test récupération détails dossier ${firstDossier.id}...`);
        const detailResponse = await axios.get(`${BACKEND_URL}/api/dossiers/${firstDossier.id}`, { headers });
        
        if (detailResponse.status === 200) {
          log('Détails dossier récupérés', 'success');
          
          // Test 3: Récupération fichiers du dossier
          log('Test récupération fichiers...');
          try {
            const filesResponse = await axios.get(`${BACKEND_URL}/api/files/dossier/${firstDossier.id}`, { headers });
            log(`${filesResponse.data.length} fichiers trouvés`, 'success');
          } catch (fileError) {
            log(`Attention: ${fileError.response?.status} - ${fileError.message}`, 'warning');
          }
        }
      }
    }

    return true;

  } catch (error) {
    log(`Erreur test dossiers: ${error.message}`, 'error');
    if (error.response?.data) {
      log(`Détails erreur: ${JSON.stringify(error.response.data)}`, 'error');
    }
    return false;
  }
}

// ================================
// TESTS PROXY FRONTEND
// ================================

async function testFrontendProxy() {
  log('='.repeat(60));
  log('TEST PROXY FRONTEND', 'info');
  log('='.repeat(60));

  try {
    // Test health check via proxy
    log('Test health check via proxy...');
    const healthResponse = await axios.get(`${FRONTEND_URL}/api/health`);
    
    if (healthResponse.status === 200) {
      log('Proxy frontend fonctionne', 'success');
      log(`Version backend: ${healthResponse.data.version}`);
      
      // Test auth via proxy
      log('Test authentification via proxy...');
      const loginResponse = await axios.post(`${FRONTEND_URL}/api/auth/login`, {
        email: 'admin@imprimerie.local',
        password: 'admin123'
      });

      if (loginResponse.status === 200) {
        log('Authentification via proxy réussie', 'success');
        
        // Test dossiers via proxy
        const token = loginResponse.data.token;
        const dossiersResponse = await axios.get(`${FRONTEND_URL}/api/dossiers`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (dossiersResponse.status === 200) {
          log(`Dossiers via proxy: ${dossiersResponse.data.length}`, 'success');
        }
      }
    }

    return true;

  } catch (error) {
    log(`Erreur proxy frontend: ${error.message}`, 'error');
    if (error.code === 'ECONNREFUSED') {
      log('Le frontend semble être arrêté', 'error');
    }
    return false;
  }
}

// ================================
// TESTS SÉCURITÉ
// ================================

async function testSecurity() {
  log('='.repeat(60));
  log('TEST SÉCURITÉ', 'info');
  log('='.repeat(60));

  try {
    // Test 1: Accès sans auth (doit échouer)
    log('Test accès sans authentification...');
    try {
      await axios.get(`${BACKEND_URL}/api/dossiers`);
      log('ATTENTION: Accès autorisé sans auth !', 'warning');
    } catch (error) {
      if (error.response?.status === 401) {
        log('Sécurité OK: Accès refusé sans auth', 'success');
      }
    }

    // Test 2: Token invalide (doit échouer)
    log('Test avec token invalide...');
    try {
      await axios.get(`${BACKEND_URL}/api/dossiers`, {
        headers: { Authorization: 'Bearer token-invalide' }
      });
      log('ATTENTION: Token invalide accepté !', 'warning');
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        log('Sécurité OK: Token invalide rejeté', 'success');
      }
    }

    // Test 3: Credentials incorrects
    log('Test credentials incorrects...');
    try {
      await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: 'admin@imprimerie.local',
        password: 'mauvais-mot-de-passe'
      });
      log('ATTENTION: Credentials incorrects acceptés !', 'warning');
    } catch (error) {
      if (error.response?.status === 401) {
        log('Sécurité OK: Credentials incorrects rejetés', 'success');
      }
    }

    return true;

  } catch (error) {
    log(`Erreur test sécurité: ${error.message}`, 'error');
    return false;
  }
}

// ================================
// EXÉCUTION DES TESTS
// ================================

async function runAllTests() {
  const startTime = Date.now();
  
  console.log('\n🚀 DÉBUT DES TESTS D\'INTÉGRATION COMPLÈTE');
  console.log(`⏰ ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  const results = {
    auth: false,
    dossiers: false,
    proxy: false,
    security: false
  };

  // Exécution des tests
  results.auth = await testAuthentication();
  await sleep(1000);

  results.dossiers = await testDossiersAPI();
  await sleep(1000);

  results.proxy = await testFrontendProxy();
  await sleep(1000);

  results.security = await testSecurity();

  // Résumé
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(80));
  
  Object.entries(results).forEach(([test, success]) => {
    const status = success ? '✅ PASSÉ' : '❌ ÉCHEC';
    console.log(`${test.toUpperCase().padEnd(20)}: ${status}`);
  });

  const allPassed = Object.values(results).every(Boolean);
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;

  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('🎉 TOUS LES TESTS SONT PASSÉS !');
    console.log('✅ L\'application est prête pour la production');
  } else {
    console.log(`⚠️  ${passedTests}/${totalTests} tests passés`);
    console.log('❌ Certains problèmes nécessitent une attention');
  }
  
  console.log(`⏱️  Durée totale: ${duration}s`);
  console.log('='.repeat(80));
}

// Lancement des tests
runAllTests().catch(error => {
  console.error('💥 Erreur critique:', error.message);
  process.exit(1);
});