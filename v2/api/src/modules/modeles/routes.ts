// Modèles de dossier : les préparateurs et administrateurs enregistrent une configuration qu'ils refont
// souvent, puis la réappliquent d'un clic dans « Nouveau dossier ». Un modèle est à soi ou partagé.
import { Router } from 'express';
import { z } from 'zod';
import { MACHINES, specsSchemaFor } from '@evocom/shared';
import { one, query } from '../../db/pool';
import { journal } from '../../lib/audit';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { intParam } from '../../lib/http';

export const modelesRouter = Router();
modelesRouter.use(requireAuth, requireRole('admin', 'preparateur'));

const texteOpt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const modeleSchema = z.object({
  nom: z.string().trim().min(1, 'Donnez un nom au modèle.').max(80),
  machine: z.enum(MACHINES),
  specs: z.unknown(),
  description: texteOpt(2000),
  consignes: texteOpt(2000),
  mode_remise: z.enum(['livraison', 'retrait']).nullable().optional(),
  partage: z.boolean().default(true),
});

const COLS = `m.id, m.nom, m.machine, m.specs, m.description, m.consignes, m.mode_remise, m.partage, m.cree_par, u.nom AS cree_par_nom,
  m.usages, m.created_at, m.updated_at`;

function specsValides(machine: 'roland' | 'xerox', specs: unknown) {
  const r = specsSchemaFor(machine).safeParse(specs ?? { lignes: [], forfaits: [] });
  if (!r.success) throw badRequest('Les spécifications du modèle sont incomplètes : complétez la ligne (support, dimensions ou pages, quantité) avant d’enregistrer.');
  const s = r.data as { lignes?: unknown[]; forfaits?: unknown[] };
  if (!(s.lignes?.length || s.forfaits?.length)) throw badRequest('Un modèle doit contenir au moins une ligne ou un forfait.');
  return r.data;
}

async function charger(id: number) {
  const m = await one<{ id: number; cree_par: number; partage: boolean; nom: string }>(`SELECT id, cree_par, partage, nom FROM modeles_dossier WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!m) throw notFound('Ce modèle n’existe plus.');
  return m;
}

/** Les miens, plus ceux partagés par les collègues ; les plus utilisés d'abord. */
modelesRouter.get('/', async (req, res) => {
  const user = me(req);
  const rows = await query(
    `SELECT ${COLS}, (m.cree_par = $1) AS mien
     FROM modeles_dossier m JOIN users u ON u.id = m.cree_par
     WHERE m.deleted_at IS NULL AND (m.cree_par = $1 OR m.partage)
     ORDER BY m.usages DESC, lower(m.nom)`,
    [user.id],
  );
  res.json(rows);
});

modelesRouter.post('/', async (req, res) => {
  const user = me(req);
  const input = modeleSchema.parse(req.body);
  const specs = specsValides(input.machine, input.specs);
  const m = await one<{ id: number }>(
    `INSERT INTO modeles_dossier (nom, machine, specs, description, consignes, mode_remise, partage, cree_par)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [input.nom, input.machine, JSON.stringify(specs), input.description, input.consignes, input.mode_remise ?? null, input.partage, user.id],
  );
  await journal(req, 'modele_cree', 'modele', m!.id, { nom: input.nom, machine: input.machine, partage: input.partage });
  res.status(201).json(await one(`SELECT ${COLS}, true AS mien FROM modeles_dossier m JOIN users u ON u.id = m.cree_par WHERE m.id = $1`, [m!.id]));
});

modelesRouter.patch('/:id', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const m = await charger(id);
  if (m.cree_par !== user.id && user.role !== 'admin') throw forbidden('Seul l’auteur du modèle ou un administrateur peut le modifier.');
  const input = modeleSchema.partial().parse(req.body);
  const sets: string[] = [];
  const args: unknown[] = [];
  const set = (col: string, v: unknown) => {
    args.push(v);
    sets.push(`${col} = $${args.length}`);
  };
  if (input.nom !== undefined) set('nom', input.nom);
  if (input.partage !== undefined) set('partage', input.partage);
  if (input.description !== undefined) set('description', input.description);
  if (input.consignes !== undefined) set('consignes', input.consignes);
  if (input.mode_remise !== undefined) set('mode_remise', input.mode_remise);
  if (input.specs !== undefined || input.machine !== undefined) {
    const machine = input.machine ?? (await one<{ machine: 'roland' | 'xerox' }>(`SELECT machine FROM modeles_dossier WHERE id = $1`, [id]))!.machine;
    const specs = input.specs !== undefined ? specsValides(machine, input.specs) : undefined;
    if (input.machine !== undefined) set('machine', machine);
    if (specs !== undefined) set('specs', JSON.stringify(specs));
  }
  if (!sets.length) throw badRequest('Aucune modification.');
  set('updated_at', new Date());
  args.push(id);
  await query(`UPDATE modeles_dossier SET ${sets.join(', ')} WHERE id = $${args.length}`, args);
  await journal(req, 'modele_modifie', 'modele', id, { champs: Object.keys(input) });
  res.json(await one(`SELECT ${COLS}, (m.cree_par = $2) AS mien FROM modeles_dossier m JOIN users u ON u.id = m.cree_par WHERE m.id = $1`, [id, user.id]));
});

modelesRouter.delete('/:id', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const m = await charger(id);
  if (m.cree_par !== user.id && user.role !== 'admin') throw forbidden('Seul l’auteur du modèle ou un administrateur peut le supprimer.');
  await query(`UPDATE modeles_dossier SET deleted_at = now() WHERE id = $1`, [id]);
  await journal(req, 'modele_supprime', 'modele', id, { nom: m.nom });
  res.status(204).end();
});

/** Compte une utilisation (pour classer les modèles les plus utiles en premier). */
modelesRouter.post('/:id/utiliser', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const m = await charger(id);
  if (m.cree_par !== user.id && !m.partage) throw forbidden('Ce modèle n’est pas partagé.');
  await query(`UPDATE modeles_dossier SET usages = usages + 1 WHERE id = $1`, [id]);
  res.status(204).end();
});
