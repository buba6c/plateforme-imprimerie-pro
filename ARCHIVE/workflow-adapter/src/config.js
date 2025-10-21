export const Status = {
  PREPARATION: 'PREPARATION',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  IN_DELIVERY: 'IN_DELIVERY',
  DELIVERED: 'DELIVERED',
  REVISION: 'REVISION'
}

export const Roles = {
  ADMIN: 'ADMIN',
  PREPARATEUR: 'PREPARATEUR',
  IMPRIMEUR: 'IMPRIMEUR',
  IMPRIMEUR_ROLAND: 'IMPRIMEUR_ROLAND',
  IMPRIMEUR_XEROX: 'IMPRIMEUR_XEROX',
  LIVREUR: 'LIVREUR'
}

// Role-based transition map
export const ROLE_TRANSITIONS = {
  [Roles.PREPARATEUR]: {
    [Status.PREPARATION]: [Status.READY],
    [Status.REVISION]: [Status.READY]
  },
  [Roles.IMPRIMEUR]: {
    [Status.READY]: [Status.IN_PROGRESS],
    [Status.IN_PROGRESS]: [Status.COMPLETED, Status.REVISION]
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
}

export const ACTION_LABELS = {
  [Status.PREPARATION]: {
    [Status.READY]: '✅ Marquer prêt'
  },
  [Status.REVISION]: {
    [Status.READY]: '🔄 Corriger et marquer prêt'
  },
  [Status.READY]: {
    [Status.IN_PROGRESS]: "▶️ Commencer l'impression",
    [Status.PREPARATION]: '◀️ Remettre en préparation'
  },
  [Status.IN_PROGRESS]: {
    [Status.COMPLETED]: "✅ Terminer l'impression",
    [Status.REVISION]: '🔄 Demander une révision',
    [Status.READY]: '◀️ Remettre en attente'
  },
  [Status.COMPLETED]: {
    [Status.IN_DELIVERY]: '🚚 Prendre en livraison',
    [Status.IN_PROGRESS]: "◀️ Remettre en impression"
  },
  [Status.IN_DELIVERY]: {
    [Status.DELIVERED]: '📦 Confirmer livraison',
    [Status.COMPLETED]: '◀️ Annuler livraison'
  },
  [Status.DELIVERED]: {
    [Status.IN_DELIVERY]: '🔄 Remettre en livraison'
  }
}

export const ACTION_ICONS = {
  [Status.READY]: '✅',
  [Status.IN_PROGRESS]: '⚙️',
  [Status.COMPLETED]: '✅',
  [Status.IN_DELIVERY]: '🚚',
  [Status.DELIVERED]: '📦',
  [Status.REVISION]: '🔄',
  [Status.PREPARATION]: '📝'
}

export const ACTION_TYPES = {
  [Status.READY]: 'success',
  [Status.IN_PROGRESS]: 'primary',
  [Status.COMPLETED]: 'success',
  [Status.IN_DELIVERY]: 'info',
  [Status.DELIVERED]: 'success',
  [Status.REVISION]: 'warning',
  [Status.PREPARATION]: 'secondary'
}

export const MACHINE_RESTRICTED_ROLES = [Roles.IMPRIMEUR_ROLAND, Roles.IMPRIMEUR_XEROX]
