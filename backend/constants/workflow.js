// Workflow adapter intégré - Version moderne avec fonctions avancées
// Remplace l'ancien système par une approche plus flexible et maintenable

const {
  Statut,
  Roles,
  ROLE_TRANSITIONS,
  COMMENT_REQUIRED_FOR,
  canTransition,
  getAvailableActions,
  canDeleteDossier,
  canViewDossier,
  getNotifications,
  validateTransition,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_TYPES,
} = require('../services/workflow-adapter');

// Export des constantes pour compatibilité avec l'ancien code
const STATUTS = Object.values(Statut);
const ROLES_LIST = Object.values(Roles);

// Fonction de compatibilité avec l'ancien système
function canTransitionLegacy({ role, dossierType, currentStatut, targetStatut }) {
  const user = { role };
  const dossier = { statut: currentStatut, type_formulaire: dossierType };
  const result = canTransition(user, dossier, targetStatut);
  return result.allowed;
}

// Fonction de validation compatible avec l'ancien système
function validateTransitionLegacy({ role, dossierType, currentStatut, targetStatut, comment }) {
  const user = { role };
  const dossier = { statut: currentStatut, type_formulaire: dossierType };
  return validateTransition(user, dossier, targetStatut, comment);
}

module.exports = {
  // Nouvelles exports du workflow adapter
  Statut,
  Roles,
  ROLE_TRANSITIONS,
  COMMENT_REQUIRED_FOR,
  canTransition,
  getAvailableActions,
  canDeleteDossier,
  canViewDossier,
  getNotifications,
  validateTransition,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_TYPES,

  // Exports legacy pour compatibilité
  STATUTS,
  ROLES: ROLES_LIST,
  // Utiliser les mêmes fonctions mais avec des noms legacy
  canTransitionLegacy: canTransitionLegacy,
  validateTransitionLegacy: validateTransitionLegacy,
};
