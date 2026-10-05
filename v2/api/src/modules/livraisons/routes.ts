// Planning et historique des livraisons.
//
// Droits, appliqués dans les requêtes :
// - livreur : les livraisons en cours qui lui reviennent (les siennes et celles programmées sans
//   livreur désigné, comme sa tournée), celles qu'il a effectuées, et les dossiers prêts à livrer
//   (visibles par tous les livreurs). Le planning reste soumis à la règle commune de visibilité
//   (dossiers/access.ts). L'historique va au-delà de cette fenêtre mais ne renvoie que le strict
//   nécessaire : ni téléphone, ni prix, ni fichiers ;
// - admin : tout, avec un filtre `livreur_id` facultatif.
// Les jours AAAA-MM-JJ sont ceux du calendrier de l'entreprise (paramètre `fuseau`).

import { Router, type Request } from 'express';
import {
  actionsDisponibles,
  MODE_PAIEMENT_LABELS,
  MODES_PAIEMENT,
  STATUT_LABELS,
  type Machine,
  type ModePaiement,
  type Statut,
  type StatutPaiement,
} from '@evocom/shared';
import { one, query } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { badRequest } from '../../lib/errors';
import { qInt, qStr } from '../../lib/http';
import { getParametres } from '../../lib/params';
import type { AuthUser } from '../../types';
import { visibilite } from '../dossiers/access';
import { aujourdhui, Conditions, filtrePeriode, motifLike, qDate } from '../commun/requete';

export const livraisonsRouter = Router();
// Seuls ces deux rôles voient les montants et les coordonnées des clients (dossiers/access.ts).
livraisonsRouter.use(requireAuth, requireRole('admin', 'livreur'));

const PERIODE_MAX_JOURS = 62;

/** Livreur concerné : soi-même pour un livreur ; pour l'admin, le filtre `livreur_id` s'il est donné. */
function livreurCible(req: Request, user: AuthUser): number | null {
  if (user.role === 'livreur') return user.id;
  const v = qStr(req, 'livreur_id');
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Le filtre « livreur_id » doit être le numéro d’un livreur.');
  return n;
}

/** Conditions qui commencent par la règle de visibilité des dossiers (alias `d`). */
function visibles(user: AuthUser, joursLivreur: number): Conditions {
  const c = new Conditions();
  const vis = visibilite(user, 0, joursLivreur);
  c.parts.push(vis.sql);
  c.args.push(...vis.params);
  return c;
}

/** Livraisons en cours qui reviennent au livreur (les siennes et celles sans livreur désigné). */
function enCoursPour(c: Conditions, user: AuthUser, livreurId: number | null): string {
  if (user.role === 'livreur') return `(d.livreur_id = ${c.param(user.id)} OR d.livreur_id IS NULL)`;
  return livreurId ? `d.livreur_id = ${c.param(livreurId)}` : 'true';
}

// ---------------------------------------------------------------------------
// Planning

/** Moment qui place la livraison dans le planning : livraison effective, sinon prévue. */
const MOMENT = `(CASE WHEN d.statut IN ('livre','termine') THEN d.livre_at ELSE d.livraison_prevue_at END)`;

function selectPlanning(tz: string): string {
  return `
  SELECT d.id, d.numero, d.statut, d.machine, d.preparateur_id, d.urgent,
         d.client_nom, d.client_telephone, d.adresse_livraison, d.notes_livraison,
         d.date_promise, d.livraison_prevue_at, d.livre_at, d.livreur_id, liv.nom AS livreur_nom,
         d.montant, d.mode_paiement_prevu,
         coalesce(pa.deja_paye, 0)::int AS deja_paye,
         coalesce(pa.en_attente, 0)::int AS en_attente_validation,
         (SELECT count(*)::int FROM fichiers f WHERE f.dossier_id = d.id AND f.deleted_at IS NULL) AS nb_fichiers,
         (SELECT count(*)::int FROM dossier_events e WHERE e.dossier_id = d.id AND e.type = 'livraison' AND e.action = 'reporter') AS nb_reports,
         to_char(${MOMENT} AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS jour,
         to_char(${MOMENT} AT TIME ZONE ${tz}, 'HH24:MI') AS heure
  FROM dossiers d
  LEFT JOIN users liv ON liv.id = d.livreur_id
  LEFT JOIN LATERAL (
    SELECT sum(p.montant) FILTER (WHERE p.statut = 'valide') AS deja_paye,
           sum(p.montant) FILTER (WHERE p.statut = 'a_valider') AS en_attente
    FROM paiements p WHERE p.dossier_id = d.id
  ) pa ON true`;
}

interface LignePlanning {
  id: number;
  numero: string;
  statut: Statut;
  machine: Machine;
  preparateur_id: number | null;
  urgent: boolean;
  client_nom: string;
  client_telephone: string | null;
  adresse_livraison: string | null;
  notes_livraison: string | null;
  date_promise: string | null;
  livraison_prevue_at: Date | null;
  livre_at: Date | null;
  livreur_id: number | null;
  livreur_nom: string | null;
  montant: number | null;
  mode_paiement_prevu: ModePaiement | null;
  deja_paye: number;
  en_attente_validation: number;
  nb_fichiers: number;
  nb_reports: number;
  jour: string | null;
  heure: string | null;
}

