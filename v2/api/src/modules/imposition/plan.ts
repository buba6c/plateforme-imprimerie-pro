// Calcul des plans d'imposition, sans toucher au PDF : où va chaque page sur chaque feuille.
//  - « poses » : N exemplaires par feuille (cartes de visite, flyers, tickets), en répétition
//    (même visuel partout), en séquence (les pages se suivent) ou en coupe & empile (après la
//    coupe, chaque pile est dans l'ordre : tickets numérotés, exemplaires personnalisés) ;
//  - « livret » : piqûre à cheval, 2 pages par face, ordre des pages recalculé, pages blanches ajoutées
//    pour atteindre un multiple de 4 ;
//  - « fonds_perdus » : une page par page source, avec des fonds perdus ajoutés.
// Les positions sont en mm, origine en bas à gauche de la feuille (comme le PDF).

import { FEUILLES, FONDS_PERDUS_STANDARD, type Dimension, type Feuille } from './formats';

export type Operation = 'poses' | 'livret' | 'fonds_perdus' | 'assembler';
export type ModePoses = 'repetition' | 'sequence' | 'coupe_empile';
export type MethodeFondsPerdus = 'source' | 'miroir' | 'etirer' | 'blanc';
export type Retournement = 'bord_long' | 'bord_court';
export type Orientation = 'auto' | 'portrait' | 'paysage';
export type Ajustement = 'centrer' | 'adapter' | 'remplir';

export interface Numerotation {
  debut: number;
  chiffres: number;
  prefixe: string;
  position: 'bas_droite' | 'bas_gauche' | 'haut_droite' | 'haut_gauche' | 'bas_centre';
  taille_pt: number;
  /** Sur le verso aussi (même numéro). */
  verso: boolean;
}

export interface ParamsImposition {
  operation: Operation;
  feuille: Feuille;
  feuille_personnalisee?: Dimension;
  orientation: Orientation;
  /** Format fini (mm). */
  fini: Dimension;
  fonds_perdus_mm: number;
  methode_fonds_perdus: MethodeFondsPerdus;
  /** Espace entre deux poses (mm), en plus des fonds perdus. */
  gouttiere_mm: number;
  /** Marge minimale entre les poses et le bord de la feuille (mm). */
  marge_mm: number;
  traits_de_coupe: boolean;
  /** Le fichier contient recto et verso en alternance (poses) ou l'imposition est recto-verso (livret). */
  recto_verso: boolean;
  retournement: Retournement;
  mode: ModePoses;
  /** Nombre d'exemplaires à produire (répétition : information ; coupe & empile sans numérotation : nb de pages). */
  quantite?: number;
  numerotation?: Numerotation | null;
  /** Si la page source n'a pas la taille finie : la centrer, l'adapter (réduire) ou la remplir (agrandir et rogner). */
  ajustement: Ajustement;
  /** Livret : décalage de chasse total (mm) réparti du cahier extérieur vers l'intérieur. */
  chasse_mm?: number;
  /** Livret : page(s) blanche(s) ajoutées à la fin (défaut) ou avant la dernière page. */
  blanches: 'fin' | 'avant_derniere';
  /** Appariement recto/verso des pages du document assemblé (posé par le serveur), sinon pages alternées. */
  paires?: { recto: number; verso: number | null }[] | null;
}

