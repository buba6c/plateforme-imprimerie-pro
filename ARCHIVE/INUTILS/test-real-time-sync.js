#!/usr/bin/env node

// Test de synchronisation temps réel - Workflow complet
// Simule les actions d'un préparateur, imprimeur et livreur

const { query } = require('./backend/config/database');
const io = require('socket.io-client');

let socket1, socket2, socket3; // Préparateur, Imprimeur, Admin

async function main() {
  console.log('🧪 Test de synchronisation temps réel - Workflow complet');
  console.log('=====================================================\n');
  
  // Étape 1: Connexion des clients WebSocket
  console.log('1. Connexion des clients WebSocket...');
  
  socket1 = io('http://localhost:5001');
  socket2 = io('http://localhost:5001');
  socket3 = io('http://localhost:5001');
  
  // Attendre les connexions
  await Promise.all([
    waitForConnection(socket1, 'Préparateur'),
    waitForConnection(socket2, 'Imprimeur Roland'),
    waitForConnection(socket3, 'Admin')
  ]);
  
  // Authentifier les sockets
  socket1.emit('authenticate', { 
    userId: 'prep1', 
    userRole: 'preparateur',
    token: 'fake-token' 
  });
  
  socket2.emit('authenticate', { 
    userId: 'roland1', 
    userRole: 'imprimeur_roland',
    token: 'fake-token' 
  });
  
  socket3.emit('authenticate', { 
    userId: 'admin1', 
    userRole: 'admin',
    token: 'fake-token' 
  });
  
  await delay(2000);
  
  // Étape 2: Écouter les événements de synchronisation
  console.log('\n2. Configuration des écouteurs d\'événements...');
  
  setupEventListeners();
  
  // Étape 3: Créer un dossier de test
  console.log('\n3. Création d\'un dossier de test...');
  
  const testDossier = await createTestDossier();
  console.log(`✅ Dossier créé: ${testDossier.numero_commande} (ID: ${testDossier.id})`);
  
  await delay(1000);
  
  // Étape 4: Changer le statut du dossier (workflow complet)
  console.log('\n4. Test du workflow complet...');
  
  // en_cours → en_impression
  await updateDossierStatus(testDossier.id, 'en_impression', 'Dossier pris en charge');
  await delay(2000);
  
  // en_impression → termine  
  await updateDossierStatus(testDossier.id, 'termine', 'Impression terminée');
  await delay(2000);
  
  // termine → en_livraison
  await updateDossierStatus(testDossier.id, 'en_livraison', 'Livraison programmée');
  await delay(2000);
  
  // en_livraison → livre
  await updateDossierStatus(testDossier.id, 'livre', 'Livraison effectuée');
  await delay(2000);
  
  // Étape 5: Test de suppression
  console.log('\n5. Test de suppression...');
  await deleteDossier(testDossier.id);
  
  await delay(2000);
  
  console.log('\n✅ Test de synchronisation terminé !');
  console.log('📊 Vérifiez que tous les événements ont été reçus par tous les clients');
  
  // Fermer les connexions
  socket1.disconnect();
  socket2.disconnect();
  socket3.disconnect();
  
  process.exit(0);
}

function waitForConnection(socket, clientName) {
  return new Promise((resolve) => {
    socket.on('connect', () => {
      console.log(`  ✅ ${clientName} connecté (${socket.id})`);
      resolve();
    });
  });
}

function setupEventListeners() {
  const clients = [
    { socket: socket1, name: 'Préparateur' },
    { socket: socket2, name: 'Imprimeur Roland' },
    { socket: socket3, name: 'Admin' }
  ];
  
  clients.forEach(({ socket, name }) => {
    socket.on('dossier_created', (data) => {
      console.log(`  📄 ${name} a reçu: dossier_created - ${data.dossier.numero_commande}`);
    });
    
    socket.on('dossier_updated', (data) => {
      console.log(`  📝 ${name} a reçu: dossier_updated - ${data.dossier.numero_commande} (${data.oldStatus} → ${data.newStatus})`);
    });
    
    socket.on('dossiers_deleted', (data) => {
      console.log(`  🗑️  ${name} a reçu: dossiers_deleted - ${data.ids.length} dossier(s)`);
    });
    
    socket.on('workflow_notification', (data) => {
      console.log(`  ⚡ ${name} a reçu: workflow_notification - ${data.message}`);
    });
    
    socket.on('notification', (data) => {
      console.log(`  🔔 ${name} a reçu: notification - ${data.message}`);
    });
  });
}

async function createTestDossier() {
  const numero = `TEST-SYNC-${Date.now()}`;
  
  const result = await query(`
    INSERT INTO dossiers (
      numero_commande, client_nom, type, status,
      preparateur_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `, [numero, 'Client Test Sync', 'roland', 'en_cours', 2]);
  
  const dossier = result.rows[0];
  
  // Émettre l'événement de création manuellement (pour simuler l'API)
  if (global.notificationService) {
    global.notificationService.sendToAll('dossier_created', {
      dossier,
      createdBy: { userId: 'prep1', role: 'preparateur' }
    });
  }
  
  return dossier;
}

async function updateDossierStatus(dossierId, newStatus, comment) {
  console.log(`  🔄 Changement de statut vers: ${newStatus}`);
  
  // Récupérer l'ancien statut
  const oldResult = await query('SELECT * FROM dossiers WHERE id = $1', [dossierId]);
  const oldStatus = oldResult.rows[0].status;
  
  // Mettre à jour le statut
  const result = await query(`
    UPDATE dossiers 
    SET status = $1, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $2 
    RETURNING *
  `, [newStatus, dossierId]);
  
  const updatedDossier = result.rows[0];
  
  // Enregistrer l'historique
  await query(`
    INSERT INTO dossier_status_history (
      dossier_id, old_status, new_status, changed_by, changed_at, notes
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
  `, [dossierId, oldStatus, newStatus, 1, comment]);
  
  // Émettre l'événement de mise à jour (pour simuler l'API)
  if (global.notificationService) {
    global.notificationService.sendToAll('dossier_updated', {
      dossier: updatedDossier,
      oldStatus,
      newStatus,
      updatedBy: { userId: 'user1', role: 'imprimeur_roland' },
      comment
    });
  }
}

async function deleteDossier(dossierId) {
  console.log(`  🗑️ Suppression du dossier ID: ${dossierId}`);
  
  // Supprimer l'historique
  await query('DELETE FROM dossier_status_history WHERE dossier_id = $1', [dossierId]);
  
  // Supprimer le dossier
  await query('DELETE FROM dossiers WHERE id = $1', [dossierId]);
  
  // Émettre l'événement de suppression (pour simuler l'API)
  if (global.notificationService) {
    global.notificationService.sendToAll('dossiers_deleted', {
      ids: [dossierId],
      deletedBy: { userId: 'admin1', role: 'admin' }
    });
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesse rejetée non gérée:', error);
  process.exit(1);
});

// Lancer le test
main().catch(console.error);