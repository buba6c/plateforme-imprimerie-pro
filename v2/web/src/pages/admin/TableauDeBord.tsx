import { useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  FilePen,
  Flame,
  Plus,
  Printer,
  RotateCcw,
  Truck,
  Wallet,
  type LucideProps,
} from 'lucide-react';
import { formatEntier, formatFCFA, MACHINE_LABELS, type Statut } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierResume, ListeDossiers } from '../../lib/types';
import { useUser } from '../../auth/AuthContext';
import { Alert, MachineIcone, Segmented, Skeleton } from '../../ui';
import { EvolutionChart } from '../../features/admin/charts';
import { ajouterJours, bornesPeriode, jourFr, joursEntre, PERIODE_LABELS } from '../../features/admin/dates';
import { useAujourdhui } from '../../features/admin/hooks';
import type { Apercu, Pas, Periode, PointEvolution } from '../../features/admin/types';
import '../../features/admin/admin.css';
import '../../features/admin/mur.css';

type Icone = ComponentType<LucideProps>;

const STATUTS_ACTIFS: Statut[] = ['en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'pret_livraison', 'en_livraison'];

/** Les trois couloirs du mur, chacun avec ses statuts et des mots de tous les jours. */
const COULOIRS: { id: string; titre: string; aide: string; icone: Icone; statuts: Statut[] }[] = [
  { id: 'preparation', titre: 'Préparation', aide: 'Fichiers à préparer et à valider', icone: FilePen, statuts: ['a_revoir', 'en_cours'] },
  { id: 'impression', titre: 'Impression', aide: 'Travaux sur les machines Roland et Xerox', icone: Printer, statuts: ['en_impression', 'pret_impression'] },
  { id: 'livraison', titre: 'Livraison', aide: 'Prêts à partir ou en route vers le client', icone: Truck, statuts: ['en_livraison', 'pret_livraison'] },
];

/** Étiquette courte et prochaine étape, en mots simples, pour chaque statut en cours. */
const EN_CLAIR: Record<string, { etiquette: string; suite: (d: DossierResume) => string }> = {
  en_cours: { etiquette: 'À préparer', suite: (d) => (d.nb_fichiers ? 'À valider pour l’impression' : 'En attente des fichiers du client') },
  a_revoir: { etiquette: 'À corriger', suite: (d) => (d.commentaire_revision ? `À corriger : ${d.commentaire_revision}` : 'Renvoyé au préparateur pour correction') },
  pret_impression: { etiquette: 'À imprimer', suite: (d) => `Attend l’imprimeur ${MACHINE_LABELS[d.machine]}` },
  en_impression: { etiquette: 'Sur la machine', suite: (d) => `En cours d’impression sur la ${MACHINE_LABELS[d.machine]}` },
  pret_livraison: { etiquette: 'Prêt à partir', suite: () => 'À confier au livreur' },
  en_livraison: {
    etiquette: 'En route',
    suite: (d) => (d.livraison_prevue_at ? `Livraison prévue le ${jourFr(d.livraison_prevue_at)}` : `Chez le livreur${d.livreur_nom ? ` (${d.livreur_nom})` : ''}`),
  },
};

const FICHES_PAR_COULOIR = 5;

const PERIODE_COURTE: Record<Periode, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois', annee: 'Année' };

function nb(n: number | undefined | null): string {
  return n === undefined || n === null ? '—' : formatEntier(n);
}

function pluriel(n: number, un: string, plusieurs: string) {
  return n > 1 ? plusieurs : un;
}

function salutation(): string {
  const h = new Date().getHours();
  return h < 13 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export default function TableauDeBord() {
  const user = useUser();
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

  const a = apercu.data;
  const dossiers = actifs.data?.items;
  const enRetard = (d: DossierResume) => !!d.date_promise && d.date_promise.slice(0, 10) < today;

  const aimants: Aimant[] = [
    {
      id: 'paiements',
      icone: Wallet,
      n: a?.a_valider.nb,
      phrase: (n) => `${pluriel(n, 'paiement encaissé attend', 'paiements encaissés attendent')} ta vérification`,
      detail: a && a.a_valider.nb ? `${formatFCFA(a.a_valider.montant)} au total` : undefined,
      calme: 'Aucun paiement à vérifier',
      lien: '/paiements',
      action: 'Vérifier les paiements',
    },
    {
      id: 'retards',
      icone: CalendarClock,
      n: a?.retards.nb,
      phrase: (n) => `${pluriel(n, 'commande a', 'commandes ont')} dépassé la date promise au client`,
      calme: 'Aucune commande en retard',
      lien: '/dossiers?tri=priorite',
      action: 'Voir les retards',
      ton: 'retard',
    },
    {
      id: 'corriger',
      icone: RotateCcw,
      n: a?.production.par_statut.a_revoir,
      phrase: (n) => `${pluriel(n, 'dossier renvoyé', 'dossiers renvoyés')} au préparateur pour correction`,
      calme: 'Aucun dossier à corriger',
      lien: '/dossiers?statut=a_revoir',
      action: 'Voir les corrections',
    },
    {
      id: 'urgents',
      icone: Flame,
      n: a?.urgents.nb,
      phrase: (n) => `${pluriel(n, 'commande urgente', 'commandes urgentes')} en cours`,
      calme: 'Aucune urgence en cours',
      lien: '/dossiers?urgent=1',
      action: 'Voir les urgences',
    },
  ];
  const aFaire = aimants.filter((x) => (x.n ?? 0) > 0).length;
  const enCours = dossiers?.length ?? actifs.data?.total;

  return (
    <div className="mur">
      <header className="mur__entete">
        <div>
          <h1 className="mur__titre">
            {salutation()}, {user.nom.split(' ')[0]}
          </h1>
          <p className="mur__resume">
            {a === undefined || enCours === undefined ? (
              'Chargement de l’atelier…'
            ) : (
              <>
                {formatEntier(enCours)} {pluriel(enCours, 'commande en cours', 'commandes en cours')} dans l’atelier.{' '}
                {aFaire === 0 ? 'Rien ne demande ton attention.' : `${aFaire} ${pluriel(aFaire, 'point demande', 'points demandent')} ton attention.`}
              </>
            )}
          </p>
        </div>
        <Link to="/dossiers/nouveau" className="ev-btn ev-btn--primary ev-btn--lg">
          <Plus aria-hidden="true" />
          Nouvelle commande
        </Link>
      </header>

      {(apercu.isError || actifs.isError) && (
        <Alert tone="error">
          Une partie du tableau n’a pas pu être chargée : {messageErreur(apercu.error ?? actifs.error)} Réessaie dans un instant ; les chiffres inconnus
          sont affichés « — ».
        </Alert>
      )}

      <section className="mur__aimants" aria-label="À faire maintenant">
        <h2 className="mur__bande-titre">À faire maintenant</h2>
        <div className="mur__aimants-liste">
          {aimants.map((x, i) => (
            <CarteAimant key={x.id} index={i} aimant={x} chargement={apercu.isLoading} />
          ))}
        </div>
      </section>

      <section className="mur__tableau" aria-label="L’atelier en ce moment">
        {COULOIRS.map((c) => {
          const fiches = (dossiers ?? []).filter((d) => c.statuts.includes(d.statut));
          fiches.sort((x, y) => Number(y.urgent) - Number(x.urgent) || Number(enRetard(y)) - Number(enRetard(x)) || c.statuts.indexOf(x.statut) - c.statuts.indexOf(y.statut));
          const total = a ? c.statuts.reduce((s, st) => s + (a.production.par_statut[st] ?? 0), 0) : fiches.length;
          return (
            <Couloir
              key={c.id}
              id={c.id}
              titre={c.titre}
              aide={c.aide}
              icone={c.icone}
              total={dossiers || a ? total : undefined}
              lien={`/dossiers?statut=${c.statuts.join(',')}`}
            >
              {dossiers === undefined ? (
                <>
                  <Skeleton h={96} />
                  <Skeleton h={96} />
                </>
              ) : fiches.length === 0 ? (
                <p className="mur__vide">
                  <CircleCheck aria-hidden="true" />
                  Rien en {c.titre.toLowerCase()} pour le moment.
                </p>
              ) : (
                fiches.slice(0, FICHES_PAR_COULOIR).map((d, i) => <Fiche key={d.id} index={i} d={d} today={today} retard={enRetard(d)} />)
              )}
              {fiches.length > FICHES_PAR_COULOIR && (
                <Link to={`/dossiers?statut=${c.statuts.join(',')}`} className="mur__plus">
                  Voir les {fiches.length - FICHES_PAR_COULOIR} autres
                  <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </Couloir>
          );
        })}

        <Couloir id="argent" titre="Argent" aide={`Ce qui est rentré : ${PERIODE_LABELS[periode].toLowerCase()}`} icone={Wallet}>
          <div className="mur__periode">
            <Segmented<Periode>
              name="periode"
              label="Période"
              value={periode}
              onChange={setPeriode}
              options={(Object.keys(PERIODE_LABELS) as Periode[]).map((p) => ({ value: p, label: PERIODE_COURTE[p] }))}
            />
          </div>
          <Somme titre="Encaissé et vérifié" valeur={a?.encaisse.montant} detail={a ? `${formatEntier(a.encaisse.nb)} ${pluriel(a.encaisse.nb, 'paiement', 'paiements')}` : undefined} />
          <Somme
            titre="Remis par l’équipe, à vérifier"
            valeur={a?.a_valider.montant}
            detail={a ? `${formatEntier(a.a_valider.nb)} ${pluriel(a.a_valider.nb, 'paiement', 'paiements')}` : undefined}
            lien="/paiements"
            attention={!!a?.a_valider.nb}
          />
          <Somme
            titre="Livré, pas encore payé"
            valeur={a?.reste_a_encaisser.montant}
            detail={a?.reste_a_encaisser.nb_dossiers !== undefined ? `${formatEntier(a.reste_a_encaisser.nb_dossiers)} ${pluriel(a.reste_a_encaisser.nb_dossiers, 'commande', 'commandes')}` : undefined}
          />
          <Somme titre="Commandé" valeur={a?.commandes.montant} detail={a ? `${formatEntier(a.commandes.nb)} ${pluriel(a.commandes.nb, 'commande', 'commandes')}` : undefined} />
        </Couloir>
      </section>

      <section className="mur__courbe" aria-label="Commandes et encaissements">
        <header className="mur__courbe-tete">
          <h2 className="mur__section-titre">Commandes et encaissements · {titreGraphe}</h2>
          <Link to="/statistiques" className="ev-btn ev-btn--ghost ev-btn--sm">
            Toutes les statistiques
            <ArrowRight aria-hidden="true" />
          </Link>
        </header>
        {evolution.isError ? (
          <Alert tone="error">La courbe n’a pas pu être chargée : {messageErreur(evolution.error)}</Alert>
        ) : evolution.isLoading ? (
          <Skeleton h={240} />
        ) : evolution.data && evolution.data.length ? (
          <EvolutionChart data={evolution.data} pas={pas} height={220} />
        ) : (
          <p className="ev-muted">Aucune commande ni aucun paiement sur cette période.</p>
        )}
      </section>
    </div>
  );
}

function grapheDe(periode: Periode, today: string): { from: string; to: string; pas: Pas; titreGraphe: string } {
  if (periode === 'jour') return { from: ajouterJours(today, -13), to: today, pas: 'jour', titreGraphe: '14 derniers jours' };
  const b = bornesPeriode(periode, today);
  if (periode === 'annee') return { ...b, pas: 'mois', titreGraphe: `${PERIODE_LABELS.annee.toLowerCase()}, par mois` };
  return { ...b, pas: 'jour', titreGraphe: `${PERIODE_LABELS[periode].toLowerCase()}, par jour` };
}

interface Aimant {
  id: string;
  icone: Icone;
  n: number | undefined;
  phrase: (n: number) => string;
  detail?: string;
  calme: string;
  lien: string;
  action: string;
  ton?: 'retard';
}

function CarteAimant({ aimant: x, chargement, index }: { aimant: Aimant; chargement: boolean; index: number }) {
  const i = { '--i': index } as React.CSSProperties;
  const Ic = x.icone;
  if (chargement) return <Skeleton h={132} />;
  if (!x.n) {
    return (
      <div className="aimant aimant--calme" style={i}>
        <CircleCheck aria-hidden="true" />
        <span>{x.n === undefined ? '—' : x.calme}</span>
      </div>
    );
  }
  return (
    <Link to={x.lien} className="aimant" data-ton={x.ton} style={i}>
      <span className="aimant__pastille" aria-hidden="true">
        <Ic />
      </span>
      <span className="aimant__n">{formatEntier(x.n)}</span>
      <span className="aimant__phrase">{x.phrase(x.n)}</span>
      {x.detail && <span className="aimant__detail">{x.detail}</span>}
      <span className="aimant__action">
        {x.action}
        <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}

function Couloir({
  id,
  titre,
  aide,
  icone: Ic,
  total,
  lien,
  children,
}: {
  id: string;
  titre: string;
  aide: string;
  icone: Icone;
  total?: number;
  lien?: string;
  children: React.ReactNode;
}) {
  const tete = (
    <>
      <span className="couloir__icone" aria-hidden="true">
        <Ic />
      </span>
      <span className="couloir__noms">
        <span className="couloir__titre">{titre}</span>
        <span className="couloir__aide">{aide}</span>
      </span>
      {total !== undefined && <span className="couloir__total">{nb(total)}</span>}
    </>
  );
  return (
    <section className="couloir" data-couloir={id} aria-label={titre}>
      {lien ? (
        <Link to={lien} className="couloir__tete" title={`Voir toutes les commandes en ${titre.toLowerCase()}`}>
          {tete}
        </Link>
      ) : (
        <div className="couloir__tete">{tete}</div>
      )}
      <div className="couloir__corps">{children}</div>
    </section>
  );
}

function Fiche({ d, today, retard, index }: { d: DossierResume; today: string; retard: boolean; index: number }) {
  const clair = EN_CLAIR[d.statut];
  const jours = d.date_promise ? joursEntre(d.date_promise.slice(0, 10), today) : 0;
  const echeance = !d.date_promise
    ? 'Pas de date promise'
    : retard
      ? `En retard de ${jours} ${pluriel(jours, 'jour', 'jours')}`
      : d.date_promise.slice(0, 10) === today
        ? 'À rendre aujourd’hui'
        : `Pour le ${jourFr(d.date_promise)}`;
  return (
    <Link to={`/dossiers/${d.id}`} className="fiche" data-statut={d.statut} style={{ '--i': index + 2 } as React.CSSProperties}>
      <span className="fiche__haut">
        <span className="fiche__etiquette">{clair?.etiquette ?? d.statut_label}</span>
        {d.urgent && <span className="fiche__urgent">Urgent</span>}
        <span className="fiche__numero">{d.numero}</span>
      </span>
      <span className="fiche__client">{d.client_nom}</span>
      <span className="fiche__travail">{d.resume_specs || d.description || `Impression ${MACHINE_LABELS[d.machine]}`}</span>
      <span className="fiche__suite">{clair ? clair.suite(d) : d.statut_label}</span>
      <span className="fiche__bas">
        <span className="fiche__machine" data-machine={d.machine}>
          <MachineIcone machine={d.machine} taille={12} />
          {MACHINE_LABELS[d.machine]}
        </span>
        <span className="fiche__echeance" data-retard={retard || undefined}>
          {echeance}
        </span>
      </span>
    </Link>
  );
}

function Somme({ titre, valeur, detail, lien, attention }: { titre: string; valeur: number | undefined; detail?: string; lien?: string; attention?: boolean }) {
  const contenu = (
    <>
      <span className="somme__titre">{titre}</span>
      <span className="somme__valeur">
        {valeur === undefined ? '—' : formatEntier(valeur)}
        {valeur !== undefined && <small> FCFA</small>}
      </span>
      {detail && <span className="somme__detail">{detail}</span>}
    </>
  );
  return lien ? (
    <Link to={lien} className="somme" data-attention={attention || undefined}>
      {contenu}
    </Link>
  ) : (
    <div className="somme">{contenu}</div>
  );
}
