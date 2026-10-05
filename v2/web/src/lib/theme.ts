// Apparence : mode clair/sombre, palette (Evocom, sobre, personnalisée) et contraste.
// Les choix de l'utilisateur sont gardés sur le serveur (et en cache local pour l'affichage immédiat) ;
// la palette par défaut et les couleurs personnalisées sont fixées par l'administrateur.

import { api } from './api';
import { paletteDerivee } from './couleurs';

export type Theme = 'system' | 'light' | 'dark';
export type Palette = 'evocom' | 'sobre' | 'perso';
export type Contraste = 'normal' | 'eleve';

export interface Apparence {
  palette_defaut: Palette;
  couleurs_perso: { debut: string; fin: string } | null;
}
export interface Preferences {
  theme: Theme;
  /** null : suivre la palette par défaut de l'entreprise. */
  palette: Palette | null;
  contraste: Contraste;
}

const CLE_PREFS = 'evocom.preferences';
const CLE_APPARENCE = 'evocom.apparence';
const CLE_ANCIEN_THEME = 'evocom.theme';

const APPARENCE_DEFAUT: Apparence = { palette_defaut: 'evocom', couleurs_perso: null };

function lire<T>(cle: string): T | null {
  try {
    const v = localStorage.getItem(cle);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function ecrire(cle: string, v: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* stockage indisponible : l'apparence reste valable pour la session */
  }
}

function prefsInitiales(): Preferences {
  const p = lire<Preferences>(CLE_PREFS);
  if (p) return { theme: p.theme ?? 'system', palette: p.palette ?? null, contraste: p.contraste ?? 'normal' };
  let ancien: string | null = null;
  try {
    ancien = localStorage.getItem(CLE_ANCIEN_THEME);
  } catch {
    /* rien */
  }
  return { theme: ancien === 'light' || ancien === 'dark' ? ancien : 'system', palette: null, contraste: 'normal' };
}

let prefs: Preferences = prefsInitiales();
let apparence: Apparence = lire<Apparence>(CLE_APPARENCE) ?? APPARENCE_DEFAUT;
let variablesPosees: string[] = [];
const abonnes = new Set<() => void>();

const sombreSysteme = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function modeEffectif(): 'light' | 'dark' {
  if (prefs.theme !== 'system') return prefs.theme;
  return sombreSysteme?.matches ? 'dark' : 'light';
}

/** Palette réellement affichée (une palette personnalisée sans couleurs retombe sur Evocom). */
export function paletteEffective(): Palette {
  const p = prefs.palette ?? apparence.palette_defaut;
  return p === 'perso' && !apparence.couleurs_perso ? 'evocom' : p;
}

function appliquer() {
  const root = document.documentElement;
  if (prefs.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', prefs.theme);
  const mode = modeEffectif();
  root.setAttribute('data-mode', mode);
  const palette = paletteEffective();
  if (palette === 'evocom') root.removeAttribute('data-palette');
  else root.setAttribute('data-palette', palette);
  if (prefs.contraste === 'eleve') root.setAttribute('data-contrast', 'high');
  else root.removeAttribute('data-contrast');

  for (const k of variablesPosees) root.style.removeProperty(k);
  variablesPosees = [];
  if (palette === 'perso' && apparence.couleurs_perso && prefs.contraste !== 'eleve') {
    const vars = paletteDerivee(apparence.couleurs_perso.debut, apparence.couleurs_perso.fin, mode);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    variablesPosees = Object.keys(vars);
  }
  abonnes.forEach((f) => f());
}

sombreSysteme?.addEventListener('change', () => {
  if (prefs.theme === 'system') appliquer();
});

export function demarrerApparence() {
  appliquer();
  void rafraichirApparence();
}

export async function rafraichirApparence() {
  try {
    apparence = await api.get<Apparence>('/apparence');
    ecrire(CLE_APPARENCE, apparence);
    appliquer();
  } catch {
    /* hors ligne : on garde le cache */
  }
}

/** Après la connexion : reprend les préférences enregistrées sur le serveur. */
export async function synchroniserPreferences() {
  try {
    prefs = await api.get<Preferences>('/preferences');
    ecrire(CLE_PREFS, prefs);
    appliquer();
  } catch {
    /* on garde les préférences locales */
  }
}

export function getPreferences(): Preferences {
  return prefs;
}
export function getApparence(): Apparence {
  return apparence;
}

/** Modifie les préférences de l'utilisateur ; enregistrées sur le serveur si une session est ouverte. */
export async function changerPreferences(p: Partial<Preferences>, enregistrer = true) {
  prefs = { ...prefs, ...p };
  ecrire(CLE_PREFS, prefs);
  appliquer();
  if (enregistrer) await api.put<Preferences>('/preferences', p).catch(() => undefined);
}

/** Aperçu immédiat d'une apparence d'entreprise (avant ou après enregistrement par l'admin). */
export function definirApparence(a: Apparence) {
  apparence = a;
  ecrire(CLE_APPARENCE, a);
  appliquer();
}

export function abonnerApparence(f: () => void): () => void {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}
