// Planning des livraisons : semaine du lundi au dimanche. Sur ordinateur, une colonne par jour ;
// sur téléphone (usage principal du livreur), une liste par jour qui commence par aujourd'hui.
// L'administrateur voit tous les livreurs et peut n'en suivre qu'un.

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useUser } from '../../auth/AuthContext';
import { useParametres } from '../../features/livraisons/hooks';
import { Resume } from '../../features/livraisons/Resume';
import '../../features/livraisons/livraisons.css';
import { AProgrammer } from '../../features/livraisons-planning/AProgrammer';
import {
  ajouterJours,
  aujourdhuiDans,
  estJour,
  libelleColonne,
  libelleLong,
  libelleSemaine,
  lundiDe,
  useEcranLarge,
  useLivreurs,
  usePlanning,
} from '../../features/livraisons-planning/hooks';
import { RendezVous } from '../../features/livraisons-planning/RendezVous';
import type { LivraisonPlanning } from '../../features/livraisons-planning/types';
import '../../features/livraisons-planning/livraisons-planning.css';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, Count, EmptyState, IconButton, PageHeader, SelectField, Skeleton } from '../../ui';

const fait = (d: LivraisonPlanning) => d.statut === 'livre' || d.statut === 'termine';

function Colonne({ jour, items, aujourdhui, montrerLivreur }: { jour: string; items: LivraisonPlanning[]; aujourdhui: string; montrerLivreur: boolean }) {
  const l = libelleColonne(jour);
  const estAujourdhui = jour === aujourdhui;
  return (
    <section className="lp-colonne" data-aujourdhui={estAujourdhui || undefined} data-passe={jour < aujourdhui || undefined} aria-label={libelleLong(jour)}>
      <header className="lp-colonne__tete">
        <h3 className="lp-colonne__jour">
          {l.jour}
          <small>{estAujourdhui ? "Aujourd'hui" : l.date}</small>
        </h3>
        {items.length > 0 && <Count n={items.length} />}
      </header>
      {items.length ? (
        items.map((d) => <RendezVous key={d.id} d={d} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} />)
      ) : (
        <p className="lp-colonne__vide">Aucune livraison</p>
      )}
    </section>
  );
}

function JourListe({
  titre,
  items,
  aujourdhui,
  montrerLivreur,
  ton,
  avecDate,
}: {
  titre: React.ReactNode;
  items: LivraisonPlanning[];
  aujourdhui: string;
  montrerLivreur: boolean;
  ton?: 'aujourdhui' | 'retard';
  avecDate?: boolean;
}) {
  return (
    <section className="lp-jour" data-aujourdhui={ton === 'aujourdhui' || undefined} data-retard={ton === 'retard' || undefined}>
      <header className="lp-jour__tete">
        <h3 className="lp-jour__titre">{titre}</h3>
        {items.length > 0 && <Count n={items.length} />}
      </header>
      {items.length ? (
        <div className="lp-jour__liste">
          {items.map((d) => (
            <RendezVous key={d.id} d={d} aujourdhui={aujourdhui} variante="liste" montrerLivreur={montrerLivreur} avecDate={avecDate} />
          ))}
        </div>
      ) : (
        <p className="lp-jour__vide">Aucune livraison prévue</p>
      )}
    </section>
  );
}

function titreJour(jour: string, aujourdhui: string): React.ReactNode {
  if (jour === aujourdhui) return <>Aujourd'hui <small>· {libelleLong(jour)}</small></>;
  if (jour === ajouterJours(aujourdhui, 1)) return <>Demain <small>· {libelleLong(jour)}</small></>;
  return libelleLong(jour);
}

