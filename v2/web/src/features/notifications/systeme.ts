// Notifications de l'ordinateur (API Notification), service worker et installation de l'application.
//
// - L'autorisation n'est demandée qu'au clic sur « Activer les notifications » (jamais au chargement).
// - Une notification système n'est affichée que si aucun onglet de l'application n'est au premier
//   plan ; le service worker le vérifie pour tous les onglets ouverts, et le même identifiant
//   (`tag`) évite les doublons quand plusieurs onglets reçoivent la même notification.
// - Le service worker (public/sw.js) ne met rien en cache : il affiche les notifications et ouvre
//   le dossier au clic. Il porte déjà l'écoute « push » pour un futur envoi Web Push (clés VAPID).

import { useEffect, useState, useSyncExternalStore } from 'react';

export type PermissionNotif = NotificationPermission | 'non_supporte';

const MODE_DEMO = import.meta.env.MODE === 'demo';
const abonnesPermission = new Set<() => void>();

export function notificationsSupportees(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
}

export function permissionNotifications(): PermissionNotif {
  if (!notificationsSupportees()) return 'non_supporte';
  try {
    return Notification.permission;
  } catch {
    return 'non_supporte';
  }
}

function abonnerPermission(f: () => void) {
  abonnesPermission.add(f);
  let statut: PermissionStatus | null = null;
  let actif = true;
  const surChangement = () => f();
  // Chrome et Firefox signalent le changement ; Safari non (relu au retour sur l'onglet).
  void navigator.permissions
    ?.query({ name: 'notifications' as PermissionName })
    .then((s) => {
      if (!actif) return;
      statut = s;
      s.addEventListener('change', surChangement);
    })
    .catch(() => {});
  document.addEventListener('visibilitychange', surChangement);
  return () => {
    actif = false;
    abonnesPermission.delete(f);
    statut?.removeEventListener('change', surChangement);
    document.removeEventListener('visibilitychange', surChangement);
  };
}

/** Suit l'autorisation (elle peut changer dans les réglages du navigateur). */
export function usePermissionNotifications(): PermissionNotif {
  return useSyncExternalStore(abonnerPermission, permissionNotifications, () => 'non_supporte' as PermissionNotif);
}

/** À appeler uniquement depuis un clic. */
export async function demanderPermission(): Promise<PermissionNotif> {
  if (!notificationsSupportees()) return 'non_supporte';
  let resultat: NotificationPermission;
  try {
    resultat = await Notification.requestPermission();
  } catch {
    // Anciens Safari : forme à rappel.
    resultat = await new Promise<NotificationPermission>((r) => {
      void Notification.requestPermission(r);
    });
  }
  abonnesPermission.forEach((f) => f());
  if (resultat === 'granted') void enregistrerServiceWorker();
  return resultat;
}

// ---------------------------------------------------------------------------
// Service worker

let enregistrement: Promise<ServiceWorkerRegistration | null> | null = null;

export function enregistrerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (MODE_DEMO || !('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(null);
  if (!enregistrement) {
    enregistrement = navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
  }
  return enregistrement;
}

/** Adresse interne sûre (jamais une autre origine). */
function cheminInterne(url: unknown): string | null {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

/** Le service worker demande d'ouvrir une page (clic sur une notification). */
export function onOuvertureDemandee(fn: (chemin: string) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {};
  const surMessage = (e: MessageEvent) => {
    const d = e.data as { type?: string; url?: unknown } | null;
    const chemin = d?.type === 'evocom:ouvrir' ? cheminInterne(d.url) : null;
    if (chemin) fn(chemin);
  };
  navigator.serviceWorker.addEventListener('message', surMessage);
  return () => navigator.serviceWorker.removeEventListener('message', surMessage);
}

export function ongletAuPremierPlan(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

export interface NotificationSysteme {
  id: number;
  titre: string;
  message: string | null;
  dossier_id: number | null;
}

/**
 * Affiche une notification de l'ordinateur. Passe par le service worker quand il est actif
 * (obligatoire sur Android), sinon par `new Notification`. Ne fait rien si l'autorisation
 * manque ou si un onglet de l'application est au premier plan.
 */
export async function afficherNotificationSysteme(n: NotificationSysteme, ouvrir: (chemin: string) => void): Promise<void> {
  if (permissionNotifications() !== 'granted' || ongletAuPremierPlan()) return;
  const url = n.dossier_id ? `/dossiers/${n.dossier_id}` : '/';
  const options: NotificationOptions = {
    body: n.message ?? undefined,
    tag: `evocom-${n.id}`,
    icon: '/icones/evocom-192.png',
    data: { url },
  };
  const reg = await enregistrerServiceWorker();
  if (reg?.active) {
    reg.active.postMessage({ type: 'evocom:afficher', titre: n.titre, options });
    return;
  }
  try {
    const notif = new Notification(n.titre, options);
    notif.onclick = () => {
      window.focus();
      ouvrir(url);
      notif.close();
    };
  } catch {
    /* navigateur qui exige le service worker : rien à afficher */
  }
}

// ---------------------------------------------------------------------------
// Installation (PWA)

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let invitation: EvenementInstallation | null = null;
const abonnesInstallation = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invitation = e as EvenementInstallation;
    abonnesInstallation.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    invitation = null;
    abonnesInstallation.forEach((f) => f());
  });
}

/** Proposition d'installation de l'application, quand le navigateur l'offre. */
export function useInstallation(): { possible: boolean; installer: () => Promise<boolean> } {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    abonnesInstallation.add(f);
    return () => {
      abonnesInstallation.delete(f);
    };
  }, []);
  return {
    possible: !!invitation,
    installer: async () => {
      const i = invitation;
      if (!i) return false;
      invitation = null;
      await i.prompt().catch(() => {});
      const choix = await i.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      abonnesInstallation.forEach((f) => f());
      return choix.outcome === 'accepted';
    },
  };
}

/** Vibration courte (téléphones Android ; ignorée ailleurs). */
export function vibrer(): void {
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    /* non pris en charge */
  }
}

/** « ordinateur » ou « téléphone », pour parler de l'appareil comme la personne le voit. */
export function nomAppareil(): 'ordinateur' | 'téléphone' {
  try {
    return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0 ? 'téléphone' : 'ordinateur';
  } catch {
    return 'ordinateur';
  }
}

/** Vibration proposée seulement sur un appareil tactile qui sait vibrer (pas sur un ordinateur). */
export function vibrationSupportee(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && navigator.maxTouchPoints > 0;
}
