import { useQuery } from '@tanstack/react-query';
import type { ModePaiement, StatutPaiement } from '@evocom/shared';
import { api } from '../../lib/api';
import type { DossierResume } from '../../lib/types';

/** Ce qu'il reste à encaisser sur un dossier : solde moins les paiements en attente de validation. */
export function resteAEncaisser(d: Pick<DossierResume, 'solde' | 'en_attente_validation'>): number | null {
  if (d.solde === null || d.solde === undefined) return null;
  return Math.max(0, d.solde - (d.en_attente_validation ?? 0));
}

export function lienTelephone(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`;
}

export function lienItineraire(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

export interface Parametres {
  livreur_jours_historique?: number;
  fuseau?: string;
}

/** Paramètres publics (durée d'historique du livreur, fuseau). Facultatifs : l'écran fonctionne sans. */
export function useParametres() {
  return useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<Parametres>('/parametres'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface PaiementLigne {
  id: number;
  dossier_id: number;
  numero: string;
  client_nom: string;
  montant: number;
  mode: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  notes: string | null;
  encaisse_par_nom: string | null;
  encaisse_at: string;
  valide_par_nom: string | null;
  valide_at: string | null;
  motif_refus: string | null;
  dossier_supprime?: boolean;
}

export interface ListePaiements {
  items: PaiementLigne[];
  total: number;
  somme: number;
  page?: number;
  limit?: number;
}
