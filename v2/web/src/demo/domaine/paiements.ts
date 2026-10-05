// Paiements : liste filtrée par rôle, validation et refus par l'administrateur, caisse
// (api/src/modules/paiements/routes.ts).

import { formatFCFA, MODE_PAIEMENT_LABELS, MODES_PAIEMENT, paiementInputSchema, STATUTS_PAIEMENT } from '@evocom/shared';
import { E, maintenant, nomUtilisateur, utilisateur, type PaiementDemo, type UserDemo } from '../etat';
import { dansPeriode, debutJour, jourDans } from '../dates';
import { badRequest, conflict, forbidden, notFound, pagination, qInt, qList, qStr, type Requete } from '../http';
import { signalPaiement } from '../temps-reel';
import { charger, enregistrerPaiement, evenement } from './dossiers';
import { journal, notifier } from './notifications';

function dossierDe(p: PaiementDemo) {
  const d = E().dossiers.find((x) => x.id === p.dossier_id);
  if (d) return { numero: d.numero, client_nom: d.client_nom, supprime: !!d.deleted_at, montant: d.montant };
  const c = E().corbeille.find((x) => x.id === p.dossier_id);
  return { numero: c?.numero ?? '', client_nom: c?.client_nom ?? '', supprime: true, montant: c?.montant ?? null };
}

export function presenterPaiement(p: PaiementDemo) {
  const d = dossierDe(p);
  return {
    id: p.id,
    dossier_id: p.dossier_id,
    numero: d.numero,
    client_nom: d.client_nom,
    montant: p.montant,
    mode: p.mode,
    reference: p.reference,
    statut: p.statut,
    notes: p.notes,
    encaisse_par: p.encaisse_par,
    encaisse_par_nom: nomUtilisateur(p.encaisse_par, p.encaisse_par_nom),
    encaisse_at: p.encaisse_at,
    valide_par: p.valide_par,
    valide_par_nom: nomUtilisateur(p.valide_par, p.valide_par_nom),
    valide_at: p.valide_at,
    motif_refus: p.motif_refus,
    dossier_supprime: d.supprime,
  };
}

function intervalle(r: Requete) {
  const from = qStr(r, 'from');
  const to = qStr(r, 'to');
  if (from && to && from > to) throw badRequest('La date de début (from) est postérieure à la date de fin (to) : inversez-les.');
  return { from, to };
}

