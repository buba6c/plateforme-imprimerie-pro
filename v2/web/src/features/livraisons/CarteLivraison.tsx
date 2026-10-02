// Carte d'une livraison pour le livreur (téléphone d'abord) : qui, où, quand, combien,
// appeler, itinéraire, puis l'action principale en gros bouton.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Clock, MapPin, Navigation, Phone, Undo2 } from 'lucide-react';
import { formatDate, formatFCFA, type ActionId } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Button, ConfirmDialog, PaymentBadge, Ref, UrgentTag, useToast } from '../../ui';
import { DossierActions } from '../dossiers/DossierActions';
import { useAction } from '../dossiers/hooks';
import { ecartJours, libelleRendezVous } from './dates';
import { lienItineraire, lienTelephone, resteAEncaisser } from './hooks';
import { ReporterDialog } from './ReporterDialog';

/** Ne garde, parmi les actions renvoyées par le serveur, que celles demandées. */
function avec(d: DossierResume, ids: ActionId[]): DossierResume {
  return { ...d, actions: d.actions.filter((a) => ids.includes(a)) };
}

function Echeance({ d }: { d: DossierResume }) {
  if (d.statut === 'en_livraison' && d.livraison_prevue_at) {
    const e = ecartJours(d.livraison_prevue_at);
    const depasse = new Date(d.livraison_prevue_at).getTime() < Date.now();
    return (
      <p className="lv-card__quand" data-tone={depasse ? 'retard' : undefined}>
        <Clock aria-hidden="true" />
        <span>
          {libelleRendezVous(d.livraison_prevue_at)}
          {depasse && <strong>{e < 0 ? ' · en retard' : ' · heure dépassée'}</strong>}
        </span>
      </p>
    );
  }
  if (d.date_promise) {
    const depasse = ecartJours(d.date_promise) < 0;
    return (
      <p className="lv-card__quand" data-tone={depasse ? 'retard' : undefined}>
        <CalendarClock aria-hidden="true" />
        <span>
          Promis pour le {formatDate(d.date_promise)}
          {depasse && <strong> · date dépassée</strong>}
        </span>
      </p>
    );
  }
  return null;
}

function Montant({ d }: { d: DossierResume }) {
  const reste = resteAEncaisser(d);
  const attente = d.en_attente_validation ?? 0;
  if (reste === null) {
    return (
      <div className="lv-card__montant">
        <span className="lv-card__montant-label">À encaisser</span>
        <span className="ev-muted">Montant à définir</span>
      </div>
    );
  }
  if (reste === 0) {
    return (
      <div className="lv-card__montant">
        <span className="lv-card__montant-label">À encaisser</span>
        <span className="row">
          <span className="ev-num lv-montant lv-montant--nul">0 FCFA</span>
          {d.situation_paiement && <PaymentBadge situation={d.situation_paiement} enAttente={attente} />}
        </span>
      </div>
    );
  }
  return (
    <div className="lv-card__montant">
      <span className="lv-card__montant-label">
        À encaisser
        {attente > 0 && <small>{formatFCFA(attente)} déjà remis, en attente de validation</small>}
      </span>
      <span className="ev-num lv-montant">{formatFCFA(reste)}</span>
    </div>
  );
}

export function CarteLivraison({ d, montrerLivreur }: { d: DossierResume; montrerLivreur?: boolean }) {
  const toast = useToast();
  const [reporter, setReporter] = useState(false);
  const [retirer, setRetirer] = useState(false);
  const retrait = useAction(d.id);
  const enTournee = d.statut === 'en_livraison';
  const adresse = d.adresse_livraison?.trim() || null;
  const tel = d.client_telephone?.trim() || null;
  const peutLivrer = d.actions.includes('confirmer_livraison');

  return (
    <article className="ev-job lv-card" data-urgent={d.urgent} aria-label={`${d.client_nom}, dossier ${d.numero}`}>
      <div className="lv-card__top">
        <Link to={`/dossiers/${d.id}`} className="lv-card__ref" aria-label={`Ouvrir le dossier ${d.numero}`}>
          <Ref>{d.numero}</Ref>
        </Link>
        {d.urgent && <UrgentTag />}
        {montrerLivreur && enTournee && <span className="lv-card__livreur">{d.livreur_nom ?? 'Sans livreur'}</span>}
      </div>

      <div className="lv-card__qui">
        <Link to={`/dossiers/${d.id}`} className="lv-card__client">
          {d.client_nom}
        </Link>
        <p className="lv-card__adresse" data-vide={!adresse}>
          <MapPin aria-hidden="true" />
          <span>{adresse ?? 'Adresse à confirmer avec le client'}</span>
        </p>
        {d.notes_livraison && <p className="lv-card__notes">{d.notes_livraison}</p>}
      </div>

      <Echeance d={d} />
      <Montant d={d} />

      <div className="lv-card__contact" data-seul={!(tel && adresse)}>
        {tel ? (
          <a className="ev-btn ev-btn--lg" href={lienTelephone(tel)} aria-label={`Appeler ${d.client_nom} au ${tel}`}>
            <Phone aria-hidden="true" />
            <span className="ev-mono">{tel}</span>
          </a>
        ) : (
          <span className="lv-card__sans-tel">Numéro non renseigné</span>
        )}
        {adresse && (
          <a className="ev-btn ev-btn--lg" href={lienItineraire(adresse)} target="_blank" rel="noopener noreferrer" aria-label={`Itinéraire vers ${adresse} (ouvre Google Maps)`}>
            <Navigation aria-hidden="true" />
            Itinéraire
          </a>
        )}
      </div>

      {peutLivrer && (
        <div className="lv-card__actions">
          {enTournee ? (
            <>
              <DossierActions dossier={avec(d, ['confirmer_livraison'])} size="lg" block />
              <div className="lv-card__secondaires">
                <Button icon={<CalendarClock />} onClick={() => setReporter(true)}>
                  Reporter
                </Button>
                {d.actions.includes('retirer_tournee') && (
                  <Button variant="ghost" icon={<Undo2 />} onClick={() => setRetirer(true)}>
                    Retirer de la tournée
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <DossierActions dossier={avec(d, ['programmer_livraison'])} size="lg" block />
              <div className="lv-secondaire">
                <DossierActions dossier={avec(d, ['confirmer_livraison'])} block />
              </div>
            </>
          )}
        </div>
      )}

      {reporter && <ReporterDialog dossier={d} onClose={() => setReporter(false)} />}
      <ConfirmDialog
        open={retirer}
        onClose={() => setRetirer(false)}
        title="Retirer de la tournée ?"
        description={`Le dossier ${d.numero} (${d.client_nom}) revient dans « À programmer ». Vous pourrez le reprogrammer plus tard.`}
        confirmLabel="Retirer de la tournée"
        busy={retrait.isPending}
        onConfirm={() =>
          retrait.mutate(
            { action: 'retirer_tournee', input: {} },
            {
              onSuccess: () => {
                toast.success('Livraison retirée de la tournée', d.numero);
                setRetirer(false);
              },
              onError: (e) => toast.error('Action impossible', messageErreur(e)),
            },
          )
        }
      />
    </article>
  );
}
