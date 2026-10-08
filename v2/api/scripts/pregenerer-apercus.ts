// Fabrique à l'avance les miniatures (480 px) de tous les fichiers actifs, un par un, pour que les grilles
// s'affichent tout de suite. Reprise possible : une miniature déjà faite n'est pas refaite.
// Usage (serveur) : cd v2/api && nice -n 15 node --env-file=.env --import tsx scripts/pregenerer-apercus.ts
import path from 'node:path';
import { initPool, query } from '../src/db/pool';
import { apercu, genreApercu } from '../src/modules/fichiers/apercu';

const stockage = path.resolve(process.env.STORAGE_DIR || 'storage');
const pool = initPool(process.env.DATABASE_URL!);
(async () => {
  const rows = await query<{ id: number; chemin: string; mime: string | null; nom_original: string; taille: number }>(
    `SELECT id, chemin, mime, nom_original, taille FROM fichiers WHERE deleted_at IS NULL AND purge_at IS NULL ORDER BY created_at DESC`,
  );
  let faits = 0, sautes = 0, echecs = 0;
  const debut = Date.now();
  for (const f of rows) {
    const genre = genreApercu(f);
    if (!genre) { sautes++; continue; }
    const abs = path.resolve(stockage, f.chemin);
    if (!abs.startsWith(stockage + path.sep)) { sautes++; continue; }
    try {
      await apercu(stockage, abs, genre, 1, 480);
      faits++;
    } catch (e) {
      echecs++;
      console.log(`échec #${f.id} ${f.nom_original} : ${(e as Error).message}`);
    }
    if ((faits + echecs) % 100 === 0) console.log(`${faits + echecs}/${rows.length} · ${Math.round((Date.now() - debut) / 1000)} s`);
    await new Promise((r) => setTimeout(r, 150)); // laisse respirer le serveur
  }
  console.log(`Terminé : ${faits} miniatures, ${sautes} fichiers sans aperçu possible, ${echecs} échecs, ${Math.round((Date.now() - debut) / 60000)} min.`);
  await pool.end();
})();
