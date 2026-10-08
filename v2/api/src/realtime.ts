// Temps réel : Socket.IO authentifié par le cookie de session.
// Les salles sont calculées par le serveur ; le client ne choisit rien.
// Les événements ne transportent que des identifiants : l'interface recharge
// ensuite les données par l'API, qui applique les droits. Aucune donnée client
// (téléphone, montant) ne circule sur ce canal.
//
// Sessions : un socket ouvert reste lié à la session qui l'a ouvert. Un compte désactivé,
// un rôle changé, un mot de passe réinitialisé ou une session expirée ferment ses sockets :
// tout de suite avec `deconnecterUtilisateur(id)`, sinon au plus tard à la vérification
// périodique (`verifierSockets`, toutes les 60 s).
//
// Notifications : écrites dans la même transaction que le changement qui les provoque et
// poussées seulement après le COMMIT (`apresCommit`) ; rien ne part si la transaction est annulée.

import type http from 'node:http';
import jwt from 'jsonwebtoken';
import type pg from 'pg';
import { Server } from 'socket.io';
import { machineOfRole, STATUTS_LIVREUR, type Machine, type Role, type Statut } from '@evocom/shared';
import { COOKIE_NAME, userFromToken } from './lib/auth';
import { query, type Db } from './db/pool';
import { getParametres } from './lib/params';

let io: Server | null = null;
let minuterieVerification: NodeJS.Timeout | null = null;

/** Intervalle de la vérification des sessions ouvertes en temps réel. */
export const VERIFICATION_SOCKETS_MS = 60_000;

interface DonneesSocket {
  user: { id: number; role: Role };
  /** Version du jeton (token_version) au moment de la connexion. */
  tv: number | null;
  /** Expiration du jeton, en secondes depuis 1970. */
  exp: number | null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie mal encodé : ignoré */
    }
  }
  return out;
}

export function initRealtime(server: http.Server, opts: { corsOrigin?: string; verificationMs?: number } = {}) {
  io = new Server(server, {
    path: '/socket.io',
    serveClient: false,
    cors: opts.corsOrigin ? { origin: opts.corsOrigin, credentials: true } : undefined,
  });
  io.use(async (socket, next) => {
    const token = parseCookies(socket.handshake.headers.cookie)[COOKIE_NAME];
    const user = await userFromToken(token).catch(() => null);
    if (!user) return next(new Error('non_connecte'));
    // Le jeton vient d'être vérifié par userFromToken : on n'en relit que la version et l'expiration.
    const payload = jwt.decode(token ?? '') as { tv?: unknown; exp?: unknown } | null;
    const data: DonneesSocket = {
      user: { id: user.id, role: user.role },
      tv: typeof payload?.tv === 'number' ? payload.tv : null,
      exp: typeof payload?.exp === 'number' ? payload.exp : null,
    };
    Object.assign(socket.data, data);
    next();
  });
  io.on('connection', (socket) => {
    const { user } = socket.data as DonneesSocket;
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    const m = machineOfRole(user.role);
    if (m) socket.join(`machine:${m}`);
  });
  const ms = opts.verificationMs ?? VERIFICATION_SOCKETS_MS;
  if (ms > 0) {
    minuterieVerification = setInterval(() => void verifierSockets().catch(() => {}), ms);
    minuterieVerification.unref();
  }
  return io;
}

export function closeRealtime() {
  if (minuterieVerification) clearInterval(minuterieVerification);
  minuterieVerification = null;
  io?.close();
  io = null;
}

/**
 * Ferme tout de suite les connexions temps réel d'un utilisateur.
 * À appeler après la désactivation d'un compte, un changement de rôle ou une réinitialisation
 * du mot de passe (la session HTTP est déjà invalidée par token_version). Si le compte est
 * encore valide, l'interface se reconnecte d'elle-même et rejoint les salles de son rôle actuel.
 */
