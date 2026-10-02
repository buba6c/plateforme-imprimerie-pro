// Paiements : encaissement sur un dossier, validation ou refus par l'administrateur,
// liste filtrée par rôle et état de la caisse.
//
// Règles :
// - un administrateur qui encaisse crée un paiement validé d'office ; préparateur et livreur
//   créent un paiement « à valider » (voir enregistrerPaiement dans le module dossiers) ;
// - le total des paiements validés d'un dossier ne dépasse jamais son montant : contrôlé à
//   l'encaissement (validés + en attente) et de nouveau à la validation ;
// - un paiement validé ou refusé ne change plus d'état.

import { Router } from 'express';
import { formatFCFA, MODE_PAIEMENT_LABELS, MODES_PAIEMENT, paiementInputSchema, STATUTS_PAIEMENT, type ModePaiement } from '@evocom/shared';
import { getPool, one, query, tx, type Db } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam, qInt, qList } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { notifier, signalPaiement } from '../../realtime';
import { chargerDossier, enregistrerPaiement, evenement } from '../dossiers/service';
import { Conditions, filtrePeriode, intervalle, pagination } from '../commun/requete';

const SELECT_PAIEMENT = `
  SELECT p.id, p.dossier_id, d.numero, d.client_nom, p.montant, p.mode, p.reference, p.statut, p.notes,
         p.encaisse_par, ue.nom AS encaisse_par_nom, p.encaisse_at,
         p.valide_par, uv.nom AS valide_par_nom, p.valide_at, p.motif_refus,
         (d.deleted_at IS NOT NULL) AS dossier_supprime
  FROM paiements p
  JOIN dossiers d ON d.id = p.dossier_id
  LEFT JOIN users ue ON ue.id = p.encaisse_par
  LEFT JOIN users uv ON uv.id = p.valide_par`;

export async function chargerPaiement(id: number, db?: Db) {
  const p = await one(`${SELECT_PAIEMENT} WHERE p.id = $1`, [id], db);
  if (!p) throw notFound("Ce paiement n'existe pas.");
  return p;
}

// ---------------------------------------------------------------------------
// /api/paiements

export const paiementsRouter = Router();
paiementsRouter.use(requireAuth);

