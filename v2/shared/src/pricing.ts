// Moteur de prix : fonction pure, en entiers (FCFA), utilisée par le serveur (qui fait foi)
// et par l'interface (aperçu instantané). Aucun tarif manquant n'est remplacé par 0 :
// un code inconnu, un prix non défini ou un tarif mal réglé (unité qui ne convient pas à la
// machine ou à la catégorie) produit une erreur explicite.

import type { Machine } from './domain';
import { formatDecimal, formatEntier } from './format';
import type {
  BordsRoland,
  Choix,
  Conditionnement,
  CouleurImpression,
  FormatXerox,
  LigneRoland,
  LigneXerox,
  PapierXerox,
  PartieLigne,
  PositionOeillets,
  Remise,
  Specs,
  TypeDocument,
  UniteDimension,
} from './schemas';

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

/** Plafond d'un total (dossier ou devis) : au-delà, il s'agit presque toujours d'une erreur de saisie. */
export const MONTANT_MAX = 1_000_000_000;

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
  /** Explication en clair de la quantité (« 3 m × 2 m = 6 m² par exemplaire × 2 ex. »). */
  explication?: string;
}

export interface ResultatPrix {
  ok: true;
  lignes: LignePrix[];
  sous_total: number;
  remise: number;
  /** Écart d'arrondi, en TTC (le total TTC est arrondi, puis ventilé en HT et TVA). */
  arrondi: number;
  total_ht: number;
  tva: number;
  total_ttc: number;
  /** Points à vérifier qui ne bloquent pas le calcul (recto-verso sur une seule page…). */
  avertissements?: string[];
}

export interface ErreurPrix {
  ok: false;
  erreurs: string[];
}

// ---------------------------------------------------------------------------
// Codes de tarif utilisés par les choix structurés du formulaire

export const CODE_RECTO_VERSO = 'impression_recto_verso';

export const CODES_TARIF = {
  rectoVerso: CODE_RECTO_VERSO,
  oeillets: 'oeillets',
  ourlet: 'ourlet',
  collage: 'collage',
  numerotation: 'numerotation',
  livraison: 'livraison',
  conception: 'conception_graphique',
  correction: 'correction_fichiers',
  bat: 'epreuve_numerique',
  urgence48: 'urgence_48h',
  urgence24: 'urgence_24h',
  kakemono: 'kakemono',
} as const;

/** Bords Roland -> code de tarif. */
export const TARIF_BORDS: Record<Exclude<BordsRoland, 'aucun'>, string> = {
  oeillets: CODES_TARIF.oeillets,
  ourlet: CODES_TARIF.ourlet,
  collage: CODES_TARIF.collage,
};

/** Papier Xerox -> code du supplément par feuille (null : compris dans le prix du format). */
export const TARIF_PAPIER: Record<PapierXerox, string | null> = {
  ordinaire_80: null,
  couche_135: 'papier_couche_135',
  couche_170: 'papier_couche_170',
  couche_250: 'papier_carte_250_350',
  couche_300: 'papier_carte_250_350',
  couche_350: 'papier_carte_250_350',
  autocollant: 'autocollant',
  offset: 'papier_offset',
  grimat: 'papier_grimat',
};

export const TARIF_PELLICULAGE: Record<'mat' | 'brillant', string> = {
  mat: 'pelliculage_mat',
  brillant: 'pelliculage_brillant',
};

/** Codes gérés par des champs dédiés du formulaire (et non par les cases à cocher génériques). */
export const CODES_STRUCTURES = {
  roland: new Set<string>(Object.values(TARIF_BORDS)),
  xerox: new Set<string>([
    CODE_RECTO_VERSO,
    CODES_TARIF.numerotation,
    ...Object.values(TARIF_PELLICULAGE),
    ...Object.values(TARIF_PAPIER).filter((c): c is string => !!c),
  ]),
  /** Forfaits du dossier pilotés par l'en-tête (remise, urgence, fichiers, BAT). */
  dossier: new Set<string>([
    CODES_TARIF.livraison,
    CODES_TARIF.conception,
    CODES_TARIF.correction,
    CODES_TARIF.bat,
    CODES_TARIF.urgence48,
    CODES_TARIF.urgence24,
  ]),
};

