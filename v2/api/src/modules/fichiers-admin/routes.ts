// Gestionnaire global des fichiers : liste transversale des fichiers des dossiers visibles,
// corbeille des fichiers (restauration) et contrôle d'intégrité du stockage.
//
// L'aperçu et le téléchargement ne sont pas servis ici : ils passent par
// GET /api/fichiers/:id/contenu (module fichiers), qui vérifie les droits sur le dossier.
// La visibilité est celle des dossiers (dossiers/access.ts), appliquée dans le SQL.

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { MACHINES, STATUTS, type Machine, type Statut } from '@evocom/shared';
import type { Config } from '../../config';
import { one, query, tx } from '../../db/pool';
import { journal } from '../../lib/audit';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam, qInt, qList, qStr } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { signalDossier } from '../../realtime';
import type { AuthUser } from '../../types';
import { visibilite } from '../dossiers/access';
import { evenement } from '../dossiers/service';
import { Conditions, filtrePeriode, intervalle, motifLike, pagination } from '../commun/requete';

export const CATEGORIES = ['pdf', 'image', 'autre'] as const;
const TRIS = ['date', 'nom', 'taille'] as const;

/** Catégorie d'un fichier (alias `f`) : d'après le type MIME, à défaut l'extension. Sans « ? » (marqueur de Conditions.add). */
const CATEGORIE = `(CASE
  WHEN f.mime = 'application/pdf' OR lower(f.nom_original) LIKE '%.pdf' THEN 'pdf'
  WHEN f.mime LIKE 'image/%' OR lower(f.nom_original) ~ '\\.(png|jpg|jpeg|gif|webp|tif|tiff|bmp|svg|heic|psd)$' THEN 'image'
  ELSE 'autre' END)`;

const FROM_FICHIERS = `
  FROM fichiers f
  JOIN dossiers d ON d.id = f.dossier_id
  LEFT JOIN users u ON u.id = f.uploaded_by`;

const COLONNES = `
  f.id, f.nom_original, f.mime, f.taille, f.a_reimprimer, f.created_at, f.uploaded_by, u.nom AS uploaded_by_nom,
  ${CATEGORIE} AS categorie, (f.legacy_id IS NOT NULL) AS importe,
  d.id AS dossier_id, d.numero AS dossier_numero, d.statut AS dossier_statut, d.machine, d.client_id, d.client_nom, d.urgent`;

function valeursConnues<T extends string>(valeurs: string[] | undefined, permises: readonly T[], libelle: string): T[] | undefined {
  if (!valeurs?.length) return undefined;
  const inconnues = valeurs.filter((v) => !(permises as readonly string[]).includes(v));
  if (inconnues.length) throw badRequest(`${libelle} inconnu : ${inconnues.join(', ')}. Valeurs possibles : ${permises.join(', ')}.`);
  return valeurs as T[];
}

/** Fichiers non supprimés des dossiers visibles par l'utilisateur. */
async function conditionsVisibles(user: AuthUser): Promise<Conditions> {
  const params = await getParametres();
  const c = new Conditions();
  const vis = visibilite(user, 0, params.livreur_jours_historique);
  c.parts.push(vis.sql);
  c.args.push(...vis.params);
  c.add('f.deleted_at IS NULL');
  return c;
}

/** Chemin absolu d'un fichier sous le stockage, ou null s'il en sortirait. */
function cheminAbsolu(racine: string, chemin: string): string | null {
  const abs = path.resolve(racine, chemin);
  return abs.startsWith(racine + path.sep) ? abs : null;
}

async function tailleSurDisque(racine: string, chemin: string): Promise<number | null> {
  const abs = cheminAbsolu(racine, chemin);
  if (!abs) return null;
  const st = await fs.promises.stat(abs).catch(() => null);
  return st?.isFile() ? st.size : null;
}

/** Applique `fn` à chaque élément avec au plus `n` opérations simultanées. */
async function parLots<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]!);
      }
    }),
  );
  return out;
}

