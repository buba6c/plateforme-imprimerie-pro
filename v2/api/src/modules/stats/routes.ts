// Statistiques (administrateur).
//
// Définitions (toutes les bornes de période sont calculées dans le fuseau de l'entreprise,
// parametres.fuseau ; les dossiers supprimés sont exclus partout, ainsi que leurs paiements) :
// - commandes         : dossiers créés dans la période ; montant = Σ montant (inconnu = 0).
// - encaissé          : Σ paiements « validé » dont la date de validation (valide_at) tombe dans la période.
// - à valider         : paiements « à valider », toutes dates confondues (travail en attente).
// - reste à encaisser : Σ max(0, montant − Σ paiements validés) sur les dossiers livrés ou
//                       terminés, toutes dates confondues.
// - retards           : date promise antérieure à aujourd'hui et dossier ni livré ni terminé.
// - urgents           : dossiers urgents ni livrés ni terminés.
// - production        : photographie actuelle du nombre de dossiers par statut (et par machine) ;
//                       « livre » et « termine » sont des cumuls depuis l'origine.
// Périodes : jour = aujourd'hui ; semaine = semaine ISO commençant le lundi ; mois ; annee
// (civils, en cours). L'évolution regroupe par date_trunc dans le même fuseau ; chaque
// intervalle est complet (la première et la dernière période sont étendues à leurs bornes).

import { Router } from 'express';
import { MACHINES, STATUTS, type Machine, type Statut } from '@evocom/shared';
import { one, query } from '../../db/pool';
import { requireAuth, requireRole } from '../../lib/auth';
import { badRequest } from '../../lib/errors';
import { qInt, qStr } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { ajouterJours, aujourdhui, intervalle } from '../commun/requete';

export const statsRouter = Router();
statsRouter.use(requireAuth, requireRole('admin'));

const PERIODES = { jour: 'day', semaine: 'week', mois: 'month', annee: 'year' } as const;
type Periode = keyof typeof PERIODES;
const PAS = { jour: 'day', semaine: 'week', mois: 'month' } as const;
type Pas = keyof typeof PAS;
const MAX_POINTS: Record<Pas, number> = { jour: 400, semaine: 260, mois: 120 };

/** Période nommée : bornes [debut, fin[ en timestamptz, et jours civils correspondants. */
async function bornesPeriode(periode: Periode, fuseau: string) {
  const unite = PERIODES[periode];
  const b = await one<{ debut: Date; fin: Date; du: string; au: string }>(
    `WITH l AS (SELECT date_trunc($1::text, now() AT TIME ZONE $2::text) AS d)
     SELECT (l.d AT TIME ZONE $2::text) AS debut,
            ((l.d + ('1 ' || $1::text)::interval) AT TIME ZONE $2::text) AS fin,
            to_char(l.d, 'YYYY-MM-DD') AS du,
            to_char(l.d + ('1 ' || $1::text)::interval - interval '1 day', 'YYYY-MM-DD') AS au
     FROM l`,
    [unite, fuseau],
  );
  return b!;
}

/** from/to (jours civils, to inclus) convertis en bornes timestamptz [debut, fin[. */
function bornesJours(from: string, to: string, fuseau: string) {
  return {
    sql: (col: string, a: number, b: number, c: number) =>
      `${col} >= ($${a}::date::timestamp AT TIME ZONE $${c}::text) AND ${col} < (($${b}::date + 1)::timestamp AT TIME ZONE $${c}::text)`,
    args: [from, to, fuseau],
  };
}

function debutDuMois(jour: string): string {
  return `${jour.slice(0, 8)}01`;
}

