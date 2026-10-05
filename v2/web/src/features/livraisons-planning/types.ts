import type { ActionId, ModePaiement, Statut, StatutPaiement } from '@evocom/shared';

/** Livraison du planning (GET /livraisons/planning). */
export interface LivraisonPlanning {
  id: number;
  numero: string;
  statut: Statut;
  statut_label: string;
  urgent: boolean;
  client_nom: string;
  client_telephone: string | null;
  adresse_livraison: string | null;
  notes_livraison: string | null;
  date_promise: string | null;
  livraison_prevue_at: string | null;
  livre_at: string | null;
  livreur_id: number | null;
  livreur_nom: string | null;
  montant: number | null;
  mode_paiement_prevu: ModePaiement | null;
  deja_paye: number;
  en_attente_validation: number;
  solde: number | null;
  /** Solde moins les encaissements en attente de validation ; null si le montant est inconnu. */
  reste_a_encaisser: number | null;
  nb_fichiers: number;
  nb_reports: number;
  /** Jour (AAAA-MM-JJ) et heure (HH:MM) dans le fuseau de l'entreprise : livraison effective, sinon prévue. */
  jour: string | null;
  heure: string | null;
  actions: ActionId[];
}

export interface Planning {
  debut: string;
  fin: string;
  aujourdhui: string;
  fuseau: string;
  livreur_id: number | null;
  jours_historique: number;
  items: LivraisonPlanning[];
  en_retard: LivraisonPlanning[];
  a_programmer: LivraisonPlanning[];
}

export interface EncaissementLivreur {
  id: number;
  montant: number;
  mode: ModePaiement;
  statut: StatutPaiement;
  encaisse_at: string;
  motif_refus: string | null;
}

/** Livraison effectuée (GET /livraisons/historique) : ni téléphone, ni prix, ni fichiers. */
export interface LivraisonEffectuee {
  id: number;
  numero: string;
  client_nom: string;
  adresse_livraison: string | null;
  livre_at: string;
  livreur_id: number | null;
  livreur_nom: string | null;
  /** Le livreur ne peut ouvrir la fiche que pendant la fenêtre de sa liste principale. */
  fiche_accessible: boolean;
  encaissements: EncaissementLivreur[];
  /** Encaissé par le livreur, refus exclus. */
  encaisse: number;
}

export interface TotalMode {
  mode: ModePaiement;
  libelle: string;
  nb: number;
  montant: number;
  valide: number;
  en_attente_validation: number;
}

export interface Historique {
  items: LivraisonEffectuee[];
  total: number;
  page: number;
  taille: number;
  du: string | null;
  au: string | null;
  totaux: {
    nb_livraisons: number;
    encaisse: number;
    valide: number;
    en_attente_validation: number;
    refuse: number;
    par_mode: TotalMode[];
  };
}
