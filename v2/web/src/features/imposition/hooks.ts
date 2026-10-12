import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { corpsPieces, type Catalogue, type FichierLibre, type ModeleImposition, type ParamsImposition, type Piece, type Plan, type PropositionImposition, type ReponseAnalyse, type ResultatGeneration } from './types';

export function useCatalogueImposition() {
  return useQuery({ queryKey: ['imposition', 'catalogue'], queryFn: () => api.get<Catalogue>('/imposition/catalogue'), staleTime: 60 * 60_000 });
}

export function useModelesImposition() {
  return useQuery({ queryKey: ['imposition', 'modeles'], queryFn: () => api.get<{ items: ModeleImposition[] }>('/imposition/modeles'), staleTime: 60_000 });
}

const clePieces = (pieces: Piece[]) => pieces.map((p) => `${p.libre ?? p.fichier_id}:${p.role}`).join('|');

export function useAnalyse(pieces: Piece[], fini?: { largeur: number; hauteur: number }, fonds?: number) {
  const avecImage = pieces.some((p) => p.genre === 'image');
  return useQuery({
    queryKey: ['imposition', 'analyse', clePieces(pieces), avecImage ? fini : null, avecImage ? fonds : null],
    queryFn: () => api.post<ReponseAnalyse>('/imposition/analyser', { pieces: corpsPieces(pieces), fini, fonds_perdus_mm: fonds }),
    enabled: pieces.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function usePlan(pieces: Piece[], params: ParamsImposition | null) {
  return useQuery({
    queryKey: ['imposition', 'plan', clePieces(pieces), params],
    queryFn: () => api.post<{ plan: Plan }>('/imposition/plan', { pieces: corpsPieces(pieces), params }),
    enabled: pieces.length > 0 && !!params,
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function useGenerer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { pieces: Piece[]; params: ParamsImposition; nom?: string }) => api.post<ResultatGeneration>('/imposition/generer', { pieces: corpsPieces(body.pieces), params: body.params, nom: body.nom }),
    onSuccess: (r) => {
      if (r.fichier) {
        void qc.invalidateQueries({ queryKey: ['dossier', r.fichier.dossier_id] });
        void qc.invalidateQueries({ queryKey: ['dossiers'] });
        void qc.invalidateQueries({ queryKey: ['fichiers'] });
      }
    },
  });
}

export function useProposerIA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { pieces: Piece[]; question?: string }) => api.post<PropositionImposition>('/imposition/ia', { pieces: corpsPieces(body.pieces), question: body.question }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['ia', 'usages'] }),
  });
}

/** Dépôt d'un fichier libre (sans dossier) : corps brut, nom en paramètre, progression 0 → 1. */
export function useTeleverserLibre(onProgression?: (nom: string, part: number) => void) {
  return useMutation({
    mutationFn: (file: File): Promise<FichierLibre> =>
      new Promise((ok, ko) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/imposition/libre?nom=${encodeURIComponent(file.name)}`);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgression?.(file.name, e.loaded / e.total);
        xhr.onload = () => {
          let data: any = {};
          try {
            data = JSON.parse(xhr.responseText || '{}');
          } catch {
            data = {};
          }
          if (xhr.status >= 200 && xhr.status < 300) ok(data as FichierLibre);
          else ko(new ApiError(xhr.status, xhr.status === 413 ? 'Fichier trop lourd pour ce mode (300 Mo au plus) : déposez-le dans un dossier.' : data?.error ?? 'Dépôt impossible', data?.champs, undefined, data?.code));
        };
        xhr.onerror = () => ko(new ApiError(0, 'Connexion interrompue pendant l’envoi : réessayez.'));
        xhr.send(file);
      }),
  });
}

export function useModelesMutations() {
  const qc = useQueryClient();
  const maj = (r: { items: ModeleImposition[] }) => qc.setQueryData(['imposition', 'modeles'], { items: r.items });
  const creer = useMutation({ mutationFn: (b: { nom: string; description?: string | null; params: ParamsImposition }) => api.post<{ items: ModeleImposition[]; id: number }>('/imposition/modeles', b), onSuccess: maj });
  const modifier = useMutation({ mutationFn: (b: { id: number; nom: string; description?: string | null; params: ParamsImposition }) => api.put<{ items: ModeleImposition[] }>(`/imposition/modeles/${b.id}`, b), onSuccess: maj });
  const supprimer = useMutation({ mutationFn: (id: number) => api.del<{ items: ModeleImposition[] }>(`/imposition/modeles/${id}`), onSuccess: maj });
  return { creer, modifier, supprimer };
}
