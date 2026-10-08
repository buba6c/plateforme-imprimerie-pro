// Outils disque partagés par le gestionnaire de fichiers et l'écran « Sauvegardes et état ».

import fs from 'node:fs';
import path from 'node:path';

/** Chemin absolu de `chemin` résolu sous `racine`, ou null s'il en sortirait (`..`, chemin absolu ailleurs). */
export function cheminSous(racine: string, chemin: string): string | null {
  const base = path.resolve(racine);
  const abs = path.resolve(base, chemin);
  return abs.startsWith(base + path.sep) ? abs : null;
}

/** Applique `fn` à chaque élément avec au plus `n` opérations simultanées. */
export async function parLots<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]!);
      }
    }),
  );
  return out;
}

/** Espace du système de fichiers qui contient `dossier` (octets), ou null s'il est illisible. */
export async function espaceDisque(dossier: string): Promise<{ total: number; libre: number; utilise: number } | null> {
  try {
    const s = await fs.promises.statfs(dossier);
    const bsize = Number(s.bsize);
    return {
      total: Number(s.blocks) * bsize,
      libre: Number(s.bavail) * bsize,
      utilise: (Number(s.blocks) - Number(s.bfree)) * bsize,
    };
  } catch {
    return null;
  }
}

/**
 * Fichier ordinaire (pas un lien symbolique) sous `racine` : taille et nombre de noms (liens durs).
 * null si le chemin sort de la racine, n'existe pas ou n'est pas un fichier ordinaire.
 */
export async function lstatFichier(racine: string, chemin: string): Promise<{ abs: string; taille: number; nlink: number } | null> {
  const abs = cheminSous(racine, chemin);
  if (!abs) return null;
  const st = await fs.promises.lstat(abs).catch(() => null);
  if (!st?.isFile()) return null;
  return { abs, taille: st.size, nlink: st.nlink };
}
