import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Wallet, X } from 'lucide-react';
import {
  formatDateHeure,
  formatEntier,
  formatFCFA,
  MODE_PAIEMENT_LABELS,
  ROLE_LABELS,
  type StatutPaiement,
} from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  LoadingRows,
  PageHeader,
  Pagination,
  Ref,
  Tabs,
  TextareaField,
  useToast,
} from '../../ui';
import type { Caisse, ListePaiements, Paiement } from '../../features/admin/types';
import '../../features/admin/admin.css';

const LIMIT = 50;

const TABS: { value: StatutPaiement; label: string }[] = [
  { value: 'a_valider', label: 'À valider' },
  { value: 'valide', label: 'Validés' },
  { value: 'refuse', label: 'Refusés' },
];

const VIDES: Record<StatutPaiement, { titre: string; texte: string }> = {
  a_valider: {
    titre: 'Aucun paiement à valider',
    texte: 'Les encaissements saisis par les livreurs et les préparateurs apparaissent ici jusqu’à votre validation.',
  },
  valide: { titre: 'Aucun paiement validé', texte: 'Les paiements que vous validez, ou que vous saisissez vous-même, apparaissent ici.' },
  refuse: { titre: 'Aucun paiement refusé', texte: 'Les paiements refusés apparaissent ici avec le motif transmis à l’encaisseur.' },
};

function invalider(qc: ReturnType<typeof useQueryClient>, dossierId?: number) {
  qc.invalidateQueries({ queryKey: ['paiements'] });
  qc.invalidateQueries({ queryKey: ['caisse'] });
  qc.invalidateQueries({ queryKey: ['stats'] });
  qc.invalidateQueries({ queryKey: ['dossiers'] });
  if (dossierId) qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
}

