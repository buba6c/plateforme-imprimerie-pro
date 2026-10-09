// Routes du module WhatsApp : administrateur seulement, actions journalisées.
// Jamais de contenu d'authentification (identifiants, clés) dans les réponses : seulement l'état.

import { Router } from 'express';
import { z } from 'zod';
import { getPool, one, query, tx } from '../../db/pool';
import { journal } from '../../lib/audit';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors';
import { intParam, qInt, qStr } from '../../lib/http';
import { connecter, deconnecter, etatConnexion } from './connexion';
import type { Entrant } from './entrants';
import { compteursFile, planifierTest, type MessageWhatsApp } from './file';
import { VARIABLES_EXEMPLE, rendreModele } from './modeles';
import {
  ecrireParametresWhatsApp,
  EVENEMENT_LABELS,
  fusionnerParametresWhatsApp,
  getParametresWhatsApp,
  invalidateParametresWhatsApp,
  PARAMETRES_WHATSAPP_DEFAUT,
  parametresWhatsAppSchema,
  VARIABLES_MODELE,
} from './parametres';
import { normaliserTelephone } from './telephone';

export const whatsappRouter = Router();
whatsappRouter.use(requireAuth, requireRole('admin'));

const STATUTS = ['en_attente', 'envoye', 'echec', 'annule', 'ignore'] as const;

async function statut() {
  const [p, file] = await Promise.all([getParametresWhatsApp(), compteursFile()]);
  return { actif: p.actif, ...etatConnexion(), file };
}

whatsappRouter.get('/statut', async (_req, res) => {
  res.json(await statut());
});

whatsappRouter.post('/connecter', async (req, res) => {
  await journal(req, 'whatsapp_connexion', 'whatsapp', null);
  await connecter({ parUtilisateur: true });
  res.json(await statut());
});

whatsappRouter.post('/deconnecter', async (req, res) => {
  await journal(req, 'whatsapp_deconnexion', 'whatsapp', null);
  await deconnecter();
  res.json(await statut());
});

const testSchema = z.object({ telephone: z.string({ required_error: 'Indiquez le numéro.' }).trim().min(1, 'Indiquez le numéro.').max(40) });

whatsappRouter.post('/test', async (req, res) => {
  const { telephone } = testSchema.parse(req.body ?? {});
  const r = await planifierTest(telephone);
  if (r.erreur || !r.message) throw unprocessable(r.erreur ?? 'Message de test impossible.', { champs: { telephone: r.erreur } });
  await journal(req, 'whatsapp_test', 'whatsapp_message', r.message.id, { telephone: r.message.telephone });
  res.status(201).json(presenter({ ...r.message, numero: null, client_nom: null }));
});

type Ligne = MessageWhatsApp & { numero: string | null; client_nom: string | null };

function presenter(m: Ligne) {
  return {
    id: m.id,
    dossier_id: m.dossier_id,
    numero: m.numero,
    client_nom: m.client_nom,
    evenement: m.evenement,
    evenement_label: EVENEMENT_LABELS[m.evenement] ?? m.evenement,
    telephone: m.telephone,
    texte: m.texte,
    statut: m.statut,
    motif: m.motif,
    tentatives: m.tentatives,
    planifie_at: m.planifie_at,
    envoye_at: m.envoye_at,
    created_at: m.created_at,
  };
}

const SELECT_MESSAGE = `SELECT m.*, d.numero, d.client_nom FROM whatsapp_messages m LEFT JOIN dossiers d ON d.id = m.dossier_id`;

