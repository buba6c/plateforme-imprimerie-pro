import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

function migrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  // En développement : src/db/migrations ; une fois compilé : dist/migrations.
  const candidates = [path.join(here, 'migrations'), path.join(here, 'db', 'migrations')];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`Dossier des migrations introuvable (${candidates.join(', ')})`);
  return found;
}

export function listMigrations(): string[] {
  return fs
    .readdirSync(migrationsDir())
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
}

export async function migrate(pool: pg.Pool, log: (m: string) => void = console.log): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (nom text PRIMARY KEY, appliquee_le timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await pool.query<{ nom: string }>('SELECT nom FROM schema_migrations')).rows.map((r) => r.nom));
  const applied: string[] = [];
  for (const file of listMigrations()) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir(), file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`Migration appliquée : ${file}`);
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Échec de la migration ${file} : ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

export async function pendingMigrations(pool: pg.Pool): Promise<string[]> {
  const exists = await pool.query(`SELECT to_regclass('public.schema_migrations') AS t`);
  if (!exists.rows[0]?.t) return listMigrations();
  const done = new Set((await pool.query<{ nom: string }>('SELECT nom FROM schema_migrations')).rows.map((r) => r.nom));
  return listMigrations().filter((f) => !done.has(f));
}
