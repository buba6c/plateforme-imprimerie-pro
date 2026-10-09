// Connexion unique au numéro WhatsApp dédié (une par processus), comme WhatsApp Web :
// code QR à scanner, état d'authentification sur disque (STORAGE_DIR/whatsapp/auth, droits 700),
// reconnexion automatique avec attente progressive (jamais plus d'une tentative par 30 s).
//
// La bibliothèque (Baileys) est chargée à la demande par `fabriqueBaileys` ; si elle manque ou refuse
// de démarrer, l'API continue sans WhatsApp (`disponible: false`, motif affiché dans l'écran).
// Aucune exception ne sort de ce module : tout est rattrapé et journalisé.

import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import QRCode from 'qrcode';

export type EtatWhatsApp = 'deconnecte' | 'qr' | 'connexion' | 'connecte';

/** Ce que le module attend d'une connexion WhatsApp (Baileys en production, un faux dans les tests). */
export interface SocketWhatsApp {
  envoyer(jid: string, texte: string): Promise<void>;
  /** Ferme la connexion ; avec `oublier`, déconnecte aussi l'appareil côté WhatsApp (logout). */
  fermer(oublier: boolean): Promise<void>;
  /** Vrai une fois le code QR scanné (identifiants enregistrés sur disque). */
  estEnregistre(): boolean;
}

export interface EvenementsSocket {
  surQr(qr: string): void;
  surOuverture(numero: string | null): void;
  surFermeture(info: { deconnecte: boolean; code: number | null; motif: string }): void;
  surEntrant(jid: string, texte: string): void;
}

export type FabriqueSocket = (opts: { dossierAuth: string; log: Logger; ev: EvenementsSocket }) => Promise<SocketWhatsApp>;

export interface InstantaneConnexion {
  etat: EtatWhatsApp;
  numero: string | null;
  /** Code QR en data URL (PNG), seulement en attente de scan. */
  qr: string | null;
  depuis: string | null;
  /** Faux si la bibliothèque WhatsApp n'a pas pu être chargée. */
  disponible: boolean;
  erreur: string | null;
  /** Identifiants enregistrés sur disque (l'appareil a déjà été lié). */
  enregistre: boolean;
}

/** Attente minimale entre deux tentatives de connexion. */
export const ATTENTE_MIN_MS = 30_000;
const ATTENTE_MAX_MS = 10 * 60_000;

/** Erreur signalée à la bibliothèque : la connexion n'est pas ouverte. */
export class NonConnecte extends Error {
  constructor() {
    super("WhatsApp n'est pas connecté.");
  }
}

let log: Logger = { info() {}, warn() {}, error() {}, debug() {}, child() { return log; } } as unknown as Logger;
let dossierAuth = '';
let fabrique: FabriqueSocket | null = null;
let surEntrant: ((jid: string, texte: string) => void) | null = null;

let socket: SocketWhatsApp | null = null;
let generation = 0; // identifie le socket courant : les événements d'un socket fermé sont ignorés
let voulu = false; // l'administrateur veut la connexion ouverte (ou des identifiants existent)
let etat: EtatWhatsApp = 'deconnecte';
let numero: string | null = null;
let qr: string | null = null;
let depuis: Date | null = null;
let disponible = true;
let erreur: string | null = null;
let derniereTentative = 0;
let attente = ATTENTE_MIN_MS;
let minuterie: NodeJS.Timeout | null = null;
let connexionEnCours: Promise<void> | null = null;

export function configurerConnexion(opts: { dossierAuth: string; log: Logger; fabrique?: FabriqueSocket; surEntrant?: (jid: string, texte: string) => void }) {
  dossierAuth = opts.dossierAuth;
  log = opts.log;
  if (opts.fabrique) fabrique = opts.fabrique;
  if (opts.surEntrant) surEntrant = opts.surEntrant;
  preparerDossier();
}

function preparerDossier() {
  if (!dossierAuth) return;
  try {
    fs.mkdirSync(dossierAuth, { recursive: true, mode: 0o700 });
    fs.chmodSync(dossierAuth, 0o700);
    const parent = path.dirname(dossierAuth);
    fs.chmodSync(parent, 0o700);
  } catch (e) {
    log.warn({ err: e }, 'Dossier WhatsApp : droits non appliqués');
  }
}

