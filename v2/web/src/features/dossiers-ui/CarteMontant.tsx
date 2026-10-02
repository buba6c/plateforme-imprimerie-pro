// Carte « Montant et paiements » de la fiche dossier : montant, paiements, solde,
// détail du prix, enregistrement d'un paiement et facture.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, ChevronRight, FileText, ReceiptText } from 'lucide-react';
import {
  formatDateHeure,
  formatFCFA,
  MODE_PAIEMENT_LABELS,
  MODES_AVEC_REFERENCE,
  MODES_PAIEMENT,
  paiementInputSchema,
  parseMontant,
  type ModePaiement,
  type ParamsPrix,
  type ResultatPrix,
} from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { Alert, Button, Dialog, PaiementStatutBadge, PaymentBadge, SelectField, TextareaField, TextField, useToast } from '../../ui';
import { LignesPrix, TotauxPrix } from '../specs/PrixPanel';
import './dossiers-ui.css';

const SOURCE: Record<string, string> = { calcul: 'calculé selon la grille', saisi: 'saisi à la main', devis: 'repris du devis' };

export function CarteMontant({ d, peutEncaisser, peutFacturer, params, libelleGroupe }: {
  d: DossierDetail;
  peutEncaisser: boolean;
  peutFacturer: boolean;
  params: ParamsPrix;
  libelleGroupe: (g: number) => string;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [paiement, setPaiement] = useState(false);
  const [facturation, setFacturation] = useState(false);
  const montant = d.montant ?? null;
  const dejaPaye = d.deja_paye ?? 0;
  const attente = d.en_attente_validation ?? 0;
  const reste = montant === null ? null : Math.max(0, montant - dejaPaye - attente);
  const detail = d.detail_prix && (d.detail_prix as ResultatPrix).ok ? (d.detail_prix as ResultatPrix) : null;

  const creerFacture = async () => {
    setFacturation(true);
    try {
      const f = await api.post<{ id: number; numero?: string }>(`/dossiers/${d.id}/facture`);
      toast.success('Facture créée', f.numero ?? d.numero);
      void qc.invalidateQueries({ queryKey: ['dossier', d.id] });
      void qc.invalidateQueries({ queryKey: ['factures'] });
      if (f.id) navigate(`/factures/${f.id}`);
    } catch (e) {
      toast.error('Facture non créée', messageErreur(e));
    } finally {
      setFacturation(false);
    }
  };

  return (
    <section className="ev-card">
      <header className="ev-card__head">
        <h2 className="ev-card__title">Montant et paiements</h2>
        {d.situation_paiement && <PaymentBadge situation={d.situation_paiement} enAttente={attente} />}
      </header>
      <div className="ev-card__body stack">
        <dl className="fd-kv fd-kv--num">
          <dt>Montant</dt>
          <dd>
            <span className="ev-num">{formatFCFA(montant)}</span>
            {montant !== null && d.montant_source && <div className="ev-muted" style={{ fontSize: 12 }}>{SOURCE[d.montant_source] ?? d.montant_source}</div>}
          </dd>
          <dt>Déjà payé</dt>
          <dd className="ev-num">{formatFCFA(dejaPaye)}</dd>
          {attente > 0 && (
            <>
              <dt>À valider</dt>
              <dd className="ev-num">{formatFCFA(attente)}</dd>
            </>
          )}
        </dl>
        <div className="fd-solde">
          <span>Reste à payer</span>
          <span className="ev-num">{montant === null ? '—' : formatFCFA(d.solde ?? 0)}</span>
        </div>
        {montant === null && <p className="ev-help" style={{ margin: 0 }}>Montant à définir : modifiez le dossier pour le calculer ou le saisir.</p>}

        {detail && (
          <details className="fd-details">
            <summary>
              <ChevronRight aria-hidden="true" />
              Détail du prix
            </summary>
            <div className="stack-sm">
              <LignesPrix lignes={detail.lignes} titreGroupe={libelleGroupe} />
              <TotauxPrix r={detail} params={params} montantRetenu={montant} />
            </div>
          </details>
        )}

        {d.paiements.length > 0 && (
          <div className="stack-sm">
            <h3 className="section-title">Paiements</h3>
            <ul className="fd-paiements">
              {d.paiements.map((p) => (
                <li key={p.id} className="fd-paiement">
                  <span>
                    <span className="ev-num">{formatFCFA(p.montant)}</span> <span className="ev-muted">· {MODE_PAIEMENT_LABELS[p.mode]}</span>
                  </span>
                  <PaiementStatutBadge statut={p.statut} />
                  <span className="fd-paiement__meta">
                    <span className="ev-mono">{formatDateHeure(p.encaisse_at)}</span>
                    {p.encaisse_par_nom ? ` · ${p.encaisse_par_nom}` : ''}
                    {p.reference ? (
                      <>
                        {' · '}
                        <span className="ev-mono">Réf. {p.reference}</span>
                      </>
                    ) : null}
                  </span>
                  {p.notes && <span className="fd-paiement__meta">{p.notes}</span>}
                  {p.statut === 'refuse' && p.motif_refus && <span className="fd-paiement__meta" style={{ color: 'var(--danger-ink)' }}>Refusé : {p.motif_refus}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {(peutEncaisser || (peutFacturer && (d.facture || montant !== null))) && (
        <footer className="ev-card__foot fd-montant-foot">
          {peutEncaisser && montant !== null && reste !== null && reste > 0 && (
            <Button size="sm" variant="primary" block icon={<Banknote />} onClick={() => setPaiement(true)}>
              Enregistrer un paiement
            </Button>
          )}
          {peutEncaisser && montant === null && (
            <Button size="sm" block icon={<Banknote />} onClick={() => setPaiement(true)}>
              Enregistrer un paiement
            </Button>
          )}
          {peutFacturer && d.facture && (
            <Link className="ev-btn ev-btn--sm ev-btn--block" to={`/factures/${d.facture.id}`}>
              <ReceiptText aria-hidden="true" />
              Facture <span className="ev-ref">{d.facture.numero}</span>
            </Link>
          )}
          {peutFacturer && !d.facture && montant !== null && (
            <Button size="sm" block icon={<FileText />} busy={facturation} onClick={() => void creerFacture()}>
              Créer la facture
            </Button>
          )}
        </footer>
      )}
      {paiement && <PaiementDialog d={d} reste={reste} onClose={() => setPaiement(false)} />}
    </section>
  );
}

function PaiementDialog({ d, reste, onClose }: { d: DossierDetail; reste: number | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [montant, setMontant] = useState(reste ? String(reste) : '');
  const [mode, setMode] = useState<ModePaiement>(d.mode_paiement_prevu ?? 'especes');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const refRequise = MODES_AVEC_REFERENCE.includes(mode);

  const valider = async () => {
    const m = parseMontant(montant);
    const corps = { montant: m ?? Number.NaN, mode, reference: reference.trim() || null, notes: notes.trim() || null };
    const e: Record<string, string> = {};
    const r = paiementInputSchema.safeParse(corps);
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    if (m === null) e.montant = 'Saisissez un montant entier en FCFA, sans centimes.';
    else if (reste !== null && m > reste) e.montant = `Le montant dépasse le reste à payer (${formatFCFA(reste)}).`;
    if (refRequise && !reference.trim()) e.reference = 'La référence est obligatoire pour ce mode de paiement.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEnvoi(true);
    try {
      await api.post(`/dossiers/${d.id}/paiements`, corps);
      toast.success('Paiement enregistré', `${formatFCFA(m)} · ${d.numero}`);
      void qc.invalidateQueries({ queryKey: ['dossier', d.id] });
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
      void qc.invalidateQueries({ queryKey: ['paiements'] });
      onClose();
    } catch (err) {
      setErreurs({ _: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Enregistrer un paiement"
      description={`Dossier ${d.numero} · ${d.client_nom}`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={envoi} icon={<Banknote />} onClick={() => void valider()}>
            Enregistrer le paiement
          </Button>
        </>
      }
    >
      {erreurs._ && <Alert tone="error">{erreurs._}</Alert>}
      {reste !== null && <Alert tone="info">Reste à payer : {formatFCFA(reste)}</Alert>}
      <div className="ev-form-grid">
        <TextField label="Montant" required mono addon="FCFA" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} error={erreurs.montant} data-autofocus />
        <SelectField label="Mode de paiement" required value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} options={MODES_PAIEMENT.map((v) => ({ value: v, label: MODE_PAIEMENT_LABELS[v] }))} />
      </div>
      <TextField
        label="Référence de la transaction"
        required={refRequise}
        mono
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        error={erreurs.reference}
        placeholder={refRequise ? 'Numéro de transaction, de chèque ou de virement' : 'Facultatif'}
      />
      <TextareaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} error={erreurs.notes} />
    </Dialog>
  );
}
