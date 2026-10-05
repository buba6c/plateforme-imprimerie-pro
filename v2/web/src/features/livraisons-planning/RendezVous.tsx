// Une livraison dans le planning : heure, client (lien vers la fiche), lieu, téléphone,
// ce qu'il reste à encaisser et les reports. Compacte en colonne, plus grande en liste.

import { Link } from 'react-router-dom';
import { CheckCircle2, MapPin, Phone } from 'lucide-react';
import { formatFCFA } from '@evocom/shared';
import { UrgentTag } from '../../ui';
import { lienTelephone } from '../livraisons/hooks';
import { jourAbrege } from './hooks';
import type { LivraisonPlanning } from './types';

function Montant({ d, libelle }: { d: LivraisonPlanning; libelle: boolean }) {
  const reste = d.reste_a_encaisser;
  if (reste === null) return <span className="lp-rdv__montant" data-nul="true">Montant à définir</span>;
  if (reste === 0) {
    return (
      <span className="lp-rdv__montant" data-nul="true">
        {d.en_attente_validation > 0 ? 'Encaissé, à valider' : 'Rien à encaisser'}
      </span>
    );
  }
  return (
    <span className="lp-rdv__a-encaisser" title="Reste à encaisser">
      <span className={libelle ? undefined : 'sr-only'}>À encaisser </span>
      <span className="ev-num lp-rdv__montant">{formatFCFA(reste)}</span>
    </span>
  );
}

export function RendezVous({
  d,
  aujourdhui,
  variante = 'colonne',
  montrerLivreur,
  avecDate,
}: {
  d: LivraisonPlanning;
  aujourdhui: string;
  variante?: 'colonne' | 'liste';
  montrerLivreur?: boolean;
  /** Affiche le jour en plus de l'heure (listes qui mélangent plusieurs jours). */
  avecDate?: boolean;
}) {
  const fait = d.statut === 'livre' || d.statut === 'termine';
  const retard = d.statut === 'en_livraison' && !!d.jour && d.jour < aujourdhui;
  const adresse = d.adresse_livraison?.trim() || null;
  const tel = d.client_telephone?.trim() || null;
  const etat = fait ? (
    <span className="lp-rdv__etat" data-tone="succes">
      <CheckCircle2 aria-hidden="true" />
      Livré
    </span>
  ) : retard ? (
    <span className="lp-rdv__etat" data-tone="retard">
      En retard
    </span>
  ) : null;

  const heure = (
    <span className="lp-rdv__quand">
      {avecDate && d.jour && <span className="lp-rdv__date">{jourAbrege(d.jour)}</span>}
      <span className="ev-ref lp-rdv__heure">{d.heure ?? '—'}</span>
    </span>
  );
  return (
    <article
      className="lp-rdv"
      data-variante={variante}
      data-fait={fait || undefined}
      data-retard={retard || undefined}
      data-urgent={(d.urgent && !fait) || undefined}
      aria-label={`${d.heure ?? ''} ${d.client_nom}, dossier ${d.numero}`}
    >
      {variante === 'liste' ? (
        <div className="lp-rdv__heure-col">
          {heure}
          {etat}
        </div>
      ) : (
        <div className="lp-rdv__haut">
          {heure}
          {etat}
          {d.urgent && !fait && <UrgentTag />}
        </div>
      )}
      {variante === 'liste' && d.urgent && !fait && (
        <div className="lp-rdv__haut">
          <UrgentTag />
        </div>
      )}
      <Link to={`/dossiers/${d.id}`} className="lp-rdv__client" title={`Ouvrir le dossier ${d.numero}`}>
        {d.client_nom}
      </Link>
      <p className="lp-rdv__ligne" data-vide={!adresse || undefined}>
        <MapPin aria-hidden="true" />
        <span>{adresse ?? 'Adresse à confirmer'}</span>
      </p>
      {tel && (
        <a className="lp-rdv__ligne lp-rdv__tel" href={lienTelephone(tel)} aria-label={`Appeler ${d.client_nom} au ${tel}`}>
          <Phone aria-hidden="true" />
          <span className="ev-mono">{tel}</span>
        </a>
      )}
      {montrerLivreur && <span className="lp-rdv__livreur">{d.livreur_nom ?? 'Sans livreur désigné'}</span>}
      <div className="lp-rdv__bas">
        <Montant d={d} libelle={variante === 'liste'} />
        <span className="ev-ref">{d.numero}</span>
        {d.nb_reports > 0 && (
          <span className="lp-rdv__report">
            Reportée {d.nb_reports} fois
          </span>
        )}
      </div>
    </article>
  );
}
