// État de la démonstration : les données de départ (enregistrées depuis l'API réelle) recalées sur la
// date du jour, puis modifiées en mémoire par les actions de l'utilisateur. Gardé dans
// sessionStorage pour survivre au rechargement de la page (si le navigateur le permet).

import type { Machine, ModePaiement, Role, Specs, Statut, StatutPaiement } from '@evocom/shared';
import seed from './donnees/domaine.json';
import { ecartJours, jourDans, recaler, type Decalage } from './dates';

export interface FichierDemo {
  id: number;
  nom_original: string;
  mime: string | null;
  taille: number;
  a_reimprimer: boolean;
  created_at: string;
  uploaded_by: number | null;
  uploaded_by_nom: string | null;
  deleted_at: string | null;
}

export interface EvenementDemo {
  id: number;
  type: string;
  action: string | null;
  de_statut: Statut | null;
  vers_statut: Statut | null;
  commentaire: string | null;
  created_at: string;
  user_id: number | null;
  /** Repris des données enregistrées quand l'auteur n'est plus dans l'annuaire. */
  user_nom: string | null;
  user_role: Role | null;
  data: any;
}

export interface FactureDossier {
  id: number;
  numero: string;
  total_ttc: number;
  date_emission: string;
}

export interface DossierDemo {
  id: number;
  public_id: string;
  numero: string;
  machine: Machine;
  statut: Statut;
  client_id: number | null;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  description: string | null;
  consignes: string | null;
  specs: Specs;
  urgent: boolean;
  date_promise: string | null;
  preparateur_id: number | null;
  imprimeur_id: number | null;
  livreur_id: number | null;
  noms: { preparateur: string | null; imprimeur: string | null; livreur: string | null };
  commentaire_revision: string | null;
  date_validation: string | null;
  date_debut_impression: string | null;
  date_fin_impression: string | null;
  livraison_prevue_at: string | null;
  livre_at: string | null;
  termine_at: string | null;
  adresse_livraison: string | null;
  notes_livraison: string | null;
  montant: number | null;
  montant_source: string | null;
  detail_prix: any;
  mode_paiement_prevu: ModePaiement | null;
  devis_id: number | null;
  importe: boolean;
  deleted_at: string | null;
  deleted_by: number | null;
  created_at: string;
  updated_at: string;
  facture: FactureDossier | null;
  fichiers: FichierDemo[];
  evenements: EvenementDemo[];
}

export interface PaiementDemo {
  id: number;
  dossier_id: number;
  montant: number;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  notes: string | null;
  encaisse_par: number | null;
  encaisse_par_nom: string | null;
  encaisse_at: string;
  valide_par: number | null;
  valide_par_nom: string | null;
  valide_at: string | null;
  motif_refus: string | null;
}

