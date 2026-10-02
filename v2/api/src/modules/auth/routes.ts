import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { loginSchema, passwordChangeSchema } from '@evocom/shared';
import { one, query } from '../../db/pool';
import { clearSessionCookie, me, requireAuth, setSessionCookie, signSession } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { HttpError, unauthorized } from '../../lib/errors';

export const authRouter = Router();

const MAX_ECHECS = 5;
const BLOCAGE_MIN = 15;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion depuis ce poste. Réessayez dans quelques minutes.' },
});

// Hachage factice pour garder un temps de réponse constant quand l'e-mail est inconnu.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice', 10);

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const u = await one<{
    id: number;
    password_hash: string;
    is_active: boolean;
    token_version: number;
    echecs_connexion: number;
    bloque_jusqu_a: string | null;
  }>(`SELECT id, password_hash, is_active, token_version, echecs_connexion, bloque_jusqu_a FROM users WHERE lower(email) = $1`, [email]);
  if (u?.bloque_jusqu_a && new Date(u.bloque_jusqu_a) > new Date()) {
    throw new HttpError(429, `Compte bloqué après ${MAX_ECHECS} essais. Réessayez dans ${BLOCAGE_MIN} minutes ou demandez à un administrateur.`);
  }
  const ok = await bcrypt.compare(password, u?.password_hash ?? HASH_FACTICE);
  if (!u || !ok || !u.is_active) {
    if (u) {
      const echecs = u.echecs_connexion + 1;
      await query(
        `UPDATE users SET echecs_connexion = $2::int, bloque_jusqu_a = CASE WHEN $2::int >= $3::int THEN now() + make_interval(mins => $4::int) ELSE NULL END WHERE id = $1`,
        [u.id, echecs, MAX_ECHECS, BLOCAGE_MIN],
      );
    }
    throw unauthorized(u && ok && !u.is_active ? 'Ce compte est désactivé.' : 'E-mail ou mot de passe incorrect.');
  }
  await query(`UPDATE users SET echecs_connexion = 0, bloque_jusqu_a = NULL, last_login_at = now() WHERE id = $1`, [u.id]);
  setSessionCookie(res, signSession(u));
  const user = await one(`SELECT id, nom, email, role, telephone, doit_changer_mdp FROM users WHERE id = $1`, [u.id]);
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: me(req) });
});

authRouter.post('/mot-de-passe', requireAuth, async (req, res) => {
  const { actuel, nouveau } = passwordChangeSchema.parse(req.body);
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [me(req).id]);
  if (!u || !(await bcrypt.compare(actuel, u.password_hash))) throw new HttpError(400, 'Le mot de passe actuel est incorrect.');
  const hash = await bcrypt.hash(nouveau, 12);
  const r = await one<{ id: number; token_version: number }>(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1, doit_changer_mdp = false WHERE id = $1 RETURNING id, token_version`,
    [me(req).id, hash],
  );
  await journal(req, 'mot_de_passe_change', 'user', me(req).id);
  setSessionCookie(res, signSession(r!));
  res.status(204).end();
});
