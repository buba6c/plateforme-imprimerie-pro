// Libérer de l'espace depuis « Sauvegardes et état » :
//  - « corbeille » : fichiers à la corbeille et fichiers des dossiers supprimés (toujours sur le disque) ;
//  - « anciens » : fichiers des commandes livrées, clôturées ou annulées depuis plus de N mois.
// Même mécanique que la purge du gestionnaire de fichiers : mot de passe, base d'abord (lignes marquées
// purgées, journal), disque ensuite. Les dossiers eux-mêmes ne sont jamais supprimés : la fiche garde la
// trace des fichiers effacés (historique « fichiers effacés pour libérer de l'espace »).

import type { Request } from 'express';
import bcrypt from 'bcryptjs';
import { one, query, tx } from '../../db/pool';
import { journal } from '../../lib/audit';
import { badRequest, conflict, HttpError } from '../../lib/errors';
import type { AuthUser } from '../../types';
import { parLots } from '../commun/disque';
import { evenement } from '../dossiers/service';
import { bilanPurge, effacerDuDisque, type BilanPurge } from '../fichiers-admin/effacer';
import { invaliderStockage } from './stockage';

export const CIBLES = ['corbeille', 'anciens'] as const;
export type Cible = (typeof CIBLES)[number];
export const MOIS_PERMIS = [3, 6, 12, 24] as const;
export const MOIS_DEFAUT = 6;
/** Fichiers traités par passage ; au-delà, l'écran propose de relancer. */
export const LOT_MAX = 2000;
const ECHECS_PAR_HEURE = 5;
let enCours = false;

const FROM = `FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id`;
const CORBEILLE = `f.purge_at IS NULL AND (f.deleted_at IS NOT NULL OR d.deleted_at IS NOT NULL)`;
const anciens = (p: string) => `f.purge_at IS NULL AND f.deleted_at IS NULL AND d.deleted_at IS NULL
  AND d.statut IN ('livre', 'termine', 'annule')
  AND coalesce(d.termine_at, d.livre_at, d.annule_at, d.updated_at) < now() - make_interval(months => ${p}::int)`;

export function lireMois(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : MOIS_DEFAUT;
  if (!(MOIS_PERMIS as readonly number[]).includes(n)) throw badRequest(`Ancienneté inconnue : choisissez ${MOIS_PERMIS.join(', ')} mois.`);
  return n;
}

interface Bloc {
  nb: number;
  taille: number;
  dossiers: number;
}

export interface ApercuNettoyage {
  corbeille: Bloc & { fichiers_corbeille: number; dossiers_supprimes: number };
  anciens: Bloc & { mois: number };
  lot_max: number;
}

export async function apercuNettoyage(mois: number): Promise<ApercuNettoyage> {
  const [corb, detail, anc] = await Promise.all([
    one<Bloc>(`SELECT count(*)::int AS nb, coalesce(sum(f.taille), 0)::bigint AS taille, count(DISTINCT d.id)::int AS dossiers ${FROM} WHERE ${CORBEILLE}`),
    one<{ fichiers_corbeille: number; dossiers_supprimes: number }>(
      `SELECT count(*) FILTER (WHERE d.deleted_at IS NULL)::int AS fichiers_corbeille,
              count(DISTINCT d.id) FILTER (WHERE d.deleted_at IS NOT NULL)::int AS dossiers_supprimes
       ${FROM} WHERE ${CORBEILLE}`,
    ),
    one<Bloc>(`SELECT count(*)::int AS nb, coalesce(sum(f.taille), 0)::bigint AS taille, count(DISTINCT d.id)::int AS dossiers ${FROM} WHERE ${anciens('$1')}`, [mois]),
  ]);
  return {
    corbeille: { ...(corb ?? { nb: 0, taille: 0, dossiers: 0 }), ...(detail ?? { fichiers_corbeille: 0, dossiers_supprimes: 0 }) },
    anciens: { mois, ...(anc ?? { nb: 0, taille: 0, dossiers: 0 }) },
    lot_max: LOT_MAX,
  };
}

export interface BilanNettoyage extends BilanPurge {
  cible: Cible;
  mois: number | null;
  dossiers: number;
  /** Fichiers encore à traiter après ce passage (lot limité) : relancer. */
  reste: number;
}

