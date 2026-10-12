// « Fixer le montant » : un dossier parti sans prix (montant à définir) reçoit son montant au moment
// de la livraison ou de la remise, par le livreur, le préparateur ou l'administrateur
// (POST /dossiers/:id/montant). Le montant saisi devient celui du dossier (source « saisi »).

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { formatFCFA, parseMontant } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Dialog, TextField, useToast } from '../../ui';

export function FixerMontantDialog({ dossier, onClose }: { dossier: { id: number; numero: string; client_nom: string }; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [montant, setMontant] = useState('');
  const m = parseMontant(montant);
  const erreur = montant.trim() && (m === null || m <= 0) ? 'Saisissez un montant entier en FCFA, sans centimes.' : null;
  const mutation = useMutation({
    mutationFn: () => api.post(`/dossiers/${dossier.id}/montant`, { montant: m }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
      void qc.invalidateQueries({ queryKey: ['dossier', dossier.id] });
      void qc.invalidateQueries({ queryKey: ['livraisons'] });
      toast.success('Montant du dossier fixé', `${formatFCFA(m)} · ${dossier.numero}`);
      onClose();
    },
    onError: (e) => toast.error('Montant non enregistré', messageErreur(e)),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Fixer le montant du dossier"
      description={`${dossier.numero} · ${dossier.client_nom}`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon={<Banknote />} busy={mutation.isPending} disabled={m === null || m <= 0 || !!erreur} onClick={() => mutation.mutate()}>
            {m && !erreur ? `Fixer à ${formatFCFA(m)}` : 'Fixer le montant'}
          </Button>
        </>
      }
    >
      <Alert tone="info">Ce dossier est parti sans prix. Le montant saisi ici devient celui du dossier et sert de base à l’encaissement.</Alert>
      <TextField label="Montant TTC" required mono addon="FCFA" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} error={erreur} data-autofocus />
    </Dialog>
  );
}
