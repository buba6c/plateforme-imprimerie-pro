// Test simple du nouveau système de workflow
// Pour exécuter: node test-workflow-adapter.js

const { 
  Status, 
  Roles,
  canTransition, 
  getAvailableActions, 
  canDeleteDossier, 
  canViewDossier, 
  getNotifications,
  validateTransition 
} = require('./backend/constants/workflow');

console.log('🧪 Test du workflow adapter adapté\n');

// Utilisateurs de test
const admin = { id: 'u1', role: Roles.ADMIN };
const preparateur = { id: 'u2', role: Roles.PREPARATEUR };
const imprimeurRoland = { id: 'u3', role: Roles.IMPRIMEUR_ROLAND };
const livreur = { id: 'u4', role: Roles.LIVREUR };

// Dossier de test
const dossier = { 
  id: 'd1', 
  numero: 'IMP-2024-001', 
  statut: Status.EN_COURS, 
  type_formulaire: 'roland', 
  preparateur_id: 'u2' 
};

console.log('=== Test 1: Actions disponibles ===');
console.log('Actions PREPARATEUR pour dossier EN_COURS:', 
  getAvailableActions(preparateur, dossier));
console.log('Actions IMPRIMEUR_ROLAND pour dossier EN_COURS:', 
  getAvailableActions(imprimeurRoland, dossier));
console.log('Actions ADMIN pour dossier EN_COURS:', 
  getAvailableActions(admin, dossier));

console.log('\n=== Test 2: Vérifications de transition ===');
// Préparateur ne peut pas changer le statut de "en_cours" (sauf vers révision corrigée)
console.log('Préparateur EN_COURS → EN_IMPRESSION:', 
  canTransition(preparateur, dossier, Status.EN_IMPRESSION));

// Imprimeur Roland peut changer
console.log('Imprimeur Roland EN_COURS → EN_IMPRESSION:', 
  canTransition(imprimeurRoland, dossier, Status.EN_IMPRESSION));

// Test restrictions par type de machine
const dossierXerox = { ...dossier, type_formulaire: 'xerox' };
console.log('Imprimeur Roland sur dossier XEROX:', 
  canTransition(imprimeurRoland, dossierXerox, Status.EN_IMPRESSION));

console.log('\n=== Test 3: Permissions de vue et suppression ===');
console.log('Préparateur peut voir son dossier:', canViewDossier(preparateur, dossier));
console.log('Livreur peut voir dossier EN_COURS:', canViewDossier(livreur, dossier));
console.log('Préparateur peut supprimer dossier EN_COURS:', canDeleteDossier(preparateur, dossier));

console.log('\n=== Test 4: Validation avec commentaires ===');
const dossierRevision = { ...dossier, statut: Status.EN_IMPRESSION };
console.log('Transition vers A_REVOIR sans commentaire:', 
  validateTransition(imprimeurRoland, dossierRevision, Status.A_REVOIR, ''));
console.log('Transition vers A_REVOIR avec commentaire:', 
  validateTransition(imprimeurRoland, dossierRevision, Status.A_REVOIR, 'Problème de qualité'));

console.log('\n=== Test 5: Notifications ===');
const notifications = getNotifications(dossier, Status.EN_COURS, Status.EN_IMPRESSION, admin);
console.log('Notifications EN_COURS → EN_IMPRESSION:', 
  notifications.map(n => ({ type: n.type, message: n.message })));

const notificationsTermine = getNotifications(dossier, Status.EN_IMPRESSION, Status.TERMINE, imprimeurRoland);
console.log('Notifications EN_IMPRESSION → TERMINE:', 
  notificationsTermine.map(n => ({ type: n.type, targetRoles: n.targetRoles })));

console.log('\n✅ Tests terminés avec succès !');