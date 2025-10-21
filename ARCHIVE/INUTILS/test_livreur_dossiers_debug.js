/**
 * Test pour valider le fonctionnement des dossiers livreur
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

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

// Test du livreur
const livreur = {
  email: 'livreur@evocomprint.com',
  password: 'livreur123'
};

async function testLivreurDossiers() {
  log('\n🚚 TEST DOSSIERS LIVREUR', 'bold');
  log('='.repeat(50), 'cyan');
  
  try {
    // 1. Connexion livreur
    log('\n1️⃣ Connexion du livreur...', 'blue');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, livreur);
    
    if (loginResponse.data.token) {
      log(`✅ Connexion réussie: ${loginResponse.data.user.nom}`, 'green');
      const token = loginResponse.data.token;
      
      // 2. Test des dossiers
      log('\n2️⃣ Récupération des dossiers...', 'blue');
      try {
        const dossiersResponse = await axios.get(`${BASE_URL}/dossiers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (dossiersResponse.data.success) {
          const dossiers = dossiersResponse.data.dossiers || [];
          log(`✅ Dossiers récupérés: ${dossiers.length}`, 'green');
          
          dossiers.forEach((dossier, index) => {
            log(`  📦 ${index + 1}. ID: ${dossier.id?.slice(-8)} | Statut: ${dossier.statut} | Client: ${dossier.client || 'N/A'}`, 'yellow');
          });
          
          if (dossiers.length === 0) {
            log('⚠️ Aucun dossier trouvé pour le livreur', 'yellow');
          }
        } else {
          log(`❌ Erreur dans la réponse: ${dossiersResponse.data.message}`, 'red');
        }
      } catch (dossiersError) {
        log(`❌ Erreur lors de la récupération des dossiers:`, 'red');
        log(`   Status: ${dossiersError.response?.status}`, 'red');
        log(`   Message: ${dossiersError.response?.data?.message || dossiersError.message}`, 'red');
      }
      
    } else {
      log(`❌ Erreur de connexion: ${loginResponse.data.message}`, 'red');
    }
    
  } catch (error) {
    log(`❌ Erreur générale: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    }
  }
}

// Exécution du test
testLivreurDossiers();