import { Router } from 'express';
import { z } from 'zod';
import { actionInputSchema, MACHINES } from '@evocom/shared';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { intParam, qBool, qInt, qList, qStr } from '../../lib/http';
import * as svc from './service';

export const dossiersRouter = Router();
dossiersRouter.use(requireAuth);

dossiersRouter.get('/', async (req, res) => {
  const machine = qStr(req, 'machine');
  const result = await svc.listerDossiers(me(req), {
    statut: qList(req, 'statut'),
    machine: machine && (MACHINES as readonly string[]).includes(machine) ? (machine as (typeof MACHINES)[number]) : undefined,
    q: qStr(req, 'q'),
    urgent: qBool(req, 'urgent'),
    mine: qBool(req, 'mine'),
    file: qStr(req, 'file') as 'travail' | 'historique' | undefined,
    client_id: qInt(req, 'client_id'),
    page: qInt(req, 'page'),
    limit: qInt(req, 'limit'),
    tri: qStr(req, 'tri') as 'recent' | 'priorite' | 'ancien' | undefined,
  });
  res.json(result);
});

dossiersRouter.post('/', requireRole('admin', 'preparateur'), async (req, res) => {
  const d = await svc.creerDossier(me(req), req.body);
  res.status(201).json(await svc.detailDossier(me(req), d.id));
});

dossiersRouter.post('/:id/dupliquer', requireRole('admin', 'preparateur'), async (req, res) => {
  res.status(201).json(await svc.dupliquerDossier(me(req), intParam(req), req.body));
});

dossiersRouter.get('/:id', async (req, res) => {
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.patch('/:id', requireRole('admin', 'preparateur'), async (req, res) => {
  await svc.modifierDossier(me(req), intParam(req), req.body);
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.delete('/:id', requireRole('admin', 'preparateur'), async (req, res) => {
  const motif = typeof req.body?.motif === 'string' ? req.body.motif.slice(0, 500) : null;
  await svc.supprimerDossier(me(req), intParam(req), motif);
  res.status(204).end();
});

dossiersRouter.post('/:id/restaurer', requireRole('admin'), async (req, res) => {
  await svc.restaurerDossier(me(req), intParam(req));
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.post('/:id/actions/:action', async (req, res) => {
  const input = actionInputSchema.parse(req.body ?? {});
  await svc.executerAction(me(req), intParam(req), String(req.params.action), input);
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.post('/:id/forcer-statut', requireRole('admin'), async (req, res) => {
  const body = z.object({ statut: z.string(), commentaire: z.string().max(2000) }).parse(req.body);
  await svc.forcerStatut(me(req), intParam(req), body.statut, body.commentaire);
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.post('/:id/reporter', requireRole('admin', 'livreur'), async (req, res) => {
  const body = z.object({ date_prevue: z.string().min(10), motif: z.string().max(500).nullable().optional() }).parse(req.body);
  await svc.reporterLivraison(me(req), intParam(req), body.date_prevue, body.motif ?? null);
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.post('/:id/urgence', requireRole('admin', 'preparateur'), async (req, res) => {
  const body = z.object({ urgent: z.boolean() }).parse(req.body);
  await svc.definirUrgence(me(req), intParam(req), body.urgent);
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.post('/:id/affecter', requireRole('admin'), async (req, res) => {
  const body = z
    .object({ imprimeur_id: z.number().int().positive().nullable().optional(), livreur_id: z.number().int().positive().nullable().optional() })
    .parse(req.body);
  await svc.affecter(me(req), intParam(req), body);
  res.json(await svc.detailDossier(me(req), intParam(req)));
});

dossiersRouter.post('/:id/commentaires', async (req, res) => {
  const body = z.object({ texte: z.string().min(2).max(2000) }).parse(req.body);
  await svc.commenter(me(req), intParam(req), body.texte);
  res.status(201).json(await svc.detailDossier(me(req), intParam(req)));
});
