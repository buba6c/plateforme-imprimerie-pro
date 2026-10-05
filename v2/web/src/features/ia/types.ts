import type { Machine, ResultatPrix, Specs } from '@evocom/shared';

export const MODELES_IA: { value: string; label: string; aide: string }[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', aide: 'Rapide et économique : convient à la plupart des demandes.' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini', aide: 'Un peu plus précis, environ trois fois plus cher que GPT-4o mini.' },
  { value: 'gpt-4o', label: 'GPT-4o', aide: 'Le plus précis sur les demandes longues, nettement plus cher.' },
];

export interface ConfigIA {
  actif: boolean;
  modele: string;
  modeles: string[];
  cle_configuree: boolean;
  /** 4 derniers caractères de la clé enregistrée. */
  cle_fin: string | null;
  /** false si la clé ne peut plus être déchiffrée (secret du serveur changé). */
  cle_lisible: boolean | null;
  updated_at: string | null;
  updated_by_nom: string | null;
}

export interface UsageIA {
  id: number;
  user_id: number | null;
  user_nom: string | null;
  type: 'suggestion' | 'test';
  statut: string;
  modele: string | null;
  duree_ms: number;
  jetons_entree: number | null;
  jetons_sortie: number | null;
  longueur_demande: number | null;
  extrait: string | null;
  created_at: string;
}

export interface UsagesIA {
  items: UsageIA[];
  totaux_30_jours: { suggestions: number; erreurs: number; jetons_entree: number; jetons_sortie: number };
}

export const STATUT_USAGE_LABELS: Record<string, string> = {
  ok: 'Réussi',
  cle_refusee: 'Clé refusée',
  acces_refuse: 'Accès refusé',
  modele_indisponible: 'Modèle indisponible',
  quota: 'Crédit épuisé',
  limite: 'Limite OpenAI',
  injoignable: 'Injoignable',
  delai: 'Délai dépassé',
  reponse_invalide: 'Réponse illisible',
  erreur: 'Erreur',
};

/** Proposition renvoyée par POST /ia/suggestion : prix calculé par le serveur avec la grille. */
export interface PropositionIA {
  machine: Machine;
  specs: Specs;
  prix: (ResultatPrix & { total: number }) | null;
  erreur_prix?: string;
  avertissements: string[];
  remarques?: string;
}
