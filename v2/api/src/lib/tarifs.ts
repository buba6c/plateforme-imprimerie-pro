import type { Tarif } from '@evocom/shared';
import { query, type Db } from '../db/pool';

let cache: { at: number; value: Tarif[] } | null = null;

export async function getTarifs(db?: Db): Promise<Tarif[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const rows = await query<Tarif>(
    `SELECT code, machine, categorie, libelle, unite, prix, actif FROM tarifs ORDER BY machine, categorie, ordre, libelle`,
    [],
    db,
  );
  cache = { at: Date.now(), value: rows };
  return rows;
}

export function invalidateTarifs() {
  cache = null;
}
