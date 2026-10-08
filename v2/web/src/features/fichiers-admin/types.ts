// Réponses de /api/gestion-fichiers (gestionnaire global des fichiers).
import type { Machine, Role, Statut } from '@evocom/shared';

export type Categorie = 'pdf' | 'image' | 'autre';

export interface FichierGlobal {
  id: number;
  nom_original: string;
  mime: string | null;
  taille: number;
  a_reimprimer: boolean;
  created_at: string;
  uploaded_by: number | null;
  uploaded_by_nom: string | null;
  categorie: Categorie;
  importe: boolean;
  dossier_id: number;
  dossier_numero: string;
  dossier_statut: Statut;
  machine: Machine;
  client_id: number | null;
  client_nom: string;
  urgent: boolean;
}

export interface ListeFichiersGlobale {
  items: FichierGlobal[];
  total: number;
  taille_totale: number;
  page: number;
  limit: number;
}

export interface FichierSupprime extends FichierGlobal {
  deleted_at: string;
  deleted_by: number | null;
  deleted_by_nom: string | null;
  dossier_supprime: boolean;
  dossier_deleted_at: string | null;
  present: boolean;
  /** Contenu partagé avec d'autres noms (ancienne application, sauvegardes) : place libérée plus tard. */
  partage: boolean;
  peut_restaurer: boolean;
}

export interface CorbeilleFichiers {
  items: FichierSupprime[];
  total: number;
  taille_totale: number;
  page: number;
  limit: number;
}

export interface Auteur {
  id: number;
  nom: string;
  role: Role;
  nb: number;
}

export type EtatFichier = 'actif' | 'corbeille' | 'dossier_corbeille';

export interface FichierControle {
  id: number;
  nom_original: string;
  chemin: string;
  taille: number;
  taille_disque?: number;
  created_at: string;
  etat: EtatFichier;
  importe: boolean;
  dossier_id: number;
  dossier_numero: string;
  dossier_statut: Statut;
  client_nom: string;
}

interface Bloc {
  nb: number;
  taille: number;
}

export interface Integrite {
  verifie_at: string;
  duree_ms: number;
  fichiers: Bloc;
  repartition: { actifs: Bloc; corbeille: Bloc; dossiers_corbeille: Bloc };
  presents: Bloc;
  manquants: { nb: number; taille_declaree: number; items: FichierControle[] };
  taille_differente: { nb: number; items: FichierControle[] };
  orphelins: Bloc;
  espace: { libre_octets: number; total_octets: number } | null;
}

export interface ResultatCorbeilleGroupee {
  mis_a_la_corbeille: number;
  taille: number;
  deja_a_la_corbeille: number[];
  introuvables: number[];
}

export interface ResultatRestaurationGroupee {
  restaures: number;
  ignores: { id: number; nom: string | null; raison: string; message: string }[];
}

export interface ResultatPurge {
  purges: number;
  supprimes_du_disque: number;
  octets_liberes_maintenant: number;
  octets_partages: number;
  fichiers_partages: number;
  absents: number;
  erreurs: { id: number; nom: string; message: string }[];
}
