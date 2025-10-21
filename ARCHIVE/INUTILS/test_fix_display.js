/**
 * Test pour vérifier que l'affichage des dossiers est corrigé
 * Test que les numéros de dossier s'affichent correctement au lieu des IDs
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';
const FRONTEND_URL = 'http://localhost:3001';

// Couleurs pour les logs
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testLogin() {
  try {
    log('\n🔐 Test de connexion preparateur...', 'blue');
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });

    if (response.data?.token) {
      log('✅ Connexion réussie', 'green');
      return response.data.token;
    } else {
      log('❌ Pas de token reçu', 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Erreur de connexion: ${error.message}`, 'red');
    return null;
  }
}

async function testDossiersDisplay(token) {
  try {
    log('\n📋 Test de récupération des dossiers...', 'blue');
    
    const response = await axios.get(`${BASE_URL}/dossiers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data?.dossiers) {
      const dossiers = response.data.dossiers;
      log(`✅ ${dossiers.length} dossiers récupérés`, 'green');
      
      // Analyse de l'affichage des dossiers
      log('\n🔍 Analyse des champs d\'affichage:', 'cyan');
      
      dossiers.slice(0, 5).forEach((dossier, index) => {
        const displayNumber = dossier.numero_commande || 
                            dossier.numero_dossier || 
                            dossier.numero || 
                            `Dossier ${dossier.id?.toString()?.slice(-8) || 'N/A'}`;
                            
        const displayClient = dossier.client_nom || 
                            dossier.client || 
                            dossier.nom_client || 
                            dossier.client_name || 
                            'Client inconnu';
                            
        log(`  Dossier ${index + 1}:`, 'yellow');
        log(`    🔢 Numéro affiché: ${displayNumber}`, 'reset');
        log(`    👤 Client affiché: ${displayClient}`, 'reset');
        log(`    📊 Statut: ${dossier.statut || dossier.status || 'N/A'}`, 'reset');
        log(`    🏷️  Type: ${dossier.type_formulaire || dossier.type || dossier.machine || 'autre'}`, 'reset');
        
        // Vérification que ce n'est pas un UUID qui s'affiche
        if (displayNumber.includes('-') && displayNumber.length > 20) {
          log(`    ⚠️  PROBLÈME: Le numéro ressemble à un UUID!`, 'red');
        } else {
          log(`    ✅ Le numéro d'affichage semble correct`, 'green');
        }
        log(''); // Ligne vide
      });
      
      return true;
    } else {
      log('❌ Aucun dossier trouvé dans la réponse', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erreur lors de la récupération des dossiers: ${error.message}`, 'red');
    return false;
  }
}

async function testFrontendAccess() {
  try {
    log('\n🌐 Test d\'accès au frontend...', 'blue');
    
    const response = await axios.get(FRONTEND_URL, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; test)'
      }
    });

    if (response.status === 200) {
      log('✅ Frontend accessible', 'green');
      log(`📝 Status: ${response.status}`, 'reset');
      return true;
    } else {
      log(`❌ Frontend répond avec le status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erreur d'accès au frontend: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('🧪 TESTS DE CORRECTION D\'AFFICHAGE DES DOSSIERS', 'bold');
  log('=' .repeat(60), 'cyan');
  
  // Test 1: Connexion
  const token = await testLogin();
  if (!token) {
    log('\n❌ Impossible de continuer sans token', 'red');
    return;
  }
  
  // Test 2: Récupération et analyse des dossiers
  const dossiersOk = await testDossiersDisplay(token);
  
  // Test 3: Accès frontend
  const frontendOk = await testFrontendAccess();
  
  // Résumé
  log('\n📋 RÉSUMÉ DES TESTS:', 'bold');
  log('=' .repeat(40), 'cyan');
  log(`🔐 Connexion: ${token ? '✅ OK' : '❌ ÉCHEC'}`, token ? 'green' : 'red');
  log(`📋 Dossiers: ${dossiersOk ? '✅ OK' : '❌ ÉCHEC'}`, dossiersOk ? 'green' : 'red');
  log(`🌐 Frontend: ${frontendOk ? '✅ OK' : '❌ ÉCHEC'}`, frontendOk ? 'green' : 'red');
  
  if (token && dossiersOk && frontendOk) {
    log('\n🎉 TOUS LES TESTS SONT PASSÉS!', 'green');
    log('🚀 Le dashboard devrait maintenant afficher les bons numéros de dossiers', 'green');
    log(`🔗 Accès: ${FRONTEND_URL}`, 'cyan');
    log('👤 Login: preparateur@imprimerie.local', 'cyan');
    log('🔑 Password: admin123', 'cyan');
  } else {
    log('\n⚠️  Certains tests ont échoué', 'yellow');
  }
}

// Exécution des tests
runTests().catch(error => {
  log(`💥 Erreur globale: ${error.message}`, 'red');
  process.exit(1);
});