/**
 * INDEX SERVICES PRODUCTION
 * =========================
 * 
 * Point d'entrée centralisé pour tous les services de production
 * Permet des imports simplifiés et cohérents
 */

// Services principaux
import dossiersService from './api';
import filesServiceProduction from './filesServiceProduction';
import dossierSyncService from './dossierSyncService';
import filesSyncService from './filesSyncService';
import workflowService from './workflowService';
import errorHandlerService from './errorHandlerService';
import notificationService from './notificationService';

// Utilitaires
import httpClient from './httpClient';
import dossierNormalizer from './dossierNormalizer';
import dossierIdResolver from './dossierIdResolver';

// Export principal pour la compatibilité
export { default as dossiersService } from './api';

// Export du service de fichiers production
export const filesService = filesServiceProduction;

// Export services complets
export {
  filesServiceProduction,
  dossierSyncService,
  filesSyncService,
  workflowService,
  errorHandlerService,
  notificationService,
  httpClient,
  dossierNormalizer,
  dossierIdResolver
};

// Export par défaut avec tous les services
export default {
  dossiers: dossiersService,
  files: filesServiceProduction,
  sync: dossierSyncService,
  filesSync: filesSyncService,
  workflow: workflowService,
  error: errorHandlerService,
  notification: notificationService,
  http: httpClient,
  normalizer: dossierNormalizer,
  resolver: dossierIdResolver
};