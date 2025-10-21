#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Utilisateurs de test avec leurs rôles
const TEST_USERS = {
  admin: { email: 'admin@imprimerie.local', password: 'admin123' },
  preparateur: { email: 'preparateur@imprimerie.local', password: 'preparateur123' },
  roland: { email: 'roland@imprimerie.local', password: 'roland123' },
  xerox: { email: 'xerox@imprimerie.local', password: 'xerox123' },
  livreur: { email: 'livreur@imprimerie.local', password: 'livreur123' }
};

// Fonction pour se connecter et obtenir un token
async function login(userType) {
  try {
    const user = TEST_USERS[userType];
    console.log(`🔐 Connexion ${userType}: ${user.email}`);
    
    const response = await axios.post(`${API_BASE}/auth/login`, user, {
      timeout: 5000
    });
    
    if (response.data && response.data.token) {
      console.log(`✅ Connexion réussie pour ${userType}`);
      return response.data.token;
    }
    throw new Error('Token manquant dans la réponse');
  } catch (error) {
    console.error(`❌ Erreur connexion ${userType}:`, error.response?.data || error.message);
    return null;
  }
}

// Fonction pour récupérer les dossiers
async function getDossiers(token) {
  try {
    const response = await axios.get(`${API_BASE}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('❌ Erreur récupération dossiers:', error.response?.data || error.message);
    return null;
  }
}

// Fonction pour changer le statut d'un dossier
async function changeStatus(dossierId, newStatus, token, comment = '') {
  try {
    const response = await axios.patch(`${API_BASE}/dossiers/${dossierId}/status`, {
      statut: newStatus,
      commentaire: comment
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Erreur changement statut:`, error.response?.data || error.message);
    return null;
  }
}

// Test principal du workflow
async function testWorkflow() {
  console.log('🚀 ===============================================');
  console.log('🚀 TEST DU WORKFLOW - PLATEFORME IMPRIMERIE');
  console.log('🚀 ===============================================\n');

  // 1. Test de connexion pour chaque rôle
  console.log('📋 ÉTAPE 1: Test des connexions');
  const tokens = {};
  
  for (const [role, _] of Object.entries(TEST_USERS)) {
    const token = await login(role);
    if (token) {
      tokens[role] = token;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Pause entre les requêtes
  }

  const availableRoles = Object.keys(tokens);
  console.log(`\n✅ Connexions réussies: ${availableRoles.join(', ')}\n`);

  if (availableRoles.length === 0) {
    console.error('❌ Aucune connexion réussie. Arrêt du test.');
    return;
  }

  // 2. Récupération des dossiers avec le préparateur
  console.log('📋 ÉTAPE 2: Récupération des dossiers');
  const preparateurToken = tokens.preparateur;
  
  if (!preparateurToken) {
    console.error('❌ Token préparateur manquant');
    return;
  }

  const dossiers = await getDossiers(preparateurToken);
  if (!dossiers) {
    console.error('❌ Impossible de récupérer les dossiers');
    return;
  }

  console.log(`✅ ${dossiers.length} dossiers trouvés`);
  
  // Afficher les dossiers avec leurs statuts
  dossiers.slice(0, 3).forEach((dossier, index) => {
    console.log(`   ${index + 1}. ID: ${dossier.id} | Client: ${dossier.nom_client} | Statut: ${dossier.statut} | Type: ${dossier.type_impression}`);
  });

  // 3. Test des transitions de statut
  console.log('\n📋 ÉTAPE 3: Test des transitions de statut');
  
  // Trouver un dossier en statut "nouveau" ou créer un scénario
  let testDossier = dossiers.find(d => d.statut === 'nouveau');
  
  if (!testDossier) {
    console.log('ℹ️  Aucun dossier en statut "nouveau" trouvé. Test avec le premier dossier disponible.');
    testDossier = dossiers[0];
  }

  if (!testDossier) {
    console.error('❌ Aucun dossier disponible pour le test');
    return;
  }

  console.log(`🎯 Test avec le dossier ID: ${testDossier.id} (${testDossier.nom_client}) - Statut actuel: ${testDossier.statut}`);

  // Test des transitions selon le workflow
  const transitions = [
    { from: 'nouveau', to: 'en_preparation', role: 'preparateur', comment: 'Début de préparation' },
    { from: 'en_preparation', to: 'pret_impression', role: 'preparateur', comment: 'Préparation terminée' },
    { from: 'pret_impression', to: 'en_impression', role: testDossier.type_impression === 'roland' ? 'roland' : 'xerox', comment: 'Début impression' },
    { from: 'en_impression', to: 'imprime', role: testDossier.type_impression === 'roland' ? 'roland' : 'xerox', comment: 'Impression terminée' }
  ];

  for (const transition of transitions) {
    if (testDossier.statut === transition.from && tokens[transition.role]) {
      console.log(`\n🔄 Tentative: ${transition.from} → ${transition.to} (${transition.role})`);
      
      const result = await changeStatus(
        testDossier.id, 
        transition.to, 
        tokens[transition.role], 
        transition.comment
      );
      
      if (result) {
        console.log(`✅ Transition réussie: ${transition.from} → ${transition.to}`);
        testDossier.statut = transition.to; // Mettre à jour pour le test suivant
      } else {
        console.log(`❌ Transition échouée: ${transition.from} → ${transition.to}`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n🎉 Test du workflow terminé !');
  console.log('===============================================');
}

// Fonction de vérification de la santé de l'API
async function checkApiHealth() {
  try {
    const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    console.log('✅ API Backend: Opérationnelle');
    console.log(`   - Statut: ${response.data.status}`);
    console.log(`   - Base de données: ${response.data.database}`);
    console.log(`   - Version: ${response.data.version}`);
    return true;
  } catch (error) {
    console.error('❌ API Backend: Non accessible');
    console.error(`   Erreur: ${error.message}`);
    return false;
  }
}

// Exécution principale
async function main() {
  console.log('🔍 Vérification de l\'état de l\'API...\n');
  
  const apiHealthy = await checkApiHealth();
  if (!apiHealthy) {
    console.log('\n💡 Assurez-vous que le backend est démarré sur le port 5001');
    console.log('   Commande: cd backend && npm run dev');
    return;
  }
  
  console.log('');
  await testWorkflow();
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error.message);
  process.exit(1);
});

main().catch(console.error);