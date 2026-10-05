// Réinitialisation de la plateforme : efface les données métier, conserve comptes, tarifs, paramètres et journal.
// Garde-fous : ALLOW_SYSTEM_RESET=true sur le serveur, mot de passe de l'administrateur, phrase recopiée,
// 3 tentatives par heure, sauvegarde complète (pg_dump) avant toute écriture ; les fichiers physiques sont
// déplacés, jamais supprimés.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import type { Config } from '../../config';
import { one, query, tx, type Db } from '../../db/pool';
import { journal } from '../../lib/audit';
import { HttpError } from '../../lib/errors';

export const PHRASE = 'REINITIALISER EVOCOM';
export const VARIABLE = 'ALLOW_SYSTEM_RESET';
const TENTATIVES_PAR_HEURE = 3;
export const ACTIONS_TENTATIVE = ['reinitialisation_refusee', 'reinitialisation_echouee', 'plateforme_reinitialisee'];

/** Données métier effacées ; toute table qui en dépend (clé étrangère) est effacée avec elles. */
const A_EFFACER = ['dossiers', 'fichiers', 'paiements', 'devis', 'factures', 'notifications', 'dossier_events', 'clients'];
/** Jamais effacées : si l'une dépendait des données effacées, la réinitialisation est refusée. */
const CONSERVEES = ['users', 'tarifs', 'parametres', 'journal', 'sauvegardes', 'compteurs', 'schema_migrations'];

const LIBELLES: Record<string, string> = {
  dossiers: 'Dossiers, y compris la corbeille',
  fichiers: "Fichiers d'impression (les fichiers sont déplacés, pas supprimés)",
  paiements: 'Paiements',
  devis: 'Devis',
  factures: 'Factures',
  notifications: 'Notifications',
  dossier_events: 'Historique des dossiers',
  clients: 'Clients',
  compteurs: 'Compteurs CMD, DEV et FAC (remis à zéro)',
  users: 'Comptes utilisateurs (les autres sessions sont fermées)',
  tarifs: 'Grille tarifaire',
  parametres: 'Paramètres',
  journal: "Journal d'audit",
  sauvegardes: 'Historique des sauvegardes',
};

const ident = (t: string) => `"${t.replace(/"/g, '""')}"`;

