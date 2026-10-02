// Connexion temps réel : un signal du serveur déclenche le rechargement des données concernées.
import { io, type Socket } from 'socket.io-client';
import { queryClient } from './query';

let socket: Socket | null = null;
type Listener = (n: { id: number; type: string; titre: string; message: string | null; dossier_id: number | null }) => void;
const listeners = new Set<Listener>();
const statusListeners = new Set<(online: boolean) => void>();

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

export function connectRealtime() {
  if (socket) return;
  socket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
  socket.on('connect', () => statusListeners.forEach((f) => f(true)));
  socket.on('disconnect', () => statusListeners.forEach((f) => f(false)));
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
  });
  socket.on('notification', (n) => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    listeners.forEach((f) => f(n));
  });
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}
