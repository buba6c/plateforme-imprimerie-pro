// Fonctions pures de normalisation des valeurs de l'ancienne base (aucun accès disque ni base).

import { MODES_PAIEMENT, STATUTS, type Machine, type ModePaiement, type Statut, type StatutPaiement } from '@evocom/shared';

export function sansAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Texte nettoyé : NFC, espaces de bord retirés, espaces multiples réduits. Chaîne vide → null. */
export function texte(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).normalize('NFC').replace(/[\s  ]+/g, ' ').trim();
  return s === '' ? null : s;
}

/** Texte multiligne : garde les retours à la ligne, retire les espaces de bord. */
export function texteLong(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).normalize('NFC').trim();
  return s === '' ? null : s;
}

/** Clé de regroupement d'un nom de client : espaces réduits, insensible à la casse. */
export function cleClient(nom: string): string {
  return (texte(nom) ?? '').toLocaleLowerCase('fr');
}

export function estUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

export function estEntier(v: unknown): boolean {
  return (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && /^\s*\d+\s*$/.test(v));
}

export function estEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function booleen(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['t', 'true', '1', 'oui', 'yes', 'on'].includes(s)) return true;
  if (['f', 'false', '0', 'non', 'no', 'off'].includes(s)) return false;
  return null;
}

/** Entier positif (identifiant), ou null. */
export function entier(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return Number(v);
  return null;
}

/** JSON éventuellement double-encodé (jsonb de type string) : renvoie la valeur décodée. */
export function decoderJson(v: unknown): { valeur: unknown; doubleEncode: boolean; invalide: boolean } {
  if (typeof v !== 'string') return { valeur: v, doubleEncode: false, invalide: false };
  const s = v.trim();
  if (!(s.startsWith('{') || s.startsWith('['))) return { valeur: v, doubleEncode: false, invalide: s !== '' };
  try {
    return { valeur: JSON.parse(s), doubleEncode: true, invalide: false };
  } catch {
    return { valeur: v, doubleEncode: false, invalide: true };
  }
}

export function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Statuts

const ALIAS_STATUT: Record<string, Statut> = {
  en_cours: 'en_cours',
  nouveau: 'en_cours',
  en_preparation: 'en_cours',
  brouillon: 'en_cours',
  a_revoir: 'a_revoir',
  revoir: 'a_revoir',
  pret_impression: 'pret_impression',
  pret_a_imprimer: 'pret_impression',
  pret_pour_impression: 'pret_impression',
  en_impression: 'en_impression',
  imprime: 'pret_livraison',
  pret_livraison: 'pret_livraison',
  pret_a_livrer: 'pret_livraison',
  pret_pour_livraison: 'pret_livraison',
  en_livraison: 'en_livraison',
  livre: 'livre',
  termine: 'termine',
  fini: 'termine',
};