function presenterPlanning(r: LignePlanning, user: AuthUser) {
  const { machine: _machine, preparateur_id: _preparateur, ...champs } = r;
  const solde = r.montant === null ? null : Math.max(0, r.montant - r.deja_paye);
  return {
    ...champs,
    statut_label: STATUT_LABELS[r.statut],
    solde,
    // Ce que le livreur doit encore récupérer : le solde moins ce qui attend déjà la validation.
    reste_a_encaisser: solde === null ? null : Math.max(0, solde - r.en_attente_validation),
    actions: actionsDisponibles(user, r).map((a) => a.id),
  };
}

function nbJours(debut: string, fin: string): number {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000) + 1;
}

livraisonsRouter.get('/planning', async (req, res) => {
  const user = me(req);
  const params = await getParametres();
  const tz = params.fuseau;
  const fenetre = params.livreur_jours_historique;
  const debut = qDate(req, 'debut');
  const fin = qDate(req, 'fin');
  if (!debut || !fin) {
    throw badRequest('Indiquez la période avec « debut » et « fin » au format AAAA-MM-JJ (par exemple debut=2026-10-05&fin=2026-10-11).');
  }
  if (debut > fin) throw badRequest('La date de début est postérieure à la date de fin : inversez-les.');
  const jours = nbJours(debut, fin);
  if (jours > PERIODE_MAX_JOURS) {
    throw badRequest(`La période demandée couvre ${jours} jours : ${PERIODE_MAX_JOURS} jours au maximum. Réduisez-la.`);
  }
  const livreurId = livreurCible(req, user);
  const auj = aujourdhui(tz);

  // Livraisons de la période : en cours (date prévue) et effectuées (date de livraison).
  const c = visibles(user, fenetre);
  const tzP = c.param(tz);
  const de = `(${c.param(debut)}::date::timestamp AT TIME ZONE ${tzP})`;
  const a = `((${c.param(fin)}::date + 1)::timestamp AT TIME ZONE ${tzP})`;
  const effectueesPar = livreurId ? `d.livreur_id = ${c.param(livreurId)}` : 'true';
  c.parts.push(`(
    (d.statut = 'en_livraison' AND d.livraison_prevue_at >= ${de} AND d.livraison_prevue_at < ${a} AND ${enCoursPour(c, user, livreurId)})
    OR (d.statut IN ('livre','termine') AND d.livre_at >= ${de} AND d.livre_at < ${a} AND ${effectueesPar})
  )`);
  const items = await query<LignePlanning>(`${selectPlanning(tzP)} ${c.where} ORDER BY ${MOMENT}, d.id`, c.args);

  // Livraisons en cours dont la date prévue est passée, quelle que soit la période affichée.
  const r = visibles(user, fenetre);
  const tzR = r.param(tz);
  r.parts.push(
    `d.statut = 'en_livraison'`,
    `d.livraison_prevue_at < (${r.param(auj)}::date::timestamp AT TIME ZONE ${tzR})`,
    enCoursPour(r, user, livreurId),
  );
  const enRetard = await query<LignePlanning>(`${selectPlanning(tzR)} ${r.where} ORDER BY d.livraison_prevue_at, d.id LIMIT 200`, r.args);

  // Prêts à livrer, à programmer : visibles par tous les livreurs (règle commune).
  const p = visibles(user, fenetre);
  const tzA = p.param(tz);
  p.parts.push(`d.statut = 'pret_livraison'`);
  const aProgrammer = await query<LignePlanning>(
    `${selectPlanning(tzA)} ${p.where}
     ORDER BY d.urgent DESC, d.date_promise ASC NULLS LAST, d.date_fin_impression ASC NULLS LAST, d.id
     LIMIT 200`,
    p.args,
  );

  res.json({
    debut,
    fin,
    aujourdhui: auj,
    fuseau: tz,
    livreur_id: livreurId,
    jours_historique: fenetre,
    items: items.map((i) => presenterPlanning(i, user)),
    en_retard: enRetard.map((i) => presenterPlanning(i, user)),
    a_programmer: aProgrammer.map((i) => presenterPlanning(i, user)),
  });
});

// ---------------------------------------------------------------------------
// Historique

interface EncaissementLivreur {
  id: number;
  montant: number;
  mode: ModePaiement;
  statut: StatutPaiement;
  encaisse_at: string;
  motif_refus: string | null;
}

