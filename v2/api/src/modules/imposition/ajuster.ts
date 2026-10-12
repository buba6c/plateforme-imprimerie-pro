// Mise au format : que faire quand le visuel reçu n'a pas la taille du format fini choisi (carte de
// visite livrée en 90 × 50 mm pour une impression en 85 × 55, flyer en Letter pour un A5, page en
// paysage pour une pose en portrait…). Le choix est fait une fois, dans le plan, et appliqué à
// l'identique par le moteur (generer.ts) et par l'aperçu (web).
//  - « centrer » : rien n'est mis à l'échelle ; le format fini est pris au centre du visuel (ce qui
//    dépasse est rogné, ce qui manque reste blanc) ;
//  - « adapter » : le visuel est réduit ou agrandi pour tenir entièrement dans le format fini, sans
//    déformation : des bandes blanches apparaissent sur deux côtés si les proportions diffèrent ;
//  - « remplir » : le visuel couvre tout le format fini, sans déformation : il est rogné sur deux côtés ;
//  - « etirer » : le visuel prend exactement le format fini, en se déformant un peu ;
//  - « auto » : même taille → centrer ; proportions très proches (≤ 3 %) → remplir (le rognage est
//    invisible) ; rognage qui n'enlève que de la marge blanche → remplir ; sinon adapter (rien n'est
//    perdu, et le rapport explique les bandes blanches et propose les autres choix).
// Un visuel qui a la taille du format fini mais tourné d'un quart de tour est pivoté (« pivote »).

import { arrondi, type Dimension } from './formats';

export type ModeAjustement = 'auto' | 'centrer' | 'adapter' | 'remplir' | 'etirer';
export type ModeApplique = Exclude<ModeAjustement, 'auto'>;

export interface Adaptation {
  mode: ModeApplique;
  /** Le mode a été choisi automatiquement. */
  auto: boolean;
  /** Zone finie du visuel reçu (mm), telle que le fichier la donne. */
  source: Dimension;
  /** Le visuel est tourné d'un quart de tour pour prendre l'orientation du format fini. */
  pivote: boolean;
  /** Échelle appliquée au visuel dans chaque sens (1 = taille d'origine). */
  echelle_x: number;
  echelle_y: number;
  /** Bandes blanches laissées dans le format fini (mm) : de chaque côté en largeur (x) et en hauteur (y). */
  marges: { x: number; y: number };
  /** Visuel rogné (mm) de chaque côté en largeur (x) et en hauteur (y). */
  rognage: { x: number; y: number };
  /** Rien à faire : le fichier est au format (à la tolérance près). */
  identique: boolean;
}

/** Tolérance (mm) en deçà de laquelle une taille est considérée comme la bonne. */
export const TOLERANCE_FORMAT = 1.5;
/** Écart de proportions (3 %) en deçà duquel « remplir » rogne de façon invisible. */
const PROPORTIONS_PROCHES = 0.03;

const proche = (a: number, b: number, tol = TOLERANCE_FORMAT) => Math.abs(a - b) <= tol;

export interface MargesBlanches {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
}

/**
 * Calcule l'adaptation d'un visuel `source` (mm) au format fini `fini` (mm).
 * `margeBlanche` : marge blanche mesurée sur chaque bord du visuel (mm), si l'analyse a pu la rendre.
 */
