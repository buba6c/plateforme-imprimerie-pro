// Mise en forme des documents commerciaux : lignes, quantités, dates calendaires.
import {
  formatDate,
  formatDecimal,
  formatDimensions,
  formatEntier,
  UNITE_TARIF_LABELS,
  type LignePrix,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Specs,
  type UniteTarif,
} from '@evocom/shared';
import type { DetailPrix, LigneDocument } from './types';

/** Date calendaire « AAAA-MM-JJ » affichée JJ/MM/AAAA sans décalage de fuseau ; sinon formatDate. */
export function formatJour(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDate(value);
}

/** Aujourd'hui au format AAAA-MM-JJ (heure locale). */
export function aujourdhui(decalageJours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Quantité affichée : entier groupé ou décimal à la française. */
export function formatQuantite(q: number | null | undefined): string {
  if (q === null || q === undefined) return '';
  return Number.isInteger(q) ? formatEntier(q) : formatDecimal(q, 2);
}

/** Unité courte placée après la quantité (« 6 m² », « 500 faces »). */
const UNITES_COURTES: Record<UniteTarif, [string, string]> = {
  m2: ['m²', 'm²'],
  ml: ['ml', 'ml'],
  page: ['face', 'faces'],
  feuille: ['feuille', 'feuilles'],
  exemplaire: ['ex.', 'ex.'],
  unite: ['unité', 'unités'],
  forfait: ['forfait', 'forfaits'],
  pourcent: ['%', '%'],
};

export function uniteCourte(unite: string | null | undefined, quantite: number | null | undefined): string {
  if (!unite) return '';
  const u = UNITES_COURTES[unite as UniteTarif];
  if (!u) return unite;
  return quantite !== null && quantite !== undefined && quantite > 1 ? u[1] : u[0];
}

/** Libellé de prix unitaire (« au m² », « par face imprimée »). */
export function uniteTarif(unite: string | null | undefined): string {
  if (!unite) return '';
  return UNITE_TARIF_LABELS[unite as UniteTarif] ?? unite;
}

/** Résumé d'une ligne de spécification : dimensions et quantité, ou pages et exemplaires. */
function resumeSpec(machine: Machine, spec: LigneRoland | LigneXerox | undefined): string | null {
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

/** Lignes d'un devis construites à partir de son détail de prix (même règle que le PDF). */
export function lignesDevis(machine: Machine, specs: Specs | null, detail: DetailPrix | null): LigneDocument[] {
  const specLignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  return (detail?.lignes ?? []).map((l) => {
    const spec = l.groupe >= 0 ? specLignes[l.groupe] : undefined;
    const estSupport = !!spec && spec.support === l.code;
    return versLigneDocument(l, estSupport ? resumeSpec(machine, spec) : null);
  });
}

function versLigneDocument(l: LignePrix, detail: string | null): LigneDocument {
  const pourcent = l.unite === 'pourcent';
  return {
    designation: l.libelle,
    detail,
    quantite: pourcent ? null : l.quantite,
    unite: pourcent ? null : l.unite,
    prix_unitaire: pourcent ? null : l.prix_unitaire,
    total: l.total,
  };
}

/** Lignes d'une facture : forme « document » ou, à défaut, lignes brutes du moteur de prix. */
export function lignesFacture(lignes: unknown): LigneDocument[] {
  if (!Array.isArray(lignes)) return [];
  return lignes.map((l: any) => {
    if (l && typeof l.designation === 'string') return l as LigneDocument;
    if (l && typeof l.libelle === 'string') return versLigneDocument(l as LignePrix, null);
    return { designation: String(l?.designation ?? l?.libelle ?? 'Ligne'), detail: null, quantite: null, unite: null, prix_unitaire: null, total: Number(l?.total ?? 0) };
  });
}

/** « 3 dossiers », « 1 devis », « 0 facture ». */
export function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`): string {
  return `${formatEntier(n)} ${n > 1 ? plurielForme : singulier}`;
}
