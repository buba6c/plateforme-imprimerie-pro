#!/usr/bin/env node

/**
 * Script de test pour vérifier le système temps réel
 * Teste que les changements de statut se propagent correctement
 */

const io = require('socket.io-client');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001';
const SOCKET_URL = 'http://localhost:5001';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (color, emoji, message) => {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
};

// Configuration des sockets (simuler 3 utilisateurs différents)
const sockets = {
  preparateur: null,
  imprimeur: null,
  livreur: null
};

let testDossierId = null;
let eventsReceived = {
  preparateur: [],
  imprimeur: [],
  livreur: []
};

// Connexion des sockets
const connectSockets = () => {
  return new Promise((resolve) => {
    let connectedCount = 0;

    Object.keys(sockets).forEach(role => {
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true
      });

      socket.on('connect', () => {
        log('green', '✅', `Socket ${role} connecté: ${socket.id}`);
        
        // Rejoindre la room all_dossiers
        socket.emit('join:all_dossiers');
        log('cyan', '📊', `Socket ${role} a rejoint all_dossiers`);

        connectedCount++;
        if (connectedCount === 3) {
          resolve();
        }
      });

      socket.on('disconnect', () => {
        log('red', '❌', `Socket ${role} déconnecté`);
      });

      // Écouter les événements de changement de statut
      socket.on('status:changed', (data) => {
        log('blue', '🔄', `[${role}] Événement status:changed reçu`);
        console.log('   └─ Données:', JSON.stringify(data, null, 2));
        eventsReceived[role].push({
          event: 'status:changed',
          data,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('dossier:created', (data) => {
        log('magenta', '✨', `[${role}] Événement dossier:created reçu`);
        eventsReceived[role].push({
          event: 'dossier:created',
          data,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('dossier:updated', (data) => {
        log('yellow', '📝', `[${role}] Événement dossier:updated reçu`);
        eventsReceived[role].push({
          event: 'dossier:updated',
          data,
          timestamp: new Date().toISOString()
        });
      });

      sockets[role] = socket;
    });
  });
};

// Test 1: Créer un dossier
const testCreateDossier = async (token) => {
  log('cyan', '🧪', 'TEST 1: Création d\'un dossier');
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/dossiers`, {
      nom_client: 'Test Client Temps Réel',
      telephone: '0123456789',
      quantite: 100,
      format: 'A4',
      couleur: 'CMJN',
      finition: 'Aucune',
      type_formulaire: 'Xerox'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    testDossierId = response.data.id;
    log('green', '✅', `Dossier créé avec ID: ${testDossierId}`);
    
    // Attendre que les événements arrivent
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    log('red', '❌', `Erreur création dossier: ${error.message}`);
    return false;
  }
};

// Test 2: Changer le statut
const testChangeStatus = async (token, newStatus) => {
  log('cyan', '🧪', `TEST 2: Changement de statut vers "${newStatus}"`);
  
  try {
    const response = await axios.put(
      `${BACKEND_URL}/api/dossiers/${testDossierId}/status`,
      { newStatus },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    log('green', '✅', `Statut changé avec succès`);
    
    // Attendre que les événements arrivent
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return true;
  } catch (error) {
    log('red', '❌', `Erreur changement statut: ${error.message}`);
    if (error.response) {
      console.log('   └─ Réponse:', error.response.data);
    }
    return false;
  }
};

// Test 3: Vérifier les événements reçus
const verifyEvents = () => {
  log('cyan', '🧪', 'TEST 3: Vérification des événements reçus');
  
  let allPassed = true;

  Object.keys(eventsReceived).forEach(role => {
    const events = eventsReceived[role];
    log('blue', '📊', `[${role}] A reçu ${events.length} événement(s)`);
    
    events.forEach((evt, index) => {
      console.log(`   ${index + 1}. ${evt.event} à ${evt.timestamp}`);
    });

    // Vérifier que chaque rôle a reçu au moins un événement status:changed
    const statusChangedEvents = events.filter(e => e.event === 'status:changed');
    if (statusChangedEvents.length > 0) {
      log('green', '✅', `[${role}] A reçu des événements status:changed`);
    } else {
      log('red', '❌', `[${role}] N'a PAS reçu d'événement status:changed`);
      allPassed = false;
    }
  });

  return allPassed;
};

// Obtenir un token d'authentification
const getAuthToken = async () => {
  log('cyan', '🔑', 'Obtention d\'un token d\'authentification...');
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@imprimerie.com',
      password: 'admin123'
    });

    log('green', '✅', 'Token obtenu avec succès');
    return response.data.token;
  } catch (error) {
    log('red', '❌', `Erreur authentification: ${error.message}`);
    
    // Essayer avec un autre compte
    try {
      log('yellow', '⚠️', 'Tentative avec preparateur@imprimerie.com...');
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: 'preparateur@imprimerie.com',
        password: 'prep123'
      });
      log('green', '✅', 'Token préparateur obtenu');
      return response.data.token;
    } catch (err2) {
      log('red', '❌', 'Impossible d\'obtenir un token');
      return null;
    }
  }
};

// Fonction principale
const runTests = async () => {
  console.log('\n');
  log('magenta', '🚀', '=== TEST SYSTÈME TEMPS RÉEL - CHANGEMENT DE STATUT ===');
  console.log('\n');

  // 1. Obtenir un token
  const token = await getAuthToken();
  if (!token) {
    log('red', '❌', 'Impossible de continuer sans token');
    process.exit(1);
  }

  console.log('\n');

  // 2. Connecter les sockets
  log('cyan', '🔌', 'Connexion des sockets...');
  await connectSockets();
  
  console.log('\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Créer un dossier
  const created = await testCreateDossier(token);
  if (!created) {
    log('red', '❌', 'Test abandonné - création dossier échouée');
    disconnectAll();
    process.exit(1);
  }

  console.log('\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Changer le statut plusieurs fois
  const statusChanges = [
    'pret_impression',
    'en_impression',
    'imprime',
    'en_livraison'
  ];

  for (const status of statusChanges) {
    await testChangeStatus(token, status);
    console.log('\n');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // 5. Vérifier les événements
  console.log('\n');
  const allPassed = verifyEvents();

  console.log('\n');
  log('magenta', '📊', '=== RÉSULTAT FINAL ===');
  
  if (allPassed) {
    log('green', '✅', 'TOUS LES TESTS SONT PASSÉS !');
    log('green', '✅', 'Le système temps réel fonctionne correctement');
    log('green', '✅', 'Les changements de statut se propagent sur toutes les cartes et tous les rôles');
  } else {
    log('red', '❌', 'CERTAINS TESTS ONT ÉCHOUÉ');
    log('yellow', '⚠️', 'Vérifiez les logs ci-dessus pour plus de détails');
  }

  console.log('\n');

  // Nettoyer
  disconnectAll();
  process.exit(allPassed ? 0 : 1);
};

// Déconnecter tous les sockets
const disconnectAll = () => {
  log('yellow', '🔌', 'Déconnexion des sockets...');
  Object.values(sockets).forEach(socket => {
    if (socket) socket.disconnect();
  });
};

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  log('red', '💥', `Erreur non gérée: ${error.message}`);
  disconnectAll();
  process.exit(1);
});

process.on('SIGINT', () => {
  log('yellow', '⚠️', 'Test interrompu par l\'utilisateur');
  disconnectAll();
  process.exit(0);
});

// Lancer les tests
runTests();
