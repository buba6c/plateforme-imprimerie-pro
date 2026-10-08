// Connexion temps réel : un signal du serveur déclenche le rechargement des données concernées.
//
// Reconnexion : les événements émis pendant la coupure sont perdus ; à chaque reconnexion, toutes
// les données affichées (notifications comprises) sont donc rechargées.
// Refus : si le serveur refuse ou ferme la connexion (session expirée, compte désactivé, rôle
// changé), la session est revérifiée ; si elle est encore valable, une nouvelle tentative suit
// (5 s, 10 s, 20 s… jusqu'à 60 s).
import { io, type Socket } from 'socket.io-client';
import { queryClient } from './query';

export interface NotificationTempsReel {
  id: number;
  type: string;
  titre: string;
  message: string | null;
  dossier_id: number | null;
  created_at?: string;
}

/** connecte : en direct ; reconnexion : coupure réseau, nouvelle tentative automatique ; refuse : le serveur a refusé la session. */
export type EtatTempsReel = 'connecte' | 'reconnexion' | 'refuse' | 'deconnecte';

let socket: Socket | null = null;
let etat: EtatTempsReel = 'deconnecte';
let dejaConnecte = false;
let essais = 0;
let relance: ReturnType<typeof setTimeout> | null = null;
type Listener = (n: NotificationTempsReel) => void;
const listeners = new Set<Listener>();
const statusListeners = new Set<(online: boolean) => void>();
const etatListeners = new Set<(e: EtatTempsReel) => void>();

export function onNotification(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function onConnexion(fn: (online: boolean) => void) {
  statusListeners.add(fn);
  fn(!!socket?.connected);
  return () => {
    statusListeners.delete(fn);
  };
}

/** État détaillé de la connexion (la cloche s'en sert pour expliquer une coupure). */
export function onEtatTempsReel(fn: (e: EtatTempsReel) => void) {
  etatListeners.add(fn);
  fn(etat);
  return () => {
    etatListeners.delete(fn);
  };
}

export function etatTempsReel(): EtatTempsReel {
  return etat;
}

function changerEtat(e: EtatTempsReel) {
  etat = e;
  etatListeners.forEach((f) => f(e));
  statusListeners.forEach((f) => f(e === 'connecte'));
}

/** Tout ce qui est affiché peut avoir changé pendant la coupure ; la session est relue à part. */
function toutRecharger() {
  void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

/** Le serveur a refusé ou fermé la connexion : on revérifie la session, puis on retente plus tard. */
function apresRefus() {
  changerEtat('refuse');
  // Session invalide : /auth/me renvoie 401, l'application revient à l'écran de connexion
  // (AuthContext) et ferme ce socket.
  void queryClient.invalidateQueries({ queryKey: ['me'] });
  if (relance) clearTimeout(relance);
  const delai = Math.min(60_000, 5_000 * 2 ** Math.min(essais, 4));
  essais += 1;
  relance = setTimeout(() => {
    relance = null;
    const s = socket as (Socket & { connect?: () => unknown }) | null;
    if (s && !s.connected && typeof s.connect === 'function') s.connect();
  }, delai);
}

export function connectRealtime() {
  if (socket) return;
  dejaConnecte = false;
  essais = 0;
  socket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    essais = 0;
    if (dejaConnecte) toutRecharger();
    dejaConnecte = true;
    changerEtat('connecte');
  });
  socket.on('disconnect', (raison: string) => {
    // « io server disconnect » : le serveur a fermé la session (compte désactivé, rôle changé) ;
    // Socket.IO ne retente pas de lui-même.
    if (raison === 'io server disconnect') apresRefus();
    else if (raison === 'io client disconnect') changerEtat('deconnecte');
    else changerEtat('reconnexion');
  });
  socket.on('connect_error', (e: Error) => {
    // Refus du serveur (session) : pas de nouvelle tentative automatique de Socket.IO.
    // Erreur réseau : Socket.IO retente seul.
    const s = socket as (Socket & { active?: boolean }) | null;
    if (e?.message === 'non_connecte' || s?.active === false) apresRefus();
    else changerEtat('reconnexion');
  });
  socket.on('dossier', (e: { id: number }) => {
    queryClient.invalidateQueries({ queryKey: ['dossiers'] });
    queryClient.invalidateQueries({ queryKey: ['dossier', e.id] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  });
  socket.on('paiement', (e: { dossier_id: number }) => {
    queryClient.invalidateQueries({ queryKey: ['paiements'] });
    queryClient.invalidateQueries({ queryKey: ['caisse'] });
    queryClient.invalidateQueries({ queryKey: ['dossier', e.dossier_id] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['dossiers', 'livraisons'] });
  });
  socket.on('notification', (n: NotificationTempsReel) => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    listeners.forEach((f) => f(n));
  });
}

export function disconnectRealtime() {
  if (relance) clearTimeout(relance);
  relance = null;
  socket?.disconnect();
  socket = null;
  changerEtat('deconnecte');
}