// ---------------------------------------------------------------------------
// Libellés des choix structurés

export const TYPE_DOCUMENT_LABELS: Record<TypeDocument, string> = {
  carte_visite: 'Carte de visite',
  flyer: 'Flyer',
  brochure: 'Brochure',
  depliant: 'Dépliant',
  affiche: 'Affiche',
  catalogue: 'Catalogue',
  document: 'Document ou rapport',
  autre: 'Autre',
};

export const PARTIE_LABELS: Record<PartieLigne, string> = {
  unique: 'Document entier',
  couverture: 'Couverture',
  interieur: 'Pages intérieures',
  encart: 'Encart',
};

export const FORMAT_XEROX_LABELS: Record<FormatXerox, string> = {
  a6: 'A6',
  a5: 'A5',
  a4: 'A4',
  a3: 'A3',
  sra3: 'SRA3',
  cdv_85x55: 'Carte de visite 85 × 55',
  cdv_90x50: 'Carte de visite 90 × 50',
  '10x15': 'Photo 10 × 15',
  '13x18': 'Photo 13 × 18',
  '20x30': 'Photo 20 × 30',
  perso: 'Format personnalisé',
};

/** Dimensions des formats finis, en mm (largeur × hauteur). */
export const FORMAT_XEROX_MM: Record<Exclude<FormatXerox, 'perso'>, [number, number]> = {
  a6: [105, 148],
  a5: [148, 210],
  a4: [210, 297],
  a3: [297, 420],
  sra3: [320, 450],
  cdv_85x55: [85, 55],
  cdv_90x50: [90, 50],
  '10x15': [100, 150],
  '13x18': [130, 180],
  '20x30': [200, 300],
};

export const COULEUR_LABELS: Record<CouleurImpression, string> = { couleur: 'Couleur', nb: 'Noir et blanc' };

export const PAPIER_LABELS: Record<PapierXerox, string> = {
  ordinaire_80: 'Ordinaire 80 g',
  couche_135: 'Couché 135 g',
  couche_170: 'Couché 170 g',
  couche_250: 'Couché 250 g',
  couche_300: 'Couché 300 g',
  couche_350: 'Couché 350 g',
  autocollant: 'Autocollant',
  offset: 'Offset',
  grimat: 'Grimat',
};

export const CONDITIONNEMENT_LABELS: Record<Conditionnement, string> = {
  liasse_50: 'En liasses de 50',
  liasse_100: 'En liasses de 100',
  filme: 'Filmé',
  etiquete: 'Étiqueté',
};

export const BORDS_LABELS: Record<BordsRoland, string> = { aucun: 'Aucun', oeillets: 'Œillets', ourlet: 'Ourlet', collage: 'Collage' };

export const POSITION_OEILLETS_LABELS: Record<PositionOeillets, string> = { angles: 'Aux 4 coins', tous_cotes: 'Tout autour' };

/** Format photo ou carte de visite : imprimé en couleur uniquement. */
export function formatCouleurSeule(format: FormatXerox | null | undefined): boolean {
  return !!format && (format.startsWith('cdv_') || ['10x15', '13x18', '20x30'].includes(format));
}

/** Code du support Xerox qui correspond à un format et une couleur (null : format personnalisé ou inconnu). */
export function codeSupportXerox(format: FormatXerox | null | undefined, couleur: CouleurImpression | null | undefined): string | null {
  if (!format || format === 'perso') return null;
  if (format.startsWith('cdv_')) return 'carte_visite';
  const c = formatCouleurSeule(format) ? 'couleur' : couleur ?? 'couleur';
  return `papier_${format}_${c}`;
}

// ---------------------------------------------------------------------------
// Combinaisons unité × machine × catégorie

