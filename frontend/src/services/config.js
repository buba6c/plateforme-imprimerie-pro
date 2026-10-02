// ✅ CORRECTION: Statuts unifiés avec l'application (pret_impression au lieu de a_imprimer)
export const Status = {
  NOUVEAU: 'nouveau',
  EN_COURS: 'en_cours',
  A_REVOIR: 'a_revoir',
  PRET_IMPRESSION: 'pret_impression',  // ✅ Changé de a_imprimer
  EN_IMPRESSION: 'en_impression',
  IMPRIME: 'imprime',  // ✅ Ajouté
  PRET_LIVRAISON: 'pret_livraison',  // ✅ Changé de a_livrer
  EN_LIVRAISON: 'en_livraison',
  LIVRE: 'livre',
  TERMINE: 'termine',
  // ⚠️ Alias pour compatibilité temporaire
  A_IMPRIMER: 'pret_impression',
  A_LIVRER: 'pret_livraison',
};

// ✅ CORRECTION: Rôles en minuscules pour correspondre à la DB
export const Roles = {
  ADMIN: 'admin',
  PREPARATEUR: 'preparateur',
  IMPRIMEUR: 'imprimeur',
  IMPRIMEUR_ROLAND: 'imprimeur_roland',
  IMPRIMEUR_XEROX: 'imprimeur_xerox',
  LIVREUR: 'livreur',
};

// ✅ WORKFLOW UNIFIÉ - Statuts corrigés (pret_impression, imprime, pret_livraison)
export const ROLE_TRANSITIONS = {
  [Roles.PREPARATEUR]: {
    [Status.NOUVEAU]: [Status.PRET_IMPRESSION, Status.A_REVOIR],
    [Status.EN_COURS]: [Status.PRET_IMPRESSION, Status.A_REVOIR],
    [Status.A_REVOIR]: [Status.PRET_IMPRESSION, Status.EN_COURS],
  },
  [Roles.IMPRIMEUR]: {
    [Status.PRET_IMPRESSION]: [Status.EN_IMPRESSION, Status.A_REVOIR],
    [Status.EN_IMPRESSION]: [Status.IMPRIME, Status.A_REVOIR],
    [Status.IMPRIME]: [Status.PRET_LIVRAISON],
    [Status.PRET_LIVRAISON]: [Status.A_REVOIR],
  },
  [Roles.IMPRIMEUR_ROLAND]: {
    [Status.PRET_IMPRESSION]: [Status.EN_IMPRESSION, Status.A_REVOIR],
    [Status.EN_IMPRESSION]: [Status.IMPRIME, Status.A_REVOIR],
    [Status.IMPRIME]: [Status.PRET_LIVRAISON],
    [Status.PRET_LIVRAISON]: [Status.A_REVOIR],
  },
  [Roles.IMPRIMEUR_XEROX]: {
    [Status.PRET_IMPRESSION]: [Status.EN_IMPRESSION, Status.A_REVOIR],
    [Status.EN_IMPRESSION]: [Status.IMPRIME, Status.A_REVOIR],
    [Status.IMPRIME]: [Status.PRET_LIVRAISON],
    [Status.PRET_LIVRAISON]: [Status.A_REVOIR],
  },
  [Roles.LIVREUR]: {
    [Status.PRET_LIVRAISON]: [Status.EN_LIVRAISON],
    [Status.EN_LIVRAISON]: [Status.LIVRE],
    [Status.LIVRE]: [Status.TERMINE],
  },
  [Roles.ADMIN]: {
    [Status.NOUVEAU]: [Status.PRET_IMPRESSION, Status.A_REVOIR],
    [Status.EN_COURS]: [Status.PRET_IMPRESSION, Status.A_REVOIR],
    [Status.PRET_IMPRESSION]: [Status.EN_IMPRESSION, Status.A_REVOIR, Status.EN_COURS],
    [Status.EN_IMPRESSION]: [Status.IMPRIME, Status.A_REVOIR, Status.PRET_IMPRESSION],
    [Status.IMPRIME]: [Status.PRET_LIVRAISON, Status.A_REVOIR, Status.EN_IMPRESSION],
    [Status.PRET_LIVRAISON]: [Status.EN_LIVRAISON, Status.A_REVOIR, Status.IMPRIME],
    [Status.EN_LIVRAISON]: [Status.LIVRE, Status.PRET_LIVRAISON],
    [Status.LIVRE]: [Status.TERMINE, Status.EN_LIVRAISON],
    [Status.TERMINE]: [],
    [Status.A_REVOIR]: [Status.EN_COURS, Status.PRET_IMPRESSION],
  },
};

// ✅ ACTION_LABELS avec statuts corrigés
export const ACTION_LABELS = {
  [Status.NOUVEAU]: {
    [Status.PRET_IMPRESSION]: '✓ Marquer prêt pour impression',
    [Status.A_REVOIR]: '⚠️ Renvoyer à revoir',
  },
  [Status.EN_COURS]: {
    [Status.PRET_IMPRESSION]: '✓ Marquer prêt pour impression',
    [Status.A_REVOIR]: '⚠️ Renvoyer à revoir',
  },
  [Status.A_REVOIR]: {
    [Status.PRET_IMPRESSION]: '🔄 Revalider et marquer prêt',
    [Status.EN_COURS]: '↩️ Remettre en préparation',
  },
  [Status.PRET_IMPRESSION]: {
    [Status.EN_IMPRESSION]: "🎬 Démarrer impression",
    [Status.A_REVOIR]: '⚠️ Renvoyer à revoir',
  },
  [Status.EN_IMPRESSION]: {
    [Status.IMPRIME]: '✓ Marquer comme imprimé',
    [Status.A_REVOIR]: '⚠️ Renvoyer à revoir',
  },
  [Status.IMPRIME]: {
    [Status.PRET_LIVRAISON]: '📦 Marquer prêt livraison',
  },
  [Status.PRET_LIVRAISON]: {
    [Status.EN_LIVRAISON]: '🚚 Démarrer livraison',
    [Status.A_REVOIR]: '⚠️ Renvoyer à revoir',
  },
  [Status.EN_LIVRAISON]: {
    [Status.LIVRE]: '✅ Marquer comme livré',
  },
  [Status.LIVRE]: {
    [Status.TERMINE]: '🏁 Marquer comme terminé',
  },
};

export const ACTION_ICONS = {
  [Status.READY]: '✅',
  [Status.IN_PROGRESS]: '⚙️',
  [Status.COMPLETED]: '✅',
  [Status.IN_DELIVERY]: '🚚',
  [Status.DELIVERED]: '📦',
  [Status.REVISION]: '🔄',
  [Status.PREPARATION]: '📝',
};

export const ACTION_TYPES = {
  [Status.READY]: 'success',
  [Status.IN_PROGRESS]: 'primary',
  [Status.COMPLETED]: 'success',
  [Status.IN_DELIVERY]: 'info',
  [Status.DELIVERED]: 'success',
  [Status.REVISION]: 'warning',
  [Status.PREPARATION]: 'secondary',
};

export const MACHINE_RESTRICTED_ROLES = [Roles.IMPRIMEUR_ROLAND, Roles.IMPRIMEUR_XEROX];
