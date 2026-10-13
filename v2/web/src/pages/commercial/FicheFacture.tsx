import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, Download, ExternalLink, FolderOpen, Printer, ReceiptText, RefreshCw, Send } from 'lucide-react';
import { formatDateHeure, formatDecimal, formatEntier, formatFCFA } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Dialog, EmptyState, PageHeader, PaymentBadge, Skeleton, TextareaField, useToast } from '../../ui';
import { FactureStatutBadge } from '../../features/commercial/Document';
import { ApercuDocument, type TotalApercu } from '../../features/commercial/ApercuDocument';
import { formatJour, lignesFacture } from '../../features/commercial/format';
import { useAnnulerFacture, useAnnulerVosFactures, useEnvoyerVosFactures, useFacture, useListeFactures, useParametres } from '../../features/commercial/hooks';
import type { FactureDetail } from '../../features/commercial/types';
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
  const directe = f.dossier_id === null;
  const pdf = `/api/factures/${f.id}/pdf`;
  const enVigueur = useListeFactures({ dossier_id: f.dossier_id ?? undefined, statut: 'emise', limit: 1 }, { enabled: annulee && !directe });
  const remplacante = annulee && !directe ? enVigueur.data?.items.find((x) => x.id !== f.id) : undefined;
  const vf = f.vosfactures ?? null;
  const envoi = useEnvoyerVosFactures(f.id);
  const toast = useToast();

  const totaux: TotalApercu[] =
    f.tva_taux > 0
      ? [
          { label: 'Total HT :', valeur: formatEntier(f.total_ht) },
          { label: `TVA (${formatDecimal(f.tva_taux)} %) :`, valeur: formatEntier(f.tva) },
          { label: 'TOTAL TTC :', valeur: formatEntier(f.total_ttc), fort: true },
        ]
      : [{ label: 'TOTAL :', valeur: formatEntier(f.total_ttc), fort: true }];

  const reste = f.reste ?? null;
  const montantChange = !annulee && !directe && f.dossier_montant !== null && f.dossier_montant !== undefined && f.dossier_montant !== f.total_ttc;
  const coordonneesManquantes = !!entreprise && !entreprise.adresse && !entreprise.telephone && !entreprise.ninea;
  const peutEnvoyer = !!f.vosfactures_actif && !annulee && !vf?.id;
  const dossierLibelle = f.dossier_numero ?? (f.dossier_id !== null ? `n° ${f.dossier_id}` : '');

  const envoyer = () => {
    envoi.mutate(undefined, {
      onSuccess: (r) => toast.success('Facture envoyée à VosFactures', r.vosfactures?.numero ? `Numéro VosFactures : ${r.vosfactures.numero}.` : undefined),
      onError: (e) => toast.error('Envoi vers VosFactures refusé', messageErreur(e)),
    });
  };

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
            <FactureStatutBadge statut={f.statut} vosfactures={vf} />
            {!annulee && f.situation_paiement && <PaymentBadge situation={f.situation_paiement} enAttente={f.en_attente_validation} />}
            <span>{f.client_nom}</span>
            {directe && <span className="ev-muted">Facture directe, sans dossier</span>}
          </span>
        }
        actions={
          <div className="ev-btn-group">
            {admin && !annulee && (
              <Button icon={<Ban />} onClick={() => setAnnulation(true)}>
                Annuler la facture
              </Button>
            )}
            {peutEnvoyer && (
              <Button icon={vf?.erreur ? <RefreshCw /> : <Send />} busy={envoi.isPending} onClick={envoyer}>
                {vf?.erreur ? 'Réessayer l’envoi vers VosFactures' : 'Envoyer vers VosFactures'}
              </Button>
            )}
            {!directe && (
              <Link className="ev-btn" to={`/dossiers/${f.dossier_id}`}>
                <FolderOpen aria-hidden="true" />
                Ouvrir le dossier
              </Link>
            )}
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
              {f.annulee_par_nom ? ` par ${f.annulee_par_nom}` : ''}.{f.motif_annulation ? ` Motif : ${f.motif_annulation.replace(/[\s.]+$/, '')}.` : ''} Ce document n’est plus
              valable ; le numéro {f.numero} reste attribué et ne sera jamais réutilisé.
              {remplacante && (
                <>
                  {' '}
                  Facture en vigueur pour ce dossier :{' '}
                  <Link className="ev-link ev-ref" to={`/factures/${remplacante.id}`}>
                    {remplacante.numero}
                  </Link>
                  .
                </>
              )}
            </Alert>
          )}
          {montantChange && (
            <Alert tone="warning">
              Le montant du dossier ({formatFCFA(f.dossier_montant)}) ne correspond plus au total de cette facture ({formatFCFA(f.total_ttc)}).
              {admin ? ' Annulez la facture puis émettez-en une nouvelle depuis le dossier pour facturer le bon montant.' : ' Signalez-le à l’administrateur : seule une nouvelle facture peut corriger le montant.'}
            </Alert>
          )}
          {!annulee && vf?.erreur && !vf.id && (
            <Alert tone="warning">
              <strong>L’envoi vers VosFactures a échoué</strong>
              {vf.erreur_at ? ` le ${formatDateHeure(vf.erreur_at)}` : ''} : {vf.erreur}
              {peutEnvoyer ? ' Corrigez la cause puis utilisez « Réessayer l’envoi vers VosFactures ».' : ''}
            </Alert>
          )}
          {admin && !annulee && coordonneesManquantes && (
            <Alert tone="info">
              Les coordonnées de l’entreprise (adresse, téléphone, NINEA) ne sont pas renseignées : elles n’apparaissent pas sur les factures.{' '}
              <Link className="ev-link" to="/admin/parametres">
                Les compléter dans Paramètres
              </Link>
            </Alert>
          )}

          <article className="ev-card" style={{ padding: 0, overflow: 'hidden' }} aria-label={`Facture ${f.numero}`}>
            <ApercuDocument
              titre={`Facture N° ${f.numero}`}
              infos={[
                { label: 'Date de création', valeur: formatJour(f.date_emission) },
                ...(f.date_echeance ? [{ label: 'Date limite de règlement', valeur: formatJour(f.date_echeance) }] : []),
                ...(!directe
                  ? [{ label: 'Dossier', valeur: <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>{dossierLibelle}</Link> }]
                  : [{ label: 'Origine', valeur: 'Facture directe' }]),
              ]}
              vendeur={[entreprise?.nom ?? '']}
              acheteur={[
                <strong key="nom">{f.client_nom}</strong>,
                f.client_adresse,
                f.client_telephone && `Tél. ${f.client_telephone}`,
                f.client_email,
                f.client_id ? (
                  <Link key="fiche" className="ev-link" to={`/clients/${f.client_id}`}>
                    Voir la fiche client
                  </Link>
                ) : null,
              ]}
              lignes={lignesFacture(f.lignes)}
              totaux={totaux}
              aPayer={f.total_ttc}
              reglement={
                !annulee && reste !== null && (f.deja_paye ?? 0) > 0
                  ? [
                      { label: 'Déjà réglé :', valeur: formatEntier(f.deja_paye ?? 0) },
                      { label: 'Reste à payer :', valeur: formatEntier(reste), fort: true },
                    ]
                  : undefined
              }
              paragraphes={[
                ...(annulee
                  ? [{ titre: 'Facture annulée', texte: `Annulée le ${formatDateHeure(f.annulee_at)}${f.motif_annulation ? ` : ${f.motif_annulation}` : ''}. Ce document n’est plus valable ; son numéro n’est pas réutilisé.` }]
                  : []),
                ...(f.notes ? [{ titre: 'Remarques', texte: f.notes }] : []),
                ...(f.conditions_paiement ? [{ titre: 'Conditions de paiement', texte: f.conditions_paiement }] : []),
              ]}
              banque={entreprise?.coordonnees_bancaires}
              entreprise={entreprise ?? null}
              filigrane={annulee ? 'ANNULÉE' : null}
            />
          </article>
        </div>

        <aside className="stack">
          {!annulee && !directe && (
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
          {!annulee && directe && (
            <Card title="Paiement">
              <p className="ev-help" style={{ margin: 0 }}>
                Cette facture ne dépend d’aucun dossier : les paiements ne sont pas suivis ici. Total à régler : <span className="ev-num">{formatFCFA(f.total_ttc)}</span>.
              </p>
            </Card>
          )}
          {(f.vosfactures_actif || vf) && <CarteVosFactures f={f} admin={admin} peutEnvoyer={peutEnvoyer} envoi={envoi} envoyer={envoyer} />}
          <Card title="Informations">
            <dl className="cm-kv">
              <dt>Statut</dt>
              <dd>
                <FactureStatutBadge statut={f.statut} vosfactures={vf} />
              </dd>
              <dt>Origine</dt>
              <dd>{directe ? 'Facture directe (sans dossier)' : 'Facture d’un dossier'}</dd>
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
              {!directe && (
                <>
                  <dt>Dossier</dt>
                  <dd>
                    <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
                      {dossierLibelle}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </Card>
        </aside>
      </div>

      {annulation && <AnnulationDialog f={f} onClose={() => setAnnulation(false)} />}
    </>
  );
}

function CarteVosFactures({
  f,
  admin,
  peutEnvoyer,
  envoi,
  envoyer,
}: {
  f: FactureDetail;
  admin: boolean;
  peutEnvoyer: boolean;
  envoi: ReturnType<typeof useEnvoyerVosFactures>;
  envoyer: () => void;
}) {
  const vf = f.vosfactures ?? null;
  const annulee = f.statut === 'annulee';
  const reessai = useAnnulerVosFactures(f.id);
  const toast = useToast();
  const reessayerAnnulation = () => {
    reessai.mutate(undefined, {
      onSuccess: () => toast.success('Facture annulée dans VosFactures'),
      onError: (e) => toast.error('Annulation dans VosFactures refusée', messageErreur(e)),
    });
  };
  return (
    <Card title="VosFactures">
      <div className="stack">
        {vf?.id ? (
          <>
            <dl className="cm-kv">
              <dt>Numéro</dt>
              <dd>
                {vf.url ? (
                  <a className="ev-link ev-ref" href={vf.url} target="_blank" rel="noopener noreferrer">
                    {vf.numero ?? `n° ${vf.id}`} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="ev-ref">{vf.numero ?? `n° ${vf.id}`}</span>
                )}
              </dd>
              <dt>Envoyée le</dt>
              <dd className="ev-ref">{formatDateHeure(vf.envoye_at)}</dd>
              {vf.envoye_par_nom && (
                <>
                  <dt>Par</dt>
                  <dd>{vf.envoye_par_nom}</dd>
                </>
              )}
              {annulee && (
                <>
                  <dt>Côté VosFactures</dt>
                  <dd>{vf.annulee_at ? `Annulée le ${formatDateHeure(vf.annulee_at)}` : 'Toujours active'}</dd>
                </>
              )}
            </dl>
            <a className="ev-btn ev-btn--sm" href={`/api/factures/${f.id}/vosfactures.pdf`} target="_blank" rel="noopener">
              <Printer aria-hidden="true" />
              PDF édité par VosFactures
            </a>
            {annulee && !vf.annulee_at && vf.annulation_erreur && (
              <>
                <Alert tone="warning">L’annulation côté VosFactures a échoué : {vf.annulation_erreur}</Alert>
                {admin && (
                  <Button size="sm" icon={<RefreshCw />} busy={reessai.isPending} onClick={reessayerAnnulation}>
                    Réessayer l’annulation dans VosFactures
                  </Button>
                )}
              </>
            )}
          </>
        ) : annulee ? (
          <p className="ev-help" style={{ margin: 0 }}>
            Cette facture n’a pas été envoyée à VosFactures.
          </p>
        ) : (
          <>
            <p className="ev-help" style={{ margin: 0 }}>
              {vf?.erreur
                ? `Dernier essai${vf.erreur_at ? ` le ${formatDateHeure(vf.erreur_at)}` : ''} (${vf.tentatives} au total) : ${vf.erreur}`
                : 'Pas encore envoyée. L’envoi crée la facture dans votre compte VosFactures avec les mêmes lignes et le même total.'}
            </p>
            {peutEnvoyer && (
              <Button size="sm" variant="primary" icon={vf?.erreur ? <RefreshCw /> : <Send />} busy={envoi.isPending} onClick={envoyer}>
                {vf?.erreur ? 'Réessayer l’envoi' : 'Envoyer vers VosFactures'}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}


function AnnulationDialog({ f, onClose }: { f: FactureDetail; onClose: () => void }) {
  const [motif, setMotif] = useState('');
  const [tente, setTente] = useState(false);
  const mutation = useAnnulerFacture(f.id);
  const toast = useToast();
  const erreur = motif.trim().length < 3 ? 'Indiquez le motif (3 caractères au moins).' : null;
  const envoyee = !!f.vosfactures?.id;
  const valider = () => {
    setTente(true);
    if (erreur) return;
    mutation.mutate(motif.trim(), {
      onSuccess: (r) => {
        const distante = r.vosfactures;
        toast.success(
          'Facture annulée',
          envoyee ? (distante?.annulee_at ? `${f.numero} : annulée dans VosFactures aussi.` : `${f.numero} : l’annulation dans VosFactures a échoué, un nouvel essai est proposé sur la fiche.`) : `${f.numero} : le numéro reste attribué.`,
        );
        onClose();
      },
    });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Annuler la facture ${f.numero}`}
      description={`La facture reste consultable avec la mention « Annulée » et ne compte plus dans les totaux. Son numéro est conservé et ne sera jamais réutilisé${f.dossier_id === null ? '' : ' ; le dossier pourra ensuite être facturé de nouveau'}.${envoyee ? ' Elle sera aussi annulée dans VosFactures.' : ''}`}
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
        help="Obligatoire. Visible sur la facture, dans l’historique du dossier et transmis à VosFactures."
      />
      {mutation.error && <Alert tone="error">L’annulation a échoué : {messageErreur(mutation.error)}</Alert>}
    </Dialog>
  );
}