export default function Paiements() {
  const qc = useQueryClient();
  const toast = useToast();
  const [statut, setStatut] = useState<StatutPaiement>('a_valider');
  const [page, setPage] = useState(1);
  const [encaisseur, setEncaisseur] = useState<{ id: number; nom: string } | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [refus, setRefus] = useState<Paiement | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [enCours, setEnCours] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
    setSelection(new Set());
  }, [statut, encaisseur]);

  const liste = useQuery({
    queryKey: ['paiements', 'admin', statut, page, encaisseur?.id ?? null],
    queryFn: () => api.get<ListePaiements>('/paiements', { statut, page, limit: LIMIT, livreur_id: encaisseur?.id }),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

  const compteurs = useQuery({
    queryKey: ['paiements', 'admin', 'compteurs', encaisseur?.id ?? null],
    queryFn: async () => {
      const r = await Promise.all(TABS.map((t) => api.get<ListePaiements>('/paiements', { statut: t.value, limit: 1, livreur_id: encaisseur?.id })));
      return Object.fromEntries(TABS.map((t, i) => [t.value, r[i]!.total])) as Record<StatutPaiement, number>;
    },
  });

  const caisse = useQuery({ queryKey: ['caisse'], queryFn: () => api.get<Caisse>('/caisse'), refetchInterval: 60_000 });

  const valider = useMutation({
    mutationFn: (p: Paiement) => api.post<Paiement>(`/paiements/${p.id}/valider`),
    onMutate: (p) => setEnCours(p.id),
    onSettled: () => setEnCours(null),
    onSuccess: (_r, p) => {
      toast.success('Paiement validé', `${p.numero} · ${formatFCFA(p.montant)} en ${MODE_PAIEMENT_LABELS[p.mode]}`);
      setSelection((s) => {
        const n = new Set(s);
        n.delete(p.id);
        return n;
      });
      invalider(qc, p.dossier_id);
    },
    onError: (e, p) => toast.error(`Le paiement ${p.numero} n'a pas été validé`, messageErreur(e)),
  });

  const items = liste.data?.items ?? [];
  const selectionnes = items.filter((p) => selection.has(p.id));
  const sommeSelection = selectionnes.reduce((s, p) => s + p.montant, 0);
  const tousCoches = items.length > 0 && items.every((p) => selection.has(p.id));

  async function validerSelection() {
    setBulkBusy(true);
    const ok: Paiement[] = [];
    const ko: { p: Paiement; err: string }[] = [];
    for (const p of selectionnes) {
      try {
        await api.post(`/paiements/${p.id}/valider`);
        ok.push(p);
      } catch (e) {
        ko.push({ p, err: messageErreur(e) });
      }
    }
    setBulkBusy(false);
    setBulkOpen(false);
    setSelection(new Set(ko.map((k) => k.p.id)));
    invalider(qc);
    for (const p of ok) qc.invalidateQueries({ queryKey: ['dossier', p.dossier_id] });
    const totalOk = ok.reduce((s, p) => s + p.montant, 0);
    if (ko.length === 0) {
      toast.success(`${ok.length} ${ok.length > 1 ? 'paiements validés' : 'paiement validé'}`, `${formatFCFA(totalOk)} ajoutés à l'encaissé.`);
    } else {
      toast.error(
        `${ok.length} ${ok.length > 1 ? 'validés' : 'validé'}, ${ko.length} en échec`,
        ko.map((k) => `${k.p.numero} : ${k.err}`).join(' '),
      );
    }
  }

  const tabs = TABS.map((t) => ({ ...t, count: compteurs.data?.[t.value] }));

  return (
    <>
      <PageHeader
        title="Paiements"
        subtitle="Contrôlez les encaissements des livreurs et des préparateurs : un paiement ne compte dans l'encaissé qu'une fois validé."
      />
      <div className="adm-pay-grid">
        <div className="stack">
          <div className="ev-table-wrap">
            <div style={{ padding: '0 var(--space-4)' }}>
              <Tabs label="Statut des paiements" tabs={tabs} value={statut} onChange={setStatut} />
            </div>
            <div className="adm-table-tools">
              <div className="row">
                {encaisseur ? (
                  <span className="ev-chip">
                    Encaissé par {encaisseur.nom}
                    <button className="ev-icon-btn ev-icon-btn--sm" aria-label="Retirer le filtre encaisseur" onClick={() => setEncaisseur(null)} style={{ width: 22, height: 22 }}>
                      <X />
                    </button>
                  </span>
                ) : (
                  <span className="ev-muted" style={{ fontSize: 13 }}>
                    Tous les encaisseurs · choisissez-en un dans la caisse pour filtrer
                  </span>
                )}
              </div>
              {liste.data && (
                <span className="ev-muted" style={{ fontSize: 13 }}>
                  {formatEntier(liste.data.total)} {liste.data.total > 1 ? 'paiements' : 'paiement'} · <span className="ev-num">{formatFCFA(liste.data.somme)}</span>
                </span>
              )}
            </div>

            {liste.isError ? (
              <div style={{ padding: 'var(--space-4)' }}>
                <Alert tone="error">La liste des paiements n'a pas pu être chargée : {messageErreur(liste.error)}</Alert>
              </div>
            ) : liste.isLoading ? (
              <div style={{ padding: 'var(--space-4)' }}>
                <LoadingRows rows={5} />
              </div>
            ) : items.length === 0 ? (
              <EmptyState title={VIDES[statut].titre} icon={<Wallet aria-hidden="true" />}>
                {encaisseur ? `Aucun paiement de ${encaisseur.nom} dans cet onglet.` : VIDES[statut].texte}
              </EmptyState>
            ) : (
              <>
                <div className="adm-only-desktop" style={{ overflowX: 'auto' }}>
                  <table className="ev-table adm-dense">
                    <thead>
                      <tr>
                        {statut === 'a_valider' && (
                          <th className="adm-check-cell">
                            <label className="ev-check">
                              <input
                                type="checkbox"
                                checked={tousCoches}
                                onChange={(e) => setSelection(e.target.checked ? new Set(items.map((p) => p.id)) : new Set())}
                              />
                              <span className="ev-check__box" aria-hidden="true" />
                              <span className="sr-only">Tout sélectionner</span>
                            </label>
                          </th>
                        )}
                        <th>Dossier</th>
                        <th className="adm-num-th">Montant</th>
                        <th>Mode</th>
                        <th>Encaissé par</th>
                        {statut === 'valide' && <th>Validé par</th>}
                        {statut === 'refuse' && <th>Refus</th>}
                        {statut === 'a_valider' && <th className="ev-cell-actions"><span className="sr-only">Actions</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} aria-selected={selection.has(p.id) || undefined}>
                          {statut === 'a_valider' && (
                            <td className="adm-check-cell">
                              <label className="ev-check">
                                <input
                                  type="checkbox"
                                  checked={selection.has(p.id)}
                                  onChange={(e) =>
                                    setSelection((s) => {
                                      const n = new Set(s);
                                      if (e.target.checked) n.add(p.id);
                                      else n.delete(p.id);
                                      return n;
                                    })
                                  }
                                />
                                <span className="ev-check__box" aria-hidden="true" />
                                <span className="sr-only">Sélectionner le paiement {p.numero}</span>
                              </label>
                            </td>
                          )}
                          <td>
                            <Link to={`/dossiers/${p.dossier_id}`} className="ev-link ev-ref">
                              {p.numero}
                            </Link>
                            <span className="adm-sub">
                              {p.client_nom}
                              {p.dossier_supprime ? ' · dossier supprimé' : ''}
                            </span>
                          </td>
                          <td className="ev-cell-num">{formatFCFA(p.montant)}</td>
                          <td>
                            {MODE_PAIEMENT_LABELS[p.mode]}
                            <span className="adm-sub">{p.reference ? <Ref>Réf. {p.reference}</Ref> : 'Sans référence'}</span>
                            {p.notes && <span className="adm-sub">{p.notes}</span>}
                          </td>
                          <td className="nowrap">
                            {p.encaisse_par_nom ?? '—'}
                            <span className="adm-sub">{formatDateHeure(p.encaisse_at)}</span>
                          </td>
                          {statut === 'valide' && (
                            <td>
                              {p.valide_par_nom ?? '—'}
                              <span className="adm-sub">{formatDateHeure(p.valide_at)}</span>
                            </td>
                          )}
                          {statut === 'refuse' && (
                            <td style={{ maxWidth: 260 }}>
                              {p.motif_refus ?? '—'}
                              <span className="adm-sub">
                                {p.valide_par_nom ?? '—'} · {formatDateHeure(p.valide_at)}
                              </span>
                            </td>
                          )}
                          {statut === 'a_valider' && (
                            <td className="ev-cell-actions">
                              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                <Button size="sm" variant="primary" busy={enCours === p.id} disabled={bulkBusy} onClick={() => valider.mutate(p)} aria-label={`Valider le paiement ${p.numero}`}>
                                  Valider
                                </Button>
                                <Button size="sm" disabled={bulkBusy || enCours === p.id} onClick={() => setRefus(p)} aria-label={`Refuser le paiement ${p.numero}`}>
                                  Refuser
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="adm-only-mobile adm-cards" style={{ padding: 'var(--space-3)' }}>
                  {statut === 'a_valider' && (
                    <label className="ev-check" style={{ padding: '0 var(--space-1)' }}>
                      <input type="checkbox" checked={tousCoches} onChange={(e) => setSelection(e.target.checked ? new Set(items.map((p) => p.id)) : new Set())} />
                      <span className="ev-check__box" aria-hidden="true" />
                      Tout sélectionner
                    </label>
                  )}
                  {items.map((p) => (
                    <article key={p.id} className="adm-mcard" aria-selected={selection.has(p.id) || undefined}>
                      <div className="adm-mcard__top">
                        <span className="adm-mcard__amount">{formatFCFA(p.montant)}</span>
                        {statut === 'a_valider' && (
                          <label className="ev-check">
                            <input
                              type="checkbox"
                              checked={selection.has(p.id)}
                              onChange={(e) =>
                                setSelection((s) => {
                                  const n = new Set(s);
                                  if (e.target.checked) n.add(p.id);
                                  else n.delete(p.id);
                                  return n;
                                })
                              }
                            />
                            <span className="ev-check__box" aria-hidden="true" />
                            <span className="sr-only">Sélectionner le paiement {p.numero}</span>
                          </label>
                        )}
                      </div>
                      <div>
                        <Link to={`/dossiers/${p.dossier_id}`} className="ev-link ev-ref">
                          {p.numero}
                        </Link>{' '}
                        · {p.client_nom}
                      </div>
                      <div className="adm-mcard__meta">
                        {MODE_PAIEMENT_LABELS[p.mode]}
                        {p.reference ? (
                          <>
                            {' '}
                            · <Ref>Réf. {p.reference}</Ref>
                          </>
                        ) : (
                          ' · sans référence'
                        )}
                        <br />
                        Encaissé par {p.encaisse_par_nom ?? '—'} le {formatDateHeure(p.encaisse_at)}
                        {p.notes ? (
                          <>
                            <br />
                            {p.notes}
                          </>
                        ) : null}
                        {statut === 'valide' && (
                          <>
                            <br />
                            Validé par {p.valide_par_nom ?? '—'} le {formatDateHeure(p.valide_at)}
                          </>
                        )}
                        {statut === 'refuse' && (
                          <>
                            <br />
                            Refusé par {p.valide_par_nom ?? '—'} : {p.motif_refus ?? '—'}
                          </>
                        )}
                      </div>
                      {statut === 'a_valider' && (
                        <div className="adm-mcard__actions">
                          <Button size="sm" variant="primary" icon={<Check />} busy={enCours === p.id} disabled={bulkBusy} onClick={() => valider.mutate(p)}>
                            Valider
                          </Button>
                          <Button size="sm" icon={<X />} disabled={bulkBusy || enCours === p.id} onClick={() => setRefus(p)}>
                            Refuser
                          </Button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMIT} onPage={setPage} />
              </>
            )}
          </div>

          {selectionnes.length > 0 && statut === 'a_valider' && (
            <div className="adm-bulk" role="region" aria-label="Sélection">
              <span>
                <strong>
                  {selectionnes.length} {selectionnes.length > 1 ? 'paiements sélectionnés' : 'paiement sélectionné'}
                </strong>{' '}
                · <span className="ev-num">{formatFCFA(sommeSelection)}</span>
              </span>
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => setSelection(new Set())} disabled={bulkBusy}>
                  Vider la sélection
                </Button>
                <Button size="sm" variant="primary" icon={<Check />} onClick={() => setBulkOpen(true)} busy={bulkBusy}>
                  Valider la sélection
                </Button>
              </div>
            </div>
          )}
        </div>

        <CaissePanel
          data={caisse.data}
          error={caisse.isError ? messageErreur(caisse.error) : null}
          loading={caisse.isLoading}
          actif={encaisseur?.id ?? null}
          onChoisir={(u) => {
            setEncaisseur(u && encaisseur?.id !== u.id ? u : null);
            setStatut('a_valider');
          }}
        />
      </div>

      <RefusDialog paiement={refus} onClose={() => setRefus(null)} />

      <ConfirmDialog
        open={bulkOpen}
        onClose={() => !bulkBusy && setBulkOpen(false)}
        onConfirm={() => void validerSelection()}
        busy={bulkBusy}
        title={`Valider ${selectionnes.length} ${selectionnes.length > 1 ? 'paiements' : 'paiement'}`}
        confirmLabel={`Valider ${formatFCFA(sommeSelection)}`}
        description="Vérifiez que l'argent remis correspond : une fois validés, ces paiements comptent dans l'encaissé et ne peuvent plus être refusés."
      >
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {selectionnes.map((p) => (
            <li key={p.id}>
              <Ref>{p.numero}</Ref> · {p.client_nom} · <span className="ev-num">{formatFCFA(p.montant)}</span> · {MODE_PAIEMENT_LABELS[p.mode]}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  );
}

function RefusDialog({ paiement, onClose }: { paiement: Paiement | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    setMotif('');
    setErreur(null);
  }, [paiement?.id]);
  const m = useMutation({
    mutationFn: () => api.post(`/paiements/${paiement!.id}/refuser`, { motif: motif.trim() }),
    onSuccess: () => {
      toast.success('Paiement refusé', `${paiement!.numero} · le motif est transmis à ${paiement!.encaisse_par_nom ?? "l'encaisseur"}.`);
      invalider(qc, paiement!.dossier_id);
      onClose();
    },
    onError: (e) => setErreur(messageErreur(e)),
  });
  const trop = motif.trim().length > 0 && motif.trim().length < 3;
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
            <Ref>{paiement.numero}</Ref> · {paiement.client_nom} · <span className="ev-num">{formatFCFA(paiement.montant)}</span> en {MODE_PAIEMENT_LABELS[paiement.mode]}, encaissé par{' '}
            {paiement.encaisse_par_nom ?? '—'}.
          </>
        ) : null
      }
    >
      {erreur && <Alert tone="error">{erreur}</Alert>}
      <TextareaField
        label="Motif du refus"
        required
        data-autofocus
        value={motif}
        maxLength={500}
        onChange={(e) => setMotif(e.target.value)}
        error={trop ? 'Indiquez un motif d’au moins 3 caractères.' : null}
        help="Transmis à la personne qui a encaissé. Exemple : montant remis inférieur, référence Wave introuvable."
      />
    </ConfirmDialog>
  );
}

function CaissePanel({
  data,
  error,
  loading,
  actif,
  onChoisir,
}: {
  data: Caisse | undefined;
  error: string | null;
  loading: boolean;
  actif: number | null;
  onChoisir: (u: { id: number; nom: string } | null) => void;
}) {
  const modes = useMemo(() => data?.par_mode ?? [], [data]);
  return (
    <Card title="Caisse" flush className="adm-sticky">
      {error ? (
        <div style={{ padding: 'var(--space-4)' }}>
          <Alert tone="error">La caisse n'a pas pu être chargée : {error}</Alert>
        </div>
      ) : loading || !data ? (
        <div style={{ padding: 'var(--space-4)' }}>
          <LoadingRows rows={3} />
        </div>
      ) : (
        <>
          <div className="adm-caisse-total">
            <div className="stack-sm" style={{ gap: 2 }}>
              <span className="ev-kpi__label">À valider</span>
              <span className="ev-kpi__value adm-caisse-pending">{formatEntier(data.totaux?.a_valider.somme ?? sum(data.par_encaisseur.map((e) => e.a_valider.somme)))}</span>
              <span className="adm-caisse-sub">
                FCFA · {data.totaux?.a_valider.n ?? sum(data.par_encaisseur.map((e) => e.a_valider.n))} paiement(s)
              </span>
            </div>
            <div className="stack-sm" style={{ gap: 2 }}>
              <span className="ev-kpi__label">Validé aujourd'hui</span>
              <span className="ev-kpi__value">{formatEntier(data.totaux?.valide_aujourdhui.somme ?? sum(data.par_encaisseur.map((e) => e.valide_aujourdhui.somme)))}</span>
              <span className="adm-caisse-sub">
                FCFA · {data.totaux?.valide_aujourdhui.n ?? sum(data.par_encaisseur.map((e) => e.valide_aujourdhui.n))} paiement(s)
              </span>
            </div>
          </div>
          <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-1)' }}>
            <h3 className="section-title">Par encaisseur</h3>
          </div>
          {data.par_encaisseur.length === 0 ? (
            <p className="ev-muted" style={{ margin: 0, padding: '0 var(--space-5) var(--space-4)', fontSize: 13 }}>
              Personne ne détient d'argent à valider et rien n'a été validé aujourd'hui.
            </p>
          ) : (
            <div className="adm-caisse-list">
              {data.par_encaisseur.map((e) => (
                <button
                  key={e.user_id ?? 'inconnu'}
                  type="button"
                  className="adm-caisse-row"
                  aria-pressed={actif !== null && actif === e.user_id}
                  disabled={e.user_id === null}
                  onClick={() => e.user_id !== null && onChoisir({ id: e.user_id, nom: e.nom })}
                  title={e.user_id === null ? undefined : `Afficher uniquement les paiements encaissés par ${e.nom}`}
                >
                  <span style={{ fontWeight: 500, minWidth: 0 }} className="truncate">
                    {e.nom}
                  </span>
                  <span className="ev-num adm-caisse-pending">{formatFCFA(e.a_valider.somme)}</span>
                  <span className="adm-caisse-sub">
                    {e.role ? ROLE_LABELS[e.role] : '—'} · {e.a_valider.n} à valider
                  </span>
                  <span className="adm-caisse-sub" style={{ textAlign: 'right' }}>
                    Validé auj. <span className="ev-num">{formatFCFA(e.valide_aujourdhui.somme)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-1)', borderTop: '1px solid var(--line)' }}>
            <h3 className="section-title">Par mode de paiement</h3>
          </div>
          {modes.length === 0 ? (
            <p className="ev-muted" style={{ margin: 0, padding: '0 var(--space-5) var(--space-4)', fontSize: 13 }}>
              Aucun mouvement aujourd'hui.
            </p>
          ) : (
            <table className="ev-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th className="adm-num-th">À valider</th>
                  <th className="adm-num-th">Validé auj.</th>
                </tr>
              </thead>
              <tbody>
                {modes.map((m) => (
                  <tr key={m.mode}>
                    <td>{m.libelle ?? MODE_PAIEMENT_LABELS[m.mode]}</td>
                    <td className="ev-cell-num">
                      {formatEntier(m.a_valider.somme)}
                      <span className="adm-sub">{m.a_valider.n} paiement(s)</span>
                    </td>
                    <td className="ev-cell-num">
                      {formatEntier(m.valide_aujourdhui.somme)}
                      <span className="adm-sub">{m.valide_aujourdhui.n} paiement(s)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="adm-explain" style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--line)' }}>
            Avant de valider, comptez l'argent remis par chaque encaisseur : les espèces doivent correspondre au montant « à valider », les paiements
            mobiles à leur référence de transaction. Montants en FCFA.
          </p>
        </>
      )}
    </Card>
  );
}

function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}
