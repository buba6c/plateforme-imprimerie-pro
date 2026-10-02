import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, FileText, FolderInput, FolderOpen, Pencil, Printer, Send, Trash2, Undo2, X } from 'lucide-react';
import {
  formatDate,
  formatDateHeure,
  formatDecimal,
  formatFCFA,
  MACHINE_DESCRIPTIONS,
  MACHINE_LABELS,
  STATUT_DEVIS_LABELS,
  type StatutDevis,
} from '@evocom/shared';
import { ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Checkbox, ConfirmDialog, EmptyState, MachineChip, PageHeader, Skeleton, TextField, TextareaField, useToast } from '../../ui';
import { BlocDocument, DevisStatutBadge, LignesDocument, Totaux, type LigneTotal } from '../../features/commercial/Document';
import { aujourdhui, formatJour, lignesDevis } from '../../features/commercial/format';
import { useConvertirDevis, useDevis, useDevisStatut, useSupprimerDevis } from '../../features/commercial/hooks';
import type { DevisDetail } from '../../features/commercial/types';
import '../../features/commercial/commercial.css';

const PROCHAINE_ETAPE: Record<StatutDevis, string> = {
  brouillon: 'Envoyez le PDF au client, puis marquez le devis comme envoyé. Un brouillon se modifie et se supprime librement.',
  envoye: 'Quand le client répond, marquez le devis comme accepté ou refusé. Il reste modifiable tant qu’il n’est pas accepté.',
  accepte: 'Convertissez le devis en dossier pour lancer la préparation, au montant convenu.',
  refuse: 'Si le client revient vers vous, repassez le devis à « Envoyé » pour le relancer.',
  converti: 'Le dossier a été créé à partir de ce devis ; le suivi continue dans le dossier.',
};

const LIBELLE_TRANSITION: Record<'envoye' | 'accepte' | 'refuse', (de: StatutDevis) => string> = {
  envoye: (de) => (de === 'refuse' ? 'Repasser à envoyé' : 'Marquer comme envoyé'),
  accepte: () => 'Marquer comme accepté',
  refuse: () => 'Marquer comme refusé',
};

const ICONE_TRANSITION: Record<'envoye' | 'accepte' | 'refuse', (de: StatutDevis) => ReactNode> = {
  envoye: (de) => (de === 'refuse' ? <Undo2 /> : <Send />),
  accepte: () => <Check />,
  refuse: () => <X />,
};

export default function FicheDevis() {
  const id = Number(useParams().id);
  const devis = useDevis(Number.isInteger(id) && id > 0 ? id : undefined);

  if (devis.isLoading) {
    return (
      <div className="stack-lg" aria-busy="true">
        <Skeleton h={34} w={320} />
        <Skeleton h={480} />
      </div>
    );
  }
  if (devis.isError || !devis.data) {
    const introuvable = devis.error instanceof ApiError && devis.error.status === 404;
    return (
      <>
        <PageHeader title="Devis" crumbs={<Link to="/devis">Devis</Link>} />
        <Card>
          <EmptyState
            title={introuvable ? 'Devis introuvable' : 'Le devis n’a pas pu être chargé'}
            icon={<FileText aria-hidden="true" />}
            action={
              <Link className="ev-btn ev-btn--sm" to="/devis">
                Revenir à la liste des devis
              </Link>
            }
          >
            {introuvable ? 'Ce devis n’existe pas, a été supprimé, ou a été établi par un autre préparateur.' : messageErreur(devis.error)}
          </EmptyState>
        </Card>
      </>
    );
  }
  return <Fiche d={devis.data} />;
}

