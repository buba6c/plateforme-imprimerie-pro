import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, FolderPlus, Merge, Pencil, UserRound } from 'lucide-react';
import { formatDate, formatEntier, formatFCFA, situationPaiement } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { ApiError, messageErreur } from '../../lib/api';
import { Alert, Card, EmptyState, Kpi, LoadingRows, MachineChip, PageHeader, PaymentBadge, Ref, Skeleton, StatusBadge, UrgentTag, Button, useToast } from '../../ui';
import { ClientDialog } from '../../features/commercial/ClientDialog';
import { FactureStatutBadge } from '../../features/commercial/Document';
import { FusionDialog, messageFusion } from '../../features/commercial/FusionDialog';
import { formatJour } from '../../features/commercial/format';
import { useClient, useListeFactures } from '../../features/commercial/hooks';
import type { ClientDetail, DossierClient } from '../../features/commercial/types';
import '../../features/commercial/commercial.css';

export default function FicheClient() {
  const id = Number(useParams().id);
  const client = useClient(Number.isInteger(id) && id > 0 ? id : undefined);

  if (client.isLoading) {
    return (
      <div className="stack-lg" aria-busy="true">
        <Skeleton h={34} w={280} />
        <div className="ev-kpis">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={96} />
          ))}
        </div>
        <Skeleton h={320} />
      </div>
    );
  }
  if (client.isError || !client.data) {
    const introuvable = client.error instanceof ApiError && client.error.status === 404;
    return (
      <>
        <PageHeader title="Client" crumbs={<Link to="/clients">Clients</Link>} />
        <Card>
          <EmptyState
            title={introuvable ? 'Client introuvable' : 'La fiche n’a pas pu être chargée'}
            icon={<UserRound aria-hidden="true" />}
            action={
              <Link className="ev-btn ev-btn--sm" to="/clients">
                Revenir à la liste des clients
              </Link>
            }
          >
            {introuvable ? 'Cette fiche client n’existe pas.' : messageErreur(client.error)}
          </EmptyState>
        </Card>
      </>
    );
  }
  return <Fiche c={client.data} />;
}

