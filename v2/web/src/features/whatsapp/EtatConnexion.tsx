import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, Power, QrCode, Send, Unplug, WifiOff } from 'lucide-react';
import { formatDateHeure, formatRelatif } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, ConfirmDialog, LoadingRows, TextField, useToast } from '../../ui';
import { champsErreur } from '../admin/hooks';
import { useConnecter, useDeconnecter, useEnvoyerTest, useStatutWhatsApp } from './api';
import { ETAT_LABELS, type StatutWhatsApp } from './types';

const ICONES = { deconnecte: WifiOff, qr: QrCode, connexion: LoaderCircle, connecte: CheckCircle2 };

function CarteEtat({ s }: { s: StatutWhatsApp }) {
  const connecter = useConnecter();
  const deconnecter = useDeconnecter();
  const toast = useToast();
  const [confirmer, setConfirmer] = useState(false);
  const Icone = ICONES[s.etat];
  const detail =
    s.etat === 'connecte'
      ? `${s.numero ?? 'numéro inconnu'} · depuis ${s.depuis ? formatRelatif(s.depuis) : '—'}${s.depuis ? ` (${formatDateHeure(s.depuis)})` : ''}`
      : s.etat === 'qr'
        ? 'Le téléphone dédié doit scanner le code ci-contre.'
        : s.etat === 'connexion'
          ? 'Patientez : la connexion s’ouvre, ou reprend après une coupure.'
          : s.enregistre
            ? 'L’appareil est déjà lié : cliquez sur Connecter pour reprendre.'
            : 'Aucun téléphone n’est lié pour l’instant.';

  return (
    <Card
      title="État de la connexion"
      actions={
        s.etat === 'deconnecte' ? (
          <Button
            variant="primary"
            icon={<Power />}
            busy={connecter.isPending}
            disabled={!s.disponible}
            onClick={() => connecter.mutate(undefined, { onError: (e) => toast.error('Connexion impossible', messageErreur(e)) })}
          >
            Connecter
          </Button>
        ) : (
          <Button variant="danger" icon={<Unplug />} busy={deconnecter.isPending} onClick={() => setConfirmer(true)}>
            Déconnecter
          </Button>
        )
      }
    >
      <div className="stack">
        <div className="wa-etat" data-etat={s.etat}>
          <span className="wa-etat__icone" aria-hidden="true">
            <Icone />
          </span>
          <div className="wa-etat__texte">
            <span className="wa-etat__titre">{ETAT_LABELS[s.etat]}</span>
            <span className="wa-etat__detail">{detail}</span>
          </div>
        </div>
        {!s.disponible && (
          <Alert tone="error">
            {s.erreur ?? 'La bibliothèque WhatsApp est absente du serveur.'} Le reste de l’application n’est pas concerné.
          </Alert>
        )}
        {s.disponible && s.erreur && <Alert tone="warning">{s.erreur}</Alert>}
        {!s.actif && (
          <Alert tone="info">
            Les envois automatiques sont désactivés : les messages sont tracés mais rien ne part. Activez-les dans l’onglet Réglages.
          </Alert>
        )}
        <div className="wa-kpis" aria-label="File d’envoi">
          <div className="wa-kpi">
            <span className="wa-kpi__label">En attente</span>
            <span className="wa-kpi__valeur">{s.file.en_attente}</span>
          </div>
          <div className="wa-kpi">
            <span className="wa-kpi__label">Aujourd’hui</span>
            <span className="wa-kpi__valeur">{s.file.envoyes_aujourdhui}</span>
          </div>
          <div className="wa-kpi" data-alerte={s.file.echecs > 0}>
            <span className="wa-kpi__label">Échecs</span>
            <span className="wa-kpi__valeur">{s.file.echecs}</span>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmer}
        onClose={() => setConfirmer(false)}
        title="Déconnecter le numéro ?"
        description="La session est fermée et l’appareil est retiré de WhatsApp. Pour reprendre, il faudra scanner un nouveau code QR. Les messages en attente restent dans la file."
        confirmLabel="Déconnecter"
        danger
        busy={deconnecter.isPending}
        onConfirm={() =>
          deconnecter.mutate(undefined, {
            onSuccess: () => {
              setConfirmer(false);
              toast.success('Numéro déconnecté');
            },
            onError: (e) => toast.error('Déconnexion impossible', messageErreur(e)),
          })
        }
      />
    </Card>
  );
}

