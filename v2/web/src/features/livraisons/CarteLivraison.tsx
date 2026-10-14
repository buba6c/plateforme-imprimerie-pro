// Carte d'une livraison pour le livreur (téléphone d'abord) : l'état en bandeau (prêt au départ,
// programmée, en retard), qui, où, quand, combien reste à encaisser, appeler, itinéraire, puis
// l'action principale en gros bouton.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, Banknote, CalendarClock, Clock, MapPin, Navigation, PackageCheck, Phone, Truck, Undo2 } from 'lucide-react';
import { formatDate, formatFCFA, type ActionId } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { Button, ConfirmDialog, PaymentBadge, Ref, UrgentTag, useToast } from '../../ui';
import { DossierActions } from '../dossiers/DossierActions';
import { useAction } from '../dossiers/hooks';
import { ecartJours, libelleRendezVous } from './dates';
import { lienItineraire, lienTelephone, resteAEncaisser } from './hooks';
import { ReporterDialog } from './ReporterDialog';
import { MiniaturesDossier } from '../fichiers/MiniaturesDossier';
import { FixerMontantDialog } from './FixerMontantDialog';

type Etat = 'a_programmer' | 'tournee' | 'retard';

/** Ne garde, parmi les actions renvoyées par le serveur, que celles demandées. */
function avec(d: DossierResume, ids: ActionId[]): DossierResume {
  return { ...d, actions: d.actions.filter((a) => ids.includes(a)) };
}

function etatDe(d: DossierResume): Etat {
  if (d.statut !== 'en_livraison') return 'a_programmer';
  return d.livraison_prevue_at && new Date(d.livraison_prevue_at).getTime() < Date.now() ? 'retard' : 'tournee';
}

function Bandeau({ d, etat }: { d: DossierResume; etat: Etat }) {
  if (etat === 'a_programmer' && d.mode_remise === 'retrait') {
    return (
      <>
        <PackageCheck aria-hidden="true" />
        <span>Le client passe le chercher</span>
        {d.date_promise && (
          <span className="lv-card__bande-meta" data-tone={ecartJours(d.date_promise) < 0 ? 'retard' : undefined}>
            promis le {formatDate(d.date_promise)}
          </span>
        )}
      </>
    );
  }
  if (etat === 'a_programmer') {
    return (
      <>
        <PackageCheck aria-hidden="true" />
        <span>Prêt au départ</span>
        {d.date_promise && (
          <span className="lv-card__bande-meta" data-tone={ecartJours(d.date_promise) < 0 ? 'retard' : undefined}>
            promis le {formatDate(d.date_promise)}
          </span>
        )}
      </>
    );
  }
  if (etat === 'retard') {
    return (
      <>
        <AlarmClock aria-hidden="true" />
        <span>En retard</span>
        {d.livraison_prevue_at && <span className="lv-card__bande-meta">{libelleRendezVous(d.livraison_prevue_at)}</span>}
      </>
    );
  }
  return (
    <>
      <Truck aria-hidden="true" />
      <span>{d.livraison_prevue_at ? libelleRendezVous(d.livraison_prevue_at) : 'Programmée'}</span>
    </>
  );
}

function Montant({ d, onFixer }: { d: DossierResume; onFixer?: () => void }) {
  const reste = resteAEncaisser(d);
  const attente = d.en_attente_validation ?? 0;
  if (reste === null) {
    return (
      <div className="lv-card__tuile" data-tone="retard">
        <span className="lv-card__tuile-libelle">
          <Banknote aria-hidden="true" />À encaisser
        </span>
        <span className="lv-card__tuile-valeur lv-card__tuile-valeur--texte">Montant à définir</span>
        {onFixer && (
          <button type="button" className="ev-btn ev-btn--sm" style={{ marginTop: 4 }} onClick={onFixer}>
            Fixer le montant
          </button>
        )}
      </div>
    );
  }
  if (reste === 0) {
    return (
      <div className="lv-card__tuile" data-tone="neutre">
        <span className="lv-card__tuile-libelle">À encaisser</span>
        <span className="lv-card__tuile-valeur lv-card__tuile-valeur--texte">
          Rien
          {d.situation_paiement && <PaymentBadge situation={d.situation_paiement} enAttente={attente} />}
        </span>
      </div>
    );
  }
  return (
    <div className="lv-card__tuile" data-tone="argent">
      <span className="lv-card__tuile-libelle">
        <Banknote aria-hidden="true" />À encaisser
      </span>
      <span className="lv-card__tuile-valeur ev-num">{formatFCFA(reste)}</span>
      {attente > 0 && <small>{formatFCFA(attente)} déjà remis, à valider</small>}
    </div>
  );
}