export default function Planning() {
  const user = useUser();
  const admin = user.role === 'admin';
  const large = useEcranLarge(1180);
  const parametres = useParametres();
  const [params, setParams] = useSearchParams();
  const aujourdhuiLocal = aujourdhuiDans(parametres.data?.fuseau);
  const semaineParam = params.get('semaine');
  const lundi = lundiDe(estJour(semaineParam) ? semaineParam : aujourdhuiLocal);
  const dimanche = ajouterJours(lundi, 6);
  const livreurParam = Number(params.get('livreur'));
  const livreurId = admin && Number.isInteger(livreurParam) && livreurParam > 0 ? livreurParam : undefined;

  const q = usePlanning({ debut: lundi, fin: dimanche, livreur_id: livreurId });
  const livreurs = useLivreurs(admin);
  // Pas d'affichage des données d'une autre semaine ou d'un autre livreur pendant le chargement.
  const attendu = admin ? (livreurId ?? null) : user.id;
  const data = q.data && q.data.debut === lundi && q.data.livreur_id === attendu ? q.data : undefined;
  const aujourdhui = data?.aujourdhui ?? aujourdhuiLocal;
  const montrerLivreur = admin && !livreurId;

  const changer = (cle: string, valeur: string | null) => {
    const p = new URLSearchParams(params);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    setParams(p, { replace: true });
  };
  const semaineCourante = lundiDe(aujourdhui) === lundi;

  const vue = useMemo(() => {
    const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
    const items = data?.items ?? [];
    const parJour = new Map(jours.map((j) => [j, items.filter((d) => d.jour === j)]));
    const enRetard = data?.en_retard ?? [];
    const enCours = items.filter((d) => !fait(d));
    const restes = enCours.map((d) => d.reste_a_encaisser);
    return {
      jours,
      parJour,
      // Retards hors de la semaine affichée (ceux de la semaine sont dans leur colonne).
      retardsHorsSemaine: enRetard.filter((d) => !d.jour || d.jour < lundi || d.jour > dimanche),
      enRetard,
      aLivrer: enCours.length,
      faites: items.length - enCours.length,
      duJour: enCours.filter((d) => d.jour === aujourdhui).length,
      aEncaisser: restes.length && restes.every((r) => r === null) ? null : restes.reduce<number>((s, r) => s + (r ?? 0), 0),
      sansMontant: restes.filter((r) => r === null).length,
      vide: items.length === 0,
    };
  }, [data, lundi, dimanche, aujourdhui]);

  // Sur téléphone, la semaine en cours commence par aujourd'hui ; les retards passent devant.
  const listeTelephone = () => {
    if (!semaineCourante) {
      return (
        <>
          {vue.retardsHorsSemaine.length > 0 && (
            <JourListe titre="En retard" ton="retard" items={vue.retardsHorsSemaine} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} avecDate />
          )}
          {vue.jours.map((j) => (
            <JourListe key={j} titre={titreJour(j, aujourdhui)} items={vue.parJour.get(j) ?? []} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} />
          ))}
        </>
      );
    }
    const passes = vue.jours.filter((j) => j < aujourdhui);
    const avenir = vue.jours.filter((j) => j >= aujourdhui);
    const effectueesAvant = passes.flatMap((j) => (vue.parJour.get(j) ?? []).filter(fait));
    return (
      <>
        {vue.enRetard.length > 0 && (
          <JourListe titre="En retard" ton="retard" items={vue.enRetard} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} avecDate />
        )}
        {avenir.map((j) => (
          <JourListe
            key={j}
            titre={titreJour(j, aujourdhui)}
            ton={j === aujourdhui ? 'aujourdhui' : undefined}
            items={vue.parJour.get(j) ?? []}
            aujourdhui={aujourdhui}
            montrerLivreur={montrerLivreur}
          />
        ))}
        {effectueesAvant.length > 0 && (
          <JourListe titre="Effectuées plus tôt cette semaine" items={effectueesAvant} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} avecDate />
        )}
      </>
    );
  };

  const fenetre = data?.jours_historique;
  const avantFenetre = !admin && fenetre !== undefined && lundi <= ajouterJours(aujourdhui, -fenetre);

  return (
    <>
      <PageHeader
        title="Planning"
        subtitle={admin ? 'Les livraisons programmées de chaque livreur, jour par jour.' : 'Vos livraisons programmées, jour par jour.'}
        actions={
          admin ? (
            <SelectField
              className="lp-livreur"
              label="Livreur"
              value={livreurId ? String(livreurId) : ''}
              onChange={(e) => changer('livreur', e.target.value || null)}
              options={[{ value: '', label: 'Tous les livreurs' }, ...(livreurs.data ?? []).map((l) => ({ value: String(l.id), label: l.nom }))]}
            />
          ) : undefined
        }
      />

      <nav className="lp-nav" aria-label="Choix de la semaine">
        <IconButton label="Semaine précédente" onClick={() => changer('semaine', ajouterJours(lundi, -7))}>
          <ChevronLeft />
        </IconButton>
        <Button size="sm" disabled={semaineCourante} onClick={() => changer('semaine', null)}>
          Aujourd'hui
        </Button>
        <IconButton label="Semaine suivante" onClick={() => changer('semaine', ajouterJours(lundi, 7))}>
          <ChevronRight />
        </IconButton>
        <h2 className="lp-nav__titre" aria-live="polite">
          Semaine du {libelleSemaine(lundi)}
        </h2>
      </nav>

      {q.isError && !data ? (
        <Alert tone="error">
          <div className="stack-sm">
            <span>Le planning n’a pas pu être chargé : {messageErreur(q.error)}</span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={() => void q.refetch()} busy={q.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : !data ? (
        <div className="stack">
          <Skeleton h={88} />
          <Skeleton h={large ? 260 : 400} />
        </div>
      ) : (
        <>
          <Resume
            label="Résumé de la semaine"
            items={[
              {
                label: 'À livrer',
                value: vue.aLivrer,
                meta: vue.enRetard.length
                  ? `${vue.enRetard.length} en retard`
                  : semaineCourante
                    ? vue.duJour
                      ? `dont ${vue.duJour} aujourd'hui`
                      : "aucune aujourd'hui"
                    : 'cette semaine',
                tone: vue.enRetard.length ? 'alert' : undefined,
              },
              { label: 'Effectuées', value: vue.faites, meta: 'cette semaine' },
              {
                label: 'À encaisser',
                montant: vue.aEncaisser,
                meta: vue.sansMontant ? `${vue.sansMontant} livraison${vue.sansMontant > 1 ? 's' : ''} sans montant défini` : 'sur les livraisons à faire',
                large: true,
              },
            ]}
          />
          {q.isError && <Alert tone="warning">Actualisation impossible ({messageErreur(q.error)}). Le planning affiché peut ne pas être à jour.</Alert>}

          {large && vue.retardsHorsSemaine.length > 0 && (
            <Card title={`En retard (${vue.retardsHorsSemaine.length})`} className="lp-retards">
              <div className="lp-grille">
                {vue.retardsHorsSemaine.map((d) => (
                  <RendezVous key={d.id} d={d} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} avecDate />
                ))}
              </div>
            </Card>
          )}

          {vue.vide && (large || !vue.enRetard.length) ? (
            <Card>
              <EmptyState title="Aucune livraison cette semaine" icon={<CalendarDays aria-hidden="true" />}>
                {admin
                  ? 'Les livraisons programmées par les livreurs apparaissent ici, à leur date prévue.'
                  : 'Programmez un dossier prêt à livrer (ci-dessous) : il apparaît ici à la date choisie.'}
              </EmptyState>
            </Card>
          ) : large ? (
            <div className="lp-semaine">
              {vue.jours.map((j) => (
                <Colonne key={j} jour={j} items={vue.parJour.get(j) ?? []} aujourdhui={aujourdhui} montrerLivreur={montrerLivreur} />
              ))}
            </div>
          ) : (
            <div className="lp-jours">{listeTelephone()}</div>
          )}

          {avantFenetre && (
            <p className="lv-note">
              Les livraisons effectuées il y a plus de {fenetre} jours sont dans votre{' '}
              <Link className="ev-link" to="/livraisons/historique">
                historique
              </Link>
              .
            </p>
          )}

          <AProgrammer items={data.a_programmer} montrerLivreur={admin} taille={large ? 'sm' : 'md'} />
        </>
      )}
    </>
  );
}