/**
 * Unités permises. Un format Xerox se compte à la face, à la feuille ou à l'exemplaire ; une surface
 * (m², mètre linéaire) n'existe qu'en grand format ; un pourcentage ne s'applique qu'aux forfaits du dossier.
 */
export const UNITES_PERMISES: Record<Tarif['machine'], Record<CategorieTarif, readonly UniteTarif[]>> = {
  roland: {
    support: ['m2', 'ml', 'exemplaire', 'unite'],
    finition: ['m2', 'ml', 'exemplaire', 'unite', 'forfait'],
    option: ['m2', 'ml', 'exemplaire', 'unite', 'forfait'],
    divers: ['forfait', 'unite', 'pourcent'],
  },
  xerox: {
    support: ['page', 'feuille', 'exemplaire', 'unite'],
    finition: ['page', 'feuille', 'exemplaire', 'unite', 'forfait'],
    option: ['page', 'feuille', 'exemplaire', 'unite', 'forfait'],
    divers: ['forfait', 'unite', 'pourcent'],
  },
  global: {
    support: [],
    finition: ['exemplaire', 'unite', 'forfait'],
    option: ['exemplaire', 'unite', 'forfait'],
    divers: ['forfait', 'unite', 'pourcent'],
  },
};

const MACHINE_TEXTE: Record<Tarif['machine'], string> = { roland: 'Roland', xerox: 'Xerox', global: 'commun aux deux machines' };

/** Message si la combinaison est impossible, sinon null. Utilisé par l'écran Tarifs et par le moteur. */
export function verifierCombinaisonTarif(t: Pick<Tarif, 'machine' | 'categorie' | 'unite'>): string | null {
  const permises = UNITES_PERMISES[t.machine]?.[t.categorie];
  if (!permises) return 'Machine ou catégorie inconnue.';
  if (permises.includes(t.unite)) return null;
  if (!permises.length) return 'Un support ou un format doit appartenir à une machine (Roland ou Xerox), pas aux deux.';
  const cat = CATEGORIE_TARIF_LABELS[t.categorie].toLowerCase();
  return `Un tarif ${MACHINE_TEXTE[t.machine]} de la catégorie « ${cat} » ne peut pas être ${UNITE_TARIF_LABELS[t.unite]}. Unités possibles : ${permises
    .map((u) => UNITE_TARIF_LABELS[u])
    .join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Calcul

const MM: Record<UniteDimension, number> = { mm: 1, cm: 10, m: 1000 };

function toMm(v: number, u: UniteDimension): number {
  return Math.round(v * MM[u]);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Nombre à la française : entier groupé, ou décimal avec au plus `dec` décimales. */
const nf = (n: number, dec = 0) => (dec > 0 ? formatDecimal(n, dec) : formatEntier(n));
/** Longueur en mètres : 3000 mm -> « 3 m », 1250 mm -> « 1,25 m ». */
const nm = (mm: number) => `${formatDecimal(mm / 1000, 2)} m`;
const ex = (q: number) => `${formatEntier(q)} ex.`;

interface Ctx {
  machine: Machine;
  byCode: Map<string, Tarif>;
  erreurs: string[];
  avertissements: string[];
}

function trouver(ctx: Ctx, code: string): Tarif | undefined {
  return ctx.byCode.get(`${ctx.machine}:${code}`) ?? ctx.byCode.get(`global:${code}`);
}

function chercher(ctx: Ctx, code: string, categories: readonly CategorieTarif[], contexte: string): Tarif | null {
  const t = trouver(ctx, code);
  const grille = ctx.machine === 'roland' ? 'Roland' : 'Xerox';
  if (!t) {
    ctx.erreurs.push(`${contexte} : « ${code} » n'existe pas dans la grille tarifaire ${grille}. Ajoutez-le dans Tarifs ou choisissez un autre élément.`);
    return null;
  }
  if (!t.actif) {
    ctx.erreurs.push(`${contexte} : « ${t.libelle} » est désactivé dans Tarifs. Réactivez-le ou choisissez un autre élément.`);
    return null;
  }
  if (!categories.includes(t.categorie)) {
    ctx.erreurs.push(
      `${contexte} : « ${t.libelle} » est rangé dans « ${CATEGORIE_TARIF_LABELS[t.categorie]} » et ne peut pas servir ici. Corrigez sa catégorie dans Tarifs.`,
    );
    return null;
  }
  const incoherent = verifierCombinaisonTarif(t);
  if (incoherent) {
    ctx.erreurs.push(`${contexte} : « ${t.libelle} » est mal réglé dans Tarifs. ${incoherent}`);
    return null;
  }
  if (t.prix === null) {
    ctx.erreurs.push(`${contexte} : prix de « ${t.libelle} » à renseigner dans Tarifs.`);
    return null;
  }
  return t;
}

