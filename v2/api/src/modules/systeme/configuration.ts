// Export et import de la configuration : paramètres (liste blanche, aucun secret), apparence de
// l'entreprise et grille tarifaire. Jamais la configuration de l'assistant IA (ia_config, clé chiffrée).
// L'import est validé strictement, comparé à l'existant (aperçu), puis appliqué dans une seule transaction.
// Un tarif absent du fichier est conservé tel quel : l'import n'efface rien.

import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { CATEGORIES_TARIF, UNITES_TARIF } from '@evocom/shared';
import { query, tx } from '../../db/pool';
import { journal } from '../../lib/audit';
import { invalidateParametres, type Parametres } from '../../lib/params';
import { invalidateTarifs } from '../../lib/tarifs';
import type { AuthUser } from '../../types';
import { lireApparence, PALETTES, type Apparence } from '../apparence/routes';
import { parametresSchema } from '../parametres/schemas';
import { ecrire, fusionner, parametresFrais } from '../parametres/service';

export const FORMAT = 'evocom-print-configuration';
const VERSION = 1;

const CHAMPS_TARIF = ['categorie', 'libelle', 'unite', 'prix', 'actif', 'ordre', 'description'] as const;
const COLONNES_TARIF = `machine, categorie, code, libelle, unite, prix, actif, ordre, description`;

interface TarifConfig {
  machine: 'roland' | 'xerox' | 'global';
  categorie: string;
  code: string;
  libelle: string;
  unite: string;
  prix: number | null;
  actif: boolean;
  ordre: number;
  description: string | null;
}

export async function exporterConfiguration(user: AuthUser) {
  const parametres: Parametres = await parametresFrais();
  const apparence = await lireApparence();
  const tarifs = await query<TarifConfig>(`SELECT ${COLONNES_TARIF} FROM tarifs ORDER BY machine, categorie, ordre, code`);
  return { format: FORMAT, version: VERSION, exporte_le: new Date().toISOString(), exporte_par: user.nom, parametres, apparence, tarifs };
}

// Mêmes règles que PUT /apparence (modules/apparence/routes.ts).
const hex = z
  .string({ invalid_type_error: 'Couleur attendue au format #RRVVBB' })
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue au format #RRVVBB')
  .transform((v) => v.toLowerCase());
const apparenceSchema = z
  .object({
    palette_defaut: z.enum(PALETTES, { errorMap: () => ({ message: `Palette inconnue : ${PALETTES.join(', ')}` }) }),
    couleurs_perso: z.object({ debut: hex, fin: hex }).strict('Couleurs : debut et fin uniquement').nullable(),
  })
  .strict("Champ d'apparence inconnu")
  .refine((a) => a.palette_defaut !== 'perso' || a.couleurs_perso !== null, {
    message: 'Choisissez les deux couleurs de la palette personnalisée',
    path: ['couleurs_perso'],
  });

const tarifSchema = z
  .object({
    machine: z.enum(['roland', 'xerox', 'global'], { errorMap: () => ({ message: 'Machine : roland, xerox ou global' }) }),
    categorie: z.enum(CATEGORIES_TARIF, { errorMap: () => ({ message: `Catégorie : ${CATEGORIES_TARIF.join(', ')}` }) }),
    code: z.string({ required_error: 'Code manquant' }).trim().regex(/^[a-z0-9_]{2,64}$/, 'Code : lettres minuscules, chiffres et _ uniquement'),
    libelle: z.string({ required_error: 'Libellé manquant' }).trim().min(2, 'Libellé : 2 caractères au minimum').max(120, 'Libellé : 120 caractères au maximum'),
    unite: z.enum(UNITES_TARIF, { errorMap: () => ({ message: `Unité : ${UNITES_TARIF.join(', ')}` }) }),
    prix: z.number({ invalid_type_error: 'Prix : nombre entier de FCFA ou null' }).int('Prix : nombre entier de FCFA').nonnegative('Prix : positif').max(100_000_000).nullable(),
    actif: z.boolean({ invalid_type_error: 'Actif : oui ou non' }),
    ordre: z.number({ invalid_type_error: 'Ordre : nombre entier' }).int('Ordre : nombre entier').min(-100_000).max(100_000),
    description: z.string().max(500, 'Description : 500 caractères au maximum').nullable().optional(),
  })
  .strict('Champ de tarif inconnu');

