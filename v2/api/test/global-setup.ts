import pg from 'pg';

/** Repart d'une base vide à chaque exécution de la suite. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://evocom:evocom_dev@localhost:5432/evocom_test';
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
}
