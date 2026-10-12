// Garde IA : empêche l'assistant d'épuiser le quota du fournisseur (OpenAI, Gemini, OpenRouter).
//  - plafonds réglables : jetons par jour et par mois, appels par jour, appels par personne et par jour ;
//  - au-delà, l'appel est refusé (429, code « ia_budget ») avec la date de reprise ; l'application continue
//    sans l'assistant (les réglages automatiques et l'analyse locale restent disponibles) ;
//  - alerte aux administrateurs (notification) une fois par jour ou par mois au seuil choisi (80 %) ;
//  - réponses identiques réutilisées (cache mémoire) : une même demande ne coûte qu'une fois.
// Les compteurs viennent du journal d'usage (ia_usage), jour et mois dans le fuseau de l'entreprise.

import { createHash } from 'node:crypto';
import { one, query } from '../../db/pool';
import { HttpError } from '../../lib/errors';
import { getParametres } from '../../lib/params';
import { notifier } from '../../realtime';
import { getPool } from '../../db/pool';

export interface GardeIA {
  active: boolean;
  jetons_jour: number;
  jetons_mois: number;
  appels_jour: number;
  appels_utilisateur_jour: number;
  alerte_pct: number;
}

export interface Consommation {
  jour: { jetons: number; appels: number };
  mois: { jetons: number; appels: number };
  utilisateur_jour: number;
}

export const GARDE_DEFAUT: GardeIA = { active: true, jetons_jour: 200_000, jetons_mois: 3_000_000, appels_jour: 300, appels_utilisateur_jour: 60, alerte_pct: 80 };

export async function lireGarde(): Promise<GardeIA & { alerte_jour_le: string | null; alerte_mois_le: string | null; updated_at: string | null; updated_by_nom: string | null }> {
  const g = await one<GardeIA & { alerte_jour_le: string | null; alerte_mois_le: string | null; updated_at: string | null; updated_by_nom: string | null }>(
    `SELECT g.active, g.jetons_jour, g.jetons_mois, g.appels_jour, g.appels_utilisateur_jour, g.alerte_pct, g.alerte_jour_le::text, g.alerte_mois_le::text, g.updated_at, u.nom AS updated_by_nom
     FROM ia_garde g LEFT JOIN users u ON u.id = g.updated_by WHERE g.id = 1`,
  );
  return g ?? { ...GARDE_DEFAUT, alerte_jour_le: null, alerte_mois_le: null, updated_at: null, updated_by_nom: null };
}

/** Consommation du jour et du mois (fuseau de l'entreprise) ; `userId` pour le compteur personnel. */
export async function consommation(userId?: number): Promise<Consommation> {
  const fuseau = (await getParametres()).fuseau || 'Africa/Dakar';
  const r = await one<{ jj: number; aj: number; jm: number; am: number; au: number }>(
    `SELECT
       coalesce(sum(coalesce(jetons_entree,0) + coalesce(jetons_sortie,0)) FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date), 0)::bigint AS jj,
       count(*) FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date AND statut <> 'budget')::int AS aj,
       coalesce(sum(coalesce(jetons_entree,0) + coalesce(jetons_sortie,0)), 0)::bigint AS jm,
       count(*) FILTER (WHERE statut <> 'budget')::int AS am,
       count(*) FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date AND user_id = $2 AND statut <> 'budget')::int AS au
     FROM ia_usage
     WHERE created_at >= date_trunc('month', now() AT TIME ZONE $1) AT TIME ZONE $1`,
    [fuseau, userId ?? -1],
  );
  return {
    jour: { jetons: Number(r?.jj ?? 0), appels: Number(r?.aj ?? 0) },
    mois: { jetons: Number(r?.jm ?? 0), appels: Number(r?.am ?? 0) },
    utilisateur_jour: Number(r?.au ?? 0),
  };
}

function demain(): string {
  return 'demain';
}

/**
 * Vérifie qu'un appel est permis (garde active) ; lève 429 « ia_budget » sinon.
 * Prévient les administrateurs une fois au seuil d'alerte.
 */
