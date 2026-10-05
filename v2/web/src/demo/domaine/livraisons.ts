// Planning et historique des livraisons (api/src/modules/livraisons/routes.ts).

import { actionsDisponibles, MODE_PAIEMENT_LABELS, MODES_PAIEMENT, STATUT_LABELS, type ModePaiement } from '@evocom/shared';
import { E, nomUtilisateur, type DossierDemo, type UserDemo } from '../etat';
import { dansPeriode, debutJour, ecartJours, estJourValide, heureDans, jourDans } from '../dates';
import { badRequest, contient, forbidden, qInt, qStr, type Requete } from '../http';
import { ligne, visible } from './dossiers';

const PERIODE_MAX_JOURS = 62;

function qDate(r: Requete, nom: string): string | undefined {
  const v = qStr(r, nom);
  if (v === undefined) return undefined;
  if (!estJourValide(v)) throw badRequest(`La date « ${nom} » est invalide : utilisez le format AAAA-MM-JJ (par exemple 2026-10-02).`);
  return v;
}

function livreurCible(r: Requete, user: UserDemo): number | null {
  if (user.role === 'livreur') return user.id;
  const v = qStr(r, 'livreur_id');
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Le filtre « livreur_id » doit être le numéro d’un livreur.');
  return n;
}

function verifierRole(user: UserDemo) {
  if (user.role !== 'admin' && user.role !== 'livreur') throw forbidden();
}

function enCoursPour(d: DossierDemo, user: UserDemo, livreurId: number | null): boolean {
  if (user.role === 'livreur') return d.livreur_id === user.id || d.livreur_id === null;
  return livreurId ? d.livreur_id === livreurId : true;
}

const moment = (d: DossierDemo) => (d.statut === 'livre' || d.statut === 'termine' ? d.livre_at : d.livraison_prevue_at);

function presenterPlanning(d: DossierDemo, user: UserDemo) {
  const r = ligne(d);
  const tz = E().parametres.fuseau;
  const m = moment(d);
  const solde = d.montant === null ? null : Math.max(0, d.montant - r.deja_paye);
  return {
    id: d.id,
    numero: d.numero,
    statut: d.statut,
    urgent: d.urgent,
    client_nom: d.client_nom,
    client_telephone: d.client_telephone,
    adresse_livraison: d.adresse_livraison,
    notes_livraison: d.notes_livraison,
    date_promise: d.date_promise,
    livraison_prevue_at: d.livraison_prevue_at,
    livre_at: d.livre_at,
    livreur_id: d.livreur_id,
    livreur_nom: r.livreur_nom,
    montant: d.montant,
    mode_paiement_prevu: d.mode_paiement_prevu,
    deja_paye: r.deja_paye,
    en_attente_validation: r.en_attente_validation,
    nb_fichiers: r.nb_fichiers,
    nb_reports: d.evenements.filter((e) => e.type === 'livraison' && e.action === 'reporter').length,
    jour: m ? jourDans(tz, new Date(m)) : null,
    heure: m ? heureDans(tz, new Date(m)) : null,
    statut_label: STATUT_LABELS[d.statut],
    solde,
    reste_a_encaisser: solde === null ? null : Math.max(0, solde - r.en_attente_validation),
    actions: actionsDisponibles(user, r).map((a) => a.id),
  };
}

/** Ordre croissant, valeurs absentes en dernier (NULLS LAST). */
const parInstant = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

export function planning(user: UserDemo, r: Requete) {
  verifierRole(user);
  const tz = E().parametres.fuseau;
  const debut = qDate(r, 'debut');
  const fin = qDate(r, 'fin');
  if (!debut || !fin) {
    throw badRequest('Indiquez la période avec « debut » et « fin » au format AAAA-MM-JJ (par exemple debut=2026-10-05&fin=2026-10-11).');
  }
  if (debut > fin) throw badRequest('La date de début est postérieure à la date de fin : inversez-les.');
  const jours = ecartJours(debut, fin) + 1;
  if (jours > PERIODE_MAX_JOURS) throw badRequest(`La période demandée couvre ${jours} jours : ${PERIODE_MAX_JOURS} jours au maximum. Réduisez-la.`);
  const livreurId = livreurCible(r, user);
  const auj = jourDans(tz);
  const vus = E().dossiers.filter((d) => visible(user, d));

  const items = vus
    .filter(
      (d) =>
        (d.statut === 'en_livraison' && dansPeriode(d.livraison_prevue_at, tz, debut, fin) && enCoursPour(d, user, livreurId)) ||
        ((d.statut === 'livre' || d.statut === 'termine') && dansPeriode(d.livre_at, tz, debut, fin) && (!livreurId || d.livreur_id === livreurId)),
    )
    .sort((a, b) => parInstant(moment(a), moment(b)) || a.id - b.id);
  const debutAuj = debutJour(auj, tz);
  const enRetard = vus
    .filter((d) => d.statut === 'en_livraison' && d.livraison_prevue_at && Date.parse(d.livraison_prevue_at) < debutAuj && enCoursPour(d, user, livreurId))
    .sort((a, b) => parInstant(a.livraison_prevue_at, b.livraison_prevue_at) || a.id - b.id)
    .slice(0, 200);
  const aProgrammer = vus
    .filter((d) => d.statut === 'pret_livraison')
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        parInstant(a.date_promise, b.date_promise) ||
        parInstant(a.date_fin_impression, b.date_fin_impression) ||
        a.id - b.id,
    )
    .slice(0, 200);
  return {
    debut,
    fin,
    aujourdhui: auj,
    fuseau: tz,
    livreur_id: livreurId,
    jours_historique: E().parametres.livreur_jours_historique,
    items: items.map((d) => presenterPlanning(d, user)),
    en_retard: enRetard.map((d) => presenterPlanning(d, user)),
    a_programmer: aProgrammer.map((d) => presenterPlanning(d, user)),
  };
}

