import { initPool, closePool } from './pool';
import { migrate } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL est absent.');
  process.exit(1);
}
const pool = initPool(url);
migrate(pool)
  .then((applied) => {
    console.log(applied.length ? `${applied.length} migration(s) appliquée(s).` : 'La base est déjà à jour.');
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