interface Base {
  /** Surface facturée de toute la ligne, en mm². */
  surfaceMm2: number;
  perimetreMm: number;
  faces: number;
  feuilles: number;
  exemplaires: number;
}

/** Quantité facturée pour un tarif selon son unité (le pourcentage est traité à part). */
function quantitePour(t: Tarif, base: Base, choix: Choix | null): { facturee: number; affichee: number } {
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
  extra: { libelle?: string; explication?: string } = {},
) {
  const total = Math.round(q.facturee * (t.prix as number));
  const l: LignePrix = { code: t.code, libelle: extra.libelle ?? t.libelle, quantite: q.affichee, unite: t.unite, prix_unitaire: t.prix as number, total, groupe };
  if (extra.explication) l.explication = extra.explication;
  out.push(l);
}

/** Explication en clair d'une quantité, selon l'unité. */
function expliquer(t: Tarif, base: Base, contexte: { roland?: { largeur: number; hauteur: number; surfaceUnitaire: number; minimum: boolean } }): string | undefined {
  const r = contexte.roland;
  switch (t.unite) {
    case 'm2':
      if (!r) return undefined;
      return `${nm(r.largeur)} × ${nm(r.hauteur)} = ${nf(round2((r.largeur * r.hauteur) / 1_000_000), 2)} m² par exemplaire${
        r.minimum ? ` (minimum facturé ${nf(round2(r.surfaceUnitaire / 1_000_000), 2)} m²)` : ''
      }${base.exemplaires > 1 ? ` × ${ex(base.exemplaires)}` : ''}`;
    case 'ml':
      return r ? `Tour du visuel ${nm(2 * (r.largeur + r.hauteur))}${base.exemplaires > 1 ? ` × ${ex(base.exemplaires)}` : ''}` : undefined;
    case 'page':
      return base.exemplaires > 0 && base.faces !== base.exemplaires ? `${nf(base.faces / base.exemplaires)} face(s) × ${ex(base.exemplaires)}` : undefined;
    case 'feuille':
      return base.exemplaires > 0 && base.feuilles !== base.exemplaires ? `${nf(base.feuilles / base.exemplaires)} feuille(s) × ${ex(base.exemplaires)}` : undefined;
    default:
      return undefined;
  }
}

/** Nombre d'œillets d'une ligne Roland : 4 aux coins, sinon le tour divisé par l'espacement (4 au moins). */
export function nombreOeillets(
  l: Pick<LigneRoland, 'largeur' | 'hauteur' | 'unite' | 'quantite' | 'oeillets'>,
): { parExemplaire: number; total: number } | null {
  if (!(l.largeur > 0 && l.hauteur > 0)) return null;
  const position = l.oeillets?.position ?? 'tous_cotes';
  let n = 4;
  if (position === 'tous_cotes') {
    const perimetreCm = (2 * (toMm(l.largeur, l.unite) + toMm(l.hauteur, l.unite))) / 10;
    const espacement = l.oeillets?.espacement_cm && l.oeillets.espacement_cm > 0 ? l.oeillets.espacement_cm : 50;
    n = Math.max(4, Math.round(perimetreCm / espacement));
  }
  const q = l.quantite > 0 ? l.quantite : 1;
  return { parExemplaire: n, total: n * q };
}