/** Fichiers présents sous `dir` (récursif) : chemin absolu normalisé → taille. */
async function inventaire(dir: string, out = new Map<string, number>()): Promise<Map<string, number>> {
  const d = await fs.promises.opendir(dir).catch(() => null);
  if (!d) return out;
  for await (const e of d) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await inventaire(abs, out);
    else if (e.isFile()) {
      const st = await fs.promises.stat(abs).catch(() => null);
      if (st) out.set(abs.normalize('NFC'), st.size);
    }
  }
  return out;
}

export function fichiersAdminRouter(config: Config) {
  const router = Router();
  const racine = path.resolve(config.storageDir);
  router.use(requireAuth);

  // -------------------------------------------------------------------------
  // Liste transversale

  router.get('/', requireRole('admin', 'preparateur'), async (req, res) => {
    const user = me(req);
    const params = await getParametres();
    const { page, limit, offset } = pagination(req, 50, 200);
    const { from, to } = intervalle(req);
    const c = await conditionsVisibles(user);

    const q = qStr(req, 'q');
    if (q) c.add(`lower(f.nom_original || ' ' || d.numero || ' ' || d.client_nom) LIKE ?`, motifLike(q.slice(0, 200)));
    const types = valeursConnues(qList(req, 'type'), CATEGORIES, 'Type de fichier');
    if (types) c.parts.push(`${CATEGORIE} = ANY(${c.param(types)})`);
    const machine = qStr(req, 'machine');
    if (machine) c.add('d.machine = ?', valeursConnues([machine], MACHINES, 'Machine')![0] as Machine);
    const statuts = valeursConnues<Statut>(qList(req, 'statut'), STATUTS, 'Statut de dossier');
    if (statuts) c.add('d.statut = ANY(?)', statuts);
    const auteur = qInt(req, 'uploaded_by');
    if (auteur) c.add('f.uploaded_by = ?', auteur);
    const dossierId = qInt(req, 'dossier_id');
    if (dossierId) c.add('f.dossier_id = ?', dossierId);
    filtrePeriode(c, 'f.created_at', params.fuseau, from, to);

    const tri = valeursConnues(qStr(req, 'tri') ? [qStr(req, 'tri')!] : undefined, TRIS, 'Tri')?.[0] ?? 'date';
    const ordreParam = qStr(req, 'ordre');
    if (ordreParam && ordreParam !== 'asc' && ordreParam !== 'desc') throw badRequest('Ordre inconnu : utilisez asc ou desc.');
    const ordre = (ordreParam ?? (tri === 'nom' ? 'asc' : 'desc')).toUpperCase();
    const orderBy =
      tri === 'nom'
        ? `lower(f.nom_original) ${ordre}, f.id ${ordre}`
        : tri === 'taille'
          ? `f.taille ${ordre}, f.id ${ordre}`
          : `f.created_at ${ordre}, f.id ${ordre}`;

    const totaux = await one<{ n: number; taille: number }>(
      `SELECT count(*)::int AS n, coalesce(sum(f.taille), 0)::bigint AS taille ${FROM_FICHIERS} ${c.where}`,
      c.args,
    );
    const items = await query(`SELECT ${COLONNES} ${FROM_FICHIERS} ${c.where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`, c.args);
    res.json({ items, total: totaux?.n ?? 0, taille_totale: totaux?.taille ?? 0, page, limit });
  });

  /** Personnes ayant envoyé au moins un des fichiers visibles (pour le filtre « Envoyé par »). */
  router.get('/auteurs', requireRole('admin', 'preparateur'), async (req, res) => {
    const c = await conditionsVisibles(me(req));
    const rows = await query(
      `SELECT u.id, u.nom, u.role, count(*)::int AS nb ${FROM_FICHIERS} ${c.where} AND u.id IS NOT NULL
       GROUP BY u.id, u.nom, u.role ORDER BY lower(u.nom), u.id`,
      c.args,
    );
    res.json(rows);
  });

  // -------------------------------------------------------------------------
  // Corbeille des fichiers (administrateur)

  router.get('/corbeille', requireRole('admin'), async (req, res) => {
    const { page, limit, offset } = pagination(req, 50, 200);
    const c = new Conditions().add('f.deleted_at IS NOT NULL');
    const q = qStr(req, 'q');
    if (q) c.add(`lower(f.nom_original || ' ' || d.numero || ' ' || d.client_nom) LIKE ?`, motifLike(q.slice(0, 200)));
    const totaux = await one<{ n: number; taille: number }>(
      `SELECT count(*)::int AS n, coalesce(sum(f.taille), 0)::bigint AS taille ${FROM_FICHIERS} ${c.where}`,
      c.args,
    );
    const rows = await query<Record<string, unknown> & { chemin: string; dossier_supprime: boolean }>(
      `SELECT ${COLONNES}, f.chemin, f.deleted_at, f.deleted_by, ud.nom AS deleted_by_nom,
              (d.deleted_at IS NOT NULL) AS dossier_supprime, d.deleted_at AS dossier_deleted_at
       ${FROM_FICHIERS}
       LEFT JOIN users ud ON ud.id = f.deleted_by
       ${c.where}
       ORDER BY f.deleted_at DESC, f.id DESC LIMIT ${limit} OFFSET ${offset}`,
      c.args,
    );
    const items = await parLots(rows, 16, async ({ chemin, ...r }) => ({
      ...r,
      present: (await tailleSurDisque(racine, chemin)) !== null,
      peut_restaurer: !r.dossier_supprime,
    }));
    res.json({ items, total: totaux?.n ?? 0, taille_totale: totaux?.taille ?? 0, page, limit });
  });

  router.post('/:id/restaurer', requireRole('admin'), async (req, res) => {
    const user = me(req);
    const id = intParam(req);
    const d = await tx(async (db) => {
      const f = await one<{ id: number; nom_original: string; dossier_id: number; deleted_at: string | null; numero: string; dossier_deleted_at: string | null }>(
        `SELECT f.id, f.nom_original, f.dossier_id, f.deleted_at, d.numero, d.deleted_at AS dossier_deleted_at
         FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id WHERE f.id = $1 FOR UPDATE OF f`,
        [id],
        db,
      );
      if (!f) throw notFound("Ce fichier n'existe pas.");
      if (!f.deleted_at) throw conflict("Ce fichier n'est pas dans la corbeille.");
      if (f.dossier_deleted_at) {
        throw conflict(
          `Le dossier ${f.numero} est lui-même dans la corbeille : restaurez d'abord le dossier (Corbeille des dossiers), puis ce fichier.`,
          { dossier_id: f.dossier_id },
        );
      }
      await query(`UPDATE fichiers SET deleted_at = NULL, deleted_by = NULL WHERE id = $1`, [id], db);
      await evenement(db, f.dossier_id, user.id, { type: 'fichier', action: 'restauration', data: { fichier_id: id, nom: f.nom_original } });
      await journal(req, 'fichier_restaure', 'fichier', id, { nom: f.nom_original, dossier_id: f.dossier_id, numero: f.numero, supprime_le: f.deleted_at }, db);
      return one<{ id: number; numero: string; statut: Statut; machine: Machine; preparateur_id: number | null }>(
        `SELECT id, numero, statut, machine, preparateur_id FROM dossiers WHERE id = $1`,
        [f.dossier_id],
        db,
      );
    });
    if (d) signalDossier({ ...d, ancien_statut: d.statut });
    res.json(await one(`SELECT ${COLONNES} ${FROM_FICHIERS} WHERE f.id = $1`, [id]));
  });

  // -------------------------------------------------------------------------
  // Contrôle d'intégrité (administrateur)

  /**
   * Compare la table `fichiers` au contenu du stockage : fichiers absents du disque (ou de taille
   * différente de celle enregistrée), fichiers du disque qu'aucune ligne ne référence, place occupée.
   */
  router.get('/integrite', requireRole('admin'), async (_req, res) => {
    const debut = Date.now();
    const rows = await query<{
      id: number;
      nom_original: string;
      chemin: string;
      taille: number;
      created_at: string;
      supprime: boolean;
      importe: boolean;
      dossier_id: number;
      dossier_numero: string;
      dossier_statut: Statut;
      client_nom: string;
      dossier_supprime: boolean;
    }>(
      `SELECT f.id, f.nom_original, f.chemin, f.taille, f.created_at, (f.deleted_at IS NOT NULL) AS supprime,
              (f.legacy_id IS NOT NULL) AS importe, d.id AS dossier_id, d.numero AS dossier_numero, d.statut AS dossier_statut,
              d.client_nom, (d.deleted_at IS NOT NULL) AS dossier_supprime
       FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id
       ORDER BY f.created_at DESC, f.id DESC`,
    );
    const tailles = await parLots(rows, 32, (r) => tailleSurDisque(racine, r.chemin));

    const bloc = () => ({ nb: 0, taille: 0 });
    const repartition = { actifs: bloc(), corbeille: bloc(), dossiers_corbeille: bloc() };
    const presents = { nb: 0, taille: 0 };
    const manquants = { nb: 0, taille_declaree: 0, items: [] as unknown[] };
    const tailleDifferente = { nb: 0, items: [] as unknown[] };
    const references = new Set<string>();
    const LISTE_MAX = 500;

    rows.forEach((r, i) => {
      const etat = r.supprime ? 'corbeille' : r.dossier_supprime ? 'dossier_corbeille' : 'actif';
      const cat = etat === 'actif' ? repartition.actifs : etat === 'corbeille' ? repartition.corbeille : repartition.dossiers_corbeille;
      cat.nb++;
      cat.taille += r.taille;
      const abs = cheminAbsolu(racine, r.chemin);
      if (abs) references.add(abs.normalize('NFC'));
      const surDisque = tailles[i];
      const item = {
        id: r.id,
        nom_original: r.nom_original,
        chemin: r.chemin,
        taille: r.taille,
        created_at: r.created_at,
        etat,
        importe: r.importe,
        dossier_id: r.dossier_id,
        dossier_numero: r.dossier_numero,
        dossier_statut: r.dossier_statut,
        client_nom: r.client_nom,
      };
      if (surDisque === null || surDisque === undefined) {
        manquants.nb++;
        manquants.taille_declaree += r.taille;
        if (manquants.items.length < LISTE_MAX) manquants.items.push(item);
        return;
      }
      presents.nb++;
      presents.taille += surDisque;
      if (surDisque !== r.taille) {
        tailleDifferente.nb++;
        if (tailleDifferente.items.length < LISTE_MAX) tailleDifferente.items.push({ ...item, taille_disque: surDisque });
      }
    });

    // Fichiers du disque (sous dossiers/) qu'aucune ligne ne référence : envois interrompus, restes d'import.
    const disque = await inventaire(path.join(racine, 'dossiers'));
    const orphelins = { nb: 0, taille: 0 };
    for (const [abs, taille] of disque) {
      if (references.has(abs)) continue;
      orphelins.nb++;
      orphelins.taille += taille;
    }

    let espace: { libre_octets: number; total_octets: number } | null = null;
    try {
      const s = await fs.promises.statfs(racine);
      espace = { libre_octets: Number(s.bavail) * Number(s.bsize), total_octets: Number(s.blocks) * Number(s.bsize) };
    } catch {
      espace = null;
    }

    res.json({
      verifie_at: new Date().toISOString(),
      duree_ms: Date.now() - debut,
      fichiers: { nb: rows.length, taille: rows.reduce((s, r) => s + r.taille, 0) },
      repartition,
      presents,
      manquants,
      taille_differente: tailleDifferente,
      orphelins,
      espace,
    });
  });

  return router;
}
