import type { ActionId, Machine, ModePaiement, Role, SituationPaiement, Specs, Statut, StatutPaiement } from '@evocom/shared';
import type { ResultatPrix } from '@evocom/shared';

export interface User {
  id: number;
  nom: string;
  email: string;
  role: Role;
  telephone: string | null;
  doit_changer_mdp: boolean;
}

export interface DossierResume {
  id: number;
  numero: string;
  machine: Machine;
  statut: Statut;
  statut_label: string;
  client_id: number | null;
  client_nom: string;
  client_telephone?: string | null;
  description: string | null;
  consignes: string | null;
  specs: Specs;
  urgent: boolean;
  date_promise: string | null;
  preparateur_id: number | null;
  preparateur_nom: string | null;
  imprimeur_id: number | null;
  imprimeur_nom: string | null;
  livreur_id: number | null;
  livreur_nom: string | null;
  commentaire_revision: string | null;
  date_validation: string | null;
  date_debut_impression: string | null;
  date_fin_impression: string | null;
  livraison_prevue_at: string | null;
  livre_at: string | null;
  termine_at: string | null;
  adresse_livraison?: string | null;
  notes_livraison?: string | null;
  nb_fichiers: number;
  importe: boolean;
  created_at: string;
  updated_at: string;
  montant?: number | null;
  montant_source?: string | null;
  mode_paiement_prevu?: ModePaiement | null;
  deja_paye?: number;
  en_attente_validation?: number;
  solde?: number | null;
  situation_paiement?: SituationPaiement;
  detail_prix?: ResultatPrix | null;
  actions: ActionId[];
}

export interface Fichier {
  id: number;
  nom_original: string;
  mime: string | null;
  taille: number;
  a_reimprimer: boolean;
  created_at: string;
  uploaded_by_nom: string | null;
}

export interface Evenement {
  id: number;
  type: string;
  action: string | null;
  de_statut: Statut | null;
  vers_statut: Statut | null;
  commentaire: string | null;
  created_at: string;
  user_id: number | null;
  user_nom: string | null;
  user_role: Role | null;
  data: any;
}

export interface PaiementDossier {
  id: number;
  montant: number;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  notes: string | null;
  encaisse_at: string;
  valide_at: string | null;
  motif_refus: string | null;
  encaisse_par_nom: string | null;
  valide_par_nom: string | null;
}

export interface DossierDetail extends DossierResume {
  peut_modifier: boolean;
  peut_supprimer: boolean;
  peut_deposer_fichiers: boolean;
  fichiers: Fichier[];
  historique: Evenement[];
  paiements: PaiementDossier[];
  facture: { id: number; numero: string; total_ttc: number; date_emission: string } | null;
}

export interface Liste<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}

export interface ListeDossiers extends Liste<DossierResume> {
  compteurs: Partial<Record<Statut, number>>;
}

export interface Tarif {
  id: number;
  machine: Machine | 'global';
  categorie: 'support' | 'finition' | 'option' | 'divers';
  code: string;
  libelle: string;
  unite: string;
  prix: number | null;
  actif: boolean;
  ordre: number;
  description: string | null;
}

export interface Notification {
  id: number;
  type: string;
  titre: string;
  message: string | null;
  dossier_id: number | null;
  lu_at: string | null;
  created_at: string;
}
