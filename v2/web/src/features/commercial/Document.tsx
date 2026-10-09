// Éléments communs des écrans commerciaux : badges de statut, lignes et totaux d'un document.
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatFCFA, STATUT_DEVIS_LABELS, type StatutDevis, type StatutFacture } from '@evocom/shared';
import { formatQuantite, uniteCourte, uniteTarif } from './format';
import type { JournalVosFactures, LigneDocument } from './types';

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

/**
 * Statut d'une facture : émise (vert sobre), annulée (rouge), envoyée à VosFactures (bleu « livré »)
 * ou envoi en erreur (orange « à revoir »), selon le journal d'envoi.
 */
export function FactureStatutBadge({ statut, vosfactures }: { statut: StatutFacture; vosfactures?: JournalVosFactures | null }) {
  if (statut === 'annulee') {
    return (
      <span className="ev-badge ev-status ev-pay" data-pay="refuse">
        Annulée
      </span>
    );
  }
  if (vosfactures?.id) {
    return (
      <span className="ev-badge ev-status" data-statut="livre">
        Envoyée à VosFactures
      </span>
    );
  }
  if (vosfactures?.erreur) {
    return (
      <span className="ev-badge ev-status" data-statut="a_revoir" title={vosfactures.erreur}>
        Envoi VosFactures à refaire
      </span>
    );
  }
  return (
    <span className="ev-badge ev-status" data-statut="termine">
      Émise
    </span>
  );
}

/** Colonne « VosFactures » d'une liste : numéro distant et lien, erreur, ou tiret. */
export function VosFacturesCellule({ j, actif }: { j: JournalVosFactures | null | undefined; actif: boolean }) {
  if (j?.id) {
    return (
      <span className="cm-vf">
        {j.url ? (
          <a className="ev-link ev-ref" href={j.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {j.numero ?? `n° ${j.id}`}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : (
          <span className="ev-ref">{j.numero ?? `n° ${j.id}`}</span>
        )}
        {j.annulee_at && <span className="ev-cell-sub">Annulée là-bas aussi</span>}
        {!j.annulee_at && j.annulation_erreur && <span className="ev-cell-sub cm-danger">Annulation à refaire</span>}
      </span>
    );
  }
  if (j?.erreur) {
    return (
      <span className="cm-vf">
        <span className="cm-danger">Envoi échoué</span>
        <span className="ev-cell-sub truncate" title={j.erreur}>
          {j.erreur}
        </span>
      </span>
    );
  }
  return <span className="ev-muted">{actif ? 'Non envoyée' : '—'}</span>;
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
                <span className="cm-lines__detail cm-col-etroit cm-tabulaire">
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
                  {l.unite && l.unite !== 'forfait' && <span className="cm-lines__detail cm-lines__pu">{uniteTarif(l.unite)}</span>}
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
