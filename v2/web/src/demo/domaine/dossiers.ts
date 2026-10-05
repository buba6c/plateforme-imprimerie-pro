// Dossiers en mémoire : mêmes règles que api/src/modules/dossiers (service.ts, access.ts) :
// visibilité par rôle, circuit partagé (verifierAction), moteur de prix partagé (calculerPrix).

import {
  ACTIONS_BY_ID,
  actionInputSchema,
  actionsDisponibles,
  calculerPrix,
  dossierCreateSchema,
  dossierUpdateSchema,
  formatFCFA,
  isStatut,
  machineOfRole,
  resumeLigne,
  situationPaiement,
  specsSchemaFor,
  STATUT_LABELS,
  STATUTS_MODIFIABLES,
  verifierAction,
  type ActionId,
  type ActionInput,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Specs,
  type Statut,
  type Tarif,
} from '@evocom/shared';
import { E, maintenant, nomUtilisateur, prochainId, utilisateur, type DossierDemo, type EvenementDemo, type UserDemo } from '../etat';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../http';
import { signalDossier, signalPaiement } from '../temps-reel';
import { journal, notifier } from './notifications';

// ---------------------------------------------------------------------------
// Visibilité (access.ts)

export function visible(user: UserDemo, d: DossierDemo, joursLivreur = E().parametres.livreur_jours_historique ?? 7): boolean {
  if (d.deleted_at) return false;
  switch (user.role) {
    case 'admin':
    case 'preparateur':
      return true;
    case 'imprimeur_roland':
    case 'imprimeur_xerox':
      return d.machine === machineOfRole(user.role) && (d.date_validation !== null || d.statut !== 'en_cours');
    case 'livreur':
      return (
        d.statut === 'pret_livraison' ||
        d.statut === 'en_livraison' ||
        ((d.statut === 'livre' || d.statut === 'termine') && !!d.livre_at && Date.parse(d.livre_at) > Date.now() - joursLivreur * 86_400_000)
      );
  }
}

export const peutVoirMontants = (u: UserDemo) => u.role === 'admin' || u.role === 'preparateur' || u.role === 'livreur';
export const peutVoirContactClient = peutVoirMontants;
export const peutVoirFichiers = (u: UserDemo) => u.role !== 'livreur';

// ---------------------------------------------------------------------------
// Lecture

export function tarifsPrix(): Tarif[] {
  return E().tarifs as unknown as Tarif[];
}

function libelles(): Map<string, string> {
  return new Map(E().tarifs.map((t) => [`${t.machine}:${t.code}`, t.libelle]));
}

