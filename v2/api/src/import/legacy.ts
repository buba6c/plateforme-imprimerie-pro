// Accès à l'ancienne base EvocomPrint, STRICTEMENT en lecture seule.
//
// Trois verrous indépendants empêchent toute écriture :
//   1. l'option de connexion `default_transaction_read_only=on` ;
//   2. une transaction unique `REPEATABLE READ READ ONLY` ouverte pour toute la durée de l'import
//      (instantané cohérent : toutes les tables sont lues au même instant) ;
//   3. une vérification `SHOW transaction_read_only` avant toute lecture.
// Les lignes sont lues sous forme `to_jsonb(t)` : une colonne absente donne simplement une clé absente,
// au lieu d'une erreur, ce qui absorbe les variantes de schéma modifiées à la main en production.

import pg from 'pg';

export type LigneLegacy = Record<string, unknown>;

export class SourceLegacy {
  private colonnes = new Map<string, Map<string, string>>();
  private curseur = 0;
  fuseau = 'UTC';
  base = '';

  private constructor(private client: pg.Client) {}

  static async ouvrir(url: string): Promise<SourceLegacy> {
    const client = new pg.Client({
      connectionString: url,
      application_name: 'evocom-import-legacy (lecture seule)',
      options: '-c default_transaction_read_only=on',
    });
    await client.connect();
    const src = new SourceLegacy(client);
    try {
      await client.query('SET default_transaction_read_only = on');
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const ro = await client.query<{ transaction_read_only: string }>('SHOW transaction_read_only');
      if (ro.rows[0]?.transaction_read_only !== 'on') {
        throw new Error("Impossible de garantir la lecture seule sur l'ancienne base : import annulé.");
      }
      const info = await client.query<{ tz: string; db: string }>(`SELECT current_setting('TimeZone') AS tz, current_database() AS db`);
      src.fuseau = info.rows[0]?.tz ?? 'UTC';
      src.base = info.rows[0]?.db ?? '';
      const cols = await client.query<{ table_name: string; column_name: string; data_type: string }>(
        `SELECT table_name, column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
      );
      for (const c of cols.rows) {
        if (!src.colonnes.has(c.table_name)) src.colonnes.set(c.table_name, new Map());
        src.colonnes.get(c.table_name)!.set(c.column_name, c.data_type);
      }
      // Les vues apparaissent aussi dans information_schema.columns : on ne garde que les tables.
      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      const vraies = new Set(tables.rows.map((t) => t.table_name));
      for (const t of [...src.colonnes.keys()]) if (!vraies.has(t)) src.colonnes.delete(t);
    } catch (err) {
      await client.end().catch(() => {});
      throw err;
    }
    return src;
  }

  tables(): string[] {
    return [...this.colonnes.keys()].sort();
  }

  a(table: string): boolean {
    return this.colonnes.has(table);
  }

  aColonne(table: string, colonne: string): boolean {
    return this.colonnes.get(table)?.has(colonne) ?? false;
  }

  typeColonne(table: string, colonne: string): string | null {
    return this.colonnes.get(table)?.get(colonne) ?? null;
  }

  async requete<T extends pg.QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const r = await this.client.query<T>(sql, params as any[]);
    return r.rows;
  }

  async compter(table: string): Promise<number> {
    if (!this.a(table)) return 0;
    const r = await this.requete<{ n: string }>(`SELECT count(*)::text AS n FROM public.${ident(table)}`);
    return Number(r[0]?.n ?? 0);
  }

  /** Lit le résultat d'une requête par paquets, via un curseur (mémoire bornée même sur de gros volumes). */
  async *paquets<T = LigneLegacy>(sql: string, taille = 500): AsyncGenerator<T[]> {
    const nom = `import_c${++this.curseur}`;
    await this.client.query(`DECLARE ${nom} NO SCROLL CURSOR FOR ${sql}`);
    try {
      for (;;) {
        const r = await this.client.query(`FETCH ${taille} FROM ${nom}`);
        if (r.rows.length === 0) break;
        yield r.rows as T[];
      }
    } finally {
      await this.client.query(`CLOSE ${nom}`).catch(() => {});
    }
  }

  /** Toutes les lignes d'une table en `to_jsonb`, triées par id si la colonne existe. */
  async *lignes(table: string, taille = 500): AsyncGenerator<LigneLegacy[]> {
    if (!this.a(table)) return;
    const ordre = this.aColonne(table, 'id') ? ' ORDER BY t.id' : '';
    for await (const lot of this.paquets<{ r: LigneLegacy }>(`SELECT to_jsonb(t) AS r FROM public.${ident(table)} t${ordre}`, taille)) {
      yield lot.map((l) => l.r);
    }
  }

  async toutes(table: string): Promise<LigneLegacy[]> {
    const out: LigneLegacy[] = [];
    for await (const lot of this.lignes(table, 2000)) out.push(...lot);
    return out;
  }

  /** Empreinte de contrôle d'une table (nombre de lignes + md5 du contenu), pour prouver qu'elle n'a pas changé. */
  async empreinte(table: string): Promise<{ lignes: number; md5: string }> {
    const ordre = this.aColonne(table, 'id') ? 'ORDER BY t.id' : 'ORDER BY to_jsonb(t)::text';
    const r = await this.requete<{ n: string; md5: string }>(
      `SELECT count(*)::text AS n, coalesce(md5(string_agg(to_jsonb(t)::text, '|' ${ordre})), '') AS md5 FROM public.${ident(table)} t`,
    );
    return { lignes: Number(r[0]?.n ?? 0), md5: r[0]?.md5 ?? '' };
  }

  async fermer(): Promise<void> {
    await this.client.query('ROLLBACK').catch(() => {});
    await this.client.end().catch(() => {});
  }
}

export function ident(nom: string): string {
  return `"${nom.replace(/"/g, '""')}"`;
}

/** Adresse de connexion sans mot de passe, pour les messages et le rapport. */
export function urlMasquee(url: string): string {
  try {
    const u = new URL(url);
    return `${u.username ? `${decodeURIComponent(u.username)}@` : ''}${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(adresse illisible)';
  }
}

/** Même base de données (hôte, port, nom) ? Sert à refuser un import d'une base vers elle-même. */
export function memeBase(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const norm = (u: URL) => {
      const host = ['localhost', '127.0.0.1', '::1', '[::1]', ''].includes(u.hostname) ? 'localhost' : u.hostname;
      return `${host}:${u.port || '5432'}${u.pathname.replace(/\/+$/, '')}`;
    };
    return norm(ua) === norm(ub);
  } catch {
    return a === b;
  }
}
