// Appel à l'API OpenAI (chat completions) et traduction de ses erreurs en messages français.
// L'adresse est lue dans IA_URL_OPENAI (utile pour un serveur simulé en développement).

import { HttpError } from '../../lib/errors';

export const MODELES_IA = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] as const;
export type ModeleIA = (typeof MODELES_IA)[number];

export const DELAI_OPENAI_MS = 25_000;

export function urlOpenAI(): string {
  return (process.env.IA_URL_OPENAI || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

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

export class ErreurOpenAI extends HttpError {
  constructor(
    status: number,
    message: string,
    public statut: StatutAppel,
  ) {
    super(status, message, undefined, `ia_${statut}`);
  }
}

export interface AppelOpenAI {
  cle: string;
  modele: string;
  messages: { role: 'system' | 'user'; content: string }[];
  /** Schéma JSON strict de la réponse attendue (structured outputs). */
  schema?: { name: string; schema: Record<string, unknown> };
  maxJetons: number;
}

export interface ReponseOpenAI {
  contenu: string;
  modele: string;
  jetons_entree: number | null;
  jetons_sortie: number | null;
}

function traduireStatut(status: number, code: string | undefined, modele: string): ErreurOpenAI {
  if (status === 401) {
    return new ErreurOpenAI(502, 'OpenAI a refusé la clé : vérifiez-la (elle a peut-être été révoquée) puis enregistrez-la de nouveau.', 'cle_refusee');
  }
  if (status === 403) {
    return new ErreurOpenAI(502, "OpenAI refuse l'accès avec cette clé : vérifiez les droits du projet OpenAI associé.", 'acces_refuse');
  }
  if (status === 404) {
    return new ErreurOpenAI(502, `Le modèle « ${modele} » n'est pas disponible avec cette clé : choisissez-en un autre.`, 'modele_indisponible');
  }
  if (status === 429 && code === 'insufficient_quota') {
    return new ErreurOpenAI(503, 'Le crédit du compte OpenAI est épuisé : rechargez-le (rubrique Billing) puis réessayez.', 'quota');
  }
  if (status === 429) {
    return new ErreurOpenAI(503, 'OpenAI limite le nombre de demandes en ce moment : réessayez dans une minute.', 'limite');
  }
  if (status >= 500) {
    return new ErreurOpenAI(502, 'Le service OpenAI rencontre un problème : réessayez dans quelques minutes.', 'injoignable');
  }
  return new ErreurOpenAI(502, `OpenAI a rejeté la demande (erreur ${status}). Réessayez ; si cela persiste, testez la connexion dans Assistant IA.`, 'erreur');
}

export async function appelerOpenAI(p: AppelOpenAI): Promise<ReponseOpenAI> {
  const corps: Record<string, unknown> = {
    model: p.modele,
    messages: p.messages,
    temperature: 0.2,
    max_completion_tokens: p.maxJetons,
  };
  if (p.schema) corps.response_format = { type: 'json_schema', json_schema: { name: p.schema.name, strict: true, schema: p.schema.schema } };

  let res: Response;
  try {
    res = await fetch(`${urlOpenAI()}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_OPENAI_MS),
    });
  } catch (e) {
    const nom = (e as { name?: string })?.name;
    if (nom === 'TimeoutError' || nom === 'AbortError') {
      throw new ErreurOpenAI(504, `OpenAI n'a pas répondu dans les ${DELAI_OPENAI_MS / 1000} secondes : réessayez.`, 'delai');
    }
    throw new ErreurOpenAI(502, 'Le service OpenAI est injoignable : vérifiez la connexion internet du serveur puis réessayez.', 'injoignable');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch (e) {
    const nom = (e as { name?: string })?.name;
    if (nom === 'TimeoutError' || nom === 'AbortError') {
      throw new ErreurOpenAI(504, `OpenAI n'a pas répondu dans les ${DELAI_OPENAI_MS / 1000} secondes : réessayez.`, 'delai');
    }
    data = null;
  }
  if (!res.ok) throw traduireStatut(res.status, data?.error?.code ?? undefined, p.modele);

  const choix = data?.choices?.[0];
  const message = choix?.message;
  if (message?.refusal) {
    throw new ErreurOpenAI(502, "L'assistant n'a pas voulu traiter cette demande : reformulez-la.", 'reponse_invalide');
  }
  if (p.schema && choix?.finish_reason === 'length') {
    throw new ErreurOpenAI(502, "La réponse de l'assistant est incomplète : raccourcissez la demande ou découpez-la.", 'reponse_invalide');
  }
  if (typeof message?.content !== 'string') {
    throw new ErreurOpenAI(502, "La réponse d'OpenAI est illisible : réessayez.", 'reponse_invalide');
  }
  const entier = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
  return {
    contenu: message.content,
    modele: typeof data.model === 'string' ? data.model : p.modele,
    jetons_entree: entier(data?.usage?.prompt_tokens),
    jetons_sortie: entier(data?.usage?.completion_tokens),
  };
}
