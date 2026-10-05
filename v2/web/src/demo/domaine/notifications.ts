// Notifications et journal d'audit de la démonstration (realtime.notifier et lib/audit côté serveur).

import type { Machine, Role } from '@evocom/shared';
import { E, maintenant, prochainId, type UserDemo } from '../etat';
import { signalNotification } from '../temps-reel';

export function notifier(
  dest: { userIds?: number[]; roles?: Role[]; machine?: Machine; exclure?: number },
  n: { type: string; titre: string; message?: string | null; dossier_id?: number | null },
) {
  const e = E();
  if ((e.parametres.notifications ?? {})[n.type] === false) return;
  const users = e.users.filter(
    (u) =>
      u.is_active &&
      u.id !== dest.exclure &&
      ((dest.userIds ?? []).includes(u.id) || (dest.roles ?? []).includes(u.role) || (!!dest.machine && u.role === `imprimeur_${dest.machine}`)),
  );
  for (const u of users) {
    const notif = {
      id: prochainId('notification'),
      user_id: u.id,
      type: n.type,
      titre: n.titre,
      message: n.message ?? null,
      dossier_id: n.dossier_id ?? null,
      lu_at: null,
      created_at: maintenant(),
    };
    e.notifications.push(notif);
    signalNotification(u.id, notif);
  }
}

export function lister(user: UserDemo, nonLuesSeulement: boolean) {
  const miennes = E().notifications.filter((n) => n.user_id === user.id);
  const items = miennes
    .filter((n) => !nonLuesSeulement || !n.lu_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .slice(0, 50)
    .map(({ user_id: _u, ...n }) => n);
  return { items, non_lues: miennes.filter((n) => !n.lu_at).length };
}

export function marquerLues(user: UserDemo, ids: number[] | undefined) {
  const now = maintenant();
  for (const n of E().notifications) {
    if (n.user_id !== user.id || n.lu_at) continue;
    if (ids === undefined || ids.includes(n.id)) n.lu_at = now;
  }
}

export function journal(user: UserDemo | null, action: string, cible: string, cibleId: number | string | null, data?: unknown) {
  E().journal.unshift({
    id: prochainId('journal'),
    user_id: user?.id ?? null,
    action,
    cible,
    cible_id: cibleId === null ? null : String(cibleId),
    data: data ?? null,
    created_at: maintenant(),
  });
}
