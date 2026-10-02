// Livraisons effectuées : ce que le livreur a livré ces derniers jours (durée fixée par
// l'administrateur), regroupé par jour, avec la situation de paiement de chaque dossier.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, PackageCheck, RotateCw } from 'lucide-react';
import { formatFCFA, formatHeure } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { useDossiers } from '../../features/dossiers/hooks';
import { debutJour, libelleJour } from '../../features/livraisons/dates';
import { EncaisserDialog } from '../../features/livraisons/EncaisserDialog';
import { resteAEncaisser, useParametres } from '../../features/livraisons/hooks';
import { Resume } from '../../features/livraisons/Resume';
import '../../features/livraisons/livraisons.css';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, PaymentBadge, Ref } from '../../ui';

function Paiement({ d }: { d: DossierResume }) {
  const attente = d.en_attente_validation ?? 0;
  const reste = resteAEncaisser(d);
  return (
    <span className="lv-ligne__paiement">
      {d.situation_paiement && <PaymentBadge situation={d.situation_paiement} enAttente={attente} />}
      {attente > 0 && <span className="ev-muted">{formatFCFA(attente)} en attente de validation</span>}
      {reste !== null && reste > 0 && <span className="ev-muted">Reste {formatFCFA(reste)}</span>}
    </span>
  );
}

export default function Livrees() {
  const user = useUser();
  const admin = user.role === 'admin';
  const parametres = useParametres();
  const jours = parametres.data?.livreur_jours_historique;
  const q = useDossiers({ statut: ['livre', 'termine'], limit: 200, tri: 'recent' });
  const [encaisser, setEncaisser] = useState<DossierResume | null>(null);

  const { groupes, total, aValider, reste } = useMemo(() => {
    const limite = jours ? debutJour().getTime() - (jours - 1) * 86_400_000 : null;
    const items = (q.data?.items ?? [])
      .filter((d) => d.livre_at && (!admin || !limite || new Date(d.livre_at).getTime() >= limite))
      .sort((a, b) => new Date(b.livre_at!).getTime() - new Date(a.livre_at!).getTime());
    const parJour = new Map<string, DossierResume[]>();
    for (const d of items) {
      const cle = debutJour(new Date(d.livre_at!)).toISOString();
      parJour.set(cle, [...(parJour.get(cle) ?? []), d]);
    }
    return {
      groupes: [...parJour.entries()].map(([cle, liste]) => ({ cle, titre: libelleJour(cle), liste })),
      total: items.length,
      aValider: items.reduce((s, d) => s + (d.en_attente_validation ?? 0), 0),
      reste: items.reduce((s, d) => s + (resteAEncaisser(d) ?? 0), 0),
    };
  }, [q.data, jours, admin]);

  const periode = jours ? `${jours} dernier${jours > 1 ? 's' : ''} jour${jours > 1 ? 's' : ''}` : 'derniers jours';

  return (
    <>
      <PageHeader title="Livrées" subtitle={`Les livraisons effectuées ces ${periode}, regroupées par jour.`} />
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
        <LoadingRows rows={5} />
      ) : total === 0 ? (
        <Card>
          <EmptyState title="Aucune livraison récente" icon={<PackageCheck aria-hidden="true" />}>
            Chaque dossier que vous confirmez comme livré apparaît ici pendant {jours ? `${jours} jour${jours > 1 ? 's' : ''}` : 'quelques jours'}, avec l’état de son paiement.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Resume
            label="Résumé des livraisons"
            items={[
              { label: 'Livrées', value: total, meta: `sur les ${periode}` },
              { label: 'En attente de validation', montant: aValider, meta: 'encaissé, à valider' },
              { label: 'Reste à encaisser', montant: reste, meta: reste > 0 ? 'auprès des clients livrés' : 'rien à encaisser', tone: reste > 0 ? 'alert' : undefined, large: true },
            ]}
          />
          <Card flush>
            {groupes.map((g) => (
              <section key={g.cle} aria-labelledby={`jour-${g.cle}`}>
                <div className="lv-jour">
                  <h2 id={`jour-${g.cle}`}>{g.titre}</h2>
                  <span>
                    {g.liste.length} livraison{g.liste.length > 1 ? 's' : ''}
                  </span>
                </div>
                <ul className="lv-liste">
                  {g.liste.map((d) => {
                    const r = resteAEncaisser(d);
                    return (
                      <li key={d.id} className="lv-ligne">
                        <Link to={`/dossiers/${d.id}`} className="lv-ligne__lien">
                          <span className="lv-ligne__haut">
                            <span className="lv-ligne__titre">{d.client_nom}</span>
                            <Ref>{d.numero}</Ref>
                          </span>
                          <span className="lv-ligne__sous">
                            Livré à {formatHeure(d.livre_at)}
                            {d.adresse_livraison ? ` · ${d.adresse_livraison}` : ''}
                            {admin && d.livreur_nom ? ` · ${d.livreur_nom}` : ''}
                          </span>
                          <Paiement d={d} />
                        </Link>
                        <div className="lv-ligne__droite">
                          <span className="ev-num lv-ligne__montant">{formatFCFA(d.montant)}</span>
                          {r !== null && r > 0 && (
                            <Button size="sm" icon={<Banknote />} onClick={() => setEncaisser(d)}>
                              Encaisser
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </Card>
        </>
      )}
      {encaisser && <EncaisserDialog dossier={encaisser} onClose={() => setEncaisser(null)} />}
    </>
  );
}