/** Identifiants enregistrés ET appareil lié (un code QR jamais scanné laisse `registered: false`). */
export function authEnregistree(): boolean {
  if (!dossierAuth) return false;
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(dossierAuth, 'creds.json'), 'utf8')) as { registered?: unknown };
    return creds?.registered === true;
  } catch {
    return false;
  }
}

function effacerAuth() {
  if (!dossierAuth) return;
  try {
    fs.rmSync(dossierAuth, { recursive: true, force: true });
  } catch (e) {
    log.warn({ err: e }, "Identifiants WhatsApp : effacement impossible");
  }
  preparerDossier();
}

export function etatConnexion(): InstantaneConnexion {
  return { etat, numero, qr: etat === 'qr' ? qr : null, depuis: depuis?.toISOString() ?? null, disponible, erreur, enregistre: authEnregistree() };
}

export function estConnecte(): boolean {
  return etat === 'connecte' && socket !== null;
}

async function chargerFabrique(): Promise<FabriqueSocket> {
  if (fabrique) return fabrique;
  const m = await import('./baileys');
  fabrique = m.fabriqueBaileys;
  return fabrique;
}

function annulerMinuterie() {
  if (minuterie) clearTimeout(minuterie);
  minuterie = null;
}

function programmerReconnexion(motif: string) {
  annulerMinuterie();
  const delai = Math.max(attente, ATTENTE_MIN_MS - (Date.now() - derniereTentative));
  attente = Math.min(attente * 2, ATTENTE_MAX_MS);
  log.info({ delai, motif }, 'WhatsApp : nouvelle tentative programmée');
  minuterie = setTimeout(() => void connecter({ parUtilisateur: false }), delai);
  minuterie.unref();
}

/**
 * Ouvre la connexion (code QR si l'appareil n'est jamais été lié). Ne lève jamais d'erreur.
 * `parUtilisateur` : demande explicite de l'administrateur (passe outre l'attente de 30 s).
 */