function lignesRoland(ctx: Ctx, l: LigneRoland, i: number, params: ParamsPrix, out: LignePrix[]) {
  const n = i + 1;
  const support = chercher(ctx, l.support, ['support'], `Ligne ${n}`);
  const largeur = toMm(l.largeur, l.unite);
  const hauteur = toMm(l.hauteur, l.unite);
  const surfaceUnitaire = Math.max(largeur * hauteur, Math.round(params.surface_min_m2 * 1_000_000));
  const base: Base = {
    surfaceMm2: surfaceUnitaire * l.quantite,
    perimetreMm: 2 * (largeur + hauteur) * l.quantite,
    faces: l.quantite,
    feuilles: l.quantite,
    exemplaires: l.quantite,
  };
  const ctxRoland = { roland: { largeur, hauteur, surfaceUnitaire, minimum: surfaceUnitaire > largeur * hauteur } };
  if (support) ajouter(out, support, quantitePour(support, base, null), i, { explication: expliquer(support, base, ctxRoland) });

  // Bords : un seul choix, avec son tarif. Le nombre d'œillets est calculé.
  const deja = new Set<string>();
  const bords = l.bords && l.bords !== 'aucun' ? l.bords : null;
  if (bords) {
    const code = TARIF_BORDS[bords];
    deja.add(code);
    const t = chercher(ctx, code, ['finition', 'option'], `Ligne ${n}, bords`);
    if (t) {
      if (bords === 'oeillets') {
        const nb = nombreOeillets(l)!;
        const pos = l.oeillets?.position ?? 'tous_cotes';
        const detail = pos === 'angles' ? 'aux 4 coins' : `tout autour, tous les ${nf(l.oeillets?.espacement_cm ?? 50)} cm`;
        const q = t.unite === 'unite' ? { facturee: nb.total, affichee: nb.total } : quantitePour(t, base, null);
        ajouter(out, t, q, i, {
          libelle: `${t.libelle} (${nb.parExemplaire} par exemplaire)`,
          explication: `${nb.parExemplaire} œillets ${detail}${l.quantite > 1 ? ` × ${ex(l.quantite)} = ${nf(nb.total)}` : ''}`,
        });
      } else {
        ajouter(out, t, quantitePour(t, base, null), i, { explication: expliquer(t, base, ctxRoland) });
      }
    }
  }
  for (const f of l.finitions) {
    if (deja.has(f.code)) continue;
    const t = chercher(ctx, f.code, ['finition'], `Ligne ${n}, finition`);
    if (t) ajouter(out, t, quantitePour(t, base, f), i, { explication: expliquer(t, base, ctxRoland) });
  }
  for (const code of l.options) {
    if (deja.has(code)) continue;
    const t = chercher(ctx, code, ['option'], `Ligne ${n}, option`);
    if (t) ajouter(out, t, quantitePour(t, base, null), i, { explication: expliquer(t, base, ctxRoland) });
  }
}

