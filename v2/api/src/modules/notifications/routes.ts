// Notifications de l'utilisateur connecté : chacun ne lit et ne marque que les siennes.

import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../../db/pool';
import { me, requireAuth } from '../../lib/auth';
import { qBool } from '../../lib/http';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const user = me(req);
  const nonLuesSeulement = qBool(req, 'non_lues') === true;
  const items = await query(
    `SELECT id, type, titre, message, dossier_id, lu_at, created_at
     FROM notifications
     WHERE user_id = $1 ${nonLuesSeulement ? 'AND lu_at IS NULL' : ''}
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [user.id],
  );
  const n = await one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND lu_at IS NULL`, [user.id]);
  res.json({ items, non_lues: n?.n ?? 0 });
});

const luesSchema = z.object({
  ids: z
    .array(z.number({ invalid_type_error: 'Identifiant de notification invalide' }).int().positive(), {
      invalid_type_error: 'La liste « ids » doit être un tableau de numéros de notification',
    })
    .max(500, 'Au plus 500 notifications à la fois')
    .optional(),
});

notificationsRouter.post('/lues', async (req, res) => {
  const user = me(req);
  const { ids } = luesSchema.parse(req.body ?? {});
  if (ids === undefined) {
    await query(`UPDATE notifications SET lu_at = now() WHERE user_id = $1 AND lu_at IS NULL`, [user.id]);
  } else if (ids.length) {
    // La condition sur user_id garantit qu'on ne touche jamais aux notifications d'un autre.
    await query(`UPDATE notifications SET lu_at = now() WHERE user_id = $1 AND id = ANY($2::bigint[]) AND lu_at IS NULL`, [user.id, ids]);
  }
  res.status(204).end();
});
