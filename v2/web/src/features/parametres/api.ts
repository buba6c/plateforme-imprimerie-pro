import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { EtatReinitialisation, Numerotation, ParametresAdmin, Regles } from './types';

export const CLE_ADMIN = ['parametres', 'admin'] as const;

/** Paramètres complets (l'API ne renvoie toutes les sections qu'à l'administrateur). */
export function useParametresAdmin() {
  return useQuery({ queryKey: CLE_ADMIN, queryFn: () => api.get<ParametresAdmin>('/parametres') });
}

export function useRegles() {
  return useQuery({ queryKey: ['parametres', 'regles'], queryFn: () => api.get<Regles>('/parametres/regles') });
}

export function useNumerotation() {
  return useQuery({ queryKey: ['systeme', 'numerotation'], queryFn: () => api.get<Numerotation>('/systeme/numerotation') });
}

export function useEtatReinitialisation() {
  return useQuery({ queryKey: ['systeme', 'reinitialisation'], queryFn: () => api.get<EtatReinitialisation>('/systeme/reinitialisation') });
}

/** Enregistre une ou plusieurs sections ; tous les écrans qui lisent les paramètres sont rafraîchis. */
export function useEnregistrerParametres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ParametresAdmin>) => api.put<ParametresAdmin>('/parametres', body),
    onSuccess: (p) => {
      qc.setQueryData(CLE_ADMIN, p);
      qc.invalidateQueries({ queryKey: ['parametres'], exact: true });
      qc.invalidateQueries({ queryKey: ['parametres', 'regles'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
