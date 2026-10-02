// Création ou modification des coordonnées d'un client.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Dialog, TextareaField, TextField } from '../../ui';
import { useEnregistrerClient } from './hooks';
import type { ClientDetail, ClientInput } from './types';

const TEL = /^[+0-9 ().-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ClientDialog({
  client,
  onClose,
  onSaved,
}: {
  /** Fiche à modifier ; absente pour un nouveau client. */
  client?: Pick<ClientDetail, 'id' | 'nom' | 'telephone' | 'email' | 'adresse' | 'notes'>;
  onClose: () => void;
  onSaved: (c: ClientDetail) => void;
}) {
  const [nom, setNom] = useState(client?.nom ?? '');
  const [telephone, setTelephone] = useState(client?.telephone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [adresse, setAdresse] = useState(client?.adresse ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [tente, setTente] = useState(false);
  const mutation = useEnregistrerClient(client?.id);

  const erreurs = {
    nom: !nom.trim() ? 'Indiquez le nom du client.' : null,
    telephone: !TEL.test(telephone.trim()) ? 'Chiffres, espaces et + uniquement (ex. 77 123 45 67).' : null,
    email: email.trim() && !EMAIL.test(email.trim()) ? 'Adresse e-mail invalide (ex. nom@domaine.sn).' : null,
  };
  const invalide = Object.values(erreurs).some(Boolean);
  const champsServeur = mutation.error instanceof ApiError ? (mutation.error.champs ?? {}) : {};
  const doublonId = mutation.error instanceof ApiError && mutation.error.status === 409 ? (mutation.error.details?.client_id as number | undefined) : undefined;

  const enregistrer = () => {
    setTente(true);
    if (invalide) return;
    const input: ClientInput = {
      nom: nom.trim(),
      telephone: telephone.trim() || null,
      email: email.trim() || null,
      adresse: adresse.trim() || null,
      notes: notes.trim() || null,
    };
    mutation.mutate(input, { onSuccess: onSaved });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={client ? 'Modifier les coordonnées' : 'Nouveau client'}
      description={client ? `Fiche de ${client.nom}. Les dossiers déjà créés gardent le nom saisi à leur création.` : 'La fiche permet de retrouver les dossiers, devis et factures du client.'}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={mutation.isPending} onClick={enregistrer}>
            {client ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        {mutation.error && (
          <Alert tone="error">
            {messageErreur(mutation.error)}
            {doublonId && (
              <>
                {' '}
                <Link className="ev-link" to={`/clients/${doublonId}`} onClick={onClose}>
                  Ouvrir la fiche existante
                </Link>
              </>
            )}
          </Alert>
        )}
        <TextField label="Nom ou raison sociale" required value={nom} onChange={(e) => setNom(e.target.value)} error={(tente ? erreurs.nom : null) ?? champsServeur.nom} maxLength={200} data-autofocus autoComplete="off" />
        <div className="ev-form-grid">
          <TextField label="Téléphone" type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} error={(tente ? erreurs.telephone : null) ?? champsServeur.telephone} placeholder="77 123 45 67" maxLength={30} />
          <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={(tente ? erreurs.email : null) ?? champsServeur.email} maxLength={200} />
        </div>
        <TextField label="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Quartier, rue, repère" maxLength={500} error={champsServeur.adresse} />
        <TextareaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} help="Visibles par l'équipe uniquement." error={champsServeur.notes} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
