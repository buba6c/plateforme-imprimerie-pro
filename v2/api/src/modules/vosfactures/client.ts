// Appels à l'API VosFactures.fr (https://github.com/vosfactures/API) et traduction de ses
// erreurs en messages français. L'adresse réelle est https://<sous-domaine>.vosfactures.fr ;
// VOSFACTURES_URL la remplace (serveur simulé des tests). La clé API n'apparaît jamais dans
// les messages ni dans les journaux : elle est envoyée dans le corps (POST) ou en paramètre
// de requête (GET), comme le demande l'API.

import { HttpError } from '../../lib/errors';

export const DELAI_VOSFACTURES_MS = 20_000;

export type StatutVosFactures = 'cle_refusee' | 'compte_inconnu' | 'injoignable' | 'delai' | 'donnees_refusees' | 'reponse_invalide' | 'erreur';

export class ErreurVosFactures extends HttpError {
  constructor(
    status: number,
    message: string,
    public statut: StatutVosFactures,
  ) {
    super(status, message, undefined, `vosfactures_${statut}`);
  }
}

export interface CompteVosFactures {
  sousDomaine: string;
  cle: string;
}

export const SOUS_DOMAINE_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Adresse de base du compte : VOSFACTURES_URL si défini, sinon le sous-domaine réel. */
export function urlVosFactures(sousDomaine: string): string {
  const forcee = process.env.VOSFACTURES_URL;
  if (forcee) return forcee.replace(/\/+$/, '');
  if (!SOUS_DOMAINE_RE.test(sousDomaine)) {
    throw new ErreurVosFactures(409, 'Le sous-domaine VosFactures est invalide : lettres, chiffres et tirets seulement (exemple : evocom).', 'compte_inconnu');
  }
  return `https://${sousDomaine}.vosfactures.fr`;
}

/** Position (ligne) d'une facture VosFactures. */
export interface PositionVosFactures {
  name: string;
  quantity: number;
  quantity_unit: string;
  total_price_gross: number;
  /** Taux de TVA en pourcentage, ou "disabled" quand la TVA ne s'applique pas. */
  tax: number | 'disabled';
}

export interface FactureVosFactures {
  kind: 'vat';
  issue_date: string;
  sell_date: string;
  payment_to: string;
  seller_name: string;
  seller_tax_no?: string;
  seller_street?: string;
  seller_email?: string;
  seller_phone?: string;
  buyer_name: string;
  buyer_tax_no?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_street?: string;
  currency: 'XOF';
  lang: 'fr';
  description?: string;
  internal_note?: string;
  positions: PositionVosFactures[];
}

export interface FactureDistante {
  id: number;
  number: string | null;
  view_url: string | null;
}

/** Message d'erreur VosFactures (JSON « message » texte ou objet champ → [messages]) en une phrase lisible. */
function detailMessage(data: unknown): string {
  const m = (data as { message?: unknown; error?: unknown } | null)?.message ?? (data as { error?: unknown } | null)?.error;
  if (typeof m === 'string') return m.slice(0, 300);
  if (m && typeof m === 'object') {
    return Object.entries(m as Record<string, unknown>)
      .map(([champ, msgs]) => `${champ} : ${Array.isArray(msgs) ? msgs.join(', ') : String(msgs)}`)
      .join(' ; ')
      .slice(0, 300);
  }
  return '';
}

function traduireStatut(status: number, data: unknown, sousDomaine: string): ErreurVosFactures {
  if (status === 401 || status === 403) {
    return new ErreurVosFactures(502, 'VosFactures a refusé la clé API : vérifiez-la dans VosFactures (Paramètres > Compte > Intégration) puis enregistrez-la de nouveau.', 'cle_refusee');
  }
  if (status === 404) {
    return new ErreurVosFactures(502, `VosFactures ne trouve pas ce qui est demandé sur le compte « ${sousDomaine} » : vérifiez le sous-domaine, ou la facture a été supprimée côté VosFactures.`, 'erreur');
  }
  if (status === 422 || status === 400) {
    const detail = detailMessage(data);
    return new ErreurVosFactures(502, `VosFactures a refusé les données de la facture${detail ? ` : ${detail}` : ''}.`, 'donnees_refusees');
  }
  if (status === 429) {
    return new ErreurVosFactures(503, 'VosFactures limite le nombre de demandes en ce moment : réessayez dans une minute.', 'erreur');
  }
  if (status >= 500) {
    return new ErreurVosFactures(502, 'Le service VosFactures rencontre un problème : réessayez dans quelques minutes.', 'injoignable');
  }
  return new ErreurVosFactures(502, `VosFactures a rejeté la demande (erreur ${status}). Réessayez ; si cela persiste, testez la connexion dans Paramètres > Facturation.`, 'erreur');
}

