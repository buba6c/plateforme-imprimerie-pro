import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, Download, FolderOpen, Printer, ReceiptText } from 'lucide-react';
import { formatDateHeure, formatDecimal, formatFCFA } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Dialog, EmptyState, PageHeader, PaymentBadge, Skeleton, TextareaField, useToast } from '../../ui';
import { BlocDocument, FactureStatutBadge, LignesDocument, Totaux, type LigneTotal } from '../../features/commercial/Document';
import { formatJour, lignesFacture } from '../../features/commercial/format';
import { useAnnulerFacture, useFacture, useParametres } from '../../features/commercial/hooks';
import type { Entreprise, FactureDetail } from '../../features/commercial/types';
import '../../features/commercial/commercial.css';

export default function FicheFacture() {
  const id = Number(useParams().id);
  const facture = useFacture(Number.isInteger(id) && id > 0 ? id : undefined);

  if (facture.isLoading) {
    return (
      <div className="stack-lg" aria-busy="true">
        <Skeleton h={34} w={320} />
        <Skeleton h={560} />
      </div>
    );
  }
  if (facture.isError || !facture.data) {
    const introuvable = facture.error instanceof ApiError && facture.error.status === 404;
    return (
      <>
        <PageHeader title="Facture" crumbs={<Link to="/factures">Factures</Link>} />
        <Card>
          <EmptyState
            title={introuvable ? 'Facture introuvable' : 'La facture n’a pas pu être chargée'}
            icon={<ReceiptText aria-hidden="true" />}
            action={
              <Link className="ev-btn ev-btn--sm" to="/factures">
                Revenir à la liste des factures
              </Link>
            }
          >
            {introuvable ? 'Aucune facture ne porte ce numéro interne.' : messageErreur(facture.error)}
          </EmptyState>
        </Card>
      </>
    );
  }
  return <Fiche f={facture.data} />;
}

