// Workflow adapter adapté pour la plateforme d'imprimerie (CommonJS compatible)
// Version française avec statuts et rôles existants

// 🆕 Import du système centralisé de mapping des statuts
const {
  DB_STATUTS,
  API_STATUTS,
  normalizeToDb,
  normalizeFromDb,
} = require('../constants/status-mapping');

// Utiliser les statuts API pour le workflow
const Statut = API_STATUTS;

const Roles = {
  ADMIN: 'admin',
  PREPARATEUR: 'preparateur',
  IMPRIMEUR_ROLAND: 'imprimeur_roland',
  IMPRIMEUR_XEROX: 'imprimeur_xerox',
  LIVREUR: 'livreur',
};

// Mapping des types de machine vers les rôles
const MACHINE_TYPE_ROLES = {
  roland: Roles.IMPRIMEUR_ROLAND,
  xerox: Roles.IMPRIMEUR_XEROX,
};

// Transitions autorisées par rôle (from → [to])
// 🔧 Workflow correct selon logique métier validée
const ROLE_TRANSITIONS = {
  [Roles.PREPARATEUR]: {
    // Préparateur peut uniquement valider/revalider ses dossiers
    // Ne peut PAS marquer "À revoir" (seuls admin/imprimeur peuvent)
    [Statut.EN_COURS]: [Statut.PRET_IMPRESSION],      // Valider
    [Statut.A_REVOIR]: [Statut.PRET_IMPRESSION],      // Revalider (après corrections)
  },
  [Roles.IMPRIMEUR_ROLAND]: {
    // Workflow simplifié en 2 étapes (plus de statut "imprime" intermédiaire)
    [Statut.PRET_IMPRESSION]: [Statut.EN_IMPRESSION, Statut.A_REVOIR], // Démarrer OU Demander révision
    [Statut.EN_IMPRESSION]: [Statut.PRET_LIVRAISON, Statut.A_REVOIR],  // Imprimer OU Demander révision
  },
  [Roles.IMPRIMEUR_XEROX]: {
    // Workflow simplifié en 2 étapes (identique à Roland)
    [Statut.PRET_IMPRESSION]: [Statut.EN_IMPRESSION, Statut.A_REVOIR], // Démarrer OU Demander révision
    [Statut.EN_IMPRESSION]: [Statut.PRET_LIVRAISON, Statut.A_REVOIR],  // Imprimer OU Demander révision
  },
  [Roles.LIVREUR]: {
    // Livreur peut prendre en charge dès la sortie de l'impression
    [Statut.IMPRIME]: [Statut.PRET_LIVRAISON, Statut.EN_LIVRAISON, Statut.LIVRE], // 3 options flexibles
    // Livreur a 2 options depuis "Prêt livraison" : programmer OU livrer directement
    [Statut.PRET_LIVRAISON]: [Statut.EN_LIVRAISON, Statut.LIVRE], // Programmer livraison OU Livrer direct
    [Statut.EN_LIVRAISON]: [Statut.LIVRE],                         // Livrer (confirmer livraison)
    // Livreur ne peut PAS marquer "Terminé" - réservé à l'admin
  },
  [Roles.ADMIN]: {
    // Admin peut tout faire + rollback + forcer transitions
    [Statut.EN_COURS]: [Statut.PRET_IMPRESSION, Statut.A_REVOIR],
    [Statut.A_REVOIR]: [Statut.EN_COURS, Statut.PRET_IMPRESSION],
    [Statut.PRET_IMPRESSION]: [Statut.EN_IMPRESSION, Statut.EN_COURS, Statut.A_REVOIR],
    [Statut.EN_IMPRESSION]: [Statut.PRET_LIVRAISON, Statut.PRET_IMPRESSION, Statut.A_REVOIR],
    [Statut.PRET_LIVRAISON]: [Statut.EN_LIVRAISON, Statut.LIVRE, Statut.EN_IMPRESSION],
    [Statut.EN_LIVRAISON]: [Statut.LIVRE, Statut.PRET_LIVRAISON],
    [Statut.LIVRE]: [Statut.TERMINE, Statut.EN_LIVRAISON],
    [Statut.TERMINE]: [Statut.LIVRE],
  },
};