function lignesXerox(ctx: Ctx, l: LigneXerox, i: number, out: LignePrix[]) {
  const n = i + 1;
  const support = chercher(ctx, l.support, ['support'], `Ligne ${n}`);
  const faces = l.pages * l.quantite;
  const feuillesParEx = Math.ceil(l.pages / (l.recto_verso ? 2 : 1));
  const feuilles = feuillesParEx * l.quantite;
  const base: Base = { surfaceMm2: 0, perimetreMm: 0, faces, feuilles, exemplaires: l.quantite };
  if (support) ajouter(out, support, quantitePour(support, base, null), i, { explication: expliquer(support, base, {}) });
  if (l.recto_verso && l.pages === 1) {
    ctx.avertissements.push(
      `Ligne ${n} : recto-verso coché avec 1 seule page. Indiquez 2 pages (recto + verso) pour que le verso soit compté.`,
    );
  }

  const deja = new Set<string>();
  // Papier : supplément par feuille (l'ordinaire 80 g est compris dans le format).
  const codePapier = l.papier ? TARIF_PAPIER[l.papier] : null;
  if (codePapier) {
    deja.add(codePapier);
    const t = chercher(ctx, codePapier, ['option', 'finition'], `Ligne ${n}, papier`);
    if (t) {
      const nom = PAPIER_LABELS[l.papier!];
      const libelle = t.libelle.toLowerCase().includes(nom.toLowerCase()) ? t.libelle : `${t.libelle} (${nom})`;
      ajouter(out, t, quantitePour(t, base, null), i, { libelle, explication: expliquer(t, base, {}) });
    }
  }
  const options = [...l.options];
  if (l.recto_verso && !options.includes(CODE_RECTO_VERSO)) {
    const rv = trouver(ctx, CODE_RECTO_VERSO);
    if (rv && rv.actif) options.push(CODE_RECTO_VERSO);
  }
  // Pelliculage : par feuille, une ou deux faces.
  if (l.pelliculage) {
    const code = TARIF_PELLICULAGE[l.pelliculage.type];
    deja.add(code);
    const t = chercher(ctx, code, ['finition'], `Ligne ${n}, pelliculage`);
    if (t) {
      const mult = l.pelliculage.faces === 'recto_verso' ? 2 : 1;
      const q = quantitePour(t, base, null);
      const parFace = t.unite === 'feuille' || t.unite === 'page' || t.unite === 'exemplaire';
      ajouter(out, t, parFace ? { facturee: q.facturee * mult, affichee: q.affichee * mult } : q, i, {
        libelle: `${t.libelle} ${l.pelliculage.faces === 'recto_verso' ? 'recto-verso' : 'recto'}`,
        explication: parFace && mult === 2 ? `${nf(q.affichee)} × 2 faces` : undefined,
      });
    }
  }
  if (l.numerotation) {
    deja.add(CODES_TARIF.numerotation);
    const t = chercher(ctx, CODES_TARIF.numerotation, ['finition', 'option'], `Ligne ${n}, numérotation`);
    if (t) {
      const fin = l.numerotation.depart + l.quantite - 1;
      ajouter(out, t, quantitePour(t, base, null), i, {
        explication: `Du n° ${String(l.numerotation.depart).padStart(l.numerotation.chiffres, '0')} au n° ${String(fin).padStart(l.numerotation.chiffres, '0')}`,
      });
    }
  }
  for (const f of l.finitions) {
    if (deja.has(f.code)) continue;
    const t = chercher(ctx, f.code, ['finition'], `Ligne ${n}, finition`);
    if (t) ajouter(out, t, quantitePour(t, base, f), i, { explication: expliquer(t, base, {}) });
  }
  for (const code of options) {
    if (deja.has(code)) continue;
    const t = chercher(ctx, code, ['option'], `Ligne ${n}, option`);
    if (t) ajouter(out, t, quantitePour(t, base, null), i, { explication: code === CODE_RECTO_VERSO ? `${nf(feuilles)} feuilles imprimées des deux côtés` : expliquer(t, base, {}) });
  }
}

