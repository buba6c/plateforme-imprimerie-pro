// Moteur de prix : fonction pure, en entiers (FCFA), utilisée par le serveur (qui fait foi)
// et par l'interface (aperçu instantané). Aucun tarif manquant n'est remplacé par 0 :
// un code inconnu ou un prix non défini produit une erreur explicite.

import type { Machine } from './domain';
import type { Choix, LigneRoland, LigneXerox, Remise, Specs, UniteDimension } from './schemas';

export const UNITES_TARIF = ['m2', 'ml', 'page', 'feuille', 'exemplaire', 'unite', 'forfait', 'pourcent'] as const;
export type UniteTarif = (typeof UNITES_TARIF)[number];

export const UNITE_TARIF_LABELS: Record<UniteTarif, string> = {
  m2: 'au m²',
  ml: 'au mètre linéaire',
  page: 'par face imprimée',
  feuille: 'par feuille',
  exemplaire: 'par exemplaire',
  unite: "à l'unité",
  forfait: 'forfait',
  pourcent: '% du sous-total',
};

export const CATEGORIES_TARIF = ['support', 'finition', 'option', 'divers'] as const;
export type CategorieTarif = (typeof CATEGORIES_TARIF)[number];

export const CATEGORIE_TARIF_LABELS: Record<CategorieTarif, string> = {
  support: 'Supports et formats',
  finition: 'Finitions',
  option: 'Options',
  divers: 'Forfaits et services',
};

export interface Tarif {
  code: string;
  machine: Machine | 'global';
  categorie: CategorieTarif;
  libelle: string;
  unite: UniteTarif;
  /** Prix en FCFA ; null tant que l'administrateur ne l'a pas défini. */
  prix: number | null;
  actif: boolean;
}

export interface ParamsPrix {
  /** Arrondi du total à ce pas, vers le haut (0 = pas d'arrondi). */
  arrondi_pas: number;
  tva_applicable: boolean;
  tva_taux: number;
  /** Si vrai, les prix de la grille sont hors taxes et la TVA s'ajoute ; sinon ils sont TTC. */
  prix_saisis_ht: boolean;
  /** Surface minimale facturée par exemplaire en grand format (0 = aucune). */
  surface_min_m2: number;
}

export const PARAMS_PRIX_DEFAUT: ParamsPrix = {
  arrondi_pas: 100,
  tva_applicable: false,
  tva_taux: 18,
  prix_saisis_ht: false,
  surface_min_m2: 0,
};

export interface LignePrix {
  code: string;
  libelle: string;
  /** Quantité affichée (m² avec 2 décimales, faces, exemplaires…). */
  quantite: number;
  unite: UniteTarif;
  prix_unitaire: number;
  total: number;
  /** Index de la ligne de spécification d'origine, ou -1 pour les forfaits du dossier. */
  groupe: number;
}

export interface ResultatPrix {
  ok: true;
  lignes: LignePrix[];
  sous_total: number;
  remise: number;
  arrondi: number;
  total_ht: number;
  tva: number;
  total_ttc: number;
}

export interface ErreurPrix {
  ok: false;
  erreurs: string[];
}

const MM: Record<UniteDimension, number> = { mm: 1, cm: 10, m: 1000 };

