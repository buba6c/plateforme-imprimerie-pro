// Dates « humaines » pour les écrans de livraison (heure locale de l'appareil).

import { formatHeure } from '@evocom/shared';

const JOUR_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const JOUR_ABR_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function debutJour(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Nombre de jours calendaires entre aujourd'hui et la date (0 = aujourd'hui, 1 = demain, -1 = hier). */
export function ecartJours(value: string | Date, now: Date = new Date()): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Math.round((debutJour(d).getTime() - debutJour(now).getTime()) / 86_400_000);
}

/** « Aujourd'hui », « Demain », « Hier » ou « Lundi 5 octobre ». */
export function libelleJour(value: string | Date, now: Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const e = ecartJours(d, now);
  if (e === 0) return "Aujourd'hui";
  if (e === 1) return 'Demain';
  if (e === -1) return 'Hier';
  return majuscule(JOUR_FMT.format(d));
}

/** « Aujourd'hui à 17:50 », « Demain à 09:00 », « Lun. 5 oct. à 09:00 ». */
export function libelleRendezVous(value: string | Date, now: Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const e = ecartJours(d, now);
  const jour = e === 0 ? "Aujourd'hui" : e === 1 ? 'Demain' : e === -1 ? 'Hier' : majuscule(JOUR_ABR_FMT.format(d));
  return `${jour} à ${formatHeure(d)}`;
}

export function dateDuJour(now: Date = new Date()): string {
  return majuscule(JOUR_FMT.format(now));
}

/** Date locale AAAA-MM-JJ (paramètres from/to de l'API). */
export function isoJour(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Valeur d'un champ datetime-local (AAAA-MM-JJTHH:MM), heure locale. */
export function valeurDateHeure(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${isoJour(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Jour J + n à une heure ronde. */
export function jourA(n: number, heure: number, now: Date = new Date()): Date {
  const d = debutJour(now);
  d.setDate(d.getDate() + n);
  d.setHours(heure, 0, 0, 0);
  return d;
}
