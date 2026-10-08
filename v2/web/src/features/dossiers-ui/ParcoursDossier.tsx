// Frise du parcours d'une commande : chaque étape dans la couleur de son statut, étapes passées cochées
// avec leur date, étape en cours mise en avant. S'adapte au mode de remise (livraison ou retrait).
import { Check } from 'lucide-react';
import { formatDate, type Statut } from '@evocom/shared';
import type { DossierResume } from '../../lib/types';
import { EN_CLAIR } from './enClair';

type D = Pick<
  DossierResume,
  'statut' | 'mode_remise' | 'created_at' | 'date_validation' | 'date_debut_impression' | 'date_fin_impression' | 'livraison_prevue_at' | 'livre_at' | 'termine_at'
>;

interface Etape {
  cle: string;
  titre: string;
  statuts: Statut[];
  couleur: Statut;
  date: (d: D) => string | null;
}

function etapes(retrait: boolean): Etape[] {
  return [
    { cle: 'preparation', titre: 'Préparation', statuts: ['en_cours', 'a_revoir'], couleur: 'en_cours', date: (d) => d.created_at },
    { cle: 'impression', titre: 'Impression', statuts: ['pret_impression', 'en_impression'], couleur: 'en_impression', date: (d) => d.date_debut_impression ?? d.date_validation },
    { cle: 'pret', titre: retrait ? 'Prêt à retirer' : 'Prêt à partir', statuts: ['pret_livraison'], couleur: 'pret_livraison', date: (d) => d.date_fin_impression },
    ...(retrait ? [] : [{ cle: 'route', titre: 'En route', statuts: ['en_livraison'] as Statut[], couleur: 'en_livraison' as Statut, date: (d: D) => d.livraison_prevue_at }]),
    { cle: 'livre', titre: retrait ? 'Remis au client' : 'Livré', statuts: ['livre'], couleur: 'livre', date: (d) => d.livre_at },
    { cle: 'termine', titre: 'Terminé', statuts: ['termine'], couleur: 'termine', date: (d) => d.termine_at },
  ];
}

export function ParcoursDossier({ d }: { d: D }) {
  const liste = etapes(d.mode_remise === 'retrait');
  const courante = Math.max(0, liste.findIndex((e) => e.statuts.includes(d.statut)));
  return (
    <ol className="parcours" aria-label="Parcours de la commande">
      {liste.map((e, i) => {
        const etat = i < courante ? 'fait' : i === courante ? 'en_cours' : 'a_venir';
        const date = etat !== 'a_venir' ? e.date(d) : null;
        const couleur = e.couleur.replace('_', '-');
        return (
          <li
            key={e.cle}
            className="parcours__etape"
            data-etat={etat}
            style={{ '--p': `var(--s-${couleur})`, '--p-fond': `var(--s-${couleur}-bg)`, '--p-encre': `var(--s-${couleur}-ink)` } as React.CSSProperties}
            aria-current={etat === 'en_cours' ? 'step' : undefined}
          >
            <span className="parcours__pastille" aria-hidden="true">
              {etat === 'fait' ? <Check /> : i + 1}
            </span>
            <span className="parcours__titre">{e.titre}</span>
            <span className="parcours__detail">
              {etat === 'en_cours' ? EN_CLAIR[d.statut].etiquette : date ? formatDate(date) : etat === 'fait' ? 'Fait' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
