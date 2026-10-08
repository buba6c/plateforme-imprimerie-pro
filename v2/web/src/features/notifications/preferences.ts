// Préférences de notification propres à chaque utilisateur et à cet appareil (localStorage).
// Le stockage peut être indisponible (navigation privée, données bloquées) : les valeurs par
// défaut s'appliquent alors et rien ne casse.

import { useCallback, useSyncExternalStore } from 'react';
import type { Role } from '@evocom/shared';

export interface PreferencesNotifications {
  /** Notifications de l'ordinateur quand l'onglet n'est pas au premier plan (si le navigateur l'autorise). */
  systeme: boolean;
  /** Signal sonore court à l'arrivée d'une notification. */
  son: boolean;
  /** Vibration du téléphone à l'arrivée d'une notification. */
  vibration: boolean;
  /** Le bandeau « Activer les notifications sur cet ordinateur » a été fermé. */
  bandeauFerme: boolean;
}

/** Le livreur travaille sur téléphone, souvent écran en poche : son et vibration d'office. */
export function preferencesParDefaut(role: Role): PreferencesNotifications {
  const terrain = role === 'livreur';
  return { systeme: true, son: terrain, vibration: terrain, bandeauFerme: false };
}

const cle = (userId: number) => `evocom.notifications.${userId}`;
const abonnes = new Set<() => void>();
const cache = new Map<string, { brut: string | null; valeur: PreferencesNotifications }>();

function lireBrut(userId: number): string | null {
  try {
    return localStorage.getItem(cle(userId));
  } catch {
    return null;
  }
}

export function lirePreferences(userId: number, role: Role): PreferencesNotifications {
  const brut = lireBrut(userId);
  const k = `${userId}:${role}`;
  const c = cache.get(k);
  if (c && c.brut === brut) return c.valeur;
  const defaut = preferencesParDefaut(role);
  let valeur = defaut;
  if (brut) {
    try {
      const o = JSON.parse(brut) as Partial<Record<keyof PreferencesNotifications, unknown>>;
      valeur = {
        systeme: typeof o.systeme === 'boolean' ? o.systeme : defaut.systeme,
        son: typeof o.son === 'boolean' ? o.son : defaut.son,
        vibration: typeof o.vibration === 'boolean' ? o.vibration : defaut.vibration,
        bandeauFerme: typeof o.bandeauFerme === 'boolean' ? o.bandeauFerme : defaut.bandeauFerme,
      };
    } catch {
      valeur = defaut;
    }
  }
  cache.set(k, { brut, valeur });
  return valeur;
}

export function ecrirePreferences(userId: number, role: Role, changement: Partial<PreferencesNotifications>) {
  const suivant = { ...lirePreferences(userId, role), ...changement };
  try {
    localStorage.setItem(cle(userId), JSON.stringify(suivant));
  } catch {
    // Stockage indisponible : la préférence vaut pour cette page seulement.
    cache.set(`${userId}:${role}`, { brut: lireBrut(userId), valeur: suivant });
  }
  abonnes.forEach((f) => f());
}

function abonner(f: () => void) {
  abonnes.add(f);
  // Un autre onglet a changé les préférences.
  const surStockage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith('evocom.notifications.')) f();
  };
  window.addEventListener('storage', surStockage);
  return () => {
    abonnes.delete(f);
    window.removeEventListener('storage', surStockage);
  };
}

export function usePreferencesNotifications(userId: number, role: Role) {
  const prefs = useSyncExternalStore(
    abonner,
    () => lirePreferences(userId, role),
    () => preferencesParDefaut(role),
  );
  const changer = useCallback((c: Partial<PreferencesNotifications>) => ecrirePreferences(userId, role, c), [userId, role]);
  return [prefs, changer] as const;
}