export function resumeSpecs(machine: Machine, specs: any, description: string | null, lib: Map<string, string>): string {
  const lignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  if (!lignes.length) return description ?? '';
  const first = lignes[0]!;
  const l = lib.get(`${machine}:${first.support}`) ?? lib.get(`global:${first.support}`) ?? first.support;
  const base = resumeLigne(machine, first, l);
  return lignes.length > 1 ? `${base} · +${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : base;
}

/** Ligne « base de données » : le dossier avec ses sommes (fichiers, paiements). */
export function ligne(d: DossierDemo) {
  const paiements = E().paiements.filter((p) => p.dossier_id === d.id);
  return {
    ...d,
    nb_fichiers: d.fichiers.filter((f) => !f.deleted_at).length,
    deja_paye: paiements.filter((p) => p.statut === 'valide').reduce((s, p) => s + p.montant, 0),
    en_attente_validation: paiements.filter((p) => p.statut === 'a_valider').reduce((s, p) => s + p.montant, 0),
    preparateur_nom: nomUtilisateur(d.preparateur_id, d.noms.preparateur),
    imprimeur_nom: nomUtilisateur(d.imprimeur_id, d.noms.imprimeur),
    livreur_nom: nomUtilisateur(d.livreur_id, d.noms.livreur),
  };
}
export type Ligne = ReturnType<typeof ligne>;

export function presenter(r: Ligne, user: UserDemo, lib = libelles()) {
  const out: Record<string, unknown> = {
    id: r.id,
    public_id: r.public_id,
    numero: r.numero,
    machine: r.machine,
    statut: r.statut,
    statut_label: STATUT_LABELS[r.statut],
    client_id: r.client_id,
    client_nom: r.client_nom,
    description: r.description,
    consignes: r.consignes,
    specs: r.specs,
    resume_specs: resumeSpecs(r.machine, r.specs, r.description, lib),
    urgent: r.urgent,
    date_promise: r.date_promise,
    preparateur_id: r.preparateur_id,
    preparateur_nom: r.preparateur_nom,
    imprimeur_id: r.imprimeur_id,
    imprimeur_nom: r.imprimeur_nom,
    livreur_id: r.livreur_id,
    livreur_nom: r.livreur_nom,
    commentaire_revision: r.commentaire_revision,
    date_validation: r.date_validation,
    date_debut_impression: r.date_debut_impression,
    date_fin_impression: r.date_fin_impression,
    livraison_prevue_at: r.livraison_prevue_at,
    livre_at: r.livre_at,
    termine_at: r.termine_at,
    nb_fichiers: r.nb_fichiers,
    devis_id: r.devis_id,
    importe: r.importe,
    deleted_at: r.deleted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
  if (peutVoirContactClient(user)) {
    out.client_telephone = r.client_telephone;
    out.client_email = r.client_email;
    out.adresse_livraison = r.adresse_livraison;
    out.notes_livraison = r.notes_livraison;
  }
  if (peutVoirMontants(user)) {
    out.montant = r.montant;
    out.montant_source = r.montant_source;
    out.mode_paiement_prevu = r.mode_paiement_prevu;
    out.deja_paye = r.deja_paye;
    out.en_attente_validation = r.en_attente_validation;
    out.solde = r.montant === null ? null : Math.max(0, r.montant - r.deja_paye);
    out.situation_paiement = situationPaiement(r.montant, r.deja_paye);
    if (user.role !== 'livreur') out.detail_prix = r.detail_prix;
  }
  return out;
}

export interface Filtres {
  statut?: string[];
  machine?: string;
  q?: string;
  urgent?: boolean;
  mine?: boolean;
  file?: string;
  client_id?: number;
  page?: number;
  limit?: number;
  tri?: string;
}

const parDate = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');

export function lister(user: UserDemo, f: Filtres) {
  let l = E().dossiers.filter((d) => visible(user, d));
  if (f.machine === 'roland' || f.machine === 'xerox') l = l.filter((d) => d.machine === f.machine);
  if (f.urgent) l = l.filter((d) => d.urgent);
  if (f.mine) l = l.filter((d) => d.preparateur_id === user.id);
  if (f.client_id) l = l.filter((d) => d.client_id === f.client_id);
  const q = f.q?.trim().toLowerCase();
  if (q) l = l.filter((d) => `${d.client_nom} ${d.numero} ${d.description ?? ''}`.toLowerCase().includes(q));
  if (f.file === 'travail' && machineOfRole(user.role)) {
    const deuxJours = Date.now() - 2 * 86_400_000;
    l = l.filter(
      (d) => d.statut === 'pret_impression' || d.statut === 'en_impression' || ((d.statut === 'pret_livraison' || d.statut === 'a_revoir') && Date.parse(d.updated_at) > deuxJours),
    );
  }
  const compteurs: Partial<Record<Statut, number>> = {};
  for (const d of l) compteurs[d.statut] = (compteurs[d.statut] ?? 0) + 1;
  const statuts = (f.statut ?? []).filter(isStatut);
  if (f.statut?.length) l = l.filter((d) => statuts.includes(d.statut));

  const tri = [...l];
  if (f.tri === 'ancien') tri.sort((a, b) => parDate(a.created_at, b.created_at) || a.id - b.id);
  else if (f.tri === 'recent') tri.sort((a, b) => parDate(b.created_at, a.created_at) || b.id - a.id);
  else
    tri.sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        (a.date_promise === null ? 1 : 0) - (b.date_promise === null ? 1 : 0) ||
        parDate(a.date_promise, b.date_promise) ||
        parDate(a.created_at, b.created_at),
    );
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const lib = libelles();
  return {
    items: tri.slice((page - 1) * limit, page * limit).map((d) => {
      const r = ligne(d);
      return { ...presenter(r, user, lib), actions: actionsDisponibles(user, r).map((a) => a.id) };
    }),
    total: tri.length,
    page,
    limit,
    compteurs,
  };
}

/** Dossier visible par l'utilisateur, ou 404. */
export function charger(user: UserDemo, id: number): DossierDemo {
  const d = E().dossiers.find((x) => x.id === id);
  if (!d || !visible(user, d)) throw notFound("Ce dossier n'existe pas ou ne vous est pas accessible.");
  return d;
}

export function detail(user: UserDemo, id: number) {
  const d = charger(user, id);
  const r = ligne(d);
  const admin = user.role === 'admin';
  const montants = peutVoirMontants(user);
  const fichiers = peutVoirFichiers(user)
    ? d.fichiers
        .filter((f) => !f.deleted_at)
        .sort((a, b) => parDate(a.created_at, b.created_at))
        .map((f) => ({
          id: f.id,
          nom_original: f.nom_original,
          mime: f.mime,
          taille: f.taille,
          a_reimprimer: f.a_reimprimer,
          created_at: f.created_at,
          uploaded_by_nom: nomUtilisateur(f.uploaded_by, f.uploaded_by_nom),
        }))
    : [];
  const historique = d.evenements
    .filter((e) => (admin || e.type !== 'modification') && (montants || e.type !== 'paiement'))
    .sort((a, b) => parDate(b.created_at, a.created_at) || b.id - a.id)
    .slice(0, 200)
    .map((e) => {
      const u = utilisateur(e.user_id);
      return {
        id: e.id,
        type: e.type,
        action: e.action,
        de_statut: e.de_statut,
        vers_statut: e.vers_statut,
        commentaire: e.commentaire,
        created_at: e.created_at,
        user_id: e.user_id,
        user_nom: u?.nom ?? e.user_nom,
        user_role: u?.role ?? e.user_role,
        data: admin || !['modification', 'paiement'].includes(e.type) || (e.type === 'paiement' && montants) ? e.data : null,
      };
    });
  const paiements = montants
    ? E()
        .paiements.filter((p) => p.dossier_id === d.id)
        .sort((a, b) => parDate(b.encaisse_at, a.encaisse_at))
        .map((p) => ({
          id: p.id,
          montant: p.montant,
          mode: p.mode,
          reference: p.reference,
          statut: p.statut,
          notes: p.notes,
          encaisse_at: p.encaisse_at,
          valide_at: p.valide_at,
          motif_refus: p.motif_refus,
          encaisse_par_nom: nomUtilisateur(p.encaisse_par, p.encaisse_par_nom),
          valide_par_nom: nomUtilisateur(p.valide_par, p.valide_par_nom),
        }))
    : [];
  return {
    ...presenter(r, user),
    actions: actionsDisponibles(user, r).map((a) => a.id),
    peut_modifier: peutModifier(user, d),
    peut_supprimer: peutSupprimer(user, r),
    peut_deposer_fichiers: peutModifier(user, d),
    fichiers,
    historique,
    paiements,
    facture: admin || user.role === 'preparateur' ? d.facture : null,
  };
}

// ---------------------------------------------------------------------------
// Règles d'écriture

export function peutModifier(user: UserDemo, d: Pick<DossierDemo, 'statut' | 'preparateur_id' | 'deleted_at'>): boolean {
  if (d.deleted_at) return false;
  if (user.role === 'admin') return true;
  return user.role === 'preparateur' && d.preparateur_id === user.id && STATUTS_MODIFIABLES.includes(d.statut);
}

export function peutSupprimer(user: UserDemo, r: Pick<Ligne, 'statut' | 'preparateur_id' | 'deleted_at' | 'deja_paye' | 'en_attente_validation'>): boolean {
  if (r.deleted_at) return false;
  if (user.role === 'admin') return true;
  return user.role === 'preparateur' && r.preparateur_id === user.id && r.statut === 'en_cours' && r.deja_paye === 0 && r.en_attente_validation === 0;
}

export function evenement(
  d: DossierDemo,
  user: UserDemo | null,
  e: { type: string; action?: string | null; de?: Statut | null; vers?: Statut | null; commentaire?: string | null; data?: unknown },
): EvenementDemo {
  const ev: EvenementDemo = {
    id: prochainId('evenement'),
    type: e.type,
    action: e.action ?? null,
    de_statut: e.de ?? null,
    vers_statut: e.vers ?? null,
    commentaire: e.commentaire ?? null,
    created_at: maintenant(),
    user_id: user?.id ?? null,
    user_nom: user?.nom ?? null,
    user_role: user?.role ?? null,
    data: e.data === undefined ? null : JSON.parse(JSON.stringify(e.data)),
  };
  d.evenements.push(ev);
  return ev;
}

function toucher(d: DossierDemo) {
  d.updated_at = maintenant();
}

// ---------------------------------------------------------------------------
// Création et modification

function prixPour(machine: Machine, specs: Specs) {
  if (!specs.lignes?.length) return null;
  return calculerPrix(machine, specs, tarifsPrix(), E().parametres.prix);
}

function trouverOuCreerClient(input: { client_id?: number | null; client_nom: string; client_telephone?: string | null; client_email?: string | null }): number {
  const e = E();
  if (input.client_id) {
    const c = e.clients.find((x) => x.id === input.client_id);
    if (!c) throw badRequest('Client introuvable.');
    return c.fusionne_dans ?? c.id;
  }
  const nom = input.client_nom.trim().toLowerCase();
  const memes = e.clients.filter((c) => c.fusionne_dans === null && c.nom.trim().toLowerCase() === nom);
  memes.sort((a, b) => Number(b.telephone === (input.client_telephone ?? null)) - Number(a.telephone === (input.client_telephone ?? null)) || a.id - b.id);
  const existant = memes[0];
  if (existant) {
    if (input.client_telephone || input.client_email) {
      existant.telephone = existant.telephone ?? input.client_telephone ?? null;
      existant.email = existant.email ?? input.client_email ?? null;
      existant.updated_at = maintenant();
    }
    return existant.id;
  }
  const id = prochainId('client');
  e.clients.push({
    id,
    nom: input.client_nom.trim(),
    telephone: input.client_telephone ?? null,
    email: input.client_email ?? null,
    adresse: null,
    notes: null,
    fusionne_dans: null,
    created_at: maintenant(),
    updated_at: maintenant(),
  });
  return id;
}

function prochainNumero(serie: 'CMD'): string {
  const annee = new Date().getFullYear();
  const e = E();
  const k = `${serie}-${annee}`;
  e.compteurs[k] = (e.compteurs[k] ?? 0) + 1;
  return `${serie}-${annee}-${String(e.compteurs[k]).padStart(4, '0')}`;
}

function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export function creer(user: UserDemo, body: unknown) {
  if (user.role !== 'admin' && user.role !== 'preparateur') throw forbidden('Seuls les préparateurs et les administrateurs créent des dossiers.');
  const input = dossierCreateSchema.parse(body);
  const specs = specsSchemaFor(input.machine).parse(input.specs ?? { lignes: [], forfaits: [] }) as Specs;
  const prix = prixPour(input.machine, specs);
  if (prix && !prix.ok && (input.montant === null || input.montant === undefined)) {
    throw unprocessable('Le prix ne peut pas être calculé. Corrigez les lignes ou saisissez le montant à la main.', { erreurs: prix.erreurs });
  }
  let montant: number | null = null;
  let source: string | null = null;
  if (input.montant !== null && input.montant !== undefined) {
    montant = input.montant;
    source = 'saisi';
  } else if (prix?.ok) {
    montant = prix.total_ttc;
    source = 'calcul';
  }
  const clientId = trouverOuCreerClient(input);
  const now = maintenant();
  const d: DossierDemo = {
    id: prochainId('dossier'),
    public_id: uuid(),
    numero: prochainNumero('CMD'),
    machine: input.machine,
    statut: 'en_cours',
    client_id: clientId,
    client_nom: input.client_nom,
    client_telephone: input.client_telephone ?? null,
    client_email: input.client_email ?? null,
    description: input.description ?? null,
    consignes: input.consignes ?? null,
    specs,
    urgent: input.urgent,
    date_promise: input.date_promise ?? null,
    preparateur_id: user.id,
    imprimeur_id: null,
    livreur_id: null,
    noms: { preparateur: user.nom, imprimeur: null, livreur: null },
    commentaire_revision: null,
    date_validation: null,
    date_debut_impression: null,
    date_fin_impression: null,
    livraison_prevue_at: null,
    livre_at: null,
    termine_at: null,
    adresse_livraison: input.adresse_livraison ?? null,
    notes_livraison: null,
    montant,
    montant_source: source,
    detail_prix: prix?.ok ? prix : null,
    mode_paiement_prevu: input.mode_paiement_prevu ?? null,
    devis_id: null,
    importe: false,
    deleted_at: null,
    deleted_by: null,
    created_at: now,
    updated_at: now,
    facture: null,
    fichiers: [],
    evenements: [],
  };
  E().dossiers.push(d);
  evenement(d, user, { type: 'creation', vers: 'en_cours' });
  signalDossier(d, null, 'created');
  return d;
}

const CHAMPS_SUIVIS = [
  'client_nom',
  'client_telephone',
  'client_email',
  'description',
  'consignes',
  'montant',
  'mode_paiement_prevu',
  'urgent',
  'date_promise',
  'adresse_livraison',
  'machine',
] as const;

export function modifier(user: UserDemo, id: number, body: unknown) {
  const input = dossierUpdateSchema.parse(body);
  const d = charger(user, id);
  if (!peutModifier(user, d)) {
    throw forbidden(
      user.role === 'preparateur' && d.preparateur_id === user.id
        ? 'Le dossier est validé : demandez à un administrateur de le renvoyer en préparation pour le modifier.'
        : 'Vous ne pouvez pas modifier ce dossier.',
    );
  }
  const machine = (input.machine ?? d.machine) as Machine;
  if (input.machine && input.machine !== d.machine && d.statut !== 'en_cours' && d.statut !== 'a_revoir') {
    throw conflict('La machine ne peut plus changer après validation.');
  }
  const maj: Partial<DossierDemo> = {};
  const changes: Record<string, { avant: unknown; apres: unknown }> = {};
  const montantSaisi = input.montant !== undefined && input.montant !== null;
  const revenirAuCalcul = input.montant === null && d.montant_source === 'saisi';
  for (const k of CHAMPS_SUIVIS) {
    if (input[k] === undefined) continue;
    if (k === 'montant' && revenirAuCalcul) continue;
    const v = input[k] ?? null;
    if (JSON.stringify(v) !== JSON.stringify((d as any)[k] ?? null)) {
      changes[k] = { avant: (d as any)[k] ?? null, apres: v };
      (maj as any)[k] = v;
    }
  }
  if (montantSaisi) maj.montant_source = 'saisi';
  if (revenirAuCalcul) {
    const specsActuelles = specsSchemaFor(machine).parse(input.specs ?? d.specs) as Specs;
    const prix = prixPour(machine, specsActuelles);
    if (!prix?.ok) {
      throw unprocessable('Le prix ne peut pas être recalculé : corrigez les lignes ou gardez le montant saisi.', { erreurs: prix && !prix.ok ? prix.erreurs : [] });
    }
    if (prix.total_ttc !== d.montant) changes.montant = { avant: d.montant, apres: prix.total_ttc };
    maj.montant = prix.total_ttc;
    maj.montant_source = 'calcul';
    maj.detail_prix = prix;
  }
  if (input.specs !== undefined || input.machine) {
    const specs = specsSchemaFor(machine).parse(input.specs ?? d.specs) as Specs;
    if (JSON.stringify(specs) !== JSON.stringify(d.specs)) changes.specs = { avant: d.specs, apres: specs };
    maj.specs = specs;
    const prix = prixPour(machine, specs);
    if (prix?.ok) {
      maj.detail_prix = prix;
      if (!montantSaisi && !revenirAuCalcul && d.montant_source !== 'saisi') {
        if (prix.total_ttc !== d.montant) changes.montant = { avant: d.montant, apres: prix.total_ttc };
        maj.montant = prix.total_ttc;
        maj.montant_source = 'calcul';
      }
    } else if (prix && !prix.ok && !montantSaisi && !revenirAuCalcul && d.montant_source !== 'saisi') {
      throw unprocessable('Le prix ne peut pas être calculé. Corrigez les lignes ou saisissez le montant à la main.', { erreurs: prix.erreurs });
    }
  }
  if (input.client_nom !== undefined || input.client_id !== undefined) {
    const clientId = trouverOuCreerClient({
      client_id: input.client_id ?? null,
      client_nom: input.client_nom ?? d.client_nom,
      client_telephone: input.client_telephone ?? d.client_telephone,
      client_email: input.client_email ?? d.client_email,
    });
    if (clientId !== d.client_id) maj.client_id = clientId;
  }
  if (!Object.keys(maj).length) return d;
  Object.assign(d, maj);
  toucher(d);
  if (Object.keys(changes).length) evenement(d, user, { type: 'modification', data: changes });
  signalDossier(d, d.statut);
  return d;
}

// ---------------------------------------------------------------------------
// Circuit

export function executerAction(user: UserDemo, id: number, actionId: string, body: unknown) {
  const action = ACTIONS_BY_ID[actionId as ActionId];
  if (!action) throw notFound('Action inconnue.');
  const input: ActionInput = actionInputSchema.parse(body ?? {});
  const d = charger(user, id);
  const avant = ligne(d);
  const check = verifierAction(action, user, avant, { commentaire: input.commentaire ?? null });
  if (!check.ok) throw check.code === 'role' || check.code === 'proprietaire' || check.code === 'machine' ? forbidden(check.message) : conflict(check.message);

  const now = maintenant();
  const imprimeur = machineOfRole(user.role) !== null;
  const maj: Partial<DossierDemo> = { statut: action.to };
  switch (action.id) {
    case 'valider':
      maj.date_validation = now;
      maj.commentaire_revision = null;
      break;
    case 'demarrer':
      maj.date_debut_impression = now;
      if (imprimeur) maj.imprimeur_id = user.id;
      break;
    case 'marquer_imprime':
      maj.date_fin_impression = now;
      if (imprimeur) maj.imprimeur_id = user.id;
      break;
    case 'demander_revision':
      maj.commentaire_revision = input.commentaire ?? null;
      break;
    case 'programmer_livraison':
      if (!input.livraison?.date_prevue) throw badRequest('Indiquez la date de livraison prévue.');
      maj.livraison_prevue_at = new Date(input.livraison.date_prevue).toISOString();
      if (input.livraison.adresse) maj.adresse_livraison = input.livraison.adresse;
      if (input.livraison.notes !== undefined) maj.notes_livraison = input.livraison.notes ?? null;
      if (user.role === 'livreur') maj.livreur_id = user.id;
      break;
    case 'confirmer_livraison':
      maj.livre_at = now;
      maj.urgent = false;
      if (user.role === 'livreur') maj.livreur_id = user.id;
      break;
    case 'cloturer':
      maj.termine_at = now;
      break;
    case 'rouvrir':
      maj.termine_at = null;
      break;
    case 'reimprimer':
      maj.date_fin_impression = null;
      maj.date_debut_impression = null;
      break;
    default:
      break;
  }
  // L'encaissement à la livraison est contrôlé avant tout changement (même transaction côté serveur).
  if (action.id === 'confirmer_livraison' && input.encaissement) {
    controlerPaiement(user, avant, { montant: input.encaissement.montant, mode: input.encaissement.mode, reference: input.encaissement.reference ?? null });
  }
  const ancien = d.statut;
  Object.assign(d, maj);
  toucher(d);
  evenement(d, user, {
    type: 'statut',
    action: action.id,
    de: ancien,
    vers: action.to,
    commentaire: input.commentaire ?? null,
    data: action.id === 'programmer_livraison' ? input.livraison : undefined,
  });
  let paiement = false;
  if (action.id === 'confirmer_livraison' && input.encaissement) {
    enregistrerPaiement(user, d, {
      montant: input.encaissement.montant,
      mode: input.encaissement.mode,
      reference: input.encaissement.reference ?? null,
      notes: 'Encaissé à la livraison',
    });
    paiement = true;
  }
  signalDossier(d, ancien);
  if (paiement) signalPaiement(d.id);
  notifierTransition(user, action.id, d, input.commentaire ?? null);
  return d;
}

function notifierTransition(user: UserDemo, action: ActionId, d: DossierDemo, commentaire: string | null) {
  const ref = `${d.numero} · ${d.client_nom}`;
  switch (action) {
    case 'valider':
      notifier({ machine: d.machine }, { type: 'nouveau_travail', titre: 'Nouveau dossier à imprimer', message: ref, dossier_id: d.id });
      break;
    case 'demander_revision':
      if (d.preparateur_id)
        notifier({ userIds: [d.preparateur_id], roles: ['admin'], exclure: user.id }, { type: 'revision', titre: `Révision demandée : ${d.numero}`, message: commentaire, dossier_id: d.id });
      break;
    case 'marquer_imprime':
      notifier({ roles: ['livreur'], userIds: d.preparateur_id ? [d.preparateur_id] : [] }, { type: 'pret_livraison', titre: 'Dossier prêt à livrer', message: ref, dossier_id: d.id });
      break;
    case 'confirmer_livraison':
      notifier({ roles: ['admin'], userIds: d.preparateur_id ? [d.preparateur_id] : [], exclure: user.id }, { type: 'livre', titre: `Dossier livré : ${d.numero}`, message: d.client_nom, dossier_id: d.id });
      break;
    default:
      break;
  }
}

export function forcerStatut(user: UserDemo, id: number, body: any) {
  if (user.role !== 'admin') throw forbidden();
  const statut = typeof body?.statut === 'string' ? body.statut : '';
  const commentaire = typeof body?.commentaire === 'string' ? body.commentaire : null;
  if (!isStatut(statut)) throw badRequest('Statut inconnu.');
  if (!commentaire || commentaire.trim().length < 3) throw badRequest('Expliquez pourquoi vous forcez le statut.');
  const d = charger(user, id);
  if (d.statut === statut) throw conflict('Le dossier a déjà ce statut.');
  const ancien = d.statut;
  d.statut = statut;
  toucher(d);
  evenement(d, user, { type: 'statut', action: 'forcer', de: ancien, vers: statut, commentaire });
  journal(user, 'dossier_statut_force', 'dossier', id, { numero: d.numero, de: ancien, vers: statut, commentaire, user_id: user.id });
  signalDossier(d, ancien);
  return d;
}

export function reporterLivraison(user: UserDemo, id: number, body: any) {
  if (user.role !== 'livreur' && user.role !== 'admin') throw forbidden();
  const date = typeof body?.date_prevue === 'string' && body.date_prevue.length >= 10 ? body.date_prevue : null;
  if (!date) throw badRequest('Certains champs sont invalides.', { champs: { date_prevue: 'Date invalide' } });
  const motif = typeof body?.motif === 'string' ? body.motif.slice(0, 500) : null;
  const d = charger(user, id);
  if (d.statut !== 'en_livraison' && d.statut !== 'pret_livraison') throw conflict("Ce dossier n'est pas en cours de livraison.");
  const avant = d.livraison_prevue_at;
  d.livraison_prevue_at = new Date(date).toISOString();
  toucher(d);
  evenement(d, user, { type: 'livraison', action: 'reporter', commentaire: motif, data: { avant, apres: date } });
  signalDossier(d, d.statut);
  return d;
}

export function definirUrgence(user: UserDemo, id: number, body: any) {
  if (typeof body?.urgent !== 'boolean') throw badRequest('Certains champs sont invalides.', { champs: { urgent: 'Oui ou non' } });
  const urgent: boolean = body.urgent;
  const d = charger(user, id);
  const ok = user.role === 'admin' || (user.role === 'preparateur' && d.preparateur_id === user.id);
  if (!ok) throw forbidden("Seul le préparateur du dossier ou un administrateur peut changer l'urgence.");
  if (d.urgent === urgent) return d;
  d.urgent = urgent;
  toucher(d);
  evenement(d, user, { type: 'urgence', data: { urgent } });
  signalDossier(d, d.statut);
  if (urgent && ['pret_impression', 'en_impression'].includes(d.statut)) {
    notifier({ machine: d.machine }, { type: 'urgent', titre: 'Dossier passé en urgent', message: `${d.numero} · ${d.client_nom}`, dossier_id: d.id });
  }
  return d;
}

export function affecter(user: UserDemo, id: number, body: any) {
  if (user.role !== 'admin') throw forbidden();
  const d = charger(user, id);
  const choix: { imprimeur_id?: number | null; livreur_id?: number | null } = {};
  for (const k of ['imprimeur_id', 'livreur_id'] as const) {
    const v = body?.[k];
    if (v === undefined) continue;
    if (v !== null) {
      const u = utilisateur(Number(v));
      const attendu = k === 'livreur_id' ? 'livreur' : `imprimeur_${d.machine}`;
      if (!u || !u.is_active || u.role !== attendu) {
        throw badRequest(k === 'livreur_id' ? 'Choisissez un livreur actif.' : `Choisissez un imprimeur ${d.machine === 'roland' ? 'Roland' : 'Xerox'} actif.`);
      }
    }
    choix[k] = v === null ? null : Number(v);
  }
  if (!Object.keys(choix).length) return d;
  Object.assign(d, choix);
  toucher(d);
  evenement(d, user, { type: 'affectation', data: choix });
  signalDossier(d, d.statut);
  for (const uid of [choix.imprimeur_id, choix.livreur_id]) {
    if (uid) notifier({ userIds: [uid] }, { type: 'affectation', titre: 'Dossier qui vous est confié', message: `${d.numero} · ${d.client_nom}`, dossier_id: d.id });
  }
  return d;
}

export function commenter(user: UserDemo, id: number, body: any) {
  const texte = typeof body?.texte === 'string' ? body.texte : '';
  if (texte.trim().length < 2) throw badRequest('Certains champs sont invalides.', { champs: { texte: 'Le commentaire est vide.' } });
  const d = charger(user, id);
  evenement(d, user, { type: 'commentaire', commentaire: texte.trim().slice(0, 2000) });
  signalDossier(d, d.statut);
}

export function supprimer(user: UserDemo, id: number, body: any) {
  const motif = typeof body?.motif === 'string' ? body.motif.slice(0, 500) : null;
  const d = charger(user, id);
  if (!peutSupprimer(user, ligne(d))) {
    throw forbidden(user.role === 'preparateur' ? 'Vous ne pouvez supprimer que vos dossiers en préparation, sans paiement.' : 'Vous ne pouvez pas supprimer ce dossier.');
  }
  d.deleted_at = maintenant();
  d.deleted_by = user.id;
  toucher(d);
  evenement(d, user, { type: 'suppression', commentaire: motif });
  journal(user, 'dossier_supprime', 'dossier', id, { numero: d.numero, client: d.client_nom, motif, user_id: user.id });
  signalDossier(d, d.statut, 'deleted');
}

export function restaurer(user: UserDemo, id: number) {
  if (user.role !== 'admin') throw forbidden();
  const d = E().dossiers.find((x) => x.id === id && x.deleted_at);
  if (!d) {
    if (E().corbeille.some((c) => c.id === id)) {
      throw forbidden('Démonstration : ce dossier a été supprimé avant l’enregistrement des données ; il ne peut pas être restauré ici.');
    }
    throw notFound("Ce dossier n'est pas dans la corbeille.");
  }
  d.deleted_at = null;
  d.deleted_by = null;
  toucher(d);
  evenement(d, user, { type: 'restauration' });
  journal(user, 'dossier_restaure', 'dossier', id, { numero: d.numero, user_id: user.id });
  signalDossier(d, null, 'created');
  return d;
}

// ---------------------------------------------------------------------------
// Paiements rattachés à un dossier

const MODES_REFERENCE = ['wave', 'orange_money', 'virement', 'cheque'];

export function controlerPaiement(
  user: UserDemo,
  r: Pick<Ligne, 'montant' | 'deja_paye' | 'en_attente_validation'>,
  p: { montant: number; mode: string; reference: string | null },
) {
  if (!['admin', 'preparateur', 'livreur'].includes(user.role)) throw forbidden();
  if (MODES_REFERENCE.includes(p.mode) && !p.reference) throw badRequest('La référence de la transaction est obligatoire pour ce mode de paiement.');
  if (r.montant !== null) {
    const reste = r.montant - r.deja_paye - r.en_attente_validation;
    if (p.montant > reste) {
      throw conflict(reste <= 0 ? 'Ce dossier est déjà entièrement payé (ou en attente de validation).' : `Le montant dépasse le reste à payer (${reste} FCFA).`);
    }
  }
}

export function enregistrerPaiement(user: UserDemo, d: DossierDemo, p: { montant: number; mode: any; reference: string | null; notes: string | null }): number {
  controlerPaiement(user, ligne(d), p);
  const statut = user.role === 'admin' ? 'valide' : 'a_valider';
  const now = maintenant();
  const id = prochainId('paiement');
  E().paiements.push({
    id,
    dossier_id: d.id,
    montant: p.montant,
    mode: p.mode,
    reference: p.reference,
    statut,
    notes: p.notes,
    encaisse_par: user.id,
    encaisse_par_nom: user.nom,
    encaisse_at: now,
    valide_par: statut === 'valide' ? user.id : null,
    valide_par_nom: statut === 'valide' ? user.nom : null,
    valide_at: statut === 'valide' ? now : null,
    motif_refus: null,
  });
  evenement(d, user, {
    type: 'paiement',
    action: statut === 'valide' ? 'encaisse_valide' : 'encaisse',
    data: { paiement_id: id, montant: p.montant, mode: p.mode, reference: p.reference },
  });
  if (statut === 'a_valider') {
    notifier({ roles: ['admin'], exclure: user.id }, { type: 'paiement_a_valider', titre: 'Paiement à valider', message: formatFCFA(p.montant), dossier_id: d.id });
  }
  return id;
}
