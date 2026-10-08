// Gestionnaire global des fichiers : liste transversale des fichiers des dossiers visibles,
// corbeille des fichiers (restauration, mise à la corbeille et restauration groupées), purge définitive
// et contrôle d'intégrité du stockage.
//
// Purge : une ligne purgée (purge_at renseigné) reste en base comme trace ; elle n'apparaît plus nulle part
// (liste, corbeille, contrôle) et ne peut plus être restaurée. La base est mise à jour d'abord (transaction,
// journal), le disque ensuite. Les fichiers importés sont des liens durs partagés avec l'ancienne application
// et les instantanés de sauvegarde : effacer ce nom ne libère la place que s'il était le dernier (nlink = 1).
//
// L'aperçu et le téléchargement ne sont pas servis ici : ils passent par
// GET /api/fichiers/:id/contenu (module fichiers), qui vérifie les droits sur le dossier.
// La visibilité est celle des dossiers (dossiers/access.ts), appliquée dans le SQL.

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { MACHINES, STATUTS, type Machine, type Statut } from '@evocom/shared';
import type { Config } from '../../config';
import { one, query, tx } from '../../db/pool';
import { journal } from '../../lib/audit';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { badRequest, conflict, HttpError, notFound, zodDetails } from '../../lib/errors';
import { intParam, qInt, qList, qStr } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { signalDossier } from '../../realtime';
import type { AuthUser } from '../../types';
import { visibilite } from '../dossiers/access';
import { evenement } from '../dossiers/service';
import { Conditions, filtrePeriode, intervalle, motifLike, pagination } from '../commun/requete';
import { cheminSous, parLots } from '../commun/disque';
import { invaliderStockage } from '../systeme/stockage';

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

const cheminAbsolu = cheminSous;

/** Taille du fichier sur le disque et nombre de noms qui partagent son contenu (liens durs). */
async function statDisque(racine: string, chemin: string): Promise<{ taille: number; nlink: number } | null> {
  const abs = cheminAbsolu(racine, chemin);
  if (!abs) return null;
  const st = await fs.promises.stat(abs).catch(() => null);
  return st?.isFile() ? { taille: st.size, nlink: st.nlink } : null;
}

async function tailleSurDisque(racine: string, chemin: string): Promise<number | null> {
  return (await statDisque(racine, chemin))?.taille ?? null;
}

const MAX_GROUPE = 500;
const idsSchema = z.object({
  ids: z
    .array(z.number({ invalid_type_error: 'Identifiant de fichier : nombre entier attendu' }).int('Identifiant de fichier : nombre entier attendu').positive(), {
      required_error: 'Sélectionnez au moins un fichier',
      invalid_type_error: 'Liste de fichiers attendue',
    })
    .min(1, 'Sélectionnez au moins un fichier')
    .max(MAX_GROUPE, `Pas plus de ${MAX_GROUPE} fichiers à la fois : faites plusieurs opérations.`),
});

function lireIds(body: unknown): number[] {
  const r = idsSchema.safeParse(body ?? {});
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? 'Liste de fichiers invalide.', { champs: zodDetails(r.error) });
  return [...new Set(r.data.ids)];
}

type DossierSignalRow = { id: number; numero: string; statut: Statut; machine: Machine; preparateur_id: number | null };

async function signalerDossiers(ids: number[]) {
  if (!ids.length) return;
  const ds = await query<DossierSignalRow>(`SELECT id, numero, statut, machine, preparateur_id FROM dossiers WHERE id = ANY($1::int[])`, [ids]);
  for (const d of ds) signalDossier({ ...d, ancien_statut: d.statut });
}

