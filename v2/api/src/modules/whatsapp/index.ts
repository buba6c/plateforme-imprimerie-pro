// Module « WhatsApp client » : messages automatiques au client depuis le numéro dédié de l'imprimerie.
// Démarré par src/index.ts après la base et le temps réel ; jamais bloquant pour l'API.

import path from 'node:path';
import type { Logger } from 'pino';
import type { Config } from '../../config';
import { arreterConnexion, configurerConnexion, reprendreSiEnregistre } from './connexion';
import { configurerEntrants, surEntrant } from './entrants';
import { arreterFile, configurerFile, demarrerFile } from './file';

export { planifierWhatsApp, evenementWhatsApp } from './file';
export { whatsappRouter, whatsappParametresRouter } from './routes';

/** Dossier des identifiants (droits 700) : STORAGE_DIR/whatsapp/auth. */
export function dossierAuthWhatsApp(config: Pick<Config, 'storageDir'>): string {
  return path.join(config.storageDir, 'whatsapp', 'auth');
}

/**
 * Prépare le module, reprend la connexion si l'appareil a déjà été lié, lance la boucle d'envoi.
 * Ne lève jamais : si la bibliothèque manque ou refuse de démarrer, l'écran l'explique.
 */
export async function demarrerWhatsApp(config: Config, logParent: Logger): Promise<void> {
  const log = logParent.child({ module: 'whatsapp' });
  try {
    configurerConnexion({ dossierAuth: dossierAuthWhatsApp(config), log, surEntrant });
    configurerEntrants({ log });
    configurerFile({ log });
    demarrerFile();
    reprendreSiEnregistre().catch((e) => log.error({ err: e }, 'WhatsApp : reprise de la connexion en échec'));
  } catch (e) {
    log.error({ err: e }, 'WhatsApp : module non démarré (le reste de l’API fonctionne)');
  }
}

/** Arrêt propre : ferme la connexion sans déconnecter l'appareil, arrête la boucle. */
export async function arreterWhatsApp(): Promise<void> {
  arreterFile();
  await arreterConnexion().catch(() => {});
}
