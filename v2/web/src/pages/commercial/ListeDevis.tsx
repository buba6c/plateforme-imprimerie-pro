import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { formatDate, formatFCFA, STATUT_DEVIS_LABELS, STATUTS_DEVIS, type StatutDevis } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, MachineChip, PageHeader, Pagination, Ref, Tabs, type TabDef } from '../../ui';
import { DevisStatutBadge } from '../../features/commercial/Document';
import { useDebounced, useListeDevis } from '../../features/commercial/hooks';
import '../../features/commercial/commercial.css';

const LIMIT = 30;
type Onglet = StatutDevis | 'tous';

export default function ListeDevis() {
  const user = useUser();
  const admin = user.role === 'admin';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const statutParam = params.get('statut');
  const onglet: Onglet = statutParam && (STATUTS_DEVIS as readonly string[]).includes(statutParam) ? (statutParam as StatutDevis) : 'tous';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [saisie, setSaisie] = useState(params.get('q') ?? '');
  const q = useDebounced(saisie.trim(), 300);

  const maj = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== q) maj({ q: q || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const liste = useListeDevis({ statut: onglet === 'tous' ? undefined : onglet, q: q || undefined, page, limit: LIMIT });
  const items = liste.data?.items ?? [];
  const compteurs = liste.data?.compteurs;
  const tabs: TabDef<Onglet>[] = [
    { value: 'tous', label: 'Tous', count: compteurs ? Object.values(compteurs).reduce((s, n) => s + (n ?? 0), 0) : undefined },
    ...STATUTS_DEVIS.map((s) => ({ value: s, label: s === 'converti' ? 'Convertis' : STATUT_DEVIS_LABELS[s], count: compteurs?.[s] })),
  ];
  const filtre = onglet !== 'tous' || !!q;

  return (
    <>
      <PageHeader
        title="Devis"
        subtitle={admin ? "Propositions chiffrées de toute l'équipe, avant l'ouverture d'un dossier." : 'Vos propositions chiffrées, avant l’ouverture d’un dossier.'}
        actions={
          <Link className="ev-btn ev-btn--primary" to="/devis/nouveau">
            <Plus aria-hidden="true" />
            Nouveau devis
          </Link>
        }
      />
      <div className="stack">
        <Tabs label="Statut des devis" tabs={tabs} value={onglet} onChange={(v) => maj({ statut: v === 'tous' ? null : v, page: null })} />
        <div className="ev-filterbar">
          <div className="ev-search" role="search">
            <Search aria-hidden="true" />
            <input className="ev-input" type="search" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Numéro, client ou objet" aria-label="Rechercher un devis" />
          </div>
          {liste.data && (
            <span className="ev-muted" style={{ fontSize: 13 }}>
              {liste.data.total} devis
            </span>
          )}
        </div>

        {liste.isError ? (
          <Alert tone="error">
            La liste des devis n'a pas pu être chargée : {messageErreur(liste.error)}{' '}
            <button className="cm-lien-bouton" onClick={() => void liste.refetch()}>
              Réessayer
            </button>
          </Alert>
        ) : liste.isLoading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <Card>
            {filtre ? (
              <EmptyState
                title="Aucun devis ne correspond"
                icon={<Search aria-hidden="true" />}
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setSaisie('');
                      setParams(new URLSearchParams(), { replace: true });
                    }}
                  >
                    Effacer les filtres
                  </Button>
                }
              >
                {q ? `Aucun devis ${onglet === 'tous' ? '' : `« ${STATUT_DEVIS_LABELS[onglet]} » `}pour « ${q} ».` : `Aucun devis « ${STATUT_DEVIS_LABELS[onglet as StatutDevis]} » pour le moment.`}
              </EmptyState>
            ) : (
              <EmptyState
                title="Aucun devis pour l'instant"
                icon={<FileText aria-hidden="true" />}
                action={
                  <Link className="ev-btn ev-btn--primary ev-btn--sm" to="/devis/nouveau">
                    <Plus aria-hidden="true" />
                    Nouveau devis
                  </Link>
                }
              >
                Chiffrez une demande avec la grille tarifaire, envoyez le PDF au client, puis convertissez le devis accepté en dossier.
              </EmptyState>
            )}
          </Card>
        ) : (
          <>
            <div className="ev-table-wrap cm-large">
              <table className="ev-table ev-table--clickable">
                <thead>
                  <tr>
                    <th scope="col">Numéro</th>
                    <th scope="col">Client</th>
                    <th scope="col">Machine</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Total TTC
                    </th>
                    <th scope="col">Statut</th>
                    <th scope="col">Date</th>
                    {admin && <th scope="col">Établi par</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr key={d.id} onClick={() => navigate(`/devis/${d.id}`)}>
                      <td className="nowrap">
                        <Link className="ev-ref cm-lien-ref" to={`/devis/${d.id}`} onClick={(e) => e.stopPropagation()}>
                          {d.numero}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 340 }}>
                        <span className="ev-cell-main">{d.client_nom}</span>
                        {d.description && <span className="ev-cell-sub truncate">{d.description}</span>}
                      </td>
                      <td>
                        <MachineChip machine={d.machine} />
                      </td>
                      <td className="ev-cell-num">{formatFCFA(d.total_ttc)}</td>
                      <td className="nowrap">
                        <DevisStatutBadge statut={d.statut} />
                        {d.expire && <span className="ev-cell-sub">Validité dépassée</span>}
                        {d.statut === 'converti' && d.dossier_numero && <span className="ev-cell-sub ev-ref">{d.dossier_numero}</span>}
                      </td>
                      <td className="ev-ref nowrap">{formatDate(d.created_at)}</td>
                      {admin && <td className="nowrap">{d.created_by_nom ?? '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />
            </div>

            <div className="cm-etroit cm-cartes">
              {items.map((d) => (
                <Link key={d.id} to={`/devis/${d.id}`} className="ev-job ev-card--interactive cm-carte" aria-label={`Devis ${d.numero}, ${d.client_nom}`}>
                  <div className="ev-job__top">
                    <Ref>{d.numero}</Ref>
                    <MachineChip machine={d.machine} />
                    <DevisStatutBadge statut={d.statut} />
                  </div>
                  <div>
                    <p className="ev-job__client">{d.client_nom}</p>
                    {d.description && <p className="ev-job__spec">{d.description}</p>}
                  </div>
                  <div className="ev-job__foot">
                    <span className="ev-muted ev-ref">
                      {formatDate(d.created_at)}
                      {d.expire ? ' · validité dépassée' : ''}
                    </span>
                    <span className="ev-num">{formatFCFA(d.total_ttc)}</span>
                  </div>
                </Link>
              ))}
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