function Fiche({ f }: { f: FactureDetail }) {
  const user = useUser();
  const admin = user.role === 'admin';
  const parametres = useParametres();
  const entreprise = parametres.data?.entreprise;
  const [annulation, setAnnulation] = useState(false);
  const annulee = f.statut === 'annulee';
  const pdf = `/api/factures/${f.id}/pdf`;

  const totaux: LigneTotal[] =
    f.tva_taux > 0
      ? [
          { label: 'Total HT', valeur: formatFCFA(f.total_ht) },
          { label: `TVA (${formatDecimal(f.tva_taux)} %)`, valeur: formatFCFA(f.tva) },
          { label: 'Total TTC', valeur: formatFCFA(f.total_ttc), fort: true },
        ]
      : [{ label: 'Total', valeur: formatFCFA(f.total_ttc), fort: true }];

  const reste = f.reste ?? null;
  const montantChange = !annulee && f.dossier_montant !== null && f.dossier_montant !== undefined && f.dossier_montant !== f.total_ttc;
  const coordonneesManquantes = !!entreprise && !entreprise.adresse && !entreprise.telephone && !entreprise.ninea;

  return (
    <>
      <PageHeader
        crumbs={
          <>
            <Link to="/factures">Factures</Link>
            <span aria-hidden="true">/</span>
            <span className="ev-ref">{f.numero}</span>
          </>
        }
        title={
          <span className="row" style={{ gap: 'var(--space-3)' }}>
            Facture <span className="ev-mono">{f.numero}</span>
          </span>
        }
        subtitle={
          <span className="row" style={{ gap: 'var(--space-2)' }}>
            <FactureStatutBadge statut={f.statut} />
            {!annulee && f.situation_paiement && <PaymentBadge situation={f.situation_paiement} enAttente={f.en_attente_validation} />}
            <span>{f.client_nom}</span>
          </span>
        }
        actions={
          <div className="ev-btn-group">
            {admin && !annulee && (
              <Button icon={<Ban />} onClick={() => setAnnulation(true)}>
                Annuler la facture
              </Button>
            )}
            <Link className="ev-btn" to={`/dossiers/${f.dossier_id}`}>
              <FolderOpen aria-hidden="true" />
              Ouvrir le dossier
            </Link>
            <a className="ev-btn" href={pdf} target="_blank" rel="noopener">
              <Printer aria-hidden="true" />
              Imprimer
            </a>
            <a className="ev-btn ev-btn--primary" href={`${pdf}?telecharger=1`} download>
              <Download aria-hidden="true" />
              Télécharger le PDF
            </a>
          </div>
        }
      />

      <div className="grid-main">
        <div className="stack">
          {annulee && (
            <Alert tone="error">
              <strong>Facture annulée</strong> le {formatDateHeure(f.annulee_at)}
              {f.annulee_par_nom ? ` par ${f.annulee_par_nom}` : ''}.{f.motif_annulation ? ` Motif : ${f.motif_annulation}.` : ''} Ce document n’est plus valable ; le
              numéro {f.numero} reste attribué et ne sera jamais réutilisé.
            </Alert>
          )}
          {montantChange && (
            <Alert tone="warning">
              Le montant du dossier ({formatFCFA(f.dossier_montant)}) ne correspond plus au total de cette facture ({formatFCFA(f.total_ttc)}).
              {admin ? ' Annulez la facture puis émettez-en une nouvelle depuis le dossier pour facturer le bon montant.' : ' Signalez-le à l’administrateur : seule une nouvelle facture peut corriger le montant.'}
            </Alert>
          )}
          {admin && coordonneesManquantes && (
            <Alert tone="info">
              Les coordonnées de l’entreprise (adresse, téléphone, NINEA) ne sont pas renseignées : elles n’apparaissent pas sur les factures.{' '}
              <Link className="ev-link" to="/admin/parametres">
                Les compléter dans Paramètres
              </Link>
            </Alert>
          )}

          <article className="ev-card cm-doc" aria-label={`Facture ${f.numero}`}>
            <header className="cm-doc__tete">
              <Emetteur entreprise={entreprise} chargement={parametres.isLoading} />
              <div>
                <h2 className="cm-doc__type">Facture</h2>
                <dl className="cm-doc__meta">
                  <dt>Numéro</dt>
                  <dd className="ev-ref">{f.numero}</dd>
                  <dt>Date d’émission</dt>
                  <dd className="ev-ref">{formatJour(f.date_emission)}</dd>
                  <dt>Dossier</dt>
                  <dd>
                    <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
                      {f.dossier_numero ?? `n° ${f.dossier_id}`}
                    </Link>
                  </dd>
                </dl>
              </div>
            </header>

            <div className="cm-doc__parties">
              <BlocDocument titre="Facturé à">
                <strong>{f.client_nom}</strong>
                {f.client_adresse && <span>{f.client_adresse}</span>}
                {f.client_telephone && <span className="ev-ref">Tél. {f.client_telephone}</span>}
                {f.client_id && (
                  <Link className="ev-link" style={{ fontSize: 13, marginTop: 4 }} to={`/clients/${f.client_id}`}>
                    Voir la fiche client
                  </Link>
                )}
              </BlocDocument>
            </div>

            <div className="stack">
              <LignesDocument lignes={lignesFacture(f.lignes)} />
              <Totaux lignes={totaux} label="Totaux de la facture" />
              {!annulee && reste !== null && (
                <Totaux
                  label="Règlement"
                  lignes={[
                    { label: 'Déjà réglé', valeur: formatFCFA(f.deja_paye ?? null) },
                    { label: 'Reste à payer', valeur: formatFCFA(reste), tone: reste > 0 ? 'danger' : 'success' },
                  ]}
                />
              )}
            </div>

            <footer className="cm-doc__pied">
              <p>
                Montants en francs CFA (FCFA){f.tva_taux > 0 ? '' : ', TVA non applicable'}. Facture établie pour le dossier {f.dossier_numero ?? `n° ${f.dossier_id}`}.
              </p>
              {entreprise?.pied_facture && <p>{entreprise.pied_facture}</p>}
            </footer>
          </article>
        </div>

        <aside className="stack">
          {!annulee && (
            <Card title="Situation de paiement">
              <div className="stack">
                <dl className="cm-kv">
                  <dt>Total facturé</dt>
                  <dd className="ev-num">{formatFCFA(f.total_ttc)}</dd>
                  <dt>Déjà payé</dt>
                  <dd className="ev-num">{formatFCFA(f.deja_paye ?? null)}</dd>
                  {(f.en_attente_validation ?? 0) > 0 && (
                    <>
                      <dt>À valider</dt>
                      <dd className="ev-num">{formatFCFA(f.en_attente_validation)}</dd>
                    </>
                  )}
                  <dt>Reste à payer</dt>
                  <dd className={`ev-num${reste && reste > 0 ? ' cm-danger' : ''}`}>{formatFCFA(reste)}</dd>
                </dl>
                <p className="ev-help" style={{ margin: 0 }}>
                  Seuls les paiements validés comptent comme réglés.
                  {(f.en_attente_validation ?? 0) > 0 ? ' Les encaissements à valider le seront par l’administrateur.' : ''}
                </p>
              </div>
            </Card>
          )}
          <Card title="Informations">
            <dl className="cm-kv">
              <dt>Statut</dt>
              <dd>
                <FactureStatutBadge statut={f.statut} />
              </dd>
              <dt>Émise par</dt>
              <dd>{f.created_by_nom ?? '—'}</dd>
              <dt>Créée le</dt>
              <dd className="ev-ref">{formatDateHeure(f.created_at)}</dd>
              {annulee && (
                <>
                  <dt>Annulée le</dt>
                  <dd className="ev-ref">{formatDateHeure(f.annulee_at)}</dd>
                  <dt>Annulée par</dt>
                  <dd>{f.annulee_par_nom ?? '—'}</dd>
                  <dt>Motif</dt>
                  <dd>{f.motif_annulation ?? '—'}</dd>
                </>
              )}
              <dt>Dossier</dt>
              <dd>
                <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
                  {f.dossier_numero ?? `n° ${f.dossier_id}`}
                </Link>
              </dd>
            </dl>
          </Card>
        </aside>
      </div>

      {annulation && <AnnulationDialog f={f} onClose={() => setAnnulation(false)} />}
    </>
  );
}

