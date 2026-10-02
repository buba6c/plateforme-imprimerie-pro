import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { Tarif } from '../../lib/types';
import { aujourdhui, FUSEAU_DEFAUT } from './dates';
import type { Parametres, UserAdmin } from './types';

export function useParametres() {
  return useQuery({ queryKey: ['parametres'], queryFn: () => api.get<Parametres>('/parametres'), staleTime: 60_000 });
}

/** Fuseau de l'entreprise (Africa/Dakar tant que les paramètres ne sont pas chargés). */
export function useFuseau(): string {
  return useParametres().data?.fuseau ?? FUSEAU_DEFAUT;
}

export function useAujourdhui(): string {
  return aujourdhui(useFuseau());
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api.get<UserAdmin[]>('/users') });
}

export function useTarifs() {
  return useQuery({ queryKey: ['tarifs'], queryFn: () => api.get<Tarif[]>('/tarifs') });
}

/** Erreurs par champ renvoyées par l'API (validation Zod : `champs` ; règles métier : `details.champs`). */
export function champsErreur(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return e.champs ?? (e.details && typeof e.details === 'object' && e.details.champs) ?? {};
}

/** La route n'existe pas encore sur ce serveur (module en cours de déploiement). */
export function estIndisponible(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}
