import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@evocom/shared';
import type { Config } from '../config';
import { one } from '../db/pool';
import { forbidden, unauthorized } from './errors';
import { getParametres } from './params';
import type { AuthUser } from '../types';

export const COOKIE_NAME = 'evocom_session';

interface TokenPayload {
  sub: number;
  tv: number;
}

let cfg: Config;
export function initAuth(config: Config) {
  cfg = config;
}

export function signSession(user: { id: number; token_version: number }, heures = cfg.sessionHours): string {
  return jwt.sign({ sub: user.id, tv: user.token_version } satisfies TokenPayload, cfg.jwtSecret, {
    expiresIn: `${heures}h`,
    algorithm: 'HS256',
  });
}

export function setSessionCookie(res: Response, token: string, heures = cfg.sessionHours) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: 'lax',
    maxAge: heures * 3600 * 1000,
    path: '/',
  });
}

/** Ouvre une session (jeton et cookie) pour la durée fixée dans Paramètres > Sécurité. */
export async function ouvrirSession(res: Response, user: { id: number; token_version: number }) {
  const { session_heures } = (await getParametres()).securite;
  setSessionCookie(res, signSession(user, session_heures), session_heures);
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: cfg.cookieSecure, sameSite: 'lax', path: '/' });
}

/** Vérifie un jeton de session et recharge l'utilisateur en base (actif, version de jeton). */
export async function userFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, cfg.jwtSecret, { algorithms: ['HS256'] }) as unknown as TokenPayload;
  } catch {
    return null;
  }
  const u = await one<AuthUser & { is_active: boolean; token_version: number }>(
    `SELECT id, nom, email, role, telephone, doit_changer_mdp, is_active, token_version FROM users WHERE id = $1`,
    [payload.sub],
  );
  if (!u || !u.is_active || u.token_version !== payload.tv) return null;
  return { id: u.id, nom: u.nom, email: u.email, role: u.role, telephone: u.telephone, doit_changer_mdp: u.doit_changer_mdp };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden("Votre rôle ne donne pas accès à cette fonction."));
    next();
  };
}

/** Utilisateur courant (après requireAuth). */
export function me(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
