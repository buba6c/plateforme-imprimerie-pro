import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Table2 } from 'lucide-react';
import { formatEntier, formatFCFA, MACHINE_LABELS, ROLE_LABELS } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Kpi, PageHeader, Segmented, Skeleton } from '../../ui';
import { BarresDelais, CommandesChart, EvolutionChart, formatDuree } from '../../features/admin/charts';
import { buckets, jourFr, joursEntre, libelleLong, PRESETS } from '../../features/admin/dates';
import { useAujourdhui } from '../../features/admin/hooks';
import type { Delais, Pas, PointEvolution, StatsProduction, TopClient } from '../../features/admin/types';
import '../../features/admin/admin.css';

const ETAPES: { cle: keyof Delais; label: string; aide: string }[] = [
  { cle: 'creation_validation', label: 'Préparation', aide: 'De la création à la validation du dossier' },
  { cle: 'validation_fin_impression', label: 'Impression', aide: 'De la validation à la fin de l’impression' },
  { cle: 'fin_impression_livraison', label: 'Livraison', aide: 'De la fin de l’impression à la livraison' },
];

const ACTIVITE: Record<string, [string, string]> = {
  creation: ['création', 'créations'],
  valider: ['validation', 'validations'],
  renvoyer_preparation: ['renvoi en préparation', 'renvois en préparation'],
  demarrer: ['impression démarrée', 'impressions démarrées'],
  remettre_en_attente: ['remise en attente', 'remises en attente'],
  marquer_imprime: ['impression terminée', 'impressions terminées'],
  demander_revision: ['révision demandée', 'révisions demandées'],
  programmer_livraison: ['livraison programmée', 'livraisons programmées'],
  retirer_tournee: ['retrait de tournée', 'retraits de tournée'],
  confirmer_livraison: ['livraison', 'livraisons'],
  cloturer: ['clôture', 'clôtures'],
  rouvrir: ['réouverture', 'réouvertures'],
  reimprimer: ['réimpression', 'réimpressions'],
  forcer: ['statut forcé', 'statuts forcés'],
  forcer_statut: ['statut forcé', 'statuts forcés'],
  suppression: ['suppression', 'suppressions'],
  restauration: ['restauration', 'restaurations'],
};

const PAS_OPTIONS: { value: Pas; label: string }[] = [
  { value: 'jour', label: 'Par jour' },
  { value: 'semaine', label: 'Par semaine' },
  { value: 'mois', label: 'Par mois' },
];

const MAX_POINTS: Record<Pas, number> = { jour: 400, semaine: 260, mois: 120 };

function pasConseille(from: string, to: string): Pas {
  const j = joursEntre(from, to);
  if (j > 120) return 'mois';
  if (j > 45) return 'semaine';
  return 'jour';
}

