// Statistiques recalculées à partir des dossiers et paiements en mémoire
// (mêmes définitions que api/src/modules/stats/routes.ts).

import { MACHINES, STATUTS, type Machine, type Statut } from '@evocom/shared';
import { E } from '../etat';
import { ajouterJours, dansPeriode, jourDans } from '../dates';
import { badRequest, qInt, qStr, type Requete } from '../http';

const PERIODES = ['jour', 'semaine', 'mois', 'annee'] as const;
type Periode = (typeof PERIODES)[number];
type Pas = 'jour' | 'semaine' | 'mois';
const MAX_POINTS: Record<Pas, number> = { jour: 400, semaine: 260, mois: 120 };

const fuseau = () => E().parametres.fuseau as string;
const actifs = () => E().dossiers.filter((d) => !d.deleted_at);
const aujourdhui = () => jourDans(fuseau());

/** Premier jour de la période (unité) qui contient `jour`. */
function tronquer(jour: string, unite: Pas | 'annee'): string {
  if (unite === 'jour') return jour;
  if (unite === 'mois') return `${jour.slice(0, 8)}01`;
  if (unite === 'annee') return `${jour.slice(0, 4)}-01-01`;
  const j = new Date(`${jour}T00:00:00Z`).getUTCDay();
  return ajouterJours(jour, -((j + 6) % 7));
}

