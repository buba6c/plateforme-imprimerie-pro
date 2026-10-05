// Dossiers prêts à livrer, sans date : la programmation passe par la boîte de dialogue
// commune des dossiers (action « programmer_livraison » renvoyée par le serveur).

import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import { formatDate, formatFCFA } from '@evocom/shared';
import { Card, Count, EmptyState, Ref, UrgentTag } from '../../ui';
import { DossierActions } from '../dossiers/DossierActions';
import type { LivraisonPlanning } from './types';

export function AProgrammer({ items, montrerLivreur, taille = 'sm' }: { items: LivraisonPlanning[]; montrerLivreur?: boolean; taille?: 'sm' | 'md' }) {
  return (
    <section className="stack-sm" aria-labelledby="lp-a-programmer">
      <h2 className="section-title row" id="lp-a-programmer">
        À programmer <Count n={items.length} />
      </h2>
      {items.length === 0 ? (
        <Card>
          <EmptyState title="Aucun dossier à programmer" icon={<PackageOpen aria-hidden="true" />}>
            Les dossiers imprimés par l’atelier apparaissent ici. Programmez-les pour les placer dans le planning.
          </EmptyState>
        </Card>
      ) : (
        <Card flush>
          <ul className="lv-liste lp-prog">
            {items.map((d) => {
              const programmer = { ...d, actions: d.actions.filter((a) => a === 'programmer_livraison') };
              return (
                <li key={d.id} className="lv-ligne">
                  <div className="lv-ligne__lien">
                    <span className="lv-ligne__haut">
                      <Link to={`/dossiers/${d.id}`} className="lv-ligne__titre lp-rdv__client">
                        {d.client_nom}
                      </Link>
                      <Ref>{d.numero}</Ref>
                      {d.urgent && <UrgentTag />}
                    </span>
                    <span className="lv-ligne__sous">
                      {d.adresse_livraison?.trim() || 'Adresse à confirmer'}
                      {d.date_promise ? ` · promis pour le ${formatDate(d.date_promise)}` : ''}
                      {montrerLivreur && d.livreur_nom ? ` · attribué à ${d.livreur_nom}` : ''}
                    </span>
                  </div>
                  <div className="lp-prog__droite">
                    <span className="ev-num lv-ligne__montant" title="Reste à encaisser">
                      {d.reste_a_encaisser === null ? '—' : formatFCFA(d.reste_a_encaisser)}
                    </span>
                    <DossierActions dossier={programmer} size={taille} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