export async function connecter(opts: { parUtilisateur: boolean } = { parUtilisateur: true }): Promise<InstantaneConnexion> {
  if (connexionEnCours) await connexionEnCours;
  if (socket) return etatConnexion();
  if (!opts.parUtilisateur && Date.now() - derniereTentative < ATTENTE_MIN_MS) {
    programmerReconnexion('attente minimale');
    return etatConnexion();
  }
  annulerMinuterie();
  voulu = true;
  derniereTentative = Date.now();
  etat = 'connexion';
  erreur = null;
  qr = null;
  const gen = ++generation;
  connexionEnCours = (async () => {
    let courant: SocketWhatsApp | null = null;
    try {
      const creer = await chargerFabrique();
      disponible = true;
      const s = await creer({
        dossierAuth,
        log,
        ev: {
          surQr: (brut) => {
            if (gen !== generation) return;
            etat = 'qr';
            QRCode.toDataURL(brut, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(
              (url) => {
                if (gen === generation && etat === 'qr') qr = url;
              },
              (e) => log.warn({ err: e }, 'Code QR : image non générée'),
            );
          },
          surOuverture: (n) => {
            if (gen !== generation) return;
            etat = 'connecte';
            numero = n;
            depuis = new Date();
            qr = null;
            erreur = null;
            attente = ATTENTE_MIN_MS;
            log.info({ numero: n }, 'WhatsApp connecté');
          },
          surFermeture: (info) => {
            if (gen !== generation) return;
            const enregistre = courant ? courant.estEnregistre() : authEnregistree();
            socket = null;
            qr = null;
            depuis = null;
            if (info.deconnecte) {
              voulu = false;
              effacerAuth();
              numero = null;
              etat = 'deconnecte';
              erreur = 'Appareil déconnecté depuis le téléphone : scannez un nouveau code QR pour reprendre.';
              log.warn({ code: info.code }, 'WhatsApp : appareil déconnecté');
              return;
            }
            if (voulu && enregistre) {
              etat = 'connexion';
              erreur = info.motif;
              programmerReconnexion(info.motif);
              return;
            }
            voulu = false;
            etat = 'deconnecte';
            erreur = enregistre ? info.motif : 'Le code QR a expiré sans être scanné : cliquez de nouveau sur « Connecter ».';
            log.info({ code: info.code, motif: info.motif }, 'WhatsApp : connexion fermée');
          },
          surEntrant: (jid, texte) => {
            if (gen !== generation) return;
            try {
              surEntrant?.(jid, texte);
            } catch (e) {
              log.error({ err: e }, 'Message WhatsApp entrant : traitement en erreur');
            }
          },
        },
      });
      courant = s;
      if (gen !== generation) {
        await s.fermer(false).catch(() => {});
        return;
      }
      socket = s;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const codeModule = (e as { code?: string })?.code;
      if (codeModule === 'ERR_MODULE_NOT_FOUND' || codeModule === 'MODULE_NOT_FOUND' || /Cannot find (module|package)/i.test(message)) {
        disponible = false;
        erreur = "La bibliothèque WhatsApp n'est pas installée sur le serveur (npm install dans v2/). Le reste de l'application fonctionne normalement.";
        voulu = false;
        etat = 'deconnecte';
        log.error({ err: e }, 'WhatsApp indisponible : bibliothèque absente');
        return;
      }
      erreur = `Connexion impossible : ${message}`;
      log.error({ err: e }, 'WhatsApp : démarrage de la connexion en échec');
      if (voulu && authEnregistree()) {
        etat = 'connexion';
        programmerReconnexion(message);
      } else {
        voulu = false;
        etat = 'deconnecte';
      }
    }
  })();
  await connexionEnCours;
  connexionEnCours = null;
  return etatConnexion();
}

/** Ferme la connexion et oublie l'appareil (logout WhatsApp + effacement des identifiants). */
export async function deconnecter(): Promise<InstantaneConnexion> {
  voulu = false;
  annulerMinuterie();
  generation++;
  const s = socket;
  socket = null;
  if (s) await s.fermer(true).catch((e) => log.warn({ err: e }, 'WhatsApp : fermeture en erreur'));
  effacerAuth();
  etat = 'deconnecte';
  numero = null;
  qr = null;
  depuis = null;
  erreur = null;
  attente = ATTENTE_MIN_MS;
  return etatConnexion();
}

/** Arrêt du processus : ferme la connexion sans déconnecter l'appareil (elle reprendra au redémarrage). */
export async function arreterConnexion(): Promise<void> {
  voulu = false;
  annulerMinuterie();
  generation++;
  const s = socket;
  socket = null;
  if (s) await s.fermer(false).catch(() => {});
  etat = 'deconnecte';
  qr = null;
  depuis = null;
}

/** Envoi direct d'un texte ; réservé à la file et à l'accusé STOP. */
export async function envoyerTexte(jid: string, texte: string): Promise<void> {
  if (!estConnecte() || !socket) throw new NonConnecte();
  await socket.envoyer(jid, texte);
}

/** Au démarrage de l'API : reprend la connexion si l'appareil a déjà été lié. */
export async function reprendreSiEnregistre(): Promise<void> {
  if (authEnregistree()) await connecter({ parUtilisateur: true });
}

/** Réservé aux tests : remplace la bibliothèque par un faux et remet l'état à zéro. */
export const __tests = {
  definirFabrique(f: FabriqueSocket | null) {
    fabrique = f;
  },
  async reinitialiser() {
    await arreterConnexion();
    numero = null;
    erreur = null;
    disponible = true;
    derniereTentative = 0;
    attente = ATTENTE_MIN_MS;
  },
  /** Simule l'ouverture/fermeture par le socket courant (sans passer par la bibliothèque). */
  forcerEtat(e: EtatWhatsApp, n: string | null = numero) {
    etat = e;
    numero = n;
    depuis = e === 'connecte' ? new Date() : null;
  },
  derniereTentative: () => derniereTentative,
  reconnexionProgrammee: () => minuterie !== null,
};