function toMm(v: number, u: UniteDimension): number {
  return Math.round(v * MM[u]);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Ctx {
  machine: Machine;
  byCode: Map<string, Tarif>;
  erreurs: string[];
}

function chercher(ctx: Ctx, code: string, categories: readonly CategorieTarif[], contexte: string): Tarif | null {
  const t = ctx.byCode.get(`${ctx.machine}:${code}`) ?? ctx.byCode.get(`global:${code}`);
  if (!t || !t.actif || !categories.includes(t.categorie)) {
    ctx.erreurs.push(`${contexte} : « ${code} » n'existe pas dans la grille tarifaire ${ctx.machine === 'roland' ? 'Roland' : 'Xerox'}.`);
    return null;
  }
  if (t.prix === null) {
    ctx.erreurs.push(`${contexte} : le prix de « ${t.libelle} » n'est pas encore défini. Renseignez-le dans Tarifs.`);
    return null;
  }
  return t;
}

/** Quantité facturée pour une finition ou une option selon son unité. */
function quantitePour(
  t: Tarif,
  base: { surfaceMm2: number; perimetreMm: number; faces: number; feuilles: number; exemplaires: number },
  choix: Choix | null,
): { facturee: number; affichee: number } {
  switch (t.unite) {
    case 'm2':
      return { facturee: base.surfaceMm2 / 1_000_000, affichee: round2(base.surfaceMm2 / 1_000_000) };
    case 'ml':
      return { facturee: base.perimetreMm / 1000, affichee: round2(base.perimetreMm / 1000) };
    case 'page':
      return { facturee: base.faces, affichee: base.faces };
    case 'feuille':
      return { facturee: base.feuilles, affichee: base.feuilles };
    case 'exemplaire':
      return { facturee: base.exemplaires, affichee: base.exemplaires };
    case 'unite': {
      const q = choix?.quantite ?? base.exemplaires;
      return { facturee: q, affichee: q };
    }
    case 'forfait': {
      const q = choix?.quantite ?? 1;
      return { facturee: q, affichee: q };
    }
    case 'pourcent':
      return { facturee: 0, affichee: 0 };
  }
}

function ajouter(
  out: LignePrix[],
  t: Tarif,
  q: { facturee: number; affichee: number },
  groupe: number,
  libelle?: string,
) {
  const total = Math.round(q.facturee * (t.prix as number));
  out.push({ code: t.code, libelle: libelle ?? t.libelle, quantite: q.affichee, unite: t.unite, prix_unitaire: t.prix as number, total, groupe });
}

function lignesRoland(ctx: Ctx, l: LigneRoland, i: number, params: ParamsPrix, out: LignePrix[]) {
  const n = i + 1;
  const support = chercher(ctx, l.support, ['support'], `Ligne ${n}`);
  const largeur = toMm(l.largeur, l.unite);
  const hauteur = toMm(l.hauteur, l.unite);
  const surfaceUnitaire = Math.max(largeur * hauteur, Math.round(params.surface_min_m2 * 1_000_000));
  const base = {
    surfaceMm2: surfaceUnitaire * l.quantite,
    perimetreMm: 2 * (largeur + hauteur) * l.quantite,
    faces: l.quantite,
    feuilles: l.quantite,
    exemplaires: l.quantite,
  };
  if (support) {
    if (support.unite === 'm2') {
      ajouter(out, support, { facturee: base.surfaceMm2 / 1_000_000, affichee: round2(base.surfaceMm2 / 1_000_000) }, i);
    } else {
      ajouter(out, support, quantitePour(support, base, null), i);
    }
  }
  for (const f of l.finitions) {
    const t = chercher(ctx, f.code, ['finition'], `Ligne ${n}, finition`);
    if (t && t.unite !== 'pourcent') ajouter(out, t, quantitePour(t, base, f), i);
  }
  for (const code of l.options) {
    const t = chercher(ctx, code, ['option'], `Ligne ${n}, option`);
    if (t && t.unite !== 'pourcent') ajouter(out, t, quantitePour(t, base, null), i);
  }
}

export const CODE_RECTO_VERSO = 'impression_recto_verso';

function lignesXerox(ctx: Ctx, l: LigneXerox, i: number, out: LignePrix[]) {
  const n = i + 1;
  const support = chercher(ctx, l.support, ['support'], `Ligne ${n}`);
  const faces = l.pages * l.quantite;
  const feuilles = Math.ceil(l.pages / (l.recto_verso ? 2 : 1)) * l.quantite;
  const base = { surfaceMm2: 0, perimetreMm: 0, faces, feuilles, exemplaires: l.quantite };
  if (support) ajouter(out, support, quantitePour(support, base, null), i);
  const options = [...l.options];
  if (l.recto_verso && !options.includes(CODE_RECTO_VERSO)) {
    const rv = ctx.byCode.get(`xerox:${CODE_RECTO_VERSO}`) ?? ctx.byCode.get(`global:${CODE_RECTO_VERSO}`);
    if (rv && rv.actif) options.push(CODE_RECTO_VERSO);
  }
  for (const f of l.finitions) {
    const t = chercher(ctx, f.code, ['finition'], `Ligne ${n}, finition`);
    if (t && t.unite !== 'pourcent') ajouter(out, t, quantitePour(t, base, f), i);
  }
  for (const code of options) {
    const t = chercher(ctx, code, ['option'], `Ligne ${n}, option`);
    if (t && t.unite !== 'pourcent') ajouter(out, t, quantitePour(t, base, null), i);
  }
}

/** Calcule le prix d'un dossier ou d'un devis. */
export function calculerPrix(
  machine: Machine,
  specs: Specs,
  tarifs: readonly Tarif[],
  params: ParamsPrix = PARAMS_PRIX_DEFAUT,
): ResultatPrix | ErreurPrix {
  const ctx: Ctx = { machine, byCode: new Map(tarifs.map((t) => [`${t.machine}:${t.code}`, t])), erreurs: [] };
  const lignes: LignePrix[] = [];
  if (!specs.lignes || specs.lignes.length === 0) {
    return { ok: false, erreurs: ['Ajoutez au moins une ligne (support ou format) pour calculer le prix.'] };
  }
  specs.lignes.forEach((l, i) => {
    if (machine === 'roland') lignesRoland(ctx, l as LigneRoland, i, params, lignes);
    else lignesXerox(ctx, l as LigneXerox, i, lignes);
  });

  const pourcents: { t: Tarif; choix: Choix }[] = [];
  for (const f of specs.forfaits ?? []) {
    const t = chercher(ctx, f.code, ['divers', 'option', 'finition'], 'Forfait');
    if (!t) continue;
    if (t.unite === 'pourcent') pourcents.push({ t, choix: f });
    else ajouter(lignes, t, quantitePour(t, { surfaceMm2: 0, perimetreMm: 0, faces: 0, feuilles: 0, exemplaires: 1 }, f), -1);
  }
  if (ctx.erreurs.length) return { ok: false, erreurs: ctx.erreurs };

  const base = lignes.reduce((s, l) => s + l.total, 0);
  for (const { t } of pourcents) {
    const total = Math.round((base * (t.prix as number)) / 100);
    lignes.push({ code: t.code, libelle: `${t.libelle} (+${t.prix} %)`, quantite: 1, unite: 'pourcent', prix_unitaire: total, total, groupe: -1 });
  }
  const sous_total = lignes.reduce((s, l) => s + l.total, 0);
  const remise = calculerRemise(specs.remise ?? null, sous_total);
  const net = sous_total - remise;

  let total_ht: number;
  let tva: number;
  let total_ttc: number;
  let arrondi: number;
  if (params.tva_applicable && params.prix_saisis_ht) {
    total_ht = net;
    tva = Math.round((net * params.tva_taux) / 100);
    const brut = total_ht + tva;
    total_ttc = arrondirHaut(brut, params.arrondi_pas);
    arrondi = total_ttc - brut;
  } else {
    total_ttc = arrondirHaut(net, params.arrondi_pas);
    arrondi = total_ttc - net;
    if (params.tva_applicable) {
      total_ht = Math.round(total_ttc / (1 + params.tva_taux / 100));
      tva = total_ttc - total_ht;
    } else {
      total_ht = total_ttc;
      tva = 0;
    }
  }
  return { ok: true, lignes, sous_total, remise, arrondi, total_ht, tva, total_ttc };
}

export function calculerRemise(remise: Remise | null, sousTotal: number): number {
  if (!remise || remise.valeur <= 0) return 0;
  const r = remise.type === 'pourcent' ? Math.round((sousTotal * remise.valeur) / 100) : Math.round(remise.valeur);
  return Math.min(r, sousTotal);
}

export function arrondirHaut(n: number, pas: number): number {
  if (!pas || pas <= 0) return n;
  return Math.ceil(n / pas) * pas;
}

/** Ventilation TVA d'un montant TTC déjà connu (factures d'un dossier sans détail). */
export function ventilerTTC(ttc: number, params: Pick<ParamsPrix, 'tva_applicable' | 'tva_taux'>): { ht: number; tva: number; ttc: number } {
  if (!params.tva_applicable) return { ht: ttc, tva: 0, ttc };
  const ht = Math.round(ttc / (1 + params.tva_taux / 100));
  return { ht, tva: ttc - ht, ttc };
}

/** Résumé court d'une ligne de spécification, pour les cartes et les tableaux. */
export function resumeLigne(machine: Machine, l: LigneRoland | LigneXerox, libelleSupport?: string): string {
  if (machine === 'roland') {
    const r = l as LigneRoland;
    return `${libelleSupport ?? r.support} · ${r.largeur} × ${r.hauteur} ${r.unite} · ${r.quantite} ex.`;
  }
  const x = l as LigneXerox;
  return `${libelleSupport ?? x.support} · ${x.pages} p.${x.recto_verso ? ' recto-verso' : ''} · ${x.quantite} ex.`;
}
