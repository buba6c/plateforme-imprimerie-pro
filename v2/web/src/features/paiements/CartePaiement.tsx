// Un paiement en carte lisible : montant très visible, mode, référence, qui a encaissé et quand,
// dossier (numéro + client) ; actions Valider / Refuser pour les paiements à vérifier.
import type { MouseEvent } from 'react';
import { Check, X } from 'lucide-react';
import { formatDateHeure, formatEntier, formatRelatif, MACHINE_LABELS, ROLE_LABELS, type Role } from '@evocom/shared';
import { Button, PaiementStatutBadge } from '../../ui';
import { ModePastille } from './ModePastille';
import type { PaiementAdmin } from './types';
import './paiements.css';

export type Sortie = 'valide' | 'refuse';

interface Props {
  p: PaiementAdmin;
  selectionnable: boolean;
  selectionne: boolean;
  onSelection: (v: boolean) => void;
  onOuvrir: () => void;
  onValider: () => void;
  onRefuser: () => void;
  enCours: boolean;
  bloque: boolean;
  sortie?: Sortie;
  roles: Map<number, Role>;
}

export function CartePaiement({ p, selectionnable, selectionne, onSelection, onOuvrir, onValider, onRefuser, enCours, bloque, sortie, roles }: Props) {
  const aVerifier = p.statut === 'a_valider';
  const role = p.encaisse_par ? roles.get(p.encaisse_par) : undefined;
  const ouvrirSiFond = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, label, textarea, select')) return;
    onOuvrir();
  };
  return (
    <article
      className="pay-carte"
      data-statut={p.statut}
      data-selection={selectionne || undefined}
      data-sans-case={!selectionnable || undefined}
      data-sortie={sortie}
      onClick={ouvrirSiFond}
      aria-label={`Paiement de ${formatEntier(p.montant)} FCFA, dossier ${p.numero}`}
    >
      {selectionnable && (
        <label className="ev-check pay-carte__case">
          <input type="checkbox" checked={selectionne} onChange={(e) => onSelection(e.target.checked)} disabled={!!sortie} />
          <span className="ev-check__box" aria-hidden="true" />
          <span className="sr-only">
            Sélectionner le paiement de {formatEntier(p.montant)} FCFA du dossier {p.numero}
          </span>
        </label>
      )}

      <div className="pay-carte__montant">
        <span className="pay-montant">
          {formatEntier(p.montant)}
          <small>FCFA</small>
        </span>
        <span className="row" style={{ gap: 'var(--space-2)' }}>
          <ModePastille mode={p.mode} />
        </span>
        <span className="pay-ref">{p.reference ? <>Réf. <span className="ev-ref">{p.reference}</span></> : 'Sans référence'}</span>
      </div>

      <div className="pay-carte__dossier">
        <button type="button" className="ev-numero pay-numero" onClick={onOuvrir} aria-label={`Voir le dossier ${p.numero} (${p.client_nom})`}>
          {p.numero}
        </button>
        <span className="pay-client" title={p.client_nom}>
          {p.client_nom}
        </span>
        <span className="pay-tags">
          <span className="pay-tag" data-machine={p.machine}>
            {MACHINE_LABELS[p.machine]}
          </span>
          {p.importe && <span className="pay-tag">Importé</span>}
          {p.dossier_supprime && (
            <span className="pay-tag" data-ton="danger">
              Dossier à la corbeille
            </span>
          )}
        </span>
      </div>

      <div className="pay-carte__qui">
        <span>
          Encaissé par <span className="pay-qui">{p.encaisse_par_nom ?? 'inconnu (import)'}</span>
          {role ? ` · ${ROLE_LABELS[role]}` : ''}
        </span>
        <span title={formatDateHeure(p.encaisse_at)}>
          {formatDateHeure(p.encaisse_at)} · {formatRelatif(p.encaisse_at)}
        </span>
        {p.notes && <span>{p.notes}</span>}
        {p.statut === 'valide' && (
          <span>
            Validé par {p.valide_par_nom ?? '—'} · {formatDateHeure(p.valide_at)}
          </span>
        )}
        {p.statut === 'refuse' && (
          <span className="pay-motif">
            Refusé par {p.valide_par_nom ?? '—'} : {p.motif_refus ?? '—'}
          </span>
        )}
      </div>

      <div className="pay-carte__actions">
        {aVerifier && !sortie ? (
          <>
            <Button
              size="sm"
              variant="primary"
              icon={<Check />}
              busy={enCours}
              disabled={bloque || p.dossier_supprime}
              onClick={onValider}
              title={p.dossier_supprime ? 'Le dossier est à la corbeille : restaurez-le avant de valider, ou refusez ce paiement.' : undefined}
              aria-label={`Valider ${formatEntier(p.montant)} FCFA du dossier ${p.numero}`}
            >
              Valider
            </Button>
            <Button size="sm" icon={<X />} disabled={bloque || enCours} onClick={onRefuser} aria-label={`Refuser le paiement du dossier ${p.numero}`}>
              Refuser
            </Button>
          </>
        ) : (
          <PaiementStatutBadge statut={sortie === 'valide' ? 'valide' : sortie === 'refuse' ? 'refuse' : p.statut} />
        )}
      </div>

      {sortie && (
        <div className="pay-sceau" role="status">
          {sortie === 'valide' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
          {sortie === 'valide' ? 'Validé' : 'Refusé'}
        </div>
      )}
    </article>
  );
}