export const importSchema = z
  .object({
    format: z.literal(FORMAT, { errorMap: () => ({ message: "Ce fichier n'est pas une configuration exportée depuis Evocom Print (Paramètres > Export et import)." }) }),
    version: z.literal(VERSION, { errorMap: () => ({ message: `Version de configuration non prise en charge (attendue : ${VERSION}).` }) }),
    exporte_le: z.string().max(40).optional(),
    exporte_par: z.string().max(200).optional(),
    parametres: parametresSchema(true).optional(),
    apparence: apparenceSchema.optional(),
    tarifs: z.array(tarifSchema).max(5000, 'Au plus 5 000 tarifs').optional(),
  })
  .strict('Champ inconnu dans le fichier de configuration')
  .superRefine((v, ctx) => {
    const vus = new Set<string>();
    v.tarifs?.forEach((t, i) => {
      const cle = `${t.machine}:${t.code}`;
      if (vus.has(cle)) ctx.addIssue({ code: 'custom', path: ['tarifs', i, 'code'], message: `Tarif en double dans le fichier : ${t.machine} / ${t.code}` });
      vus.add(cle);
    });
  });
export type ConfigurationImport = z.infer<typeof importSchema>;

type Valeur = string | number | boolean | null | string[];

/** Différences ligne à ligne, lisibles dans l'aperçu. */
export interface Differences {
  parametres: { section: string; champ: string | null; avant: unknown; apres: unknown }[];
  tarifs: {
    ajoutes: TarifConfig[];
    modifies: { machine: string; code: string; libelle: string; champs: Record<string, { avant: Valeur; apres: Valeur }> }[];
    inchanges: number;
    absents_conserves: { machine: string; code: string; libelle: string }[];
  };
  nb_changements: number;
}

async function comparer(input: ConfigurationImport, db?: PoolClient) {
  const avant = await parametresFrais(db);
  const { apres, changements } = await fusionner(avant, input.parametres ?? {}, db);
  const parametres: Differences['parametres'] = [];
  for (const [section, ch] of Object.entries(changements)) {
    if (ch.avant !== null && typeof ch.avant === 'object' && !Array.isArray(ch.avant)) {
      const a = ch.avant as Record<string, unknown>;
      const b = ch.apres as Record<string, unknown>;
      for (const champ of Object.keys(b)) {
        if (JSON.stringify(a[champ]) !== JSON.stringify(b[champ])) parametres.push({ section, champ, avant: a[champ], apres: b[champ] });
      }
    } else {
      parametres.push({ section, champ: null, avant: ch.avant, apres: ch.apres });
    }
  }

  let apparence: { avant: Apparence; apres: Apparence } | null = null;
  if (input.apparence) {
    const a = await lireApparence();
    const b = input.apparence as Apparence;
    if (JSON.stringify(a) !== JSON.stringify({ palette_defaut: b.palette_defaut, couleurs_perso: b.couleurs_perso })) {
      apparence = { avant: a, apres: b };
      for (const champ of ['palette_defaut', 'couleurs_perso'] as const) {
        if (JSON.stringify(a[champ]) !== JSON.stringify(b[champ])) parametres.push({ section: 'apparence', champ, avant: a[champ], apres: b[champ] });
      }
    }
  }

  const existants = await query<TarifConfig>(`SELECT ${COLONNES_TARIF} FROM tarifs ORDER BY machine, categorie, ordre, code`, [], db);
  const parCle = new Map(existants.map((t) => [`${t.machine}:${t.code}`, t]));
  const tarifs: Differences['tarifs'] = { ajoutes: [], modifies: [], inchanges: 0, absents_conserves: [] };
  if (input.tarifs) {
    const dansFichier = new Set<string>();
    for (const t of input.tarifs) {
      const cle = `${t.machine}:${t.code}`;
      dansFichier.add(cle);
      const e = parCle.get(cle);
      const nouveau: TarifConfig = { ...t, description: t.description ?? null };
      if (!e) {
        tarifs.ajoutes.push(nouveau);
        continue;
      }
      const champs: Record<string, { avant: Valeur; apres: Valeur }> = {};
      for (const k of CHAMPS_TARIF) {
        if (k === 'description' && t.description === undefined) continue;
        if (e[k] !== nouveau[k]) champs[k] = { avant: e[k], apres: nouveau[k] };
      }
      if (Object.keys(champs).length) tarifs.modifies.push({ machine: t.machine, code: t.code, libelle: t.libelle, champs });
      else tarifs.inchanges++;
    }
    for (const e of existants) {
      if (!dansFichier.has(`${e.machine}:${e.code}`)) tarifs.absents_conserves.push({ machine: e.machine, code: e.code, libelle: e.libelle });
    }
  }
  const differences: Differences = { parametres, tarifs, nb_changements: parametres.length + tarifs.ajoutes.length + tarifs.modifies.length };
  return { differences, apres, changements, apparence };
}