export interface ClientDemo {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  notes: string | null;
  fusionne_dans: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserDemo {
  id: number;
  nom: string;
  email: string;
  telephone: string | null;
  role: Role;
  is_active: boolean;
  doit_changer_mdp: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TarifDemo {
  id: number;
  machine: Machine | 'global';
  categorie: 'support' | 'finition' | 'option' | 'divers';
  code: string;
  libelle: string;
  unite: any;
  prix: number | null;
  actif: boolean;
  ordre: number;
  description: string | null;
  [k: string]: unknown;
}

export interface NotificationDemo {
  id: number;
  user_id: number;
  type: string;
  titre: string;
  message: string | null;
  dossier_id: number | null;
  lu_at: string | null;
  created_at: string;
}

/** Dossier supprimé avant l'enregistrement : seule sa ligne de corbeille est connue. */
export interface CorbeilleImportee {
  id: number;
  numero: string;
  machine: Machine;
  client_nom: string;
  statut: Statut;
  montant: number | null;
  deleted_at: string;
  deleted_by: number | null;
  deleted_by_nom: string | null;
  motif: string | null;
  nb_paiements: number;
}

export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  palette: 'evocom' | 'sobre' | 'perso' | null;
  contraste: 'normal' | 'eleve';
}

type Sequence = 'dossier' | 'evenement' | 'fichier' | 'paiement' | 'notification' | 'client' | 'tarif' | 'user' | 'journal';

export interface Etat {
  version: number;
  /** Date d'enregistrement des données de départ. */
  source: string;
  decalage: Decalage;
  userId: number | null;
  seq: Record<Sequence, number>;
  compteurs: Record<string, number>;
  dossiers: DossierDemo[];
  corbeille: CorbeilleImportee[];
  paiements: PaiementDemo[];
  clients: ClientDemo[];
  users: UserDemo[];
  tarifs: TarifDemo[];
  parametres: any;
  regles: any;
  apparence: any;
  preferences: Record<number, Preferences>;
  notifications: NotificationDemo[];
  /** Journal d'audit des actions faites pendant la démonstration (ajouté devant le journal enregistré). */
  journal: Array<{ id: number; user_id: number | null; action: string; cible: string; cible_id: string | null; data: unknown; created_at: string }>;
  /** Paramètres de la configuration de l'assistant IA modifiés pendant la démonstration. */
  ia: { actif: boolean; modele: string | null };
}

const VERSION = 1;
const CLE = 'evocom.demo.etat';

let etat: Etat | null = null;
let persistance = true;

export function maintenant(): string {
  return new Date().toISOString();
}

/** Données de départ, recalées sur aujourd'hui. */
export function semer(now: Date = new Date(), decalageImpose?: Decalage): Etat {
  const s0 = seed as any;
  const fuseau: string = s0.parametres?.fuseau ?? 'Africa/Dakar';
  const enregistre = new Date(s0.enregistre_le);
  const decalage: Decalage = decalageImpose ?? {
    ms: Math.max(0, now.getTime() - enregistre.getTime()),
    jours: Math.max(0, ecartJours(jourDans(fuseau, enregistre), jourDans(fuseau, now))),
  };
  const s = recaler(s0, decalage);
  const users: UserDemo[] = s.users.map((u: any) => ({
    id: u.id,
    nom: u.nom,
    email: u.email,
    telephone: u.telephone ?? null,
    role: u.role,
    is_active: u.is_active,
    doit_changer_mdp: false,
    last_login_at: u.last_login_at ?? null,
    created_at: u.created_at,
  }));
  const parNom = new Map(users.map((u) => [u.nom, u.id]));

  const dossiers: DossierDemo[] = s.dossiers.map((d: any) => ({
    id: d.id,
    public_id: d.public_id,
    numero: d.numero,
    machine: d.machine,
    statut: d.statut,
    client_id: d.client_id ?? null,
    client_nom: d.client_nom,
    client_telephone: d.client_telephone ?? null,
    client_email: d.client_email ?? null,
    description: d.description ?? null,
    consignes: d.consignes ?? null,
    specs: d.specs ?? { lignes: [], forfaits: [] },
    urgent: !!d.urgent,
    date_promise: d.date_promise ?? null,
    preparateur_id: d.preparateur_id ?? null,
    imprimeur_id: d.imprimeur_id ?? null,
    livreur_id: d.livreur_id ?? null,
    noms: { preparateur: d.preparateur_nom ?? null, imprimeur: d.imprimeur_nom ?? null, livreur: d.livreur_nom ?? null },
    commentaire_revision: d.commentaire_revision ?? null,
    date_validation: d.date_validation ?? null,
    date_debut_impression: d.date_debut_impression ?? null,
    date_fin_impression: d.date_fin_impression ?? null,
    livraison_prevue_at: d.livraison_prevue_at ?? null,
    livre_at: d.livre_at ?? null,
    termine_at: d.termine_at ?? null,
    adresse_livraison: d.adresse_livraison ?? null,
    notes_livraison: d.notes_livraison ?? null,
    montant: d.montant ?? null,
    montant_source: d.montant_source ?? null,
    detail_prix: d.detail_prix ?? null,
    mode_paiement_prevu: d.mode_paiement_prevu ?? null,
    devis_id: d.devis_id ?? null,
    importe: !!d.importe,
    deleted_at: null,
    deleted_by: null,
    created_at: d.created_at,
    updated_at: d.updated_at,
    facture: d.facture ?? null,
    fichiers: (d.fichiers ?? []).map((f: any) => ({
      id: f.id,
      nom_original: f.nom_original,
      mime: f.mime ?? null,
      taille: f.taille,
      a_reimprimer: !!f.a_reimprimer,
      created_at: f.created_at,
      uploaded_by: f.uploaded_by_nom ? (parNom.get(f.uploaded_by_nom) ?? null) : null,
      uploaded_by_nom: f.uploaded_by_nom ?? null,
      deleted_at: null,
    })),
    evenements: (d.historique ?? []).map((e: any) => ({
      id: e.id,
      type: e.type,
      action: e.action ?? null,
      de_statut: e.de_statut ?? null,
      vers_statut: e.vers_statut ?? null,
      commentaire: e.commentaire ?? null,
      created_at: e.created_at,
      user_id: e.user_id ?? null,
      user_nom: e.user_nom ?? null,
      user_role: e.user_role ?? null,
      data: e.data ?? null,
    })),
  }));

  const paiements: PaiementDemo[] = s.paiements.map((p: any) => ({
    id: p.id,
    dossier_id: p.dossier_id,
    montant: p.montant,
    mode: p.mode,
    reference: p.reference ?? null,
    statut: p.statut,
    notes: p.notes ?? null,
    encaisse_par: p.encaisse_par ?? null,
    encaisse_par_nom: p.encaisse_par_nom ?? null,
    encaisse_at: p.encaisse_at,
    valide_par: p.valide_par ?? null,
    valide_par_nom: p.valide_par_nom ?? null,
    valide_at: p.valide_at ?? null,
    motif_refus: p.motif_refus ?? null,
  }));

  const clients: ClientDemo[] = s.clients.map((c: any) => ({
    id: c.id,
    nom: c.nom,
    telephone: c.telephone ?? null,
    email: c.email ?? null,
    adresse: c.adresse ?? null,
    notes: c.notes ?? null,
    fusionne_dans: c.fusionne_dans ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at ?? c.created_at,
  }));

  const notifications: NotificationDemo[] = [];
  for (const [email, liste] of Object.entries(s.notifications ?? {})) {
    const u = users.find((x) => x.email === email);
    if (!u) continue;
    for (const n of liste as any[]) notifications.push({ ...n, user_id: u.id });
  }
  const preferences: Record<number, Preferences> = {};
  for (const [email, p] of Object.entries(s.preferences ?? {})) {
    const u = users.find((x) => x.email === email);
    if (u) preferences[u.id] = p as Preferences;
  }

  const max = (l: { id: number }[]) => l.reduce((m, x) => Math.max(m, x.id), 0);
  const corbeille: CorbeilleImportee[] = s.corbeille ?? [];
  const compteurs: Record<string, number> = {};
  for (const n of [...dossiers.map((d) => d.numero), ...corbeille.map((d) => d.numero)]) {
    const m = /^(CMD)-(\d{4})-(\d+)$/.exec(n);
    if (m) compteurs[`${m[1]}-${m[2]}`] = Math.max(compteurs[`${m[1]}-${m[2]}`] ?? 0, Number(m[3]));
  }

  return {
    version: VERSION,
    source: s0.enregistre_le,
    decalage,
    userId: null,
    seq: {
      dossier: Math.max(max(dossiers), max(corbeille)),
      evenement: max(dossiers.flatMap((d) => d.evenements)),
      fichier: max(dossiers.flatMap((d) => d.fichiers)),
      paiement: max(paiements),
      notification: max(notifications),
      client: max(clients),
      tarif: max(s.tarifs),
      user: max(users),
      journal: 1_000_000,
    },
    compteurs,
    dossiers,
    corbeille,
    paiements,
    clients,
    users,
    tarifs: s.tarifs,
    parametres: s.parametres,
    regles: s.regles,
    apparence: s.apparence ?? { palette_defaut: 'evocom', couleurs_perso: null },
    preferences,
    notifications,
    journal: [],
    ia: { actif: true, modele: null },
  };
}

function lireStockage(): Etat | null {
  if (!persistance) return null;
  try {
    const brut = globalThis.sessionStorage?.getItem(CLE);
    if (!brut) return null;
    const e = JSON.parse(brut) as Etat;
    return e.version === VERSION && e.source === (seed as any).enregistre_le ? e : null;
  } catch {
    return null;
  }
}

/** Charge l'état gardé dans l'onglet, ou repart des données de départ. */
export function initialiser(opts: { persistance?: boolean; decalage?: Decalage } = {}): Etat {
  persistance = opts.persistance ?? true;
  etat = lireStockage() ?? semer(new Date(), opts.decalage);
  return etat;
}

export function E(): Etat {
  if (!etat) etat = semer();
  return etat;
}

let minuterie: ReturnType<typeof setTimeout> | null = null;

/** Enregistre l'état dans l'onglet (regroupé : une écriture par rafale de modifications). */
export function sauvegarder(immediat = false) {
  if (!persistance || !etat) return;
  const ecrire = () => {
    minuterie = null;
    try {
      globalThis.sessionStorage?.setItem(CLE, JSON.stringify(etat));
    } catch {
      /* stockage indisponible ou plein : la démonstration continue en mémoire */
    }
  };
  if (immediat) {
    if (minuterie) clearTimeout(minuterie);
    ecrire();
  } else if (!minuterie) {
    minuterie = setTimeout(ecrire, 150);
  }
}

/** Efface les modifications de la démonstration et repart des données de départ. */
export function reinitialiser(): Etat {
  if (minuterie) clearTimeout(minuterie);
  minuterie = null;
  try {
    globalThis.sessionStorage?.removeItem(CLE);
  } catch {
    /* rien */
  }
  etat = semer();
  sauvegarder(true);
  return etat;
}

export function prochainId(s: Sequence): number {
  const e = E();
  e.seq[s] += 1;
  return e.seq[s];
}

export function utilisateur(id: number | null | undefined): UserDemo | undefined {
  return id ? E().users.find((u) => u.id === id) : undefined;
}

export function nomUtilisateur(id: number | null | undefined, repli: string | null = null): string | null {
  return utilisateur(id)?.nom ?? repli;
}

/** Utilisateur connecté (au format de /auth/me), ou null. */
export function connecte(): UserDemo | null {
  const e = E();
  const u = e.userId ? utilisateur(e.userId) : undefined;
  return u && u.is_active ? u : null;
}