export async function verifierBudget(userId: number): Promise<void> {
  const g = await lireGarde();
  if (!g.active) return;
  const c = await consommation(userId);
  const refus = (message: string, detail: Record<string, unknown>) => {
    throw new HttpError(429, message, detail, 'ia_budget');
  };
  if (g.jetons_mois > 0 && c.mois.jetons >= g.jetons_mois) refus('Budget IA du mois atteint : l’assistant est en pause jusqu’au 1er du mois prochain. Les réglages automatiques restent disponibles.', { portee: 'mois', ...c.mois, plafond: g.jetons_mois });
  if (g.jetons_jour > 0 && c.jour.jetons >= g.jetons_jour) refus(`Budget IA du jour atteint : l’assistant reprend ${demain()}. Les réglages automatiques restent disponibles.`, { portee: 'jour', ...c.jour, plafond: g.jetons_jour });
  if (g.appels_jour > 0 && c.jour.appels >= g.appels_jour) refus(`Nombre d’appels à l’assistant atteint pour aujourd’hui (${g.appels_jour}) : il reprend ${demain()}.`, { portee: 'appels_jour', plafond: g.appels_jour });
  if (g.appels_utilisateur_jour > 0 && c.utilisateur_jour >= g.appels_utilisateur_jour) refus(`Vous avez utilisé l’assistant ${g.appels_utilisateur_jour} fois aujourd’hui : limite personnelle atteinte, reprise ${demain()}.`, { portee: 'utilisateur', plafond: g.appels_utilisateur_jour });
  await alerterSiSeuil(g, c).catch(() => {});
}

async function alerterSiSeuil(g: GardeIA & { alerte_jour_le: string | null; alerte_mois_le: string | null }, c: Consommation) {
  const seuil = g.alerte_pct / 100;
  const fuseau = (await getParametres()).fuseau || 'Africa/Dakar';
  const auj = new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const mois = auj.slice(0, 7);
  if (g.jetons_jour > 0 && c.jour.jetons >= g.jetons_jour * seuil && g.alerte_jour_le !== auj) {
    await query(`UPDATE ia_garde SET alerte_jour_le = $1 WHERE id = 1`, [auj]);
    await notifier(getPool(), { roles: ['admin'] }, { type: 'ia_budget', titre: `Assistant IA : ${Math.round((c.jour.jetons / g.jetons_jour) * 100)} % du budget du jour`, message: `${c.jour.jetons.toLocaleString('fr-FR')} jetons sur ${g.jetons_jour.toLocaleString('fr-FR')}. Réglez la garde dans Administration, Assistant IA.`, dossier_id: null });
  }
  if (g.jetons_mois > 0 && c.mois.jetons >= g.jetons_mois * seuil && (g.alerte_mois_le ?? '').slice(0, 7) !== mois) {
    await query(`UPDATE ia_garde SET alerte_mois_le = $1 WHERE id = 1`, [auj]);
    await notifier(getPool(), { roles: ['admin'] }, { type: 'ia_budget', titre: `Assistant IA : ${Math.round((c.mois.jetons / g.jetons_mois) * 100)} % du budget du mois`, message: `${c.mois.jetons.toLocaleString('fr-FR')} jetons sur ${g.jetons_mois.toLocaleString('fr-FR')}.`, dossier_id: null });
  }
}

// ---------------------------------------------------------------------------
// Réponses réutilisées : même demande, même configuration → même réponse, sans nouvel appel (24 h).

const cache = new Map<string, { at: number; valeur: unknown }>();
const CACHE_MS = 24 * 3600_000;

export function cleCache(...parties: unknown[]): string {
  return createHash('sha1').update(JSON.stringify(parties)).digest('hex');
}

export function lireCache<T>(cle: string): T | undefined {
  const c = cache.get(cle);
  if (!c) return undefined;
  if (Date.now() - c.at > CACHE_MS) {
    cache.delete(cle);
    return undefined;
  }
  return c.valeur as T;
}

export function ecrireCache(cle: string, valeur: unknown) {
  cache.set(cle, { at: Date.now(), valeur });
  if (cache.size > 1000) cache.delete(cache.keys().next().value!);
}

/** Pour les tests. */
export function viderCacheIA() {
  cache.clear();
}