function Fiche({ d }: { d: DevisDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const statut = useDevisStatut(d.id);
  const convertir = useConvertirDevis(d.id);
  const supprimer = useSupprimerDevis(d.id);
  const [dialogue, setDialogue] = useState<'convertir' | 'supprimer' | null>(null);

  const changerStatut = (s: 'envoye' | 'accepte' | 'refuse') =>
    statut.mutate(s, {
      onSuccess: () => toast.success(`Devis ${STATUT_DEVIS_LABELS[s].toLowerCase()}`, d.numero),
      onError: (e) => toast.error('Statut non modifié', messageErreur(e)),
    });

  // Action principale : l'étape suivante logique du devis.
  const principale: 'envoye' | 'accepte' | 'convertir' | 'dossier' | null =
    d.statut === 'brouillon' && d.transitions.includes('envoye')
      ? 'envoye'
      : d.statut === 'envoye' && d.transitions.includes('accepte')
        ? 'accepte'
        : d.statut === 'accepte' && d.peut_convertir
          ? 'convertir'
          : d.dossier_id
            ? 'dossier'
            : null;

  const transitions = d.transitions.filter((t) => t !== principale);
  const lignes = lignesDevis(d.machine, d.specs, d.detail_prix);
  const motifRemise = d.specs?.remise?.motif;

  const dp = d.detail_prix;
  const remise = dp?.remise ?? 0;
  const arrondi = dp?.arrondi ?? 0;
  const tvaApplicable = dp?.tva_applicable ?? d.tva > 0;
  const totaux: LigneTotal[] = [];
  if (dp && (remise > 0 || arrondi !== 0)) totaux.push({ label: 'Sous-total', valeur: formatFCFA(dp.sous_total) });
  if (remise > 0) totaux.push({ label: motifRemise ? `Remise (${motifRemise})` : 'Remise', valeur: `− ${formatFCFA(remise)}` });
  if (arrondi !== 0) totaux.push({ label: 'Arrondi', valeur: `${arrondi > 0 ? '+' : '−'} ${formatFCFA(Math.abs(arrondi))}` });
  if (tvaApplicable) {
    totaux.push({ label: 'Total HT', valeur: formatFCFA(d.total_ht) });
    totaux.push({ label: `TVA${dp?.tva_taux !== undefined ? ` (${formatDecimal(dp.tva_taux)} %)` : ''}`, valeur: formatFCFA(d.tva) });
    totaux.push({ label: 'Total TTC', valeur: formatFCFA(d.total_ttc), fort: true });
  } else {
    totaux.push({ label: 'Total', valeur: formatFCFA(d.total_ttc), fort: true });
  }

  const pdf = `/api/devis/${d.id}/pdf`;
  const occupe = statut.isPending;

  return (
    <>
      <PageHeader
        crumbs={
          <>
            <Link to="/devis">Devis</Link>
            <span aria-hidden="true">/</span>
            <span className="ev-ref">{d.numero}</span>
          </>
        }
        title={
          <span className="row" style={{ gap: 'var(--space-3)' }}>
            Devis <span className="ev-mono">{d.numero}</span>
          </span>
        }
        subtitle={
          <span className="row" style={{ gap: 'var(--space-2)' }}>
            <DevisStatutBadge statut={d.statut} />
            <MachineChip machine={d.machine} />
            <span>{d.client_nom}</span>
          </span>
        }
        actions={
          <div className="ev-btn-group">
            {d.peut_supprimer && (
              <Button icon={<Trash2 />} onClick={() => setDialogue('supprimer')}>
                Supprimer
              </Button>
            )}
            {d.peut_modifier && (
              <Link className="ev-btn" to={`/devis/${d.id}/modifier`}>
                <Pencil aria-hidden="true" />
                Modifier
              </Link>
            )}
            <a className="ev-btn" href={pdf} target="_blank" rel="noopener">
              <Printer aria-hidden="true" />
              Imprimer
            </a>
            <a className="ev-btn" href={`${pdf}?telecharger=1`} download>
              <Download aria-hidden="true" />
              Télécharger le PDF
            </a>
            {transitions.map((t) => (
              <Button key={t} icon={ICONE_TRANSITION[t](d.statut)} busy={occupe && statut.variables === t} disabled={occupe} onClick={() => changerStatut(t)}>
                {LIBELLE_TRANSITION[t](d.statut)}
              </Button>
            ))}
            {d.peut_convertir && principale !== 'convertir' && (
              <Button icon={<FolderInput />} onClick={() => setDialogue('convertir')}>
                Convertir en dossier
              </Button>
            )}
            {(principale === 'envoye' || principale === 'accepte') && (
              <Button variant="primary" icon={ICONE_TRANSITION[principale](d.statut)} busy={occupe && statut.variables === principale} disabled={occupe} onClick={() => changerStatut(principale)}>
                {LIBELLE_TRANSITION[principale](d.statut)}
              </Button>
            )}
            {principale === 'convertir' && (
              <Button variant="primary" icon={<FolderInput />} onClick={() => setDialogue('convertir')}>
                Convertir en dossier
              </Button>
            )}
            {principale === 'dossier' && d.dossier_id && (
              <Link className="ev-btn ev-btn--primary" to={`/dossiers/${d.dossier_id}`}>
                <FolderOpen aria-hidden="true" />
                Ouvrir le dossier
              </Link>
            )}
          </div>
        }
      />

      <div className="grid-main">
        <div className="stack">
          {d.statut === 'converti' && d.dossier_id && (
            <Alert tone="success">
              Ce devis a été converti en dossier{' '}
              <Link className="ev-link ev-ref" to={`/dossiers/${d.dossier_id}`}>
                {d.dossier_numero ?? `n° ${d.dossier_id}`}
              </Link>
              . Le montant du dossier est celui du devis.
            </Alert>
          )}
          {d.expire && (
            <Alert tone="warning">
              La validité de ce devis est dépassée depuis le {formatJour(d.date_validite)}. Vérifiez que les prix conviennent toujours avant de le convertir, ou
              modifiez-le pour le rechiffrer.
            </Alert>
          )}
          <section className="ev-card cm-doc" aria-label={`Devis ${d.numero}`}>
            <div className="cm-doc__parties">
              <BlocDocument titre="Client">
                <strong>{d.client_nom}</strong>
                {d.client_telephone && <span className="ev-ref">{d.client_telephone}</span>}
                {d.client_email && <span>{d.client_email}</span>}
                {d.client_id ? (
                  <Link className="ev-link" style={{ fontSize: 13, marginTop: 4 }} to={`/clients/${d.client_id}`}>
                    Voir la fiche client
                  </Link>
                ) : (
                  <span className="ev-muted">Pas encore de fiche client : elle sera créée à la conversion.</span>
                )}
              </BlocDocument>
              <BlocDocument titre="Prestation">
                <strong>Impression {MACHINE_LABELS[d.machine]}</strong>
                <span className="ev-muted">{MACHINE_DESCRIPTIONS[d.machine]}</span>
              </BlocDocument>
              <BlocDocument titre="Validité">
                <strong className="ev-mono" style={{ fontWeight: 500 }}>
                  {formatJour(d.date_validite)}
                </strong>
                <span className="ev-muted">
                  {d.validite_jours} jour{d.validite_jours > 1 ? 's' : ''} à compter du {formatDate(d.created_at)}
                </span>
              </BlocDocument>
            </div>

            {d.description && (
              <BlocDocument titre="Objet">
                <p className="cm-texte">{d.description}</p>
              </BlocDocument>
            )}

            <div className="stack">
              <LignesDocument lignes={lignes} vide="Ce devis n'a pas de détail de prix : modifiez-le pour le chiffrer avec la grille tarifaire." />
              <Totaux lignes={totaux} label="Totaux du devis" />
            </div>

            {d.notes && (
              <BlocDocument titre="Remarques">
                <p className="cm-texte">{d.notes}</p>
              </BlocDocument>
            )}

            <div className="cm-doc__pied">
              <p>
                Montants en francs CFA (FCFA){tvaApplicable ? '' : ', TVA non applicable'}. Devis valable {d.validite_jours} jour{d.validite_jours > 1 ? 's' : ''} à
                compter du {formatDate(d.created_at)}.
              </p>
            </div>
          </section>
        </div>

        <aside className="stack">
          <Card title="Suivi">
            <div className="stack">
              <dl className="cm-kv">
                <dt>Statut</dt>
                <dd>
                  <DevisStatutBadge statut={d.statut} />
                </dd>
                <dt>Établi par</dt>
                <dd>{d.created_by_nom ?? '—'}</dd>
                <dt>Créé le</dt>
                <dd className="ev-ref">{formatDateHeure(d.created_at)}</dd>
                <dt>Modifié le</dt>
                <dd className="ev-ref">{formatDateHeure(d.updated_at)}</dd>
                <dt>Valable jusqu’au</dt>
                <dd className="ev-ref">
                  {formatJour(d.date_validite)}
                  {d.expire && <span className="cm-danger"> · dépassée</span>}
                </dd>
                <dt>Dossier</dt>
                <dd>
                  {d.dossier_id ? (
                    <Link className="ev-link ev-ref" to={`/dossiers/${d.dossier_id}`}>
                      {d.dossier_numero ?? `n° ${d.dossier_id}`}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </dl>
              <p className="ev-help" style={{ margin: 0 }}>
                {PROCHAINE_ETAPE[d.statut]}
              </p>
            </div>
          </Card>
        </aside>
      </div>

      {dialogue === 'convertir' && (
        <ConversionDialog
          d={d}
          busy={convertir.isPending}
          erreur={convertir.error ? messageErreur(convertir.error) : null}
          onClose={() => {
            convertir.reset();
            setDialogue(null);
          }}
          onConfirm={(input) =>
            convertir.mutate(input, {
              onSuccess: (r) => {
                toast.success('Dossier créé', r.numero ? `${r.numero}, à partir du devis ${d.numero}` : `À partir du devis ${d.numero}`);
                navigate(`/dossiers/${r.dossier_id}`);
              },
            })
          }
        />
      )}
      <ConfirmDialog
        open={dialogue === 'supprimer'}
        onClose={() => setDialogue(null)}
        title="Supprimer le brouillon"
        description={`Le brouillon ${d.numero} pour ${d.client_nom} sera définitivement supprimé. Cette action ne peut pas être annulée.`}
        confirmLabel="Supprimer le brouillon"
        danger
        busy={supprimer.isPending}
        onConfirm={() =>
          supprimer.mutate(undefined, {
            onSuccess: () => {
              toast.success('Brouillon supprimé', d.numero);
              navigate('/devis', { replace: true });
            },
            onError: (e) => toast.error('Suppression impossible', messageErreur(e)),
          })
        }
      />
    </>
  );
}

function ConversionDialog({
  d,
  busy,
  erreur,
  onClose,
  onConfirm,
}: {
  d: DevisDetail;
  busy: boolean;
  erreur: string | null;
  onClose: () => void;
  onConfirm: (input: { urgent: boolean; date_promise: string | null; consignes: string | null }) => void;
}) {
  const [datePromise, setDatePromise] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [consignes, setConsignes] = useState('');
  const datePassee = !!datePromise && datePromise < aujourdhui();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Convertir en dossier"
      description={`Un dossier ${MACHINE_LABELS[d.machine]} sera créé pour ${d.client_nom}, au montant du devis : ${formatFCFA(d.total_ttc)}. Le devis passera à « Converti en dossier » et ne sera plus modifiable.`}
      confirmLabel="Créer le dossier"
      busy={busy}
      disabled={datePassee}
      onConfirm={() => onConfirm({ urgent, date_promise: datePromise || null, consignes: consignes.trim() || null })}
    >
      {d.statut === 'envoye' && <Alert tone="info">Le devis n’a pas été marqué comme accepté : la conversion vaut acceptation par le client.</Alert>}
      {d.expire && <Alert tone="warning">La validité du devis est dépassée : le dossier reprend tout de même les prix du devis.</Alert>}
      <p className="ev-help" style={{ margin: 0 }}>
        Les spécifications et le détail des prix sont repris tels quels. Les fichiers du client s’ajoutent ensuite dans le dossier.
      </p>
      <div className="ev-form-grid">
        <TextField
          label="Date promise au client"
          type="date"
          value={datePromise}
          min={aujourdhui()}
          onChange={(e) => setDatePromise(e.target.value)}
          error={datePassee ? 'Choisissez une date à venir.' : null}
          help="Facultative."
        />
      </div>
      <TextareaField label="Consignes pour l’atelier" value={consignes} onChange={(e) => setConsignes(e.target.value)} rows={2} maxLength={2000} help="Facultatives." />
      <Checkbox label="Dossier urgent" checked={urgent} onChange={setUrgent} />
      {erreur && <Alert tone="error">La conversion a échoué : {erreur}</Alert>}
    </ConfirmDialog>
  );
}
