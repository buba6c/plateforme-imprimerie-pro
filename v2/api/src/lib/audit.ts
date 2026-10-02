import type { Request } from 'express';
import { query, type Db } from '../db/pool';

/** Trace une action sensible dans le journal d'audit. */
export async function journal(
  req: Request | null,
  action: string,
  cible: string | null,
  cibleId: string | number | null,
  data?: unknown,
  db?: Db,
): Promise<void> {
  await query(
    `INSERT INTO journal (user_id, action, cible, cible_id, data, ip) VALUES ($1, $2, $3, $4, $5, $6)`,
    [req?.user?.id ?? null, action, cible, cibleId === null ? null : String(cibleId), data === undefined ? null : JSON.stringify(data), req?.ip ?? null],
    db,
  );
}
