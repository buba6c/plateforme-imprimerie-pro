// Boîtes de dialogue de l'écran Paiements : refus (motif obligatoire), résultat d'une validation
// groupée, validation de l'historique importé (mot de passe exigé).
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { formatEntier, formatFCFA, MODE_PAIEMENT_LABELS } from '@evocom/shared';
import { api, ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, ConfirmDialog, Dialog, Ref, Skeleton, TextareaField, TextField, useToast } from '../../ui';
import type { BilanHistorique, PaiementAdmin, ResultatGroupe } from './types';
import './paiements.css';

const MOTIFS = ['Montant remis inférieur', 'Référence introuvable', 'Paiement en double', 'Mauvais dossier'];

export function RefusDialog({ paiement, onClose, onRefuse }: { paiement: PaiementAdmin | null; onClose: () => void; onRefuse: (p: PaiementAdmin) => void }) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    setMotif('');
    setErreur(null);
  }, [paiement?.id]);
  const m = useMutation({
    mutationFn: () => api.post<PaiementAdmin>(`/paiements/${paiement!.id}/refuser`, { motif: motif.trim() }),
    onSuccess: () => {
      onRefuse(paiement!);
      onClose();
    },
    onError: (e) => setErreur(messageErreur(e)),
  });
  const court = motif.trim().length > 0 && motif.trim().length < 3;
  return (
    <ConfirmDialog
      open={!!paiement}
      onClose={() => !m.isPending && onClose()}
      onConfirm={() => m.mutate()}
      busy={m.isPending}
      disabled={motif.trim().length < 3}
      danger
      title="Refuser le paiement"
      confirmLabel="Refuser le paiement"
      description={
        paiement ? (
          <>
            <Ref>{paiement.numero}</Ref> · {paiement.client_nom} · <span className="ev-num">{formatFCFA(paiement.montant)}</span> en{' '}
            {MODE_PAIEMENT_LABELS[paiement.mode]}, encaissé par {paiement.encaisse_par_nom ?? '—'}. Le paiement ne comptera pas dans l’encaissé.
          </>
        ) : null
      }
    >
      {erreur && <Alert tone="error">{erreur}</Alert>}
      <div className="pay-motifs" role="group" aria-label="Motifs fréquents">
        {MOTIFS.map((x) => (
          <button key={x} type="button" className="pay-motif-btn" aria-pressed={motif === x} onClick={() => setMotif(x)}>
            {x}
          </button>
        ))}
      </div>
      <TextareaField
        label="Motif du refus"
        required
        data-autofocus
        value={motif}
        maxLength={500}
        rows={3}
        onChange={(e) => setMotif(e.target.value)}
        error={court ? 'Indiquez un motif d’au moins 3 caractères.' : null}
        help="Transmis à la personne qui a encaissé, pour qu’elle corrige ou saisisse un nouvel encaissement."
      />
    </ConfirmDialog>
  );
}

const CODES: Record<string, string> = {
  depassement: 'dépasserait le montant du dossier',
  dossier_supprime: 'dossier à la corbeille',
  deja_valide: 'déjà validé',
  refuse: 'déjà refusé',
  introuvable: 'introuvable',
};

