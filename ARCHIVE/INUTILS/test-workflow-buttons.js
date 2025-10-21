#!/usr/bin/env node
/**
 * Test automatisé des boutons d'actions workflow sur l'interface
 * Simule les actions que l'utilisateur verrait dans DossierDetailsFixed
 */

// Import des fonctions workflow (simulation pour test standalone)
const Status = {
  PREPARATION: 'PREPARATION',
  READY: 'READY', 
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  IN_DELIVERY: 'IN_DELIVERY',
  DELIVERED: 'DELIVERED',
  REVISION: 'REVISION'
};

const Roles = {
  ADMIN: 'ADMIN',
  PREPARATEUR: 'PREPARATEUR', 
  IMPRIMEUR_ROLAND: 'IMPRIMEUR_ROLAND',
  IMPRIMEUR_XEROX: 'IMPRIMEUR_XEROX',
  LIVREUR: 'LIVREUR'
};

const ROLE_TRANSITIONS = {
  [Roles.PREPARATEUR]: {
    [Status.PREPARATION]: [Status.READY],
    [Status.REVISION]: [Status.READY]
  },
  [Roles.IMPRIMEUR_ROLAND]: {
    [Status.READY]: [Status.IN_PROGRESS],
    [Status.IN_PROGRESS]: [Status.COMPLETED, Status.REVISION]
  },
  [Roles.IMPRIMEUR_XEROX]: {
    [Status.READY]: [Status.IN_PROGRESS], 
    [Status.IN_PROGRESS]: [Status.COMPLETED, Status.REVISION]
  },
  [Roles.LIVREUR]: {
    [Status.COMPLETED]: [Status.IN_DELIVERY],
    [Status.IN_DELIVERY]: [Status.DELIVERED]
  },
  [Roles.ADMIN]: {
    [Status.PREPARATION]: [Status.READY, Status.REVISION],
    [Status.READY]: [Status.IN_PROGRESS, Status.PREPARATION],
    [Status.IN_PROGRESS]: [Status.COMPLETED, Status.REVISION, Status.READY],
    [Status.COMPLETED]: [Status.IN_DELIVERY, Status.IN_PROGRESS],
    [Status.IN_DELIVERY]: [Status.DELIVERED, Status.COMPLETED],
    [Status.DELIVERED]: [Status.IN_DELIVERY],
    [Status.REVISION]: [Status.READY, Status.PREPARATION]
  }
};

const ACTION_LABELS = {
  [Status.PREPARATION]: { [Status.READY]: '✅ Valider' },
  [Status.REVISION]: { [Status.READY]: '🔄 Revalider' },
  [Status.READY]: { 
    [Status.IN_PROGRESS]: "▶️ Démarrer l'impression",
    [Status.PREPARATION]: '◀️ Remettre en préparation'
  },
  [Status.IN_PROGRESS]: {
    [Status.COMPLETED]: "✅ Terminer l'impression", 
    [Status.REVISION]: '↩️ Renvoyer au Préparateur',
    [Status.READY]: '◀️ Remettre en attente'
  },
  [Status.COMPLETED]: {
    [Status.IN_DELIVERY]: '🚚 Prendre en livraison',
    [Status.IN_PROGRESS]: '◀️ Remettre en impression'
  },
  [Status.IN_DELIVERY]: {
    [Status.DELIVERED]: '📦 Valider livraison (Terminer)',
    [Status.COMPLETED]: '◀️ Annuler livraison'
  },
  [Status.DELIVERED]: {
    [Status.IN_DELIVERY]: '🔄 Remettre en livraison'
  }
};

// Fonctions utilitaires
function mapAppRoleToAdapter(role) {
  return {
    admin: Roles.ADMIN,
    preparateur: Roles.PREPARATEUR,
    imprimeur_roland: Roles.IMPRIMEUR_ROLAND,
    imprimeur_xerox: Roles.IMPRIMEUR_XEROX,
    livreur: Roles.LIVREUR
  }[role] || role;
}

function mapAppStatusToAdapter(status) {
  return {
    en_cours: Status.PREPARATION,
    a_revoir: Status.REVISION,
    en_impression: Status.IN_PROGRESS,
    termine: Status.COMPLETED,
    pret_livraison: Status.COMPLETED,
    en_livraison: Status.IN_DELIVERY,
    livre: Status.DELIVERED
  }[status] || status;
}

