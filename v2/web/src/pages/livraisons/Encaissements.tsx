// Encaissements : les paiements que la personne connectée (livreur ou préparateur) a encaissés,
// avec leur état de validation par l'administrateur. L'API ne renvoie que les siens.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Banknote, RotateCw } from 'lucide-react';
import { formatFCFA, formatHeure, MODE_PAIEMENT_LABELS, type StatutPaiement } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { debutJour, isoJour, libelleRendezVous } from '../../features/livraisons/dates';
import type { ListePaiements, PaiementLigne } from '../../features/livraisons/hooks';
import { Resume } from '../../features/livraisons/Resume';
import '../../features/livraisons/livraisons.css';
import { api, ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, PaiementStatutBadge, Pagination, Ref, Segmented, Tabs } from '../../ui';

type Periode = 'jour' | 'semaine' | 'mois';
type Filtre = 'tous' | StatutPaiement;

const LIMITE = 30;
const STATUTS: StatutPaiement[] = ['a_valider', 'valide', 'refuse'];

function bornes(p: Periode): { from: string; to: string } {
  const auj = debutJour();
  const from = new Date(auj);
  if (p === 'semaine') from.setDate(from.getDate() - 6);
  if (p === 'mois') from.setDate(1);
  return { from: isoJour(from), to: isoJour(auj) };
}

const PERIODE_LIBELLE: Record<Periode, string> = { jour: "aujourd'hui", semaine: 'ces 7 derniers jours', mois: 'ce mois-ci' };

function quand(iso: string, periode: Periode): string {
  return periode === 'jour' ? `à ${formatHeure(iso)}` : libelleRendezVous(iso).replace(/^\S/, (c) => c.toLowerCase());
}

function LignePaiement({ p, periode }: { p: PaiementLigne; periode: Periode }) {
  const contenu = (
    <>
      <span className="lv-ligne__haut">
        <span className="lv-ligne__titre">{p.client_nom}</span>
        <Ref>{p.numero}</Ref>
      </span>
      <span className="lv-paiement__meta">
        <span>{MODE_PAIEMENT_LABELS[p.mode]}</span>
        {p.reference && (
          <span>
            Réf. <span className="ev-ref">{p.reference}</span>
          </span>
        )}
        <span>Encaissé {quand(p.encaisse_at, periode)}</span>
        {p.statut !== 'a_valider' && p.valide_at && (
          <span>
            {p.statut === 'valide' ? 'Validé' : 'Refusé'} {quand(p.valide_at, 'semaine')}
            {p.valide_par_nom ? ` par ${p.valide_par_nom}` : ''}
          </span>
        )}
      </span>
    </>
  );
  return (
    <li className="lv-ligne">
      {p.dossier_supprime ? (
        <div className="lv-ligne__lien">{contenu}</div>
      ) : (
        <Link to={`/dossiers/${p.dossier_id}`} className="lv-ligne__lien">
          {contenu}
        </Link>
      )}
      <div className="lv-ligne__droite">
        <span className="ev-num lv-ligne__montant">{formatFCFA(p.montant)}</span>
        <PaiementStatutBadge statut={p.statut} />
      </div>
      {p.statut === 'refuse' && (
        <p className="lv-refus" style={{ gridColumn: '1 / -1' }}>
          Motif du refus : {p.motif_refus || 'non précisé'}
        </p>
      )}
    </li>
  );
}