// Labels des actions en français (selon workflow métier)
const ACTION_LABELS = {
  // PRÉPARATEUR
  [Statut.EN_COURS]: {
    [Statut.PRET_IMPRESSION]: '✅ Valider le dossier',
  },
  [Statut.A_REVOIR]: {
    [Statut.PRET_IMPRESSION]: '✅ Revalider le dossier',
  },
  // IMPRIMEUR (Workflow simplifié 2 étapes)
  [Statut.PRET_IMPRESSION]: {
    [Statut.EN_IMPRESSION]: '🖨️ Démarrer l\'impression',
    [Statut.EN_COURS]: '◀️ Renvoyer en préparation',
    [Statut.A_REVOIR]: '🔄 Demander révision',
  },
  [Statut.EN_IMPRESSION]: {
    [Statut.PRET_LIVRAISON]: '✅ Marquer comme imprimé', // Direct vers prêt livraison
    [Statut.PRET_IMPRESSION]: '◀️ Annuler impression',
    [Statut.A_REVOIR]: '🔄 Demander révision',
  },
  // LIVREUR (Workflow complet depuis impression jusqu'à terminé)
  [Statut.IMPRIME]: {
    [Statut.PRET_LIVRAISON]: '📦 Préparer la livraison',
    [Statut.EN_LIVRAISON]: '📅 Programmer livraison',
    [Statut.LIVRE]: '🚚 Livrer directement',
  },
  [Statut.PRET_LIVRAISON]: {
    [Statut.EN_LIVRAISON]: '📅 Programmer la livraison',
    [Statut.LIVRE]: '🚚 Livrer directement',
    [Statut.EN_IMPRESSION]: '◀️ Renvoyer en impression',
  },
  [Statut.EN_LIVRAISON]: {
    [Statut.LIVRE]: '✅ Confirmer la livraison',
    [Statut.PRET_LIVRAISON]: '◀️ Annuler la livraison',
  },
  [Statut.LIVRE]: {
    [Statut.EN_LIVRAISON]: '◀️ Remettre en livraison',
    [Statut.TERMINE]: '✅ Terminer le dossier', // Admin uniquement
  },
  [Statut.TERMINE]: {
    [Statut.LIVRE]: '◀️ Rouvrir le dossier',
  },
};

const ACTION_ICONS = {
  [Statut.EN_COURS]: '📝',
  [Statut.A_REVOIR]: '🔄',
  [Statut.PRET_IMPRESSION]: '📋',
  [Statut.EN_IMPRESSION]: '🖨️',
  [Statut.PRET_LIVRAISON]: '📦',
  [Statut.EN_LIVRAISON]: '🚚',
  [Statut.LIVRE]: '✅',
  [Statut.TERMINE]: '🏁',
};

const ACTION_TYPES = {
  [Statut.EN_COURS]: 'primary',
  [Statut.A_REVOIR]: 'warning',
  [Statut.PRET_IMPRESSION]: 'info',
  [Statut.EN_IMPRESSION]: 'info',
  [Statut.PRET_LIVRAISON]: 'primary',
  [Statut.EN_LIVRAISON]: 'info',
  [Statut.LIVRE]: 'success',
  [Statut.TERMINE]: 'success',
};

// Statuts nécessitant un commentaire
const COMMENT_REQUIRED_FOR = new Set([Statut.A_REVOIR]);