export function calculerAdaptation(source: Dimension, fini: Dimension, mode: ModeAjustement = 'auto', margeBlanche: MargesBlanches | null = null): Adaptation {
  const auto = mode === 'auto';
  const base: Omit<Adaptation, 'mode' | 'echelle_x' | 'echelle_y' | 'marges' | 'rognage' | 'identique'> = { auto, source: { largeur: arrondi(source.largeur), hauteur: arrondi(source.hauteur) }, pivote: false };
  const centrerAvec = (s: Dimension, pivote = false, identique = false): Adaptation => ({
    ...base,
    pivote,
    mode: 'centrer',
    echelle_x: 1,
    echelle_y: 1,
    marges: { x: arrondi(Math.max(0, (fini.largeur - s.largeur) / 2)), y: arrondi(Math.max(0, (fini.hauteur - s.hauteur) / 2)) },
    rognage: { x: arrondi(Math.max(0, (s.largeur - fini.largeur) / 2)), y: arrondi(Math.max(0, (s.hauteur - fini.hauteur) / 2)) },
    identique,
  });

  // Même taille (ou fonds perdus non déclarés tout autour : 2, 3 ou 5 mm de plus de chaque côté).
  const memeTaille = (s: Dimension) => [0, 2, 3, 5].some((fp) => proche(s.largeur, fini.largeur + 2 * fp, 0.75 + (fp ? 0 : TOLERANCE_FORMAT - 0.75)) && proche(s.hauteur, fini.hauteur + 2 * fp, 0.75 + (fp ? 0 : TOLERANCE_FORMAT - 0.75)));
  if (memeTaille(source)) return centrerAvec(source, false, true);
  const transposee = { largeur: source.hauteur, hauteur: source.largeur };
  const carre = proche(fini.largeur, fini.hauteur, 0.5);
  if (auto && !carre && memeTaille(transposee)) return { ...centrerAvec(transposee, true, true), source: base.source };

  if (mode === 'centrer') return centrerAvec(source);
  const s = source;
  const ex0 = fini.largeur / s.largeur;
  const ey0 = fini.hauteur / s.hauteur;
  const ecart = Math.abs(ex0 / ey0 - 1);
  const avec = (m: ModeApplique, ex: number, ey: number): Adaptation => {
    const w = s.largeur * ex;
    const h = s.hauteur * ey;
    return {
      ...base,
      mode: m,
      echelle_x: arrondi(ex, 4),
      echelle_y: arrondi(ey, 4),
      marges: { x: arrondi(Math.max(0, (fini.largeur - w) / 2)), y: arrondi(Math.max(0, (fini.hauteur - h) / 2)) },
      rognage: { x: arrondi(Math.max(0, (w - fini.largeur) / 2)), y: arrondi(Math.max(0, (h - fini.hauteur) / 2)) },
      identique: false,
    };
  };
  const remplir = () => avec('remplir', Math.max(ex0, ey0), Math.max(ex0, ey0));
  const adapter = () => avec('adapter', Math.min(ex0, ey0), Math.min(ex0, ey0));
  if (mode === 'etirer') return avec('etirer', ex0, ey0);
  if (mode === 'remplir') return remplir();
  if (mode === 'adapter') return adapter();
  // Auto.
  if (ecart <= PROPORTIONS_PROCHES) return remplir();
  if (margeBlanche) {
    // Le rognage de « remplir » ne touche que de la marge blanche : rien d'utile n'est perdu.
    const r = remplir();
    const e = Math.max(ex0, ey0);
    const ok = r.rognage.x <= Math.min(margeBlanche.gauche, margeBlanche.droite) * e + 0.3 && r.rognage.y <= Math.min(margeBlanche.haut, margeBlanche.bas) * e + 0.3;
    if (ok) return r;
  }
  return adapter();
}

/**
 * Zone du visuel source à dessiner dans le format fini, dans le repère du visuel (mm, origine au coin
 * bas-gauche de la zone finie source) : un rectangle de fini/échelle, centré sur le visuel. Ce qui en
 * sort du visuel est blanc, ce qui n'y entre pas est rogné.
 */
export function cadreSource(a: Adaptation, fini: Dimension): { x: number; y: number; largeur: number; hauteur: number } {
  const src = a.pivote ? { largeur: a.source.hauteur, hauteur: a.source.largeur } : a.source;
  const largeur = fini.largeur / a.echelle_x;
  const hauteur = fini.hauteur / a.echelle_y;
  return { x: (src.largeur - largeur) / 2, y: (src.hauteur - hauteur) / 2, largeur, hauteur };
}
