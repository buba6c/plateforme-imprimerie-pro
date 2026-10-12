// Les fournisseurs de l'assistant (OpenAI, Google Gemini, OpenRouter) derrière une même porte, et le
// secours automatique : si le fournisseur choisi échoue pour une raison qui ne tient pas à la
// demande (quota, limite, panne, clé refusée…), un autre prend le relais quand il a une clé.
// Sans secours possible, une panne passagère donne droit à un second essai.

import { loadConfig } from '../../config';
import { ErreurIA, FOURNISSEURS_IA, STATUTS_SECOURS, type AppelIA, type FournisseurIA, type ReponseIA, type StatutAppel } from './erreurs';
import { appelerGemini, MODELES_GEMINI } from './gemini';
import { appelerOpenAI, MODELES_IA } from './openai';
import { appelerOpenRouter, MODELE_OPENROUTER_RE, MODELES_OPENROUTER } from './openrouter';

export const MODELES_PAR_FOURNISSEUR: Record<FournisseurIA, readonly string[]> = { openai: MODELES_IA, gemini: MODELES_GEMINI, openrouter: MODELES_OPENROUTER };
export const MODELE_DEFAUT: Record<FournisseurIA, string> = { openai: 'gpt-4o-mini', gemini: 'gemini-2.5-flash', openrouter: 'openai/gpt-4o-mini' };

/** Un modèle est-il acceptable pour ce fournisseur ? OpenRouter accepte tout identifiant « éditeur/modèle ». */
export function modeleValide(f: FournisseurIA, modele: string): boolean {
  if (f === 'openrouter') return modele.length <= 120 && MODELE_OPENROUTER_RE.test(modele);
  return MODELES_PAR_FOURNISSEUR[f].includes(modele);
}

/**
 * Fournisseur de secours : le premier des autres, dans l'ordre de la liste (OpenAI, Gemini, OpenRouter),
 * qui remplit la condition (une clé enregistrée et lisible).
 */
export function fournisseurSecours(principal: FournisseurIA, disponible: (f: FournisseurIA) => boolean): FournisseurIA | null {
  return FOURNISSEURS_IA.find((f) => f !== principal && disponible(f)) ?? null;
}

export function appelerFournisseur(f: FournisseurIA, p: AppelIA): Promise<ReponseIA> {
  if (f === 'gemini') return appelerGemini(p);
  if (f === 'openrouter') return appelerOpenRouter(p, loadConfig().appUrl);
  return appelerOpenAI(p);
}

export interface Acces {
  fournisseur: FournisseurIA;
  cle: string;
  modele: string;
}

/** Ce qui s'est passé à chaque essai, pour le journal d'usage. */
export interface TentativeIA {
  fournisseur: FournisseurIA;
  modele: string;
  statut: StatutAppel;
  erreur: string | null;
  duree_ms: number;
  jetons_entree: number | null;
  jetons_sortie: number | null;
  /** Essai de secours (autre fournisseur) ou second essai du même. */
  secours: boolean;
}

export interface ResultatAvecSecours {
  reponse: ReponseIA;
  fournisseur: FournisseurIA;
  modele: string;
  secours: boolean;
  tentatives: TentativeIA[];
}

const PAUSE_AVANT_SECOND_ESSAI_MS = 800;
const STATUTS_SECOND_ESSAI: readonly StatutAppel[] = ['injoignable', 'delai', 'limite'];

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function unEssai(acces: Acces, p: Omit<AppelIA, 'cle' | 'modele'>, secours: boolean): Promise<{ reponse?: ReponseIA; erreur?: ErreurIA; tentative: TentativeIA }> {
  const debut = Date.now();
  try {
    const reponse = await appelerFournisseur(acces.fournisseur, { ...p, cle: acces.cle, modele: acces.modele });
    return {
      reponse,
      tentative: { fournisseur: acces.fournisseur, modele: acces.modele, statut: 'ok', erreur: null, duree_ms: Date.now() - debut, jetons_entree: reponse.jetons_entree, jetons_sortie: reponse.jetons_sortie, secours },
    };
  } catch (e) {
    const erreur = e instanceof ErreurIA ? e : new ErreurIA(502, e instanceof Error ? e.message : 'Erreur inattendue', 'erreur', acces.fournisseur);
    return { erreur, tentative: { fournisseur: acces.fournisseur, modele: acces.modele, statut: erreur.statut, erreur: erreur.message.slice(0, 300), duree_ms: Date.now() - debut, jetons_entree: null, jetons_sortie: null, secours } };
  }
}

/**
 * Appelle le fournisseur principal, puis le secours (ou un second essai) si l'échec ne vient pas
 * de la demande. En cas d'échec complet, l'erreur renvoyée raconte les deux essais.
 */
export async function appelerAvecSecours(principal: Acces, secours: Acces | null, p: Omit<AppelIA, 'cle' | 'modele'>): Promise<ResultatAvecSecours> {
  const tentatives: TentativeIA[] = [];
  const premier = await unEssai(principal, p, false);
  tentatives.push(premier.tentative);
  if (premier.reponse) return { reponse: premier.reponse, fournisseur: principal.fournisseur, modele: premier.reponse.modele, secours: false, tentatives };

  const e1 = premier.erreur!;
  const peutSecourir = !!secours && STATUTS_SECOURS.includes(e1.statut);
  const peutReessayer = !secours && STATUTS_SECOND_ESSAI.includes(e1.statut);
  if (!peutSecourir && !peutReessayer) {
    (e1 as ErreurIA & { tentatives?: TentativeIA[] }).tentatives = tentatives;
    throw e1;
  }
  if (peutReessayer) await pause(PAUSE_AVANT_SECOND_ESSAI_MS);
  const relais = peutSecourir ? secours! : principal;
  const second = await unEssai(relais, p, true);
  tentatives.push(second.tentative);
  if (second.reponse) return { reponse: second.reponse, fournisseur: relais.fournisseur, modele: second.reponse.modele, secours: true, tentatives };

  const e2 = second.erreur!;
  const message = peutSecourir
    ? `${e1.message} Le secours a échoué aussi : ${e2.message}`
    : `${e1.message} Le second essai a échoué aussi.`;
  const finale = new ErreurIA(e2.status, message, e2.statut, e2.fournisseur) as ErreurIA & { tentatives?: TentativeIA[] };
  finale.tentatives = tentatives;
  throw finale;
}
