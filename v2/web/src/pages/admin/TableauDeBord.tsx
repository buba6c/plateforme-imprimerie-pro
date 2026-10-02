import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, CircleAlert, Flame, RotateCcw, Wallet } from 'lucide-react';
import {
  ETAPE_LABELS,
  formatEntier,
  formatFCFA,
  MACHINE_LABELS,
  MACHINES,
  MODE_PAIEMENT_LABELS,
  STATUT_ETAPE,
  STATUT_LABELS,
  type Etape,
  type Statut,
} from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierResume, ListeDossiers } from '../../lib/types';
import { Alert, Card, Kpi, PageHeader, Ref, Segmented, Skeleton, StatusBadge, UrgentTag } from '../../ui';
import { EvolutionChart } from '../../features/admin/charts';
import { ajouterJours, bornesPeriode, jourFr, joursEntre, PERIODE_LABELS } from '../../features/admin/dates';
import { useAujourdhui } from '../../features/admin/hooks';
import type { Apercu, ListePaiements, Pas, Periode, PointEvolution } from '../../features/admin/types';
import '../../features/admin/admin.css';

const STATUTS_ACTIFS: Statut[] = ['en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'pret_livraison', 'en_livraison'];
const ETAPES_SUIVIES: Etape[] = ['preparation', 'impression', 'livraison'];

function nb(n: number | undefined | null): string {
  return n === undefined || n === null ? '—' : formatEntier(n);
}

function pluriel(n: number, un: string, plusieurs: string) {
  return n > 1 ? plusieurs : un;
}

export default function TableauDeBord() {
  const [periode, setPeriode] = useState<Periode>('mois');
  const today = useAujourdhui();

  const apercu = useQuery({
    queryKey: ['stats', 'apercu', periode],
    queryFn: () => api.get<Apercu>('/stats/apercu', { periode }),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

  const { from, to, pas, titreGraphe } = grapheDe(periode, today);
  const evolution = useQuery({
    queryKey: ['stats', 'evolution', from, to, pas],
    queryFn: () => api.get<PointEvolution[]>('/stats/evolution', { from, to, pas }),
    placeholderData: (prev) => prev,
  });

  const actifs = useQuery({
    queryKey: ['dossiers', 'tableau-de-bord', 'actifs'],
    queryFn: () => api.get<ListeDossiers>('/dossiers', { statut: STATUTS_ACTIFS, limit: 200, tri: 'priorite' }),
    refetchInterval: 60_000,
  });

  const aValider = useQuery({
    queryKey: ['paiements', 'tableau-de-bord'],
    queryFn: () => api.get<ListePaiements>('/paiements', { statut: 'a_valider', limit: 4 }),
    refetchInterval: 60_000,
  });

  const a = apercu.data;
  const chargement = apercu.isLoading;
  const enAttente = a?.a_valider.nb ?? aValider.data?.total;
  const enAttenteSomme = a?.a_valider.montant ?? aValider.data?.somme;

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        subtitle={a ? `${PERIODE_LABELS[periode]} : du ${jourFr(a.du)} au ${jourFr(a.au)}` : PERIODE_LABELS[periode]}
        actions={
          <div className="adm-period">
            <Segmented<Periode>
              name="periode"
              label="Période"
              value={periode}
              onChange={setPeriode}
              options={(Object.keys(PERIODE_LABELS) as Periode[]).map((p) => ({ value: p, label: PERIODE_LABELS[p] }))}
            />
          </div>
        }
      />

      {apercu.isError && (
        <Alert tone="error">Les indicateurs n'ont pas pu être chargés : {messageErreur(apercu.error)} Les chiffres inconnus sont affichés « — ».</Alert>
      )}

      <div className="ev-kpis adm-kpis" style={{ opacity: apercu.isFetching && !chargement ? 0.6 : 1 }}>
        <Kpi
          label="Commandes"
          value={chargement ? <Skeleton h={32} w={80} /> : nb(a?.commandes.nb)}
          meta={a ? `${formatFCFA(a.commandes.montant)} commandés` : '—'}
        />
        <Kpi
          label="Encaissé"
          value={chargement ? <Skeleton h={32} w={120} /> : a ? formatEntier(a.encaisse.montant) : '—'}
          unit={a ? 'FCFA' : undefined}
          meta={a ? `${formatEntier(a.encaisse.nb)} ${pluriel(a.encaisse.nb, 'paiement validé', 'paiements validés')}` : '—'}
        />
        <Link to="/paiements" className="adm-kpi-link" aria-label={`À valider : ${nb(enAttente)} paiement(s), ouvrir les paiements`}>
          <Kpi
            label="À valider"
            value={chargement && enAttenteSomme === undefined ? <Skeleton h={32} w={120} /> : enAttenteSomme === undefined ? '—' : formatEntier(enAttenteSomme)}
            unit={enAttenteSomme === undefined ? undefined : 'FCFA'}
            alert={!!enAttente}
            meta={
              enAttente === undefined ? (
                '—'
              ) : enAttente > 0 ? (
                <span className="row" style={{ gap: 4 }}>
                  {enAttente} {pluriel(enAttente, 'paiement à contrôler', 'paiements à contrôler')} <ArrowRight size={14} aria-hidden="true" />
                </span>
              ) : (
                'Aucun paiement en attente'
              )
            }
          />
        </Link>
        <Kpi
          label="Reste à encaisser"
          value={chargement ? <Skeleton h={32} w={120} /> : a ? formatEntier(a.reste_a_encaisser.montant) : '—'}
          unit={a ? 'FCFA' : undefined}
          meta={
            a
              ? a.reste_a_encaisser.nb_dossiers !== undefined
                ? `${formatEntier(a.reste_a_encaisser.nb_dossiers)} ${pluriel(a.reste_a_encaisser.nb_dossiers, 'dossier livré non soldé', 'dossiers livrés non soldés')}`
                : 'Dossiers livrés non soldés'
              : '—'
          }
        />
      </div>

      <div className="grid-main">
        <div className="stack-lg">
          <Card
            title="Production en cours"
            actions={
              <Link to="/dossiers" className="ev-btn ev-btn--ghost ev-btn--sm">
                Voir les dossiers
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          >
            <BandeProduction apercu={a} loading={chargement} />
          </Card>

          <Card
            title={`Commandé et encaissé · ${titreGraphe}`}
            actions={
              <Link to="/statistiques" className="ev-btn ev-btn--ghost ev-btn--sm">
                Ouvrir les statistiques
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          >
            {evolution.isError ? (
              <Alert tone="error">L'évolution n'a pas pu être chargée : {messageErreur(evolution.error)}</Alert>
            ) : evolution.isLoading ? (
              <Skeleton h={260} />
            ) : evolution.data && evolution.data.length ? (
              <div style={{ opacity: evolution.isFetching ? 0.6 : 1 }}>
                <EvolutionChart data={evolution.data} pas={pas} height={240} />
              </div>
            ) : (
              <p className="ev-muted">Aucune donnée sur cette période.</p>
            )}
          </Card>
        </div>

        <ASurveiller
          today={today}
          apercu={a}
          dossiers={actifs.data?.items}
          totalActifs={actifs.data?.total}
          dossiersErreur={actifs.isError ? messageErreur(actifs.error) : null}
          paiements={aValider.data}
          paiementsErreur={aValider.isError ? messageErreur(aValider.error) : null}
          enAttente={enAttente}
          enAttenteSomme={enAttenteSomme}
        />
      </div>
    </>
  );
}

function grapheDe(periode: Periode, today: string): { from: string; to: string; pas: Pas; titreGraphe: string } {
  if (periode === 'jour') return { from: ajouterJours(today, -13), to: today, pas: 'jour', titreGraphe: '14 derniers jours' };
  const b = bornesPeriode(periode, today);
  if (periode === 'annee') return { ...b, pas: 'mois', titreGraphe: `${PERIODE_LABELS.annee.toLowerCase()}, par mois` };
  return { ...b, pas: 'jour', titreGraphe: `${PERIODE_LABELS[periode].toLowerCase()}, par jour` };
}

function lienDossiers(statut: Statut, machine?: string) {
  const p = new URLSearchParams({ statut });
  if (machine) p.set('machine', machine);
  return `/dossiers?${p.toString()}`;
}

function BandeProduction({ apercu, loading }: { apercu: Apercu | undefined; loading: boolean }) {
  if (loading) return <Skeleton h={120} />;
  const ps = apercu?.production.par_statut;
  const pm = apercu?.production.par_machine;
  return (
    <div className="adm-strip">
      {ETAPES_SUIVIES.map((etape) => {
        const statuts = STATUTS_ACTIFS.filter((s) => STATUT_ETAPE[s] === etape);
        const total = ps ? statuts.reduce((s, st) => s + (ps[st] ?? 0), 0) : undefined;
        return (
          <section key={etape} className="adm-strip__etape" aria-label={ETAPE_LABELS[etape]}>
            <header className="adm-strip__head">
              <h3 className="section-title">{ETAPE_LABELS[etape]}</h3>
              <span className="ev-num ev-muted">{nb(total)}</span>
            </header>
            <div className="adm-strip__cells">
              {statuts.map((st) => {
                const n = ps?.[st];
                return (
                  <div key={st} className="adm-strip__cell" data-vide={n === 0 || undefined}>
                    <Link to={lienDossiers(st)} className="adm-strip__main">
                      <StatusBadge statut={st} />
                      <span className="adm-strip__n">{nb(n)}</span>
                    </Link>
                    <div className="adm-strip__machines">
                      {MACHINES.map((m) => (
                        <Link key={m} to={lienDossiers(st, m)} className="adm-strip__machine">
                          {MACHINE_LABELS[m]} <span className="ev-num">{nb(pm?.[m]?.[st])}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface SurveillerProps {
  today: string;
  apercu: Apercu | undefined;
  dossiers: DossierResume[] | undefined;
  totalActifs: number | undefined;
  dossiersErreur: string | null;
  paiements: ListePaiements | undefined;
  paiementsErreur: string | null;
  enAttente: number | undefined;
  enAttenteSomme: number | undefined;
}

const MAX_LIGNES = 4;

function ASurveiller({ today, apercu, dossiers, totalActifs, dossiersErreur, paiements, paiementsErreur, enAttente, enAttenteSomme }: SurveillerProps) {
  const complet = dossiers !== undefined && totalActifs !== undefined && dossiers.length >= totalActifs;
  const urgents = dossiers?.filter((d) => d.urgent) ?? [];
  const retards = (dossiers?.filter((d) => d.date_promise && d.date_promise.slice(0, 10) < today) ?? []).sort((x, y) =>
    (x.date_promise ?? '').localeCompare(y.date_promise ?? ''),
  );
  const revisions = dossiers?.filter((d) => d.statut === 'a_revoir') ?? [];
  const nUrgents = apercu?.urgents.nb ?? (complet ? urgents.length : undefined);
  const nRetards = apercu?.retards.nb ?? (complet ? retards.length : undefined);
  const nRevisions = apercu?.production.par_statut.a_revoir ?? (complet ? revisions.length : undefined);

  return (
    <Card title="À surveiller" bodyClassName="adm-watch" flush>
      {dossiersErreur && (
        <div style={{ padding: 'var(--space-4)' }}>
          <Alert tone="error">Les dossiers n'ont pas pu être chargés : {dossiersErreur}</Alert>
        </div>
      )}
      <Bloc
        icon={<Flame aria-hidden="true" />}
        titre="Urgents"
        n={nUrgents}
        lien="/dossiers?urgent=1"
        lienLabel="Voir les dossiers urgents"
        vide="Aucun dossier urgent en cours."
        loading={dossiers === undefined && !dossiersErreur}
      >
        {urgents.slice(0, MAX_LIGNES).map((d) => (
          <LigneDossier key={d.id} d={d} detail={d.date_promise ? `Promis le ${jourFr(d.date_promise)}` : 'Sans date promise'} />
        ))}
      </Bloc>
      <Bloc
        icon={<CalendarClock aria-hidden="true" />}
        titre="En retard"
        aide="Date promise dépassée, pas encore livré"
        n={nRetards}
        lien={retards.length > MAX_LIGNES ? '/dossiers?tri=priorite' : undefined}
        lienLabel="Voir la file par priorité"
        vide="Aucun dossier en retard."
        alert
        loading={dossiers === undefined && !dossiersErreur}
      >
        {retards.slice(0, MAX_LIGNES).map((d) => {
          const j = joursEntre(d.date_promise!.slice(0, 10), today);
          return <LigneDossier key={d.id} d={d} detail={`Promis le ${jourFr(d.date_promise)} · ${j} ${pluriel(j, 'jour', 'jours')} de retard`} tone="alert" />;
        })}
      </Bloc>
      <Bloc
        icon={<RotateCcw aria-hidden="true" />}
        titre="Révisions en attente"
        aide="Renvoyés au préparateur"
        n={nRevisions}
        lien="/dossiers?statut=a_revoir"
        lienLabel="Voir les dossiers à revoir"
        vide="Aucune révision en attente."
        loading={dossiers === undefined && !dossiersErreur}
      >
        {revisions.slice(0, MAX_LIGNES).map((d) => (
          <LigneDossier key={d.id} d={d} detail={d.commentaire_revision ?? d.preparateur_nom ?? ''} />
        ))}
      </Bloc>
      <Bloc
        icon={<Wallet aria-hidden="true" />}
        titre="Paiements à valider"
        aide={enAttenteSomme ? `${formatFCFA(enAttenteSomme)} au total` : undefined}
        n={enAttente}
        lien="/paiements"
        lienLabel="Ouvrir la validation des paiements"
        vide="Aucun paiement à valider."
        alert
        loading={paiements === undefined && !paiementsErreur}
      >
        {paiementsErreur && <Alert tone="error">{paiementsErreur}</Alert>}
        {paiements?.items.map((p) => (
          <Link key={p.id} to={`/dossiers/${p.dossier_id}`} className="adm-watch__item">
            <span className="adm-watch__line">
              <Ref>{p.numero}</Ref>
              <span className="truncate grow">{p.client_nom}</span>
              <span className="ev-num">{formatFCFA(p.montant)}</span>
            </span>
            <span className="adm-watch__meta">
              {MODE_PAIEMENT_LABELS[p.mode]} · encaissé par {p.encaisse_par_nom ?? '—'}
            </span>
          </Link>
        ))}
      </Bloc>
    </Card>
  );
}

function Bloc({
  icon,
  titre,
  aide,
  n,
  lien,
  lienLabel,
  vide,
  alert,
  loading,
  children,
}: {
  icon: ReactNode;
  titre: string;
  aide?: string;
  n: number | undefined;
  lien?: string;
  lienLabel: string;
  vide: string;
  alert?: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  const reste = n !== undefined ? n - Math.min(n, MAX_LIGNES) : 0;
  return (
    <section className="adm-watch__bloc" data-alert={alert && !!n ? true : undefined}>
      <header className="adm-watch__head">
        <span className="adm-watch__icon">{icon}</span>
        <div className="grow">
          <h3 className="adm-watch__title">{titre}</h3>
          {aide && <p className="adm-watch__aide">{aide}</p>}
        </div>
        <span className="adm-watch__n ev-num">{nb(n)}</span>
      </header>
      {loading ? <Skeleton h={36} /> : n === 0 ? <p className="adm-watch__vide">{vide}</p> : <div className="adm-watch__list">{children}</div>}
      {!!n && lien && (
        <Link to={lien} className="adm-watch__more">
          {reste > 0 ? `${lienLabel} (${reste} de plus)` : lienLabel}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function LigneDossier({ d, detail, tone }: { d: DossierResume; detail: string; tone?: 'alert' }) {
  return (
    <Link to={`/dossiers/${d.id}`} className="adm-watch__item">
      <span className="adm-watch__line">
        <Ref>{d.numero}</Ref>
        <span className="truncate grow">{d.client_nom}</span>
        {d.urgent && <UrgentTag />}
      </span>
      <span className="adm-watch__meta" data-tone={tone}>
        {tone === 'alert' && <CircleAlert size={12} aria-hidden="true" />}
        <StatusBadgeMini statut={d.statut} /> {detail}
      </span>
    </Link>
  );
}

function StatusBadgeMini({ statut }: { statut: Statut }) {
  return (
    <span className="adm-mini-status" data-statut={statut}>
      {STATUT_LABELS[statut]}
    </span>
  );
}
