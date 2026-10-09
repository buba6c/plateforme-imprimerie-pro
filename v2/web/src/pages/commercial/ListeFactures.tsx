// Liste des factures : toutes par défaut (aucun filtre de période caché), recherche, filtres
// (période, statut, VosFactures, origine), totaux, colonne VosFactures, pagination. Quand il
// n'existe aucune facture, l'écran l'explique et propose les deux façons d'en créer.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FolderOpen, Plus, ReceiptText, Search } from 'lucide-react';
import { formatFCFA } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, Pagination, PaymentBadge, Ref } from '../../ui';
import { FactureStatutBadge, VosFacturesCellule } from '../../features/commercial/Document';
import { formatJour, pluriel } from '../../features/commercial/format';
import { useDebounced, useListeFactures, type FiltresFactures } from '../../features/commercial/hooks';
import type { FactureResume } from '../../features/commercial/types';
import '../../features/commercial/commercial.css';

const LIMIT = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VOSFACTURES = ['envoyee', 'non_envoyee', 'erreur'] as const;
const ORIGINES = ['dossier', 'directe'] as const;

export default function ListeFactures() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [saisie, setSaisie] = useState(params.get('q') ?? '');
  const q = useDebounced(saisie.trim(), 300);
  const from = DATE.test(params.get('from') ?? '') ? params.get('from')! : '';
  const to = DATE.test(params.get('to') ?? '') ? params.get('to')! : '';
  const statutParam = params.get('statut');
  const statut = statutParam === 'emise' || statutParam === 'annulee' ? statutParam : '';
  const vfParam = params.get('vosfactures') as (typeof VOSFACTURES)[number] | null;
  const vosfactures = vfParam && VOSFACTURES.includes(vfParam) ? vfParam : '';
  const origineParam = params.get('origine') as (typeof ORIGINES)[number] | null;
  const origine = origineParam && ORIGINES.includes(origineParam) ? origineParam : '';
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
  const filtres: FiltresFactures = {
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    statut: statut || undefined,
    vosfactures: vosfactures || undefined,
    origine: origine || undefined,
    page,
    limit: LIMIT,
  };
  const liste = useListeFactures(filtres, { enabled: !periodeInvalide });
  const items = liste.data?.items ?? [];
  const filtre = !!(q || from || to || statut || vosfactures || origine);
  const vfActif = !!liste.data?.vosfactures_actif;
  const colonneVf = vfActif || items.some((f) => f.vosfactures);
  const avecSituation = items.some((f) => f.situation_paiement);
  const effacer = () => {
    setSaisie('');
    setParams(new URLSearchParams(), { replace: true });
  };
  const changerPage = (p: number) => maj({ page: p > 1 ? String(p) : null });
  const nbColonnes = 5 + (avecSituation ? 1 : 0) + (colonneVf ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Factures"
        subtitle="Toutes les factures, des dossiers comme directes. Une facture annulée garde son numéro, qui n’est jamais réattribué."
        actions={
          <Link className="ev-btn ev-btn--primary" to="/factures/nouvelle">
            <Plus aria-hidden="true" />
            Nouvelle facture
          </Link>
        }
      />
      <div className="stack">
        <div className="cm-filtres" role="search" aria-label="Filtrer les factures">
          <div className="ev-field ev-search" style={{ alignSelf: 'flex-end' }}>
            <Search aria-hidden="true" />
            <input
              className="ev-input"
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Numéro, client, dossier ou n° VosFactures"
              aria-label="Rechercher une facture"
              style={{ height: 'var(--control-sm)', fontSize: 13 }}
            />
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
          <div className="ev-field">
            <label className="ev-label" htmlFor="f-origine">
              Origine
            </label>
            <select id="f-origine" className="ev-select" value={origine} onChange={(e) => maj({ origine: e.target.value || null })}>
              <option value="">Toutes</option>
              <option value="dossier">Depuis un dossier</option>
              <option value="directe">Directes (sans dossier)</option>
            </select>
          </div>
          {colonneVf && (
            <div className="ev-field">
              <label className="ev-label" htmlFor="f-vf">
                VosFactures
              </label>
              <select id="f-vf" className="ev-select" value={vosfactures} onChange={(e) => maj({ vosfactures: e.target.value || null })}>
                <option value="">Toutes</option>
                <option value="envoyee">Envoyées</option>
                <option value="non_envoyee">Non envoyées</option>
                <option value="erreur">Envoi en erreur</option>
              </select>
            </div>
          )}
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
                title="Aucune facture ne correspond à ces filtres"
                icon={<Search aria-hidden="true" />}
                action={
                  <Button size="sm" onClick={effacer}>
                    Afficher toutes les factures
                  </Button>
                }
              >
                Élargissez la période, changez le statut ou modifiez la recherche.
              </EmptyState>
            ) : (
              <EmptyState
                title="Aucune facture n’a encore été émise"
                icon={<ReceiptText aria-hidden="true" />}
                action={
                  <div className="cm-vide-actions">
                    <Link className="ev-btn ev-btn--primary ev-btn--sm" to="/factures/nouvelle">
                      <Plus aria-hidden="true" />
                      Créer une facture directe
                    </Link>
                    <Link className="ev-btn ev-btn--sm" to="/dossiers">
                      <FolderOpen aria-hidden="true" />
                      Facturer un dossier
                    </Link>
                  </div>
                }
              >
                Cette liste montre toutes les factures, sans filtre de période : elle est vide parce qu’aucune facture n’existe pour l’instant. Deux façons d’en
                créer une : une facture directe (client et lignes saisis à la main, sans dossier), ou le bouton « Créer la facture » dans la fiche d’un dossier dont le
                montant est défini.
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
                    {colonneVf && <th scope="col">VosFactures</th>}
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
                        {f.dossier_id === null ? (
                          <span className="ev-muted">Directe</span>
                        ) : (
                          <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`} onClick={(e) => e.stopPropagation()}>
                            {f.dossier_numero ?? `n° ${f.dossier_id}`}
                          </Link>
                        )}
                      </td>
                      <td className="ev-cell-num">
                        <span className={f.statut === 'annulee' ? 'cm-annulee' : undefined}>{formatFCFA(f.total_ttc)}</span>
                      </td>
                      {avecSituation && <td>{f.situation_paiement && f.statut === 'emise' ? <PaymentBadge situation={f.situation_paiement} /> : '—'}</td>}
                      {colonneVf && (
                        <td className="cm-vf-col">
                          <VosFacturesCellule j={f.vosfactures} actif={vfActif && f.statut === 'emise'} />
                        </td>
                      )}
                      <td className="cm-statut-col">
                        <FactureStatutBadge statut={f.statut} vosfactures={f.vosfactures} />
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
                        {liste.data?.compteurs && liste.data.compteurs.annulee > 0 ? ` dont ${pluriel(liste.data.compteurs.annulee, 'annulée')}` : ''}
                      </span>
                    </td>
                    <td className="ev-cell-num">{formatFCFA(liste.data?.somme_ttc ?? null)}</td>
                    <td colSpan={nbColonnes - 5} />
                  </tr>
                </tfoot>
              </table>
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={changerPage} />
            </div>

            <div className="cm-etroit cm-cartes">
              <div className="ev-card ev-kpi" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <span className="ev-kpi__label">Total facturé{filtre ? ' (filtre en cours)' : ''}</span>
                <span className="ev-kpi__value" style={{ fontSize: 22, lineHeight: '28px' }}>
                  {formatFCFA(liste.data?.somme_ttc ?? null)}
                </span>
                <span className="ev-kpi__meta">Hors factures annulées · {pluriel(liste.data?.total ?? 0, 'facture')} dans la liste</span>
              </div>
              {items.map((f) => (
                <CarteFacture key={f.id} f={f} vfActif={vfActif} />
              ))}
              <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={changerPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CarteFacture({ f, vfActif }: { f: FactureResume; vfActif: boolean }) {
  return (
    <Link to={`/factures/${f.id}`} className="ev-job ev-card--interactive cm-carte" aria-label={`Facture ${f.numero}, ${f.client_nom}`}>
      <div className="ev-job__top">
        <Ref>{f.numero}</Ref>
        <FactureStatutBadge statut={f.statut} vosfactures={f.vosfactures} />
      </div>
      <div>
        <p className="ev-job__client">{f.client_nom}</p>
        <p className="ev-job__spec">{f.dossier_id === null ? 'Facture directe, sans dossier' : `Dossier ${f.dossier_numero ?? `n° ${f.dossier_id}`}`}</p>
        {(f.vosfactures || vfActif) && f.statut === 'emise' && (
          <p className="ev-job__spec">
            VosFactures : {f.vosfactures?.id ? (f.vosfactures.numero ?? `n° ${f.vosfactures.id}`) : f.vosfactures?.erreur ? 'envoi échoué' : 'non envoyée'}
          </p>
        )}
      </div>
      <div className="ev-job__foot">
        <span className="ev-muted ev-ref">{formatJour(f.date_emission)}</span>
        <span className={`ev-num${f.statut === 'annulee' ? ' cm-annulee' : ''}`}>{formatFCFA(f.total_ttc)}</span>
      </div>
    </Link>
  );
}