livraisonsRouter.get('/historique', async (req, res) => {
  const user = me(req);
  const params = await getParametres();
  const du = qDate(req, 'du');
  const au = qDate(req, 'au');
  if (du && au && du > au) throw badRequest('La date « du » est postérieure à la date « au » : inversez-les.');
  const mode = qStr(req, 'mode_paiement');
  if (mode && !(MODES_PAIEMENT as readonly string[]).includes(mode)) {
    throw badRequest(`Mode de paiement inconnu : ${mode}. Valeurs possibles : ${MODES_PAIEMENT.join(', ')}.`);
  }
  const page = Math.max(qInt(req, 'page') ?? 1, 1);
  const taille = Math.min(Math.max(qInt(req, 'taille') ?? 25, 1), 100);
  const livreurId = livreurCible(req, user);

  // Livraisons effectuées ; un livreur ne voit que les siennes, sans limite de durée.
  const c = new Conditions().add('d.deleted_at IS NULL').add(`d.statut IN ('livre','termine')`).add('d.livre_at IS NOT NULL');
  if (livreurId) c.add('d.livreur_id = ?', livreurId);
  filtrePeriode(c, 'd.livre_at', params.fuseau, du, au);
  const q = qStr(req, 'q');
  if (q) c.add(`lower(d.numero || ' ' || d.client_nom || ' ' || coalesce(d.adresse_livraison, '')) LIKE ?`, motifLike(q.slice(0, 100)));
  // Encaissements retenus : ceux du livreur de la livraison (et du mode demandé).
  let duMode = '';
  if (mode) {
    duMode = ` AND p.mode = ${c.param(mode)}`;
    c.parts.push(`EXISTS (SELECT 1 FROM paiements p WHERE p.dossier_id = d.id AND p.encaisse_par = d.livreur_id${duMode})`);
  }
  const duLivreur = `p.dossier_id = d.id AND p.encaisse_par = d.livreur_id${duMode}`;

  const total = await one<{ n: number }>(`SELECT count(*)::int AS n FROM dossiers d ${c.where}`, c.args);
  const sommes = await query<{ mode: ModePaiement; statut: StatutPaiement; n: number; somme: number }>(
    `SELECT p.mode, p.statut, count(*)::int AS n, coalesce(sum(p.montant), 0)::bigint AS somme
     FROM dossiers d JOIN paiements p ON ${duLivreur}
     ${c.where}
     GROUP BY p.mode, p.statut`,
    c.args,
  );
  // La fiche du dossier n'est ouverte au livreur que pendant la fenêtre de la liste principale.
  const args = [...c.args];
  const ficheAccessible =
    user.role === 'livreur' ? `d.livre_at > now() - make_interval(days => $${args.push(params.livreur_jours_historique)}::int)` : 'true';
  const lignes = await query<{
    id: number;
    numero: string;
    client_nom: string;
    adresse_livraison: string | null;
    livre_at: Date;
    livreur_id: number | null;
    livreur_nom: string | null;
    fiche_accessible: boolean;
    encaissements: EncaissementLivreur[];
  }>(
    `SELECT d.id, d.numero, d.client_nom, d.adresse_livraison, d.livre_at, d.livreur_id, liv.nom AS livreur_nom,
            ${ficheAccessible} AS fiche_accessible,
            coalesce(enc.lignes, '[]'::json) AS encaissements
     FROM dossiers d
     LEFT JOIN users liv ON liv.id = d.livreur_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object('id', p.id, 'montant', p.montant, 'mode', p.mode, 'statut', p.statut,
                                         'encaisse_at', p.encaisse_at, 'motif_refus', p.motif_refus)
                       ORDER BY p.encaisse_at, p.id) AS lignes
       FROM paiements p WHERE ${duLivreur}
     ) enc ON true
     ${c.where}
     ORDER BY d.livre_at DESC, d.id DESC
     LIMIT ${taille} OFFSET ${(page - 1) * taille}`,
    args,
  );

  const parMode = new Map<ModePaiement, { nb: number; montant: number; valide: number; en_attente_validation: number }>();
  const totaux = { encaisse: 0, valide: 0, en_attente_validation: 0, refuse: 0 };
  for (const s of sommes) {
    if (s.statut === 'refuse') {
      totaux.refuse += s.somme;
      continue;
    }
    const m = parMode.get(s.mode) ?? { nb: 0, montant: 0, valide: 0, en_attente_validation: 0 };
    m.nb += s.n;
    m.montant += s.somme;
    if (s.statut === 'valide') m.valide += s.somme;
    else m.en_attente_validation += s.somme;
    parMode.set(s.mode, m);
    totaux.encaisse += s.somme;
    if (s.statut === 'valide') totaux.valide += s.somme;
    else totaux.en_attente_validation += s.somme;
  }

  res.json({
    items: lignes.map((l) => ({
      ...l,
      encaisse: l.encaissements.filter((e) => e.statut !== 'refuse').reduce((s, e) => s + e.montant, 0),
    })),
    total: total?.n ?? 0,
    page,
    taille,
    du: du ?? null,
    au: au ?? null,
    totaux: {
      nb_livraisons: total?.n ?? 0,
      ...totaux,
      par_mode: MODES_PAIEMENT.filter((m) => parMode.has(m)).map((m) => ({ mode: m, libelle: MODE_PAIEMENT_LABELS[m], ...parMode.get(m)! })),
    },
  });
});
