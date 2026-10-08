import { MODE_PAIEMENT_LABELS, type ModePaiement } from '@evocom/shared';
import './paiements.css';

/** Pastille du mode de paiement (Espèces, Wave, Orange Money…), colorée par les variables de la charte. */
export function ModePastille({ mode, taille = 'md' }: { mode: ModePaiement; taille?: 'sm' | 'md' }) {
  return (
    <span className="pay-mode" data-mode={mode} data-taille={taille}>
      <span className="pay-mode__point" aria-hidden="true" />
      {MODE_PAIEMENT_LABELS[mode] ?? mode}
    </span>
  );
}
