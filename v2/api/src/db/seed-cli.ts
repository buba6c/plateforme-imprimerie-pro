import { initPool, closePool } from './pool';
import { seedBase, seedDemoUsers } from './seed';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL est absent.');
  process.exit(1);
}
const pool = initPool(url);
const demo = process.argv.includes('--demo');
const admin =
  process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD
    ? { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, nom: process.env.ADMIN_NOM }
    : undefined;
(async () => {
  await seedBase(pool, admin);
  if (demo) await seedDemoUsers(pool);
  console.log(`Données de base en place${demo ? ' (avec comptes de démonstration)' : ''}.`);
  if (!admin && !demo) console.log('Astuce : ADMIN_EMAIL et ADMIN_PASSWORD créent le premier administrateur.');
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
