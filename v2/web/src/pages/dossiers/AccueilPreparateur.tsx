// Accueil du préparateur : ce qu'il doit faire maintenant (dossiers renvoyés en révision, dossiers
// en préparation), ce qu'il a envoyé à l'atelier et où ça en est, ce qui a été livré récemment,
// et ses notifications. Chaque bloc porte la couleur du statut, comme les badges du reste de l'application.

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCheck, Factory, PackageCheck, PencilLine, Plus, RotateCw, Send, Undo2 } from 'lucide-react';
import { formatDate, formatRelatif, STATUT_LABELS, type Statut } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { useDossiers } from '../../features/dossiers/hooks';
import { DossierActions } from '../../features/dossiers/DossierActions';
import { specResume } from '../../features/dossiers/JobCard';
import '../../features/accueil/accueil.css';
import { api, messageErreur } from '../../lib/api';
import type { DossierResume, Notification } from '../../lib/types';
import { Alert, Button, Count, EmptyState, MachineIcone, Ref, Skeleton, StatusBadge, UrgentTag } from '../../ui';

type Bloc = 'a_revoir' | 'en_cours' | 'atelier' | 'livraison';

const ACTIFS: Statut[] = ['a_revoir', 'en_cours', 'pret_impression', 'en_impression', 'pret_livraison', 'en_livraison'];
const J7 = 7 * 24 * 3600 * 1000;
const temps = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
const prenom = (nom: string) => nom.trim().split(/\s+/)[0] ?? nom;

const BLOCS: Record<Bloc, { titre: string; aide: string; vide: string; icone: React.ReactNode }> = {
  a_revoir: {
    titre: 'À corriger',
    aide: 'Renvoyés par l’atelier ou l’administration : corrigez-les puis renvoyez-les à l’impression.',
    vide: 'Rien à corriger',
    icone: <Undo2 aria-hidden="true" />,
  },
  en_cours: {
    titre: 'En préparation',
    aide: 'Vos dossiers pas encore envoyés à l’atelier. Validez-les quand les fichiers sont prêts.',
    vide: 'Aucun dossier en préparation',
    icone: <PencilLine aria-hidden="true" />,
  },
  atelier: {
    titre: 'Envoyés à l’atelier',
    aide: 'En attente d’impression ou en cours d’impression chez l’imprimeur.',
    vide: 'Rien à l’atelier en ce moment',
    icone: <Factory aria-hidden="true" />,
  },
  livraison: {
    titre: 'Imprimés, à livrer ou à retirer',
    aide: 'Sortis de l’atelier : chez le livreur ou en attente du client.',
    vide: 'Rien en livraison',
    icone: <PackageCheck aria-hidden="true" />,
  },
};