function Emetteur({ entreprise, chargement }: { entreprise: Entreprise | undefined; chargement: boolean }) {
  if (chargement) return <Skeleton h={64} w={220} />;
  if (!entreprise) return <div className="cm-doc__emetteur" />;
  const ids = [entreprise.ninea && `NINEA ${entreprise.ninea}`, entreprise.rccm && `RCCM ${entreprise.rccm}`].filter(Boolean).join(' · ');
  return (
    <div className="cm-doc__emetteur">
      <strong>{entreprise.nom}</strong>
      {entreprise.adresse && <span>{entreprise.adresse}</span>}
      {(entreprise.telephone || entreprise.email) && <span>{[entreprise.telephone && `Tél. ${entreprise.telephone}`, entreprise.email].filter(Boolean).join(' · ')}</span>}
      {ids && <span>{ids}</span>}
    </div>
  );
}

function AnnulationDialog({ f, onClose }: { f: FactureDetail; onClose: () => void }) {
  const [motif, setMotif] = useState('');
  const [tente, setTente] = useState(false);
  const mutation = useAnnulerFacture(f.id);
  const toast = useToast();
  const erreur = motif.trim().length < 3 ? 'Indiquez le motif (3 caractères au moins).' : null;
  const valider = () => {
    setTente(true);
    if (erreur) return;
    mutation.mutate(motif.trim(), {
      onSuccess: () => {
        toast.success('Facture annulée', `${f.numero} : le numéro reste attribué.`);
        onClose();
      },
    });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Annuler la facture ${f.numero}`}
      description="La facture reste consultable avec la mention « Annulée » et ne compte plus dans les totaux. Son numéro est conservé et ne sera jamais réutilisé ; le dossier pourra ensuite être facturé de nouveau."
      footer={
        <>
          <Button onClick={onClose}>Garder la facture</Button>
          <Button variant="danger" icon={<Ban />} busy={mutation.isPending} onClick={valider}>
            Annuler la facture
          </Button>
        </>
      }
    >
      <TextareaField
        label="Motif de l'annulation"
        required
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        rows={3}
        maxLength={500}
        data-autofocus
        error={tente ? erreur : null}
        help="Obligatoire. Visible sur la facture et dans l’historique du dossier."
      />
      {mutation.error && <Alert tone="error">L’annulation a échoué : {messageErreur(mutation.error)}</Alert>}
    </Dialog>
  );
}
