// Périodes et dates du calendrier de l'entreprise (AAAA-MM-JJ, sans heure).
import type { Pas, Periode } from './types';

export const FUSEAU_DEFAUT = 'Africa/Dakar';

/** Date du jour (AAAA-MM-JJ) dans le fuseau de l'entreprise. */
export function aujourdhui(fuseau: string = FUSEAU_DEFAUT): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function utc(d: string): Date {
  return new Date(`${d.slice(0, 10)}T00:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(d: string, n: number): string {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
}

export function ajouterMois(d: string, n: number): string {
  const x = utc(d);
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  return iso(x);
}

/** Lundi de la semaine de d. */
export function debutSemaine(d: string): string {
  const x = utc(d);
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return iso(x);
}

export function debutMois(d: string): string {
  return `${d.slice(0, 7)}-01`;
}

export function finMois(d: string): string {
  return ajouterJours(ajouterMois(debutMois(d), 1), -1);
}

export function debutAnnee(d: string): string {
  return `${d.slice(0, 4)}-01-01`;
}

export const PERIODE_LABELS: Record<Periode, string> = {
  jour: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois',
  annee: 'Cette année',
};

/** Bornes calendaires d'une période de l'aperçu (jusqu'à aujourd'hui inclus). */
export function bornesPeriode(p: Periode, today: string): { from: string; to: string } {
  switch (p) {
    case 'jour':
      return { from: today, to: today };
    case 'semaine':
      return { from: debutSemaine(today), to: today };
    case 'mois':
      return { from: debutMois(today), to: today };
    case 'annee':
      return { from: debutAnnee(today), to: today };
  }
}

export interface Preset {
  id: string;
  label: string;
  bornes: (today: string) => { from: string; to: string };
  pas: Pas;
}

export const PRESETS: Preset[] = [
  { id: '7j', label: '7 derniers jours', bornes: (t) => ({ from: ajouterJours(t, -6), to: t }), pas: 'jour' },
  { id: '30j', label: '30 derniers jours', bornes: (t) => ({ from: ajouterJours(t, -29), to: t }), pas: 'jour' },
  { id: 'mois', label: 'Ce mois', bornes: (t) => ({ from: debutMois(t), to: t }), pas: 'jour' },
  {
    id: 'mois_prec',
    label: 'Mois dernier',
    bornes: (t) => {
      const debut = ajouterMois(debutMois(t), -1);
      return { from: debut, to: finMois(debut) };
    },
    pas: 'jour',
  },
  { id: 'trim', label: '3 derniers mois', bornes: (t) => ({ from: ajouterMois(debutMois(t), -2), to: t }), pas: 'semaine' },
  { id: 'annee', label: 'Cette année', bornes: (t) => ({ from: debutAnnee(t), to: t }), pas: 'mois' },
  { id: '12m', label: '12 derniers mois', bornes: (t) => ({ from: ajouterMois(debutMois(t), -11), to: t }), pas: 'mois' },
];

/** Début du regroupement contenant d. */
export function debutBucket(d: string, pas: Pas): string {
  if (pas === 'jour') return d.slice(0, 10);
  if (pas === 'semaine') return debutSemaine(d);
  return debutMois(d);
}

/** Tous les débuts de regroupement entre from et to (limité à 400 points). */
export function buckets(from: string, to: string, pas: Pas): string[] {
  const out: string[] = [];
  let cur = debutBucket(from, pas);
  while (cur <= to && out.length < 400) {
    out.push(cur);
    cur = pas === 'jour' ? ajouterJours(cur, 1) : pas === 'semaine' ? ajouterJours(cur, 7) : ajouterMois(cur, 1);
  }
  return out;
}

const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Libellé d'axe : 02/10, 02/10 (semaine), oct. 26. */
export function libelleAxe(d: string, pas: Pas): string {
  const [y, m, j] = d.slice(0, 10).split('-');
  if (pas === 'mois') return `${MOIS_COURT[Number(m) - 1] ?? m} ${y?.slice(2)}`;
  return `${j}/${m}`;
}

/** Libellé complet pour l'infobulle : « jeudi 2 octobre 2026 », « semaine du 29/09/2026 », « octobre 2026 ». */
export function libelleLong(d: string, pas: Pas): string {
  const [y, m, j] = d.slice(0, 10).split('-');
  if (pas === 'mois') return `${MOIS_LONG[Number(m) - 1] ?? m} ${y}`;
  if (pas === 'semaine') return `Semaine du ${j}/${m}/${y}`;
  const date = utc(d);
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** jj/mm/aaaa à partir de AAAA-MM-JJ, sans décalage horaire. */
export function jourFr(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, j] = d.slice(0, 10).split('-');
  return `${j}/${m}/${y}`;
}

/** Nombre de jours entiers entre deux dates AAAA-MM-JJ. */
export function joursEntre(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
}
