// Vocabulaire métier partagé par le serveur et l'interface.
// Une seule liste de rôles, de statuts, de machines et de modes de paiement :
// toute nouvelle valeur s'ajoute ici et nulle part ailleurs.

export const ROLES = ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  preparateur: 'Préparateur',
  imprimeur_roland: 'Imprimeur Roland',
  imprimeur_xerox: 'Imprimeur Xerox',
  livreur: 'Livreur',
};

export const MACHINES = ['roland', 'xerox'] as const;
export type Machine = (typeof MACHINES)[number];

export const MACHINE_LABELS: Record<Machine, string> = {
  roland: 'Roland',
  xerox: 'Xerox',
};

export const MACHINE_DESCRIPTIONS: Record<Machine, string> = {
  roland: 'Grand format, au m²',
  xerox: 'Numérique, à la page',
};

/** Machine d'un imprimeur, ou null pour les autres rôles. */
export function machineOfRole(role: Role): Machine | null {
  if (role === 'imprimeur_roland') return 'roland';
  if (role === 'imprimeur_xerox') return 'xerox';
  return null;
}

export function isImprimeur(role: Role): boolean {
  return machineOfRole(role) !== null;
}

export const STATUTS = [
  'en_cours',
  'a_revoir',
  'pret_impression',
  'en_impression',
  'pret_livraison',
  'en_livraison',
  'livre',
  'termine',
] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABELS: Record<Statut, string> = {
  en_cours: 'En préparation',
  a_revoir: 'À revoir',
  pret_impression: 'Prêt à imprimer',
  en_impression: 'En impression',
  pret_livraison: 'Prêt à livrer',
  en_livraison: 'En livraison',
  livre: 'Livré',
  termine: 'Terminé',
};

export type Etape = 'preparation' | 'impression' | 'livraison' | 'cloture';

export const STATUT_ETAPE: Record<Statut, Etape> = {
  en_cours: 'preparation',
  a_revoir: 'preparation',
  pret_impression: 'impression',
  en_impression: 'impression',
  pret_livraison: 'livraison',
  en_livraison: 'livraison',
  livre: 'cloture',
  termine: 'cloture',
};

export const ETAPE_LABELS: Record<Etape, string> = {
  preparation: 'Préparation',
  impression: 'Impression',
  livraison: 'Livraison',
  cloture: 'Clôture',
};

/** Statuts dans lesquels le préparateur peut encore modifier le dossier et ses fichiers. */
export const STATUTS_MODIFIABLES: readonly Statut[] = ['en_cours', 'a_revoir'];

/** Statuts visibles dans la file d'un imprimeur (pour sa machine). */
export const STATUTS_IMPRIMEUR: readonly Statut[] = ['pret_impression', 'en_impression', 'pret_livraison', 'a_revoir'];

/** Statuts visibles par le livreur. */
export const STATUTS_LIVREUR: readonly Statut[] = ['pret_livraison', 'en_livraison', 'livre'];

export function isStatut(value: unknown): value is Statut {
  return typeof value === 'string' && (STATUTS as readonly string[]).includes(value);
}

export const MODES_PAIEMENT = ['especes', 'wave', 'orange_money', 'virement', 'cheque', 'carte'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  virement: 'Virement',
  cheque: 'Chèque',
  carte: 'Carte bancaire',
};

/** Modes pour lesquels une référence de transaction est obligatoire. */
export const MODES_AVEC_REFERENCE: readonly ModePaiement[] = ['wave', 'orange_money', 'virement', 'cheque'];

export const STATUTS_PAIEMENT = ['a_valider', 'valide', 'refuse'] as const;
export type StatutPaiement = (typeof STATUTS_PAIEMENT)[number];

export const STATUT_PAIEMENT_LABELS: Record<StatutPaiement, string> = {
  a_valider: 'À valider',
  valide: 'Validé',
  refuse: 'Refusé',
};

/** Situation de paiement d'un dossier, dérivée de son montant et des paiements validés. */
export type SituationPaiement = 'sans_montant' | 'offert' | 'non_paye' | 'partiel' | 'paye';

export const SITUATION_PAIEMENT_LABELS: Record<SituationPaiement, string> = {
  sans_montant: 'Montant à définir',
  offert: 'Offert',
  non_paye: 'Non payé',
  partiel: 'Acompte',
  paye: 'Payé',
};

export function situationPaiement(montant: number | null, dejaPaye: number): SituationPaiement {
  if (montant === 0) return 'offert';
  if (montant === null || montant < 0) return dejaPaye > 0 ? 'paye' : 'sans_montant';
  if (dejaPaye <= 0) return 'non_paye';
  if (dejaPaye < montant) return 'partiel';
  return 'paye';
}

export const STATUTS_DEVIS = ['brouillon', 'envoye', 'accepte', 'refuse', 'converti'] as const;
export type StatutDevis = (typeof STATUTS_DEVIS)[number];

export const STATUT_DEVIS_LABELS: Record<StatutDevis, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  converti: 'Converti en dossier',
};

export const STATUTS_FACTURE = ['emise', 'annulee'] as const;
export type StatutFacture = (typeof STATUTS_FACTURE)[number];
