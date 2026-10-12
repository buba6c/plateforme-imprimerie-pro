// Appel à l'API Google Gemini (generateContent) et traduction de ses erreurs en français.
// L'adresse est lue dans IA_URL_GEMINI (utile pour un serveur simulé en développement).
// La clé passe dans l'en-tête x-goog-api-key, jamais dans l'adresse (journaux, proxys).

import { DELAI_IA_MS, entier, ErreurIA, erreurReseau, type AppelIA, type ReponseIA } from './erreurs';

export const MODELES_GEMINI = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'] as const;

export function urlGemini(): string {
  return (process.env.IA_URL_GEMINI || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
}

function traduireStatut(status: number, statutApi: string | undefined, message: string | undefined, modele: string): ErreurIA {
  const m = (message ?? '').toLowerCase();
  if (status === 400 && (statutApi === 'INVALID_ARGUMENT' && /api key/.test(m))) {
    return new ErreurIA(502, 'Gemini a refusé la clé : vérifiez-la dans Google AI Studio puis enregistrez-la de nouveau.', 'cle_refusee', 'gemini');
  }
  if (status === 401 || /api_key_invalid|api key not valid/.test(m)) {
    return new ErreurIA(502, 'Gemini a refusé la clé : vérifiez-la dans Google AI Studio puis enregistrez-la de nouveau.', 'cle_refusee', 'gemini');
  }
  if (status === 403) {
    return new ErreurIA(502, "Gemini refuse l'accès avec cette clé : vérifiez que l'API Generative Language est activée pour le projet Google.", 'acces_refuse', 'gemini');
  }
  if (status === 404) {
    return new ErreurIA(502, `Le modèle « ${modele} » n'est pas disponible avec cette clé Gemini : choisissez-en un autre.`, 'modele_indisponible', 'gemini');
  }
  if (status === 429) {
    const quota = /quota|billing|exceeded your current quota|free tier/.test(m);
    return quota
      ? new ErreurIA(503, 'Le quota Gemini de ce projet est épuisé : attendez son renouvellement ou activez la facturation dans Google AI Studio.', 'quota', 'gemini')
      : new ErreurIA(503, 'Gemini limite le nombre de demandes en ce moment : réessayez dans une minute.', 'limite', 'gemini');
  }
  if (status === 503 || statutApi === 'UNAVAILABLE') {
    return new ErreurIA(503, 'Gemini est surchargé en ce moment : réessayez dans une minute.', 'limite', 'gemini');
  }
  if (status >= 500) {
    return new ErreurIA(502, 'Le service Gemini rencontre un problème : réessayez dans quelques minutes.', 'injoignable', 'gemini');
  }
  return new ErreurIA(502, `Gemini a rejeté la demande (erreur ${status}). Réessayez ; si cela persiste, testez la connexion dans Assistant IA.`, 'erreur', 'gemini');
}

/**
 * Convertit le schéma JSON (structured outputs OpenAI) vers le sous-ensemble OpenAPI compris par
 * Gemini : types en majuscules, `nullable` à la place de `['type', 'null']`, pas d'`additionalProperties`.
 */
export function schemaVersGemini(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(schemaVersGemini);
  if (!s || typeof s !== 'object') return s;
  const src = s as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    if (k === 'type') {
      const types = (Array.isArray(v) ? v : [v]).filter((t) => t !== 'null') as string[];
      if (Array.isArray(v) && v.includes('null')) out.nullable = true;
      out.type = (types[0] ?? 'string').toUpperCase();
      continue;
    }
    if (k === 'enum' && Array.isArray(v)) {
      const sansNull = v.filter((x) => x !== null);
      if (sansNull.length !== v.length) out.nullable = true;
      out.enum = sansNull.map(String);
      continue;
    }
    if (k === 'properties' && v && typeof v === 'object') {
      out.properties = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, schemaVersGemini(pv)]));
      out.propertyOrdering = Object.keys(v as Record<string, unknown>);
      continue;
    }
    if (k === 'items') {
      out.items = schemaVersGemini(v);
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function appelerGemini(p: AppelIA): Promise<ReponseIA> {
  const systeme = p.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const utilisateur = p.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');
  const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: p.maxJetons };
  if (p.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schemaVersGemini(p.schema.schema);
  }
  const corps: Record<string, unknown> = {
    ...(systeme ? { systemInstruction: { parts: [{ text: systeme }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: utilisateur }] }],
    generationConfig,
  };

  let res: Response;
  try {
    res = await fetch(`${urlGemini()}/models/${encodeURIComponent(p.modele)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': p.cle, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_IA_MS),
    });
  } catch (e) {
    throw erreurReseau(e, 'gemini');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch (e) {
    const nom = (e as { name?: string })?.name;
    if (nom === 'TimeoutError' || nom === 'AbortError') throw erreurReseau(e, 'gemini');
    data = null;
  }
  if (!res.ok) throw traduireStatut(res.status, data?.error?.status, data?.error?.message, p.modele);

  const candidat = data?.candidates?.[0];
  const blocage = data?.promptFeedback?.blockReason;
  if (blocage || candidat?.finishReason === 'SAFETY' || candidat?.finishReason === 'PROHIBITED_CONTENT') {
    throw new ErreurIA(502, "L'assistant n'a pas voulu traiter cette demande : reformulez-la.", 'reponse_invalide', 'gemini');
  }
  if (p.schema && candidat?.finishReason === 'MAX_TOKENS') {
    throw new ErreurIA(502, "La réponse de l'assistant est incomplète : raccourcissez la demande ou découpez-la.", 'reponse_invalide', 'gemini');
  }
  const texte = (candidat?.content?.parts ?? [])
    .map((x: { text?: unknown }) => (typeof x?.text === 'string' ? x.text : ''))
    .join('');
  if (!texte) {
    throw new ErreurIA(502, 'La réponse de Gemini est illisible : réessayez.', 'reponse_invalide', 'gemini');
  }
  return {
    contenu: texte,
    modele: typeof data?.modelVersion === 'string' ? data.modelVersion : p.modele,
    jetons_entree: entier(data?.usageMetadata?.promptTokenCount),
    jetons_sortie: entier(data?.usageMetadata?.candidatesTokenCount),
  };
}
