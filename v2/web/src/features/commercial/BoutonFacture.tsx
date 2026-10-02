// Bouton « Établir la facture » / « Voir la facture » pour la fiche d'un dossier.
// À utiliser dans la fiche dossier : <BoutonFacture dossier={d} />
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReceiptText } from 'lucide-react';
import { formatFCFA } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { Button, ConfirmDialog, useToast } from '../../ui';
import { useCreerFacture } from './hooks';

export function BoutonFacture({ dossier, size = 'md' }: { dossier: Pick<DossierDetail, 'id' | 'numero' | 'montant' | 'facture' | 'client_nom'>; size?: 'sm' | 'md' }) {
  const [ouvert, setOuvert] = useState(false);
  const mutation = useCreerFacture(dossier.id);
  const toast = useToast();
  const navigate = useNavigate();

  if (dossier.facture) {
    return (
      <Link className={`ev-btn${size === 'sm' ? ' ev-btn--sm' : ''}`} to={`/factures/${dossier.facture.id}`}>
        <ReceiptText aria-hidden="true" />
        Voir la facture {dossier.facture.numero}
      </Link>
    );
  }
  const sansMontant = dossier.montant === null || dossier.montant === undefined || dossier.montant <= 0;
  return (
    <>
      <Button
        size={size}
        icon={<ReceiptText />}
        disabled={sansMontant}
        title={sansMontant ? 'Définissez le montant du dossier avant de le facturer' : undefined}
        onClick={() => setOuvert(true)}
      >
        Établir la facture
      </Button>
      <ConfirmDialog
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Établir la facture"
        description={`Une facture de ${formatFCFA(dossier.montant ?? null)} sera émise au nom de ${dossier.client_nom} pour le dossier ${dossier.numero}. Son numéro est attribué définitivement : une facture se corrige en l'annulant, jamais en la supprimant.`}
        confirmLabel="Émettre la facture"
        busy={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(undefined, {
            onSuccess: (f) => {
              setOuvert(false);
              toast.success('Facture émise', f?.numero);
              if (f?.id) navigate(`/factures/${f.id}`);
            },
            onError: (e) => toast.error('Facture non émise', messageErreur(e)),
          })
        }
      />
    </>
  );
}