async function verifierMotDePasse(req: Request, user: AuthUser, motDePasse: string, cible: Cible) {
  const echecs = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM journal WHERE user_id = $1 AND action = 'purge_refusee' AND created_at > now() - interval '1 hour'`,
    [user.id],
  );
  if ((echecs?.n ?? 0) >= ECHECS_PAR_HEURE) {
    throw new HttpError(429, 'Trop de mots de passe incorrects : la suppression définitive est bloquée pendant une heure.', undefined, 'trop_de_tentatives');
  }
  if (!motDePasse) throw badRequest('Saisissez votre mot de passe pour confirmer la suppression définitive.', { champs: { mot_de_passe: 'Saisissez votre mot de passe' } });
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
  if (!u || motDePasse.length > 200 || !(await bcrypt.compare(motDePasse, u.password_hash))) {
    await journal(req, 'purge_refusee', 'fichier', null, { motif: 'mot_de_passe', nettoyage: cible });
    throw badRequest('Mot de passe incorrect : rien n’a été supprimé.', { champs: { mot_de_passe: 'Mot de passe incorrect' } });
  }
}

type Ligne = { id: number; nom_original: string; chemin: string; sha256: string | null; taille: number; dossier_id: number; numero: string; dossier_supprime: boolean };

export async function nettoyer(req: Request, user: AuthUser, cible: Cible, mois: number, motDePasse: string, racine: string): Promise<BilanNettoyage> {
  await verifierMotDePasse(req, user, motDePasse, cible);
  if (enCours) throw conflict('Un nettoyage est déjà en cours : attendez qu’il se termine.');
  enCours = true;
  try {
    const condition = cible === 'corbeille' ? CORBEILLE : anciens('$1');
    const args = cible === 'corbeille' ? [] : [mois];
    // 1. Base : les plus lourds d'abord, lot limité, lignes marquées purgées (et à la corbeille si elles n'y étaient pas).
    const rows = await tx(async (db) => {
      const r = await query<Ligne>(
        `SELECT f.id, f.nom_original, f.chemin, f.sha256, f.taille, f.dossier_id, d.numero, (d.deleted_at IS NOT NULL) AS dossier_supprime
         ${FROM} WHERE ${condition} ORDER BY f.taille DESC, f.id LIMIT ${LOT_MAX} FOR UPDATE OF f`,
        args,
        db,
      );
      if (!r.length) return r;
      const ids = r.map((x) => x.id);
      await query(
        `UPDATE fichiers SET deleted_at = coalesce(deleted_at, now()), deleted_by = coalesce(deleted_by, $2), purge_at = now(), purge_par = $2 WHERE id = ANY($1::int[])`,
        [ids, user.id],
        db,
      );
      // Trace sur chaque dossier encore visible : « fichiers effacés pour libérer de l'espace ».
      const parDossier = new Map<number, Ligne[]>();
      for (const x of r) if (!x.dossier_supprime) parDossier.set(x.dossier_id, [...(parDossier.get(x.dossier_id) ?? []), x]);
      for (const [dossierId, l] of parDossier) {
        await evenement(db, dossierId, user.id, {
          type: 'fichier',
          action: 'nettoyage',
          data: { nb: l.length, taille: l.reduce((t, x) => t + Number(x.taille), 0), noms: l.slice(0, 20).map((x) => x.nom_original), cible, mois: cible === 'anciens' ? mois : null },
        });
      }
      await journal(
        req,
        'nettoyage_stockage',
        'fichier',
        null,
        {
          cible,
          mois: cible === 'anciens' ? mois : null,
          nb: r.length,
          taille: r.reduce((t, x) => t + Number(x.taille), 0),
          dossiers: new Set(r.map((x) => x.dossier_id)).size,
          fichiers: r.slice(0, 500).map((x) => ({ id: x.id, nom: x.nom_original, chemin: x.chemin, sha256: x.sha256, taille: Number(x.taille), dossier_id: x.dossier_id, numero: x.numero })),
        },
        db,
      );
      return r;
    });

    // 2. Disque, après le commit.
    const resultats = await parLots(rows, 8, (f) => effacerDuDisque(racine, f.chemin));
    if (rows.length) {
      await query(
        `UPDATE fichiers f SET purge_resultat = v.resultat FROM unnest($1::int[], $2::text[]) AS v(id, resultat) WHERE f.id = v.id`,
        [rows.map((f) => f.id), resultats.map((x) => x.resultat)],
      );
    }
    const reste = await one<{ n: number }>(`SELECT count(*)::int AS n ${FROM} WHERE ${condition}`, args);
    const bilan: BilanNettoyage = {
      ...bilanPurge(rows, resultats),
      cible,
      mois: cible === 'anciens' ? mois : null,
      dossiers: new Set(rows.map((x) => x.dossier_id)).size,
      reste: reste?.n ?? 0,
    };
    await journal(req, 'nettoyage_stockage_resultat', 'fichier', null, bilan);
    invaliderStockage();
    return bilan;
  } finally {
    enCours = false;
  }
}