export async function apercuImport(input: ConfigurationImport): Promise<Differences> {
  return (await comparer(input)).differences;
}

export async function appliquerImport(req: Request, input: ConfigurationImport): Promise<Differences> {
  const userId = req.user?.id ?? null;
  const differences = await tx(async (db) => {
    // Aucun import ni modification de tarif ne doit s'intercaler entre la comparaison et l'écriture.
    await db.query('LOCK TABLE parametres, tarifs IN SHARE ROW EXCLUSIVE MODE');
    const { differences: d, apres, changements, apparence } = await comparer(input, db);
    if (d.nb_changements === 0) return d;
    await ecrire(db, req, apres, changements);
    if (apparence) {
      await db.query(
        `INSERT INTO parametres (cle, valeur, updated_by, updated_at) VALUES ('apparence', $1, $2, now())
         ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [JSON.stringify(apparence.apres), userId],
      );
    }
    for (const t of d.tarifs.ajoutes) {
      await db.query(
        `INSERT INTO tarifs (machine, categorie, code, libelle, unite, prix, actif, ordre, description, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [t.machine, t.categorie, t.code, t.libelle, t.unite, t.prix, t.actif, t.ordre, t.description, userId],
      );
    }
    for (const m of d.tarifs.modifies) {
      const cols = Object.keys(m.champs);
      await db.query(
        `UPDATE tarifs SET ${cols.map((c, i) => `${c} = $${i + 3}`).join(', ')}, updated_by = $${cols.length + 3} WHERE machine = $1 AND code = $2`,
        [m.machine, m.code, ...cols.map((c) => m.champs[c]!.apres), userId],
      );
    }
    await journal(
      req,
      'configuration_importee',
      'configuration',
      null,
      {
        fichier: { exporte_le: input.exporte_le ?? null, exporte_par: input.exporte_par ?? null },
        parametres: apparence ? { ...changements, apparence } : changements,
        tarifs: {
          ajoutes: d.tarifs.ajoutes.map((t) => `${t.machine}/${t.code}`),
          modifies: d.tarifs.modifies.map((m) => ({ tarif: `${m.machine}/${m.code}`, champs: m.champs })),
          absents_conserves: d.tarifs.absents_conserves.length,
        },
      },
      db,
    );
    return d;
  });
  invalidateParametres();
  invalidateTarifs();
  return differences;
}