function suivant(jour: string, unite: Pas | 'annee'): string {
  if (unite === 'jour') return ajouterJours(jour, 1);
  if (unite === 'semaine') return ajouterJours(jour, 7);
  const d = new Date(`${jour}T00:00:00Z`);
  if (unite === 'mois') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function intervalle(r: Requete) {
  const from = qStr(r, 'from');
  const to = qStr(r, 'to');
  for (const [n, v] of [['from', from], ['to', to]] as const) {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`La date « ${n} » est invalide : utilisez le format AAAA-MM-JJ (par exemple 2026-10-02).`);
  }
  if (from && to && from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  return { from, to };
}

const somme = (l: { montant: number | null }[]) => l.reduce((s, x) => s + (x.montant ?? 0), 0);

export function apercu(r: Requete) {
  const periode = (qStr(r, 'periode') ?? 'mois') as Periode;
  if (!PERIODES.includes(periode)) throw badRequest('Période inconnue : choisissez jour, semaine, mois ou annee.');
  const tz = fuseau();
  const du = tronquer(aujourdhui(), periode);
  const au = ajouterJours(suivant(du, periode), -1);
  const dossiers = actifs();
  const ids = new Set(dossiers.map((d) => d.id));
  const paiements = E().paiements.filter((p) => ids.has(p.dossier_id));
  const commandes = dossiers.filter((d) => dansPeriode(d.created_at, tz, du, au));
  const encaisse = paiements.filter((p) => p.statut === 'valide' && dansPeriode(p.valide_at, tz, du, au));
  const aValider = paiements.filter((p) => p.statut === 'a_valider');
  const restes = dossiers
    .filter((d) => (d.statut === 'livre' || d.statut === 'termine') && d.montant !== null)
    .map((d) => Math.max(0, (d.montant ?? 0) - paiements.filter((p) => p.dossier_id === d.id && p.statut === 'valide').reduce((s, p) => s + p.montant, 0)));
  const zero = () => Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  const parStatut = zero();
  const parMachine = Object.fromEntries(MACHINES.map((m) => [m, zero()])) as Record<Machine, Record<Statut, number>>;
  for (const d of dossiers) {
    parStatut[d.statut] += 1;
    parMachine[d.machine][d.statut] += 1;
  }
  const auj = aujourdhui();
  const enCours = (d: (typeof dossiers)[number]) => d.statut !== 'livre' && d.statut !== 'termine';
  return {
    periode,
    du,
    au,
    fuseau: tz,
    commandes: { nb: commandes.length, montant: somme(commandes) },
    encaisse: { montant: somme(encaisse), nb: encaisse.length },
    a_valider: { nb: aValider.length, montant: somme(aValider) },
    reste_a_encaisser: { montant: restes.reduce((s, x) => s + x, 0), nb_dossiers: restes.filter((x) => x > 0).length },
    production: { par_statut: parStatut, par_machine: parMachine },
    retards: { nb: dossiers.filter((d) => d.date_promise && d.date_promise < auj && enCours(d)).length },
    urgents: { nb: dossiers.filter((d) => d.urgent && enCours(d)).length },
  };
}

export function evolution(r: Requete) {
  const pas = (qStr(r, 'pas') ?? 'jour') as Pas;
  if (!['jour', 'semaine', 'mois'].includes(pas)) throw badRequest('Pas inconnu : choisissez jour, semaine ou mois.');
  const tz = fuseau();
  const { from: f, to: t } = intervalle(r);
  const to = t ?? aujourdhui();
  let from = f;
  if (!from) {
    if (pas === 'jour') from = ajouterJours(to, -29);
    else if (pas === 'semaine') from = ajouterJours(to, -7 * 11);
    else {
      const d = new Date(`${to.slice(0, 8)}01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 11);
      from = d.toISOString().slice(0, 10);
    }
  }
  if (from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  const periodes: string[] = [];
  for (let p = tronquer(from, pas); p <= tronquer(to, pas); p = suivant(p, pas)) {
    periodes.push(p);
    if (periodes.length > MAX_POINTS[pas]) {
      throw badRequest(`Intervalle trop long pour un pas « ${pas} » (${MAX_POINTS[pas]} points au maximum) : réduisez la période ou choisissez un pas plus grand.`);
    }
  }
  const lignes = new Map(periodes.map((p) => [p, { periode: p, commandes: 0, montant_commandes: 0, encaisse: 0 }]));
  const cle = (instant: string) => tronquer(jourDans(tz, new Date(instant)), pas);
  const dossiers = actifs();
  const ids = new Set(dossiers.map((d) => d.id));
  for (const d of dossiers) {
    const l = lignes.get(cle(d.created_at));
    if (!l) continue;
    l.commandes += 1;
    l.montant_commandes += d.montant ?? 0;
  }
  for (const p of E().paiements) {
    if (p.statut !== 'valide' || !p.valide_at || !ids.has(p.dossier_id)) continue;
    const l = lignes.get(cle(p.valide_at));
    if (l) l.encaisse += p.montant;
  }
  return [...lignes.values()];
}

function heures(debut: string | null, fin: string | null): number | null {
  if (!debut || !fin) return null;
  const h = (Date.parse(fin) - Date.parse(debut)) / 3_600_000;
  return h >= 0 ? h : null;
}

export function production(r: Requete) {
  const tz = fuseau();
  const { from: f, to: t } = intervalle(r);
  const to = t ?? aujourdhui();
  const from = f ?? `${to.slice(0, 8)}01`;
  if (from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  const dans = (v: string | null) => dansPeriode(v, tz, from, to);
  const dossiers = actifs();
  const delai = (l: typeof dossiers, debut: 'created_at' | 'date_validation' | 'date_fin_impression', fin: 'date_validation' | 'date_fin_impression' | 'livre_at') => {
    const valeurs = l.filter((d) => dans(d[fin])).map((d) => heures(d[debut], d[fin])).filter((h): h is number => h !== null);
    return { heures_moyennes: valeurs.length ? Math.round((valeurs.reduce((s, x) => s + x, 0) / valeurs.length) * 10) / 10 : null, nb: valeurs.length };
  };
  const delais = (l: typeof dossiers) => ({
    creation_validation: delai(l, 'created_at', 'date_validation'),
    validation_fin_impression: delai(l, 'date_validation', 'date_fin_impression'),
    fin_impression_livraison: delai(l, 'date_fin_impression', 'livre_at'),
  });
  const parMachine = MACHINES.map((m) => {
    const l = dossiers.filter((d) => d.machine === m);
    return {
      machine: m,
      crees: l.filter((d) => dans(d.created_at)).length,
      montant: somme(l.filter((d) => dans(d.created_at))),
      imprimes: l.filter((d) => dans(d.date_fin_impression)).length,
      livres: l.filter((d) => dans(d.livre_at)).length,
      delais: delais(l),
    };
  });
  const parUser = new Map<number, { user_id: number; nom: string; role: string; nb_actions: number; actions: Record<string, number> }>();
  for (const d of dossiers) {
    for (const e of d.evenements) {
      if ((e.type !== 'creation' && e.type !== 'statut') || !e.user_id || !dans(e.created_at)) continue;
      const u = E().users.find((x) => x.id === e.user_id);
      if (!u) continue;
      const ligne = parUser.get(u.id) ?? { user_id: u.id, nom: u.nom, role: u.role, nb_actions: 0, actions: {} };
      const a = e.action ?? e.type;
      ligne.nb_actions += 1;
      ligne.actions[a] = (ligne.actions[a] ?? 0) + 1;
      parUser.set(u.id, ligne);
    }
  }
  return {
    du: from,
    au: to,
    delais: delais(dossiers),
    par_machine: parMachine,
    par_utilisateur: [...parUser.values()].sort((a, b) => b.nb_actions - a.nb_actions || a.nom.localeCompare(b.nom, 'fr')),
  };
}

export function topClients(r: Requete) {
  const tz = fuseau();
  const { from: f, to: t } = intervalle(r);
  const to = t ?? aujourdhui();
  const from = f ?? `${to.slice(0, 8)}01`;
  if (from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  const limit = Math.min(Math.max(qInt(r, 'limit') ?? 10, 1), 100);
  const groupes = new Map<string, { client_id: number | null; noms: string[]; nb: number; montant: number }>();
  for (const d of actifs()) {
    if (!dansPeriode(d.created_at, tz, from, to)) continue;
    const k = d.client_id !== null ? `c${d.client_id}` : `n${d.client_nom.trim().toLowerCase()}`;
    const g = groupes.get(k) ?? { client_id: d.client_id, noms: [], nb: 0, montant: 0 };
    g.noms.push(d.client_nom);
    g.nb += 1;
    g.montant += d.montant ?? 0;
    groupes.set(k, g);
  }
  return [...groupes.values()]
    .map((g) => ({
      client_id: g.client_id,
      nom: E().clients.find((c) => c.id === g.client_id)?.nom ?? [...g.noms].sort()[0]!,
      nb: g.nb,
      montant: g.montant,
    }))
    .sort((a, b) => b.montant - a.montant || b.nb - a.nb || a.nom.localeCompare(b.nom))
    .slice(0, limit);
}
