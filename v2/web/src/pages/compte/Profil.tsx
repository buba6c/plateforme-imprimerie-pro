import { useState } from 'react';
import { ROLE_LABELS } from '@evocom/shared';
import { useAuth, useUser } from '../../auth/AuthContext';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, PageHeader, TextField, useToast } from '../../ui';

export default function Profil() {
  const user = useUser();
  const { refresh } = useAuth();
  const toast = useToast();
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const differents = confirmation.length > 0 && nouveau !== confirmation;
  return (
    <>
      <PageHeader title="Mon compte" subtitle={`${user.nom} · ${ROLE_LABELS[user.role]}`} />
      {user.doit_changer_mdp && <Alert tone="warning">Votre mot de passe est provisoire. Choisissez-en un nouveau pour continuer en sécurité.</Alert>}
      <div className="grid-2">
        <Card title="Informations">
          <dl className="kv">
            <dt>Nom</dt>
            <dd>{user.nom}</dd>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Rôle</dt>
            <dd>{ROLE_LABELS[user.role]}</dd>
            <dt>Téléphone</dt>
            <dd>{user.telephone ?? '—'}</dd>
          </dl>
        </Card>
        <Card title="Changer de mot de passe">
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setErreur(null);
              setBusy(true);
              try {
                await api.post('/auth/mot-de-passe', { actuel, nouveau });
                setActuel('');
                setNouveau('');
                setConfirmation('');
                await refresh();
                toast.success('Mot de passe modifié', 'Vos autres sessions ont été déconnectées.');
              } catch (err) {
                setErreur(messageErreur(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {erreur && <Alert tone="error">{erreur}</Alert>}
            <TextField label="Mot de passe actuel" type="password" autoComplete="current-password" required value={actuel} onChange={(e) => setActuel(e.target.value)} />
            <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" required minLength={8} value={nouveau} onChange={(e) => setNouveau(e.target.value)} help="Au moins 8 caractères." />
            <TextField label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} error={differents ? 'Les deux mots de passe ne correspondent pas.' : null} />
            <div>
              <Button type="submit" variant="primary" busy={busy} disabled={!actuel || nouveau.length < 8 || nouveau !== confirmation}>
                Enregistrer le mot de passe
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
