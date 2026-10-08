// Ce que chaque rôle voit. Le filtrage se fait dans la requête SQL, pour la liste
// comme pour la fiche, les fichiers et les paiements : jamais seulement dans l'interface.

import { machineOfRole } from '@evocom/shared';
import type { AuthUser } from '../../types';

export interface Clause {
  sql: string;
  params: unknown[];
}

/**
 * Condition de visibilité d'un dossier (alias `d`) pour un utilisateur.
 * `offset` = nombre de paramètres déjà utilisés dans la requête.
 */
export function visibilite(user: AuthUser, offset = 0, joursLivreur = 7): Clause {
  const p = (n: number) => `$${offset + n}`;
  switch (user.role) {
    case 'admin':
    case 'preparateur':
      return { sql: 'd.deleted_at IS NULL', params: [] };
    case 'imprimeur_roland':
    case 'imprimeur_xerox':
      // Sa machine, à partir du moment où le dossier a été validé une fois.
      return {
        sql: `d.deleted_at IS NULL AND d.machine = ${p(1)} AND (d.date_validation IS NOT NULL OR d.statut <> 'en_cours')`,
        params: [machineOfRole(user.role)],
      };
    case 'livreur':
      return {
        // Les dossiers que le client vient chercher sur place ne passent pas par le livreur.
        sql: `d.deleted_at IS NULL AND (d.statut IN ('pret_livraison','en_livraison') AND d.mode_remise = 'livraison'
              OR (d.statut IN ('livre','termine') AND d.livre_at > now() - make_interval(days => ${p(1)}::int)))`,
        params: [joursLivreur],
      };
  }
}

export function peutVoirMontants(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'preparateur' || user.role === 'livreur';
}

export function peutVoirContactClient(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'preparateur' || user.role === 'livreur';
}

export function peutVoirFichiers(user: AuthUser): boolean {
  return user.role !== 'livreur';
}
