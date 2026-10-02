// Boutons d'action d'un dossier et boîtes de dialogue associées.
// Les actions affichées viennent du serveur (champ `actions`), calculées avec la même
// table de transitions que celle qui les autorise.

import { useState } from 'react';
import { Printer, Send, Truck, CheckCircle2, RotateCcw, Undo2, Lock, PackageCheck, CalendarClock } from 'lucide-react';
import {
  ACTIONS_BY_ID,
  formatFCFA,
  MODE_PAIEMENT_LABELS,
  MODES_AVEC_REFERENCE,
  MODES_PAIEMENT,
  parseMontant,
  type ActionId,
  type ModePaiement,
} from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Alert, Button, Checkbox, Dialog, SelectField, TextareaField, TextField, useToast } from '../../ui';
import { useAction } from './hooks';

const ICONS: Partial<Record<ActionId, React.ReactNode>> = {
  valider: <Send />,
  demarrer: <Printer />,
  marquer_imprime: <CheckCircle2 />,
  demander_revision: <RotateCcw />,
  remettre_en_attente: <Undo2 />,
  renvoyer_preparation: <Undo2 />,
  programmer_livraison: <CalendarClock />,
  confirmer_livraison: <PackageCheck />,
  retirer_tournee: <Undo2 />,
  cloturer: <Lock />,
  reimprimer: <Printer />,
  rouvrir: <Undo2 />,
};