export function ResultatGroupeDialog({ resultat, onClose }: { resultat: ResultatGroupe | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!resultat}
      onClose={onClose}
      title={resultat && resultat.valides > 0 ? 'Validation partielle' : 'Aucun paiement validé'}
      description={
        resultat
          ? `${formatEntier(resultat.valides)} validé${resultat.valides > 1 ? 's' : ''} (${formatFCFA(resultat.somme)}), ${resultat.refuses.length} non validé${resultat.refuses.length > 1 ? 's' : ''}. Ces derniers restent dans la sélection : ouvrez leur dossier pour comprendre, ou refusez-les.`
          : null
      }
      footer={
        <Button variant="primary" onClick={onClose}>
          Compris
        </Button>
      }
    >
      {resultat && (
        <ul className="pay-refus-liste">
          {resultat.refuses.map((r) => (
            <li key={r.id}>
              {r.numero ? <Ref>{r.numero}</Ref> : `Paiement n° ${r.id}`} · <strong>{CODES[r.code] ?? r.code}</strong>
              <br />
              <span className="ev-muted">{r.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function ilYA(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function HistoriqueDialog({ open, onClose, onValide }: { open: boolean; onClose: () => void; onValide?: (b: BilanHistorique) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [avant, setAvant] = useState(ilYA(30));
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setMotDePasse('');
      setErreur(null);
      setErreurMdp(null);
    }
  }, [open]);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(avant) && avant <= ilYA(0);
  const apercu = useQuery({
    queryKey: ['paiements', 'historique', avant],
    queryFn: () => api.get<BilanHistorique>('/paiements/historique', { avant }),
    enabled: open && dateOk,
  });
  const m = useMutation({
    mutationFn: () => api.post<BilanHistorique>('/paiements/valider-historique', { avant, mot_de_passe: motDePasse }),
    onSuccess: (b) => {
      toast.success(`${formatEntier(b.n)} paiement${b.n > 1 ? 's' : ''} importé${b.n > 1 ? 's' : ''} validé${b.n > 1 ? 's' : ''}`, `${formatFCFA(b.somme)} ajoutés à l’encaissé.`);
      for (const k of [['paiements'], ['caisse'], ['stats'], ['dossiers']]) qc.invalidateQueries({ queryKey: k });
      onValide?.(b);
      onClose();
    },
    onError: (e) => {
      setMotDePasse('');
      if (e instanceof ApiError && e.champs?.mot_de_passe) setErreurMdp(e.message);
      else setErreur(messageErreur(e));
    },
  });
  const b = apercu.data;
  const possible = dateOk && !!b && b.n > 0 && motDePasse.length > 0;
  return (
    <Dialog
      open={open}
      onClose={() => !m.isPending && onClose()}
      title="Valider l’historique importé"
      width={560}
      description="Les encaissements repris de l’ancienne plateforme arrivent « à vérifier ». Validez d’un coup ceux des dossiers déjà livrés ou terminés, encaissés avant la date choisie."
      footer={
        <>
          <Button onClick={onClose} disabled={m.isPending}>
            Annuler
          </Button>
          <Button variant="primary" icon={<History />} busy={m.isPending} disabled={!possible} onClick={() => m.mutate()}>
            {b && b.n > 0 ? `Valider ${formatEntier(b.n)} paiement${b.n > 1 ? 's' : ''}` : 'Valider'}
          </Button>
        </>
      }
    >
      {erreur && <Alert tone="error">{erreur}</Alert>}
      <TextField
        label="Encaissés avant le"
        type="date"
        required
        value={avant}
        max={ilYA(0)}
        onChange={(e) => setAvant(e.target.value)}
        error={!dateOk ? 'Choisissez une date passée.' : null}
        help="Les paiements encaissés à partir de cette date restent à vérifier un par un."
      />
      {dateOk &&
        (apercu.isError ? (
          <Alert tone="error">L’aperçu n’a pas pu être calculé : {messageErreur(apercu.error)}</Alert>
        ) : !b ? (
          <Skeleton h={72} />
        ) : (
          <>
            <div className="pay-bilan" aria-live="polite">
              <div data-ton={b.n > 0 ? 'ok' : undefined}>
                <span>Seront validés</span>
                <strong>{formatEntier(b.n)}</strong>
                <span>{formatFCFA(b.somme)}</span>
              </div>
              <div>
                <span>Laissés à vérifier</span>
                <strong>{formatEntier(b.ignores.n)}</strong>
                <span>{formatFCFA(b.ignores.somme)}</span>
              </div>
            </div>
            {b.ignores.depassement > 0 && (
              <Alert tone="warning">
                {formatEntier(b.ignores.depassement)} paiement{b.ignores.depassement > 1 ? 's' : ''} dépasserai{b.ignores.depassement > 1 ? 'ent' : 't'} le
                montant de leur dossier : ils restent dans « À vérifier » pour un contrôle au cas par cas.
              </Alert>
            )}
            {b.importes_a_valider && b.importes_a_valider.n > b.n + b.ignores.n && (
              <p className="ev-help" style={{ margin: 0 }}>
                {formatEntier(b.importes_a_valider.n - b.n - b.ignores.n)} autres paiements importés concernent des dossiers pas encore livrés ou encaissés après
                cette date : ils ne sont pas touchés.
              </p>
            )}
          </>
        ))}
      <TextField
        label="Votre mot de passe"
        type="password"
        required
        autoComplete="current-password"
        value={motDePasse}
        onChange={(e) => {
          setMotDePasse(e.target.value);
          setErreurMdp(null);
        }}
        error={erreurMdp}
        help="Pour confirmer que c’est bien vous : cette validation ne peut pas être annulée."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && possible && !m.isPending) m.mutate();
        }}
      />
    </Dialog>
  );
}
