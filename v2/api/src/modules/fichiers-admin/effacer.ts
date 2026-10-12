// Effacement d'un fichier d'impression sur le disque, après que sa ligne a été marquée purgée en base.
// Partagé par la purge du gestionnaire de fichiers et par le nettoyage de « Sauvegardes et état ».
import fs from 'node:fs';
import path from 'node:path';
import { one } from '../../db/pool';
import { cheminSous } from '../commun/disque';

export interface EffacementDisque {
  resultat: string;
  supprime: boolean;
  libere: number;
  partage: number;
  erreur?: string;
}

export interface BilanPurge {
  purges: number;
  supprimes_du_disque: number;
  octets_liberes_maintenant: number;
  octets_partages: number;
  fichiers_partages: number;
  absents: number;
  erreurs: { id: number; nom: string; message: string }[];
}

/**
 * Efface du disque le fichier d'une ligne déjà purgée en base. Garde-fous : chemin sous STORAGE_DIR/dossiers,
 * fichier ordinaire (jamais un lien symbolique ni un dossier), aucune autre ligne non purgée avec ce chemin.
 */
export async function effacerDuDisque(racine: string, chemin: string): Promise<EffacementDisque> {
  const base = path.join(racine, 'dossiers');
  const abs = cheminSous(racine, chemin);
  if (!abs || !abs.startsWith(base + path.sep)) {
    return { resultat: 'conserve : chemin hors du dossier des fichiers', supprime: false, libere: 0, partage: 0, erreur: 'Chemin hors du dossier des fichiers : rien n’a été effacé.' };
  }
  const autres = await one<{ n: number }>(`SELECT count(*)::int AS n FROM fichiers WHERE chemin = $1 AND purge_at IS NULL`, [chemin]);
  if (autres?.n) {
    return { resultat: 'conserve : utilisé par un autre fichier', supprime: false, libere: 0, partage: 0, erreur: 'Gardé sur le disque : le même fichier sert encore à un autre dossier.' };
  }
  let st: fs.Stats;
  try {
    st = await fs.promises.lstat(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { resultat: 'absent du disque', supprime: false, libere: 0, partage: 0 };
    return { resultat: `erreur : ${code ?? 'lecture'}`, supprime: false, libere: 0, partage: 0, erreur: `Lecture impossible (${code ?? (e as Error).message}).` };
  }
  if (!st.isFile()) {
    return { resultat: 'conserve : pas un fichier ordinaire', supprime: false, libere: 0, partage: 0, erreur: 'Ce n’est pas un fichier ordinaire (lien symbolique ou dossier) : rien n’a été effacé.' };
  }
  try {
    await fs.promises.unlink(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { resultat: 'absent du disque', supprime: false, libere: 0, partage: 0 };
    return { resultat: `erreur : ${code ?? 'effacement'}`, supprime: false, libere: 0, partage: 0, erreur: `Effacement impossible (${code ?? (e as Error).message}).` };
  }
  await fs.promises.rmdir(path.dirname(abs)).catch(() => {}); // dossier du dossier vide : retiré, sinon gardé
  return st.nlink > 1
    ? { resultat: `supprime (contenu partagé : ${st.nlink} noms)`, supprime: true, libere: 0, partage: st.size }
    : { resultat: 'supprime', supprime: true, libere: st.size, partage: 0 };
}

/** Bilan lisible d'une série d'effacements, dans l'ordre des lignes. */
export function bilanPurge(rows: { id: number; nom_original: string }[], resultats: EffacementDisque[]): BilanPurge {
  return {
    purges: rows.length,
    supprimes_du_disque: resultats.filter((x) => x.supprime).length,
    octets_liberes_maintenant: resultats.reduce((t, x) => t + x.libere, 0),
    octets_partages: resultats.reduce((t, x) => t + x.partage, 0),
    fichiers_partages: resultats.filter((x) => x.partage > 0).length,
    absents: resultats.filter((x) => x.resultat === 'absent du disque').length,
    erreurs: resultats.flatMap((x, i) => (x.erreur ? [{ id: rows[i]!.id, nom: rows[i]!.nom_original, message: x.erreur }] : [])),
  };
}
