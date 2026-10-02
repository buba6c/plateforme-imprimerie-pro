// À livrer : écran principal du livreur (téléphone). Résumé de la journée, dossiers à programmer
// et tournée classée par jour. L'administrateur voit toutes les tournées.

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageOpen, RotateCw, Truck } from 'lucide-react';
import { useUser } from '../../auth/AuthContext';
import { useDossiers } from '../../features/dossiers/hooks';
import { CarteLivraison } from '../../features/livraisons/CarteLivraison';
import { dateDuJour, ecartJours } from '../../features/livraisons/dates';
import { resteAEncaisser } from '../../features/livraisons/hooks';
import { Resume } from '../../features/livraisons/Resume';
import '../../features/livraisons/livraisons.css';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Alert, Button, Card, Count, EmptyState, PageHeader, Skeleton, Tabs } from '../../ui';

type Vue = 'a_programmer' | 'tournee';
type Groupe = 'retard' | 'aujourdhui' | 'demain' | 'plus_tard';

const GROUPES: { id: Groupe; titre: string }[] = [
  { id: 'retard', titre: 'En retard' },
  { id: 'aujourdhui', titre: "Aujourd'hui" },
  { id: 'demain', titre: 'Demain' },
  { id: 'plus_tard', titre: 'Plus tard' },
];

function groupeDe(d: DossierResume): Groupe {
  if (!d.livraison_prevue_at) return 'plus_tard';
  const e = ecartJours(d.livraison_prevue_at);
  return e < 0 ? 'retard' : e === 0 ? 'aujourdhui' : e === 1 ? 'demain' : 'plus_tard';
}

const t = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER);

export default function ALivrer() {
  const user = useUser();
  const admin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const q = useDossiers({ statut: ['pret_livraison', 'en_livraison'], limit: 200 }, { refetchInterval: 60_000 });
  const items = q.data?.items;

  const donnees = useMemo(() => {
    const tous = items ?? [];
    const aProgrammer = tous.filter((d) => d.statut === 'pret_livraison');
    const enLivraison = tous.filter((d) => d.statut === 'en_livraison');
    // Le livreur voit sa tournée et les livraisons programmées sans livreur désigné.
    const tournee = (admin ? enLivraison : enLivraison.filter((d) => d.livreur_id === user.id || d.livreur_id === null)).sort(
      (a, b) => t(a.livraison_prevue_at) - t(b.livraison_prevue_at),
    );
    const autres = enLivraison.length - tournee.length;
    const groupes = GROUPES.map((g) => ({ ...g, items: tournee.filter((d) => groupeDe(d) === g.id) })).filter((g) => g.items.length);
    const restes = tournee.map(resteAEncaisser);
    const aEncaisser = !restes.length || restes.some((r) => r !== null) ? restes.reduce<number>((s, r) => s + (r ?? 0), 0) : null;
    const sansMontant = restes.filter((r) => r === null).length;
    const aujourdhui = tournee.filter((d) => groupeDe(d) === 'aujourdhui').length;
    const retard = tournee.filter((d) => groupeDe(d) === 'retard').length;
    return { aProgrammer, tournee, autres, groupes, aEncaisser, sansMontant, aujourdhui, retard };
  }, [items, admin, user.id]);

  const vueParam = params.get('vue');
  const vue: Vue = vueParam === 'tournee' || vueParam === 'a_programmer' ? vueParam : donnees.tournee.length ? 'tournee' : 'a_programmer';
  const changerVue = (v: Vue) => {
    const p = new URLSearchParams(params);
    p.set('vue', v);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader title={admin ? 'Livraisons' : 'À livrer'} subtitle={dateDuJour()} />

      {q.isError && !q.data ? (
        <Alert tone="error">
          <div className="stack-sm">
            <span>Les livraisons n’ont pas pu être chargées : {messageErreur(q.error)}</span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={() => void q.refetch()} busy={q.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : !q.data ? (
        <div className="stack">
          <Skeleton h={88} />
          <Skeleton h={44} />
          <Skeleton h={320} />
        </div>
      ) : (
        <>
          <Resume
            label="Résumé de la journée"
            items={[
              { label: 'À programmer', value: donnees.aProgrammer.length, meta: donnees.aProgrammer.length ? 'prêts au départ' : 'aucun en attente' },
              {
                label: admin ? 'En tournée' : 'Ma tournée',
                value: donnees.tournee.length,
                meta: donnees.retard ? `${donnees.retard} en retard` : donnees.aujourdhui ? `dont ${donnees.aujourdhui} aujourd'hui` : donnees.tournee.length ? "aucune aujourd'hui" : 'vide',
                tone: donnees.retard ? 'alert' : undefined,
              },
              {
                label: 'À encaisser sur la tournée',
                montant: donnees.aEncaisser,
                meta: donnees.sansMontant ? `${donnees.sansMontant} dossier${donnees.sansMontant > 1 ? 's' : ''} sans montant défini` : undefined,
                large: true,
              },
            ]}
          />
          {q.isError && <Alert tone="warning">Actualisation impossible ({messageErreur(q.error)}). La liste affichée peut ne pas être à jour.</Alert>}

          <div className="lv-onglets">
            <Tabs<Vue>
              label="Livraisons"
              value={vue}
              onChange={changerVue}
              tabs={[
                { value: 'a_programmer', label: 'À programmer', count: donnees.aProgrammer.length },
                { value: 'tournee', label: admin ? 'Tournées' : 'Ma tournée', count: donnees.tournee.length },
              ]}
            />
          </div>

          {vue === 'a_programmer' ? (
            donnees.aProgrammer.length ? (
              <div className="lv-grille">
                {donnees.aProgrammer.map((d) => (
                  <CarteLivraison key={d.id} d={d} />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState title="Aucun dossier à programmer" icon={<PackageOpen aria-hidden="true" />}>
                  Les dossiers imprimés par l’atelier apparaissent ici, les urgents en premier. Programmez-les pour les ajouter à votre tournée.
                </EmptyState>
              </Card>
            )
          ) : donnees.groupes.length ? (
            <div className="stack-lg">
              {donnees.groupes.map((g) => (
                <section key={g.id} className="lv-groupe" data-groupe={g.id} aria-labelledby={`groupe-${g.id}`}>
                  <h2 className="section-title lv-groupe__titre" id={`groupe-${g.id}`}>
                    {g.titre} <Count n={g.items.length} />
                  </h2>
                  <div className="lv-grille">
                    {g.items.map((d) => (
                      <CarteLivraison key={d.id} d={d} montrerLivreur={admin} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState title={admin ? 'Aucune livraison programmée' : 'Votre tournée est vide'} icon={<Truck aria-hidden="true" />}>
                Programmez un dossier depuis l’onglet « À programmer » : il apparaîtra ici, classé par jour de passage.
              </EmptyState>
            </Card>
          )}
          {vue === 'tournee' && donnees.autres > 0 && (
            <p className="lv-note">
              {donnees.autres} autre{donnees.autres > 1 ? 's' : ''} livraison{donnees.autres > 1 ? 's' : ''} en cours chez un autre livreur.
            </p>
          )}
        </>
      )}
    </>
  );
}
