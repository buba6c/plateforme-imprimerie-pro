// Adaptateur Baileys (@whiskeysockets/baileys) : la seule partie du module qui connaît la bibliothèque.
// Chargé à la demande par connexion.ts ; si l'import échoue, le module WhatsApp se déclare indisponible.

import type { Logger } from 'pino';
import type { FabriqueSocket } from './connexion';

type Baileys = typeof import('@whiskeysockets/baileys');

/** Supporte les deux formes d'import (espace de noms ESM, ou objet CommonJS dans `default`). */
async function chargerBaileys(): Promise<Baileys> {
  const m = (await import('@whiskeysockets/baileys')) as unknown as Record<string, unknown>;
  const b = (typeof m.useMultiFileAuthState === 'function' ? m : m.default) as Record<string, unknown>;
  if (!b || typeof b.useMultiFileAuthState !== 'function') throw new Error('Bibliothèque WhatsApp inutilisable : export useMultiFileAuthState introuvable.');
  if (typeof b.makeWASocket !== 'function' && typeof b.default === 'function') b.makeWASocket = b.default;
  return b as unknown as Baileys;
}

const MOTIFS: Record<number, string> = {
  401: 'Appareil déconnecté depuis le téléphone',
  403: 'Connexion refusée par WhatsApp',
  408: 'Délai dépassé (réseau ou code QR expiré)',
  411: 'Session incompatible : scannez de nouveau le code QR',
  428: 'Connexion fermée par WhatsApp',
  440: 'Connexion remplacée : ce numéro est utilisé par un autre serveur',
  500: 'Session invalide : scannez de nouveau le code QR',
  503: 'Service WhatsApp indisponible',
  515: 'Redémarrage demandé par WhatsApp (normal après le scan)',
};

export const fabriqueBaileys: FabriqueSocket = async ({ dossierAuth, log, ev }) => {
  const b = await chargerBaileys();
  const { state, saveCreds } = await b.useMultiFileAuthState(dossierAuth);
  let version: [number, number, number] | undefined;
  try {
    version = (await b.fetchLatestBaileysVersion({ timeout: 5000 })).version;
  } catch {
    /* hors ligne : version embarquée dans la bibliothèque */
  }
  // Les journaux internes de la bibliothèque sont bavards : avertissements seulement.
  const logLib = log.child({ module: 'baileys' }) as Logger;
  logLib.level = 'warn';
  const sock = b.makeWASocket({
    version,
    auth: { creds: state.creds, keys: b.makeCacheableSignalKeyStore(state.keys, logLib as unknown as Parameters<typeof b.makeCacheableSignalKeyStore>[1]) },
    logger: logLib as unknown as Parameters<typeof b.makeWASocket>[0]['logger'],
    printQRInTerminal: false,
    browser: b.Browsers.ubuntu('Chrome'),
    // Ne se déclare pas « en ligne » : le téléphone continue de recevoir ses notifications.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    qrTimeout: 60_000,
  });
  sock.ev.on('creds.update', () => void saveCreds().catch((e) => log.warn({ err: e }, 'WhatsApp : identifiants non enregistrés')));
  sock.ev.on('connection.update', (u) => {
    if (u.qr) ev.surQr(u.qr);
    if (u.connection === 'open') {
      const id = sock.user?.id ?? '';
      const m = /^(\d+)(?::\d+)?@/.exec(id);
      ev.surOuverture(m ? `+${m[1]}` : null);
    }
    if (u.connection === 'close') {
      const err = u.lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined;
      const code = err?.output?.statusCode ?? null;
      ev.surFermeture({
        deconnecte: code === b.DisconnectReason.loggedOut,
        code,
        motif: (code !== null && MOTIFS[code]) || err?.message || 'Connexion fermée',
      });
    }
  });
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (m.key.fromMe) continue;
        const jid = m.key.remoteJid ?? '';
        if (!jid.endsWith('@s.whatsapp.net')) continue; // ni groupes, ni statuts, ni diffusions
        const texte = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? null;
        if (!texte) continue;
        ev.surEntrant(jid, texte);
      } catch (e) {
        log.warn({ err: e }, 'WhatsApp : message entrant ignoré');
      }
    }
  });
  return {
    async envoyer(jid, texte) {
      await sock.sendMessage(jid, { text: texte });
    },
    async fermer(oublier) {
      if (oublier) {
        await sock.logout().catch(() => {});
      } else {
        sock.end(undefined);
      }
    },
    estEnregistre: () => state.creds.registered === true,
  };
};