export function historique(user: UserDemo, r: Requete) {
  verifierRole(user);
  const e = E();
  const tz = e.parametres.fuseau;
  const du = qDate(r, 'du');
  const au = qDate(r, 'au');
  if (du && au && du > au) throw badRequest('La date « du » est postérieure à la date « au » : inversez-les.');
  const mode = qStr(r, 'mode_paiement');
  if (mode && !(MODES_PAIEMENT as readonly string[]).includes(mode)) {
    throw badRequest(`Mode de paiement inconnu : ${mode}. Valeurs possibles : ${MODES_PAIEMENT.join(', ')}.`);
  }
  const page = Math.max(qInt(r, 'page') ?? 1, 1);
  const taille = Math.min(Math.max(qInt(r, 'taille') ?? 25, 1), 100);
  const livreurId = livreurCible(r, user);
  const q = qStr(r, 'q')?.slice(0, 100);

  const encaissements = (d: DossierDemo) =>
    e.paiements
      .filter((p) => p.dossier_id === d.id && p.encaisse_par !== null && p.encaisse_par === d.livreur_id && (!mode || p.mode === mode))
      .sort((a, b) => a.encaisse_at.localeCompare(b.encaisse_at) || a.id - b.id);
  let l = e.dossiers.filter((d) => !d.deleted_at && (d.statut === 'livre' || d.statut === 'termine') && d.livre_at);
  if (livreurId) l = l.filter((d) => d.livreur_id === livreurId);
  if (du || au) l = l.filter((d) => dansPeriode(d.livre_at, tz, du, au));
  if (q) l = l.filter((d) => contient(`${d.numero} ${d.client_nom} ${d.adresse_livraison ?? ''}`, q));
  if (mode) l = l.filter((d) => encaissements(d).length > 0);
  l.sort((a, b) => (b.livre_at ?? '').localeCompare(a.livre_at ?? '') || b.id - a.id);

  const parMode = new Map<ModePaiement, { nb: number; montant: number; valide: number; en_attente_validation: number }>();
  const totaux = { encaisse: 0, valide: 0, en_attente_validation: 0, refuse: 0 };
  for (const d of l) {
    for (const p of encaissements(d)) {
      if (p.statut === 'refuse') {
        totaux.refuse += p.montant;
        continue;
      }
      const m = parMode.get(p.mode) ?? { nb: 0, montant: 0, valide: 0, en_attente_validation: 0 };
      m.nb += 1;
      m.montant += p.montant;
      if (p.statut === 'valide') m.valide += p.montant;
      else m.en_attente_validation += p.montant;
      parMode.set(p.mode, m);
      totaux.encaisse += p.montant;
      if (p.statut === 'valide') totaux.valide += p.montant;
      else totaux.en_attente_validation += p.montant;
    }
  }
  const fenetre = Date.now() - (e.parametres.livreur_jours_historique ?? 7) * 86_400_000;
  return {
    items: l.slice((page - 1) * taille, page * taille).map((d) => {
      const enc = encaissements(d).map((p) => ({ id: p.id, montant: p.montant, mode: p.mode, statut: p.statut, encaisse_at: p.encaisse_at, motif_refus: p.motif_refus }));
      return {
        id: d.id,
        numero: d.numero,
        client_nom: d.client_nom,
        adresse_livraison: d.adresse_livraison,
        livre_at: d.livre_at,
        livreur_id: d.livreur_id,
        livreur_nom: nomUtilisateur(d.livreur_id, d.noms.livreur),
        fiche_accessible: user.role === 'livreur' ? Date.parse(d.livre_at!) > fenetre : true,
        encaissements: enc,
        encaisse: enc.filter((x) => x.statut !== 'refuse').reduce((s, x) => s + x.montant, 0),
      };
    }),
    total: l.length,
    page,
    taille,
    du: du ?? null,
    au: au ?? null,
    totaux: {
      nb_livraisons: l.length,
      ...totaux,
      par_mode: MODES_PAIEMENT.filter((m) => parMode.has(m)).map((m) => ({ mode: m, libelle: MODE_PAIEMENT_LABELS[m], ...parMode.get(m)! })),
    },
  };
}