async function tablesAEffacer(db?: Db): Promise<string[]> {
  const tables = new Set(A_EFFACER);
  for (;;) {
    const r = await query<{ t: string }>(
      `SELECT DISTINCT c.conrelid::regclass::text AS t FROM pg_constraint c WHERE c.contype = 'f' AND c.confrelid = ANY($1::regclass[])`,
      [[...tables]],
      db,
    );
    const nouvelles = r.map((x) => x.t.replace(/^public\./, '').replace(/"/g, '')).filter((t) => !tables.has(t));
    if (!nouvelles.length) break;
    for (const t of nouvelles) tables.add(t);
  }
  const protegees = [...tables].filter((t) => CONSERVEES.includes(t));
  if (protegees.length) {
    throw new HttpError(500, `Réinitialisation impossible : la table ${protegees.join(', ')} dépend des données à effacer. Rien n'a été effacé.`);
  }
  return [...tables];
}

async function compter(tables: string[], db?: Db) {
  const out: { table: string; libelle: string; nombre: number }[] = [];
  for (const t of tables) {
    const r = await one<{ n: number }>(`SELECT count(*)::int AS n FROM ${ident(t)}`, [], db);
    out.push({ table: t, libelle: LIBELLES[t] ?? t, nombre: r?.n ?? 0 });
  }
  return out;
}

/** Tentatives de l'heure écoulée pour cet administrateur, et minutes avant qu'une nouvelle soit possible. */
async function tentatives(userId: number) {
  const r = await query<{ created_at: Date }>(
    `SELECT created_at FROM journal WHERE user_id = $1 AND action = ANY($2) AND created_at > now() - interval '1 hour' ORDER BY created_at`,
    [userId, ACTIONS_TENTATIVE],
  );
  const restantes = Math.max(0, TENTATIVES_PAR_HEURE - r.length);
  const attente = restantes > 0 ? 0 : Math.max(1, Math.ceil((new Date(r[0]!.created_at).getTime() + 3_600_000 - Date.now()) / 60_000));
  return { restantes, attente };
}

export async function etatReinitialisation(config: Config, userId: number) {
  const efface = await tablesAEffacer();
  return {
    autorisee: config.allowSystemReset,
    variable: VARIABLE,
    phrase_attendue: PHRASE,
    ce_qui_est_efface: await compter([...efface, 'compteurs']),
    ce_qui_est_conserve: await compter(['users', 'tarifs', 'parametres', 'journal', 'sauvegardes']),
    tentatives_restantes: (await tentatives(userId)).restantes,
  };
}

export async function verifierTentatives(userId: number) {
  const { restantes, attente } = await tentatives(userId);
  if (!restantes) {
    throw new HttpError(429, `Trois tentatives de réinitialisation dans l'heure : réessayez dans ${attente} minute${attente > 1 ? 's' : ''}.`);
  }
}

/** Horodatage utilisable dans un nom de fichier (heure UTC). */
const horodatage = (d = new Date()) => d.toISOString().slice(0, 19).replace(/:/g, '-');

/** Sauvegarde complète de la base (pg_dump compressé). Lève une erreur si elle échoue ou si elle est vide. */
export async function sauvegarder(config: Config, quand: string): Promise<{ fichier: string; chemin: string; taille: number }> {
  const dir = path.join(config.storageDir, 'sauvegardes');
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  const fichier = path.join('sauvegardes', `avant-reinitialisation-${quand}.sql.gz`);
  const chemin = path.join(config.storageDir, fichier);
  const partiel = `${chemin}.partiel`;

  // Le mot de passe passe par l'environnement : il n'apparaît ni dans la liste des processus ni dans les messages.
  const url = new URL(config.databaseUrl);
  const motDePasse = decodeURIComponent(url.password);
  url.password = '';
  const pgDump = spawn('pg_dump', ['--no-owner', '--no-privileges', `--dbname=${url.toString()}`], {
    env: { ...process.env, ...(motDePasse ? { PGPASSWORD: motDePasse } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let erreur = '';
  pgDump.stderr.on('data', (c: Buffer) => {
    if (erreur.length < 1000) erreur += c.toString();
  });
  const fin = new Promise<number | null>((resolve, reject) => {
    pgDump.on('error', reject);
    pgDump.on('close', resolve);
  });
  const delai = setTimeout(() => pgDump.kill('SIGTERM'), 30 * 60_000);
  let octets = 0;
  const compteur = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      octets += chunk.length;
      cb(null, chunk);
    },
  });
  try {
    const [, code] = await Promise.all([
      pipeline(pgDump.stdout, compteur, zlib.createGzip(), fs.createWriteStream(partiel, { mode: 0o600 })),
      fin,
    ]);
    if (code !== 0) throw new Error(erreur.trim().split('\n')[0] || `pg_dump s'est arrêté avec le code ${code}`);
    if (octets === 0) throw new Error('pg_dump n’a rien produit');
    await fs.promises.rename(partiel, chemin);
  } catch (e) {
    await fs.promises.rm(partiel, { force: true });
    const raison = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'pg_dump est introuvable sur le serveur (paquet postgresql-client)' : (e as Error).message;
    throw new HttpError(500, `La sauvegarde préalable a échoué : rien n'a été effacé. Cause : ${raison}.`, { etape: 'sauvegarde', raison }, 'sauvegarde_echouee');
  } finally {
    clearTimeout(delai);
  }
  return { fichier, chemin, taille: (await fs.promises.stat(chemin)).size };
}

/** Effectue la réinitialisation, sauvegarde faite. Les fichiers sont remis en place si la transaction échoue. */
export async function reinitialiser(req: Request, config: Config) {
  const userId = req.user!.id;
  const quand = horodatage();
  const sauvegarde = await sauvegarder(config, quand);
  const racine = path.resolve(config.storageDir);
  const dossierDeplacement = `reinitialisation-${quand}`;
  const deplaces: { de: string; vers: string }[] = [];
  try {
    return await tx(async (db: PoolClient) => {
      const tables = await tablesAEffacer(db);
      const efface = Object.fromEntries((await compter([...tables, 'compteurs'], db)).map((c) => [c.table, c.nombre]));
      const fichiers = await query<{ chemin: string }>(`SELECT chemin FROM fichiers`, [], db);
      await db.query(`TRUNCATE ${tables.map(ident).join(', ')} RESTART IDENTITY`);
      await db.query(`DELETE FROM compteurs`);
      const sessions = await db.query(`UPDATE users SET token_version = token_version + 1 WHERE id <> $1`, [userId]);

      let absents = 0;
      for (const f of fichiers) {
        const de = path.resolve(racine, f.chemin);
        if (!de.startsWith(racine + path.sep)) {
          absents++;
          continue;
        }
        const vers = path.join(racine, dossierDeplacement, path.relative(racine, de));
        try {
          await fs.promises.mkdir(path.dirname(vers), { recursive: true });
          await fs.promises.rename(de, vers);
          deplaces.push({ de, vers });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
          absents++;
        }
      }

      const bilan = {
        sauvegarde: { fichier: sauvegarde.fichier, chemin: sauvegarde.chemin, taille: sauvegarde.taille },
        efface,
        fichiers: { deplaces: deplaces.length, absents, dossier: dossierDeplacement },
        sessions_fermees: sessions.rowCount ?? 0,
      };
      await journal(req, 'plateforme_reinitialisee', 'systeme', null, bilan, db);
      return bilan;
    });
  } catch (e) {
    for (const d of deplaces.reverse()) await fs.promises.rename(d.vers, d.de).catch(() => {});
    if (e instanceof HttpError) throw e;
    throw new HttpError(500, `La réinitialisation a échoué et a été annulée : aucune donnée n'a été effacée. Cause : ${(e as Error).message}`, {
      etape: 'effacement',
      sauvegarde: sauvegarde.fichier,
    });
  }
}