function Carte({ d }: { d: DossierResume }) {
  const navigate = useNavigate();
  const aRevoir = d.statut === 'a_revoir';
  const quand =
    d.statut === 'en_impression' && d.date_debut_impression
      ? `impression démarrée ${formatRelatif(d.date_debut_impression)}`
      : d.statut === 'pret_impression' && d.date_validation
        ? `envoyé ${formatRelatif(d.date_validation)}`
        : d.statut === 'pret_livraison' && d.date_fin_impression
          ? `imprimé ${formatRelatif(d.date_fin_impression)}`
          : `modifié ${formatRelatif(d.updated_at)}`;
  return (
    <article
      className="ac-carte"
      data-statut={d.statut}
      data-urgent={d.urgent || undefined}
      tabIndex={0}
      role="link"
      aria-label={`Dossier ${d.numero}, ${d.client_nom}, ${STATUT_LABELS[d.statut]}`}
      onClick={() => navigate(`/dossiers/${d.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/dossiers/${d.id}`);
      }}
    >
      <div className="ac-carte__tete">
        <Ref>{d.numero}</Ref>
        <span className="ac-carte__machine" data-machine={d.machine}>
          <MachineIcone machine={d.machine} taille={13} />
          {d.machine === 'roland' ? 'Roland' : 'Xerox'}
        </span>
        <StatusBadge statut={d.statut} />
        {d.urgent && <UrgentTag />}
      </div>
      <p className="ac-carte__client">{d.client_nom}</p>
      <p className="ac-carte__spec">{specResume(d)}</p>
      {aRevoir && (
        <div className="ac-carte__motif" onClick={(e) => e.stopPropagation()}>
          <strong>Motif du renvoi</strong>
          <span>{d.commentaire_revision?.trim() || 'Sans précision : ouvrez le dossier pour voir l’historique.'}</span>
        </div>
      )}
      <div className="ac-carte__pied" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <span className="ac-carte__quand">
          {d.date_promise ? `pour le ${formatDate(d.date_promise)} · ` : ''}
          {quand}
        </span>
        <span className="ac-carte__actions">
          {aRevoir && (
            <Link className="ev-btn ev-btn--sm" to={`/dossiers/${d.id}/modifier`}>
              <PencilLine aria-hidden="true" />
              Corriger
            </Link>
          )}
          <DossierActions dossier={d} size="sm" principaleSeulement />
        </span>
      </div>
    </article>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: Notification[]; non_lues: number }>('/notifications'),
    refetchInterval: 60_000,
    retry: false,
  });
  const lire = useMutation({
    mutationFn: (ids?: number[]) => api.post('/notifications/lues', ids ? { ids } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = useMemo(() => {
    const l = q.data?.items ?? [];
    return [...l].sort((a, b) => Number(!!a.lu_at) - Number(!!b.lu_at) || temps(b.created_at) - temps(a.created_at)).slice(0, 8);
  }, [q.data]);
  const nonLues = q.data?.non_lues ?? 0;
  return (
    <section className="ac-bloc ac-bloc--notifs" aria-labelledby="ac-notifs">
      <header className="ac-bloc__tete">
        <h2 className="ac-bloc__titre" id="ac-notifs">
          <BellRing aria-hidden="true" />
          Notifications
          {nonLues > 0 && <Count n={nonLues} />}
        </h2>
        {nonLues > 0 && (
          <Button variant="ghost" size="sm" icon={<CheckCheck />} onClick={() => lire.mutate(undefined)} busy={lire.isPending}>
            Tout marquer comme lu
          </Button>
        )}
      </header>
      {q.isLoading ? (
        <Skeleton h={120} />
      ) : items.length === 0 ? (
        <p className="ac-vide">Aucune notification. Vous serez prévenu quand un dossier est renvoyé en révision, imprimé ou livré.</p>
      ) : (
        <ul className="ac-notifs">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="ac-notif"
                data-type={n.type}
                data-nonlue={!n.lu_at || undefined}
                onClick={() => {
                  if (!n.lu_at) lire.mutate([n.id]);
                  if (n.dossier_id) navigate(`/dossiers/${n.dossier_id}`);
                }}
              >
                <span className="ac-notif__point" aria-hidden="true" />
                <span className="ac-notif__corps">
                  <span className="ac-notif__titre">{n.titre}</span>
                  {n.message && <span className="ac-notif__message">{n.message}</span>}
                  <span className="ac-notif__quand">{formatRelatif(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AccueilPreparateur() {
  const user = useUser();
  const actifs = useDossiers({ statut: ACTIFS, mine: true, limit: 200, tri: 'priorite' }, { refetchInterval: 30_000 });
  const livres = useDossiers({ statut: ['livre', 'termine'], mine: true, limit: 12, tri: 'recent' }, { refetchInterval: 120_000 });
  const chargee = actifs.data && !actifs.isPlaceholderData ? actifs.data : undefined;

  const blocs = useMemo(() => {
    const items = chargee?.items ?? [];
    const par = (s: Statut[]) => items.filter((d) => s.includes(d.statut));
    return {
      a_revoir: par(['a_revoir']).sort((a, b) => temps(b.updated_at) - temps(a.updated_at)),
      en_cours: par(['en_cours']),
      atelier: par(['pret_impression', 'en_impression']).sort((a, b) => Number(b.statut === 'en_impression') - Number(a.statut === 'en_impression')),
      livraison: par(['pret_livraison', 'en_livraison']),
    } satisfies Record<Bloc, DossierResume[]>;
  }, [chargee]);
  const recents = useMemo(
    () => (livres.data?.items ?? []).filter((d) => Date.now() - temps(d.livre_at ?? d.termine_at ?? d.updated_at) < J7),
    [livres.data],
  );
  const total = chargee ? blocs.a_revoir.length + blocs.en_cours.length + blocs.atelier.length + blocs.livraison.length : 0;

  return (
    <div className="ac">
      <header className="ac-entete">
        <div>
          <p className="ac-entete__bonjour">Bonjour {prenom(user.nom)}</p>
          <h1 className="ev-h-display">Mes dossiers</h1>
          {chargee ? (
            <ul className="ac-compteurs" aria-label="Résumé">
              <li data-tone="a_revoir">
                <strong>{blocs.a_revoir.length}</strong> à corriger
              </li>
              <li data-tone="en_cours">
                <strong>{blocs.en_cours.length}</strong> en préparation
              </li>
              <li data-tone="atelier">
                <strong>{blocs.atelier.length}</strong> à l’atelier
              </li>
              <li data-tone="livraison">
                <strong>{blocs.livraison.length}</strong> en livraison
              </li>
            </ul>
          ) : (
            <p className="ev-muted">Chargement de vos dossiers…</p>
          )}
        </div>
        <div className="ac-entete__actions">
          <Link className="ev-btn ev-btn--primary" to="/dossiers/nouveau">
            <Plus aria-hidden="true" />
            Nouveau dossier
          </Link>
          <Link className="ev-btn" to="/dossiers">
            Tous mes dossiers
          </Link>
        </div>
      </header>

      {actifs.isError && !actifs.data ? (
        <Alert tone="error">
          <div className="stack-sm">
            <span>Vos dossiers n’ont pas pu être chargés : {messageErreur(actifs.error)}</span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={() => void actifs.refetch()} busy={actifs.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : (
        <div className="ac-grille">
          <div className="ac-colonne">
            {(Object.keys(BLOCS) as Bloc[]).map((id) => {
              const b = BLOCS[id];
              const liste = blocs[id];
              return (
                <section key={id} className="ac-bloc" data-bloc={id} aria-labelledby={`ac-${id}`}>
                  <header className="ac-bloc__tete">
                    <h2 className="ac-bloc__titre" id={`ac-${id}`}>
                      {b.icone}
                      {b.titre}
                      {chargee && <Count n={liste.length} />}
                    </h2>
                    <span className="ac-bloc__aide">{b.aide}</span>
                  </header>
                  {!chargee ? (
                    <Skeleton h={96} />
                  ) : liste.length === 0 ? (
                    <div className="ac-vide-bloc">
                      <EmptyState title={b.vide} icon={b.icone} />
                    </div>
                  ) : (
                    <div className="ac-cartes">
                      {liste.map((d) => (
                        <Carte key={d.id} d={d} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {chargee && total === 0 && (
              <p className="ac-vide">
                Aucun dossier en cours. <Link to="/dossiers/nouveau">Créer un dossier</Link> ou partir d’un <Link to="/modeles">modèle</Link>.
              </p>
            )}
          </div>

          <aside className="ac-cote">
            <Notifications />
            <section className="ac-bloc" data-bloc="recents" aria-labelledby="ac-recents">
              <header className="ac-bloc__tete">
                <h2 className="ac-bloc__titre" id="ac-recents">
                  <Send aria-hidden="true" />
                  Livrés ces 7 derniers jours
                  {livres.data && <Count n={recents.length} />}
                </h2>
              </header>
              {livres.isLoading ? (
                <Skeleton h={80} />
              ) : recents.length === 0 ? (
                <p className="ac-vide">Rien de livré cette semaine.</p>
              ) : (
                <ul className="ac-recents">
                  {recents.map((d) => (
                    <li key={d.id}>
                      <Link className="ac-recent" to={`/dossiers/${d.id}`} data-statut={d.statut}>
                        <Ref>{d.numero}</Ref>
                        <span className="ac-recent__client">{d.client_nom}</span>
                        <span className="ac-recent__quand">{formatRelatif(d.livre_at ?? d.termine_at ?? d.updated_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