export default function Encaissements() {
  const user = useUser();
  const [periode, setPeriode] = useState<Periode>('semaine');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [page, setPage] = useState(1);
  const b = useMemo(() => bornes(periode), [periode]);

  const totaux = useQueries({
    queries: STATUTS.map((statut) => ({
      queryKey: ['paiements', 'mes', b, statut, 'total'],
      queryFn: () => api.get<ListePaiements>('/paiements', { ...b, statut, limit: 1 }),
      retry: false,
    })),
  });
  const liste = useQuery({
    queryKey: ['paiements', 'mes', b, filtre, page],
    queryFn: () => api.get<ListePaiements>('/paiements', { ...b, statut: filtre === 'tous' ? undefined : filtre, page, limit: LIMITE }),
    placeholderData: (prev) => prev,
    retry: false,
  });

  const erreur = liste.error ?? totaux.find((t) => t.error)?.error ?? null;
  const indisponible = erreur instanceof ApiError && erreur.status === 404;
  const t = Object.fromEntries(STATUTS.map((s, i) => [s, totaux[i]?.data])) as Record<StatutPaiement, ListePaiements | undefined>;
  const nb = (s: StatutPaiement) => t[s]?.total;
  const somme = (s: StatutPaiement) => (t[s] ? Number(t[s]!.somme) : null);
  const reessayer = () => {
    void liste.refetch();
    totaux.forEach((q) => void q.refetch());
  };
  const changerPeriode = (p: Periode) => {
    setPeriode(p);
    setPage(1);
  };
  const changerFiltre = (f: Filtre) => {
    setFiltre(f);
    setPage(1);
  };
  const totalTous = STATUTS.every((s) => t[s]) ? STATUTS.reduce((n, s) => n + (t[s]?.total ?? 0), 0) : undefined;

  return (
    <>
      <PageHeader
        title={user.role === 'livreur' ? 'Encaissements' : 'Mes encaissements'}
        subtitle="Les paiements que vous avez encaissés. L’administrateur les valide ou les refuse."
      />
      <div className="lv-periode">
        <Segmented<Periode>
          name="periode"
          label="Période"
          value={periode}
          onChange={changerPeriode}
          options={[
            { value: 'jour', label: "Aujourd'hui" },
            { value: 'semaine', label: '7 jours' },
            { value: 'mois', label: 'Ce mois' },
          ]}
        />
      </div>

      {indisponible ? (
        <Alert tone="warning">
          <div className="stack-sm">
            <span>
              La liste des encaissements n’est pas encore disponible sur le serveur. Vos encaissements sont bien enregistrés sur chaque dossier ; réessayez dans quelques instants.
            </span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={reessayer} busy={liste.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : erreur && !liste.data ? (
        <Alert tone="error">
          <div className="stack-sm">
            <span>Les encaissements n’ont pas pu être chargés : {messageErreur(erreur)}</span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={reessayer} busy={liste.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : (
        <>
          <Resume
            label={`Totaux ${PERIODE_LIBELLE[periode]}`}
            items={[
              { label: 'À valider', montant: somme('a_valider'), meta: nb('a_valider') !== undefined ? `${nb('a_valider')} paiement${nb('a_valider')! > 1 ? 's' : ''}` : undefined, large: true },
              { label: 'Validés', montant: somme('valide'), meta: nb('valide') !== undefined ? `${nb('valide')} paiement${nb('valide')! > 1 ? 's' : ''}` : undefined, tone: 'success' },
              {
                label: 'Refusés',
                montant: somme('refuse'),
                meta: nb('refuse') !== undefined ? `${nb('refuse')} paiement${nb('refuse')! > 1 ? 's' : ''}` : undefined,
                tone: nb('refuse') ? 'danger' : undefined,
              },
            ]}
          />
          <div className="lv-onglets" data-serre="">
            <Tabs<Filtre>
              label="Filtrer par état"
              value={filtre}
              onChange={changerFiltre}
              tabs={[
                { value: 'tous', label: 'Tous', count: totalTous },
                { value: 'a_valider', label: 'À valider', count: nb('a_valider') },
                { value: 'valide', label: 'Validés', count: nb('valide') },
                { value: 'refuse', label: 'Refusés', count: nb('refuse') },
              ]}
            />
          </div>
          {!liste.data ? (
            <LoadingRows rows={4} />
          ) : liste.data.items.length === 0 ? (
            <Card>
              <EmptyState title={filtre === 'tous' ? `Aucun encaissement ${PERIODE_LIBELLE[periode]}` : 'Aucun paiement dans cet état'} icon={<Banknote aria-hidden="true" />}>
                {user.role === 'livreur'
                  ? 'Les paiements que vous notez en confirmant une livraison apparaissent ici, avec leur validation par l’administrateur.'
                  : 'Les paiements que vous enregistrez sur vos dossiers apparaissent ici, avec leur validation par l’administrateur.'}
              </EmptyState>
            </Card>
          ) : (
            <Card flush>
              <ul className="lv-liste" aria-busy={liste.isFetching || undefined}>
                {liste.data.items.map((p) => (
                  <LignePaiement key={p.id} p={p} periode={periode} />
                ))}
              </ul>
              <Pagination page={page} total={liste.data.total} limit={LIMITE} onPage={setPage} />
            </Card>
          )}
        </>
      )}
    </>
  );
}
