/**
 * Test pour valider le nouveau dashboard des imprimeurs
 * Teste les deux rôles : imprimeur_roland et imprimeur_xerox
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
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Credentials des imprimeurs
const imprimeurs = {
  roland: {
    email: 'roland@evocomprint.com',
    password: 'roland123',
    role: 'imprimeur_roland',
    machine: 'Roland'
  },
  xerox: {
    email: 'xerox@evocomprint.com', 
    password: 'xerox123',
    role: 'imprimeur_xerox',
    machine: 'Xerox'
  }
};

async function testImprimeurLogin(imprimeurType) {
  try {
    log(`\n🔐 Test connexion ${imprimeurs[imprimeurType].machine}...`, 'blue');
    
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: imprimeurs[imprimeurType].email,
      password: imprimeurs[imprimeurType].password
    });

    if (response.data?.token && response.data?.user) {
      const user = response.data.user;
      log(`✅ Connexion ${imprimeurs[imprimeurType].machine} réussie`, 'green');
      log(`   👤 Utilisateur: ${user.prenom} ${user.nom}`, 'reset');
      log(`   🎯 Rôle: ${user.role}`, 'reset');
      log(`   🏭 Machine: ${imprimeurs[imprimeurType].machine}`, 'reset');
      
      // Vérification du rôle
      if (user.role === imprimeurs[imprimeurType].role) {
        log(`   ✅ Rôle correct: ${user.role}`, 'green');
      } else {
        log(`   ❌ Rôle incorrect: attendu ${imprimeurs[imprimeurType].role}, reçu ${user.role}`, 'red');
      }
      
      return { token: response.data.token, user };
    } else {
      log(`❌ Pas de token ou utilisateur reçu`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Erreur connexion ${imprimeurs[imprimeurType].machine}: ${error.message}`, 'red');
    return null;
  }
}

async function testImprimeurDossiers(imprimeurType, auth) {
  try {
    log(`\n📋 Test récupération dossiers ${imprimeurs[imprimeurType].machine}...`, 'blue');
    
    const response = await axios.get(`${BASE_URL}/dossiers`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data?.dossiers) {
      const dossiers = response.data.dossiers;
      const machineType = imprimeurType; // roland ou xerox
      
      log(`✅ ${dossiers.length} dossiers récupérés`, 'green');
      
      // Analyser les dossiers par type de machine
      const dossiersParType = {
        roland: dossiers.filter(d => (d.type_formulaire || d.type || d.machine || '').toLowerCase() === 'roland'),
        xerox: dossiers.filter(d => (d.type_formulaire || d.type || d.machine || '').toLowerCase() === 'xerox'),
        autre: dossiers.filter(d => {
          const type = (d.type_formulaire || d.type || d.machine || '').toLowerCase();
          return type !== 'roland' && type !== 'xerox';
        })
      };
      
      log(`\n🔍 Analyse par type de machine:`, 'cyan');
      log(`   🖨️  Roland: ${dossiersParType.roland.length} dossiers`, 'reset');
      log(`   🖨️  Xerox: ${dossiersParType.xerox.length} dossiers`, 'reset');
      log(`   📄 Autre: ${dossiersParType.autre.length} dossiers`, 'reset');
      
      // Vérifier les dossiers pertinents pour cet imprimeur
      const dossiersRelevants = dossiersParType[machineType];
      log(`\n🎯 Dossiers pertinents pour ${imprimeurs[imprimeurType].machine}: ${dossiersRelevants.length}`, 'magenta');
      
      // Analyser les statuts pour l'impression
      const statutsImpression = {
        pret_impression: dossiers.filter(d => {
          const status = (d.statut || d.status || '').toLowerCase();
          return status.includes('pret') && status.includes('impression');
        }).length,
        en_impression: dossiers.filter(d => {
          const status = (d.statut || d.status || '').toLowerCase();
          return status.includes('impression') && !status.includes('pret');
        }).length,
        termine: dossiers.filter(d => {
          const status = (d.statut || d.status || '').toLowerCase();
          return status.includes('termine') || status.includes('pret_livraison');
        }).length
      };
      
      log(`\n📊 Statuts d'impression:`, 'cyan');
      log(`   🔵 Prêt à imprimer: ${statutsImpression.pret_impression}`, 'reset');
      log(`   🟣 En impression: ${statutsImpression.en_impression}`, 'reset');
      log(`   🟢 Terminé: ${statutsImpression.termine}`, 'reset');
      
      // Afficher quelques dossiers d'exemple
      if (dossiersRelevants.length > 0) {
        log(`\n📄 Exemples de dossiers ${imprimeurs[imprimeurType].machine}:`, 'cyan');
        dossiersRelevants.slice(0, 3).forEach((dossier, index) => {
          const numero = dossier.numero_commande || dossier.numero_dossier || `#${dossier.id}`;
          const client = dossier.client_nom || dossier.client || 'Client inconnu';
          const statut = dossier.statut || dossier.status || 'N/A';
          
          log(`   ${index + 1}. ${numero} - ${client} (${statut})`, 'reset');
        });
      }
      
      return {
        total: dossiers.length,
        parType: dossiersParType,
        relevants: dossiersRelevants.length,
        statutsImpression
      };
    } else {
      log('❌ Aucun dossier trouvé dans la réponse', 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Erreur récupération dossiers ${imprimeurs[imprimeurType].machine}: ${error.message}`, 'red');
    return null;
  }
}

async function testFrontendAccess() {
  try {
    log('\n🌐 Test accès au frontend...', 'blue');
    
    const response = await axios.get(FRONTEND_URL, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; test)'
      }
    });

    if (response.status === 200) {
      log('✅ Frontend accessible', 'green');
      return true;
    } else {
      log(`❌ Frontend répond avec le status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erreur accès frontend: ${error.message}`, 'red');
    return false;
  }
}

async function testImprimeur(imprimeurType) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`🧪 TEST IMPRIMEUR ${imprimeurs[imprimeurType].machine.toUpperCase()}`, 'bold');
  log(`${'='.repeat(60)}`, 'cyan');
  
  // Test 1: Connexion
  const auth = await testImprimeurLogin(imprimeurType);
  if (!auth) {
    log(`\n❌ Impossible de continuer les tests pour ${imprimeurs[imprimeurType].machine}`, 'red');
    return { success: false, auth: null, dossiers: null };
  }
  
  // Test 2: Récupération des dossiers
  const dossiersResult = await testImprimeurDossiers(imprimeurType, auth);
  
  return {
    success: auth && dossiersResult,
    auth,
    dossiers: dossiersResult
  };
}

async function runAllTests() {
  log('🎯 TESTS DASHBOARD IMPRIMEURS', 'bold');
  log('=' .repeat(80), 'cyan');
  
  // Test accès frontend d'abord
  const frontendOk = await testFrontendAccess();
  
  // Tests pour chaque type d'imprimeur
  const resultats = {};
  for (const type of ['roland', 'xerox']) {
    resultats[type] = await testImprimeur(type);
  }
  
  // Résumé global
  log(`\n${'='.repeat(80)}`, 'cyan');
  log('📋 RÉSUMÉ GLOBAL DES TESTS', 'bold');
  log(`${'='.repeat(80)}`, 'cyan');
  
  log(`🌐 Frontend: ${frontendOk ? '✅ OK' : '❌ ÉCHEC'}`, frontendOk ? 'green' : 'red');
  
  for (const [type, result] of Object.entries(resultats)) {
    const machine = imprimeurs[type].machine;
    log(`🖨️  ${machine}:`, 'cyan');
    log(`   🔐 Connexion: ${result.auth ? '✅ OK' : '❌ ÉCHEC'}`, result.auth ? 'green' : 'red');
    log(`   📋 Dossiers: ${result.dossiers ? '✅ OK' : '❌ ÉCHEC'}`, result.dossiers ? 'green' : 'red');
    
    if (result.dossiers) {
      log(`   📊 Statistiques:`, 'reset');
      log(`      • Total: ${result.dossiers.total} dossiers`, 'reset');
      log(`      • Pertinents: ${result.dossiers.relevants} pour ${machine}`, 'reset');
      log(`      • À imprimer: ${result.dossiers.statutsImpression.pret_impression}`, 'reset');
      log(`      • En cours: ${result.dossiers.statutsImpression.en_impression}`, 'reset');
    }
  }
  
  // Instructions d'accès
  log('\n🚀 ACCÈS AUX DASHBOARDS:', 'bold');
  log(`🔗 URL: ${FRONTEND_URL}`, 'cyan');
  log('👥 Comptes imprimeurs:', 'cyan');
  log(`   🖨️  Roland: ${imprimeurs.roland.email} / ${imprimeurs.roland.password}`, 'reset');
  log(`   🖨️  Xerox: ${imprimeurs.xerox.email} / ${imprimeurs.xerox.password}`, 'reset');
  
  const allSuccess = frontendOk && Object.values(resultats).every(r => r.success);
  
  if (allSuccess) {
    log('\n🎉 TOUS LES TESTS SONT PASSÉS!', 'green');
    log('🚀 Les dashboards imprimeurs sont fonctionnels!', 'green');
  } else {
    log('\n⚠️  Certains tests ont échoué', 'yellow');
  }
  
  return allSuccess;
}

// Exécution des tests
runAllTests().catch(error => {
  log(`💥 Erreur globale: ${error.message}`, 'red');
  process.exit(1);
});