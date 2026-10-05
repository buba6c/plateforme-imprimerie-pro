// Requêtes et réponses de l'API simulée, au même format que le serveur (voir API.md) :
// { error, code, details?, champs? } pour les erreurs.

import { ZodError } from 'zod';

export interface Requete {
  methode: string;
  /** Chemin sans le préfixe /api, par exemple « /dossiers/12 ». */
  chemin: string;
  query: URLSearchParams;
  body: any;
}

export interface Reponse {
  status: number;
  body?: unknown;
  /** Texte brut (envoi de fichiers : le client tus lit le corps en texte). */
  texte?: string;
}

export class ErreurDemo extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
  }
}

export const MESSAGE_DEMO = 'Démonstration : cette action n’est pas enregistrée.';

export const badRequest = (m: string, details?: unknown) => new ErreurDemo(400, m, details, 'requete_invalide');
export const unauthorized = (m = 'Connectez-vous pour continuer.') => new ErreurDemo(401, m, undefined, 'non_connecte');
export const forbidden = (m = "Vous n'avez pas accès à cette ressource.") => new ErreurDemo(403, m, undefined, 'interdit');
export const notFound = (m = 'Élément introuvable.') => new ErreurDemo(404, m, undefined, 'introuvable');
export const conflict = (m: string, details?: unknown) => new ErreurDemo(409, m, details, 'conflit');
export const unprocessable = (m: string, details?: unknown) => new ErreurDemo(422, m, details, 'invalide');
/** Action volontairement non simulée : message clair, rien n'est modifié. */
export const pasEnDemo = (m = MESSAGE_DEMO) => new ErreurDemo(403, m, undefined, 'demonstration');

export function reponseErreur(e: unknown): Reponse {
  if (e instanceof ZodError) {
    const champs: Record<string, string> = {};
    for (const issue of e.issues) {
      const k = issue.path.join('.') || '_';
      if (!champs[k]) champs[k] = issue.message;
    }
    return { status: 400, body: { error: 'Certains champs sont invalides.', code: 'requete_invalide', champs } };
  }
  if (e instanceof ErreurDemo) {
    const champs = (e.details as { champs?: unknown } | undefined)?.champs;
    return { status: e.status, body: { error: e.message, code: e.code, details: e.details, ...(champs ? { champs } : {}) } };
  }
  console.error('[démo]', e);
  return {
    status: 500,
    body: { error: "Une erreur inattendue s'est produite dans la démonstration. Rechargez la page ; si elle persiste, réinitialisez la démo.", code: 'erreur_serveur' },
  };
}

// ---------------------------------------------------------------------------
// Paramètres de requête (mêmes règles que lib/http.ts côté serveur)

export function qStr(r: Requete, nom: string): string | undefined {
  const v = r.query.get(nom);
  return v !== null && v.trim() !== '' ? v.trim() : undefined;
}

export function qInt(r: Requete, nom: string): number | undefined {
  const v = qStr(r, nom);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function qBool(r: Requete, nom: string): boolean | undefined {
  const v = qStr(r, nom);
  if (v === undefined) return undefined;
  return v === '1' || v === 'true' || v === 'oui';
}

export function qList(r: Requete, nom: string): string[] | undefined {
  const v = qStr(r, nom);
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
}

export function pagination(r: Requete, defaut = 50, max = 200) {
  const limit = Math.min(Math.max(qInt(r, 'limit') ?? defaut, 1), max);
  const page = Math.max(qInt(r, 'page') ?? 1, 1);
  return { page, limit, offset: (page - 1) * limit };
}

export function idDe(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identifiant invalide.');
  return n;
}

/** Recherche insensible à la casse, comme LIKE '%q%' sur lower(). */
export function contient(texte: string | null | undefined, q: string): boolean {
  return (texte ?? '').toLowerCase().includes(q.toLowerCase());
}
