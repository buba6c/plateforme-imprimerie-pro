// Réponses des routes /parametres (vue administrateur) et /systeme (contrat : v2/API.md).
import type { ParamsPrix } from '@evocom/shared';
import type { Entreprise } from '../admin/types';

export interface Securite {
  session_heures: number;
  echecs_avant_blocage: number;
  blocage_minutes: number;
  mdp_longueur_min: number;
}

export interface ReglesFichiers {
  taille_max_mo: number;
  extensions: string[];
}

export interface ReglesDocuments {
  devis_validite_jours: number;
  mentions_devis: string;
  conditions_paiement: string;
}

/** Paramètres complets, tels que l'administrateur les lit. */
export interface ParametresAdmin {
  entreprise: Entreprise;
  prix: ParamsPrix;
  livreur_jours_historique: number;
  fuseau: string;
  securite: Securite;
  fichiers: ReglesFichiers;
  documents: ReglesDocuments;
  notifications: Record<string, boolean>;
}

/** Règles lisibles par tous les rôles (GET /parametres/regles). */
export interface Regles {
  fichiers: ReglesFichiers & { plafond_serveur_mo: number };
  securite: { mdp_longueur_min: number };
  documents: { devis_validite_jours: number };
}

export type Serie = 'CMD' | 'DEV' | 'FAC';

export interface Numerotation {
  annee: number;
  series: { serie: Serie; libelle: string; dernier: number; dernier_numero: string | null; prochain: number; prochain_numero: string }[];
}

export interface TarifConfig {
  machine: string;
  categorie: string;
  code: string;
  libelle: string;
  unite: string;
  prix: number | null;
  actif: boolean;
  ordre: number;
  description: string | null;
}

export interface Differences {
  parametres: { section: string; champ: string | null; avant: unknown; apres: unknown }[];
  tarifs: {
    ajoutes: TarifConfig[];
    modifies: { machine: string; code: string; libelle: string; champs: Record<string, { avant: unknown; apres: unknown }> }[];
    inchanges: number;
    absents_conserves: { machine: string; code: string; libelle: string }[];
  };
  nb_changements: number;
}

export interface LigneVolume {
  table: string;
  libelle: string;
  nombre: number;
}

export interface EtatReinitialisation {
  autorisee: boolean;
  variable: string;
  phrase_attendue: string;
  ce_qui_est_efface: LigneVolume[];
  ce_qui_est_conserve: LigneVolume[];
  tentatives_restantes: number;
}

export interface BilanReinitialisation {
  sauvegarde: { fichier: string; chemin: string; taille: number };
  efface: Record<string, number>;
  fichiers: { deplaces: number; absents: number; dossier: string };
  sessions_fermees: number;
}