/** Calcule le prix d'un dossier ou d'un devis. */
export function calculerPrix(
  machine: Machine,
  specs: Specs,
  tarifs: readonly Tarif[],
  params: ParamsPrix = PARAMS_PRIX_DEFAUT,
): ResultatPrix | ErreurPrix {
  const ctx: Ctx = { machine, byCode: new Map(tarifs.map((t) => [`${t.machine}:${t.code}`, t])), erreurs: [], avertissements: [] };
  const lignes: LignePrix[] = [];
  if (!specs.lignes || specs.lignes.length === 0) {
    return { ok: false, erreurs: ['Ajoutez au moins une ligne (support ou format) pour calculer le prix.'] };
  }
  specs.lignes.forEach((l, i) => {
    if (machine === 'roland') lignesRoland(ctx, l as LigneRoland, i, params, lignes);
    else lignesXerox(ctx, l as LigneXerox, i, lignes);
  });

  // Forfaits du dossier : à l'unité, au forfait ou en pourcentage. Un code déjà compté sur une
  // ligne (une livraison ajoutée en option, par exemple) n'est pas compté une seconde fois.
  const pourcents: { t: Tarif; choix: Choix }[] = [];
  const surLignes = new Set(lignes.map((l) => l.code));
  const vus = new Set<string>();
  for (const f of specs.forfaits ?? []) {
    if (vus.has(f.code) || surLignes.has(f.code)) continue;
    vus.add(f.code);
    const t = chercher(ctx, f.code, ['divers', 'option', 'finition'], 'Forfait');
    if (!t) continue;
    if (t.unite === 'pourcent') pourcents.push({ t, choix: f });
    else if (t.unite === 'forfait' || t.unite === 'unite') ajouter(lignes, t, quantitePour(t, { surfaceMm2: 0, perimetreMm: 0, faces: 0, feuilles: 0, exemplaires: 1 }, f), -1);
    else ctx.erreurs.push(`Forfait : « ${t.libelle} » se compte ${UNITE_TARIF_LABELS[t.unite]} ; ajoutez-le sur une ligne, pas dans les forfaits.`);
  }
  if (ctx.erreurs.length) return { ok: false, erreurs: ctx.erreurs };

  const base = lignes.reduce((s, l) => s + l.total, 0);
  for (const { t } of pourcents) {
    const total = Math.round((base * (t.prix as number)) / 100);
    lignes.push({ code: t.code, libelle: `${t.libelle} (+${t.prix} %)`, quantite: 1, unite: 'pourcent', prix_unitaire: total, total, groupe: -1 });
  }

  // Conception offerte : la valeur de la conception est déduite sur une ligne visible.
  if (specs.conception_offerte) {
    const conception = lignes.filter((l) => l.code === CODES_TARIF.conception).reduce((s, l) => s + l.total, 0);
    if (conception > 0) {
      lignes.push({
        code: CODES_TARIF.conception,
        libelle: 'Conception graphique offerte',
        quantite: 1,
        unite: 'forfait',
        prix_unitaire: -conception,
        total: -conception,
        groupe: -1,
        explication: 'Offerte au client : son montant est déduit',
      });
    } else {
      ctx.avertissements.push('« Conception offerte » est coché sans conception graphique : rien n’est déduit.');
    }
  }

  const sous_total = lignes.reduce((s, l) => s + l.total, 0);
  const remise = calculerRemise(specs.remise ?? null, sous_total);
  const net = sous_total - remise;

  // Une seule règle, la même que la facture : on fixe le TTC (TVA ajoutée si la grille est hors
  // taxes, puis arrondi), et HT et TVA sont tirés du TTC par ventilerTTC. HT + TVA = TTC toujours.
  const brut = params.tva_applicable && params.prix_saisis_ht ? net + Math.round((net * params.tva_taux) / 100) : net;
  const total_ttc = arrondirHaut(brut, params.arrondi_pas);
  const arrondi = total_ttc - brut;
  if (!Number.isSafeInteger(total_ttc) || total_ttc > MONTANT_MAX) {
    return {
      ok: false,
      erreurs: [
        `Le total dépasse ${nf(MONTANT_MAX)} FCFA : vérifiez les quantités, les dimensions et l'unité (cm, mm ou m). Une erreur de saisie est probable.`,
      ],
    };
  }
  const { ht: total_ht, tva } = ventilerTTC(total_ttc, params);
  return { ok: true, lignes, sous_total, remise, arrondi, total_ht, tva, total_ttc, avertissements: ctx.avertissements };
}

export function calculerRemise(remise: Remise | null, sousTotal: number): number {
  if (!remise || remise.valeur <= 0 || sousTotal <= 0) return 0;
  const r = remise.type === 'pourcent' ? Math.round((sousTotal * remise.valeur) / 100) : Math.round(remise.valeur);
  return Math.min(r, sousTotal);
}

