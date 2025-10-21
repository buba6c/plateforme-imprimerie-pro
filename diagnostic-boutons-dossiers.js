/**
 * DIAGNOSTIC: Problème "Dossier non trouvé" dans les actions de boutons
 * ===================================================================
 * 
 * Ce script teste spécifiquement les actions de boutons pour identifier
 * où et pourquoi l'erreur "Dossier non trouvé" apparaît encore
 */

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5001/api';
const FRONTEND_URL = 'http://localhost:3001';

let authToken = null;

// Fonction de logging avec colors
const log = (message, type = 'info') => {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green  
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    debug: '\x1b[35m'    // Magenta
  };
  const reset = '\x1b[0m';
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[type]}[${timestamp}] ${message}${reset}`);
};

// Fonction d'authentification
async function authenticate() {
  try {
    log('🔑 Authentification en cours...', 'info');
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    authToken = response.data.token;
    log('✅ Authentification réussie', 'success');
    return authToken;
  } catch (error) {
    log(`❌ Échec authentification: ${error.message}`, 'error');
    throw error;
  }
}

// Récupérer les dossiers pour les tests
async function getDossiers() {
  try {
    log('📋 Récupération des dossiers...', 'info');
    const response = await axios.get(`${API_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const dossiers = Array.isArray(response.data) ? response.data : response.data.dossiers || [];
    log(`✅ ${dossiers.length} dossiers récupérés`, 'success');
    log(`Structure réponse: ${JSON.stringify(Object.keys(response.data))}`, 'debug');
    return dossiers;
  } catch (error) {
    log(`❌ Erreur récupération dossiers: ${error.message}`, 'error');
    if (error.response?.data) {
      log(`Détails: ${JSON.stringify(error.response.data)}`, 'debug');
    }
    throw error;
  }
}

// Test des détails d'un dossier avec différents formats d'ID
async function testDossierDetails(dossier) {
  log(`\n🔍 Test détails pour dossier: ${dossier.numero || dossier.id}`, 'info');
  log(`   Structure dossier: ${JSON.stringify({
    id: dossier.id,
    folder_id: dossier.folder_id,
    numero: dossier.numero,
    numero_commande: dossier.numero_commande
  })}`, 'debug');

  const testIds = [
    { label: 'ID principal', value: dossier.id },
    { label: 'Folder ID', value: dossier.folder_id },
    { label: 'Numéro', value: dossier.numero },
    { label: 'Numéro commande', value: dossier.numero_commande }
  ].filter(test => test.value); // Ne tester que les valeurs qui existent

  for (const test of testIds) {
    try {
      log(`   Test avec ${test.label}: ${test.value}`, 'info');
      
      const response = await axios.get(`${API_URL}/dossiers/${test.value}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.status === 200) {
        log(`   ✅ ${test.label} fonctionne`, 'success');
      }
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 404) {
        log(`   ❌ ${test.label} → "Dossier non trouvé" (404)`, 'error');
        log(`      Message: ${message}`, 'debug');
      } else {
        log(`   ⚠️  ${test.label} → Erreur ${status}: ${message}`, 'warning');
      }
    }
  }
}

// Test des actions de changement de statut (principale cause d'erreur)
// Test de changement de statut
async function testStatusChange(dossier, authToken) {
  const testId = dossier.id; // Utiliser l'ID principal
  const currentStatus = dossier.statut; // Utiliser le statut exact du dossier
  
  // Map des changements de statut logiques à tester selon l'état actuel
  const statusMap = {
    'À revoir': 'En cours',
    'En cours': 'Prêt impression', 
    'Prêt impression': 'En impression',
    'En impression': 'Imprimé',
    'Imprimé': 'Prêt livraison',
    'Prêt livraison': 'En livraison',
    'En livraison': 'Livré',
    'Livré': 'Terminé',
    'Terminé': 'En cours' // Permettre le retour en arrière
  };
  
  const newStatus = statusMap[currentStatus] || 'En cours';
  
  log(`\n🔄 Test changement statut pour: ${dossier.numero || dossier.id}`, 'info');
  log(`   Statut actuel: ${currentStatus} → ${newStatus}`, 'info');
  
  try {
    const response = await axios.put(`${API_URL}/dossiers/${testId}/statut`, {
      statut: newStatus
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status === 200) {
      log(`   ✅ Changement de statut réussi`, 'success');
    }
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    if (status === 403) {
      log(`   ❌ Non autorisé pour ce changement de statut: ${message}`, 'warning');
    } else if (status === 404) {
      log(`   ❌ Dossier non trouvé pour changement de statut`, 'error');
    } else if (status === 400) {
      log(`   ❌ Statut invalide: ${message}`, 'error');
    } else {
      log(`   ❌ Erreur changement de statut: ${message}`, 'error');
    }
  }
}

// Test des actions de fichiers
async function testFileActions(dossier) {
  log(`\n📁 Test actions fichiers pour: ${dossier.numero || dossier.id}`, 'info');
  
  try {
    const response = await axios.get(`${API_URL}/files`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { dossier_id: dossier.id }
    });
    
    if (response.status === 200) {
      const files = Array.isArray(response.data) ? response.data : response.data.files || [];
      log(`   ✅ Récupération fichiers réussie: ${files.length} fichiers`, 'success');
    }
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    if (status === 404) {
      log(`   ❌ PROBLÈME: "Dossier non trouvé" pour les fichiers`, 'error');
      log(`      Message: ${message}`, 'debug');
    } else {
      log(`   ⚠️  Autre erreur ${status}: ${message}`, 'warning');
    }
  }
}

// Diagnostic complet
async function runDiagnostic() {
  console.log('\n' + '='.repeat(80));
  log('🚀 DIAGNOSTIC: Actions de boutons "Dossier non trouvé"', 'info');
  console.log('='.repeat(80));

  try {
    // Authentification
    await authenticate();
    
    // Récupérer les dossiers
    const dossiers = await getDossiers();
    
    if (dossiers.length === 0) {
      log('⚠️  Aucun dossier trouvé pour les tests', 'warning');
      return;
    }

    // Tester avec les 3 premiers dossiers
    const testDossiers = dossiers.slice(0, 3);
    
    for (const dossier of testDossiers) {
      console.log('\n' + '-'.repeat(60));
      
      // Test des détails
      await testDossierDetails(dossier);
      
      // Test changement de statut (action principale)
      await testStatusChange(dossier);
      
      // Test actions fichiers
      await testFileActions(dossier);
      
      // Petite pause entre les tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(80));
    log('✅ DIAGNOSTIC TERMINÉ', 'success');
    console.log('='.repeat(80));
    
  } catch (error) {
    log(`💥 Erreur critique: ${error.message}`, 'error');
  }
}

// Lancement du diagnostic
runDiagnostic().catch(console.error);