import { Router } from 'express';
import { z } from 'zod';
import { calculerPrix, CATEGORIES_TARIF, MACHINES, specsSchemaFor, UNITES_TARIF, verifierCombinaisonTarif, type Specs, type Tarif } from '@evocom/shared';
import { one, query } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { getTarifs, invalidateTarifs } from '../../lib/tarifs';

export const tarifsRouter = Router();
tarifsRouter.use(requireAuth);

/** Libellés et unités, sans les prix : utiles à tous les rôles pour lire les spécifications. */
tarifsRouter.get('/libelles', async (_req, res) => {
  res.json(await query(`SELECT machine, categorie, code, libelle, unite FROM tarifs ORDER BY machine, categorie, ordre, libelle`));
});

tarifsRouter.get('/', requireRole('admin', 'preparateur'), async (_req, res) => {
  res.json(await query(`SELECT * FROM tarifs ORDER BY machine, categorie, ordre, libelle`));
});

const tarifSchema = z.object({
  machine: z.enum(['roland', 'xerox', 'global']),
  categorie: z.enum(CATEGORIES_TARIF),
  code: z.string().trim().regex(/^[a-z0-9_]{2,64}$/, 'Code : lettres minuscules, chiffres et _ uniquement'),
  libelle: z.string().trim().min(2).max(120),
  unite: z.enum(UNITES_TARIF),
  prix: z.number().int().nonnegative().max(100_000_000).nullable(),
  actif: z.boolean().default(true),
  ordre: z.number().int().default(0),
  description: z.string().max(500).nullable().optional(),
});

/**
 * A4 : une unité qui ne convient pas à la machine ou à la catégorie (m² sur Xerox, pourcentage sur une
 * finition, support commun aux deux machines…) est refusée ici ; le moteur de prix la refuse aussi.
 */
function verifierCombinaison(t: Pick<Tarif, 'machine' | 'categorie' | 'unite'>) {
  const message = verifierCombinaisonTarif(t);
  if (message) throw badRequest(message, { champs: { unite: message } });
}

tarifsRouter.post('/', requireRole('admin'), async (req, res) => {
  const t = tarifSchema.parse(req.body);
  verifierCombinaison(t);
  const r = await one(
    `INSERT INTO tarifs (machine, categorie, code, libelle, unite, prix, actif, ordre, description, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [t.machine, t.categorie, t.code, t.libelle, t.unite, t.prix, t.actif, t.ordre, t.description ?? null, me(req).id],
  ).catch((e) => {
    if (e.code === '23505') throw conflict('Ce code existe déjà pour cette machine.');
    throw e;
  });
  invalidateTarifs();
  await journal(req, 'tarif_cree', 'tarif', r!.id, t);
  res.status(201).json(r);
});

tarifsRouter.patch('/:id', requireRole('admin'), async (req, res) => {
  const id = intParam(req);
  const t = tarifSchema.partial().omit({ code: true, machine: true }).parse(req.body);
  const avant = await one(`SELECT * FROM tarifs WHERE id = $1`, [id]);
  if (!avant) throw notFound('Tarif introuvable.');
  if (t.categorie !== undefined || t.unite !== undefined) {
    verifierCombinaison({ machine: avant.machine, categorie: t.categorie ?? avant.categorie, unite: t.unite ?? avant.unite });
  }
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(t)) {
    if (v === undefined) continue;
    args.push(v);
    sets.push(`${k} = $${args.length}`);
  }
  args.push(me(req).id);
  sets.push(`updated_by = $${args.length}`);
  args.push(id);
  const r = await one(`UPDATE tarifs SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING *`, args);
  invalidateTarifs();
  await journal(req, 'tarif_modifie', 'tarif', id, { avant: { prix: avant.prix, actif: avant.actif }, apres: t });
  res.json(r);
});

/** Estimation de prix à partir des spécifications, sans rien enregistrer. */
tarifsRouter.post('/estimer', requireRole('admin', 'preparateur'), async (req, res) => {
  const body = z.object({ machine: z.enum(MACHINES), specs: z.unknown() }).parse(req.body);
  const specs = specsSchemaFor(body.machine).parse(body.specs) as Specs;
  const [tarifs, params] = await Promise.all([getTarifs(), getParametres()]);
  res.json(calculerPrix(body.machine, specs, tarifs, params.prix));
});
