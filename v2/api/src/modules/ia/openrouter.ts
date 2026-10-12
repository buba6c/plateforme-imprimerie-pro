// Appel à OpenRouter (openrouter.ai) : une seule clé donne accès aux modèles d'OpenAI, Google,
// Anthropic, Mistral, DeepSeek, Meta… Le protocole est celui d'OpenAI (chat completions) ; seuls
// l'adresse, deux en-têtes d'identification de l'application et la lecture des erreurs changent.
// L'adresse est lue dans IA_URL_OPENROUTER (serveur simulé en développement).

import { ErreurIA, type AppelIA, type ReponseIA } from './erreurs';
import { appelerChatCompletions } from './openai';

/** Modèles proposés dans l'écran ; tout identifiant « éditeur/modèle » d'OpenRouter est accepté. */
export const MODELES_OPENROUTER = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'anthropic/claude-sonnet-4',
  'deepseek/deepseek-chat-v3-0324',
  'mistralai/mistral-small-3.2-24b-instruct',
  'meta-llama/llama-3.3-70b-instruct',
] as const;

/** Identifiant de modèle OpenRouter : « éditeur/nom », éventuellement suivi de « :free » ou d'une variante. */
export const MODELE_OPENROUTER_RE = /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function urlOpenRouter(): string {
  return (process.env.IA_URL_OPENROUTER || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
}

function traduireStatut(status: number, _code: string | undefined, message: string | undefined, modele: string): ErreurIA {
  const m = (message ?? '').toLowerCase();
  if (status === 401) {
    return new ErreurIA(502, 'OpenRouter a refusé la clé : vérifiez-la sur openrouter.ai (rubrique Keys) puis enregistrez-la de nouveau.', 'cle_refusee', 'openrouter');
  }
  if (status === 402) {
    return new ErreurIA(503, 'Le crédit du compte OpenRouter est épuisé : rechargez-le (rubrique Credits) puis réessayez.', 'quota', 'openrouter');
  }
  if (status === 403) {
    return new ErreurIA(502, /moderat/.test(m) ? "OpenRouter a bloqué la demande (modération du modèle choisi) : reformulez-la ou changez de modèle." : "OpenRouter refuse l'accès avec cette clé : vérifiez ses limites sur openrouter.ai.", 'acces_refuse', 'openrouter');
  }
  if (status === 404 || (status === 400 && /model|not a valid model|no endpoints/.test(m))) {
    return new ErreurIA(502, `Le modèle « ${modele} » n'existe pas sur OpenRouter ou n'est plus proposé : choisissez-en un autre.`, 'modele_indisponible', 'openrouter');
  }
  if (status === 429) {
    return new ErreurIA(503, 'OpenRouter limite le nombre de demandes en ce moment (ou le modèle gratuit est saturé) : réessayez dans une minute.', 'limite', 'openrouter');
  }
  if (status === 502 || status === 503) {
    return new ErreurIA(502, `Le modèle « ${modele} » est indisponible chez OpenRouter en ce moment : réessayez ou choisissez-en un autre.`, 'injoignable', 'openrouter');
  }
  if (status >= 500) {
    return new ErreurIA(502, 'Le service OpenRouter rencontre un problème : réessayez dans quelques minutes.', 'injoignable', 'openrouter');
  }
  return new ErreurIA(502, `OpenRouter a rejeté la demande (erreur ${status}${message ? ` : ${message.slice(0, 120)}` : ''}). Réessayez ; si cela persiste, testez la connexion dans Assistant IA.`, 'erreur', 'openrouter');
}

export function appelerOpenRouter(p: AppelIA, appUrl: string): Promise<ReponseIA> {
  return appelerChatCompletions(p, {
    fournisseur: 'openrouter',
    url: urlOpenRouter(),
    // Identification de l'application dans le tableau de bord OpenRouter (facultatif, recommandé).
    enTetes: { 'HTTP-Referer': appUrl, 'X-Title': 'Evocom Print' },
    traduire: traduireStatut,
  });
}