export function arrondirHaut(n: number, pas: number): number {
  if (!pas || pas <= 0) return n;
  return Math.ceil(n / pas) * pas;
}

/** Ventilation TVA d'un montant TTC (moteur de prix, factures) : HT arrondi, TVA = TTC − HT. */
export function ventilerTTC(ttc: number, params: Pick<ParamsPrix, 'tva_applicable' | 'tva_taux'>): { ht: number; tva: number; ttc: number } {
  if (!params.tva_applicable) return { ht: ttc, tva: 0, ttc };
  const ht = Math.round(ttc / (1 + params.tva_taux / 100));
  return { ht, tva: ttc - ht, ttc };
}

// ---------------------------------------------------------------------------
// Résumés lisibles

/** Résumé court d'une ligne de spécification, pour les cartes et les tableaux. */
export function resumeLigne(machine: Machine, l: LigneRoland | LigneXerox, libelleSupport?: string): string {
  if (machine === 'roland') {
    const r = l as LigneRoland;
    const bords = r.bords && r.bords !== 'aucun' ? ` · ${BORDS_LABELS[r.bords].toLowerCase()}` : '';
    return `${libelleSupport ?? r.support} · ${r.largeur} × ${r.hauteur} ${r.unite} · ${r.quantite} ex.${bords}`;
  }
  const x = l as LigneXerox;
  const papier = x.papier && x.papier !== 'ordinaire_80' ? ` · ${PAPIER_LABELS[x.papier]}` : '';
  return `${libelleSupport ?? x.support}${papier} · ${x.pages} p.${x.recto_verso ? ' recto-verso' : ''} · ${x.quantite} ex.`;
}

/**
 * Précisions d'une ligne pour l'atelier (bon de travail, fiche) : type, partie, format, papier,
 * pelliculage, numérotation, conditionnement ; bords et œillets en grand format. Sans prix.
 */
export function detailsLigne(machine: Machine, l: LigneRoland | LigneXerox): string[] {
  const out: string[] = [];
  if (machine === 'roland') {
    const r = l as LigneRoland;
    if (r.bords === 'oeillets') {
      const nb = nombreOeillets(r);
      const pos = r.oeillets?.position ?? 'tous_cotes';
      out.push(
        `Œillets ${pos === 'angles' ? 'aux 4 coins' : `tout autour tous les ${nf(r.oeillets?.espacement_cm ?? 50)} cm`}${nb ? ` : ${nb.parExemplaire} par exemplaire` : ''}`,
      );
    } else if (r.bords && r.bords !== 'aucun') {
      out.push(`Bords : ${BORDS_LABELS[r.bords].toLowerCase()}`);
    }
    return out;
  }
  const x = l as LigneXerox;
  if (x.type_document) out.push(TYPE_DOCUMENT_LABELS[x.type_document]);
  if (x.partie && x.partie !== 'unique') out.push(PARTIE_LABELS[x.partie]);
  if (x.format === 'perso') {
    out.push(x.format_largeur && x.format_hauteur ? `Format ${nf(x.format_largeur)} × ${nf(x.format_hauteur)} mm` : 'Format personnalisé');
  } else if (x.format) {
    out.push(FORMAT_XEROX_LABELS[x.format]);
  }
  if (x.couleur) out.push(COULEUR_LABELS[x.couleur]);
  if (x.papier) out.push(PAPIER_LABELS[x.papier]);
  if (x.pelliculage) out.push(`Pelliculage ${x.pelliculage.type} ${x.pelliculage.faces === 'recto_verso' ? 'recto-verso' : 'recto'}`);
  if (x.numerotation) {
    out.push(`Numérotation à partir du n° ${String(x.numerotation.depart).padStart(x.numerotation.chiffres, '0')} (${x.numerotation.chiffres} chiffres)`);
  }
  if (x.conditionnement?.length) out.push(x.conditionnement.map((c) => CONDITIONNEMENT_LABELS[c]).join(', '));
  return out;
}
