// Outils communs aux modules complémentaires : filtres SQL paramétrés, pagination,
// dates de période (AAAA-MM-JJ) interprétées dans le fuseau de l'entreprise.

import type { Request } from 'express';
import { badRequest } from '../../lib/errors';
import { qInt, qStr } from '../../lib/http';

/** Conditions WHERE construites avec des paramètres positionnels ($1, $2…). */
export class Conditions {
  readonly parts: string[] = [];
  readonly args: unknown[] = [];

  /** Ajoute une valeur et renvoie son marqueur ($n). */
  param(v: unknown): string {
    this.args.push(v);
    return `$${this.args.length}`;
  }

  /** Ajoute une condition ; chaque `?` est remplacé par la valeur suivante. */
  add(fragment: string, ...values: unknown[]): this {
    let i = 0;
    this.parts.push(fragment.replace(/\?/g, () => this.param(values[i++])));
    return this;
  }

  get where(): string {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function pagination(req: Request, defaut = 50, max = 200): Pagination {
  const limit = Math.min(Math.max(qInt(req, 'limit') ?? defaut, 1), max);
  const page = Math.max(qInt(req, 'page') ?? 1, 1);
  return { page, limit, offset: (page - 1) * limit };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function estDateValide(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Paramètre de date AAAA-MM-JJ facultatif ; 400 s'il est mal formé. */
export function qDate(req: Request, name: string): string | undefined {
  const v = qStr(req, name);
  if (v === undefined) return undefined;
  if (!estDateValide(v)) {
    throw badRequest(`La date « ${name} » est invalide : utilisez le format AAAA-MM-JJ (par exemple 2026-10-02).`);
  }
  return v;
}

/** Bornes from/to facultatives, vérifiées dans l'ordre. */
export function intervalle(req: Request): { from?: string; to?: string } {
  const from = qDate(req, 'from');
  const to = qDate(req, 'to');
  if (from && to && from > to) {
    throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  }
  return { from, to };
}

/** Date du jour (AAAA-MM-JJ) dans un fuseau IANA. */
export function aujourdhui(fuseau: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Décale une date AAAA-MM-JJ d'un nombre de jours. */
export function ajouterJours(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/**
 * Ajoute à `c` la condition « colonne dans [from, to] » où from et to sont des jours
 * du calendrier de l'entreprise (to inclus).
 */
export function filtrePeriode(c: Conditions, colonne: string, fuseau: string, from?: string, to?: string) {
  if (from) c.add(`${colonne} >= (?::date::timestamp AT TIME ZONE ?)`, from, fuseau);
  if (to) c.add(`${colonne} < ((?::date + 1)::timestamp AT TIME ZONE ?)`, to, fuseau);
}

/** Échappe les caractères spéciaux de LIKE. */
export function motifLike(q: string): string {
  return `%${q.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
