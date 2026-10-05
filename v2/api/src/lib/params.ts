// Paramètres de l'entreprise et réglages de l'application, stockés dans la table parametres
// (une ligne par section). Chaque réglage est lu là où il agit : aucun réglage décoratif.

import { PARAMS_PRIX_DEFAUT, type ParamsPrix } from '@evocom/shared';
import { query, type Db } from '../db/pool';

export interface Entreprise {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  ninea: string;
  rccm: string;
  pied_facture: string;
}

/** Connexion et mots de passe (modules auth et users, lib/auth). */
export interface Securite {
  /** Durée de validité du jeton et du cookie de session, appliquée aux sessions ouvertes ensuite. */
  session_heures: number;
  /** Échecs de connexion consécutifs avant blocage du compte. */
  echecs_avant_blocage: number;
  blocage_minutes: number;
  /** Jamais moins de 8 : le schéma partagé reste le plancher. */
  mdp_longueur_min: number;
}

/** Envoi des fichiers d'impression (tus, modules/fichiers). */
export interface ReglesFichiers {
  taille_max_mo: number;
  /** Extensions acceptées, en minuscules et sans point ; liste vide = toutes. */
  extensions: string[];
}

/** Devis et factures (modules devis et pdf). */
export interface ReglesDocuments {
  /** Validité proposée pour un nouveau devis quand la saisie ne la précise pas. */
  devis_validite_jours: number;
  /** Imprimées en bas des devis. */
  mentions_devis: string;
  /** Imprimées en bas des factures. */
  conditions_paiement: string;
}

/** Types de notification réellement émis (realtime.notifier) ; un type désactivé n'est plus envoyé à personne. */
export const TYPES_NOTIFICATION = [
  'nouveau_travail',
  'revision',
  'urgent',
  'affectation',
  'pret_livraison',
  'livre',
  'paiement_a_valider',
  'paiement_valide',
  'paiement_refuse',
] as const;
export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];
export type ReglesNotifications = Record<TypeNotification, boolean>;

export interface Parametres {
  entreprise: Entreprise;
  prix: ParamsPrix;
  /** Jours pendant lesquels un dossier livré et payé reste visible par le livreur. */
  livreur_jours_historique: number;
  fuseau: string;
  securite: Securite;
  fichiers: ReglesFichiers;
  documents: ReglesDocuments;
  notifications: ReglesNotifications;
}

/** Sections lisibles par tous les rôles ; les autres sont réservées à l'administrateur. */
export const SECTIONS_PUBLIQUES = ['entreprise', 'prix', 'livreur_jours_historique', 'fuseau'] as const;

function entierEnv(nom: string, min: number, max: number, defaut: number): number {
  const n = Number(process.env[nom]);
  return Number.isInteger(n) && n >= min && n <= max ? n : defaut;
}

/** Plafonds fixés par le serveur (variables d'environnement) : un réglage ne peut pas les dépasser. */
export function plafondsServeur() {
  return { taille_max_mo: entierEnv('MAX_UPLOAD_MB', 1, 1_048_576, 4096) };
}

// SESSION_HOURS et MAX_UPLOAD_MB donnent les valeurs initiales : une installation existante garde
// son comportement tant que l'administrateur ne change pas ces réglages.
export const PARAMETRES_DEFAUT: Parametres = {
  entreprise: { nom: 'Evocom Print', adresse: '', telephone: '', email: '', ninea: '', rccm: '', pied_facture: '' },
  prix: PARAMS_PRIX_DEFAUT,
  livreur_jours_historique: 7,
  fuseau: 'Africa/Dakar',
  securite: {
    session_heures: entierEnv('SESSION_HOURS', 1, 720, 12),
    echecs_avant_blocage: 5,
    blocage_minutes: 15,
    mdp_longueur_min: 8,
  },
  fichiers: { taille_max_mo: plafondsServeur().taille_max_mo, extensions: [] },
  documents: { devis_validite_jours: 15, mentions_devis: '', conditions_paiement: '' },
  notifications: Object.fromEntries(TYPES_NOTIFICATION.map((t) => [t, true])) as ReglesNotifications,
};

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

let cache: { at: number; value: Parametres } | null = null;

export async function getParametres(db?: Db): Promise<Parametres> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  const rows = await query<{ cle: string; valeur: any }>('SELECT cle, valeur FROM parametres', [], db);
  const map = Object.fromEntries(rows.map((r) => [r.cle, r.valeur]));
  const d = PARAMETRES_DEFAUT;
  const fichiers = { ...d.fichiers, ...objet(map.fichiers) } as ReglesFichiers;
  const value: Parametres = {
    entreprise: { ...d.entreprise, ...objet(map.entreprise) },
    prix: { ...d.prix, ...objet(map.prix) },
    livreur_jours_historique: Number(map.livreur_jours_historique ?? d.livreur_jours_historique),
    fuseau: String(map.fuseau ?? d.fuseau),
    securite: { ...d.securite, ...objet(map.securite) },
    // Le plafond du serveur l'emporte s'il a été abaissé après l'enregistrement du réglage.
    fichiers: { taille_max_mo: Math.min(Number(fichiers.taille_max_mo), plafondsServeur().taille_max_mo), extensions: Array.isArray(fichiers.extensions) ? fichiers.extensions : [] },
    documents: { ...d.documents, ...objet(map.documents) },
    notifications: { ...d.notifications, ...objet(map.notifications) } as ReglesNotifications,
  };
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateParametres() {
  cache = null;
}