function CarteQr({ s }: { s: StatutWhatsApp }) {
  if (s.etat === 'connecte') return null;
  const attente = s.etat === 'connexion' || (s.etat === 'qr' && !s.qr);
  return (
    <Card title="Lier le téléphone dédié">
      <div className="stack">
        {s.etat === 'deconnecte' ? (
          <p className="adm-explain">Cliquez sur Connecter : un code QR apparaît ici, à scanner avec le téléphone dédié de l’imprimerie.</p>
        ) : (
          <div className="wa-qr">
            {s.qr && !attente ? (
              <img src={s.qr} alt="Code QR à scanner avec WhatsApp sur le téléphone dédié" width={320} height={320} />
            ) : (
              <div className="wa-qr__attente" role="status">
                Préparation du code…
              </div>
            )}
            <span className="ev-muted" style={{ fontSize: 13 }}>
              Le code se renouvelle tout seul. S’il expire, cliquez de nouveau sur Connecter.
            </span>
          </div>
        )}
        <ol className="wa-etapes">
          <li>
            Sur le téléphone dédié, ouvrez <b>WhatsApp</b>.
          </li>
          <li>
            Touchez le menu (trois points, ou Réglages sur iPhone) puis <b>Appareils connectés</b>.
          </li>
          <li>
            Touchez <b>Connecter un appareil</b> et visez ce code avec l’appareil photo.
          </li>
          <li>Attendez « Connecté » ici. Le téléphone doit rester allumé et connecté à internet.</li>
        </ol>
      </div>
    </Card>
  );
}

function CarteTest({ s }: { s: StatutWhatsApp }) {
  const envoyer = useEnvoyerTest();
  const toast = useToast();
  const [telephone, setTelephone] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    envoyer.mutate(telephone, {
      onSuccess: (m) => {
        setTelephone('');
        toast.success('Message de test en file', `Il partira vers ${m.telephone} dès que les règles d’envoi le permettent (heures, délai, connexion).`);
      },
      onError: (err) => {
        const c = champsErreur(err);
        setErreur(c.telephone ?? messageErreur(err));
      },
    });
  };
  return (
    <Card title="Envoyer un message de test">
      <form className="stack" onSubmit={submit} noValidate>
        <p className="adm-explain">
          Le message suit les mêmes règles que les autres (heures d’envoi, limites, délai, liste STOP). Il apparaît dans le journal des messages.
        </p>
        <div className="wa-test">
          <TextField
            label="Numéro à qui envoyer le test"
            placeholder="77 123 45 67"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            error={erreur}
            help="Mobile sénégalais (7X XXX XX XX) ou numéro international avec +."
            inputMode="tel"
            autoComplete="off"
          />
          <Button type="submit" variant="primary" icon={<Send />} busy={envoyer.isPending} disabled={!telephone.trim() || !s.actif || !s.disponible}>
            Envoyer le test
          </Button>
        </div>
        {!s.actif && <span className="ev-help">Activez d’abord les envois dans les Réglages.</span>}
      </form>
    </Card>
  );
}

export function EtatConnexion() {
  const q = useStatutWhatsApp();
  if (q.isLoading) return <LoadingRows rows={4} />;
  if (q.isError || !q.data) return <Alert tone="error">L’état WhatsApp n’a pas pu être lu : {messageErreur(q.error)}</Alert>;
  const s = q.data;
  return (
    <div className="stack-lg">
      <div className="wa-grid">
        <div className="stack">
          <CarteEtat s={s} />
          <CarteTest s={s} />
        </div>
        <div className="stack">
          <CarteQr s={s} />
          <Card title="À savoir avant d’utiliser ce service">
            <div className="wa-avertissement">
              <Alert tone="warning">
                <div>
                  Cette connexion fonctionne comme WhatsApp Web, pas par un accord officiel avec WhatsApp. Pour éviter que le numéro soit bloqué :
                  <ul>
                    <li>utilisez un numéro dédié à l’imprimerie, jamais un numéro personnel ;</li>
                    <li>n’envoyez pas de messages en masse : seuls les clients qui ont une commande en cours sont prévenus ;</li>
                    <li>gardez des limites raisonnables (par défaut 20 messages par heure, 120 par jour, entre 08:00 et 20:00) ;</li>
                    <li>un client qui répond STOP n’est plus jamais contacté ;</li>
                    <li>si le numéro est bloqué par WhatsApp, l’application continue de fonctionner sans ce service.</li>
                  </ul>
                </div>
              </Alert>
              <p className="adm-explain" style={{ marginTop: 'var(--space-3)' }}>
                Les messages partent quand une commande est imprimée, quand une livraison est programmée et quand elle est livrée ou remise.{' '}
                <Link className="ev-link" to="/whatsapp?onglet=reglages">
                  Modifier les textes
                </Link>
                .
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
