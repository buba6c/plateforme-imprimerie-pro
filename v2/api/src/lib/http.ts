import type { Request } from 'express';
import { badRequest } from './errors';

export function intParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identifiant invalide.');
  return n;
}

export function qStr(req: Request, name: string): string | undefined {
  const v = req.query[name];
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return undefined;
}

export function qInt(req: Request, name: string): number | undefined {
  const v = qStr(req, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function qBool(req: Request, name: string): boolean | undefined {
  const v = qStr(req, name);
  if (v === undefined) return undefined;
  return v === '1' || v === 'true' || v === 'oui';
}

export function qList(req: Request, name: string): string[] | undefined {
  const v = qStr(req, name);
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
}
