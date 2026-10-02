// Réponses des routes d'administration (contrat : v2/API.md, « Modules complémentaires »).
import type { Machine, ModePaiement, ParamsPrix, Role, Statut, StatutPaiement } from '@evocom/shared';

export type Periode = 'jour' | 'semaine' | 'mois' | 'annee';
export type Pas = 'jour' | 'semaine' | 'mois';

export interface Apercu {
  periode: Periode;
  du: string;
  au: string;
  fuseau?: string;
  commandes: { nb: number; montant: number };
  encaisse: { montant: number; nb: number };
  a_valider: { nb: number; montant: number };
  reste_a_encaisser: { montant: number; nb_dossiers?: number };
  production: { par_statut: Partial<Record<Statut, number>>; par_machine: Partial<Record<Machine, Partial<Record<Statut, number>>>> };
  retards: { nb: number };
  urgents: { nb: number };
}

export interface Delai {
  heures_moyennes: number | null;
  nb: number;
}

export interface Delais {
  creation_validation: Delai;
  validation_fin_impression: Delai;
  fin_impression_livraison: Delai;
}

export interface StatsProduction {
  du: string;
  au: string;
  delais: Delais;
  par_machine: { machine: Machine; crees: number; montant: number; imprimes: number; livres: number; delais: Delais }[];
  par_utilisateur: { user_id: number; nom: string; role: Role; nb_actions: number; actions: Record<string, number> }[];
}

export interface PointEvolution {
  periode: string;
  commandes: number;
  montant_commandes: number;
  encaisse: number;
}

export interface TopClient {
  client_id: number | null;
  nom: string;
  nb: number;
  montant: number;
}

export interface Paiement {
  id: number;
  dossier_id: number;
  numero: string;
  client_nom: string;
  montant: number;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  notes: string | null;
  encaisse_par?: number | null;
  encaisse_par_nom: string | null;
  encaisse_at: string;
  valide_par_nom: string | null;
  valide_at: string | null;
  motif_refus: string | null;
  dossier_supprime?: boolean;
}

export interface ListePaiements {
  items: Paiement[];
  total: number;
  somme: number;
  page?: number;
  limit?: number;
}

export interface BlocCaisse {
  n: number;
  somme: number;
}

export interface Caisse {
  par_encaisseur: { user_id: number | null; nom: string; role: Role | null; a_valider: BlocCaisse; valide_aujourdhui: BlocCaisse }[];
  par_mode: { mode: ModePaiement; libelle?: string; a_valider: BlocCaisse; valide_aujourdhui: BlocCaisse }[];
  totaux?: { a_valider: BlocCaisse; valide_aujourdhui: BlocCaisse };
}

export interface UserAdmin {
  id: number;
  nom: string;
  email: string;
  telephone: string | null;
  role: Role;
  is_active: boolean;
  doit_changer_mdp: boolean;
  last_login_at: string | null;
  created_at: string;
  nb_dossiers: number;
}

export interface Entreprise {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  ninea: string;
  rccm: string;
  pied_facture: string;
}

export interface Parametres {
  entreprise: Entreprise;
  prix: ParamsPrix;
  livreur_jours_historique: number;
  fuseau: string;
}

export interface EntreeJournal {
  id: number;
  user_id?: number | null;
  user_nom: string | null;
  action: string;
  cible: string | null;
  cible_id: string | null;
  data: unknown;
  ip: string | null;
  created_at: string;
}

export interface DossierSupprime {
  id: number;
  numero: string;
  client_nom: string;
  statut: Statut;
  machine: Machine;
  montant: number | null;
  deleted_at: string;
  deleted_by_nom: string | null;
  motif: string | null;
  nb_paiements: number;
}

export interface Sante {
  version: string;
  base: { ok: boolean; latence_ms?: number; erreur?: string };
  stockage: { chemin: string; libre_octets: number | null; total_octets: number | null; erreur?: string };
  derniere_sauvegarde: { ok: boolean; created_at: string; taille: number | null; message: string | null; fichier: string | null } | null;
  migrations: { a_jour: boolean | null; en_attente?: string[]; erreur?: string };
}
