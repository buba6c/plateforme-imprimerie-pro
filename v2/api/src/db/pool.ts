import pg from 'pg';

// bigint (taille de fichier, identifiants bigserial) et numeric en nombres JS.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
// Les colonnes date restent des chaînes AAAA-MM-JJ (pas de décalage de fuseau).
pg.types.setTypeParser(1082, (v) => v);

export type Db = pg.Pool | pg.PoolClient;

let pool: pg.Pool | null = null;

export function initPool(connectionString: string): pg.Pool {
  pool = new pg.Pool({ connectionString, max: 15, idleTimeoutMillis: 30_000 });
  pool.on('error', (err) => console.error('Erreur du pool PostgreSQL', err));
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Pool PostgreSQL non initialisé');
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = getPool()): Promise<T[]> {
  const r = await db.query<T>(text, params as any[]);
  return r.rows;
}

export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = getPool()): Promise<T | null> {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

/** Exécute fn dans une transaction ; annule tout en cas d'erreur. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
