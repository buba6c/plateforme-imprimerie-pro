import type { ReactNode } from 'react';
import { formatEntier } from '@evocom/shared';

export interface ElementResume {
  label: string;
  /** Valeur brute (nombre de dossiers…). */
  value?: ReactNode;
  /** Montant en FCFA : affiché avec l'unité en petit ; null = inconnu (« — »). */
  montant?: number | null;
  meta?: ReactNode;
  /** Valeur principale : occupe toute la largeur sur téléphone. */
  large?: boolean;
  tone?: 'alert' | 'success' | 'danger';
}

/** Bandeau de chiffres compact, lisible au soleil sur téléphone. */
export function Resume({ items, label }: { items: ElementResume[]; label: string }) {
  return (
    <dl className="ev-card lv-resume" aria-label={label}>
      {items.map((i) => (
        <div key={i.label} className="lv-resume__item" data-large={i.large || undefined} data-tone={i.tone}>
          <dt>{i.label}</dt>
          <dd>
            <span className="lv-resume__valeur">
              {i.montant !== undefined ? (
                i.montant === null ? (
                  '—'
                ) : (
                  <>
                    {formatEntier(i.montant)}
                    <small>FCFA</small>
                  </>
                )
              ) : (
                i.value
              )}
            </span>
            {i.meta && <span className="lv-resume__meta">{i.meta}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