export function lister(user: UserDemo, r: Requete) {
  if (!['admin', 'preparateur', 'livreur'].includes(user.role)) throw forbidden();
  const { page, limit, offset } = pagination(r, 50, 200);
  const { from, to } = intervalle(r);
  let l = E().paiements;
  if (user.role !== 'admin') l = l.filter((p) => p.encaisse_par === user.id);
  else {
    const livreurId = qInt(r, 'livreur_id') ?? qInt(r, 'encaisse_par');
    if (livreurId) l = l.filter((p) => p.encaisse_par === livreurId);
  }
  const statuts = qList(r, 'statut');
  if (statuts?.length) {
    const inconnus = statuts.filter((s) => !(STATUTS_PAIEMENT as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Statut de paiement inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${STATUTS_PAIEMENT.join(', ')}.`);
    l = l.filter((p) => statuts.includes(p.statut));
  }
  const modes = qList(r, 'mode');
  if (modes?.length) {
    const inconnus = modes.filter((s) => !(MODES_PAIEMENT as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Mode de paiement inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${MODES_PAIEMENT.join(', ')}.`);
    l = l.filter((p) => modes.includes(p.mode));
  }
  const dossierId = qInt(r, 'dossier_id');
  if (dossierId) l = l.filter((p) => p.dossier_id === dossierId);
  const fuseau = E().parametres.fuseau;
  if (from || to) l = l.filter((p) => dansPeriode(p.encaisse_at, fuseau, from, to));
  const tri = [...l].sort((a, b) => b.encaisse_at.localeCompare(a.encaisse_at) || b.id - a.id);
  return {
    items: tri.slice(offset, offset + limit).map(presenterPaiement),
    total: tri.length,
    somme: tri.reduce((s, p) => s + p.montant, 0),
    page,
    limit,
  };
}

function chargerPaiement(id: number): PaiementDemo {
  const p = E().paiements.find((x) => x.id === id);
  if (!p) throw notFound("Ce paiement n'existe pas.");
  return p;
}

export function valider(admin: UserDemo, id: number) {
  if (admin.role !== 'admin') throw forbidden();
  const p = chargerPaiement(id);
  if (p.statut === 'valide') throw conflict('Ce paiement est déjà validé.');
  if (p.statut !== 'a_valider') throw conflict('Ce paiement a été refusé : il ne peut plus être validé. Faites saisir un nouvel encaissement.');
  const d = E().dossiers.find((x) => x.id === p.dossier_id);
  if (!d) throw notFound("Le dossier de ce paiement n'existe plus.");
  const dejaPaye = E()
    .paiements.filter((x) => x.dossier_id === d.id && x.statut === 'valide')
    .reduce((s, x) => s + x.montant, 0);
  if (d.montant !== null && dejaPaye + p.montant > d.montant) {
    throw conflict(
      `Valider ce paiement de ${formatFCFA(p.montant)} porterait le total encaissé à ${formatFCFA(dejaPaye + p.montant)} pour un dossier de ${formatFCFA(d.montant)}. Refusez-le, ou corrigez d'abord le montant du dossier.`,
      { deja_paye: dejaPaye, montant_dossier: d.montant },
    );
  }
  p.statut = 'valide';
  p.valide_par = admin.id;
  p.valide_par_nom = admin.nom;
  p.valide_at = maintenant();
  p.motif_refus = null;
  evenement(d, admin, { type: 'paiement', action: 'valide', data: { paiement_id: id, montant: p.montant, mode: p.mode } });
  journal(admin, 'paiement_valide', 'paiement', id, { dossier_id: d.id, numero: d.numero, montant: p.montant, mode: p.mode });
  signalPaiement(d.id);
  if (p.encaisse_par && p.encaisse_par !== admin.id) {
    notifier(
      { userIds: [p.encaisse_par] },
      { type: 'paiement_valide', titre: `Paiement validé : ${d.numero}`, message: `${formatFCFA(p.montant)} en ${MODE_PAIEMENT_LABELS[p.mode]} · ${d.client_nom}`, dossier_id: d.id },
    );
  }
  return presenterPaiement(p);
}

export function refuser(admin: UserDemo, id: number, body: any) {
  if (admin.role !== 'admin') throw forbidden();
  const motif = typeof body?.motif === 'string' ? body.motif.trim() : '';
  if (motif.length < 3) {
    throw badRequest('Indiquez le motif du refus (3 caractères au moins) : il est transmis à la personne qui a encaissé.', { champs: { motif: 'Motif obligatoire' } });
  }
  if (motif.length > 500) throw badRequest('Le motif du refus est trop long (500 caractères au maximum).');
  const p = chargerPaiement(id);
  if (p.statut === 'refuse') throw conflict('Ce paiement est déjà refusé.');
  if (p.statut !== 'a_valider') throw conflict('Ce paiement est déjà validé : il ne peut plus être refusé.');
  const d = E().dossiers.find((x) => x.id === p.dossier_id);
  p.statut = 'refuse';
  p.motif_refus = motif;
  p.valide_par = admin.id;
  p.valide_par_nom = admin.nom;
  p.valide_at = maintenant();
  if (d) evenement(d, admin, { type: 'paiement', action: 'refuse', commentaire: motif, data: { paiement_id: id, montant: p.montant, mode: p.mode } });
  journal(admin, 'paiement_refuse', 'paiement', id, { dossier_id: p.dossier_id, montant: p.montant, motif });
  signalPaiement(p.dossier_id);
  if (d && p.encaisse_par && p.encaisse_par !== admin.id) {
    notifier({ userIds: [p.encaisse_par] }, { type: 'paiement_refuse', titre: `Paiement refusé : ${d.numero}`, message: `${formatFCFA(p.montant)} · ${motif}`, dossier_id: d.id });
  }
  return presenterPaiement(p);
}

export function encaisser(user: UserDemo, dossierId: number, body: unknown) {
  if (!['admin', 'preparateur', 'livreur'].includes(user.role)) throw forbidden();
  const input = paiementInputSchema.parse(body ?? {});
  const d = charger(user, dossierId);
  const id = enregistrerPaiement(user, d, { montant: input.montant, mode: input.mode, reference: input.reference ?? null, notes: input.notes ?? null });
  signalPaiement(dossierId);
  return presenterPaiement(chargerPaiement(id));
}

export function caisse() {
  const fuseau = E().parametres.fuseau;
  const debut = debutJour(jourDans(fuseau), fuseau);
  const retenus = E().paiements.filter((p) => p.statut === 'a_valider' || (p.statut === 'valide' && p.valide_at && Date.parse(p.valide_at) >= debut));
  type Bloc = { av_n: number; av_s: number; vj_n: number; vj_s: number };
  const vide = (): Bloc => ({ av_n: 0, av_s: 0, vj_n: 0, vj_s: 0 });
  const ajouter = (b: Bloc, p: PaiementDemo) => {
    if (p.statut === 'a_valider') {
      b.av_n += 1;
      b.av_s += p.montant;
    } else {
      b.vj_n += 1;
      b.vj_s += p.montant;
    }
  };
  const parUser = new Map<number | null, Bloc>();
  const parMode = new Map<string, Bloc>();
  for (const p of retenus) {
    const u = parUser.get(p.encaisse_par) ?? vide();
    ajouter(u, p);
    parUser.set(p.encaisse_par, u);
    const m = parMode.get(p.mode) ?? vide();
    ajouter(m, p);
    parMode.set(p.mode, m);
  }
  const bloc = (n: number, somme: number) => ({ n, somme });
  const lignesUser = [...parUser.entries()].map(([id, b]) => ({ id, b, u: utilisateur(id) }));
  lignesUser.sort((x, y) => y.b.av_s - x.b.av_s || y.b.vj_s - x.b.vj_s || (x.u?.nom ?? '').localeCompare(y.u?.nom ?? ''));
  const tot = lignesUser.reduce((a, { b }) => ({ av_n: a.av_n + b.av_n, av_s: a.av_s + b.av_s, vj_n: a.vj_n + b.vj_n, vj_s: a.vj_s + b.vj_s }), vide());
  return {
    par_encaisseur: lignesUser.map(({ id, b, u }) => ({
      user_id: id,
      nom: u?.nom ?? 'Encaisseur inconnu (données importées)',
      role: u?.role ?? null,
      a_valider: bloc(b.av_n, b.av_s),
      valide_aujourdhui: bloc(b.vj_n, b.vj_s),
    })),
    par_mode: [...parMode.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mode, b]) => ({
        mode,
        libelle: MODE_PAIEMENT_LABELS[mode as keyof typeof MODE_PAIEMENT_LABELS] ?? mode,
        a_valider: bloc(b.av_n, b.av_s),
        valide_aujourdhui: bloc(b.vj_n, b.vj_s),
      })),
    totaux: { a_valider: bloc(tot.av_n, tot.av_s), valide_aujourdhui: bloc(tot.vj_n, tot.vj_s) },
  };
}