// Fonctions principales du workflow
function ensureArray(v) {
  return Array.isArray(v) ? v : v != null ? [v] : [];
}
function canTransition(user, dossier, newStatus) {
  const userRole = user.role;
  // 🔧 Normaliser les statuts depuis la DB vers les codes API
  const currentStatus = normalizeFromDb(dossier.statut || dossier.status || dossier.state);
  const targetStatus = normalizeFromDb(newStatus);

  const roleMap = ROLE_TRANSITIONS[userRole];
  if (!roleMap) {
    return { allowed: false, reason: `Rôle ${userRole} non autorisé à modifier les statuts` };
  }

  const allowedFrom = roleMap[currentStatus];
  if (!allowedFrom || !allowedFrom.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transition ${currentStatus} → ${targetStatus} non autorisée pour ${userRole}`,
    };
  }

  // Vérifications spécifiques par rôle
  switch (userRole) {
    case Roles.PREPARATEUR:
      // Le préparateur ne peut modifier que ses propres dossiers
      if (dossier.preparateur_id && dossier.preparateur_id !== user.id) {
        return { allowed: false, reason: 'Vous ne pouvez modifier que vos propres dossiers' };
      }
      break;
    case Roles.IMPRIMEUR_ROLAND:
      if (dossier.type !== 'roland') {
        return { allowed: false, reason: 'Vous ne pouvez traiter que les dossiers Roland' };
      }
      break;
    case Roles.IMPRIMEUR_XEROX:
      if (dossier.type !== 'xerox') {
        return { allowed: false, reason: 'Vous ne pouvez traiter que les dossiers Xerox' };
      }
      break;
  }

  return { allowed: true };
}

function getAvailableActions(user, dossier) {
  const roleMap = ROLE_TRANSITIONS[user.role];
  const current = dossier.status || dossier.statut || dossier.state;
  const actions = [];

  if (!roleMap || !roleMap[current]) return actions;

  for (const next of roleMap[current]) {
    const check = canTransition(user, dossier, next);
    if (check.allowed) {
      actions.push({
        status: next,
        label: ACTION_LABELS[current]?.[next] || `Passer en ${next}`,
        icon: ACTION_ICONS[next] || '🔄',
        type: ACTION_TYPES[next] || 'primary',
      });
    }
  }
  return actions;
}

function canDeleteDossier(user, dossier) {
  const currentStatus = normalizeFromDb(dossier.status || dossier.statut || dossier.state);

  // Préparateur : peut supprimer ses dossiers UNIQUEMENT s'ils ne sont PAS VALIDÉS
  // Statuts autorisés pour suppression : nouveau, en_cours, a_revoir
  // Une fois validé (pret_impression et après), suppression interdite
  if (
    user.role === Roles.PREPARATEUR &&
    dossier.preparateur_id === user.id &&
    (currentStatus === Statut.EN_COURS || currentStatus === Statut.A_REVOIR)
  ) {
    return { allowed: true, reason: 'Dossier non validé, suppression autorisée' };
  }
  
  // Admin peut toujours supprimer
  if (user.role === Roles.ADMIN) {
    return { allowed: true, reason: 'Administrateur' };
  }
  
  return { 
    allowed: false, 
    reason: 'Vous ne pouvez supprimer que vos dossiers non validés (en cours ou à revoir)' 
  };
}

function canViewDossier(user, dossier) {
  const currentStatus = normalizeFromDb(dossier.status || dossier.statut || dossier.state);

  switch (user.role) {
    case Roles.ADMIN:
      return true;
    case Roles.PREPARATEUR:
      return dossier.preparateur_id === user.id;
    case Roles.IMPRIMEUR_ROLAND:
      return (
        dossier.type === 'roland' &&
        [Statut.PRET_IMPRESSION, Statut.EN_IMPRESSION, Statut.PRET_LIVRAISON].includes(currentStatus)
      );
    case Roles.IMPRIMEUR_XEROX:
      return (
        dossier.type === 'xerox' &&
        [Statut.PRET_IMPRESSION, Statut.EN_IMPRESSION, Statut.PRET_LIVRAISON].includes(currentStatus)
      );
    case Roles.LIVREUR:
      // Livreur voit les dossiers depuis la sortie d'impression jusqu'à terminé
      return [Statut.IMPRIME, Statut.PRET_LIVRAISON, Statut.EN_LIVRAISON, Statut.LIVRE, Statut.TERMINE].includes(currentStatus);
    default:
      return false;
  }
}

function getNotifications(dossier, oldStatus, newStatus, changedBy) {
  const notifications = [];

  if (newStatus === Statut.EN_IMPRESSION) {
    // Notification : dossier pris en charge par imprimeur
    notifications.push({
      targetRoles: [Roles.ADMIN],
      targetUsers: dossier.preparateur_id ? [dossier.preparateur_id] : [],
      type: 'dossierStarted',
      message: `Dossier ${dossier.numero_commande} pris en charge pour impression`,
      dossier,
      changedBy,
    });
  } else if (newStatus === Statut.PRET_LIVRAISON) {
    // Notification : dossier prêt pour livraison
    notifications.push({
      targetRoles: [Roles.LIVREUR, Roles.ADMIN],
      type: 'dossierReady',
      message: `Dossier ${dossier.numero_commande} prêt pour livraison`,
      dossier,
      changedBy,
    });
  } else if (newStatus === Statut.A_REVOIR) {
    // Notification : révision demandée
    notifications.push({
      targetUsers: dossier.preparateur_id ? [dossier.preparateur_id] : [],
      targetRoles: [Roles.ADMIN],
      type: 'dossierNeedsRevision',
      message: `Révision demandée pour le dossier ${dossier.numero_commande}`,
      dossier,
      changedBy,
    });
  } else if (newStatus === Statut.LIVRE) {
    // Notification : dossier livré
    notifications.push({
      targetUsers: dossier.preparateur_id ? [dossier.preparateur_id] : [],
      targetRoles: [Roles.ADMIN],
      type: 'dossierDelivered',
      message: `Dossier ${dossier.numero_commande} livré avec succès`,
      dossier,
      changedBy,
    });
  }

  return notifications;
}

// Validation complète d'une transition
function validateTransition(user, dossier, newStatus, comment) {
  const transition = canTransition(user, dossier, newStatus);
  if (!transition.allowed) {
    return { valid: false, reason: transition.reason };
  }

  if (COMMENT_REQUIRED_FOR.has(newStatus) && (!comment || !comment.trim())) {
    return { valid: false, reason: 'Un commentaire est requis pour cette action' };
  }

  return { valid: true };
}

module.exports = {
  Statut,
  Roles,
  MACHINE_TYPE_ROLES,
  ROLE_TRANSITIONS,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_TYPES,
  COMMENT_REQUIRED_FOR,
  canTransition,
  getAvailableActions,
  canDeleteDossier,
  canViewDossier,
  getNotifications,
  validateTransition,
};
