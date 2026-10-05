// Réponses enregistrées depuis l'API réelle (outils/enregistrer.mjs), pour les écrans de
// consultation qui ne sont pas recalculés en mémoire : journal, devis, factures, santé…

import type { Role } from '@evocom/shared';
import donnees from './donnees/enregistrements.json';
import { recaler } from './dates';
import { E } from './etat';

type ParRole = Record<string, Record<string, unknown>>;
const roles = (donnees as { roles: ParRole }).roles;

function decouper(cle: string): { chemin: string; params: URLSearchParams } {
  const i = cle.indexOf('?');
  return i < 0 ? { chemin: cle, params: new URLSearchParams() } : { chemin: cle.slice(0, i), params: new URLSearchParams(cle.slice(i + 1)) };
}

export function cleRequete(chemin: string, query: URLSearchParams): string {
  const tries = [...query.entries()].sort(([a], [b]) => a.localeCompare(b));
  const s = new URLSearchParams(tries).toString();
  return s ? `${chemin}?${s}` : chemin;
}

/** Ressemblance entre deux jeux de paramètres : paramètres identiques moins paramètres différents. */
function score(a: URLSearchParams, b: URLSearchParams): number {
  let s = 0;
  const cles = new Set([...a.keys(), ...b.keys()]);
  for (const k of cles) s += a.get(k) === b.get(k) ? 1 : -1;
  return s;
}

/** Même forme, sans données : listes vides, compteurs à zéro. */
function vider(v: unknown, cle = ''): unknown {
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, vider(x, k)]));
  if (typeof v === 'number') return cle === 'page' || cle === 'limit' || cle === 'taille' ? v : 0;
  return v;
}

/**
 * Réponse enregistrée pour ce rôle : exacte, sinon la plus proche sur le même chemin, sinon la forme
 * vide d'une réponse d'un autre rôle (sauf pour une fiche : un identifiant inconnu reste introuvable).
 */
export function reponseEnregistree(role: Role, chemin: string, query: URLSearchParams): { trouve: boolean; corps?: unknown } {
  const cle = cleRequete(chemin, query);
  const miennes = roles[role] ?? {};
  const decalage = E().decalage;
  if (cle in miennes) return { trouve: true, corps: recaler(miennes[cle], decalage) };
  let meilleure: { cle: string; s: number } | null = null;
  for (const k of Object.keys(miennes)) {
    const d = decouper(k);
    if (d.chemin !== chemin) continue;
    const s = score(d.params, query);
    if (!meilleure || s > meilleure.s) meilleure = { cle: k, s };
  }
  if (meilleure) return { trouve: true, corps: recaler(miennes[meilleure.cle], decalage) };
  if (/\/\d+(\/|$)/.test(chemin)) return { trouve: false };
  for (const autres of Object.values(roles)) {
    const k = Object.keys(autres).find((x) => decouper(x).chemin === chemin);
    if (k) return { trouve: true, corps: vider(autres[k]) };
  }
  return { trouve: false };
}

/** Toutes les réponses enregistrées dont le chemin commence par `prefixe` (tous rôles). */
export function toutesLesReponses(prefixe: string): unknown[] {
  const out: unknown[] = [];
  for (const parCle of Object.values(roles)) {
    for (const [k, v] of Object.entries(parCle)) if (k.startsWith(prefixe)) out.push(v);
  }
  return out;
}
