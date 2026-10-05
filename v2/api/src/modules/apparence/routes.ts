// Apparence : palette par défaut de l'entreprise (admin) et préférences d'affichage de chaque utilisateur.

import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';

export const PALETTES = ['evocom', 'sobre', 'perso'] as const;

export interface Apparence {
  palette_defaut: (typeof PALETTES)[number];
  couleurs_perso: { debut: string; fin: string } | null;
}

const APPARENCE_DEFAUT: Apparence = { palette_defaut: 'evocom', couleurs_perso: null };

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue au format #RRVVBB').transform((s) => s.toLowerCase());

const apparenceSchema = z
  .object({
    palette_defaut: z.enum(PALETTES, { errorMap: () => ({ message: 'Palette inconnue' }) }),
    couleurs_perso: z.object({ debut: hex, fin: hex }).nullable(),
  })
  .refine((a) => a.palette_defaut !== 'perso' || a.couleurs_perso !== null, {
    message: 'Choisissez les deux couleurs de la palette personnalisée',
    path: ['couleurs_perso'],
  });

const preferencesSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark'], { errorMap: () => ({ message: 'Mode inconnu' }) }),
    palette: z.enum(PALETTES, { errorMap: () => ({ message: 'Palette inconnue' }) }).nullable(),
    contraste: z.enum(['normal', 'eleve'], { errorMap: () => ({ message: 'Contraste inconnu' }) }),
  })
  .partial();

export async function lireApparence(): Promise<Apparence> {
  const row = await one<{ valeur: Partial<Apparence> }>(`SELECT valeur FROM parametres WHERE cle = 'apparence'`);
  const v = { ...APPARENCE_DEFAUT, ...(row?.valeur ?? {}) };
  const ok = apparenceSchema.safeParse(v);
  return ok.success ? ok.data : APPARENCE_DEFAUT;
}

/** Lue avant la connexion (écran de connexion aux couleurs de l'entreprise) : ne contient aucune donnée sensible. */
export const apparenceRouter = Router();

apparenceRouter.get('/', async (_req, res) => {
  res.json(await lireApparence());
});

apparenceRouter.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  const a = apparenceSchema.parse(req.body ?? {});
  const avant = await lireApparence();
  await query(
    `INSERT INTO parametres (cle, valeur, updated_by, updated_at) VALUES ('apparence', $1, $2, now())
     ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(a), me(req).id],
  );
  await journal(req, 'apparence_modifiee', 'parametres', 'apparence', { avant, apres: a });
  res.json(a);
});

export const preferencesRouter = Router();
preferencesRouter.use(requireAuth);

preferencesRouter.get('/', async (req, res) => {
  const p = await one(`SELECT theme, palette, contraste FROM preferences_utilisateur WHERE user_id = $1`, [me(req).id]);
  res.json(p ?? { theme: 'system', palette: null, contraste: 'normal' });
});

preferencesRouter.put('/', async (req, res) => {
  const p = preferencesSchema.parse(req.body ?? {});
  const row = await one(
    `INSERT INTO preferences_utilisateur (user_id, theme, palette, contraste)
     VALUES ($1, COALESCE($2, 'system'), $3, COALESCE($4, 'normal'))
     ON CONFLICT (user_id) DO UPDATE SET
       theme = COALESCE($2, preferences_utilisateur.theme),
       palette = CASE WHEN $5 THEN $3 ELSE preferences_utilisateur.palette END,
       contraste = COALESCE($4, preferences_utilisateur.contraste),
       updated_at = now()
     RETURNING theme, palette, contraste`,
    [me(req).id, p.theme ?? null, p.palette ?? null, p.contraste ?? null, 'palette' in p],
  );
  res.json(row);
});