export function deconnecterUtilisateur(userId: number): void {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

/**
 * Relit en base l'état des comptes connectés et ferme les sockets dont la session n'est plus
 * valable : compte désactivé ou supprimé, rôle changé, token_version incrémentée, jeton expiré.
 * Renvoie le nombre de sockets fermés.
 */
export async function verifierSockets(): Promise<number> {
  if (!io) return 0;
  const sockets = await io.fetchSockets();
  if (!sockets.length) return 0;
  const ids = [...new Set(sockets.map((s) => (s.data as DonneesSocket).user.id))];
  const rows = await query<{ id: number; role: Role; is_active: boolean; token_version: number }>(
    `SELECT id, role, is_active, token_version FROM users WHERE id = ANY($1::int[])`,
    [ids],
  );
  const comptes = new Map(rows.map((r) => [r.id, r]));
  const maintenant = Date.now() / 1000;
  let fermes = 0;
  for (const s of sockets) {
    const d = s.data as DonneesSocket;
    const u = comptes.get(d.user.id);
    const valide =
      !!u && u.is_active && u.role === d.user.role && (d.tv === null || d.tv === u.token_version) && (d.exp === null || d.exp > maintenant);
    if (!valide) {
      s.disconnect(true);
      fermes++;
    }
  }
  return fermes;
}

export interface DossierSignal {
  id: number;
  numero: string;
  statut: Statut;
  machine: Machine;
  preparateur_id: number | null;
  ancien_statut?: Statut | null;
  /** Date de première validation ; absente quand l'appelant ne l'a pas lue. */
  date_validation?: string | Date | null;
}

/**
 * L'imprimeur voit un dossier de sa machine dès qu'il a été validé une fois (même règle que
 * `visibilite()` dans dossiers/access.ts). Un dossier jamais validé ne part pas à la salle machine.
 */
export function visiblePourMachine(d: Pick<DossierSignal, 'statut' | 'ancien_statut' | 'date_validation'>): boolean {
  if (d.date_validation) return true;
  if (d.statut !== 'en_cours') return true;
  return !!d.ancien_statut && d.ancien_statut !== 'en_cours';
}

/** Salles prévenues d'un changement de dossier (exportée pour les tests). */
export function sallesDossier(d: DossierSignal): string[] {
  const rooms = new Set<string>(['role:admin', 'role:preparateur']);
  if (visiblePourMachine(d)) rooms.add(`machine:${d.machine}`);
  const livreur = (s: Statut | null | undefined) => !!s && (STATUTS_LIVREUR as readonly string[]).includes(s);
  if (livreur(d.statut) || livreur(d.ancien_statut)) rooms.add('role:livreur');
  if (d.preparateur_id) rooms.add(`user:${d.preparateur_id}`);
  return [...rooms];
}

/** Prévient les personnes concernées qu'un dossier a changé. */
export function signalDossier(d: DossierSignal, type: 'created' | 'updated' | 'deleted' = 'updated') {
  if (!io) return;
  const payload = { type, id: d.id, numero: d.numero, statut: d.statut, machine: d.machine };
  io.to(sallesDossier(d)).emit('dossier', payload);
}

export function signalPaiement(dossierId: number) {
  io?.to(['role:admin', 'role:preparateur', 'role:livreur']).emit('paiement', { dossier_id: dossierId });
}

// ---------------------------------------------------------------------------
// Après le COMMIT

const enAttente = new WeakMap<pg.PoolClient, (() => void)[]>();

function estClientTransaction(db: Db): db is pg.PoolClient {
  return typeof (db as Partial<pg.PoolClient>).release === 'function';
}

/**
 * Exécute `fn` une fois les écritures de `db` validées.
 * - `db` est le pool (validation automatique) : tout de suite.
 * - `db` est le client d'une transaction (`tx`) : après le COMMIT ; jamais si la transaction est
 *   annulée (ROLLBACK). Si le client est rendu au pool sans COMMIT ni ROLLBACK (requêtes en
 *   validation automatique), au moment où il est rendu.
 * Les erreurs de `fn` sont ignorées : un envoi temps réel ne doit jamais faire échouer une écriture.
 */
export function apresCommit(db: Db, fn: () => void): void {
  const executer = (f: () => void) => {
    try {
      f();
    } catch {
      /* envoi temps réel : jamais bloquant */
    }
  };
  if (!estClientTransaction(db)) {
    executer(fn);
    return;
  }
  const file = enAttente.get(db);
  if (file) {
    file.push(fn);
    return;
  }
  const liste = [fn];
  enAttente.set(db, liste);
  const client = db as unknown as { query: (...a: unknown[]) => unknown; release: (...a: unknown[]) => unknown };
  const queryPropre = Object.hasOwn(client, 'query');
  const releasePropre = Object.hasOwn(client, 'release');
  const queryOrigine = client.query;
  const releaseOrigine = client.release;
  const terminer = (envoyer: boolean) => {
    if (enAttente.get(db) !== liste) return;
    enAttente.delete(db);
    if (queryPropre) client.query = queryOrigine;
    else delete (client as { query?: unknown }).query;
    if (releasePropre) client.release = releaseOrigine;
    else delete (client as { release?: unknown }).release;
    if (envoyer) liste.forEach(executer);
  };
  client.query = function (this: unknown, ...args: unknown[]) {
    const texte = typeof args[0] === 'string' ? args[0].trim().replace(/;$/, '').toUpperCase() : '';
    const r = queryOrigine.apply(this, args);
    if (texte === 'COMMIT' || texte === 'END') {
      Promise.resolve(r).then(
        () => terminer(true),
        () => terminer(false),
      );
    } else if (texte === 'ROLLBACK' || texte === 'ABORT') {
      terminer(false);
    }
    return r;
  };
  client.release = function (this: unknown, ...args: unknown[]) {
    terminer(true);
    return releaseOrigine.apply(this, args);
  };
}

// ---------------------------------------------------------------------------
// Notifications

export interface NotificationInput {
  type: string;
  titre: string;
  message?: string | null;
  dossier_id?: number | null;
}

export interface Destinataires {
  userIds?: number[];
  roles?: Role[];
  machine?: Machine;
  /** Jamais cette personne (en général l'auteur de l'action). */
  exclure?: number;
}

/**
 * Enregistre une notification pour chaque destinataire actif et la pousse en temps réel après
 * le COMMIT (sauf type désactivé dans les paramètres). Renvoie les utilisateurs notifiés.
 */
export async function notifier(db: Db, destinataires: Destinataires, n: NotificationInput): Promise<number[]> {
  const reglages = (await getParametres(db)).notifications as Record<string, boolean>;
  if (reglages[n.type] === false) return [];
  const conditions: string[] = [];
  const params: unknown[] = [];
  const userIds = (destinataires.userIds ?? []).filter((id): id is number => Number.isInteger(id));
  if (userIds.length) {
    params.push(userIds);
    conditions.push(`id = ANY($${params.length}::int[])`);
  }
  if (destinataires.roles?.length) {
    params.push(destinataires.roles);
    conditions.push(`role = ANY($${params.length})`);
  }
  if (destinataires.machine) {
    params.push(`imprimeur_${destinataires.machine}`);
    conditions.push(`role = $${params.length}`);
  }
  if (!conditions.length) return [];
  let sql = `SELECT id FROM users WHERE is_active AND (${conditions.join(' OR ')})`;
  if (destinataires.exclure) {
    params.push(destinataires.exclure);
    sql += ` AND id <> $${params.length}`;
  }
  const users = await query<{ id: number }>(sql, params, db);
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const rows = await query<{ id: number; user_id: number; created_at: string }>(
    `INSERT INTO notifications (user_id, type, titre, message, dossier_id)
     SELECT unnest($1::int[]), $2, $3, $4, $5 RETURNING id, user_id, created_at`,
    [ids, n.type, n.titre, n.message ?? null, n.dossier_id ?? null],
    db,
  );
  apresCommit(db, () => {
    if (!io) return;
    for (const r of rows) {
      io.to(`user:${r.user_id}`).emit('notification', {
        id: r.id,
        type: n.type,
        titre: n.titre,
        message: n.message ?? null,
        dossier_id: n.dossier_id ?? null,
        created_at: r.created_at,
      });
    }
  });
  return ids;
}
