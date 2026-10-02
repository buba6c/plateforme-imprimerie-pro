// Convertit un statut français (backend/historique) en statut métier app
export function mapFrenchStatutToApp(statut) {
  if (!statut) return '';
  const mapping = {
    'En cours': 'en_cours',
    'A revoir': 'a_revoir',
    'À revoir': 'a_revoir',
    'Prêt impression': 'pret_impression',
    'Pret impression': 'pret_impression',
    'En impression': 'en_impression',
    'Imprimé': 'imprime',
    'Prêt livraison': 'pret_livraison',
    'Pret livraison': 'pret_livraison',
    'En livraison': 'en_livraison',
    'Livré': 'livre',
    'Terminé': 'termine',
    'Nouveau': 'en_cours', // alias rétro-compatible
    'En préparation': 'en_cours', // alias rétro-compatible
    'Préparation': 'en_cours',
    'Révision': 'a_revoir',
  };
  // Supporte aussi les codes déjà normalisés et anciens synonymes
  const normalized = String(statut)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const synonyms = {
    'a_imprimer': 'pret_impression',
    'a_livrer': 'pret_livraison',
    'preparation': 'en_cours',
  };
  return mapping[statut] || synonyms[normalized] || normalized;
}
// Statuts métier centralisés (codes canoniques)
export const STATUS_WORKFLOW = {
  en_cours:        { label: 'En cours', color: 'blue', roles: ['preparateur'] },
  pret_impression: { label: 'Prêt impression', color: 'indigo', roles: ['imprimeur'] },
  en_impression:   { label: 'En impression', color: 'purple', roles: ['imprimeur'] },
  imprime:         { label: 'Imprimé', color: 'emerald', roles: ['imprimeur'] },
  pret_livraison:  { label: 'Prêt livraison', color: 'orange', roles: ['livreur'] },
  en_livraison:    { label: 'En livraison', color: 'yellow', roles: ['livreur'] },
  livre:           { label: 'Livré', color: 'green', roles: ['livreur'] },
  a_revoir:        { label: 'À revoir', color: 'red', roles: ['preparateur', 'imprimeur', 'admin'] },
  termine:         { label: 'Terminé', color: 'slate', roles: ['admin'] },
  // alias rétro-compatibles (ne pas afficher, juste pour éviter de casser)
  a_imprimer:      { label: 'Prêt impression', color: 'indigo', roles: ['imprimeur'] },
  a_livrer:        { label: 'Prêt livraison', color: 'orange', roles: ['livreur'] },
  preparation:     { label: 'En cours', color: 'blue', roles: ['preparateur'] },
};

// Transitions métier centralisées (par rôles)
export const WORKFLOW_ACTIONS = {
  preparateur: {
    en_cours: [
      { label: 'Valider', nextStatus: 'pret_impression' },
    ],
    a_revoir: [
      { label: 'Revalider', nextStatus: 'pret_impression' },
    ],
    // alias rétro-compatibles
    preparation: [
      { label: 'Valider', nextStatus: 'pret_impression' },
    ],
  },
  imprimeur: {
    pret_impression: [
      { label: 'Démarrer impression', nextStatus: 'en_impression' },
      { label: 'Demander révision', nextStatus: 'a_revoir' },
    ],
    a_imprimer: [ // alias
      { label: 'Démarrer impression', nextStatus: 'en_impression' },
      { label: 'Demander révision', nextStatus: 'a_revoir' },
    ],
    en_impression: [
      { label: 'Imprimer', nextStatus: 'imprime' },
      { label: 'Demander révision', nextStatus: 'a_revoir' },
    ],
    imprime: [
      { label: 'Marquer prêt livraison', nextStatus: 'pret_livraison' },
      { label: 'Demander révision', nextStatus: 'a_revoir' },
    ],
  },
  livreur: {
    pret_livraison: [
      { label: 'Programmer livraison', nextStatus: 'en_livraison' },
      { label: 'Livrer', nextStatus: 'livre' },
    ],
    a_livrer: [ // alias
      { label: 'Programmer livraison', nextStatus: 'en_livraison' },
      { label: 'Livrer', nextStatus: 'livre' },
    ],
    en_livraison: [
      { label: 'Livrer', nextStatus: 'livre' },
    ],
    livre: [
      { label: 'Clôturer', nextStatus: 'termine' }, // optionnel si auto en backend
    ],
  },
  admin: {
    '*': [
      { label: 'Forcer transition', nextStatus: null },
      // Le bouton Déverrouiller est géré côté UI via l'endpoint dédié
    ],
  },
};

// Normalisation universelle des statuts
export function normalizeStatusLabel(label) {
  return String(label)
    .toLowerCase()
    .replace(/\s/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getAvailableActions(role, status) {
  if (role === 'admin') return WORKFLOW_ACTIONS.admin['*'];
  const normalizedStatus = mapFrenchStatutToApp(status);
  return WORKFLOW_ACTIONS[role]?.[normalizedStatus] || WORKFLOW_ACTIONS[role]?.[normalizeStatusLabel(status)] || [];
}