function demainMatin(): string {
  const d = new Date();
  d.setDate(d.getDate() + (d.getHours() >= 16 ? 1 : 0));
  d.setHours(d.getHours() >= 16 ? 9 : Math.max(d.getHours() + 1, 9), 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  dossier: Pick<DossierResume, 'id' | 'numero' | 'actions' | 'nb_fichiers' | 'solde' | 'montant' | 'adresse_livraison' | 'mode_paiement_prevu' | 'en_attente_validation'>;
  size?: 'sm' | 'md' | 'lg';
  /** N'afficher que l'action principale (cartes de file de travail). */
  principaleSeulement?: boolean;
  block?: boolean;
}

export function DossierActions({ dossier, size = 'md', principaleSeulement, block }: Props) {
  const [ouverte, setOuverte] = useState<ActionId | null>(null);
  const toast = useToast();
  const mutation = useAction(dossier.id);
  const actions = dossier.actions.map((a) => ACTIONS_BY_ID[a]).filter(Boolean);
  const visibles = principaleSeulement ? actions.filter((a) => a.tone === 'primary').slice(0, 1) : actions;
  if (!visibles.length) return null;

  const executer = (action: ActionId, input = {}) =>
    mutation.mutate(
      { action, input },
      {
        onSuccess: () => {
          toast.success(ACTIONS_BY_ID[action].journal, dossier.numero);
          setOuverte(null);
        },
        onError: (e) => toast.error('Action impossible', messageErreur(e)),
      },
    );

  const demarrerAction = (id: ActionId) => {
    const a = ACTIONS_BY_ID[id];
    if (a.requiresComment || a.form) setOuverte(id);
    else if (id === 'valider' && dossier.nb_fichiers < 1) {
      toast.error('Fichier manquant', 'Ajoutez au moins un fichier avant de valider le dossier.');
    } else executer(id);
  };

  const courante = ouverte ? ACTIONS_BY_ID[ouverte] : null;
  return (
    <>
      <div className="ev-btn-group" style={block ? { width: '100%' } : undefined}>
        {visibles.map((a) => (
          <Button
            key={a.id}
            variant={a.tone === 'primary' ? 'primary' : a.tone === 'danger' ? 'danger' : 'secondary'}
            size={size}
            block={block}
            icon={ICONS[a.id]}
            busy={mutation.isPending && mutation.variables?.action === a.id}
            disabled={mutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              demarrerAction(a.id);
            }}
            title={a.id === 'valider' && dossier.nb_fichiers < 1 ? 'Ajoutez au moins un fichier' : undefined}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {courante?.form === 'livraison' && (
        <ProgrammerDialog
          numero={dossier.numero}
          adresse={dossier.adresse_livraison ?? ''}
          busy={mutation.isPending}
          onClose={() => setOuverte(null)}
          onValider={(livraison) => executer('programmer_livraison', { livraison })}
        />
      )}
      {courante?.form === 'confirmation_livraison' && (
        <LivrerDialog
          numero={dossier.numero}
          reste={dossier.solde === null || dossier.solde === undefined ? null : Math.max(0, dossier.solde - (dossier.en_attente_validation ?? 0))}
          modePrevu={dossier.mode_paiement_prevu ?? null}
          busy={mutation.isPending}
          onClose={() => setOuverte(null)}
          onValider={(encaissement) => executer('confirmer_livraison', { encaissement })}
        />
      )}
      {courante?.requiresComment && (
        <CommentaireDialog
          titre={courante.label}
          description={
            courante.id === 'demander_revision'
              ? `Le dossier ${dossier.numero} repart chez le préparateur avec votre commentaire.`
              : `Expliquez pourquoi, pour l'historique du dossier ${dossier.numero}.`
          }
          label={courante.id === 'demander_revision' ? 'Ce qu\'il faut corriger' : 'Motif'}
          confirmLabel={courante.id === 'demander_revision' ? 'Envoyer en révision' : courante.label}
          busy={mutation.isPending}
          onClose={() => setOuverte(null)}
          onValider={(commentaire) => executer(courante.id, { commentaire })}
        />
      )}
    </>
  );
}

function CommentaireDialog({ titre, description, label, confirmLabel, busy, onClose, onValider }: {
  titre: string; description: string; label: string; confirmLabel: string; busy: boolean; onClose: () => void; onValider: (c: string) => void;
}) {
  const [texte, setTexte] = useState('');
  const ok = texte.trim().length >= 3;
  return (
    <Dialog
      open
      onClose={onClose}
      title={titre}
      description={description}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={busy} disabled={!ok} onClick={() => onValider(texte.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <TextareaField label={label} required value={texte} onChange={(e) => setTexte(e.target.value)} data-autofocus rows={4} help="Au moins 3 caractères. Visible dans l'historique du dossier." />
    </Dialog>
  );
}

function ProgrammerDialog({ numero, adresse, busy, onClose, onValider }: {
  numero: string; adresse: string; busy: boolean; onClose: () => void; onValider: (l: { date_prevue: string; adresse: string | null; notes: string | null }) => void;
}) {
  const [date, setDate] = useState(demainMatin());
  const [adr, setAdr] = useState(adresse);
  const [notes, setNotes] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title="Programmer la livraison"
      description={`Le dossier ${numero} passe dans votre tournée.`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={busy} disabled={!date} icon={<Truck />} onClick={() => onValider({ date_prevue: date, adresse: adr.trim() || null, notes: notes.trim() || null })}>
            Programmer
          </Button>
        </>
      }
    >
      <TextField label="Date et heure prévues" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} data-autofocus />
      <TextField label="Adresse de livraison" value={adr} onChange={(e) => setAdr(e.target.value)} placeholder="Quartier, rue, repère" />
      <TextareaField label="Notes pour la livraison" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
    </Dialog>
  );
}

function LivrerDialog({ numero, reste, modePrevu, busy, onClose, onValider }: {
  numero: string; reste: number | null; modePrevu: ModePaiement | null; busy: boolean; onClose: () => void;
  onValider: (e: { montant: number; mode: ModePaiement; reference: string | null } | null) => void;
}) {
  const [encaisser, setEncaisser] = useState(reste !== null && reste > 0);
  const [montant, setMontant] = useState(reste ? String(reste) : '');
  const [mode, setMode] = useState<ModePaiement>(modePrevu ?? 'especes');
  const [reference, setReference] = useState('');
  const m = parseMontant(montant);
  const refRequise = MODES_AVEC_REFERENCE.includes(mode);
  let erreur: string | null = null;
  if (encaisser) {
    if (m === null || m <= 0) erreur = 'Saisissez un montant entier, sans centimes.';
    else if (reste !== null && m > reste) erreur = `Le montant dépasse le reste à payer (${formatFCFA(reste)}).`;
  }
  const refManquante = encaisser && refRequise && !reference.trim();
  return (
    <Dialog
      open
      onClose={onClose}
      title="Confirmer la livraison"
      description={`Le dossier ${numero} sera marqué comme livré.`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!!erreur || refManquante}
            icon={<PackageCheck />}
            onClick={() => onValider(encaisser && m ? { montant: m, mode, reference: reference.trim() || null } : null)}
          >
            {encaisser && m ? `Livrer et encaisser ${formatFCFA(m)}` : 'Confirmer la livraison'}
          </Button>
        </>
      }
    >
      {reste === null ? (
        <Alert tone="info">Aucun montant n'est défini pour ce dossier : vous pouvez tout de même noter un encaissement.</Alert>
      ) : reste === 0 ? (
        <Alert tone="success">Ce dossier est déjà payé ou en attente de validation.</Alert>
      ) : (
        <Alert tone="info">Reste à encaisser : {formatFCFA(reste)}</Alert>
      )}
      <Checkbox label="J'ai encaissé un paiement à la livraison" checked={encaisser} onChange={setEncaisser} />
      {encaisser && (
        <div className="ev-form-grid">
          <TextField label="Montant encaissé" required mono addon="FCFA" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} error={montant ? erreur : null} />
          <SelectField label="Mode de paiement" required value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} options={MODES_PAIEMENT.map((v) => ({ value: v, label: MODE_PAIEMENT_LABELS[v] }))} />
          {refRequise && (
            <TextField label="Référence de la transaction" required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. numéro Wave" mono />
          )}
        </div>
      )}
      {encaisser && <p className="ev-help" style={{ margin: 0 }}>L'encaissement sera validé par l'administrateur.</p>}
    </Dialog>
  );
}
