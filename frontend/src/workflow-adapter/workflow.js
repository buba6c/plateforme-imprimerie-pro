// Workflow constants - Version moderne avec système d'actions
// Synchronisé avec le backend workflow-adapter

export const Statut = {
  EN_COURS: 'en_cours',
  A_REVOIR: 'a_revoir',
  EN_IMPRESSION: 'en_impression',
  TERMINE: 'termine',
  EN_LIVRAISON: 'en_livraison',
  LIVRE: 'livre',
};

export const Roles = {
  ADMIN: 'admin',
  PREPARATEUR: 'preparateur',
  IMPRIMEUR_ROLAND: 'imprimeur_roland',
  IMPRIMEUR_XEROX: 'imprimeur_xerox',
  LIVREUR: 'livreur',
};

export const STATUTS = Object.values(Statut);

// Statuts nécessitant un commentaire
export const COMMENT_REQUIRED_FOR = new Set([Statut.A_REVOIR]);

// Labels en français pour l'affichage
export const STATUT_LABELS = {
  [Statut.EN_COURS]: 'En cours',
  [Statut.A_REVOIR]: 'À revoir',
  [Statut.EN_IMPRESSION]: 'En impression',
  [Statut.TERMINE]: 'Terminé',
  [Statut.EN_LIVRAISON]: 'En livraison',
  [Statut.LIVRE]: 'Livré',
};

// Couleurs pour les badges de statut
export const STATUT_COLORS = {
  [Statut.EN_COURS]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  [Statut.A_REVOIR]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  [Statut.EN_IMPRESSION]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  [Statut.TERMINE]: 'bg-success-100 text-green-800 dark:bg-green-900 dark:text-success-100',
  [Statut.EN_LIVRAISON]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
  [Statut.LIVRE]: 'bg-neutral-100 text-neutral-800 dark:bg-gray-800 dark:text-gray-100',
};

// Icônes pour les statuts
export const STATUT_ICONS = {
  [Statut.EN_COURS]: '📝',
  [Statut.A_REVOIR]: '🔄',
  [Statut.EN_IMPRESSION]: '🖨️',
  [Statut.TERMINE]: '✅',
  [Statut.EN_LIVRAISON]: '🚚',
  [Statut.LIVRE]: '📦',
};

// Types d'actions pour les boutons
export const ACTION_BUTTON_CLASSES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  success: 'bg-success-600 hover:bg-success-700 text-white',
  warning: 'bg-orange-600 hover:bg-yellow-700 text-white',
  info: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-neutral-600 hover:bg-neutral-700 text-white',
};

// Fonctions utilitaires pour le workflow (côté client)
export function getStatutLabel(statut) {
  return STATUT_LABELS[statut] || statut;
}

export function getStatutColor(statut) {
  return STATUT_COLORS[statut] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100';
}

export function getStatutIcon(statut) {
  return STATUT_ICONS[statut] || '❓';
}

// Fonction pour formater une action en bouton
export function formatActionButton(action) {
  return {
    ...action,
    buttonClass: ACTION_BUTTON_CLASSES[action.type] || ACTION_BUTTON_CLASSES.primary,
  };
}

// Fonctions de compatibilité avec l'ancien système
// Note: Ces fonctions sont simplifiées côté frontend
// La logique complète est maintenant côté backend via workflowService

/**
 * Obtient les statuts suivants possibles pour un utilisateur (version simplifiée)
 * @deprecated Utiliser workflowService.getDossierActions() à la place
 */
export function nextStatusesFor({ role, dossierType, currentStatus }) {
  // Version simplifiée pour compatibilité
  // La logique réelle est maintenant dans le backend
  const transitions = {
    admin: Object.values(Status),
    preparateur: currentStatus === Status.A_REVOIR ? [Status.EN_COURS] : [],
    imprimeur_roland:
      {
        [Status.EN_COURS]: [Status.EN_IMPRESSION, Status.A_REVOIR],
        [Status.EN_IMPRESSION]: [Status.TERMINE, Status.A_REVOIR],
      }[currentStatus] || [],
    imprimeur_xerox:
      {
        [Status.EN_COURS]: [Status.EN_IMPRESSION, Status.A_REVOIR],
        [Status.EN_IMPRESSION]: [Status.TERMINE, Status.A_REVOIR],
      }[currentStatus] || [],
    livreur:
      {
        [Status.TERMINE]: [Status.EN_LIVRAISON],
        [Status.EN_LIVRAISON]: [Status.LIVRE],
      }[currentStatus] || [],
  };

  let allowed = transitions[role] || [];

  // Filtrer par type si imprimeur spécialisé
  if (role === 'imprimeur_roland' && dossierType !== 'roland') allowed = [];
  if (role === 'imprimeur_xerox' && dossierType !== 'xerox') allowed = [];

  return allowed;
}

/**
 * Valide une transition côté frontend (version simplifiée)
 * @deprecated Utiliser workflowService.validateStatusChange() à la place
 */
export function validateTransition({ role, dossierType, currentStatus, targetStatus, comment }) {
  const allowedStatuses = nextStatusesFor({ role, dossierType, currentStatus });

  if (!allowedStatuses.includes(targetStatus)) {
    return { valid: false, reason: 'TRANSITION_NOT_ALLOWED' };
  }

  if (COMMENT_REQUIRED_FOR.has(targetStatus) && (!comment || !comment.trim())) {
    return { valid: false, reason: 'COMMENT_REQUIRED' };
  }

  return { valid: true };
}
