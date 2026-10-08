// Dossiers « prêts à imprimer » déjà ouverts (ou marqués « Vu ») par l'imprimeur connecté.
// Mémorisé par utilisateur sur cet appareil (localStorage, tolérant aux erreurs).
//
// Un dossier est NOUVEAU quand il est prêt à imprimer et que l'imprimeur ne l'a pas encore vu
// depuis qu'il y est arrivé :
// - jamais vu, et validé après la première utilisation de cette fonction sur l'appareil (les
//   dossiers déjà en attente ce jour-là ne clignotent pas tous d'un coup) ;
// - ou revenu dans la file après être passé ailleurs (révision corrigée, remis en impression).
// Un dossier remis en attente par l'imprimeur (il était en impression) n'est pas nouveau.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { machineOfRole, type Statut } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import type { DossierResume, ListeDossiers } from '../../lib/types';
import '../notifications/notifications.css';

/** Le dossier tel que la liste le renvoie (`origine_type` : 'reimpression' | 'nouvelle_commande' | null). */
export type DossierAtelier = DossierResume & { origine_type?: string | null };

interface Etat {
  /** Première utilisation sur cet appareil (ms). */
  depuis: number;
  /** Dernier statut connu de chaque dossier vu ou observé. */
  vus: Record<string, Statut>;
}

const MAX = 600;
const STATUTS_FILE: readonly Statut[] = ['pret_impression', 'en_impression'];
const cle = (userId: number) => `evocom.atelier.vus.${userId}`;
const memoire = new Map<number, Etat>();
const abonnes = new Set<() => void>();

function charger(userId: number): Etat {
  const m = memoire.get(userId);
  if (m) return m;
  let etat: Etat | null = null;
  try {
    const brut = localStorage.getItem(cle(userId));
    if (brut) {
      const o = JSON.parse(brut) as Partial<Etat>;
      if (typeof o.depuis === 'number' && o.vus && typeof o.vus === 'object') etat = { depuis: o.depuis, vus: o.vus };
    }
  } catch {
    etat = null;
  }
  if (!etat) {
    etat = { depuis: Date.now(), vus: {} };
    sauver(userId, etat);
  }
  memoire.set(userId, etat);
  return etat;
}

function sauver(userId: number, etat: Etat) {
  const ids = Object.keys(etat.vus);
  if (ids.length > MAX) {
    // Les identifiants croissent avec le temps : on oublie les plus anciens dossiers.
    const garder = ids.sort((a, b) => Number(b) - Number(a)).slice(0, MAX);
    etat.vus = Object.fromEntries(garder.map((id) => [id, etat.vus[id]!]));
  }
  try {
    localStorage.setItem(cle(userId), JSON.stringify(etat));
  } catch {
    /* stockage indisponible : mémorisé pour cette page seulement */
  }
}

function modifier(userId: number, fn: (vus: Record<string, Statut>) => boolean) {
  const etat = charger(userId);
  const vus = { ...etat.vus };
  if (!fn(vus)) return;
  const suivant = { ...etat, vus };
  memoire.set(userId, suivant);
  sauver(userId, suivant);
  abonnes.forEach((f) => f());
}

function abonner(f: () => void) {
  abonnes.add(f);
  const surStockage = (e: StorageEvent) => {
    if (!e.key || !e.key.startsWith('evocom.atelier.vus.')) return;
    memoire.clear(); // relu au prochain accès
    f();
  };
  window.addEventListener('storage', surStockage);
  return () => {
    abonnes.delete(f);
    window.removeEventListener('storage', surStockage);
  };
}

export function estNouveau(etat: Etat, d: Pick<DossierAtelier, 'id' | 'statut' | 'date_validation'>): boolean {
  if (d.statut !== 'pret_impression') return false;
  const connu = etat.vus[d.id];
  if (connu) return !STATUTS_FILE.includes(connu);
  const valide = d.date_validation ? new Date(d.date_validation).getTime() : NaN;
  return Number.isFinite(valide) && valide >= etat.depuis;
}

/** Retient le statut des dossiers vus hors de la file, pour repérer leur retour. */
function observer(userId: number, items: Pick<DossierAtelier, 'id' | 'statut'>[]) {
  modifier(userId, (vus) => {
    let change = false;
    for (const d of items) {
      if (d.statut === 'pret_impression') continue;
      if (vus[d.id] === d.statut) continue;
      vus[d.id] = d.statut;
      change = true;
    }
    return change;
  });
}

export function useVusAtelier() {
  const user = useUser();
  const etat = useSyncExternalStore(abonner, () => charger(user.id), () => charger(user.id));
  const marquerTousVus = useCallback(
    (ids: number[]) =>
      modifier(user.id, (vus) => {
        let change = false;
        for (const id of ids) {
          if (vus[id] === 'pret_impression') continue;
          vus[id] = 'pret_impression';
          change = true;
        }
        return change;
      }),
    [user.id],
  );
  const marquerVu = useCallback((id: number) => marquerTousVus([id]), [marquerTousVus]);
  const observerListe = useCallback((items: Pick<DossierAtelier, 'id' | 'statut'>[]) => observer(user.id, items), [user.id]);
  const nouveau = useCallback((d: Pick<DossierAtelier, 'id' | 'statut' | 'date_validation'>) => estNouveau(etat, d), [etat]);
  return { estNouveau: nouveau, marquerVu, marquerTousVus, observer: observerListe };
}

/** Même requête que la file d'impression : le cache est partagé. */
export const FILTRES_FILE_TRAVAIL = { file: 'travail', limit: 200 } as const;

/**
 * Nombre de dossiers « prêts à imprimer » pas encore ouverts par l'imprimeur connecté
 * (0 pour les autres rôles, sans requête). Pour le menu : appliquer `.nav-clignote` quand > 0.
 */
export function useNouveauxTravaux(): number {
  const user = useUser();
  const machine = machineOfRole(user.role);
  const { estNouveau: nouveau, observer: observerListe } = useVusAtelier();
  const q = useQuery({
    queryKey: ['dossiers', FILTRES_FILE_TRAVAIL],
    queryFn: () => api.get<ListeDossiers>('/dossiers', { ...FILTRES_FILE_TRAVAIL }),
    enabled: !!machine,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  const items = useMemo(() => (machine ? ((q.data?.items ?? []) as DossierAtelier[]).filter((d) => d.machine === machine) : []), [q.data, machine]);
  useEffect(() => {
    if (items.length) observerListe(items);
  }, [items, observerListe]);
  return items.filter(nouveau).length;
}

/** Ouvrir la fiche d'un dossier (quel que soit le chemin) le marque comme vu pour l'imprimeur. */
export function useMarquageOuverture(): void {
  const user = useUser();
  const loc = useLocation();
  const { marquerVu } = useVusAtelier();
  const imprimeur = machineOfRole(user.role) !== null;
  useEffect(() => {
    if (!imprimeur) return;
    const m = /^\/dossiers\/(\d+)(?:\/|$)/.exec(loc.pathname);
    if (m) marquerVu(Number(m[1]));
  }, [imprimeur, loc.pathname, marquerVu]);
}
