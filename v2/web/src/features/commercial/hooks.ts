// Accès aux données commerciales (devis, factures, clients) avec TanStack Query.
// Les clés commencent par le nom de la ressource : le temps réel et les écritures les invalident.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatutDevis } from '@evocom/shared';
import { api } from '../../lib/api';
import type {
  ClientDetail,
  ClientInput,
  ClientRecherche,
  ConfigVosFactures,
  ConfigVosFacturesInput,
  DevisDetail,
  FactureDetail,
  FactureDirecteInput,
  ListeDevisReponse,
  ListeFacturesReponse,
  ParametresPublics,
  ResultatFusion,
} from './types';
import type { ClientResume } from './types';

/** Valeur retardée (saisie de recherche). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// ---------- Devis ----------

export function useListeDevis(f: { statut?: StatutDevis; q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['devis', 'liste', f],
    queryFn: () => api.get<ListeDevisReponse>('/devis', f),
    placeholderData: (prev) => prev,
  });
}

export function useDevis(id: number | undefined) {
  return useQuery({
    queryKey: ['devis', id],
    queryFn: () => api.get<DevisDetail>(`/devis/${id}`),
    enabled: !!id,
  });
}

export function useDevisStatut(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (statut: 'envoye' | 'accepte' | 'refuse') => api.post<DevisDetail>(`/devis/${id}/statut`, { statut }),
    onSuccess: (d) => {
      qc.setQueryData(['devis', id], d);
      qc.invalidateQueries({ queryKey: ['devis', 'liste'] });
    },
  });
}

export interface ConversionInput {
  urgent?: boolean;
  date_promise?: string | null;
  consignes?: string | null;
}

export function useConvertirDevis(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConversionInput) => api.post<{ dossier_id: number; numero?: string }>(`/devis/${id}/convertir`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useSupprimerDevis(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del<void>(`/devis/${id}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['devis', id] });
      qc.invalidateQueries({ queryKey: ['devis', 'liste'] });
    },
  });
}

// ---------- Factures ----------

export interface FiltresFactures {
  q?: string;
  from?: string;
  to?: string;
  statut?: 'emise' | 'annulee';
  vosfactures?: 'envoyee' | 'non_envoyee' | 'erreur';
  origine?: 'dossier' | 'directe';
  client_id?: number;
  dossier_id?: number;
  page?: number;
  limit?: number;
}

export function useListeFactures(f: FiltresFactures, opts: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: opts.enabled ?? true,
    queryKey: ['factures', 'liste', f],
    queryFn: () => api.get<ListeFacturesReponse>('/factures', f as Record<string, string | number | undefined>),
    placeholderData: (prev) => prev,
  });
}

export function useFacture(id: number | undefined) {
  return useQuery({
    queryKey: ['factures', id],
    queryFn: () => api.get<FactureDetail>(`/factures/${id}`),
    enabled: !!id,
  });
}

export function useAnnulerFacture(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (motif: string) => api.post<FactureDetail>(`/factures/${id}/annuler`, { motif }),
    onSuccess: (f) => {
      if (f && typeof f === 'object' && 'id' in f) qc.setQueryData(['factures', id], f);
      qc.invalidateQueries({ queryKey: ['factures'] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
    },
  });
}

/** Facture directe, sans dossier (POST /factures). */
export function useCreerFactureDirecte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FactureDirecteInput) => api.post<FactureDetail>('/factures', input),
    onSuccess: (f) => {
      qc.setQueryData(['factures', f.id], f);
      qc.invalidateQueries({ queryKey: ['factures'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/** Envoi (ou nouvel essai) d'une facture vers VosFactures (POST /factures/:id/vosfactures). */
export function useEnvoyerVosFactures(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<FactureDetail>(`/factures/${id}/vosfactures`),
    onSettled: () => {
      // Même en échec, le journal d'envoi de la facture a changé.
      qc.invalidateQueries({ queryKey: ['factures'] });
    },
  });
}

/** Nouvel essai d'annulation côté VosFactures (POST /factures/:id/vosfactures/annuler). */
export function useAnnulerVosFactures(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<FactureDetail>(`/factures/${id}/vosfactures/annuler`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['factures'] });
    },
  });
}

export const CLE_CONFIG_VOSFACTURES = ['factures', 'vosfactures', 'config'] as const;

export function useConfigVosFactures() {
  return useQuery({ queryKey: CLE_CONFIG_VOSFACTURES, queryFn: () => api.get<ConfigVosFactures>('/factures/vosfactures/config') });
}

export function useEnregistrerConfigVosFactures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfigVosFacturesInput) => api.put<ConfigVosFactures>('/factures/vosfactures/config', input),
    onSuccess: (c) => {
      qc.setQueryData(CLE_CONFIG_VOSFACTURES, c);
      qc.invalidateQueries({ queryKey: ['factures', 'liste'] });
    },
  });
}

export function useTesterVosFactures() {
  return useMutation({
    mutationFn: (input: { sous_domaine?: string; cle?: string }) =>
      api.post<{ ok: true; sous_domaine: string; nb_factures_visibles: number; duree_ms: number }>('/factures/vosfactures/test', input),
  });
}

/** Établit la facture d'un dossier (POST /dossiers/:id/facture). */
export function useCreerFacture(dossierId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<FactureDetail>(`/dossiers/${dossierId}/facture`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures'] });
      qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
    },
  });
}

// ---------- Clients ----------

export function useListeClients(f: { q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['clients', 'liste', f],
    queryFn: () => api.get<{ items: ClientResume[]; total: number; page?: number; limit?: number }>('/clients', f),
    placeholderData: (prev) => prev,
  });
}

export function useClient(id: number | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<ClientDetail>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useRechercheClients(q: string) {
  const terme = q.trim();
  return useQuery({
    queryKey: ['clients', 'recherche', terme],
    queryFn: () => api.get<ClientRecherche[]>('/clients/recherche', { q: terme }),
    enabled: terme.length >= 2,
    placeholderData: (prev) => prev,
  });
}

export function useEnregistrerClient(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => (id ? api.patch<ClientDetail>(`/clients/${id}`, input) : api.post<ClientDetail>('/clients', input)),
    onSuccess: (c) => {
      qc.setQueryData(['clients', c.id], c);
      qc.invalidateQueries({ queryKey: ['clients', 'liste'] });
      qc.invalidateQueries({ queryKey: ['clients', 'recherche'] });
    },
  });
}

export function useFusionnerClient(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dansId: number) => api.post<ResultatFusion>(`/clients/${id}/fusionner`, { dans_id: dansId }),
    onSuccess: (r) => {
      qc.setQueryData(['clients', r.id], r);
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['devis'] });
      qc.invalidateQueries({ queryKey: ['factures'] });
    },
  });
}

// ---------- Paramètres (coordonnées de l'entreprise) ----------

export function useParametres() {
  return useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<ParametresPublics>('/parametres'),
    staleTime: 5 * 60_000,
  });
}
