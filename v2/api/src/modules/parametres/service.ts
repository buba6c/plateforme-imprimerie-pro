// Fusion et enregistrement des paramètres : utilisés par PUT /parametres et par l'import de configuration.

import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { one } from '../../db/pool';
import { badRequest } from '../../lib/errors';
import { getParametres, invalidateParametres, type Parametres } from '../../lib/params';
import type { ParametresInput } from './schemas';

export type Changements = Partial<Record<keyof Parametres, { avant: unknown; apres: unknown }>>;

function sansIndefinis<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async function verifierFuseau(fuseau: string, db: PoolClient | undefined) {
  let intlOk = true;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau });
  } catch {
    intlOk = false;
  }
  const connu = intlOk && (await one(`SELECT 1 FROM pg_timezone_names WHERE name = $1`, [fuseau], db));
  if (!connu) {
    throw badRequest(`Fuseau horaire « ${fuseau} » inconnu : utilisez un nom IANA, par exemple Africa/Dakar.`, {
      champs: { fuseau: 'Fuseau horaire inconnu' },
    });
  }
}

/** Paramètres obtenus en appliquant `input` sur `avant` (un champ absent garde sa valeur). */
export async function fusionner(avant: Parametres, input: ParametresInput, db?: PoolClient): Promise<{ apres: Parametres; changements: Changements }> {
  if (input.fuseau !== undefined) await verifierFuseau(input.fuseau, db);
  const apres: Parametres = {
    entreprise: { ...avant.entreprise, ...sansIndefinis(input.entreprise) },
    prix: { ...avant.prix, ...sansIndefinis(input.prix) },
    livreur_jours_historique: input.livreur_jours_historique ?? avant.livreur_jours_historique,
    fuseau: input.fuseau ?? avant.fuseau,
    securite: { ...avant.securite, ...sansIndefinis(input.securite) },
    fichiers: { ...avant.fichiers, ...sansIndefinis(input.fichiers) },
    documents: { ...avant.documents, ...sansIndefinis(input.documents) },
    notifications: { ...avant.notifications, ...sansIndefinis(input.notifications) },
  };
  const changements: Changements = {};
  for (const cle of Object.keys(apres) as (keyof Parametres)[]) {
    if (JSON.stringify(avant[cle]) !== JSON.stringify(apres[cle])) changements[cle] = { avant: avant[cle], apres: apres[cle] };
  }
  return { apres, changements };
}

/** Écrit les sections modifiées (dans la transaction fournie) ; le cache est vidé par l'appelant après validation. */
export async function ecrire(db: PoolClient, req: Request, apres: Parametres, changements: Changements): Promise<void> {
  for (const cle of Object.keys(changements) as (keyof Parametres)[]) {
    await db.query(
      `INSERT INTO parametres (cle, valeur, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [cle, JSON.stringify(apres[cle]), req.user?.id ?? null],
    );
  }
}

/** Paramètres à jour, lus en base (jamais depuis le cache). */
export async function parametresFrais(db?: PoolClient): Promise<Parametres> {
  invalidateParametres();
  return getParametres(db);
}