function mapAdapterStatusToApp(status) {
  return {
    [Status.PREPARATION]: 'en_cours',
    [Status.READY]: 'en_cours', // Mapping ajouté
    [Status.REVISION]: 'a_revoir',
    [Status.IN_PROGRESS]: 'en_impression',
    [Status.COMPLETED]: 'termine',
    [Status.IN_DELIVERY]: 'en_livraison',
    [Status.DELIVERED]: 'livre'
  }[status] || status;
}

function canTransition(user, job, newStatus) {
  const roleMap = ROLE_TRANSITIONS[user.role];
  if (!roleMap) return { allowed: false, reason: `Rôle ${user.role} non autorisé` };
  
  const allowedFrom = roleMap[job.status];
  if (!allowedFrom || !allowedFrom.includes(newStatus)) {
    return { allowed: false, reason: `Transition ${job.status} → ${newStatus} non autorisée` };
  }
  
  // Vérifications spécifiques
  switch (user.role) {
    case Roles.PREPARATEUR:
      if (job.createdById !== user.id) {
        return { allowed: false, reason: 'Vous ne pouvez modifier que vos propres dossiers' };
      }
      break;
    case Roles.IMPRIMEUR_ROLAND:
      if (job.machineType !== 'roland') {
        return { allowed: false, reason: 'Vous ne pouvez traiter que les jobs Roland' };
      }
      break;
    case Roles.IMPRIMEUR_XEROX:
      if (job.machineType !== 'xerox') {
        return { allowed: false, reason: 'Vous ne pouvez traiter que les jobs Xerox' };
      }
      break;
  }
  
  return { allowed: true };
}

function getAvailableActions(user, job) {
  const roleMap = ROLE_TRANSITIONS[user.role];
  const current = job.status;
  const actions = [];
  
  if (!roleMap || !roleMap[current]) return actions;
  
  for (const next of roleMap[current]) {
    const check = canTransition(user, job, next);
    if (check.allowed) {
      actions.push({
        status: next,
        label: ACTION_LABELS[current]?.[next] || `Passer en ${next}`,
        icon: '🔄',
        type: 'primary'
      });
    }
  }
  return actions;
}

// Simulation des rôles utilisateurs
const roles = {
  admin: { id: 1, role: 'admin' },
  preparateur: { id: 2, role: 'preparateur' },
  imprimeur_roland: { id: 3, role: 'imprimeur_roland' },
  imprimeur_xerox: { id: 4, role: 'imprimeur_xerox' },
  livreur: { id: 5, role: 'livreur' }
};

// Statuts de test selon l'application
const appStatuses = ['en_cours', 'a_revoir', 'en_impression', 'termine', 'en_livraison', 'livre'];

// Dossiers de test
const testDossiers = {
  roland: {
    id: 'dossier-1',
    numero_commande: 'TEST-001',
    type: 'roland',
    created_by: 2, // créé par préparateur
    createdById: 2
  },
  xerox: {
    id: 'dossier-2', 
    numero_commande: 'TEST-002',
    type: 'xerox',
    created_by: 2,
    createdById: 2
  }
};

