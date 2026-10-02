// Paramètres de l'entreprise et règles de calcul, stockés dans la table parametres.

import { PARAMS_PRIX_DEFAUT, type ParamsPrix } from '@evocom/shared';
import { query, type Db } from '../db/pool';

export interface Entreprise {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  ninea: string;
  rccm: string;
  pied_facture: string;
}

export interface Parametres {
  entreprise: Entreprise;
  prix: ParamsPrix;
  /** Jours pendant lesquels un dossier livré et payé reste visible par le livreur. */
  livreur_jours_historique: number;
  fuseau: string;
}

export const PARAMETRES_DEFAUT: Parametres = {
  entreprise: { nom: 'Evocom Print', adresse: '', telephone: '', email: '', ninea: '', rccm: '', pied_facture: '' },
  prix: PARAMS_PRIX_DEFAUT,
  livreur_jours_historique: 7,
  fuseau: 'Africa/Dakar',
};

let cache: { at: number; value: Parametres } | null = null;

export async function getParametres(db?: Db): Promise<Parametres> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  const rows = await query<{ cle: string; valeur: any }>('SELECT cle, valeur FROM parametres', [], db);
  const map = Object.fromEntries(rows.map((r) => [r.cle, r.valeur]));
  const value: Parametres = {
    entreprise: { ...PARAMETRES_DEFAUT.entreprise, ...(map.entreprise ?? {}) },
    prix: { ...PARAMETRES_DEFAUT.prix, ...(map.prix ?? {}) },
    livreur_jours_historique: Number(map.livreur_jours_historique ?? PARAMETRES_DEFAUT.livreur_jours_historique),
    fuseau: String(map.fuseau ?? PARAMETRES_DEFAUT.fuseau),
  };
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateParametres() {
  cache = null;
}