export interface Pose {
  /** Page source (1-based), null = pose vide. */
  page: number | null;
  /** Numéro imprimé (numérotation), sinon null. */
  numero: string | null;
  /** Position du format fini sur la feuille (mm, bas-gauche). */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Décalage de chasse appliqué (mm, positif vers l'extérieur). */
  decalage_x?: number;
  /** Repère : rangée et colonne (0-based), et pour le livret, le côté. */
  rang: number;
  colonne: number;
}

export interface Face {
  cote: 'recto' | 'verso';
  poses: Pose[];
  /** Traits de pli (livret), en x (mm). */
  plis: number[];
}

export interface FeuillePlan {
  numero: number;
  recto: Face;
  verso: Face | null;
}

export interface Plan {
  operation: Operation;
  feuille: Dimension;
  paysage: boolean;
  fini: Dimension;
  fonds_perdus_mm: number;
  colonnes: number;
  rangs: number;
  poses_par_face: number;
  nb_feuilles: number;
  nb_pages_sortie: number;
  /** Feuilles à imprimer pour la quantité demandée (répétition). */
  feuilles_a_imprimer: number | null;
  /** Pages blanches ajoutées (livret). */
  pages_blanches: number;
  feuilles: FeuillePlan[];
  avertissements: string[];
}

const arr = (v: number) => Math.round(v * 100) / 100;

export function dimensionFeuille(p: Pick<ParamsImposition, 'feuille' | 'feuille_personnalisee'>): Dimension {
  if (p.feuille === 'personnalisee') {
    const d = p.feuille_personnalisee;
    if (!d || !(d.largeur > 0) || !(d.hauteur > 0)) throw new Error('Feuille personnalisée : indiquez largeur et hauteur en mm.');
    return { largeur: d.largeur, hauteur: d.hauteur };
  }
  const f = FEUILLES[p.feuille];
  return { largeur: f.largeur, hauteur: f.hauteur };
}

interface Grille {
  colonnes: number;
  rangs: number;
  paysage: boolean;
  feuille: Dimension;
  /** Origine (bas-gauche) de la première pose finie, mm. */
  x0: number;
  y0: number;
  pasX: number;
  pasY: number;
}

/** Choisit l'orientation de la feuille qui loge le plus de poses, puis centre la grille. */
export function grillePoses(p: ParamsImposition, nbPosesMax = Infinity): Grille {
  const base = dimensionFeuille(p);
  const fp = Math.max(0, p.fonds_perdus_mm);
  const poseW = p.fini.largeur + 2 * fp;
  const poseH = p.fini.hauteur + 2 * fp;
  const pasX = poseW + Math.max(0, p.gouttiere_mm);
  const pasY = poseH + Math.max(0, p.gouttiere_mm);
  const marge = Math.max(0, p.marge_mm);
  const essai = (feuille: Dimension, paysage: boolean): Grille => {
    const colonnes = Math.max(0, Math.floor((feuille.largeur - 2 * marge + Math.max(0, p.gouttiere_mm)) / pasX));
    const rangs = Math.max(0, Math.floor((feuille.hauteur - 2 * marge + Math.max(0, p.gouttiere_mm)) / pasY));
    const totalW = colonnes * pasX - Math.max(0, p.gouttiere_mm);
    const totalH = rangs * pasY - Math.max(0, p.gouttiere_mm);
    return { colonnes, rangs, paysage, feuille, x0: arr((feuille.largeur - totalW) / 2 + fp), y0: arr((feuille.hauteur - totalH) / 2 + fp), pasX, pasY };
  };
  const portrait = essai(base, false);
  const paysage = essai({ largeur: base.hauteur, hauteur: base.largeur }, true);
  let g: Grille;
  if (p.orientation === 'portrait') g = portrait;
  else if (p.orientation === 'paysage') g = paysage;
  else g = paysage.colonnes * paysage.rangs > portrait.colonnes * portrait.rangs ? paysage : portrait;
  if (Number.isFinite(nbPosesMax) && g.colonnes * g.rangs > nbPosesMax) {
    // Moins de poses demandées que possibles : on garde la grille, les poses en trop restent vides.
  }
  return g;
}

function posesVides(g: Grille, fini: Dimension): Pose[] {
  const poses: Pose[] = [];
  // Rangées de haut en bas, colonnes de gauche à droite (ordre de lecture) ; y PDF part du bas.
  for (let r = 0; r < g.rangs; r++) {
    for (let c = 0; c < g.colonnes; c++) {
      const y = g.y0 + (g.rangs - 1 - r) * g.pasY;
      poses.push({ page: null, numero: null, x: arr(g.x0 + c * g.pasX), y: arr(y), largeur: fini.largeur, hauteur: fini.hauteur, rang: r, colonne: c });
    }
  }
  return poses;
}

/** Verso : positions en miroir pour que recto et verso se superposent après retournement. */
function miroir(poses: Pose[], feuille: Dimension, retournement: Retournement, paysage: boolean): Pose[] {
  // Retournement sur le bord long de la feuille : l'axe de rotation est vertical si la feuille est en
  // portrait (bord long = hauteur) → miroir gauche-droite ; en paysage le bord long est horizontal →
  // miroir haut-bas. Bord court : l'inverse.
  const gaucheDroite = retournement === 'bord_long' ? !paysage : paysage;
  return poses.map((q) => (gaucheDroite ? { ...q, x: arr(feuille.largeur - q.x - q.largeur) } : { ...q, y: arr(feuille.hauteur - q.y - q.hauteur) }));
}

function formaterNumero(n: Numerotation, i: number): string {
  return `${n.prefixe}${String(n.debut + i).padStart(n.chiffres, '0')}`;
}

/** Plan « poses ». `nbPages` : pages du PDF source. */
export function planPoses(p: ParamsImposition, nbPages: number): Plan {
  const avertissements: string[] = [];
  const g = grillePoses(p);
  const n = g.colonnes * g.rangs;
  if (n === 0) throw new Error(`Aucune pose ne tient sur la feuille : réduisez les marges, les fonds perdus ou choisissez une feuille plus grande.`);
  const fini = p.fini;
  const paires = p.paires && p.paires.length ? p.paires : null;
  const rv = paires ? paires.some((x) => x.verso !== null) || p.recto_verso : p.recto_verso;
  const feuilles: FeuillePlan[] = [];
  const versoDe = (recto: number | null): number | null => {
    if (recto === null) return null;
    if (paires) return paires.find((x) => x.recto === recto)?.verso ?? null;
    return rv ? recto + 1 : null;
  };

  if (p.mode === 'repetition') {
    const premiere = paires ? paires[0]! : { recto: 1, verso: rv ? (nbPages >= 2 ? 2 : null) : null };
    if (rv && premiere.verso === null) avertissements.push('Recto-verso demandé mais aucune page de verso : le verso sera vide.');
    const recto = posesVides(g, fini).map((q) => ({ ...q, page: premiere.recto }));
    const verso = rv ? miroir(posesVides(g, fini), g.feuille, p.retournement, g.paysage).map((q) => ({ ...q, page: premiere.verso })) : null;
    feuilles.push({ numero: 1, recto: { cote: 'recto', poses: recto, plis: [] }, verso: verso ? { cote: 'verso', poses: verso, plis: [] } : null });
    const nbElements = paires ? paires.length : rv ? Math.ceil(nbPages / 2) : nbPages;
    if (nbElements > 1) avertissements.push(`${nbElements} visuels différents sont disponibles : en répétition, seul le premier est utilisé. Choisissez « séquence » pour les imposer tous.`);
  } else {
    // Éléments à placer : pages (séquence) ou exemplaires numérotés (coupe & empile avec numérotation).
    const num = p.mode === 'coupe_empile' ? (p.numerotation ?? null) : null;
    let elements: { page: number; numero: string | null }[];
    if (num) {
      const quantite = Math.max(1, Math.floor(p.quantite ?? 0));
      if (!(quantite > 0)) throw new Error('Indiquez la quantité de tickets à numéroter.');
      elements = Array.from({ length: quantite }, (_, i) => ({ page: 1, numero: formaterNumero(num, i) }));
    } else if (paires) {
      elements = paires.map((x) => ({ page: x.recto, numero: null }));
      if (rv && paires.some((x) => x.verso === null)) avertissements.push('Certaines pages recto n’ont pas de verso : leur verso sera vide.');
    } else {
      const pas = rv ? 2 : 1;
      const nb = Math.ceil(nbPages / pas);
      elements = Array.from({ length: nb }, (_, i) => ({ page: 1 + i * pas, numero: null }));
      if (rv && nbPages % 2 === 1) avertissements.push('Recto-verso : le nombre de pages est impair, le dernier verso sera vide.');
    }
    const nbFeuilles = Math.ceil(elements.length / n);
    for (let s = 0; s < nbFeuilles; s++) {
      const recto = posesVides(g, fini);
      const verso = rv ? miroir(posesVides(g, fini), g.feuille, p.retournement, g.paysage) : null;
      for (let k = 0; k < n; k++) {
        // Séquence : la feuille s reçoit les éléments s·n … s·n+n-1. Coupe & empile : la pose k reçoit
        // l'élément k·nbFeuilles + s, pour que la pile k soit dans l'ordre après la coupe.
        const idx = p.mode === 'coupe_empile' ? k * nbFeuilles + s : s * n + k;
        const e = elements[idx];
        if (!e) continue;
        recto[k] = { ...recto[k]!, page: e.page, numero: e.numero };
        if (verso) {
          const v = num ? (paires ? paires[0]?.verso ?? null : nbPages >= 2 ? 2 : null) : versoDe(e.page);
          verso[k] = { ...verso[k]!, page: v !== null && v <= nbPages ? v : null, numero: num?.verso ? e.numero : null };
        }
      }
      feuilles.push({ numero: s + 1, recto: { cote: 'recto', poses: recto, plis: [] }, verso: verso ? { cote: 'verso', poses: verso, plis: [] } : null });
    }
  }
  const quantite = p.quantite && p.quantite > 0 ? p.quantite : null;
  return {
    operation: 'poses',
    feuille: g.feuille,
    paysage: g.paysage,
    fini,
    fonds_perdus_mm: p.fonds_perdus_mm,
    colonnes: g.colonnes,
    rangs: g.rangs,
    poses_par_face: n,
    nb_feuilles: feuilles.length,
    nb_pages_sortie: feuilles.reduce((t, f) => t + 1 + (f.verso ? 1 : 0), 0),
    feuilles_a_imprimer: p.mode === 'repetition' && quantite ? Math.ceil(quantite / n) : p.mode === 'repetition' ? null : feuilles.length,
    pages_blanches: 0,
    feuilles,
    avertissements,
  };
}

/** Plan « livret » (piqûre à cheval) : 2 pages par face, feuille choisie, ordre recalculé. */
export function planLivret(p: ParamsImposition, nbPagesTotal: number): Plan {
  const avertissements: string[] = [];
  // Avec des pièces recto/verso appariées, le livret suit l'ordre recto1, verso1, recto2, verso2…
  const ordrePages = p.paires && p.paires.length ? p.paires.flatMap((x) => (x.verso !== null ? [x.recto, x.verso] : [x.recto])) : null;
  const nbPages = ordrePages ? ordrePages.length : nbPagesTotal;
  const base = dimensionFeuille(p);
  const fini = p.fini;
  // La feuille se met dans le sens où deux pages côte à côte tiennent (A5 × 2 = A4 : aucune marge exigée ;
  // les fonds perdus sont réduits à ce qui reste si la feuille est juste).
  const tient = (f: Dimension) => f.largeur + 0.5 >= 2 * fini.largeur && f.hauteur + 0.5 >= fini.hauteur;
  const portrait = base;
  const paysage = { largeur: base.hauteur, hauteur: base.largeur };
  let feuille: Dimension;
  let estPaysage: boolean;
  if (p.orientation === 'portrait') [feuille, estPaysage] = [portrait, false];
  else if (p.orientation === 'paysage') [feuille, estPaysage] = [paysage, true];
  else if (tient(paysage)) [feuille, estPaysage] = [paysage, true];
  else [feuille, estPaysage] = [portrait, false];
  if (!tient(feuille)) throw new Error(`Deux pages ${fini.largeur} × ${fini.hauteur} mm côte à côte ne tiennent pas sur cette feuille : choisissez une feuille plus grande ou un format fini plus petit.`);
  const fpVoulu = Math.max(0, p.fonds_perdus_mm);
  const fpMax = Math.max(0, Math.min((feuille.largeur - 2 * fini.largeur) / 2, (feuille.hauteur - fini.hauteur) / 2));
  const fp = arr(Math.min(fpVoulu, fpMax));
  if (fp < fpVoulu) {
    avertissements.push(fp > 0
      ? `La feuille est juste : les fonds perdus sont réduits à ${fp} mm (${fpVoulu} mm demandés). Pour garder ${fpVoulu} mm, prenez une feuille plus grande (SRA4 pour un A5, SRA3 pour un A4).`
      : `La feuille a exactement la taille de deux pages : aucun fond perdu ni trait de coupe possible. Pour en avoir, prenez une feuille plus grande (SRA4 pour un A5, SRA3 pour un A4).`);
  }

  let total = nbPages;
  const reste = total % 4;
  const blanches = reste === 0 ? 0 : 4 - reste;
  total += blanches;
  if (blanches) avertissements.push(`${blanches} page${blanches > 1 ? 's' : ''} blanche${blanches > 1 ? 's' : ''} ajoutée${blanches > 1 ? 's' : ''} pour obtenir un multiple de 4 (${total} pages).`);
  // Ordre logique des pages du livret (1-based), avec les blanches à la fin ou avant la dernière page.
  const ordre: (number | null)[] = ordrePages ? [...ordrePages] : Array.from({ length: nbPages }, (_, i) => i + 1);
  if (p.blanches === 'avant_derniere' && nbPages >= 1) ordre.splice(nbPages - 1, 0, ...Array(blanches).fill(null));
  else ordre.push(...Array(blanches).fill(null));

  const nbFeuilles = total / 4;
  const x0 = arr((feuille.largeur - 2 * fini.largeur) / 2);
  const y0 = arr((feuille.hauteur - fini.hauteur) / 2);
  const chasseTotale = Math.max(0, p.chasse_mm ?? 0);
  const feuilles: FeuillePlan[] = [];
  for (let s = 0; s < nbFeuilles; s++) {
    // Feuille s (0-based) : recto = [dernière - 2s | première + 2s], verso = [première + 2s + 1 | dernière - 2s - 1].
    const g1 = total - 1 - 2 * s;
    const d1 = 2 * s;
    const g2 = 2 * s + 1;
    const d2 = total - 2 - 2 * s;
    // Chasse : le cahier extérieur (s = 0) ne bouge pas, les intérieurs s'écartent vers l'extérieur.
    const dec = nbFeuilles > 1 ? arr((chasseTotale * s) / (nbFeuilles - 1)) : 0;
    const pose = (logique: number, gauche: boolean, rang: number): Pose => ({
      page: ordre[logique] ?? null,
      numero: null,
      x: arr(gauche ? x0 - dec : x0 + fini.largeur + dec),
      y: y0,
      largeur: fini.largeur,
      hauteur: fini.hauteur,
      decalage_x: gauche ? -dec : dec,
      rang,
      colonne: gauche ? 0 : 1,
    });
    const pli = arr(feuille.largeur / 2);
    feuilles.push({
      numero: s + 1,
      recto: { cote: 'recto', poses: [pose(g1, true, 0), pose(d1, false, 0)], plis: [pli] },
      verso: { cote: 'verso', poses: [pose(g2, true, 0), pose(d2, false, 0)], plis: [pli] },
    });
  }
  if (p.recto_verso === false) avertissements.push('Un livret est toujours recto-verso : les deux faces de chaque feuille sont générées.');
  return {
    operation: 'livret',
    feuille,
    paysage: estPaysage,
    fini,
    fonds_perdus_mm: fp,
    colonnes: 2,
    rangs: 1,
    poses_par_face: 2,
    nb_feuilles: nbFeuilles,
    nb_pages_sortie: nbFeuilles * 2,
    feuilles_a_imprimer: p.quantite && p.quantite > 0 ? nbFeuilles * p.quantite : nbFeuilles,
    pages_blanches: blanches,
    feuilles,
    avertissements,
  };
}

/** Plan « fonds perdus » : une page de sortie par page source, format fini + fonds perdus (+ traits). */
export function planFondsPerdus(p: ParamsImposition, nbPages: number): Plan {
  const fp = Math.max(0, p.fonds_perdus_mm);
  const marge = p.traits_de_coupe ? Math.max(fp + 6, 8) : fp;
  const feuille = { largeur: arr(p.fini.largeur + 2 * marge), hauteur: arr(p.fini.hauteur + 2 * marge) };
  const feuilles: FeuillePlan[] = [];
  for (let i = 0; i < nbPages; i++) {
    feuilles.push({ numero: i + 1, recto: { cote: 'recto', poses: [{ page: i + 1, numero: null, x: marge, y: marge, largeur: p.fini.largeur, hauteur: p.fini.hauteur, rang: 0, colonne: 0 }], plis: [] }, verso: null });
  }
  return {
    operation: 'fonds_perdus',
    feuille,
    paysage: feuille.largeur > feuille.hauteur,
    fini: p.fini,
    fonds_perdus_mm: fp,
    colonnes: 1,
    rangs: 1,
    poses_par_face: 1,
    nb_feuilles: nbPages,
    nb_pages_sortie: nbPages,
    feuilles_a_imprimer: null,
    pages_blanches: 0,
    feuilles,
    avertissements: [],
  };
}

/** Plan « assembler » : les pages réunies dans l'ordre des pièces, sans imposition (une feuille par page). */
export function planAssembler(p: ParamsImposition, nbPages: number, pages?: { largeur: number; hauteur: number }[]): Plan {
  const ordre = p.paires && p.paires.length ? p.paires.flatMap((x) => (x.verso !== null ? [x.recto, x.verso] : [x.recto])) : Array.from({ length: nbPages }, (_, i) => i + 1);
  const feuilles: FeuillePlan[] = ordre.map((n, i) => {
    const d = pages?.[n - 1] ?? pages?.[0] ?? { largeur: p.fini.largeur, hauteur: p.fini.hauteur };
    return { numero: i + 1, recto: { cote: 'recto', poses: [{ page: n, numero: null, x: 0, y: 0, largeur: d.largeur, hauteur: d.hauteur, rang: 0, colonne: 0 }], plis: [] }, verso: null };
  });
  const d0 = pages?.[0] ?? { largeur: p.fini.largeur, hauteur: p.fini.hauteur };
  return {
    operation: 'assembler',
    feuille: { largeur: d0.largeur, hauteur: d0.hauteur },
    paysage: d0.largeur > d0.hauteur,
    fini: d0,
    fonds_perdus_mm: 0,
    colonnes: 1,
    rangs: 1,
    poses_par_face: 1,
    nb_feuilles: feuilles.length,
    nb_pages_sortie: feuilles.length,
    feuilles_a_imprimer: null,
    pages_blanches: 0,
    feuilles,
    avertissements: [],
  };
}

export function calculerPlan(p: ParamsImposition, nbPages: number, pages?: { largeur: number; hauteur: number }[]): Plan {
  if (nbPages < 1) throw new Error('Le fichier ne contient aucune page.');
  if (p.operation === 'assembler') return planAssembler(p, nbPages, pages);
  if (p.operation === 'livret') return planLivret(p, nbPages);
  if (p.operation === 'fonds_perdus') return planFondsPerdus(p, nbPages);
  return planPoses(p, nbPages);
}

/** Paramètres de départ raisonnables pour un fichier analysé. */
export function paramsParDefaut(analyse: { fini: Dimension; fonds_perdus: string; fonds_perdus_mm: number; nb_pages: number; format: { famille: string } | null }, operation: Operation = 'poses'): ParamsImposition {
  const fpPresents = analyse.fonds_perdus !== 'absents';
  const famille = analyse.format?.famille;
  return {
    operation,
    feuille: 'sra3',
    orientation: 'auto',
    fini: { largeur: analyse.fini.largeur, hauteur: analyse.fini.hauteur },
    fonds_perdus_mm: fpPresents ? analyse.fonds_perdus_mm || FONDS_PERDUS_STANDARD : FONDS_PERDUS_STANDARD,
    methode_fonds_perdus: fpPresents ? 'source' : 'miroir',
    gouttiere_mm: 0,
    marge_mm: 10,
    traits_de_coupe: true,
    recto_verso: analyse.nb_pages >= 2,
    retournement: 'bord_long',
    mode: famille === 'ticket' ? 'coupe_empile' : analyse.nb_pages > 2 ? 'sequence' : 'repetition',
    quantite: undefined,
    numerotation: null,
    ajustement: 'centrer',
    chasse_mm: 0,
    blanches: 'fin',
  };
}
