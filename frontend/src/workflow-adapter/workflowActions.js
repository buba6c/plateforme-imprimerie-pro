import { normalizeStatusLabel } from './normalizeStatusLabel';

// Utilitaire métier pour workflow plateforme d’imprimerie

// ✅ WORKFLOW UNIFIÉ - Logique métier validée
// Statuts: nouveau, en_cours, a_revoir, pret_impression, en_impression, pret_livraison, en_livraison, livre, termine
export const WORKFLOW_ACTIONS = {
  preparateur: {
    // Préparateur peut uniquement VALIDER/REVALIDER ses dossiers
    // Ne peut PAS marquer "À revoir" (seuls admin/imprimeur)
    nouveau: [
      { label: 'Valider le dossier', nextStatus: 'pret_impression' },
    ],
    en_cours: [
      { label: 'Valider le dossier', nextStatus: 'pret_impression' },
    ],
    a_revoir: [
      { label: 'Revalider le dossier', nextStatus: 'pret_impression' },
    ],
    // Préparateur ne voit plus les dossiers après validation
  },
  imprimeur_roland: {
    // Workflow simplifié en 2 étapes (plus de statut "imprime" intermédiaire)
    pret_impression: [
      { label: 'Démarrer impression', nextStatus: 'en_impression' },
      { label: 'Demander révision', nextStatus: 'a_revoir' }, // Avec commentaire obligatoire
    ],
    en_impression: [
      { label: 'Marquer comme imprimé', nextStatus: 'pret_livraison' }, // Direct vers prêt livraison
      { label: 'Demander révision', nextStatus: 'a_revoir' }, // Avec commentaire obligatoire
    ],
  },
  imprimeur_xerox: {
    // Workflow simplifié en 2 étapes (identique à Roland)
    pret_impression: [
      { label: 'Démarrer impression', nextStatus: 'en_impression' },
      { label: 'Demander révision', nextStatus: 'a_revoir' }, // Avec commentaire obligatoire
    ],
    en_impression: [
      { label: 'Marquer comme imprimé', nextStatus: 'pret_livraison' }, // Direct vers prêt livraison
      { label: 'Demander révision', nextStatus: 'a_revoir' }, // Avec commentaire obligatoire
    ],
  },
  livreur: {
    // Livreur a 2 options depuis "Prêt livraison"
    pret_livraison: [
      { label: 'Programmer livraison', nextStatus: 'en_livraison' },    // Avec sélection de date
      { label: 'Livrer directement', nextStatus: 'livre' },             // Livraison immédiate
    ],
    en_livraison: [
      { label: 'Marquer comme livré', nextStatus: 'livre' },
    ],
    livre: [
      { label: 'Marquer comme terminé', nextStatus: 'termine' },
    ],
  },
  admin: {
    '*': [
      { label: 'Forcer transition', nextStatus: null },
    ],
  },
};

export function getAvailableActions(role, status) {
  const normalizedStatus = normalizeStatusLabel(status);
  if (role === 'admin') {
    // Agrège toutes les actions métier des autres rôles pour le statut donné
    let actions = [];
    ['preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'].forEach(r => {
      if (WORKFLOW_ACTIONS[r]?.[normalizedStatus]) {
        actions = actions.concat(WORKFLOW_ACTIONS[r][normalizedStatus]);
      }
    });
    // Ajoute l'action admin générique
    actions = actions.concat(WORKFLOW_ACTIONS.admin['*']);
    // Déduplique les actions par label
    const uniqueActions = [];
    const seenLabels = new Set();
    actions.forEach(action => {
      if (!seenLabels.has(action.label)) {
        seenLabels.add(action.label);
        uniqueActions.push(action);
      }
    });
    return uniqueActions;
  }
  const actions = WORKFLOW_ACTIONS[role]?.[normalizedStatus] || [];
  return actions;
}
