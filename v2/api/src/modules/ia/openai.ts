// Appel à l'API OpenAI (chat completions) et traduction de ses erreurs en messages français.
// L'adresse est lue dans IA_URL_OPENAI (utile pour un serveur simulé en développement).
// Le même protocole sert à OpenRouter (openrouter.ts) : l'appel est factorisé ici.

import { DELAI_IA_MS, entier, ErreurIA, erreurReseau, FOURNISSEUR_LABELS, type AppelIA, type FournisseurIA, type ReponseIA } from './erreurs';

export { ErreurIA as ErreurOpenAI, type StatutAppel } from './erreurs';
export type { AppelIA as AppelOpenAI, ReponseIA as ReponseOpenAI } from './erreurs';

export const MODELES_IA = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] as const;
export type ModeleIA = (typeof MODELES_IA)[number];

export const DELAI_OPENAI_MS = DELAI_IA_MS;

export function urlOpenAI(): string {
  return (process.env.IA_URL_OPENAI || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function traduireStatutOpenAI(status: number, code: string | undefined, modele: string): ErreurIA {
  if (status === 401) {
    return new ErreurIA(502, 'OpenAI a refusé la clé : vérifiez-la (elle a peut-être été révoquée) puis enregistrez-la de nouveau.', 'cle_refusee', 'openai');
  }
  if (status === 403) {
    return new ErreurIA(502, "OpenAI refuse l'accès avec cette clé : vérifiez les droits du projet OpenAI associé.", 'acces_refuse', 'openai');
  }
  if (status === 404) {
    return new ErreurIA(502, `Le modèle « ${modele} » n'est pas disponible avec cette clé : choisissez-en un autre.`, 'modele_indisponible', 'openai');
  }
  if (status === 429 && code === 'insufficient_quota') {
    return new ErreurIA(503, 'Le crédit du compte OpenAI est épuisé : rechargez-le (rubrique Billing) puis réessayez.', 'quota', 'openai');
  }
  if (status === 429) {
    return new ErreurIA(503, 'OpenAI limite le nombre de demandes en ce moment : réessayez dans une minute.', 'limite', 'openai');
  }
  if (status >= 500) {
    return new ErreurIA(502, 'Le service OpenAI rencontre un problème : réessayez dans quelques minutes.', 'injoignable', 'openai');
  }
  return new ErreurIA(502, `OpenAI a rejeté la demande (erreur ${status}). Réessayez ; si cela persiste, testez la connexion dans Assistant IA.`, 'erreur', 'openai');
}

export interface OptionsChatCompletions {
  fournisseur: FournisseurIA;
  /** Adresse de base, sans « /chat/completions ». */
  url: string;
  /** En-têtes en plus de l'autorisation. */
  enTetes?: Record<string, string>;
  /** Traduction des erreurs HTTP du fournisseur. */
  traduire: (status: number, code: string | undefined, message: string | undefined, modele: string) => ErreurIA;
}

/** Appel « chat completions » (OpenAI et les services compatibles comme OpenRouter). */
export async function appelerChatCompletions(p: AppelIA, o: OptionsChatCompletions): Promise<ReponseIA> {
  const label = FOURNISSEUR_LABELS[o.fournisseur];
  const corps: Record<string, unknown> = {
    model: p.modele,
    messages: p.messages,
    temperature: 0.2,
    max_completion_tokens: p.maxJetons,
  };
  if (p.schema) corps.response_format = { type: 'json_schema', json_schema: { name: p.schema.name, strict: true, schema: p.schema.schema } };

  let res: Response;
  try {
    res = await fetch(`${o.url}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.cle}`, 'Content-Type': 'application/json', ...(o.enTetes ?? {}) },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_IA_MS),
    });
  } catch (e) {
    throw erreurReseau(e, o.fournisseur);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch (e) {
    const nom = (e as { name?: string })?.name;
    if (nom === 'TimeoutError' || nom === 'AbortError') throw erreurReseau(e, o.fournisseur);
    data = null;
  }
  if (!res.ok) throw o.traduire(res.status, data?.error?.code === undefined || data?.error?.code === null ? undefined : String(data.error.code), typeof data?.error?.message === 'string' ? data.error.message : undefined, p.modele);
  // OpenRouter peut répondre 200 avec un objet d'erreur (modèle ou fournisseur amont en panne).
  if (data?.error && !data?.choices) {
    const code = typeof data.error.code === 'number' ? data.error.code : 502;
    throw o.traduire(code >= 400 && code < 600 ? code : 502, undefined, typeof data.error.message === 'string' ? data.error.message : undefined, p.modele);
  }

  const choix = data?.choices?.[0];
  const message = choix?.message;
  if (message?.refusal) {
    throw new ErreurIA(502, "L'assistant n'a pas voulu traiter cette demande : reformulez-la.", 'reponse_invalide', o.fournisseur);
  }
  if (p.schema && choix?.finish_reason === 'length') {
    throw new ErreurIA(502, "La réponse de l'assistant est incomplète : raccourcissez la demande ou découpez-la.", 'reponse_invalide', o.fournisseur);
  }
  if (typeof message?.content !== 'string') {
    throw new ErreurIA(502, `La réponse de ${label} est illisible : réessayez.`, 'reponse_invalide', o.fournisseur);
  }
  return {
    contenu: message.content,
    modele: typeof data.model === 'string' ? data.model : p.modele,
    jetons_entree: entier(data?.usage?.prompt_tokens),
    jetons_sortie: entier(data?.usage?.completion_tokens),
  };
}

export function appelerOpenAI(p: AppelIA): Promise<ReponseIA> {
  return appelerChatCompletions(p, { fournisseur: 'openai', url: urlOpenAI(), traduire: (status, code, _message, modele) => traduireStatutOpenAI(status, code, modele) });
}
