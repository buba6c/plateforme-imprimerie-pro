// Espace disque et répartition des fichiers d'impression (écran « Sauvegardes et état »).
//
// « Partagés » : fichiers actifs dont le contenu a plusieurs noms sur le disque (liens durs). Les fichiers
// importés de l'ancienne plateforme sont des liens durs vers ses uploads, et les instantanés de sauvegarde
// (rsync --link-dest) en ajoutent d'autres : supprimer un de ces noms ne libère la place que lorsque le
// dernier nom disparaît. Ce compte lit le disque (un lstat par fichier) : il est gardé 10 minutes.

import { query } from '../../db/pool';
import { espaceDisque, lstatFichier, parLots } from '../commun/disque';

const CACHE_MS = 10 * 60 * 1000;

interface Bloc {
  nb: number;
  taille: number;
}

let cachePartages: { racine: string; at: number; valeur: Bloc & { calcule_at: string } } | null = null;

/** Vide le cache des fichiers partagés (après une purge, par exemple). */
export function invaliderStockage() {
  cachePartages = null;
}

async function partages(racine: string, rafraichir: boolean): Promise<Bloc & { calcule_at: string }> {
  if (!rafraichir && cachePartages && cachePartages.racine === racine && Date.now() - cachePartages.at < CACHE_MS) {
    return cachePartages.valeur;
  }
  const rows = await query<{ chemin: string }>(`SELECT DISTINCT chemin FROM fichiers WHERE deleted_at IS NULL`);
  const stats = await parLots(rows, 32, (r) => lstatFichier(racine, r.chemin));
  const valeur = { nb: 0, taille: 0, calcule_at: new Date().toISOString() };
  for (const s of stats) {
    if (s && s.nlink > 1) {
      valeur.nb++;
      valeur.taille += s.taille;
    }
  }
  cachePartages = { racine, at: Date.now(), valeur };
  return valeur;
}

export async function etatStockage(racine: string, rafraichir = false) {
  const [disque, totaux, liberable, part] = await Promise.all([
    espaceDisque(racine),
    query<{ etat: 'actifs' | 'corbeille' | 'purges'; nb: number; taille: number }>(
      `SELECT CASE WHEN purge_at IS NOT NULL THEN 'purges' WHEN deleted_at IS NOT NULL THEN 'corbeille' ELSE 'actifs' END AS etat,
              count(*)::int AS nb, coalesce(sum(taille), 0)::bigint AS taille
       FROM fichiers GROUP BY 1`,
    ),
    query<{ nb: number; taille: number }>(
      `SELECT count(*)::int AS nb, coalesce(sum(f.taille), 0)::bigint AS taille
       FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id
       WHERE f.deleted_at IS NULL AND d.deleted_at IS NULL AND d.livre_at IS NOT NULL AND d.livre_at < now() - interval '3 months'`,
    ),
    partages(racine, rafraichir),
  ]);
  const bloc = (etat: string): Bloc => {
    const r = totaux.find((t) => t.etat === etat);
    return { nb: r?.nb ?? 0, taille: r?.taille ?? 0 };
  };
  return {
    disque,
    fichiers: { actifs: bloc('actifs'), corbeille: bloc('corbeille'), purges: bloc('purges') },
    liberable: { dossiers_livres_plus_3_mois: liberable[0] ?? { nb: 0, taille: 0 } },
    partages: part,
  };
}
