// Point d'enregistrement des modules métier complémentaires (devis, factures, paiements,
// clients, statistiques, paramètres, notifications, administration).
//
// Appelé après le montage de /api/dossiers : les routeurs ajoutés ici sur ce même préfixe
// (paiements, facture, bon de travail d'un dossier) ne servent que des chemins que le
// routeur des dossiers ne connaît pas, il n'y a donc aucun masquage dans un sens ou dans l'autre.
import type { Express } from 'express';
import type { Config } from '../config';
import { corbeilleRouter, exportsRouter, journalRouter, santeRouter } from './admin/routes';
import { clientsRouter } from './clients/routes';
import { devisRouter } from './devis/routes';
import { dossierFactureRouter, facturesRouter } from './factures/routes';
import { notificationsRouter } from './notifications/routes';
import { caisseRouter, dossierPaiementsRouter, paiementsRouter } from './paiements/routes';
import { parametresRouter } from './parametres/routes';
import { bonDeTravailRouter } from './pdf/routes';
import { statsRouter } from './stats/routes';

export function registerModules(app: Express, config: Config) {
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/parametres', parametresRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/paiements', paiementsRouter);
  app.use('/api/caisse', caisseRouter);
  app.use('/api/devis', devisRouter);
  app.use('/api/factures', facturesRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/journal', journalRouter);
  app.use('/api/corbeille', corbeilleRouter);
  app.use('/api/exports', exportsRouter);
  app.use('/api/sante', santeRouter(config));
  app.use('/api/dossiers', dossierPaiementsRouter);
  app.use('/api/dossiers', dossierFactureRouter);
  app.use('/api/dossiers', bonDeTravailRouter);
}
