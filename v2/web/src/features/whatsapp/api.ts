import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Entrant, MessageWhatsApp, OptOut, PageMessages, ParametresWhatsApp, ReglagesWhatsApp, StatutMessage, StatutWhatsApp } from './types';

export const CLE_STATUT = ['whatsapp', 'statut'] as const;
export const CLE_PARAMETRES = ['parametres', 'whatsapp'] as const;

/** État de la connexion, relu souvent pendant l'attente du scan. */
export function useStatutWhatsApp() {
  return useQuery({
    queryKey: CLE_STATUT,
    queryFn: () => api.get<StatutWhatsApp>('/whatsapp/statut'),
    refetchInterval: (q) => {
      const etat = q.state.data?.etat;
      return etat === 'qr' || etat === 'connexion' ? 3000 : 15_000;
    },
  });
}

function useActionStatut(chemin: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<StatutWhatsApp>(chemin),
    onSuccess: (s) => {
      qc.setQueryData(CLE_STATUT, s);
    },
  });
}

export const useConnecter = () => useActionStatut('/whatsapp/connecter');
export const useDeconnecter = () => useActionStatut('/whatsapp/deconnecter');

export function useEnvoyerTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (telephone: string) => api.post<MessageWhatsApp>('/whatsapp/test', { telephone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
    },
  });
}

export interface FiltresMessages {
  statut: StatutMessage | '';
  q: string;
  page: number;
}

export function useMessagesWhatsApp(f: FiltresMessages) {
  return useQuery({
    queryKey: ['whatsapp', 'messages', f.statut, f.q, f.page],
    queryFn: () => api.get<PageMessages>('/whatsapp/messages', { statut: f.statut, q: f.q, page: f.page }),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });
}

function useActionMessage(action: 'reessayer' | 'annuler') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<MessageWhatsApp>(`/whatsapp/messages/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
    },
  });
}

export const useReessayer = () => useActionMessage('reessayer');
export const useAnnuler = () => useActionMessage('annuler');

export function useOptOut() {
  return useQuery({ queryKey: ['whatsapp', 'optout'], queryFn: () => api.get<OptOut[]>('/whatsapp/optout') });
}

export function useRetirerOptOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (telephone: string) => api.del<void>(`/whatsapp/optout/${encodeURIComponent(telephone)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp', 'optout'] });
    },
  });
}

export function useEntrants(page: number) {
  return useQuery({
    queryKey: ['whatsapp', 'entrants', page],
    queryFn: () => api.get<{ items: Entrant[]; total: number; page: number; limit: number }>('/whatsapp/entrants', { page }),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });
}

export function useParametresWhatsApp() {
  return useQuery({ queryKey: CLE_PARAMETRES, queryFn: () => api.get<ParametresWhatsApp>('/parametres/whatsapp') });
}

type Partiel<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export function useEnregistrerParametresWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partiel<ReglagesWhatsApp>) => api.put<ParametresWhatsApp>('/parametres/whatsapp', body),
    onSuccess: (p) => {
      qc.setQueryData(CLE_PARAMETRES, p);
      qc.invalidateQueries({ queryKey: CLE_STATUT });
    },
  });
}
