import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ReceiptText, Search } from 'lucide-react';
import { formatFCFA } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, Pagination, PaymentBadge, Ref } from '../../ui';
import { FactureStatutBadge } from '../../features/commercial/Document';
import { formatJour, pluriel } from '../../features/commercial/format';
import { useDebounced, useListeFactures } from '../../features/commercial/hooks';
import type { FactureResume } from '../../features/commercial/types';
import '../../features/commercial/commercial.css';

const LIMIT = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ListeFactures() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [saisie, setSaisie] = useState(params.get('q') ?? '');
  const q = useDebounced(saisie.trim(), 300);
  const from = DATE.test(params.get('from') ?? '') ? params.get('from')! : '';
  const to = DATE.test(params.get('to') ?? '') ? params.get('to')! : '';
  const statutParam = params.get('statut');
  const statut = statutParam === 'emise' || statutParam === 'annulee' ? statutParam : '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const maj = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== q) maj({ q: q || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const periodeInvalide = !!from && !!to && from > to;
  const liste = useListeFactures(
    { q: q || undefined, from: from || undefined, to: to || undefined, statut: statut || undefined, page, limit: LIMIT },
    { enabled: !periodeInvalide },
  );
  const items = liste.data?.items ?? [];
  const filtre = !!(q || from || to || statut);
  const avecSituation = items.some((f) => f.situation_paiement);
  const effacer = () => {
    setSaisie('');
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <>
      <PageHeader title="Factures" subtitle="Factures émises depuis les dossiers. Une facture annulée garde son numéro, qui n’est jamais réattribué." />
      <div className="stack">
        <div className="cm-filtres" role="search" aria-label="Filtrer les factures">
          <div className="ev-field ev-search" style={{ alignSelf: 'flex-end' }}>
            <Search aria-hidden="true" />
            <input className="ev-input" type="search" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Numéro, client ou dossier" aria-label="Rechercher une facture" style={{ height: 'var(--control-sm)', fontSize: 13 }} />
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="f-from">
              Émises du
            </label>
            <input id="f-from" className="ev-input" type="date" value={from} max={to || undefined} onChange={(e) => maj({ from: e.target.value || null })} />
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="f-to">
              au
            </label>
            <input id="f-to" className="ev-input" type="date" value={to} min={from || undefined} onChange={(e) => maj({ to: e.target.value || null })} aria-invalid={periodeInvalide || undefined} />
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="f-statut">
              Statut
            </label>
            <select id="f-statut" className="ev-select" value={statut} onChange={(e) => maj({ statut: e.target.value || null })}>
              <option value="">Toutes</option>
              <option value="emise">Émises</option>
              <option value="annulee">Annulées</option>
            </select>
          </div>
          {filtre && (
            <Button size="sm" variant="ghost" onClick={effacer}>
              Effacer les filtres
            </Button>
          )}
        </div>

        {periodeInvalide ? (
          <Alert tone="warning">La date de début est postérieure à la date de fin : corrigez la période.</Alert>
        ) : liste.isError ? (
          <Alert tone="error">
            La liste des factures n'a pas pu être chargée : {messageErreur(liste.error)}{' '}
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
                title="Aucune facture ne correspond"
                icon={<Search aria-hidden="true" />}
                action={
                  <Button size="sm" onClick={effacer}>
                    Effacer les filtres
                  </Button>
                }
              >
                Élargissez la période ou modifiez la recherche.
              </EmptyState>
            ) : (
              <EmptyState title="Aucune facture pour l'instant" icon={<ReceiptText aria-hidden="true" />}>
                Une facture s’émet depuis la fiche d’un dossier dont le montant est défini. Elle apparaîtra ici avec son numéro définitif.
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
                    <th scope="col">Date</th>
                    <th scope="col">Client</th>
                    <th scope="col">Dossier</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Total TTC
                    </th>
                    {avecSituation && <th scope="col">Paiement</th>}
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <tr key={f.id} onClick={() => navigate(`/factures/${f.id}`)}>
                      <td className="nowrap">
                        <Link className="ev-ref cm-lien-ref" to={`/factures/${f.id}`} onClick={(e) => e.stopPropagation()}>
                          {f.numero}
                        </Link>
                      </td>
                      <td className="ev-ref nowrap">{formatJour(f.date_emission)}</td>
                      <td style={{ maxWidth: 320 }}>
                        <span className="ev-cell-main">{f.client_nom}</span>
                        {f.statut === 'annulee' && f.motif_annulation && <span className="ev-cell-sub truncate">Annulée : {f.motif_annulation}</span>}
                      </td>
                      <td className="nowrap">
                        <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`} onClick={(e) => e.stopPropagation()}>
                          {f.dossier_numero ?? `n° ${f.dossier_id}`}
                        </Link>
                      </td>
                      <td className="ev-cell-num">
                        <span className={f.statut === 'annulee' ? 'cm-annulee' : undefined}>{formatFCFA(f.total_ttc)}</span>
                      </td>
                      {avecSituation && <td>{f.situation_paiement && f.statut === 'emise' ? <PaymentBadge situation={f.situation_paiement} /> : '—'}</td>}
                      <td>
                        <FactureStatutBadge statut={f.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="cm-table-foot">
                  <tr>
                    <td colSpan={4}>
                      Total facturé{filtre ? ' (filtre en cours)' : ''}, hors factures annulées
                      <span className="ev-cell-sub" style={{ fontWeight: 400 }}>
                        {pluriel(liste.data?.total ?? 0, 'facture')}
                      </span>
                    </td>
                    <td className="ev-cell-num">{formatFCFA(liste.data?.somme_ttc ?? null)}</td>
                    <td colSpan={avecSituation ? 2 : 1} />
                  </tr>
                </tfoot>
              </table>
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />
            </div>

            <div className="cm-etroit cm-cartes">
              <div className="ev-card ev-kpi" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <span className="ev-kpi__label">Total facturé{filtre ? ' (filtre en cours)' : ''}</span>
                <span className="ev-kpi__value" style={{ fontSize: 22, lineHeight: '28px' }}>
                  {formatFCFA(liste.data?.somme_ttc ?? null)}
                </span>
                <span className="ev-kpi__meta">{pluriel(liste.data?.total ?? 0, 'facture')}, hors annulées pour le total</span>
              </div>
              {items.map((f) => (
                <CarteFacture key={f.id} f={f} />
              ))}
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CarteFacture({ f }: { f: FactureResume }) {
  return (
    <Link to={`/factures/${f.id}`} className="ev-job ev-card--interactive cm-carte" aria-label={`Facture ${f.numero}, ${f.client_nom}`}>
      <div className="ev-job__top">
        <Ref>{f.numero}</Ref>
        <FactureStatutBadge statut={f.statut} />
      </div>
      <div>
        <p className="ev-job__client">{f.client_nom}</p>
        <p className="ev-job__spec">Dossier {f.dossier_numero ?? `n° ${f.dossier_id}`}</p>
      </div>
      <div className="ev-job__foot">
        <span className="ev-muted ev-ref">{formatJour(f.date_emission)}</span>
        <span className={`ev-num${f.statut === 'annulee' ? ' cm-annulee' : ''}`}>{formatFCFA(f.total_ttc)}</span>
      </div>
    </Link>
  );
}
