// Lignes de document (devis, facture) construites à partir du détail de prix du moteur.

import {
  BORDS_LABELS,
  CODE_RECTO_VERSO,
  CONDITIONNEMENT_LABELS,
  FORMAT_XEROX_LABELS,
  formatDecimal,
  formatDimensions,
  formatEntier,
  libellePapier,
  libelleTypeDocument,
  PARTIE_LABELS,
  type LignePrix,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Tarif,
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

// ---------------------------------------------------------------------------
// Lignes regroupées : une ligne par produit, comme sur les documents de l'entreprise
// (« Impression Flyer », quantité en exemplaires, prix unitaire, total), les précisions en dessous.

type TarifLibelle = Pick<Tarif, 'code' | 'machine' | 'libelle'>;

function libelleCode(tarifs: TarifLibelle[], machine: Machine, code: string): string {
  const t = tarifs.find((x) => x.code === code && x.machine === machine) ?? tarifs.find((x) => x.code === code && x.machine === 'global');
  return t?.libelle ?? code;
}

const DIVISEUR_M2 = { mm: 1e6, cm: 1e4, m: 1 } as const;

/** Nom du produit : « Impression Flyer », « Impression Bâche standard ». */
export function titreLigne(machine: Machine, spec: LigneRoland | LigneXerox, tarifs: TarifLibelle[]): string {
  if (machine === 'roland') {
    const r = spec as LigneRoland;
    const support = r.support === 'autre' ? r.support_autre || 'sur mesure' : libelleCode(tarifs, 'roland', r.support).replace(/\s*\(.*\)$/, '');
    return `Impression ${support}`;
  }
  const x = spec as LigneXerox;
  const type = x.type_document && (x.type_document !== 'autre' || x.type_document_autre?.trim()) ? libelleTypeDocument(x) : null;
  const support = x.support === 'autre' ? x.support_autre || 'sur mesure' : libelleCode(tarifs, 'xerox', x.support);
  return `Impression ${type ?? support}`;
}

/** Précisions d'un produit, une par ligne : format, papier, impression, façonnage, remarque. */
export function descriptionLigne(machine: Machine, spec: LigneRoland | LigneXerox, tarifs: TarifLibelle[]): string[] {
  const out: string[] = [];
  const libelles = (codes: ({ code: string; quantite?: number } | string)[]) =>
    codes
      .map((c) => (typeof c === 'string' ? c : c.code))
      .filter((code) => code !== CODE_RECTO_VERSO)
      .map((code) => libelleCode(tarifs, machine, code));
  if (machine === 'roland') {
    const r = spec as LigneRoland;
    const m2 = (r.largeur * r.hauteur) / DIVISEUR_M2[r.unite];
    out.push(`Format : ${formatDimensions(r.largeur, r.hauteur, r.unite)} (${formatDecimal(m2, 2)} m²${r.quantite > 1 ? ' par exemplaire' : ''})`);
    const finitions = [r.bords && r.bords !== 'aucun' ? BORDS_LABELS[r.bords] : null, ...libelles(r.finitions ?? []), ...libelles(r.options ?? [])].filter(Boolean);
    if (finitions.length) out.push(`Finitions : ${finitions.join(', ')}`);
  } else {
    const x = spec as LigneXerox;
    if (x.support === 'autre') {
      // Article hors grille (casquettes, stylos…) : le titre porte déjà son nom ; seules les faces comptent.
      if (x.pages > 1 || x.recto_verso) out.push(`Impression : ${x.recto_verso ? 'R° Quadri V° Quadri' : 'R° Quadri'}, ${formatEntier(x.pages)} page${x.pages > 1 ? 's' : ''}`);
      const faconnage = [...libelles(x.finitions ?? []), ...libelles(x.options ?? [])];
      if (faconnage.length) out.push(`Façonnage : ${faconnage.join(', ')}`);
      if (spec.description) out.push(spec.description);
      return out;
    }
    const format =
      x.format === 'perso'
        ? x.format_largeur && x.format_hauteur
          ? `${formatDecimal(x.format_largeur)} × ${formatDecimal(x.format_hauteur)} mm`
          : 'format personnalisé'
        : x.format
          ? FORMAT_XEROX_LABELS[x.format]
          : libelleCode(tarifs, 'xerox', x.support);
    const partie = x.partie && x.partie !== 'unique' ? ` (${PARTIE_LABELS[x.partie].toLowerCase()})` : '';
    out.push(`Descriptif : ${format}, ${formatEntier(x.pages)} page${x.pages > 1 ? 's' : ''}${partie}`);
    if (x.papier) out.push(`Papier : ${libellePapier(x)}`);
    const couleur = x.couleur === 'nb' ? 'Noir et blanc' : 'Quadri';
    out.push(`Impression : ${x.recto_verso ? `R° ${couleur} V° ${couleur}` : `R° ${couleur}`}`);
    const faconnage = [
      x.pelliculage ? `Pelliculage ${x.pelliculage.type} ${x.pelliculage.faces === 'recto_verso' ? 'recto-verso' : 'recto'}` : null,
      ...libelles(x.finitions ?? []),
      ...libelles(x.options ?? []),
      x.numerotation ? `Numérotation à partir du n° ${String(x.numerotation.depart).padStart(x.numerotation.chiffres, '0')}` : null,
      x.faconnage_autre?.trim() || null,
    ].filter(Boolean);
    if (faconnage.length) out.push(`Façonnage : ${faconnage.join(', ')}`);
    if (x.conditionnement?.length) out.push(`Conditionnement : ${x.conditionnement.map((c) => CONDITIONNEMENT_LABELS[c]).join(', ')}`);
  }
  if (spec.description) out.push(spec.description);
  return out;
}

/**
 * Une ligne de document par ligne de spécification : total du groupe de prix, prix unitaire par
 * exemplaire ; puis les forfaits du dossier (livraison, conception…) chacun sur sa ligne.
 * Sans détail de prix (dossier importé, prix saisi), aucune ligne : l'appelant met un forfait global.
 */
export function lignesRegroupees(machine: Machine, specs: { lignes?: unknown[] } | null, detail: DetailPrixStocke | null, tarifs: TarifLibelle[]): LigneDocument[] {
  const specLignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  const lignesPrix = detail?.lignes ?? [];
  const out: LigneDocument[] = [];
  specLignes.forEach((spec, i) => {
    const groupe = lignesPrix.filter((l) => l.groupe === i);
    if (!groupe.length) return;
    const total = groupe.reduce((s, l) => s + l.total, 0);
    const quantite = spec.quantite > 0 ? spec.quantite : 1;
    const pu = total / quantite;
    out.push({
      designation: titreLigne(machine, spec, tarifs),
      detail: descriptionLigne(machine, spec, tarifs).join('\n') || null,
      quantite,
      unite: 'exemplaire',
      prix_unitaire: Number.isInteger(pu) ? pu : Math.round(pu * 100) / 100,
      total,
    });
  });
  for (const l of lignesPrix.filter((l) => l.groupe < 0)) {
    out.push({
      designation: l.libelle,
      detail: null,
      quantite: l.unite === 'pourcent' ? null : l.quantite,
      unite: l.unite === 'pourcent' ? null : l.unite,
      prix_unitaire: l.unite === 'pourcent' ? null : l.prix_unitaire,
      total: l.total,
    });
  }
  return out;
}
