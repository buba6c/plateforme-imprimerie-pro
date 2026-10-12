import type { Machine, ResultatPrix, Specs } from '@evocom/shared';

export type FournisseurIA = 'openai' | 'gemini' | 'openrouter';

export const FOURNISSEURS_IA: FournisseurIA[] = ['openai', 'gemini', 'openrouter'];
export const FOURNISSEUR_LABELS: Record<FournisseurIA, string> = { openai: 'OpenAI', gemini: 'Google Gemini', openrouter: 'OpenRouter' };

export interface ModeleIA {
  value: string;
  label: string;
  aide: string;
}

export const MODELES_IA: ModeleIA[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', aide: 'Rapide et économique : convient à la plupart des demandes.' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini', aide: 'Un peu plus précis, environ trois fois plus cher que GPT-4o mini.' },
  { value: 'gpt-4o', label: 'GPT-4o', aide: 'Le plus précis sur les demandes longues, nettement plus cher.' },
];

export const MODELES_GEMINI: ModeleIA[] = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', aide: 'Rapide, économique, avec un quota gratuit : le bon choix pour commencer.' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', aide: 'Le plus rapide et le moins cher, un peu moins précis.' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', aide: 'Le plus précis sur les demandes longues ou ambiguës, plus lent et plus cher.' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', aide: 'Génération précédente, à garder seulement si 2.5 n’est pas disponible.' },
];

/** Modèles proposés pour OpenRouter ; tout identifiant « éditeur/modèle » du catalogue openrouter.ai est accepté. */
export const MODELES_OPENROUTER: ModeleIA[] = [
  { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini', aide: 'Rapide et économique : convient à la plupart des demandes.' },
  { value: 'openai/gpt-4.1-mini', label: 'OpenAI GPT-4.1 mini', aide: 'Un peu plus précis que GPT-4o mini.' },
  { value: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash', aide: 'Rapide et économique, bon sur les descriptions longues.' },
  { value: 'anthropic/claude-sonnet-4', label: 'Anthropic Claude Sonnet 4', aide: 'Très précis sur les demandes ambiguës, plus cher.' },
  { value: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3', aide: 'Bon rapport qualité-prix.' },
  { value: 'mistralai/mistral-small-3.2-24b-instruct', label: 'Mistral Small 3.2', aide: 'Économique, correct sur les demandes simples.' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 70B', aide: 'Modèle ouvert, économique.' },
];

export const MODELE_OPENROUTER_RE = /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export const MODELES_PAR_FOURNISSEUR: Record<FournisseurIA, ModeleIA[]> = { openai: MODELES_IA, gemini: MODELES_GEMINI, openrouter: MODELES_OPENROUTER };

export interface FournisseurConfig {
  modele: string;
  modeles: string[];
  cle_configuree: boolean;
  /** 4 derniers caractères de la clé enregistrée. */
  cle_fin: string | null;
  /** false si la clé ne peut plus être déchiffrée (secret du serveur changé). */
  cle_lisible: boolean | null;
}

export interface ConfigIA extends FournisseurConfig {
  actif: boolean;
  /** Fournisseur utilisé pour les propositions. */
  fournisseur: FournisseurIA;
  /** Si le fournisseur choisi échoue (quota, panne…), essayer l'autre quand il a une clé. */
  secours: boolean;
  secours_possible: boolean;
  /** Fournisseur qui prendrait le relais (le premier des autres ayant une clé lisible). */
  secours_fournisseur: FournisseurIA | null;
  fournisseurs: Record<FournisseurIA, FournisseurConfig>;
  updated_at: string | null;
  updated_by_nom: string | null;
}

export interface UsageIA {
  id: number;
  user_id: number | null;
  user_nom: string | null;
  type: 'suggestion' | 'test';
  statut: string;
  fournisseur: FournisseurIA | null;
  modele: string | null;
  duree_ms: number;
  jetons_entree: number | null;
  jetons_sortie: number | null;
  longueur_demande: number | null;
  extrait: string | null;
  secours: boolean;
  erreur: string | null;
  created_at: string;
}

export interface UsagesIA {
  items: UsageIA[];
  totaux_30_jours: { suggestions: number; erreurs: number; secours: number; openai: number; gemini: number; openrouter: number; jetons_entree: number; jetons_sortie: number };
}

export const STATUT_USAGE_LABELS: Record<string, string> = {
  ok: 'Réussi',
  cle_refusee: 'Clé refusée',
  acces_refuse: 'Accès refusé',
  modele_indisponible: 'Modèle indisponible',
  quota: 'Quota épuisé',
  limite: 'Service saturé',
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
  fournisseur: FournisseurIA;
  modele: string;
  /** La proposition vient du fournisseur de secours, le premier ayant échoué. */
  secours: boolean;
}
