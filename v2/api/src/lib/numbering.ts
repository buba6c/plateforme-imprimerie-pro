import type { Db } from '../db/pool';
import { query } from '../db/pool';

export type Serie = 'CMD' | 'DEV' | 'FAC';

/**
 * Numéro suivant d'une série, sans trou ni doublon même en cas d'accès simultanés :
 * l'incrément se fait dans une seule instruction atomique.
 */
export async function prochainNumero(db: Db, serie: Serie, date = new Date()): Promise<string> {
  const annee = date.getFullYear();
  const rows = await query<{ valeur: number }>(
    `INSERT INTO compteurs (cle, annee, valeur) VALUES ($1, $2, 1)
     ON CONFLICT (cle, annee) DO UPDATE SET valeur = compteurs.valeur + 1
     RETURNING valeur`,
    [serie, annee],
    db,
  );
  const n = rows[0]!.valeur;
  return `${serie}-${annee}-${String(n).padStart(4, '0')}`;
}
