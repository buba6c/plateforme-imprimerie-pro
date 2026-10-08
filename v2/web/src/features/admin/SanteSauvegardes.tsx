// Écran « Sauvegardes et état » : sauvegarde à la demande, historique des sauvegardes, espace disque.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, DatabaseBackup, Download, HardDrive, RefreshCw } from 'lucide-react';
import { formatDateHeure, formatEntier, formatRelatif, formatTaille } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, EmptyState, LoadingRows } from '../../ui';
import './sante.css';

// ---------------------------------------------------------------------------
// Types des réponses /api/systeme/sauvegardes et /api/systeme/stockage

export interface Sauvegarde {
  id: number;
  ok: boolean;
  fichier: string | null;
  nom: string | null;
  taille: number | null;
  message: string | null;
  created_at: string;
  present: boolean;
  taille_reelle: number | null;
}

export interface ListeSauvegardes {
  items: Sauvegarde[];
  en_cours: boolean;
  dossier: string;
}

export interface ResultatSauvegarde {
  ok: boolean;
  message: string;
  duree_ms: number;
}

interface Bloc {
  nb: number;
  taille: number;
}

export interface Stockage {
  disque: { total: number; libre: number; utilise: number } | null;
  fichiers: { actifs: Bloc; corbeille: Bloc; purges: Bloc };
  liberable: { dossiers_livres_plus_3_mois: Bloc };
  partages: Bloc & { calcule_at: string };
}

const fichiersTexte = (n: number) => `${formatEntier(n)} ${n > 1 ? 'fichiers' : 'fichier'}`;

function duree(ms: number): string {
  if (ms < 1000) return 'moins d’une seconde';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

/** Temps écoulé depuis le début (mis à jour chaque seconde). */
function useChrono(actif: boolean): number {
  const [debut, setDebut] = useState(0);
  const [maintenant, setMaintenant] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const d = Date.now();
    setDebut(d);
    setMaintenant(d);
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [actif]);
  return actif ? maintenant - debut : 0;
}

export function useSauvegardes() {
  return useQuery({
    queryKey: ['sauvegardes'],
    queryFn: () => api.get<ListeSauvegardes>('/systeme/sauvegardes'),
    refetchInterval: (q) => (q.state.data?.en_cours ? 10_000 : false),
  });
}

// ---------------------------------------------------------------------------
// Sauvegarder maintenant

