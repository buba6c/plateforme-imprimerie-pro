// Données du planning et de l'historique du livreur. Les clés commencent par « dossiers » :
// le temps réel et les actions sur un dossier les rechargent.

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ModePaiement } from '@evocom/shared';
import { api } from '../../lib/api';
import type { Historique, Planning } from './types';

export function usePlanning(f: { debut: string; fin: string; livreur_id?: number }) {
  return useQuery({
    queryKey: ['dossiers', 'livraisons', 'planning', f],
    queryFn: () => api.get<Planning>('/livraisons/planning', f),
    refetchInterval: 60_000,
  });
}

export interface FiltresHistorique {
  page: number;
  taille: number;
  du?: string;
  au?: string;
  q?: string;
  mode_paiement?: ModePaiement;
  livreur_id?: number;
}

export function useHistorique(f: FiltresHistorique) {
  return useQuery({
    queryKey: ['dossiers', 'livraisons', 'historique', f],
    queryFn: () => api.get<Historique>('/livraisons/historique', f as unknown as Record<string, string | number | undefined>),
    placeholderData: (prev) => prev,
  });
}

/** Livreurs actifs, pour le sélecteur de l'administrateur. */
export function useLivreurs(actif: boolean) {
  return useQuery({
    queryKey: ['users', 'annuaire'],
    queryFn: () => api.get<{ id: number; nom: string; role: string }[]>('/users/annuaire'),
    enabled: actif,
    staleTime: 5 * 60_000,
    select: (users) => users.filter((u) => u.role === 'livreur'),
  });
}

/** Vrai si la fenêtre est au moins aussi large que `min` pixels. */
export function useEcranLarge(min: number): boolean {
  const requete = `(min-width: ${min}px)`;
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(requete);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(requete).matches,
  );
}

// ---------------------------------------------------------------------------
// Jours AAAA-MM-JJ (calendrier de l'entreprise), calculés sans dépendre du fuseau de l'appareil.

const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (j: string) => new Date(`${j}T00:00:00Z`);

export function estJour(v: string | null): v is string {
  return !!v && JOUR_RE.test(v) && !Number.isNaN(date(v).getTime());
}

export function ajouterJours(j: string, n: number): string {
  const d = date(j);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function lundiDe(j: string): string {
  return ajouterJours(j, -((date(j).getUTCDay() + 6) % 7));
}

/** Aujourd'hui dans le fuseau donné (celui de l'appareil s'il est inconnu). */
export function aujourdhuiDans(fuseau?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FMT_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const FMT_JOUR_SEMAINE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });
const FMT_JOUR_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const FMT_ABREGE = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const FMT_COURT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** « Lundi 5 octobre » */
export function libelleLong(j: string): string {
  return majuscule(FMT_LONG.format(date(j)));
}

/** « Lundi » et « 5 octobre », pour l'en-tête d'une colonne. */
export function libelleColonne(j: string): { jour: string; date: string } {
  return { jour: majuscule(FMT_JOUR_SEMAINE.format(date(j))), date: FMT_JOUR_MOIS.format(date(j)) };
}

/** « Sam. 3 oct. » */
export function jourAbrege(j: string): string {
  return majuscule(FMT_ABREGE.format(date(j)));
}

/** « 05/10/2026 » */
export function jourCourt(j: string): string {
  return FMT_COURT.format(date(j));
}

/** « 5 au 11 octobre 2026 », « 28 septembre au 4 octobre 2026 », « 1er au 7 novembre 2026 ». */
export function libelleSemaine(lundi: string): string {
  const dimanche = ajouterJours(lundi, 6);
  const debut = lundi.slice(0, 7) === dimanche.slice(0, 7) ? String(date(lundi).getUTCDate()) : FMT_JOUR_MOIS.format(date(lundi));
  return `${debut} au ${FMT_JOUR_MOIS.format(date(dimanche))} ${dimanche.slice(0, 4)}`.replace(/(^|\s)1(\s)/g, '$11er$2');
}
