// Remplace socket.io-client dans la démonstration (alias de vite.demo.config.ts) : aucune
// connexion réseau ; les événements viennent de l'API simulée (temps-reel.ts).

import { ecouter } from './temps-reel';

type Gestionnaire = (...args: any[]) => void;

export function io(..._args: unknown[]) {
  const gestionnaires = new Map<string, Set<Gestionnaire>>();
  let arreter: (() => void) | null = null;
  const socket = {
    connected: true,
    on(evenement: string, fn: Gestionnaire) {
      if (!gestionnaires.has(evenement)) gestionnaires.set(evenement, new Set());
      gestionnaires.get(evenement)!.add(fn);
      if (evenement === 'connect') setTimeout(() => socket.connected && fn(), 0);
      return socket;
    },
    off(evenement: string, fn?: Gestionnaire) {
      if (fn) gestionnaires.get(evenement)?.delete(fn);
      else gestionnaires.delete(evenement);
      return socket;
    },
    disconnect() {
      socket.connected = false;
      arreter?.();
      arreter = null;
      return socket;
    },
  };
  arreter = ecouter((evenement, donnees) => {
    if (socket.connected) gestionnaires.get(evenement)?.forEach((f) => f(donnees));
  });
  return socket;
}

export type Socket = ReturnType<typeof io>;
export default io;