export function CarteSauvegarderMaintenant() {
  const qc = useQueryClient();
  const liste = useSauvegardes();
  const lancer = useMutation({
    mutationFn: () => api.post<ResultatSauvegarde>('/systeme/sauvegardes'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sauvegardes'] });
      void qc.invalidateQueries({ queryKey: ['sante'] });
      void qc.invalidateQueries({ queryKey: ['stockage'] });
    },
  });
  const chrono = useChrono(lancer.isPending);
  const ailleurs = !lancer.isPending && !!liste.data?.en_cours;

  return (
    <section className="ev-card sante-carte">
      <header className="sante-carte__tete">
        <span className="sante-icone" aria-hidden="true">
          <DatabaseBackup />
        </span>
        <div>
          <h2 className="ev-card__title">Sauvegarder maintenant</h2>
          <p className="sante-texte">Copie la base de données et prend un instantané des fichiers, comme la sauvegarde automatique de la nuit.</p>
        </div>
      </header>
      <div className="sante-carte__corps">
        <Button variant="primary" icon={<DatabaseBackup />} busy={lancer.isPending} disabled={ailleurs} onClick={() => lancer.mutate()}>
          {lancer.isPending ? 'Sauvegarde en cours…' : 'Sauvegarder maintenant'}
        </Button>
        {lancer.isPending && (
          <p className="sante-texte" role="status">
            En cours depuis {duree(chrono)}. Cela peut prendre plusieurs minutes : vous pouvez rester sur cette page.
          </p>
        )}
        {ailleurs && (
          <Alert tone="info">Une sauvegarde est déjà en cours (lancée par quelqu’un d’autre ou par la tâche de la nuit). Le bouton revient dès qu’elle est finie.</Alert>
        )}
        {lancer.isSuccess && (
          <Alert tone="success">
            <strong>Sauvegarde réussie</strong> en {duree(lancer.data.duree_ms)}. {lancer.data.message}
          </Alert>
        )}
        {lancer.isError && (
          <Alert tone="error">
            <strong>La sauvegarde n’a pas abouti.</strong> {messageErreur(lancer.error)}
          </Alert>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Historique

export function CarteHistorique() {
  const liste = useSauvegardes();
  const items = liste.data?.items ?? [];
  return (
    <section className="ev-card sante-carte">
      <header className="sante-carte__tete sante-carte__tete--ligne">
        <div>
          <h2 className="ev-card__title">Sauvegardes enregistrées</h2>
          <p className="sante-texte">Les 30 dernières. Les copies de plus de 14 jours sont effacées automatiquement du serveur.</p>
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw />} busy={liste.isFetching} onClick={() => void liste.refetch()}>
          Actualiser
        </Button>
      </header>
      <div className="sante-carte__corps">
        {liste.isError ? (
          <Alert tone="error">La liste des sauvegardes n’a pas pu être lue : {messageErreur(liste.error)}</Alert>
        ) : liste.isLoading ? (
          <LoadingRows rows={3} />
        ) : items.length === 0 ? (
          <EmptyState title="Aucune sauvegarde pour l’instant" icon={<DatabaseBackup aria-hidden="true" />}>
            La sauvegarde automatique de la nuit, ou le bouton « Sauvegarder maintenant », les fera apparaître ici.
          </EmptyState>
        ) : (
          <ul className="sante-sauvegardes">
            {items.map((s) => (
              <li key={s.id} className="sante-sauvegarde" data-ok={s.ok}>
                <span className="sante-etat" data-ok={s.ok}>
                  {s.ok ? 'Réussie' : 'Échec'}
                </span>
                <span className="sante-sauvegarde__texte">
                  <span className="sante-sauvegarde__date">
                    <span className="ev-ref">{formatDateHeure(s.created_at)}</span>
                    <span className="sante-discret"> · {formatRelatif(s.created_at)}</span>
                  </span>
                  {s.message && (
                    <span className="sante-discret sante-sauvegarde__message" title={s.message}>
                      {s.message}
                    </span>
                  )}
                </span>
                <span className="sante-sauvegarde__taille ev-num">{s.taille_reelle !== null ? formatTaille(s.taille_reelle) : s.taille ? formatTaille(s.taille) : '—'}</span>
                {s.present ? (
                  <a className="ev-btn ev-btn--sm" href={`/api/systeme/sauvegardes/${s.id}/telecharger`} download aria-label={`Télécharger la sauvegarde du ${formatDateHeure(s.created_at)}`}>
                    <Download aria-hidden="true" />
                    Télécharger
                  </a>
                ) : (
                  <span className="sante-discret sante-sauvegarde__absent" title="Fichier effacé après le délai de conservation, ou sauvegarde échouée.">
                    {s.ok ? 'Plus sur le serveur' : '—'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Espace disque

function Ligne({ couleur, titre, bloc, total, children }: { couleur: string; titre: string; bloc: Bloc; total: number | null; children?: React.ReactNode }) {
  const part = total ? Math.min(100, (bloc.taille / total) * 100) : 0;
  return (
    <li className="sante-repartition__ligne">
      <span className="sante-pastille" data-couleur={couleur} aria-hidden="true" />
      <span className="sante-repartition__texte">
        <span className="sante-repartition__titre">{titre}</span>
        {children && <span className="sante-discret">{children}</span>}
        <span className="sante-mini" aria-hidden="true">
          <span data-couleur={couleur} style={{ width: `${Math.max(part, bloc.taille > 0 ? 1 : 0)}%` }} />
        </span>
      </span>
      <span className="sante-repartition__valeur">
        <strong className="ev-num">{formatTaille(bloc.taille)}</strong>
        <span className="sante-discret">{fichiersTexte(bloc.nb)}</span>
      </span>
    </li>
  );
}

export function CarteEspaceDisque() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['stockage'], queryFn: () => api.get<Stockage>('/systeme/stockage'), staleTime: 60_000 });
  // « Recompter » relit le disque sans attendre la fin du cache de 10 minutes du serveur.
  const recompter = useMutation({
    mutationFn: () => api.get<Stockage>('/systeme/stockage', { rafraichir: 1 }),
    onSuccess: (d) => qc.setQueryData(['stockage'], d),
  });
  const s = q.data;
  const d = s?.disque ?? null;
  const part = d && d.total ? Math.round((d.utilise / d.total) * 100) : null;
  const ton = part === null ? undefined : part >= 90 ? 'ko' : part >= 75 ? 'warn' : undefined;

  return (
    <section className="ev-card sante-carte">
      <header className="sante-carte__tete sante-carte__tete--ligne">
        <div className="sante-carte__titre-icone">
          <span className="sante-icone" aria-hidden="true">
            <HardDrive />
          </span>
          <div>
            <h2 className="ev-card__title">Espace disque</h2>
            <p className="sante-texte">Place occupée sur le serveur et ce qui la prend.</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw />} busy={q.isFetching || recompter.isPending} onClick={() => recompter.mutate()}>
          Recompter
        </Button>
      </header>
      <div className="sante-carte__corps">
        {recompter.isError && <Alert tone="error">Le recomptage a échoué : {messageErreur(recompter.error)}</Alert>}
        {q.isError ? (
          <Alert tone="error">L’espace disque n’a pas pu être lu : {messageErreur(q.error)}</Alert>
        ) : !s ? (
          <LoadingRows rows={4} />
        ) : (
          <>
            {d ? (
              <div className="sante-disque">
                <div className="sante-disque__chiffres">
                  <span>
                    <strong className="sante-disque__grand ev-num">{part} %</strong> utilisé
                  </span>
                  <span className="sante-discret">
                    <span className="ev-num">{formatTaille(d.utilise)}</span> sur <span className="ev-num">{formatTaille(d.total)}</span> ·{' '}
                    <strong className="ev-num sante-libre">{formatTaille(d.libre)}</strong> libres
                  </span>
                </div>
                <div className="sante-jauge" data-ton={ton} role="meter" aria-label="Disque utilisé" aria-valuemin={0} aria-valuemax={100} aria-valuenow={part ?? 0}>
                  <span style={{ width: `${part ?? 0}%` }} />
                </div>
                {ton && (
                  <Alert tone={ton === 'ko' ? 'error' : 'warning'}>
                    Le disque se remplit. Pour faire de la place : videz la corbeille des fichiers (suppression définitive), après avoir mis à la corbeille les
                    fichiers des commandes livrées depuis longtemps.
                  </Alert>
                )}
              </div>
            ) : (
              <Alert tone="warning">La taille du disque n’a pas pu être lue (dossier de stockage inaccessible).</Alert>
            )}

            <ul className="sante-repartition">
              <Ligne couleur="actifs" titre="Fichiers d’impression" bloc={s.fichiers.actifs} total={d?.total ?? null}>
                Fichiers des commandes, visibles dans Fichiers.
              </Ligne>
              <Ligne couleur="partages" titre="Dont partagés avec l’ancienne application ou les sauvegardes" bloc={s.partages} total={d?.total ?? null}>
                Les mêmes fichiers rangés à plusieurs endroits : en les supprimant, la place ne revient qu’après l’arrêt de l’ancienne application et la
                fin des sauvegardes qui les contiennent (14 jours).
              </Ligne>
              <Ligne couleur="liberable" titre="Dont commandes livrées depuis plus de 3 mois" bloc={s.liberable.dossiers_livres_plus_3_mois} total={d?.total ?? null}>
                Ce qu’on pourrait libérer en premier.{' '}
                <Link className="ev-link" to="/fichiers?statut=livre&tri=taille_desc">
                  Voir les plus lourds
                </Link>
              </Ligne>
              <Ligne couleur="corbeille" titre="Corbeille des fichiers" bloc={s.fichiers.corbeille} total={d?.total ?? null}>
                Encore sur le disque : supprimez-les définitivement pour récupérer la place.
              </Ligne>
            </ul>
            <div className="sante-pied">
              <Link className="ev-btn ev-btn--sm" to="/fichiers?onglet=corbeille">
                Ouvrir la corbeille des fichiers
                <ArrowRight aria-hidden="true" />
              </Link>
              <span className="sante-discret">
                Déjà supprimés définitivement : {fichiersTexte(s.fichiers.purges.nb)} ({formatTaille(s.fichiers.purges.taille)}). Fichiers partagés comptés le{' '}
                {formatDateHeure(s.partages.calcule_at)}.
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