/** Purge : 5 mots de passe faux par heure au plus, puis 429. */
const PURGE_ECHECS_PAR_HEURE = 5;
let purgeEnCours = false;

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
    const c = new Conditions().add('f.deleted_at IS NOT NULL').add('f.purge_at IS NULL');
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
    const items = await parLots(rows, 16, async ({ chemin, ...r }) => {
      const st = await statDisque(racine, chemin);
      return {
        ...r,
        present: st !== null,
        // Contenu partagé avec d'autres noms (ancienne application, instantanés) : le supprimer ne libère pas la place tout de suite.
        partage: !!st && st.nlink > 1,
        peut_restaurer: !r.dossier_supprime,
      };
    });
    res.json({ items, total: totaux?.n ?? 0, taille_totale: totaux?.taille ?? 0, page, limit });
  });

  router.post('/:id/restaurer', requireRole('admin'), async (req, res) => {
    const user = me(req);
    const id = intParam(req);
    const d = await tx(async (db) => {
      const f = await one<{ id: number; nom_original: string; dossier_id: number; deleted_at: string | null; purge_at: string | null; numero: string; dossier_deleted_at: string | null }>(
        `SELECT f.id, f.nom_original, f.dossier_id, f.deleted_at, f.purge_at, d.numero, d.deleted_at AS dossier_deleted_at
         FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id WHERE f.id = $1 FOR UPDATE OF f`,
        [id],
        db,
      );
      if (!f) throw notFound("Ce fichier n'existe pas.");
      if (!f.deleted_at) throw conflict("Ce fichier n'est pas dans la corbeille.");
      if (f.purge_at) throw conflict('Ce fichier a été supprimé définitivement du disque : il ne peut plus être restauré.');
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
  // Actions groupées (administrateur)

  /**
   * Met des fichiers à la corbeille, même si leur dossier est validé ou livré (place disque). Les fichiers
   * déjà à la corbeille sont ignorés. Événement « fichier/suppression » sur chaque dossier, une entrée au journal.
   */
  router.post('/corbeille-groupee', requireRole('admin'), async (req, res) => {
    const user = me(req);
    const ids = lireIds(req.body);
    const r = await tx(async (db) => {
      const rows = await query<{ id: number; nom_original: string; taille: number; dossier_id: number; numero: string; deleted_at: string | null }>(
        `SELECT f.id, f.nom_original, f.taille, f.dossier_id, d.numero, f.deleted_at
         FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id
         WHERE f.id = ANY($1::int[]) ORDER BY f.id FOR UPDATE OF f`,
        [ids],
        db,
      );
      const trouves = new Set(rows.map((x) => x.id));
      const aMettre = rows.filter((x) => !x.deleted_at);
      const taille = aMettre.reduce((t, x) => t + Number(x.taille), 0);
      if (aMettre.length) {
        await query(`UPDATE fichiers SET deleted_at = now(), deleted_by = $2 WHERE id = ANY($1::int[])`, [aMettre.map((x) => x.id), user.id], db);
        for (const f of aMettre) {
          await evenement(db, f.dossier_id, user.id, { type: 'fichier', action: 'suppression', data: { fichier_id: f.id, nom: f.nom_original, groupe: true } });
        }
        await journal(
          req,
          'fichiers_corbeille_groupee',
          'fichier',
          null,
          { nb: aMettre.length, taille, fichiers: aMettre.map((f) => ({ id: f.id, nom: f.nom_original, taille: Number(f.taille), dossier_id: f.dossier_id, numero: f.numero })) },
          db,
        );
      }
      return {
        mis_a_la_corbeille: aMettre.length,
        taille,
        deja_a_la_corbeille: rows.filter((x) => x.deleted_at).map((x) => x.id),
        introuvables: ids.filter((id) => !trouves.has(id)),
        dossiers: [...new Set(aMettre.map((x) => x.dossier_id))],
      };
    });
    await signalerDossiers(r.dossiers);
    invaliderStockage();
    res.json(r);
  });

  /** Restaure des fichiers de la corbeille ; ceux qui ne peuvent pas l'être sont listés avec la raison. */
  router.post('/restaurer-groupe', requireRole('admin'), async (req, res) => {
    const user = me(req);
    const ids = lireIds(req.body);
    const r = await tx(async (db) => {
      const rows = await query<{
        id: number;
        nom_original: string;
        dossier_id: number;
        numero: string;
        deleted_at: string | null;
        purge_at: string | null;
        dossier_deleted_at: string | null;
      }>(
        `SELECT f.id, f.nom_original, f.dossier_id, d.numero, f.deleted_at, f.purge_at, d.deleted_at AS dossier_deleted_at
         FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id
         WHERE f.id = ANY($1::int[]) ORDER BY f.id FOR UPDATE OF f`,
        [ids],
        db,
      );
      const trouves = new Set(rows.map((x) => x.id));
      const ignores: { id: number; nom: string | null; raison: string; message: string }[] = ids
        .filter((id) => !trouves.has(id))
        .map((id) => ({ id, nom: null, raison: 'introuvable', message: "Ce fichier n'existe pas." }));
      const ok: typeof rows = [];
      for (const f of rows) {
        if (!f.deleted_at) ignores.push({ id: f.id, nom: f.nom_original, raison: 'pas_a_la_corbeille', message: "Ce fichier n'est pas dans la corbeille." });
        else if (f.purge_at) ignores.push({ id: f.id, nom: f.nom_original, raison: 'purge', message: 'Supprimé définitivement : il ne peut plus être restauré.' });
        else if (f.dossier_deleted_at) {
          ignores.push({ id: f.id, nom: f.nom_original, raison: 'dossier_a_la_corbeille', message: `Le dossier ${f.numero} est à la corbeille : restaurez d'abord le dossier.` });
        } else ok.push(f);
      }
      if (ok.length) {
        await query(`UPDATE fichiers SET deleted_at = NULL, deleted_by = NULL WHERE id = ANY($1::int[])`, [ok.map((f) => f.id)], db);
        for (const f of ok) await evenement(db, f.dossier_id, user.id, { type: 'fichier', action: 'restauration', data: { fichier_id: f.id, nom: f.nom_original, groupe: true } });
        await journal(req, 'fichiers_restaures_groupe', 'fichier', null, { nb: ok.length, fichiers: ok.map((f) => ({ id: f.id, nom: f.nom_original, dossier_id: f.dossier_id, numero: f.numero })) }, db);
      }
      return { restaures: ok.length, ignores, dossiers: [...new Set(ok.map((f) => f.dossier_id))] };
    });
    await signalerDossiers(r.dossiers);
    invaliderStockage();
    res.json(r);
  });

  // -------------------------------------------------------------------------
  // Purge définitive (administrateur, mot de passe)

  /**
   * Efface du disque le fichier d'une ligne déjà purgée en base. Garde-fous : chemin sous STORAGE_DIR/dossiers,
   * fichier ordinaire (jamais un lien symbolique ni un dossier), aucune autre ligne non purgée avec ce chemin.
   */
  async function effacerDuDisque(chemin: string): Promise<{ resultat: string; supprime: boolean; libere: number; partage: number; erreur?: string }> {
    const base = path.join(racine, 'dossiers');
    const abs = cheminAbsolu(racine, chemin);
    if (!abs || !abs.startsWith(base + path.sep)) {
      return { resultat: 'conserve : chemin hors du dossier des fichiers', supprime: false, libere: 0, partage: 0, erreur: 'Chemin hors du dossier des fichiers : rien n’a été effacé.' };
    }
    const autres = await one<{ n: number }>(`SELECT count(*)::int AS n FROM fichiers WHERE chemin = $1 AND purge_at IS NULL`, [chemin]);
    if (autres?.n) {
      return { resultat: 'conserve : utilisé par un autre fichier', supprime: false, libere: 0, partage: 0, erreur: 'Gardé sur le disque : le même fichier sert encore à un autre dossier.' };
    }
    let st: fs.Stats;
    try {
      st = await fs.promises.lstat(abs);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { resultat: 'absent du disque', supprime: false, libere: 0, partage: 0 };
      return { resultat: `erreur : ${code ?? 'lecture'}`, supprime: false, libere: 0, partage: 0, erreur: `Lecture impossible (${code ?? (e as Error).message}).` };
    }
    if (!st.isFile()) {
      return { resultat: 'conserve : pas un fichier ordinaire', supprime: false, libere: 0, partage: 0, erreur: 'Ce n’est pas un fichier ordinaire (lien symbolique ou dossier) : rien n’a été effacé.' };
    }
    try {
      await fs.promises.unlink(abs);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { resultat: 'absent du disque', supprime: false, libere: 0, partage: 0 };
      return { resultat: `erreur : ${code ?? 'effacement'}`, supprime: false, libere: 0, partage: 0, erreur: `Effacement impossible (${code ?? (e as Error).message}).` };
    }
    await fs.promises.rmdir(path.dirname(abs)).catch(() => {}); // dossier du dossier vide : retiré, sinon gardé
    return st.nlink > 1
      ? { resultat: `supprime (contenu partagé : ${st.nlink} noms)`, supprime: true, libere: 0, partage: st.size }
      : { resultat: 'supprime', supprime: true, libere: st.size, partage: 0 };
  }

  router.post('/purger', requireRole('admin'), async (req, res) => {
    const user = me(req);
    const echecs = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM journal WHERE user_id = $1 AND action = 'purge_refusee' AND created_at > now() - interval '1 hour'`,
      [user.id],
    );
    if ((echecs?.n ?? 0) >= PURGE_ECHECS_PAR_HEURE) {
      throw new HttpError(429, 'Trop de mots de passe incorrects : la suppression définitive est bloquée pendant une heure.', undefined, 'trop_de_tentatives');
    }
    const motDePasse = typeof req.body?.mot_de_passe === 'string' ? (req.body.mot_de_passe as string) : '';
    if (!motDePasse) throw badRequest('Saisissez votre mot de passe pour confirmer la suppression définitive.', { champs: { mot_de_passe: 'Saisissez votre mot de passe' } });
    const ids = lireIds(req.body);
    const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
    if (!u || motDePasse.length > 200 || !(await bcrypt.compare(motDePasse, u.password_hash))) {
      await journal(req, 'purge_refusee', 'fichier', null, { motif: 'mot_de_passe', nb: ids.length });
      throw badRequest('Mot de passe incorrect : rien n’a été supprimé.', { champs: { mot_de_passe: 'Mot de passe incorrect' } });
    }
    if (purgeEnCours) throw conflict('Une suppression définitive est déjà en cours : attendez qu’elle se termine.');
    purgeEnCours = true;
    try {
      // 1. Base : les lignes sont marquées purgées et journalisées (id, chemin, sha256, taille) en une transaction.
      const rows = await tx(async (db) => {
        const r = await query<{
          id: number;
          nom_original: string;
          chemin: string;
          sha256: string | null;
          taille: number;
          dossier_id: number;
          numero: string;
          deleted_at: string | null;
          purge_at: string | null;
        }>(
          `SELECT f.id, f.nom_original, f.chemin, f.sha256, f.taille, f.dossier_id, d.numero, f.deleted_at, f.purge_at
           FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id
           WHERE f.id = ANY($1::int[]) ORDER BY f.id FOR UPDATE OF f`,
          [ids],
          db,
        );
        const trouves = new Set(r.map((x) => x.id));
        const introuvables = ids.filter((id) => !trouves.has(id));
        const horsCorbeille = r.filter((x) => !x.deleted_at).map((x) => x.id);
        const dejaPurges = r.filter((x) => x.purge_at).map((x) => x.id);
        if (introuvables.length || horsCorbeille.length || dejaPurges.length) {
          const n = introuvables.length + horsCorbeille.length + dejaPurges.length;
          throw conflict(
            `Seuls les fichiers de la corbeille peuvent être supprimés définitivement : ${n} ${n > 1 ? 'fichiers sélectionnés ne le sont pas' : 'fichier sélectionné ne l’est pas'} (hors corbeille, déjà supprimé ou introuvable). Rien n’a été supprimé.`,
            { hors_corbeille: horsCorbeille, deja_purges: dejaPurges, introuvables },
          );
        }
        await query(`UPDATE fichiers SET purge_at = now(), purge_par = $2 WHERE id = ANY($1::int[])`, [ids, user.id], db);
        await journal(
          req,
          'fichiers_purges',
          'fichier',
          null,
          {
            nb: r.length,
            taille: r.reduce((t, x) => t + Number(x.taille), 0),
            fichiers: r.map((x) => ({ id: x.id, nom: x.nom_original, chemin: x.chemin, sha256: x.sha256, taille: Number(x.taille), dossier_id: x.dossier_id, numero: x.numero })),
          },
          db,
        );
        return r;
      });

      // 2. Disque, après le commit : chaque fichier est effacé s'il remplit les garde-fous.
      const resultats = await parLots(rows, 8, (f) => effacerDuDisque(f.chemin));
      await query(
        `UPDATE fichiers f SET purge_resultat = v.resultat FROM unnest($1::int[], $2::text[]) AS v(id, resultat) WHERE f.id = v.id`,
        [rows.map((f) => f.id), resultats.map((x) => x.resultat)],
      );
      const bilan = {
        purges: rows.length,
        supprimes_du_disque: resultats.filter((x) => x.supprime).length,
        octets_liberes_maintenant: resultats.reduce((t, x) => t + x.libere, 0),
        octets_partages: resultats.reduce((t, x) => t + x.partage, 0),
        fichiers_partages: resultats.filter((x) => x.partage > 0).length,
        absents: resultats.filter((x) => x.resultat === 'absent du disque').length,
        erreurs: resultats.flatMap((x, i) => (x.erreur ? [{ id: rows[i]!.id, nom: rows[i]!.nom_original, message: x.erreur }] : [])),
      };
      await journal(req, 'fichiers_purges_resultat', 'fichier', null, bilan);
      invaliderStockage();
      res.json(bilan);
    } finally {
      purgeEnCours = false;
    }
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
       WHERE f.purge_at IS NULL
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
