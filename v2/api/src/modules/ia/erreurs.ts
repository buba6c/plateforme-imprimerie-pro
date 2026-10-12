// Erreurs des appels à l'assistant IA, communes à tous les fournisseurs : un statut court
// (journal d'usage) et un message en français pour l'écran.

import { HttpError } from '../../lib/errors';

export const FOURNISSEURS_IA = ['openai', 'gemini', 'openrouter'] as const;
export type FournisseurIA = (typeof FOURNISSEURS_IA)[number];

export const FOURNISSEUR_LABELS: Record<FournisseurIA, string> = { openai: 'OpenAI', gemini: 'Google Gemini', openrouter: 'OpenRouter' };

/** Statut enregistré dans le journal d'usage. */
export type StatutAppel =
  | 'ok'
  | 'cle_refusee'
  | 'acces_refuse'
  | 'modele_indisponible'
  | 'quota'
  | 'limite'
  | 'injoignable'
  | 'delai'
  | 'reponse_invalide'
  | 'erreur';

/** Statuts qui justifient d'essayer l'autre fournisseur (le problème n'est pas dans la demande). */
export const STATUTS_SECOURS: readonly StatutAppel[] = ['quota', 'limite', 'injoignable', 'delai', 'modele_indisponible', 'acces_refuse', 'cle_refusee', 'erreur'];

export class ErreurIA extends HttpError {
  constructor(
    status: number,
    message: string,
    public statut: StatutAppel,
    public fournisseur: FournisseurIA,
  ) {
    super(status, message, undefined, `ia_${statut}`);
  }
}

export const DELAI_IA_MS = 25_000;

export interface AppelIA {
  cle: string;
  modele: string;
  messages: { role: 'system' | 'user'; content: string }[];
  /** Schéma JSON strict de la réponse attendue (structured outputs). */
  schema?: { name: string; schema: Record<string, unknown> };
  maxJetons: number;
}

export interface ReponseIA {
  contenu: string;
  modele: string;
  jetons_entree: number | null;
  jetons_sortie: number | null;
}

export function entier(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

/** Erreur réseau ou délai d'un fetch, traduite. */
export function erreurReseau(e: unknown, fournisseur: FournisseurIA): ErreurIA {
  const nom = (e as { name?: string })?.name;
  const label = FOURNISSEUR_LABELS[fournisseur];
  if (nom === 'TimeoutError' || nom === 'AbortError') {
    return new ErreurIA(504, `${label} n'a pas répondu dans les ${DELAI_IA_MS / 1000} secondes : réessayez.`, 'delai', fournisseur);
  }
  return new ErreurIA(502, `Le service ${label} est injoignable : vérifiez la connexion internet du serveur puis réessayez.`, 'injoignable', fournisseur);
}
