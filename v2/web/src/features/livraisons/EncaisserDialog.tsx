import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { formatFCFA, MODE_PAIEMENT_LABELS, MODES_AVEC_REFERENCE, MODES_PAIEMENT, parseMontant, type ModePaiement } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Alert, Button, Dialog, SelectField, TextField, useToast } from '../../ui';
import { resteAEncaisser } from './hooks';

/**
 * Encaissement après la livraison (le client paie plus tard) : POST /dossiers/:id/paiements.
 * Le paiement est « à valider » par l'administrateur.
 */
export function EncaisserDialog({
  dossier,
  onClose,
}: {
  dossier: Pick<DossierResume, 'id' | 'numero' | 'client_nom' | 'solde' | 'en_attente_validation' | 'mode_paiement_prevu'>;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const reste = resteAEncaisser(dossier);
  const [montant, setMontant] = useState(reste ? String(reste) : '');
  const [mode, setMode] = useState<ModePaiement>(dossier.mode_paiement_prevu ?? 'especes');
  const [reference, setReference] = useState('');
  const m = parseMontant(montant);
  const refRequise = MODES_AVEC_REFERENCE.includes(mode);
  const erreur =
    m === null || m <= 0
      ? 'Saisissez un montant entier, sans centimes.'
      : reste !== null && m > reste
        ? `Le montant dépasse le reste à encaisser (${formatFCFA(reste)}).`
        : null;
  const mutation = useMutation({
    mutationFn: () => api.post(`/dossiers/${dossier.id}/paiements`, { montant: m, mode, reference: reference.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['paiements'] });
      toast.success('Encaissement enregistré', `${formatFCFA(m)} · ${dossier.numero}. Il sera validé par l’administrateur.`);
      onClose();
    },
    onError: (e) => toast.error('Encaissement impossible', messageErreur(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Encaisser un paiement"
      description={`${dossier.numero} · ${dossier.client_nom}`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon={<Banknote />} busy={mutation.isPending} disabled={!!erreur || (refRequise && !reference.trim())} onClick={() => mutation.mutate()}>
            {m && !erreur ? `Encaisser ${formatFCFA(m)}` : 'Encaisser'}
          </Button>
        </>
      }
    >
      {reste !== null && <Alert tone="info">Reste à encaisser : {formatFCFA(reste)}</Alert>}
      <div className="ev-form-grid">
        <TextField label="Montant encaissé" required mono addon="FCFA" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} error={montant ? erreur : null} data-autofocus />
        <SelectField label="Mode de paiement" required value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} options={MODES_PAIEMENT.map((v) => ({ value: v, label: MODE_PAIEMENT_LABELS[v] }))} />
        {refRequise && <TextField label="Référence de la transaction" required mono value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. numéro Wave" />}
      </div>
    </Dialog>
  );
}
