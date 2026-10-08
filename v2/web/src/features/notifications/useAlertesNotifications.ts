// Ce qui se passe à l'arrivée d'une notification par le temps réel : message dans la page,
// notification de l'ordinateur si l'onglet n'est pas au premier plan, son et vibration selon
// les préférences de la personne. Monté une seule fois, par la cloche.

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthContext';
import { onNotification } from '../../lib/realtime';
import { useToast } from '../../ui';
import { jouerCarillon, preparerSonAuPremierGeste } from '../atelier/son';
import { usePreferencesNotifications } from './preferences';
import { afficherNotificationSysteme, enregistrerServiceWorker, onOuvertureDemandee, permissionNotifications, vibrer } from './systeme';

export function useAlertesNotifications() {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  const [prefs] = usePreferencesNotifications(user.id, user.role);

  // Valeurs lues au moment de l'arrivée, sans réabonner le temps réel à chaque changement.
  const courant = useRef({ prefs, chemin: loc.pathname, navigate, toast });
  courant.current = { prefs, chemin: loc.pathname, navigate, toast };

  useEffect(() => (prefs.son ? preparerSonAuPremierGeste() : undefined), [prefs.son]);

  // Autorisation déjà donnée lors d'une visite précédente : le service worker reprend la main
  // (clic sur une notification, futur Web Push).
  useEffect(() => {
    if (permissionNotifications() === 'granted') void enregistrerServiceWorker();
    return onOuvertureDemandee((chemin) => courant.current.navigate(chemin));
  }, []);

  useEffect(
    () =>
      onNotification((n) => {
        const { prefs: p, chemin, navigate: nav, toast: t } = courant.current;
        t.info(n.titre, n.message ?? undefined);
        if (p.systeme) void afficherNotificationSysteme(n, nav);
        // La file d'impression joue déjà son propre signal à l'arrivée d'un dossier.
        if (p.son && !chemin.startsWith('/atelier')) jouerCarillon();
        if (p.vibration) vibrer();
      }),
    [],
  );
}
