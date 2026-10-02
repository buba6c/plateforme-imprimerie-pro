import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PARAMS_PRIX_DEFAUT, TARIFS_DEFAUT, type Machine, type ParamsPrix, type Tarif as TarifPrix } from '@evocom/shared';
import { api, ApiError } from '../../lib/api';
import type { Tarif } from '../../lib/types';

/** Grille tarifaire complète (admin et préparateur). */
export function useTarifs(enabled = true) {
  return useQuery({
    queryKey: ['tarifs'],
    queryFn: () => api.get<Tarif[]>('/tarifs'),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

interface ParametresReponse {
  prix?: Partial<ParamsPrix>;
}

/** Paramètres de prix ; null si l'API ne les fournit pas (on retombe alors sur les valeurs par défaut). */
export function useParamsPrix(enabled = true) {
  const q = useQuery({
    queryKey: ['parametres'],
    queryFn: async () => {
      try {
        return await api.get<ParametresReponse>('/parametres');
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
        throw e;
      }
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  const params = useMemo<ParamsPrix>(() => ({ ...PARAMS_PRIX_DEFAUT, ...(q.data?.prix ?? {}) }), [q.data]);
  return { params, parDefaut: !q.data?.prix, isLoading: q.isLoading };
}

/** Tarifs au format attendu par le moteur de prix. */
export function versTarifsPrix(tarifs: Tarif[] | undefined): TarifPrix[] {
  return (tarifs ?? []).map((t) => ({
    code: t.code,
    machine: t.machine,
    categorie: t.categorie,
    libelle: t.libelle,
    unite: t.unite as TarifPrix['unite'],
    prix: t.prix,
    actif: t.actif,
  }));
}

/**
 * Libellé d'un code de tarif. Les imprimeurs n'ont pas accès à la grille : on retombe sur la
 * grille de départ (mêmes codes), puis sur le code lui-même rendu lisible.
 */
export function useLibelles(tarifs: Tarif[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const t of TARIFS_DEFAUT) map.set(`${t.machine}:${t.code}`, t.libelle);
    for (const t of tarifs ?? []) map.set(`${t.machine}:${t.code}`, t.libelle);
    return (machine: Machine, code: string) =>
      map.get(`${machine}:${code}`) ?? map.get(`global:${code}`) ?? lisible(code);
  }, [tarifs]);
}

export function lisible(code: string): string {
  const s = code.replace(/_m2$/, '').replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : code;
}