/** 'Prêt impression' → 'pret_impression', 'À revoir' → 'a_revoir'. */
export function cleStatut(raw: string): string {
  return sansAccents(raw)
    .toLowerCase()
    .trim()
    .replace(/[\s\-'’]+/g, '_')
    .replace(/_+/g, '_');
}

/** Statut v2 correspondant à une valeur de l'ancienne base (snake_case ou libellé français), ou null si inconnu. */
export function normaliserStatut(raw: unknown): Statut | null {
  const s = texte(raw);
  if (!s) return null;
  const k = cleStatut(s);
  if ((STATUTS as readonly string[]).includes(k)) return k as Statut;
  return ALIAS_STATUT[k] ?? null;
}

const ALIAS_STATUT_PAIEMENT: Record<string, StatutPaiement> = {
  approuve: 'valide',
  valide: 'valide',
  paye: 'valide',
  encaisse_livreur: 'a_valider',
  encaisse: 'a_valider',
  en_attente: 'a_valider',
  a_valider: 'a_valider',
  refuse: 'refuse',
  rejete: 'refuse',
};

export function normaliserStatutPaiement(raw: unknown): StatutPaiement | null {
  const s = texte(raw);
  if (!s) return null;
  return ALIAS_STATUT_PAIEMENT[cleStatut(s)] ?? null;
}

// ---------------------------------------------------------------------------
// Modes de paiement

const ALIAS_MODE: Record<string, ModePaiement> = {
  especes: 'especes',
  espece: 'especes',
  cash: 'especes',
  liquide: 'especes',
  wave: 'wave',
  orangemoney: 'orange_money',
  orange: 'orange_money',
  om: 'orange_money',
  cb: 'carte',
  carte: 'carte',
  cartebancaire: 'carte',
  visa: 'carte',
  tpe: 'carte',
  cheque: 'cheque',
  cheques: 'cheque',
  chq: 'cheque',
  virement: 'virement',
  virementbancaire: 'virement',
};

/** Valeurs qui ne sont pas des modes de paiement (ex. « à la livraison »). */
const PAS_UN_MODE = new Set(['alalivraison', 'livraison', 'nonpaye', 'aucun', 'autre']);

export function normaliserMode(raw: unknown): { mode: ModePaiement | null; inconnu: boolean } {
  const s = texte(raw);
  if (!s) return { mode: null, inconnu: false };
  const k = sansAccents(s).toLowerCase().replace(/[^a-z]/g, '');
  if ((MODES_PAIEMENT as readonly string[]).includes(s)) return { mode: s as ModePaiement, inconnu: false };
  if (ALIAS_MODE[k]) return { mode: ALIAS_MODE[k]!, inconnu: false };
  if (PAS_UN_MODE.has(k)) return { mode: null, inconnu: false };
  return { mode: null, inconnu: true };
}

// ---------------------------------------------------------------------------
// Machines

export function normaliserMachine(raw: unknown): Machine | null {
  const s = texte(raw);
  if (!s) return null;
  const k = s.toLowerCase();
  if (k.startsWith('roland')) return 'roland';
  if (k.startsWith('xerox')) return 'xerox';
  return null;
}

/** Devine la machine d'après la forme des spécifications (supports Roland au m², documents Xerox). */
export function deduireMachine(data: unknown, sections: unknown, supports: unknown): Machine | null {
  if (Array.isArray(supports) && supports.length > 0) return 'roland';
  if (Array.isArray(sections) && sections.length > 0) return 'xerox';
  if (!estObjet(data)) return null;
  const cles = Object.keys(data);
  const roland = ['type_support', 'largeur', 'hauteur', 'surface_m2', 'support', 'finition_oeillets'].some((k) => cles.includes(k));
  const xerox = ['type_document', 'format', 'nombre_pages', 'grammage', 'couleur_impression'].some((k) => cles.includes(k));
  if (roland && !xerox) return 'roland';
  if (xerox && !roland) return 'xerox';
  return null;
}

// ---------------------------------------------------------------------------
// Montants

export type Montant =
  | { ok: true; valeur: number; texte: boolean; note: string | null }
  | { ok: false; raison: string };

/**
 * Lit un montant FCFA : nombre JSON, NUMERIC, ou chaîne saisie à la main
 * (« 42 000 », « 15000.00 », « 15.000 », « 12 500,50 FCFA »). Renvoie null si absent.
 */
export function lireMontant(v: unknown): Montant | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { ok: false, raison: 'nombre invalide' };
    if (v < 0) return { ok: false, raison: 'montant négatif' };
    return { ok: true, valeur: v, texte: false, note: null };
  }
  if (typeof v !== 'string') return { ok: false, raison: `type inattendu (${typeof v})` };
  const brut = v.trim();
  if (brut === '') return null;
  let s = brut
    .replace(/[\s  ]+/g, '')
    .replace(/(f\.?cfa|cfa|xof|francs?|f)$/i, '')
    .replace(/^(f\.?cfa|cfa|xof)/i, '');
  if (s.startsWith('-')) return { ok: false, raison: 'montant négatif' };
  if (s.startsWith('+')) s = s.slice(1);
  let note: string | null = null;
  let n: number;
  if (/^\d+$/.test(s)) {
    n = Number(s);
  } else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    n = Number(s.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    n = Number(s.replace(/,/g, ''));
  } else if (/^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(s)) {
    // « 15.000 » ou « 15,000 » : le FCFA n'a pas de centimes, on lit un séparateur de milliers.
    n = Number(s.replace(/[.,]/g, ''));
    note = 'séparateur de milliers interprété';
  } else if (/^\d+[.,]\d+$/.test(s)) {
    n = Number(s.replace(',', '.'));
  } else {
    return { ok: false, raison: `valeur non numérique « ${brut.slice(0, 60)} »` };
  }
  if (!Number.isFinite(n)) return { ok: false, raison: `valeur non numérique « ${brut.slice(0, 60)} »` };
  const estTexteNettoye = brut !== String(n) && !/^\d+(\.\d+)?$/.test(brut);
  return { ok: true, valeur: n, texte: estTexteNettoye, note };
}

/** Arrondi FCFA (entier). */
export function arrondirFcfa(n: number): number {
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Noms de fichiers

/** Répare un nom en « mojibake » (UTF-8 relu en Latin-1 : « cafÃ© » → « café »). Renvoie null si rien à réparer. */
export function reparerMojibake(s: string): string | null {
  if (!/[ÂÃÅ][\u0080-¿]/.test(s)) return null;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0xff) return null;
  const r = Buffer.from(s, 'latin1').toString('utf8');
  if (r.includes('�') || r === s) return null;
  return r.normalize('NFC');
}

/** Retire le préfixe d'horodatage des noms stockés (« 1767600000000_Affiche.pdf » → « Affiche.pdf »). */
export function sansHorodatage(nom: string): string {
  return nom.replace(/^\d{10,}[_-]/, '');
}

export function aHorodatage(nom: string): boolean {
  return /^\d{10,}[_-]./.test(nom);
}

const MIME_PAR_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  ai: 'application/postscript',
  eps: 'application/postscript',
  ps: 'application/postscript',
  psd: 'image/vnd.adobe.photoshop',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  txt: 'text/plain',
  cdr: 'application/vnd.corel-draw',
};

export function mimeDepuisNom(nom: string): string | null {
  const ext = nom.toLowerCase().split('.').pop() ?? '';
  return MIME_PAR_EXT[ext] ?? null;
}

// ---------------------------------------------------------------------------
// Dates (valeurs texte de PostgreSQL, sans conversion de fuseau côté Node)

/** « 2025-10-06 16:20:00 » ou « 2025-10-06T16:20:00 » → forme ISO locale « 2025-10-06T16:20:00 ». */
export function horodatage(v: unknown): string | null {
  const s = texte(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.replace(' ', 'T');
}

export function jourDe(ts: string | null): string | null {
  return ts ? ts.slice(0, 10) : null;
}

/** Plus petit / plus grand horodatage (comparaison lexicographique de valeurs ISO sans fuseau). */
export function plusTot(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

export function plusTard(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Date seule (« 2025-10-06 ») précisée par un horodatage du même jour quand il existe :
 * la colonne DATE de l'ancienne base a perdu l'heure.
 */
export function preciserDate(date: string | null, candidats: (string | null | undefined)[]): string | null {
  if (!date) return null;
  if (date.length > 10) return date;
  for (const c of candidats) if (c && c.slice(0, 10) === date) return c;
  return `${date}T00:00:00`;
}
