// Éléments communs des écrans commerciaux : badges de statut, lignes et totaux d'un document.
import type { ReactNode } from 'react';
import { formatFCFA, STATUT_DEVIS_LABELS, type StatutDevis, type StatutFacture } from '@evocom/shared';
import { formatQuantite, uniteCourte, uniteTarif } from './format';
import type { LigneDocument } from './types';

/**
 * Statut d'un devis, avec les styles de badge existants :
 * brouillon = en préparation, envoyé = en attente (info), accepté = succès,
 * refusé = danger, converti = clos.
 */
export function DevisStatutBadge({ statut }: { statut: StatutDevis }) {
  const label = STATUT_DEVIS_LABELS[statut];
  if (statut === 'refuse') {
    return (
      <span className="ev-badge ev-status ev-pay" data-pay="refuse">
        {label}
      </span>
    );
  }
  const apparence: Record<Exclude<StatutDevis, 'refuse'>, string> = {
    brouillon: 'en_cours',
    envoye: 'pret_impression',
    accepte: 'livre',
    converti: 'termine',
  };
  return (
    <span className="ev-badge ev-status" data-statut={apparence[statut]}>
      {label}
    </span>
  );
}

export const STATUT_FACTURE_LABELS: Record<StatutFacture, string> = { emise: 'Émise', annulee: 'Annulée' };

export function FactureStatutBadge({ statut }: { statut: StatutFacture }) {
  return statut === 'annulee' ? (
    <span className="ev-badge ev-status ev-pay" data-pay="refuse">
      Annulée
    </span>
  ) : (
    <span className="ev-badge ev-status" data-statut="termine">
      Émise
    </span>
  );
}

/** Tableau des lignes d'un devis ou d'une facture. Sur téléphone, quantité et prix passent sous la désignation. */
export function LignesDocument({ lignes, vide }: { lignes: LigneDocument[]; vide?: string }) {
  if (!lignes.length) {
    return <p className="ev-muted" style={{ margin: 0 }}>{vide ?? 'Aucune ligne détaillée.'}</p>;
  }
  return (
    <table className="cm-lines">
      <thead>
        <tr>
          <th scope="col">Désignation</th>
          <th scope="col" className="cm-num cm-col-large">Quantité</th>
          <th scope="col" className="cm-num cm-col-large">Prix unitaire</th>
          <th scope="col" className="cm-num">Total</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={i}>
            <td>
              <span className="cm-lines__designation">{l.designation}</span>
              {l.detail && <span className="cm-lines__detail">{l.detail}</span>}
              {l.quantite !== null && (
                <span className="cm-lines__detail cm-col-etroit ev-mono">
                  {formatQuantite(l.quantite)} {uniteCourte(l.unite, l.quantite)}
                  {l.prix_unitaire !== null && ` × ${formatFCFA(l.prix_unitaire)}`}
                </span>
              )}
            </td>
            <td className="cm-num cm-col-large">
              {l.quantite === null ? '' : (
                <>
                  {formatQuantite(l.quantite)} <span className="cm-unite">{uniteCourte(l.unite, l.quantite)}</span>
                </>
              )}
            </td>
            <td className="cm-num cm-col-large">
              {l.prix_unitaire === null ? '' : (
                <>
                  {formatFCFA(l.prix_unitaire)}
                  {l.unite && <span className="cm-lines__detail cm-lines__pu">{uniteTarif(l.unite)}</span>}
                </>
              )}
            </td>
            <td className="cm-num">{formatFCFA(l.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface LigneTotal {
  label: ReactNode;
  valeur: ReactNode;
  fort?: boolean;
  tone?: 'danger' | 'success';
}

/** Bloc de totaux aligné à droite, montants en chiffres à chasse fixe. */
export function Totaux({ lignes, label = 'Totaux' }: { lignes: LigneTotal[]; label?: string }) {
  return (
    <dl className="cm-totaux" aria-label={label}>
      {lignes.map((l, i) => (
        <div key={i} className="cm-totaux__ligne" data-fort={l.fort || undefined} data-tone={l.tone}>
          <dt>{l.label}</dt>
          <dd>{l.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Bloc « intitulé + contenu » d'un document (client, émetteur, objet). */
export function BlocDocument({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="cm-bloc">
      <h3 className="section-title">{titre}</h3>
      <div className="cm-bloc__corps">{children}</div>
    </div>
  );
}
