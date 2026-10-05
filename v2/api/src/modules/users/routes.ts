import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { userCreateSchema, userUpdateSchema } from '@evocom/shared';
import { one, query } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam } from '../../lib/http';
import { getParametres } from '../../lib/params';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const COLS = `id, nom, email, telephone, role, is_active, doit_changer_mdp, last_login_at, created_at`;

/** Liste réduite (nom, rôle) pour les menus d'affectation : admin et préparateurs. */
usersRouter.get('/annuaire', requireRole('admin', 'preparateur'), async (_req, res) => {
  res.json(await query(`SELECT id, nom, role FROM users WHERE is_active ORDER BY role, nom`));
});

usersRouter.get('/', requireRole('admin'), async (_req, res) => {
  res.json(
    await query(`SELECT ${COLS},
      (SELECT count(*)::int FROM dossiers d WHERE d.preparateur_id = users.id AND d.deleted_at IS NULL) AS nb_dossiers
      FROM users ORDER BY is_active DESC, role, nom`),
  );
});

usersRouter.post('/', requireRole('admin'), async (req, res) => {
  const input = userCreateSchema.parse(req.body);
  const min = (await getParametres()).securite.mdp_longueur_min;
  if (input.password.length < min) {
    throw badRequest(`Le mot de passe doit contenir au moins ${min} caractères.`, { champs: { password: `Au moins ${min} caractères` } });
  }
  const exists = await one(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [input.email]);
  if (exists) throw conflict('Un compte existe déjà avec cette adresse e-mail.');
  const hash = await bcrypt.hash(input.password, 12);
  const u = await one(
    `INSERT INTO users (nom, email, telephone, role, password_hash, doit_changer_mdp) VALUES ($1,$2,$3,$4,$5,true) RETURNING ${COLS}`,
    [input.nom, input.email, input.telephone ?? null, input.role, hash],
  );
  await journal(req, 'utilisateur_cree', 'user', u!.id, { email: input.email, role: input.role });
  res.status(201).json(u);
});

usersRouter.patch('/:id', requireRole('admin'), async (req, res) => {
  const id = intParam(req);
  const input = userUpdateSchema.parse(req.body);
  if (id === me(req).id && (input.is_active === false || (input.role && input.role !== 'admin'))) {
    throw badRequest('Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle administrateur.');
  }
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    args.push(v);
    sets.push(`${k} = $${args.length}`);
  }
  if (input.is_active === false || input.role) sets.push('token_version = token_version + 1');
  if (!sets.length) throw badRequest('Aucune modification.');
  args.push(id);
  const u = await one(`UPDATE users SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING ${COLS}`, args).catch((e) => {
    if (e.code === '23505') throw conflict('Un compte existe déjà avec cette adresse e-mail.');
    throw e;
  });
  if (!u) throw notFound('Utilisateur introuvable.');
  await journal(req, 'utilisateur_modifie', 'user', id, input);
  res.json(u);
});

/** Génère un mot de passe provisoire, affiché une seule fois à l'administrateur. */
usersRouter.post('/:id/reinitialiser-mot-de-passe', requireRole('admin'), async (req, res) => {
  const id = intParam(req);
  // 4 caractères pour 3 octets : au moins 12 caractères, et jamais moins que la longueur minimale réglée.
  const min = (await getParametres()).securite.mdp_longueur_min;
  const provisoire = crypto.randomBytes(Math.max(9, Math.ceil((min * 3) / 4))).toString('base64url');
  const hash = await bcrypt.hash(provisoire, 12);
  const u = await one(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1, doit_changer_mdp = true, echecs_connexion = 0, bloque_jusqu_a = NULL
     WHERE id = $1 RETURNING id, nom`,
    [id, hash],
  );
  if (!u) throw notFound('Utilisateur introuvable.');
  await journal(req, 'mot_de_passe_reinitialise', 'user', id);
  res.json({ mot_de_passe_provisoire: provisoire });
});