function testWorkflowButtons() {
  console.log('🧪 Test des boutons d\'actions workflow\n');
  console.log('=' + '='.repeat(60) + '\n');

  // Test par rôle et statut
  Object.entries(roles).forEach(([roleName, user]) => {
    console.log(`👤 RÔLE: ${roleName.toUpperCase()}`);
    console.log('-'.repeat(40));

    ['roland', 'xerox'].forEach(machineType => {
      console.log(`\n📱 Machine: ${machineType.toUpperCase()}`);
      
      appStatuses.forEach(appStatus => {
        // Construire le job pour l'adapter
        const dossier = {
          ...testDossiers[machineType],
          status: appStatus, // statut app
          statut: appStatus
        };

        // Convertir pour l'adapter
        const job = {
          status: mapAppStatusToAdapter(dossier.status),
          machineType: dossier.type,
          jobNumber: dossier.numero_commande,
          createdById: dossier.created_by
        };
        
        const adaptedUser = { 
          id: user.id, 
          role: mapAppRoleToAdapter(user.role) 
        };

        // Obtenir les actions depuis l'adapter
        let actions = getAvailableActions(adaptedUser, job);

        // Appliquer les filtres du composant DossierDetailsFixed
        if (user.role === 'preparateur') {
          actions = actions.filter(a => {
            const next = mapAdapterStatusToApp(a.status);
            return (
              ['en_impression'].includes(next) ||
              a.label.includes('Valider') ||
              a.label.includes('Revalider')
            );
          });
        } else if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
          actions = actions.filter(a => {
            const next = mapAdapterStatusToApp(a.status);
            return ['a_revoir', 'en_impression', 'termine'].includes(next);
          });
        } else if (user.role === 'livreur') {
          // Livreur: actions spéciales gérées séparément
          actions = [];
          
          // Actions livreur selon statut
          if (['termine', 'pret_livraison'].includes(dossier.status)) {
            actions.push({ label: 'Programmer livraison', status: 'en_livraison', type: 'secondary' });
          }
          if (['en_livraison'].includes(dossier.status)) {
            actions.push({ label: 'Valider livraison (Terminer)', status: 'livre', type: 'success' });
          }
        }

        // Afficher résultat
        const statusDisplay = `${appStatus}${job.status !== appStatus ? ` (${job.status})` : ''}`;
        
        if (actions.length > 0) {
          console.log(`  📊 ${statusDisplay}:`);
          actions.forEach(action => {
            const targetApp = mapAdapterStatusToApp(action.status);
            const arrow = targetApp !== action.status ? ` → ${targetApp}` : '';
            console.log(`    ✅ "${action.label}" (${action.status}${arrow})`);
          });
        } else {
          console.log(`  📊 ${statusDisplay}: Aucune action`);
        }
      });
    });

    console.log('\n');
  });

  // Test spécifique: validation préparateur
  console.log('🔍 TEST SPÉCIFIQUE: Validation préparateur\n');
  console.log('-'.repeat(50));
  
  const prep = roles.preparateur;
  const dossierEnCours = {
    ...testDossiers.roland,
    status: 'en_cours',
    statut: 'en_cours'
  };

  console.log('Scénario: Préparateur valide son dossier en_cours');
  console.log(`  Dossier: ${dossierEnCours.numero_commande} (créé par user ${dossierEnCours.created_by})`);
  console.log(`  Utilisateur: ${prep.id} (${prep.role})`);
  
  // Test canPreparatorValidate logic
  const statusPrep = ['en_cours', 'a_revoir', 'PREPARATION', 'REVISION'];
  const isStatusOk = statusPrep.includes(dossierEnCours.status);
  const isOwner = dossierEnCours.created_by === prep.id;
  
  console.log(`  ✓ Statut autorisé: ${isStatusOk} (${dossierEnCours.status})`);
  console.log(`  ✓ Propriétaire: ${isOwner} (${dossierEnCours.created_by} === ${prep.id})`);
  console.log(`  → Bouton "Valider" ${isStatusOk && isOwner ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);

  // Test après validation (simulation)
  console.log('\nAprès validation (PREPARATION → READY):');
  // Le validateDossier() côté backend changerait le statut en READY
  // Mais côté frontend, READY est mappé vers en_cours
  console.log('  Backend: PREPARATION → READY');
  console.log('  Frontend affiché: en_cours → en_cours (pas de changement visible)');
  console.log('  💡 Suggestion: Afficher un toast "Dossier validé" ou distinguer READY');

  // Test imprimeur après validation
  console.log('\n🔍 TEST: Imprimeur voit le dossier validé\n');
  const imp = roles.imprimeur_roland;
  
  // Dossier avec statut READY (mappé en_cours côté UI)
  const jobReady = {
    status: 'READY', // statut adapter après validation
    machineType: 'roland',
    jobNumber: 'TEST-001',
    createdById: 2
  };
  
  const adaptedImp = { id: imp.id, role: mapAppRoleToAdapter(imp.role) };
  const actionsReady = getAvailableActions(adaptedImp, jobReady);
  
  console.log('Imprimeur Roland voit dossier validé (READY):');
  actionsReady.forEach(action => {
    const targetApp = mapAdapterStatusToApp(action.status);
    console.log(`  ✅ "${action.label}" (${action.status} → ${targetApp})`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Test terminé - Vérifiez les actions attendues ci-dessus');
}

// Exécuter le test
try {
  testWorkflowButtons();
} catch (error) {
  console.error('❌ Erreur lors du test:', error);
  console.error('Stack:', error.stack);
}