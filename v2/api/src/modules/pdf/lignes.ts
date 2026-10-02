// Lignes de document (devis, facture) construites à partir du détail de prix du moteur.

import {
  formatDecimal,
  formatDimensions,
  formatEntier,
  type LignePrix,
  type LigneRoland,
  type LigneXerox,
  type Machine,
} from '@evocom/shared';

export interface LigneDocument {
  designation: string;
  /** Précision affichée sous la désignation (dimensions, pages…). */
  detail: string | null;
  quantite: number | null;
  unite: string | null;
  prix_unitaire: number | null;
  total: number;
}

interface DetailPrixStocke {
  lignes?: LignePrix[];
  sous_total?: number;
  remise?: number;
  arrondi?: number;
  total_ht?: number;
  tva?: number;
  total_ttc?: number;
}

/** Résumé d'une ligne de spécification : dimensions et quantité, ou pages et exemplaires. */
export function resumeSpec(machine: Machine, spec: LigneRoland | LigneXerox | undefined): string | null {
  if (!spec) return null;
  const parts: string[] = [];
  if (machine === 'roland') {
    const r = spec as LigneRoland;
    parts.push(formatDimensions(r.largeur, r.hauteur, r.unite));
    parts.push(`${formatEntier(r.quantite)} ex.`);
  } else {
    const x = spec as LigneXerox;
    parts.push(`${formatEntier(x.pages)} page${x.pages > 1 ? 's' : ''}${x.recto_verso ? ' recto-verso' : ''}`);
    parts.push(`${formatEntier(x.quantite)} ex.`);
  }
  if (spec.description) parts.push(spec.description);
  return parts.join(' · ');
}

/** Lignes de produits (sans remise ni arrondi) d'un détail de prix. */
export function lignesProduits(machine: Machine, specs: { lignes?: unknown[] } | null, detail: DetailPrixStocke | null): LigneDocument[] {
  const specLignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  return (detail?.lignes ?? []).map((l) => {
    const spec = l.groupe >= 0 ? specLignes[l.groupe] : undefined;
    const estSupport = !!spec && spec.support === l.code;
    return {
      designation: l.libelle,
      detail: estSupport ? resumeSpec(machine, spec) : null,
      quantite: l.unite === 'pourcent' ? null : l.quantite,
      unite: l.unite === 'pourcent' ? null : l.unite,
      prix_unitaire: l.unite === 'pourcent' ? null : l.prix_unitaire,
      total: l.total,
    };
  });
}

/** Quantité affichée : entier groupé ou décimal à la française. */
export function quantiteFr(q: number | null): string {
  if (q === null || q === undefined) return '';
  return Number.isInteger(q) ? formatEntier(q) : formatDecimal(q, 2);
}