export default function Statistiques() {
  const today = useAujourdhui();
  const [preset, setPreset] = useState('30j');
  const def = PRESETS.find((p) => p.id === '30j')!;
  const [range, setRange] = useState(() => def.bornes(today));
  const [pas, setPas] = useState<Pas>(def.pas);
  const [tableau, setTableau] = useState(false);

  const { from, to } = range;
  const inverse = from > to;
  const nbPoints = inverse ? 0 : buckets(from, to, pas).length;
  const tropLong = nbPoints > MAX_POINTS[pas];
  const valide = !!from && !!to && !inverse && !tropLong;

  const evolution = useQuery({
    queryKey: ['stats', 'evolution', from, to, pas],
    queryFn: () => api.get<PointEvolution[]>('/stats/evolution', { from, to, pas }),
    enabled: valide,
    placeholderData: (prev) => prev,
  });
  const production = useQuery({
    queryKey: ['stats', 'production', from, to],
    queryFn: () => api.get<StatsProduction>('/stats/production', { from, to }),
    enabled: valide,
    placeholderData: (prev) => prev,
  });
  const top = useQuery({
    queryKey: ['stats', 'top-clients', from, to],
    queryFn: () => api.get<TopClient[]>('/stats/top-clients', { from, to, limit: 10 }),
    enabled: valide,
    placeholderData: (prev) => prev,
  });

  const totaux = useMemo(() => {
    const d = evolution.data;
    if (!d) return null;
    return d.reduce((s, p) => ({ commandes: s.commandes + p.commandes, montant: s.montant + p.montant_commandes, encaisse: s.encaisse + p.encaisse }), {
      commandes: 0,
      montant: 0,
      encaisse: 0,
    });
  }, [evolution.data]);
  const livres = production.data?.par_machine.reduce((s, m) => s + m.livres, 0);
  const imprimes = production.data?.par_machine.reduce((s, m) => s + m.imprimes, 0);

  const choisirPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      setRange(p.bornes(today));
      setPas(p.pas);
    }
  };
  const changerDate = (k: 'from' | 'to', v: string) => {
    if (!v) return;
    const r = { ...range, [k]: v };
    setRange(r);
    setPreset('perso');
    if (r.from <= r.to) {
      const conseil = pasConseille(r.from, r.to);
      if (buckets(r.from, r.to, pas).length > MAX_POINTS[pas] || (pas === 'jour' && conseil !== 'jour')) setPas(conseil);
    }
  };
  const qs = new URLSearchParams({ from, to }).toString();
  const opacite = (f: boolean) => ({ opacity: f ? 0.6 : 1, transition: 'opacity .15s ease-out' });

  return (
    <>
      <PageHeader
        title="Statistiques"
        subtitle={valide ? `Du ${jourFr(from)} au ${jourFr(to)}` : 'Choisissez une période'}
        actions={
          <div className="row">
            <a className="ev-btn ev-btn--sm" href={valide ? `/api/exports/dossiers.csv?${qs}` : undefined} download aria-disabled={!valide || undefined}>
              <Download aria-hidden="true" />
              Exporter les dossiers
            </a>
            <a className="ev-btn ev-btn--sm" href={valide ? `/api/exports/paiements.csv?${qs}` : undefined} download aria-disabled={!valide || undefined}>
              <Download aria-hidden="true" />
              Exporter les paiements
            </a>
            <a className="ev-btn ev-btn--sm" href={valide ? `/api/exports/factures.csv?${qs}` : undefined} download aria-disabled={!valide || undefined}>
              <Download aria-hidden="true" />
              Exporter les factures
            </a>
          </div>
        }
      />

      <div className="ev-filterbar" role="group" aria-label="Période">
        <select className="ev-select" aria-label="Période prédéfinie" value={preset} onChange={(e) => choisirPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="perso">Période personnalisée</option>
        </select>
        <label className="row ev-muted" style={{ fontSize: 13, gap: 6 }}>
          Du
          <input className="ev-input" type="date" value={from} max={today} onChange={(e) => changerDate('from', e.target.value)} style={{ minWidth: 150 }} />
        </label>
        <label className="row ev-muted" style={{ fontSize: 13, gap: 6 }}>
          au
          <input className="ev-input" type="date" value={to} max={today} onChange={(e) => changerDate('to', e.target.value)} style={{ minWidth: 150 }} />
        </label>
        <div className="adm-period adm-period--sm">
          <Segmented<Pas> name="pas" label="Regroupement" value={pas} onChange={setPas} options={PAS_OPTIONS} />
        </div>
      </div>
      <p className="adm-explain" style={{ marginTop: 'calc(-1 * var(--space-3))' }}>
        Les exports CSV (séparateur « ; », ouverture directe dans Excel) portent sur la même période. Commandes : dossiers créés sur la période ; encaissé :
        paiements validés sur la période.
      </p>

      {inverse && <Alert tone="warning">La date de début est postérieure à la date de fin : inversez-les.</Alert>}
      {tropLong && (
        <Alert tone="warning">
          Période trop longue pour un regroupement {PAS_OPTIONS.find((p) => p.value === pas)!.label.toLowerCase()} ({nbPoints} points) : choisissez un
          regroupement plus large.
        </Alert>
      )}

      <div className="ev-kpis" style={opacite(evolution.isFetching || production.isFetching)}>
        <Kpi label="Commandes" value={totaux ? formatEntier(totaux.commandes) : evolution.isLoading ? <Skeleton h={32} w={60} /> : '—'} meta="dossiers créés" />
        <Kpi
          label="Montant commandé"
          value={totaux ? formatEntier(totaux.montant) : evolution.isLoading ? <Skeleton h={32} w={120} /> : '—'}
          unit={totaux ? 'FCFA' : undefined}
          meta="montant des dossiers créés"
        />
        <Kpi
          label="Encaissé"
          value={totaux ? formatEntier(totaux.encaisse) : evolution.isLoading ? <Skeleton h={32} w={120} /> : '—'}
          unit={totaux ? 'FCFA' : undefined}
          meta="paiements validés"
        />
        <Kpi
          label="Livrés"
          value={livres !== undefined ? formatEntier(livres) : production.isLoading ? <Skeleton h={32} w={60} /> : '—'}
          meta={imprimes !== undefined ? `${formatEntier(imprimes)} impressions terminées` : '—'}
        />
      </div>

      <Card
        title="Montant commandé et encaissé"
        actions={
          <Button size="sm" variant="ghost" icon={<Table2 />} onClick={() => setTableau((v) => !v)} aria-pressed={tableau}>
            {tableau ? 'Masquer le tableau' : 'Afficher le tableau'}
          </Button>
        }
      >
        {evolution.isError ? (
          <Alert tone="error">L’évolution n’a pas pu être chargée : {messageErreur(evolution.error)}</Alert>
        ) : !evolution.data ? (
          <Skeleton h={300} />
        ) : evolution.data.length === 0 ? (
          <p className="ev-muted">Aucune donnée sur cette période.</p>
        ) : (
          <div className="stack" style={opacite(evolution.isFetching)}>
            <EvolutionChart data={evolution.data} pas={pas} height={280} />
            {tableau && (
              <div className="ev-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table className="ev-table adm-dense">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th className="adm-num-th">Commandes</th>
                      <th className="adm-num-th">Commandé</th>
                      <th className="adm-num-th">Encaissé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolution.data.map((p) => (
                      <tr key={p.periode}>
                        <td>{libelleLong(p.periode, pas)}</td>
                        <td className="ev-cell-num">{formatEntier(p.commandes)}</td>
                        <td className="ev-cell-num">{formatFCFA(p.montant_commandes)}</td>
                        <td className="ev-cell-num">{formatFCFA(p.encaisse)}</td>
                      </tr>
                    ))}
                    {totaux && (
                      <tr className="adm-sum-row">
                        <td>Total</td>
                        <td className="ev-cell-num">{formatEntier(totaux.commandes)}</td>
                        <td className="ev-cell-num">{formatFCFA(totaux.montant)}</td>
                        <td className="ev-cell-num">{formatFCFA(totaux.encaisse)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Commandes créées">
          {evolution.data && evolution.data.length ? (
            <div style={opacite(evolution.isFetching)}>
              <CommandesChart data={evolution.data} pas={pas} height={220} />
            </div>
          ) : evolution.isError ? (
            <p className="ev-muted">—</p>
          ) : (
            <Skeleton h={220} />
          )}
        </Card>

        <Card title="Délais moyens de production">
          {production.isError ? (
            <Alert tone="error">Les délais n’ont pas pu être chargés : {messageErreur(production.error)}</Alert>
          ) : !production.data ? (
            <Skeleton h={220} />
          ) : (
            <div className="stack" style={opacite(production.isFetching)}>
              {ETAPES.every((e) => production.data!.delais[e.cle].heures_moyennes === null) ? (
                <p className="ev-muted" style={{ margin: 0 }}>
                  Aucune étape terminée sur cette période : les délais apparaîtront dès qu’un dossier aura été validé, imprimé ou livré.
                </p>
              ) : (
                <BarresDelais
                  data={ETAPES.map((e) => ({
                    label: e.label,
                    aide: e.aide,
                    heures: production.data!.delais[e.cle].heures_moyennes,
                    nb: production.data!.delais[e.cle].nb,
                  }))}
                />
              )}
              <p className="adm-explain">Une étape compte quand elle se termine dans la période. Heures calendaires, nuits et week-ends compris.</p>
            </div>
          )}
        </Card>
      </div>

      {production.data && (
        <Card title="Par machine" flush>
          <div style={{ overflowX: 'auto' }}>
            <table className="ev-table adm-dense">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th className="adm-num-th">Créés</th>
                  <th className="adm-num-th">Montant commandé</th>
                  <th className="adm-num-th">Imprimés</th>
                  <th className="adm-num-th">Livrés</th>
                  {ETAPES.map((e) => (
                    <th key={e.cle} className="adm-num-th" title={e.aide}>
                      Délai {e.label.toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {production.data.par_machine.map((m) => (
                  <tr key={m.machine}>
                    <td>{MACHINE_LABELS[m.machine]}</td>
                    <td className="ev-cell-num">{formatEntier(m.crees)}</td>
                    <td className="ev-cell-num">{formatFCFA(m.montant)}</td>
                    <td className="ev-cell-num">{formatEntier(m.imprimes)}</td>
                    <td className="ev-cell-num">{formatEntier(m.livres)}</td>
                    {ETAPES.map((e) => (
                      <td key={e.cle} className="ev-cell-num">
                        {formatDuree(m.delais[e.cle].heures_moyennes)}
                        <span className="adm-sub">{m.delais[e.cle].nb} mesuré(s)</span>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="adm-sum-row">
                  <td>Ensemble</td>
                  <td className="ev-cell-num">{formatEntier(production.data.par_machine.reduce((s, m) => s + m.crees, 0))}</td>
                  <td className="ev-cell-num">{formatFCFA(production.data.par_machine.reduce((s, m) => s + m.montant, 0))}</td>
                  <td className="ev-cell-num">{formatEntier(imprimes ?? 0)}</td>
                  <td className="ev-cell-num">{formatEntier(livres ?? 0)}</td>
                  {ETAPES.map((e) => (
                    <td key={e.cle} className="ev-cell-num">
                      {formatDuree(production.data!.delais[e.cle].heures_moyennes)}
                      <span className="adm-sub">{production.data!.delais[e.cle].nb} mesuré(s)</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card title="Meilleurs clients" flush>
          {top.isError ? (
            <div style={{ padding: 'var(--space-4)' }}>
              <Alert tone="error">Le classement n’a pas pu être chargé : {messageErreur(top.error)}</Alert>
            </div>
          ) : !top.data ? (
            <div style={{ padding: 'var(--space-4)' }}>
              <Skeleton h={200} />
            </div>
          ) : top.data.length === 0 ? (
            <p className="ev-muted" style={{ padding: 'var(--space-5)', margin: 0 }}>
              Aucun dossier créé sur cette période.
            </p>
          ) : (
            <TopClients data={top.data} total={totaux?.montant ?? null} />
          )}
        </Card>

        <Card title="Activité par personne" flush>
          {!production.data ? (
            <div style={{ padding: 'var(--space-4)' }}>{production.isError ? <span className="ev-muted">—</span> : <Skeleton h={200} />}</div>
          ) : production.data.par_utilisateur.length === 0 ? (
            <p className="ev-muted" style={{ padding: 'var(--space-5)', margin: 0 }}>
              Aucune action sur les dossiers pendant cette période.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ev-table adm-dense">
                <thead>
                  <tr>
                    <th>Personne</th>
                    <th className="adm-num-th">Actions</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {production.data.par_utilisateur.map((u) => (
                    <tr key={u.user_id}>
                      <td className="nowrap">
                        {u.nom}
                        <span className="adm-sub">{ROLE_LABELS[u.role] ?? u.role}</span>
                      </td>
                      <td className="ev-cell-num">{formatEntier(u.nb_actions)}</td>
                      <td style={{ fontSize: 13 }} className="ev-muted">
                        {Object.entries(u.actions)
                          .sort((a, b) => b[1] - a[1])
                          .map(([a, n]) => `${n} ${(ACTIVITE[a] ?? [a.replace(/_/g, ' '), a.replace(/_/g, ' ')])[n > 1 ? 1 : 0]}`)
                          .join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function TopClients({ data, total }: { data: TopClient[]; total: number | null }) {
  const max = Math.max(...data.map((c) => c.montant), 1);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ev-table adm-dense">
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Client</th>
            <th className="adm-num-th">Dossiers</th>
            <th className="adm-num-th">Montant</th>
            <th style={{ width: '22%' }}>
              <span className="sr-only">Part</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={`${c.client_id ?? c.nom}-${i}`}>
              <td className="ev-num ev-muted">{i + 1}</td>
              <td>
                {c.client_id ? (
                  <Link to={`/clients/${c.client_id}`} className="ev-link">
                    {c.nom}
                  </Link>
                ) : (
                  c.nom
                )}
              </td>
              <td className="ev-cell-num">{formatEntier(c.nb)}</td>
              <td className="ev-cell-num">{formatFCFA(c.montant)}</td>
              <td>
                <div className="adm-meter" title={total ? `${Math.round((c.montant / total) * 100)} % du montant commandé` : undefined}>
                  <span style={{ width: `${Math.max(2, Math.round((c.montant / max) * 100))}%` }} />
                </div>
                {total ? <span className="adm-sub">{Math.round((c.montant / total) * 100)} % du total</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
