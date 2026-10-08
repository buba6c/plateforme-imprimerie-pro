// Réponses des routes de paiement (contrat : v2/API.md, section « Paiements »).
import type { Machine, ModePaiement, Role, Statut, StatutPaiement } from '@evocom/shared';

export interface PaiementAdmin {
  id: number;
  dossier_id: number;
  numero: string;
  client_nom: string;
  montant: number;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  notes: string | null;
  encaisse_par: number | null;
  encaisse_par_nom: string | null;
  encaisse_at: string;
  valide_par: number | null;
  valide_par_nom: string | null;
  valide_at: string | null;
  motif_refus: string | null;
  dossier_supprime: boolean;
  importe: boolean;
  dossier_statut: Statut;
  machine: Machine;
}

export interface ListePaiementsAdmin {
  items: PaiementAdmin[];
  total: number;
  somme: number;
  page: number;
  limit: number;
}

export interface Bloc {
  n: number;
  somme: number;
}

export interface CaisseJour {
  par_encaisseur: { user_id: number | null; nom: string; role: Role | null; a_valider: Bloc; valide_aujourdhui: Bloc; refuse_aujourdhui?: Bloc }[];
  par_mode: { mode: ModePaiement; libelle: string; a_valider: Bloc; valide_aujourdhui: Bloc; refuse_aujourdhui?: Bloc }[];
  totaux: { a_valider: Bloc; valide_aujourdhui: Bloc; refuse_aujourdhui?: Bloc };
}

export type CodeRefus = 'introuvable' | 'deja_valide' | 'refuse' | 'dossier_supprime' | 'depassement';

export interface RefusValidation {
  id: number;
  numero: string | null;
  code: CodeRefus;
  message: string;
  details?: { deja_paye: number; montant_dossier: number };
}

export interface ResultatGroupe {
  valides: number;
  somme: number;
  ids: number[];
  refuses: RefusValidation[];
}

export interface BilanHistorique {
  avant: string;
  borne: string;
  n: number;
  somme: number;
  ignores: { n: number; somme: number; depassement: number; exemples: { id: number; numero: string | null; code: CodeRefus; message: string }[] };
  importes_a_valider?: Bloc;
}

export interface MembreAnnuaire {
  id: number;
  nom: string;
  role: Role;
}
