import { useQuery } from '@tanstack/react-query';
import type { Machine, Specs } from '@evocom/shared';
import { api } from '../../lib/api';
import { lignesDe, specsVersDraft, type SpecsDraft } from '../specs/draft';
import type { ConfigIA, UsagesIA } from './types';

/** L'assistant est-il utilisable (activé et clé enregistrée) ? Admin et préparateur. */
export function useStatutIA(enabled = true) {
  return useQuery({
    queryKey: ['ia', 'statut'],
    queryFn: () => api.get<{ actif: boolean }>('/ia/statut'),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useConfigIA() {
  return useQuery({ queryKey: ['ia', 'config'], queryFn: () => api.get<ConfigIA>('/ia/config'), retry: false });
}

export function useUsagesIA() {
  return useQuery({ queryKey: ['ia', 'usages'], queryFn: () => api.get<UsagesIA>('/ia/usages', { limit: 50 }), retry: false });
}

/**
 * Brouillon du formulaire après application d'une proposition : les lignes de la machine
 * proposée et les forfaits sont remplacés ; la remise et les lignes de l'autre machine restent.
 */
export function appliquerProposition(actuel: SpecsDraft, machine: Machine, specs: Specs): SpecsDraft {
  const d = specsVersDraft(machine, specs);
  return machine === 'roland' ? { ...actuel, roland: d.roland, forfaits: d.forfaits } : { ...actuel, xerox: d.xerox, forfaits: d.forfaits };
}

/** Le formulaire contient déjà une saisie que la proposition remplacerait. */
export function saisieRemplacee(actuel: SpecsDraft, machine: Machine): boolean {
  const lignes = lignesDe(machine, actuel).some((l) =>
    'largeur' in l
      ? !!(l.support || l.largeur || l.hauteur || l.finitions.length || l.options.length || l.description)
      : !!(l.support || l.quantite || l.finitions.length || l.options.length || l.description),
  );
  return lignes || actuel.forfaits.length > 0;
}
