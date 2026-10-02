// Temps réel : Socket.IO authentifié par le cookie de session.
// Les salles sont calculées par le serveur ; le client ne choisit rien.
// Les événements ne transportent que des identifiants : l'interface recharge
// ensuite les données par l'API, qui applique les droits. Aucune donnée client
// (téléphone, montant) ne circule sur ce canal.

import type http from 'node:http';
import { Server } from 'socket.io';
import { machineOfRole, STATUTS_LIVREUR, type Machine, type Role, type Statut } from '@evocom/shared';
import { COOKIE_NAME, userFromToken } from './lib/auth';
import { query, type Db } from './db/pool';

let io: Server | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function initRealtime(server: http.Server, opts: { corsOrigin?: string } = {}) {
  io = new Server(server, {
    path: '/socket.io',
    serveClient: false,
    cors: opts.corsOrigin ? { origin: opts.corsOrigin, credentials: true } : undefined,
  });
  io.use(async (socket, next) => {
    const token = parseCookies(socket.handshake.headers.cookie)[COOKIE_NAME];
    const user = await userFromToken(token).catch(() => null);
    if (!user) return next(new Error('non_connecte'));
    socket.data.user = user;
    next();
  });
  io.on('connection', (socket) => {
    const user = socket.data.user as { id: number; role: Role };
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    const m = machineOfRole(user.role);
    if (m) socket.join(`machine:${m}`);
  });
  return io;
}

export function closeRealtime() {
  io?.close();
  io = null;
}

export interface DossierSignal {
  id: number;
  numero: string;
  statut: Statut;
  machine: Machine;
  preparateur_id: number | null;
  ancien_statut?: Statut | null;
}

/** Prévient les personnes concernées qu'un dossier a changé. */
export function signalDossier(d: DossierSignal, type: 'created' | 'updated' | 'deleted' = 'updated') {
  if (!io) return;
  const payload = { type, id: d.id, numero: d.numero, statut: d.statut, machine: d.machine };
  const rooms = new Set<string>(['role:admin', 'role:preparateur']);
  rooms.add(`machine:${d.machine}`);
  const livreur = (s: Statut | null | undefined) => !!s && (STATUTS_LIVREUR as readonly string[]).includes(s);
  if (livreur(d.statut) || livreur(d.ancien_statut)) rooms.add('role:livreur');
  if (d.preparateur_id) rooms.add(`user:${d.preparateur_id}`);
  io.to([...rooms]).emit('dossier', payload);
}

export function signalPaiement(dossierId: number) {
  io?.to(['role:admin', 'role:preparateur', 'role:livreur']).emit('paiement', { dossier_id: dossierId });
}

export interface NotificationInput {
  type: string;
  titre: string;
  message?: string | null;
  dossier_id?: number | null;
}

/** Enregistre une notification pour chaque destinataire et la pousse en temps réel. */
export async function notifier(
  db: Db,
  destinataires: { userIds?: number[]; roles?: Role[]; machine?: Machine; exclure?: number },
  n: NotificationInput,
): Promise<void> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (destinataires.userIds?.length) {
    params.push(destinataires.userIds);
    conditions.push(`id = ANY($${params.length})`);
  }
  if (destinataires.roles?.length) {
    params.push(destinataires.roles);
    conditions.push(`role = ANY($${params.length})`);
  }
  if (destinataires.machine) {
    params.push(`imprimeur_${destinataires.machine}`);
    conditions.push(`role = $${params.length}`);
  }
  if (!conditions.length) return;
  let sql = `SELECT id FROM users WHERE is_active AND (${conditions.join(' OR ')})`;
  if (destinataires.exclure) {
    params.push(destinataires.exclure);
    sql += ` AND id <> $${params.length}`;
  }
  const users = await query<{ id: number }>(sql, params, db);
  if (!users.length) return;
  const ids = users.map((u) => u.id);
  const rows = await query<{ id: number; user_id: number; created_at: string }>(
    `INSERT INTO notifications (user_id, type, titre, message, dossier_id)
     SELECT unnest($1::int[]), $2, $3, $4, $5 RETURNING id, user_id, created_at`,
    [ids, n.type, n.titre, n.message ?? null, n.dossier_id ?? null],
    db,
  );
  if (!io) return;
  for (const r of rows) {
    io.to(`user:${r.user_id}`).emit('notification', { id: r.id, type: n.type, titre: n.titre, message: n.message ?? null, dossier_id: n.dossier_id ?? null, created_at: r.created_at });
  }
}
