// Carte de commande (liste des dossiers) : une boîte blanche bien séparée, une bande de couleur
// du statut en haut, des badges distincts par information, la prochaine étape en clair et les
// boutons d'action du serveur, utilisables directement depuis la carte.
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Paperclip, UserRound } from 'lucide-react';
import { formatDate, formatFCFA, MACHINE_LABELS, type Machine } from '@evocom/shared';
import type { DossierResume } from '../../lib/types';
import { MachineIcone, PaymentBadge } from '../../ui';
import { DossierActions } from '../dossiers/DossierActions';
import { enRetard, resumeSpecs } from './CarteDossier';
import { EN_CLAIR } from './enClair';

type Libelle = (machine: Machine, code: string) => string;

export function CarteCommande({ d, libelle, montrerMontant, montrerPrep, index = 0 }: { index?: number; d: DossierResume; libelle: Libelle; montrerMontant: boolean; montrerPrep: boolean }) {
  const navigate = useNavigate();
  const retard = enRetard(d);
  const clair = EN_CLAIR[d.statut];
  const ouvrir = () => navigate(`/dossiers/${d.id}`);
  return (
    <article className="cc" style={{ '--i': index } as React.CSSProperties} data-statut={d.statut} data-urgent={d.urgent || undefined} aria-label={`Commande ${d.numero}, ${d.client_nom}`}>
      <div className="cc__bande" aria-hidden="true" />
      <div className="cc__corps" onClick={ouvrir}>
        <header className="cc__haut">
          <span className="cc__numero">{d.numero}</span>
          {d.urgent && <span className="cc__urgent">Urgent</span>}
          <span className="cc__statut">{clair.etiquette}</span>
        </header>
        <h3 className="cc__client">
          <a
            href={`/dossiers/${d.id}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              ouvrir();
            }}
          >
            {d.client_nom}
          </a>
        </h3>
        <div className="cc__badges">
          <span className="cc__machine" data-machine={d.machine}>
            <MachineIcone machine={d.machine} taille={14} />
            {MACHINE_LABELS[d.machine]}
          </span>
          {montrerPrep && d.preparateur_nom && (
            <span className="cc__badge">
              <UserRound aria-hidden="true" />
              {d.preparateur_nom}
            </span>
          )}
          <span className="cc__badge" data-vide={!d.nb_fichiers || undefined}>
            <Paperclip aria-hidden="true" />
            {d.nb_fichiers ? `${d.nb_fichiers} fichier${d.nb_fichiers > 1 ? 's' : ''}` : 'Aucun fichier'}
          </span>
        </div>
        <p className="cc__travail">{resumeSpecs(d, libelle)}</p>
        <p className="cc__suite" data-tone={d.statut === 'a_revoir' ? 'alerte' : undefined}>
          {clair.suite(d)}
        </p>
        <div className="cc__infos">
          <span className="cc__date" data-retard={retard || undefined}>
            <CalendarDays aria-hidden="true" />
            {d.date_promise ? `${retard ? 'En retard · ' : ''}Pour le ${formatDate(d.date_promise)}` : `Reçue le ${formatDate(d.created_at)}`}
          </span>
          {montrerMontant && (
            <span className="cc__montant">
              <span className="ev-num">{d.montant === null || d.montant === undefined ? 'Montant à fixer' : formatFCFA(d.montant)}</span>
              {d.situation_paiement && <PaymentBadge situation={d.situation_paiement} enAttente={d.en_attente_validation} />}
            </span>
          )}
        </div>
      </div>
      <footer className="cc__actions">
        <DossierActions dossier={d} size="sm" />
        <button type="button" className="ev-btn ev-btn--ghost ev-btn--sm cc__ouvrir" onClick={ouvrir}>
          Ouvrir
          <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}