function erreurReseau(e: unknown, sousDomaine: string): ErreurVosFactures {
  const nom = (e as { name?: string })?.name;
  if (nom === 'TimeoutError' || nom === 'AbortError') {
    return new ErreurVosFactures(504, `VosFactures n'a pas répondu dans les ${DELAI_VOSFACTURES_MS / 1000} secondes : réessayez.`, 'delai');
  }
  const cause = (e as { cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code;
  if (cause === 'ENOTFOUND' || cause === 'EAI_AGAIN') {
    return new ErreurVosFactures(502, `Le compte VosFactures « ${sousDomaine} » est introuvable : vérifiez le sous-domaine (la partie avant .vosfactures.fr).`, 'compte_inconnu');
  }
  return new ErreurVosFactures(502, 'VosFactures est injoignable : vérifiez la connexion internet du serveur puis réessayez.', 'injoignable');
}

async function appeler(compte: CompteVosFactures, methode: 'GET' | 'POST', chemin: string, corps?: Record<string, unknown>): Promise<unknown> {
  const base = urlVosFactures(compte.sousDomaine);
  const url = methode === 'GET' ? `${base}${chemin}${chemin.includes('?') ? '&' : '?'}api_token=${encodeURIComponent(compte.cle)}` : `${base}${chemin}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: methode,
      headers: { Accept: 'application/json', ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      body: corps ? JSON.stringify({ api_token: compte.cle, ...corps }) : undefined,
      signal: AbortSignal.timeout(DELAI_VOSFACTURES_MS),
    });
  } catch (e) {
    throw erreurReseau(e, compte.sousDomaine);
  }
  let data: unknown = null;
  try {
    const texte = await res.text();
    data = texte ? JSON.parse(texte) : null;
  } catch (e) {
    const nom = (e as { name?: string })?.name;
    if (nom === 'TimeoutError' || nom === 'AbortError') throw erreurReseau(e, compte.sousDomaine);
    data = null;
  }
  if (!res.ok) throw traduireStatut(res.status, data, compte.sousDomaine);
  return data;
}

/** GET /invoices.json?page=1&per_page=1 : vérifie le compte et la clé. */
export async function testerConnexion(compte: CompteVosFactures): Promise<{ ok: true; nb_factures_visibles: number }> {
  const data = await appeler(compte, 'GET', '/invoices.json?page=1&per_page=1');
  if (!Array.isArray(data)) throw new ErreurVosFactures(502, 'La réponse de VosFactures est illisible : réessayez ; si cela persiste, vérifiez le sous-domaine.', 'reponse_invalide');
  return { ok: true, nb_factures_visibles: data.length };
}

/** POST /invoices.json : crée la facture et renvoie son identifiant, son numéro et son lien de consultation. */
export async function creerFactureDistante(compte: CompteVosFactures, facture: FactureVosFactures): Promise<FactureDistante> {
  const data = (await appeler(compte, 'POST', '/invoices.json', { invoice: facture })) as Record<string, unknown> | null;
  const id = Number(data?.id);
  if (!data || !Number.isInteger(id) || id <= 0) {
    throw new ErreurVosFactures(502, "VosFactures n'a pas renvoyé l'identifiant de la facture créée : vérifiez dans VosFactures si elle existe avant de réessayer.", 'reponse_invalide');
  }
  const base = urlVosFactures(compte.sousDomaine);
  const viewUrl = typeof data.view_url === 'string' ? data.view_url : typeof data.token === 'string' ? `${base}/invoice/${data.token}` : null;
  return { id, number: typeof data.number === 'string' ? data.number : null, view_url: viewUrl };
}

/** POST /invoices/cancel.json : annule la facture côté VosFactures (elle y reste, barrée, avec le motif). */
export async function annulerFactureDistante(compte: CompteVosFactures, id: number, motif: string): Promise<void> {
  await appeler(compte, 'POST', '/invoices/cancel.json', { cancel_invoice_id: id, cancel_reason: motif.slice(0, 500) });
}

/** GET /invoices/:id.pdf : le PDF tel que VosFactures l'édite (jamais servi par un lien contenant la clé). */
export async function pdfFactureDistante(compte: CompteVosFactures, id: number): Promise<Buffer> {
  const base = urlVosFactures(compte.sousDomaine);
  let res: Response;
  try {
    res = await fetch(`${base}/invoices/${id}.pdf?api_token=${encodeURIComponent(compte.cle)}`, {
      headers: { Accept: 'application/pdf' },
      signal: AbortSignal.timeout(DELAI_VOSFACTURES_MS),
    });
  } catch (e) {
    throw erreurReseau(e, compte.sousDomaine);
  }
  if (!res.ok) throw traduireStatut(res.status, null, compte.sousDomaine);
  return Buffer.from(await res.arrayBuffer());
}