function Quand({ d, etat }: { d: DossierResume; etat: Etat }) {
  if (etat === 'a_programmer') {
    const depasse = d.date_promise ? ecartJours(d.date_promise) < 0 : false;
    return (
      <div className="lv-card__tuile" data-tone={depasse ? 'retard' : 'neutre'}>
        <span className="lv-card__tuile-libelle">
          <CalendarClock aria-hidden="true" />Promis
        </span>
        <span className="lv-card__tuile-valeur lv-card__tuile-valeur--texte">{d.date_promise ? formatDate(d.date_promise) : 'Sans date'}</span>
        {depasse && <small>date dépassée</small>}
      </div>
    );
  }
  const e = d.livraison_prevue_at ? ecartJours(d.livraison_prevue_at) : null;
  return (
    <div className="lv-card__tuile" data-tone={etat === 'retard' ? 'retard' : 'quand'}>
      <span className="lv-card__tuile-libelle">
        <Clock aria-hidden="true" />Passage
      </span>
      <span className="lv-card__tuile-valeur lv-card__tuile-valeur--texte">{d.livraison_prevue_at ? libelleRendezVous(d.livraison_prevue_at) : 'Heure à fixer'}</span>
      {etat === 'retard' && <small>{e !== null && e < 0 ? `${-e} jour${-e > 1 ? 's' : ''} de retard` : 'heure dépassée'}</small>}
    </div>
  );
}

export function CarteLivraison({ d, montrerLivreur }: { d: DossierResume; montrerLivreur?: boolean }) {
  const toast = useToast();
  const [reporter, setReporter] = useState(false);
  const [retirer, setRetirer] = useState(false);
  const [fixer, setFixer] = useState(false);
  const retrait = useAction(d.id);
  const etat = etatDe(d);
  const enTournee = d.statut === 'en_livraison';
  const adresse = d.adresse_livraison?.trim() || null;
  const tel = d.client_telephone?.trim() || null;
  const surPlace = d.mode_remise === 'retrait' && d.statut === 'pret_livraison';
  const peutLivrer = d.actions.includes('confirmer_livraison');
  const peutRemettre = surPlace && d.actions.includes('remettre_client');

  return (
    <article className="ev-job lv-card" data-etat={etat} data-sur-place={surPlace || undefined} data-urgent={d.urgent || undefined} aria-label={`${d.client_nom}, dossier ${d.numero}`}>
      <div className="lv-card__bande">
        <Bandeau d={d} etat={etat} />
        {d.urgent && <UrgentTag />}
      </div>

      <div className="lv-card__corps">
        <div className="lv-card__tete">
          <Link to={`/dossiers/${d.id}`} className="lv-card__client">
            {d.client_nom}
          </Link>
          <Link to={`/dossiers/${d.id}`} className="lv-card__ref" aria-label={`Ouvrir le dossier ${d.numero}`}>
            <Ref>{d.numero}</Ref>
          </Link>
        </div>
        {montrerLivreur && enTournee && <span className="lv-card__livreur">{d.livreur_nom ?? 'Sans livreur désigné'}</span>}
        <p className="lv-card__adresse" data-vide={!adresse && !surPlace}>
          <MapPin aria-hidden="true" />
          <span>{surPlace ? 'À remettre au comptoir : le client vient le chercher' : (adresse ?? 'Adresse à confirmer avec le client')}</span>
        </p>
        {d.notes_livraison && <p className="lv-card__notes">{d.notes_livraison}</p>}
        <MiniaturesDossier dossierId={d.id} fichiers={d.fichiers_apercu ?? []} total={d.nb_fichiers} resume={d.resume_specs} />

        <div className="lv-card__tuiles">
          <Quand d={d} etat={etat} />
          <Montant d={d} onFixer={() => setFixer(true)} />
        </div>

        <div className="lv-card__contact" data-seul={!(tel && adresse)}>
          {tel ? (
            <a className="ev-btn ev-btn--lg lv-card__bouton" href={lienTelephone(tel)} aria-label={`Appeler ${d.client_nom} au ${tel}`}>
              <Phone aria-hidden="true" />
              <span className="ev-mono">{tel}</span>
            </a>
          ) : (
            <span className="lv-card__sans-tel">Numéro non renseigné</span>
          )}
          {adresse && !surPlace && (
            <a className="ev-btn ev-btn--lg lv-card__bouton" href={lienItineraire(adresse)} target="_blank" rel="noopener noreferrer" aria-label={`Itinéraire vers ${adresse} (ouvre Google Maps)`}>
              <Navigation aria-hidden="true" />
              Itinéraire
            </a>
          )}
        </div>

        {peutRemettre && (
          <div className="lv-card__actions">
            <DossierActions dossier={avec(d, ['remettre_client'])} size="lg" block />
            {d.actions.includes('programmer_livraison') && (
              <div className="lv-secondaire">
                <DossierActions dossier={avec(d, ['programmer_livraison'])} block />
              </div>
            )}
          </div>
        )}
        {peutLivrer && !surPlace && (
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
      </div>

      {reporter && <ReporterDialog dossier={d} onClose={() => setReporter(false)} />}
      {fixer && <FixerMontantDialog dossier={d} onClose={() => setFixer(false)} />}
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