statsRouter.get('/apercu', async (req, res) => {
  const periode = (qStr(req, 'periode') ?? 'mois') as Periode;
  if (!(periode in PERIODES)) throw badRequest('Période inconnue : choisissez jour, semaine, mois ou annee.');
  const params = await getParametres();
  const tz = params.fuseau;
  const b = await bornesPeriode(periode, tz);

  const [commandes, encaisse, aValider, reste, production, retards, urgents] = await Promise.all([
    one<{ nb: number; montant: number }>(
      `SELECT count(*)::int AS nb, coalesce(sum(montant), 0)::bigint AS montant
       FROM dossiers WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2`,
      [b.debut, b.fin],
    ),
    one<{ nb: number; montant: number }>(
      `SELECT count(*)::int AS nb, coalesce(sum(p.montant), 0)::bigint AS montant
       FROM paiements p JOIN dossiers d ON d.id = p.dossier_id
       WHERE d.deleted_at IS NULL AND p.statut = 'valide' AND p.valide_at >= $1 AND p.valide_at < $2`,
      [b.debut, b.fin],
    ),
    one<{ nb: number; montant: number }>(
      `SELECT count(*)::int AS nb, coalesce(sum(p.montant), 0)::bigint AS montant
       FROM paiements p JOIN dossiers d ON d.id = p.dossier_id
       WHERE d.deleted_at IS NULL AND p.statut = 'a_valider'`,
    ),
    one<{ nb: number; montant: number }>(
      `SELECT count(*) FILTER (WHERE r > 0)::int AS nb, coalesce(sum(r), 0)::bigint AS montant
       FROM (
         SELECT greatest(0, d.montant - coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide'), 0)) AS r
         FROM dossiers d
         WHERE d.deleted_at IS NULL AND d.statut IN ('livre', 'termine') AND d.montant IS NOT NULL
       ) x`,
    ),
    query<{ machine: Machine; statut: Statut; n: number }>(
      `SELECT machine, statut, count(*)::int AS n FROM dossiers WHERE deleted_at IS NULL GROUP BY machine, statut`,
    ),
    one<{ n: number }>(
      `SELECT count(*)::int AS n FROM dossiers
       WHERE deleted_at IS NULL AND date_promise < (now() AT TIME ZONE $1::text)::date AND statut NOT IN ('livre', 'termine')`,
      [tz],
    ),
    one<{ n: number }>(`SELECT count(*)::int AS n FROM dossiers WHERE deleted_at IS NULL AND urgent AND statut NOT IN ('livre', 'termine')`),
  ]);

  const zero = () => Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  const parStatut = zero();
  const parMachine = Object.fromEntries(MACHINES.map((m) => [m, zero()])) as Record<Machine, Record<Statut, number>>;
  for (const r of production) {
    parStatut[r.statut] += r.n;
    parMachine[r.machine][r.statut] += r.n;
  }

  res.json({
    periode,
    du: b.du,
    au: b.au,
    fuseau: tz,
    commandes: { nb: commandes?.nb ?? 0, montant: commandes?.montant ?? 0 },
    encaisse: { montant: encaisse?.montant ?? 0, nb: encaisse?.nb ?? 0 },
    a_valider: { nb: aValider?.nb ?? 0, montant: aValider?.montant ?? 0 },
    reste_a_encaisser: { montant: reste?.montant ?? 0, nb_dossiers: reste?.nb ?? 0 },
    production: { par_statut: parStatut, par_machine: parMachine },
    retards: { nb: retards?.n ?? 0 },
    urgents: { nb: urgents?.n ?? 0 },
  });
});