whatsappRouter.get('/messages', async (req, res) => {
  const statutFiltre = qStr(req, 'statut');
  if (statutFiltre && !(STATUTS as readonly string[]).includes(statutFiltre)) throw badRequest('Statut inconnu.');
  const q = qStr(req, 'q');
  const page = Math.max(1, qInt(req, 'page') ?? 1);
  const limit = Math.min(100, Math.max(1, qInt(req, 'limit') ?? 50));
  const where: string[] = [];
  const params: unknown[] = [];
  if (statutFiltre) {
    params.push(statutFiltre);
    where.push(`m.statut = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.replace(/[\s.\-]/g, '')}%`, `%${q}%`);
    where.push(`(replace(replace(coalesce(m.telephone, ''), ' ', ''), '+', '') ILIKE replace($${params.length - 1}, '+', '') OR d.numero ILIKE $${params.length} OR d.client_nom ILIKE $${params.length})`);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const [items, total, compteurs] = await Promise.all([
    query<Ligne>(`${SELECT_MESSAGE}${clause} ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
    one<{ n: number }>(`SELECT count(*)::int AS n FROM whatsapp_messages m LEFT JOIN dossiers d ON d.id = m.dossier_id${clause}`, params),
    query<{ statut: string; n: number }>(`SELECT statut, count(*)::int AS n FROM whatsapp_messages GROUP BY statut`),
  ]);
  res.json({
    items: items.map(presenter),
    total: total?.n ?? 0,
    page,
    limit,
    compteurs: Object.fromEntries(STATUTS.map((s) => [s, compteurs.find((c) => c.statut === s)?.n ?? 0])),
  });
});

whatsappRouter.post('/messages/:id/reessayer', async (req, res) => {
  const id = intParam(req);
  const m = await tx(async (db) => {
    const m = await one<Ligne>(`${SELECT_MESSAGE} WHERE m.id = $1 FOR UPDATE OF m`, [id], db);
    if (!m) throw notFound('Message introuvable.');
    if (m.statut === 'en_attente') throw conflict('Ce message est déjà en attente d’envoi.');
    if (m.statut === 'envoye') throw conflict('Ce message a déjà été envoyé.');
    const tel = normaliserTelephone(m.telephone);
    if (!tel) throw unprocessable(`Numéro invalide : « ${m.telephone ?? ''} ». Corrigez le téléphone du client sur le dossier.`);
    if (await one(`SELECT 1 FROM whatsapp_optout WHERE telephone = $1`, [tel.e164], db)) throw conflict(`Le numéro ${tel.affichage} est en liste STOP : retirez-le d’abord.`);
    if (!(await getParametresWhatsApp(db)).actif) throw conflict('Activez d’abord les messages WhatsApp dans les réglages.');
    const r = await one<Ligne>(
      `UPDATE whatsapp_messages SET statut = 'en_attente', tentatives = 0, motif = NULL, planifie_at = now(), telephone = $2 WHERE id = $1 RETURNING *`,
      [id, tel.e164],
      db,
    );
    await journal(req, 'whatsapp_reessai', 'whatsapp_message', id, { telephone: tel.e164, evenement: m.evenement }, db);
    return { ...m, ...r! };
  });
  res.json(presenter(m));
});

whatsappRouter.post('/messages/:id/annuler', async (req, res) => {
  const id = intParam(req);
  const m = await tx(async (db) => {
    const m = await one<Ligne>(`${SELECT_MESSAGE} WHERE m.id = $1 FOR UPDATE OF m`, [id], db);
    if (!m) throw notFound('Message introuvable.');
    if (m.statut !== 'en_attente') throw conflict('Seul un message en attente peut être annulé.');
    const r = await one<Ligne>(`UPDATE whatsapp_messages SET statut = 'annule', motif = $2 WHERE id = $1 RETURNING *`, [id, `Annulé par ${me(req).nom}`], db);
    await journal(req, 'whatsapp_annulation', 'whatsapp_message', id, { evenement: m.evenement }, db);
    return { ...m, ...r! };
  });
  res.json(presenter(m));
});

whatsappRouter.get('/optout', async (_req, res) => {
  res.json(await query(`SELECT telephone, motif, created_at FROM whatsapp_optout ORDER BY created_at DESC`));
});

whatsappRouter.delete('/optout/:telephone', async (req, res) => {
  const tel = normaliserTelephone(decodeURIComponent(String(req.params.telephone ?? '')));
  if (!tel) throw badRequest('Numéro invalide.');
  const r = await one(`DELETE FROM whatsapp_optout WHERE telephone = $1 RETURNING telephone`, [tel.e164]);
  if (!r) throw notFound('Ce numéro n’est pas en liste STOP.');
  await journal(req, 'whatsapp_optout_retire', 'whatsapp_optout', tel.e164);
  res.status(204).end();
});

whatsappRouter.get('/entrants', async (req, res) => {
  const page = Math.max(1, qInt(req, 'page') ?? 1);
  const limit = 50;
  const [items, total] = await Promise.all([
    query<Entrant>(`SELECT id, telephone, texte, recu_at FROM whatsapp_entrants ORDER BY recu_at DESC, id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    one<{ n: number }>(`SELECT count(*)::int AS n FROM whatsapp_entrants`),
  ]);
  res.json({ items, total: total?.n ?? 0, page, limit });
});

// ---------------------------------------------------------------------------
// Réglages : section « whatsapp » de la table parametres, servie sous /api/parametres/whatsapp.

export const whatsappParametresRouter = Router();
whatsappParametresRouter.use(requireAuth, requireRole('admin'));

function reponseParametres(p: Awaited<ReturnType<typeof getParametresWhatsApp>>) {
  return {
    ...p,
    defauts: PARAMETRES_WHATSAPP_DEFAUT,
    variables: VARIABLES_MODELE,
    evenements: EVENEMENT_LABELS,
    apercu: Object.fromEntries(Object.entries(p.modeles).map(([e, m]) => [e, rendreModele(m, VARIABLES_EXEMPLE, p.signature)])),
  };
}

whatsappParametresRouter.get('/whatsapp', async (_req, res) => {
  res.json(reponseParametres(await getParametresWhatsApp()));
});

whatsappParametresRouter.put('/whatsapp', async (req, res) => {
  const input = parametresWhatsAppSchema.parse(req.body ?? {});
  invalidateParametresWhatsApp();
  const avant = await getParametresWhatsApp();
  const { apres, erreurs } = fusionnerParametresWhatsApp(avant, input);
  if (Object.keys(erreurs).length) throw badRequest('Certains réglages sont incohérents.', { champs: erreurs });
  if (JSON.stringify(avant) !== JSON.stringify(apres)) {
    await tx(async (db) => {
      await ecrireParametresWhatsApp(db, apres, me(req).id);
      await journal(req, 'whatsapp_parametres_modifies', 'parametres', 'whatsapp', { avant, apres }, db);
    });
  }
  invalidateParametresWhatsApp();
  res.json(reponseParametres(await getParametresWhatsApp(getPool())));
});
