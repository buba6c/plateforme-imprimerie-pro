// Point d'enregistrement des modules métier complémentaires (devis, factures, paiements,
// clients, statistiques, paramètres, notifications, administration).
import type { Express } from 'express';
import type { Config } from '../config';

export function registerModules(_app: Express, _config: Config) {
  // Les modules s'ajoutent ici.
}