statsRouter.get('/evolution', async (req, res) => {
  const pas = (qStr(req, 'pas') ?? 'jour') as Pas;
  if (!(pas in PAS)) throw badRequest('Pas inconnu : choisissez jour, semaine ou mois.');
  const params = await getParametres();
  const tz = params.fuseau;
  const { from: f, to: t } = intervalle(req);
  const to = t ?? aujourdhui(tz);
  const from =
    f ??
    (pas === 'jour'
      ? ajouterJours(to, -29)
      : pas === 'semaine'
        ? ajouterJours(to, -7 * 11)
        : (() => {
            const d = new Date(`${debutDuMois(to)}T00:00:00Z`);
            d.setUTCMonth(d.getUTCMonth() - 11);
            return d.toISOString().slice(0, 10);
          })());
  if (from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  const unite = PAS[pas];
  const n = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM generate_series(date_trunc($1::text, $2::date::timestamp), date_trunc($1::text, $3::date::timestamp), ('1 ' || $1::text)::interval)`,
    [unite, from, to],
  );
  if ((n?.n ?? 0) > MAX_POINTS[pas]) {
    throw badRequest(`Intervalle trop long pour un pas « ${pas} » (${n?.n} points, ${MAX_POINTS[pas]} au maximum) : réduisez la période ou choisissez un pas plus grand.`);
  }
  // $1 unité, $2 début, $3 fin, $4 fuseau ; bornes alignées sur les périodes complètes.
  const rows = await query<{ periode: string; commandes: number; montant_commandes: number; encaisse: number }>(
    `WITH s AS (
       SELECT generate_series(date_trunc($1::text, $2::date::timestamp), date_trunc($1::text, $3::date::timestamp), ('1 ' || $1::text)::interval) AS p
     ),
     b AS (
       SELECT (min(p) AT TIME ZONE $4::text) AS debut, ((max(p) + ('1 ' || $1::text)::interval) AT TIME ZONE $4::text) AS fin FROM s
     ),
     c AS (
       SELECT date_trunc($1::text, d.created_at AT TIME ZONE $4::text) AS p, count(*)::int AS n, coalesce(sum(d.montant), 0)::bigint AS m
       FROM dossiers d, b
       WHERE d.deleted_at IS NULL AND d.created_at >= b.debut AND d.created_at < b.fin
       GROUP BY 1
     ),
     e AS (
       SELECT date_trunc($1::text, p.valide_at AT TIME ZONE $4::text) AS p, coalesce(sum(p.montant), 0)::bigint AS m
       FROM paiements p JOIN dossiers d ON d.id = p.dossier_id, b
       WHERE d.deleted_at IS NULL AND p.statut = 'valide' AND p.valide_at >= b.debut AND p.valide_at < b.fin
       GROUP BY 1
     )
     SELECT to_char(s.p, 'YYYY-MM-DD') AS periode, coalesce(c.n, 0) AS commandes, coalesce(c.m, 0) AS montant_commandes, coalesce(e.m, 0) AS encaisse
     FROM s LEFT JOIN c ON c.p = s.p LEFT JOIN e ON e.p = s.p
     ORDER BY s.p`,
    [unite, from, to, tz],
  );
  res.json(rows);
});

statsRouter.get('/production', async (req, res) => {
  const params = await getParametres();
  const tz = params.fuseau;
  const { from: f, to: t } = intervalle(req);
  const to = t ?? aujourdhui(tz);
  const from = f ?? debutDuMois(to);
  if (from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  const dans = (col: string) => `${col} >= ($1::date::timestamp AT TIME ZONE $3::text) AND ${col} < (($2::date + 1)::timestamp AT TIME ZONE $3::text)`;
  const heures = (debut: string, fin: string) => `round((avg(extract(epoch FROM (${fin} - ${debut})) / 3600) FILTER (WHERE ${dans(fin)} AND ${debut} IS NOT NULL AND ${fin} >= ${debut}))::numeric, 1)`;
  const nb = (debut: string, fin: string) => `count(*) FILTER (WHERE ${dans(fin)} AND ${debut} IS NOT NULL AND ${fin} >= ${debut})::int`;
  const rows = await query<Record<string, any>>(
    `SELECT machine,
            count(*) FILTER (WHERE ${dans('created_at')})::int AS crees,
            coalesce(sum(montant) FILTER (WHERE ${dans('created_at')}), 0)::bigint AS montant,
            count(*) FILTER (WHERE ${dans('date_fin_impression')})::int AS imprimes,
            count(*) FILTER (WHERE ${dans('livre_at')})::int AS livres,
            ${heures('created_at', 'date_validation')} AS h1, ${nb('created_at', 'date_validation')} AS n1,
            ${heures('date_validation', 'date_fin_impression')} AS h2, ${nb('date_validation', 'date_fin_impression')} AS n2,
            ${heures('date_fin_impression', 'livre_at')} AS h3, ${nb('date_fin_impression', 'livre_at')} AS n3
     FROM dossiers
     WHERE deleted_at IS NULL
     GROUP BY GROUPING SETS ((machine), ())`,
    [from, to, tz],
  );
  const delais = (r: Record<string, any> | undefined) => ({
    creation_validation: { heures_moyennes: r?.h1 ?? null, nb: r?.n1 ?? 0 },
    validation_fin_impression: { heures_moyennes: r?.h2 ?? null, nb: r?.n2 ?? 0 },
    fin_impression_livraison: { heures_moyennes: r?.h3 ?? null, nb: r?.n3 ?? 0 },
  });
  const global = rows.find((r) => r.machine === null);
  const parMachine = MACHINES.map((m) => {
    const r = rows.find((x) => x.machine === m);
    return { machine: m, crees: r?.crees ?? 0, montant: r?.montant ?? 0, imprimes: r?.imprimes ?? 0, livres: r?.livres ?? 0, delais: delais(r) };
  });

  const actions = await query<{ user_id: number; nom: string; role: string; action: string; n: number }>(
    `SELECT e.user_id, u.nom, u.role, coalesce(e.action, e.type) AS action, count(*)::int AS n
     FROM dossier_events e JOIN users u ON u.id = e.user_id JOIN dossiers d ON d.id = e.dossier_id
     WHERE d.deleted_at IS NULL AND e.type IN ('creation', 'statut') AND ${dans('e.created_at')}
     GROUP BY e.user_id, u.nom, u.role, coalesce(e.action, e.type)`,
    [from, to, tz],
  );
  const parUser = new Map<number, { user_id: number; nom: string; role: string; nb_actions: number; actions: Record<string, number> }>();
  for (const a of actions) {
    const u = parUser.get(a.user_id) ?? { user_id: a.user_id, nom: a.nom, role: a.role, nb_actions: 0, actions: {} };
    u.nb_actions += a.n;
    u.actions[a.action] = (u.actions[a.action] ?? 0) + a.n;
    parUser.set(a.user_id, u);
  }

  res.json({
    du: from,
    au: to,
    delais: delais(global),
    par_machine: parMachine,
    par_utilisateur: [...parUser.values()].sort((a, b) => b.nb_actions - a.nb_actions || a.nom.localeCompare(b.nom, 'fr')),
  });
});

statsRouter.get('/top-clients', async (req, res) => {
  const params = await getParametres();
  const tz = params.fuseau;
  const { from: f, to: t } = intervalle(req);
  const to = t ?? aujourdhui(tz);
  const from = f ?? debutDuMois(to);
  if (from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  const limit = Math.min(Math.max(qInt(req, 'limit') ?? 10, 1), 100);
  const periode = bornesJours(from, to, tz);
  const rows = await query(
    `SELECT d.client_id, coalesce(c.nom, min(d.client_nom)) AS nom, count(*)::int AS nb, coalesce(sum(d.montant), 0)::bigint AS montant
     FROM dossiers d LEFT JOIN clients c ON c.id = d.client_id
     WHERE d.deleted_at IS NULL AND ${periode.sql('d.created_at', 1, 2, 3)}
     GROUP BY d.client_id, c.nom, CASE WHEN d.client_id IS NULL THEN lower(trim(d.client_nom)) END
     ORDER BY montant DESC, nb DESC, nom
     LIMIT ${limit}`,
    periode.args,
  );
  res.json(rows);
});
