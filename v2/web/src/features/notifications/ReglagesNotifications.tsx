// Réglages des notifications sur cet appareil (dans la cloche) et bandeau d'activation.

import { useState } from 'react';
import { BellRing, Download } from 'lucide-react';
import { useUser } from '../../auth/AuthContext';
import { Button, Checkbox } from '../../ui';
import { essayerSon } from '../atelier/son';
import { usePreferencesNotifications } from './preferences';
import { demanderPermission, nomAppareil, useInstallation, usePermissionNotifications, vibrationSupportee, vibrer, type PermissionNotif } from './systeme';

function useActivation() {
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<PermissionNotif | null>(null);
  const activer = async () => {
    setEnCours(true);
    try {
      setResultat(await demanderPermission());
    } finally {
      setEnCours(false);
    }
  };
  return { enCours, resultat, activer };
}

/** Bandeau sous la cloche, tant que l'autorisation n'a été ni donnée ni refusée et qu'il n'a pas été fermé. */
export function BandeauActivation({ masque }: { masque: boolean }) {
  const user = useUser();
  const permission = usePermissionNotifications();
  const [prefs, changer] = usePreferencesNotifications(user.id, user.role);
  const { enCours, activer } = useActivation();
  if (masque || permission !== 'default' || prefs.bandeauFerme) return null;
  return (
    <div className="notif-bandeau" role="region" aria-labelledby="notif-bandeau-titre">
      <span className="notif-bandeau__icone" aria-hidden="true">
        <BellRing />
      </span>
      <div className="notif-bandeau__texte">
        <strong id="notif-bandeau-titre">{nomAppareil() === 'téléphone' ? 'Être prévenu sur ce téléphone' : 'Être prévenu sur cet ordinateur'}</strong>
        <p>Une notification s’affiche même quand Evocom Print est dans un autre onglet ou réduit.</p>
        <div className="notif-bandeau__actions">
          <Button size="sm" variant="primary" busy={enCours} onClick={() => void activer()}>
            Activer les notifications
          </Button>
          <Button size="sm" variant="ghost" onClick={() => changer({ bandeauFerme: true })}>
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Pied de la cloche : autorisation, son, vibration, installation. */
export function ReglagesNotifications() {
  const user = useUser();
  const permission = usePermissionNotifications();
  const [prefs, changer] = usePreferencesNotifications(user.id, user.role);
  const { enCours, resultat, activer } = useActivation();
  const installation = useInstallation();
  const vibration = vibrationSupportee();

  return (
    <section className="notif-reglages" aria-labelledby="notif-reglages-titre">
      <h3 id="notif-reglages-titre" className="notif-reglages__titre">
        Sur cet appareil
      </h3>
      {permission === 'default' && (
        <div className="notif-reglages__ligne">
          <Button size="sm" variant="primary" icon={<BellRing />} busy={enCours} onClick={() => void activer()}>
            {nomAppareil() === 'téléphone' ? 'Activer les notifications sur ce téléphone' : 'Activer les notifications sur cet ordinateur'}
          </Button>
          {resultat === 'default' && <p className="notif-reglages__aide">La demande a été fermée sans réponse. Cliquez de nouveau pour l’afficher.</p>}
        </div>
      )}
      {permission === 'granted' && (
        <Checkbox label={`Notifications ${nomAppareil() === 'téléphone' ? 'du téléphone' : 'de l’ordinateur'} (application en arrière-plan)`} checked={prefs.systeme} onChange={(v) => changer({ systeme: v })} />
      )}
      {permission === 'denied' && (
        <p className="notif-reglages__aide">
          Les notifications sont bloquées pour ce site. Pour les recevoir, autorisez-les dans les réglages du navigateur (icône à gauche de l’adresse), puis rechargez la page.
        </p>
      )}
      {permission === 'non_supporte' && (
        <p className="notif-reglages__aide">
          Ce navigateur n’affiche pas les notifications de l’ordinateur. Sur iPhone, ajoutez d’abord Evocom Print à l’écran d’accueil.
        </p>
      )}
      <Checkbox
        label="Son à l’arrivée d’une notification"
        checked={prefs.son}
        onChange={(v) => {
          changer({ son: v });
          // Le clic sur la case vaut geste : le navigateur autorise le son à partir de là.
          if (v) void essayerSon();
        }}
      />
      {vibration && (
        <Checkbox
          label="Vibration du téléphone"
          checked={prefs.vibration}
          onChange={(v) => {
            changer({ vibration: v });
            if (v) vibrer();
          }}
        />
      )}
      {installation.possible && (
        <div className="notif-reglages__ligne">
          <Button size="sm" variant="ghost" icon={<Download />} onClick={() => void installation.installer()}>
            Installer l’application sur cet appareil
          </Button>
        </div>
      )}
    </section>
  );
}
