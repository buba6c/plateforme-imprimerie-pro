// Prochains numéros CMD, DEV et FAC de l'année en cours. On ne peut que les avancer :
// jamais en dessous du dernier numéro attribué + 1 (ni dans le compteur, ni dans la table).

import type { Request } from 'express';
import { z } from 'zod';
import { one, tx, type Db } from '../../db/pool';
import { journal } from '../../lib/audit';
import { badRequest } from '../../lib/errors';
import type { Serie } from '../../lib/numbering';

export const SERIES: Record<Serie, { table: 'dossiers' | 'devis' | 'factures'; libelle: string }> = {
  CMD: { table: 'dossiers', libelle: 'Dossiers' },
  DEV: { table: 'devis', libelle: 'Devis' },
  FAC: { table: 'factures', libelle: 'Factures' },
};
const LISTE = Object.keys(SERIES) as Serie[];
const MAXIMUM = 999_999;

// Même année que lib/numbering.ts (heure du serveur).
const anneeCourante = () => new Date().getFullYear();

export const numero = (serie: Serie, annee: number, n: number) => `${serie}-${annee}-${String(n).padStart(4, '0')}`;

/** Dernier numéro attribué : le plus grand du compteur et des numéros déjà présents (corbeille et annulés compris). */
async function dernierAttribue(db: Db | undefined, serie: Serie, annee: number, verrou = false): Promise<{ compteur: number; dernier: number }> {
  const c = await one<{ valeur: number }>(`SELECT valeur FROM compteurs WHERE cle = $1 AND annee = $2${verrou ? ' FOR UPDATE' : ''}`, [serie, annee], db);
  const t = await one<{ n: number | null }>(
    `SELECT max(substring(numero from $1)::bigint) AS n FROM ${SERIES[serie].table}`,
    [`^${serie}-${annee}-(\\d{1,9})$`],
    db,
  );
  const compteur = c?.valeur ?? 0;
  return { compteur, dernier: Math.max(compteur, t?.n ?? 0) };
}

export async function etatNumerotation(db?: Db) {
  const annee = anneeCourante();
  const series = [];
  for (const serie of LISTE) {
    const { dernier } = await dernierAttribue(db, serie, annee);
    series.push({
      serie,
      libelle: SERIES[serie].libelle,
      dernier,
      dernier_numero: dernier > 0 ? numero(serie, annee, dernier) : null,
      prochain: dernier + 1,
      prochain_numero: numero(serie, annee, dernier + 1),
    });
  }
  return { annee, series };
}

const prochain = (serie: Serie) =>
  z
    .number({ invalid_type_error: `${serie} : nombre entier attendu` })
    .int(`${serie} : nombre entier attendu`)
    .min(1, `${serie} : 1 au minimum`)
    .max(MAXIMUM, `${serie} : ${MAXIMUM} au maximum`)
    .optional();

export const numerotationSchema = z
  .object({ CMD: prochain('CMD'), DEV: prochain('DEV'), FAC: prochain('FAC') })
  .strict('Série inconnue : CMD, DEV ou FAC');

/** Avance les compteurs demandés, dans une transaction qui verrouille chaque compteur. */
export async function avancerNumerotation(req: Request, input: z.infer<typeof numerotationSchema>) {
  const annee = anneeCourante();
  await tx(async (db) => {
    const erreurs: Record<string, string> = {};
    const changements: Record<string, { avant: string; apres: string }> = {};
    for (const serie of LISTE) {
      const voulu = input[serie];
      if (voulu === undefined) continue;
      await db.query(`INSERT INTO compteurs (cle, annee, valeur) VALUES ($1, $2, 0) ON CONFLICT (cle, annee) DO NOTHING`, [serie, annee]);
      const { compteur, dernier } = await dernierAttribue(db, serie, annee, true);
      if (voulu <= dernier) {
        erreurs[serie] = dernier
          ? `Au moins ${dernier + 1} : le numéro ${numero(serie, annee, dernier)} est déjà attribué.`
          : `Au moins ${dernier + 1}.`;
        continue;
      }
      if (voulu - 1 === compteur) continue;
      await db.query(`UPDATE compteurs SET valeur = $3 WHERE cle = $1 AND annee = $2`, [serie, annee, voulu - 1]);
      changements[serie] = { avant: numero(serie, annee, dernier + 1), apres: numero(serie, annee, voulu) };
    }
    if (Object.keys(erreurs).length) {
      throw badRequest('Un prochain numéro ne peut pas revenir en arrière : il doit dépasser le dernier numéro attribué.', { champs: erreurs });
    }
    if (Object.keys(changements).length) await journal(req, 'numerotation_modifiee', 'compteurs', annee, changements, db);
  });
  return etatNumerotation();
}