function Fiche({ c }: { c: ClientDetail }) {
  const user = useUser();
  const admin = user.role === 'admin';
  const navigate = useNavigate();
  const toast = useToast();
  const [dialogue, setDialogue] = useState<'modifier' | 'fusionner' | null>(null);
  const fusionnee = c.fusionne_dans !== null;
  const factures = useListeFactures({ client_id: c.id, limit: 20 }, { enabled: !fusionnee });
  const t = c.totaux;

  return (
    <>
      <PageHeader
        crumbs={
          <>
            <Link to="/clients">Clients</Link>
            <span aria-hidden="true">/</span>
            <span>{c.nom}</span>
          </>
        }
        title={c.nom}
        subtitle={`Fiche n° ${c.id}, créée le ${formatDate(c.created_at)}`}
        actions={
          !fusionnee && (
            <div className="ev-btn-group">
              {admin && (
                <Button icon={<Merge />} onClick={() => setDialogue('fusionner')}>
                  Fusionner avec…
                </Button>
              )}
              <Button icon={<Pencil />} onClick={() => setDialogue('modifier')}>
                Modifier les coordonnées
              </Button>
              <Link className="ev-btn ev-btn--primary" to={`/dossiers/nouveau?client_id=${c.id}`}>
                <FolderPlus aria-hidden="true" />
                Nouveau dossier pour ce client
              </Link>
            </div>
          )
        }
      />

      {fusionnee && (
        <Alert tone="warning">
          Cette fiche a été fusionnée dans{' '}
          <Link className="ev-link" to={`/clients/${c.fusionne_dans}`}>
            {c.fusionne_dans_nom ?? `la fiche n° ${c.fusionne_dans}`}
          </Link>
          . Ses dossiers, devis et factures y ont été rattachés ; elle n’est plus modifiable.
        </Alert>
      )}

      <div className="ev-kpis cm-kpis">
        <Kpi label="Dossiers" value={formatEntier(t.nb_dossiers)} meta="Hors dossiers supprimés" />
        <Kpi label="Total des commandes" value={formatEntier(t.total_commandes)} unit="FCFA" meta="Montants des dossiers" />
        <Kpi label="Total payé" value={formatEntier(t.total_paye)} unit="FCFA" meta="Paiements validés" />
        <Kpi
          label="Reste dû"
          value={<span className={t.reste_du > 0 ? 'cm-danger' : undefined}>{formatEntier(t.reste_du)}</span>}
          unit="FCFA"
          meta={t.reste_du > 0 ? 'À encaisser' : 'Rien à encaisser'}
          alert={t.reste_du > 0}
        />
      </div>

      <Card title="Coordonnées">
        <dl className="cm-coord">
          <div>
            <dt>Téléphone</dt>
            <dd>
              {c.telephone ? (
                <a className="ev-link ev-ref" href={`tel:${c.telephone.replace(/[^+0-9]/g, '')}`}>
                  {c.telephone}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>
              {c.email ? (
                <a className="ev-link" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>{c.adresse ?? '—'}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd className="cm-texte">{c.notes ?? '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Dossiers" actions={t.nb_dossiers > c.dossiers.length ? <span className="ev-muted" style={{ fontSize: 13 }}>Les {c.dossiers.length} plus récents sur {formatEntier(t.nb_dossiers)}</span> : undefined} flush>
        {c.dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier pour ce client"
            icon={<FolderOpen aria-hidden="true" />}
            action={
              !fusionnee && (
                <Link className="ev-btn ev-btn--sm ev-btn--primary" to={`/dossiers/nouveau?client_id=${c.id}`}>
                  <FolderPlus aria-hidden="true" />
                  Nouveau dossier pour ce client
                </Link>
              )
            }
          >
            Les dossiers créés pour ce client apparaîtront ici, avec leur montant et leur situation de paiement.
          </EmptyState>
        ) : (
          <>
            <div className="cm-large" style={{ overflowX: 'auto' }}>
              <TableDossiers dossiers={c.dossiers} onOpen={(id) => navigate(`/dossiers/${id}`)} />
            </div>
            <div className="cm-etroit" style={{ padding: 'var(--space-2) var(--space-4)' }}>
              {c.dossiers.map((d) => (
                <LigneDossierMobile key={d.id} d={d} />
              ))}
            </div>
          </>
        )}
      </Card>

      {!fusionnee && (
        <Card title="Factures" flush>
          {factures.isLoading ? (
            <div style={{ padding: 'var(--space-4)' }}>
              <LoadingRows rows={2} />
            </div>
          ) : factures.isError ? (
            <div style={{ padding: 'var(--space-4)' }}>
              <Alert tone="error">Les factures n'ont pas pu être chargées : {messageErreur(factures.error)}</Alert>
            </div>
          ) : !factures.data?.items.length ? (
            <p className="ev-muted" style={{ margin: 0, padding: 'var(--space-5) var(--space-6)' }}>
              Aucune facture émise pour ce client.
            </p>
          ) : (
            <>
            <div className="cm-large" style={{ overflowX: 'auto' }}>
              <table className="ev-table ev-table--clickable">
                <thead>
                  <tr>
                    <th scope="col">Numéro</th>
                    <th scope="col">Date</th>
                    <th scope="col">Dossier</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Total TTC
                    </th>
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {factures.data.items.map((f) => (
                    <tr key={f.id} onClick={() => navigate(`/factures/${f.id}`)}>
                      <td className="nowrap">
                        <Link className="ev-ref cm-lien-ref" to={`/factures/${f.id}`} onClick={(e) => e.stopPropagation()}>
                          {f.numero}
                        </Link>
                      </td>
                      <td className="ev-ref nowrap">{formatJour(f.date_emission)}</td>
                      <td className="ev-ref nowrap">{f.dossier_numero ?? '—'}</td>
                      <td className="ev-cell-num">
                        <span className={f.statut === 'annulee' ? 'cm-annulee' : undefined}>{formatFCFA(f.total_ttc)}</span>
                      </td>
                      <td>
                        <FactureStatutBadge statut={f.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cm-etroit" style={{ padding: 'var(--space-2) var(--space-4)' }}>
              {factures.data.items.map((f) => (
                <Link key={f.id} to={`/factures/${f.id}`} className="cm-carte cm-ligne-mobile">
                  <div className="cm-carte__ligne">
                    <Ref>{f.numero}</Ref>
                    <FactureStatutBadge statut={f.statut} />
                  </div>
                  <div className="cm-carte__ligne">
                    <span className="ev-muted" style={{ fontSize: 13 }}>
                      {formatJour(f.date_emission)} · dossier {f.dossier_numero ?? '—'}
                    </span>
                    <span className={`ev-num${f.statut === 'annulee' ? ' cm-annulee' : ''}`}>{formatFCFA(f.total_ttc)}</span>
                  </div>
                </Link>
              ))}
            </div>
            </>
          )}
        </Card>
      )}

      {dialogue === 'modifier' && (
        <ClientDialog
          client={c}
          onClose={() => setDialogue(null)}
          onSaved={() => {
            setDialogue(null);
            toast.success('Coordonnées enregistrées', c.nom);
          }}
        />
      )}
      {dialogue === 'fusionner' && (
        <FusionDialog
          client={c}
          onClose={() => setDialogue(null)}
          onDone={(r) => {
            setDialogue(null);
            toast.success('Fiches fusionnées', messageFusion(r));
            if (r.id !== c.id) navigate(`/clients/${r.id}`, { replace: true });
          }}
        />
      )}
    </>
  );
}

function TableDossiers({ dossiers, onOpen }: { dossiers: DossierClient[]; onOpen: (id: number) => void }) {
  return (
    <table className="ev-table ev-table--clickable">
      <thead>
        <tr>
          <th scope="col">Numéro</th>
          <th scope="col">Objet</th>
          <th scope="col">Statut</th>
          <th scope="col" style={{ textAlign: 'right' }}>
            Montant
          </th>
          <th scope="col">Paiement</th>
          <th scope="col">Créé le</th>
        </tr>
      </thead>
      <tbody>
        {dossiers.map((d) => {
          const situation = situationPaiement(d.montant, d.deja_paye);
          return (
            <tr key={d.id} onClick={() => onOpen(d.id)}>
              <td className="nowrap">
                <Link className="ev-ref cm-lien-ref" to={`/dossiers/${d.id}`} onClick={(e) => e.stopPropagation()}>
                  {d.numero}
                </Link>
              </td>
              <td style={{ maxWidth: 260 }}>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <MachineChip machine={d.machine} />
                  {d.urgent && <UrgentTag />}
                </span>
                {d.description && <span className="ev-cell-sub truncate">{d.description}</span>}
              </td>
              <td>
                <StatusBadge statut={d.statut} />
              </td>
              <td className="ev-cell-num">{formatFCFA(d.montant)}</td>
              <td>
                <PaymentBadge situation={situation} />
                {situation === 'partiel' && d.montant !== null && (
                  <span className="ev-cell-sub">
                    Reste <span className="ev-mono">{formatFCFA(Math.max(0, d.montant - d.deja_paye))}</span>
                  </span>
                )}
              </td>
              <td className="ev-ref nowrap">{formatDate(d.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LigneDossierMobile({ d }: { d: DossierClient }) {
  const situation = situationPaiement(d.montant, d.deja_paye);
  return (
    <Link to={`/dossiers/${d.id}`} className="cm-carte cm-ligne-mobile">
      <div className="row">
        <Ref>{d.numero}</Ref>
        <MachineChip machine={d.machine} />
        {d.urgent && <UrgentTag />}
      </div>
      {d.description && <span className="ev-muted" style={{ fontSize: 13 }}>{d.description}</span>}
      <div className="cm-carte__ligne">
        <span className="row" style={{ gap: 6 }}>
          <StatusBadge statut={d.statut} />
          <PaymentBadge situation={situation} />
        </span>
        <span className="ev-num">{formatFCFA(d.montant)}</span>
      </div>
    </Link>
  );
}

