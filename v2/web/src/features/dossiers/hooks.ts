import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActionId, ActionInput } from '@evocom/shared';
import { api } from '../../lib/api';
import type { DossierDetail, ListeDossiers } from '../../lib/types';

export interface FiltresDossiers {
  statut?: string[];
  machine?: string;
  q?: string;
  urgent?: boolean;
  mine?: boolean;
  file?: 'travail' | 'historique';
  client_id?: number;
  page?: number;
  limit?: number;
  tri?: 'priorite' | 'recent' | 'ancien';
}

export function useDossiers(f: FiltresDossiers, opts: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ['dossiers', f],
    queryFn: () => api.get<ListeDossiers>('/dossiers', f as Record<string, any>),
    placeholderData: (prev) => prev,
    refetchInterval: opts.refetchInterval ?? 60_000,
  });
}

export function useDossier(id: number | undefined) {
  return useQuery({
    queryKey: ['dossier', id],
    queryFn: () => api.get<DossierDetail>(`/dossiers/${id}`),
    enabled: !!id,
  });
}

/** Met à jour le cache avec la fiche renvoyée par l'API après une écriture. */
export function useDossierMutation<V>(fn: (v: V) => Promise<DossierDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (d) => {
      qc.setQueryData(['dossier', d.id], d);
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useAction(id: number) {
  return useDossierMutation(({ action, input }: { action: ActionId; input: ActionInput }) =>
    api.post<DossierDetail>(`/dossiers/${id}/actions/${action}`, input),
  );
}