paiementsRouter.get('/', requireRole('admin', 'preparateur', 'livreur'), async (req, res) => {
  const user = me(req);
  const params = await getParametres();
  const { page, limit, offset } = pagination(req, 50, 200);
  const { from, to } = intervalle(req);
  const c = new Conditions();
  if (user.role !== 'admin') {
    c.add('p.encaisse_par = ?', user.id);
  } else {
    const livreurId = qInt(req, 'livreur_id') ?? qInt(req, 'encaisse_par');
    if (livreurId) c.add('p.encaisse_par = ?', livreurId);
  }
  const statuts = qList(req, 'statut');
  if (statuts?.length) {
    const inconnus = statuts.filter((s) => !(STATUTS_PAIEMENT as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Statut de paiement inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${STATUTS_PAIEMENT.join(', ')}.`);
    c.add('p.statut = ANY(?)', statuts);
  }
  const modes = qList(req, 'mode');
  if (modes?.length) {
    const inconnus = modes.filter((s) => !(MODES_PAIEMENT as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Mode de paiement inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${MODES_PAIEMENT.join(', ')}.`);
    c.add('p.mode = ANY(?)', modes);
  }
  const dossierId = qInt(req, 'dossier_id');
  if (dossierId) c.add('p.dossier_id = ?', dossierId);
  filtrePeriode(c, 'p.encaisse_at', params.fuseau, from, to);

  const agg = await one<{ n: number; somme: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(p.montant), 0)::bigint AS somme FROM paiements p ${c.where}`,
    c.args,
  );
  const items = await query(`${SELECT_PAIEMENT} ${c.where} ORDER BY p.encaisse_at DESC, p.id DESC LIMIT ${limit} OFFSET ${offset}`, c.args);
  res.json({ items, total: agg?.n ?? 0, somme: agg?.somme ?? 0, page, limit });
});

paiementsRouter.post('/:id/valider', requireRole('admin'), async (req, res) => {
  const admin = me(req);
  const id = intParam(req);
  const r = await tx(async (db) => {
    const p = await one<{ id: number; dossier_id: number; montant: number; mode: ModePaiement; statut: string; encaisse_par: number | null }>(
      `SELECT id, dossier_id, montant, mode, statut, encaisse_par FROM paiements WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!p) throw notFound("Ce paiement n'existe pas.");
    if (p.statut === 'valide') throw conflict('Ce paiement est déjà validé.');
    if (p.statut !== 'a_valider') throw conflict('Ce paiement a été refusé : il ne peut plus être validé. Faites saisir un nouvel encaissement.');
    // Le dossier est verrouillé pour que deux validations simultanées ne dépassent pas son montant.
    const d = await one<{ id: number; numero: string; client_nom: string; montant: number | null }>(
      `SELECT id, numero, client_nom, montant FROM dossiers WHERE id = $1 FOR UPDATE`,
      [p.dossier_id],
      db,
    );
    if (!d) throw notFound("Le dossier de ce paiement n'existe plus.");
    const deja = await one<{ s: number }>(
      `SELECT coalesce(sum(montant), 0)::bigint AS s FROM paiements WHERE dossier_id = $1 AND statut = 'valide'`,
      [d.id],
      db,
    );
    const dejaPaye = deja?.s ?? 0;
    if (d.montant !== null && dejaPaye + p.montant > d.montant) {
      throw conflict(
        `Valider ce paiement de ${formatFCFA(p.montant)} porterait le total encaissé à ${formatFCFA(dejaPaye + p.montant)} pour un dossier de ${formatFCFA(d.montant)}. Refusez-le, ou corrigez d'abord le montant du dossier.`,
        { deja_paye: dejaPaye, montant_dossier: d.montant },
      );
    }
    await query(`UPDATE paiements SET statut = 'valide', valide_par = $2, valide_at = now(), motif_refus = NULL WHERE id = $1`, [id, admin.id], db);
    await evenement(db, d.id, admin.id, { type: 'paiement', action: 'valide', data: { paiement_id: id, montant: p.montant, mode: p.mode } });
    await journal(req, 'paiement_valide', 'paiement', id, { dossier_id: d.id, numero: d.numero, montant: p.montant, mode: p.mode }, db);
    return { p, d };
  });
  signalPaiement(r.d.id);
  if (r.p.encaisse_par && r.p.encaisse_par !== admin.id) {
    await notifier(
      getPool(),
      { userIds: [r.p.encaisse_par] },
      {
        type: 'paiement_valide',
        titre: `Paiement validé : ${r.d.numero}`,
        message: `${formatFCFA(r.p.montant)} en ${MODE_PAIEMENT_LABELS[r.p.mode]} · ${r.d.client_nom}`,
        dossier_id: r.d.id,
      },
    ).catch(() => {});
  }
  res.json(await chargerPaiement(id));
});

