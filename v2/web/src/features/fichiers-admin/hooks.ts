import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Auteur, CorbeilleFichiers, Integrite, ListeFichiersGlobale } from './types';

export interface FiltresFichiers {
  q?: string;
  type?: string;
  machine?: string;
  statut?: string;
  uploaded_by?: string;
  from?: string;
  to?: string;
  tri?: string;
  ordre?: string;
  page?: number;
  limit?: number;
}

// Clés sous « dossiers » : un envoi ou une suppression de fichier signale le dossier en temps réel,
// ce qui recharge ces listes automatiquement.

export function useFichiersGlobaux(f: FiltresFichiers, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['dossiers', 'fichiers', f],
    queryFn: () => api.get<ListeFichiersGlobale>('/gestion-fichiers', { ...f }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useAuteurs() {
  return useQuery({ queryKey: ['dossiers', 'fichiers-auteurs'], queryFn: () => api.get<Auteur[]>('/gestion-fichiers/auteurs'), staleTime: 60_000 });
}

export function useCorbeilleFichiers(f: { q?: string; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: ['dossiers', 'fichiers-corbeille', f],
    queryFn: () => api.get<CorbeilleFichiers>('/gestion-fichiers/corbeille', { ...f }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Contrôle du stockage : relancé à la demande seulement (il lit tout le disque). */
export function useIntegrite(enabled = true) {
  return useQuery({
    queryKey: ['fichiers-integrite'],
    queryFn: () => api.get<Integrite>('/gestion-fichiers/integrite'),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Après une action sur des fichiers : listes, fiches de dossier, contrôle et espace disque à relire. */
export function useRafraichirFichiers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['dossiers'] });
    void qc.invalidateQueries({ queryKey: ['dossier'] });
    void qc.invalidateQueries({ queryKey: ['fichiers-integrite'] });
    void qc.invalidateQueries({ queryKey: ['stockage'] });
  };
}