paiementsRouter.post('/:id/refuser', requireRole('admin'), async (req, res) => {
  const admin = me(req);
  const id = intParam(req);
  const motif = typeof req.body?.motif === 'string' ? req.body.motif.trim() : '';
  if (motif.length < 3) {
    throw badRequest('Indiquez le motif du refus (3 caractères au moins) : il est transmis à la personne qui a encaissé.', {
      champs: { motif: 'Motif obligatoire' },
    });
  }
  if (motif.length > 500) throw badRequest('Le motif du refus est trop long (500 caractères au maximum).');
  const r = await tx(async (db) => {
    const p = await one<{ id: number; dossier_id: number; montant: number; mode: ModePaiement; statut: string; encaisse_par: number | null }>(
      `SELECT id, dossier_id, montant, mode, statut, encaisse_par FROM paiements WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!p) throw notFound("Ce paiement n'existe pas.");
    if (p.statut === 'refuse') throw conflict('Ce paiement est déjà refusé.');
    if (p.statut !== 'a_valider') throw conflict('Ce paiement est déjà validé : il ne peut plus être refusé.');
    const d = await one<{ id: number; numero: string; client_nom: string }>(`SELECT id, numero, client_nom FROM dossiers WHERE id = $1`, [p.dossier_id], db);
    await query(`UPDATE paiements SET statut = 'refuse', motif_refus = $2, valide_par = $3, valide_at = now() WHERE id = $1`, [id, motif, admin.id], db);
    await evenement(db, p.dossier_id, admin.id, {
      type: 'paiement',
      action: 'refuse',
      commentaire: motif,
      data: { paiement_id: id, montant: p.montant, mode: p.mode },
    });
    await journal(req, 'paiement_refuse', 'paiement', id, { dossier_id: p.dossier_id, montant: p.montant, motif }, db);
    return { p, d: d! };
  });
  signalPaiement(r.d.id);
  if (r.p.encaisse_par && r.p.encaisse_par !== admin.id) {
    await notifier(
      getPool(),
      { userIds: [r.p.encaisse_par] },
      { type: 'paiement_refuse', titre: `Paiement refusé : ${r.d.numero}`, message: `${formatFCFA(r.p.montant)} · ${motif}`, dossier_id: r.d.id },
    ).catch(() => {});
  }
  res.json(await chargerPaiement(id));
});

// ---------------------------------------------------------------------------
// /api/dossiers/:id/paiements (monté sur /api/dossiers après le routeur des dossiers :
// aucune route de ce dernier ne correspond à ce chemin, il n'y a donc pas de masquage)

export const dossierPaiementsRouter = Router();

dossierPaiementsRouter.post('/:id/paiements', requireAuth, requireRole('admin', 'preparateur', 'livreur'), async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const input = paiementInputSchema.parse(req.body ?? {});
  const paiementId = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    // Sommes relues après la prise du verrou : un encaissement concurrent sur le même dossier,
    // validé entre-temps, est ainsi compté dans le reste à payer.
    const sommes = await one<{ deja_paye: number; en_attente_validation: number }>(
      `SELECT coalesce(sum(montant) FILTER (WHERE statut = 'valide'), 0)::int AS deja_paye,
              coalesce(sum(montant) FILTER (WHERE statut = 'a_valider'), 0)::int AS en_attente_validation
       FROM paiements WHERE dossier_id = $1`,
      [id],
      db,
    );
    return enregistrerPaiement(db, user, { ...d, ...sommes! }, {
      montant: input.montant,
      mode: input.mode,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    });
  });
  signalPaiement(id);
  res.status(201).json(await chargerPaiement(paiementId));
});

// ---------------------------------------------------------------------------
// /api/caisse : ce que chaque encaisseur détient (à valider) et ce qui a été validé aujourd'hui.

export const caisseRouter = Router();
caisseRouter.use(requireAuth, requireRole('admin'));

caisseRouter.get('/', async (_req, res) => {
  const params = await getParametres();
  const tz = params.fuseau;
  const debutJour = `(date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)`;
  const colonnes = `
    count(*) FILTER (WHERE p.statut = 'a_valider')::int AS av_n,
    coalesce(sum(p.montant) FILTER (WHERE p.statut = 'a_valider'), 0)::bigint AS av_s,
    count(*) FILTER (WHERE p.statut = 'valide' AND p.valide_at >= ${debutJour})::int AS vj_n,
    coalesce(sum(p.montant) FILTER (WHERE p.statut = 'valide' AND p.valide_at >= ${debutJour}), 0)::bigint AS vj_s`;
  const filtre = `WHERE p.statut = 'a_valider' OR (p.statut = 'valide' AND p.valide_at >= ${debutJour})`;
  const parUser = await query<{ user_id: number | null; nom: string | null; role: string | null; av_n: number; av_s: number; vj_n: number; vj_s: number }>(
    `SELECT p.encaisse_par AS user_id, u.nom, u.role, ${colonnes}
     FROM paiements p LEFT JOIN users u ON u.id = p.encaisse_par
     ${filtre}
     GROUP BY p.encaisse_par, u.nom, u.role
     ORDER BY av_s DESC, vj_s DESC, u.nom`,
    [tz],
  );
  const parMode = await query<{ mode: ModePaiement; av_n: number; av_s: number; vj_n: number; vj_s: number }>(
    `SELECT p.mode, ${colonnes} FROM paiements p ${filtre} GROUP BY p.mode ORDER BY p.mode`,
    [tz],
  );
  const bloc = (n: number, somme: number) => ({ n, somme });
  const tot = parUser.reduce(
    (acc, r) => ({ av_n: acc.av_n + r.av_n, av_s: acc.av_s + r.av_s, vj_n: acc.vj_n + r.vj_n, vj_s: acc.vj_s + r.vj_s }),
    { av_n: 0, av_s: 0, vj_n: 0, vj_s: 0 },
  );
  res.json({
    par_encaisseur: parUser.map((r) => ({
      user_id: r.user_id,
      nom: r.nom ?? 'Encaisseur inconnu (données importées)',
      role: r.role,
      a_valider: bloc(r.av_n, r.av_s),
      valide_aujourdhui: bloc(r.vj_n, r.vj_s),
    })),
    par_mode: parMode.map((r) => ({
      mode: r.mode,
      libelle: MODE_PAIEMENT_LABELS[r.mode] ?? r.mode,
      a_valider: bloc(r.av_n, r.av_s),
      valide_aujourdhui: bloc(r.vj_n, r.vj_s),
    })),
    totaux: { a_valider: bloc(tot.av_n, tot.av_s), valide_aujourdhui: bloc(tot.vj_n, tot.vj_s) },
  });
});
