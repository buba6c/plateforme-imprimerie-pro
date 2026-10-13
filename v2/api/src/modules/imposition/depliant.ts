// Plans « dépliant » : une pièce pliée, dont les volets (panneaux) sont imposés dans l'ordre qui donne
// la bonne lecture une fois pliée. Deux façons de recevoir le fichier :
//  - « développé » : deux pages (extérieur, intérieur) déjà à la taille de la pièce ouverte ; chaque face
//    est une pose, les plis sont simplement tracés ;
//  - « volets » : une page par volet, dans l'ordre de lecture (P1 = couverture) ; chaque volet est une
//    pose, à sa largeur, les volets d'une face sont jointifs (aucun fond perdu entre eux).
// Tables de pages (recto = face extérieure, verso = face intérieure, volets de gauche à droite dans leur
// propre vue ; dos à dos : recto volet j ↔ verso volet V−1−j) et largeurs de volets (le rabat rentrant
// d'un pli roulé est plus étroit de 2 à 3 mm, le jeu central d'un pli fenêtre de 3 mm) :
//  - simple (4 p.) : R [4 | 1], V [2 | 3] ;
//  - roulé 3 (6 p.) : R [5 | 6 | 1] (97 | 100 | 100 pour un A4), V [2 | 3 | 4] (100 | 100 | 97) ;
//  - accordéon 3 (6 p.) : mêmes pages, volets égaux ; accordéon 4 (8 p.) : R [1 | 2 | 3 | 4], V [5 | 6 | 7 | 8] ;
//  - fenêtre (6 p., pages dans l'ordre d'imposition) : R [couv. droite | dos | couv. gauche], V [2 | 3 | 4] ;
//  - portefeuille (8 p.) : R [3 | 1 | 8 | 2], V [4 | 5 | 6 | 7] ; parallèle double (8 p.) : R [1 | 8 | 2 | 3], V [4 | 5 | 6 | 7] ;
//  - roulé 4 (8 p.) : R [8 | 1 | 2 | 3], V [4 | 5 | 6 | 7] ;
//  - croisé 8 (8 p.) : grille 2 × 2, rang du haut tourné d'un demi-tour : R [5 | 4] / [8 | 1], V [3 | 6] / [2 | 7] ;
//  - italienne (4 p., pli en haut) : R bas = 1, haut = 4 tourné ; V haut = 2, bas = 3 ;
//  - chevalet (recto seul) : base, face A, face B tournée.
// Les faces des plis verticaux se retournent sur l'axe vertical (consigne pilote), celles des plis
// horizontaux (italienne, chevalet) sur l'axe horizontal, sans tourner le contenu.

import type { Dimension } from './formats';
import { arrondiMm as arr, dimensionFeuille, type Face, type FeuillePlan, type ParamsImposition, type PlanBrut, type Pose, type Rotation } from './plan';
import type { Ligne } from './reperes';

export type Pliage = 'simple' | 'roule_3' | 'accordeon_3' | 'accordeon_4' | 'fenetre' | 'portefeuille' | 'parallele_double' | 'roule_4' | 'croise_8' | 'italienne' | 'chevalet';
export const PLIAGES: Pliage[] = ['simple', 'roule_3', 'accordeon_3', 'accordeon_4', 'fenetre', 'portefeuille', 'parallele_double', 'roule_4', 'croise_8', 'italienne', 'chevalet'];

export interface InfoDepliant {
  pliage: Pliage;
  entree: 'developpe' | 'volets';
  /** Format développé (mm). */
  developpe: Dimension;
  /** Format fermé (mm). */
  ferme: Dimension;
  /** Volets de chaque face (mm, de gauche à droite ou de haut en bas), avec la page qu'ils reçoivent. */
  volets: { recto: { largeur: number; page: number | null }[]; verso: { largeur: number; page: number | null }[] };
  /** Positions des plis sur chaque face (mm depuis le bord gauche ou bas de la pièce). */
  plis: { recto: number[]; verso: number[] };
  pages_attendues: number;
  pieces_par_feuille: number;
  axe: 'vertical' | 'horizontal';
}

const r05 = (v: number) => Math.round(v * 2) / 2;

/** Largeurs des volets d'une face, somme = D (le dernier volet absorbe l'arrondi). */
function largeursVolets(pliage: Pliage, D: number, face: 'recto' | 'verso', reduction: number, jeu: number): number[] {
  let l: number[];
  switch (pliage) {
    case 'simple':
      l = [D / 2, D / 2];
      break;
    case 'roule_3': {
      const v = r05(Math.round(D / 3) - reduction);
      const a = (D - v) / 2;
      l = face === 'recto' ? [v, a, a] : [a, a, v];
      break;
    }
    case 'accordeon_3':
      l = [D / 3, D / 3, D / 3];
      break;
    case 'accordeon_4':
      l = [D / 4, D / 4, D / 4, D / 4];
      break;
    case 'fenetre': {
      const p = D / 4 - jeu / 4;
      l = [p, D - 2 * p, p];
      break;
    }
    case 'portefeuille': {
      const p = D / 4 - 0.75;
      const q = (D - 2 * p) / 2;
      l = [p, q, q, p];
      break;
    }
    case 'parallele_double': {
      const a = D / 4 + 0.75;
      const b = D / 4 - 0.75;
      l = face === 'recto' ? [a, a, b, b] : [b, b, a, a];
      break;
    }
    case 'roule_4': {
      const ext = [D / 4 + 2, D / 4 + 1, D / 4 - 1, D / 4 - 2];
      l = face === 'recto' ? ext : [...ext].reverse();
      break;
    }
    case 'croise_8':
      l = [D / 2, D / 2];
      break;
    default:
      l = [D];
  }
  const arrondis = l.map(r05);
  const somme = arrondis.reduce((t, x) => t + x, 0);
  arrondis[arrondis.length - 1] = arr(arrondis[arrondis.length - 1]! + (D - somme));
  return arrondis;
}

/** Pages de chaque volet (1-based, null = vide), face extérieure puis intérieure, de gauche à droite. */
function tablePages(pliage: Pliage): { recto: (number | null)[]; verso: (number | null)[] } {
  switch (pliage) {
    case 'simple':
      return { recto: [4, 1], verso: [2, 3] };
    case 'roule_3':
    case 'accordeon_3':
      return { recto: [5, 6, 1], verso: [2, 3, 4] };
    case 'accordeon_4':
      return { recto: [1, 2, 3, 4], verso: [5, 6, 7, 8] };
    case 'fenetre':
      // Pages fournies dans l'ordre d'imposition : couverture droite (moitié), dos, couverture gauche (moitié), puis l'intérieur.
      return { recto: [1, 2, 3], verso: [4, 5, 6] };
    case 'portefeuille':
      return { recto: [3, 1, 8, 2], verso: [4, 5, 6, 7] };
    case 'parallele_double':
      return { recto: [1, 8, 2, 3], verso: [4, 5, 6, 7] };
    case 'roule_4':
      return { recto: [8, 1, 2, 3], verso: [4, 5, 6, 7] };
    case 'croise_8':
      // Rang du haut puis rang du bas (le rang du haut est tourné d'un demi-tour).
      return { recto: [5, 4, 8, 1], verso: [3, 6, 2, 7] };
    case 'italienne':
      // Bas puis haut : extérieur = couverture en bas, 4e en haut (tournée) ; intérieur = 3 en bas, 2 en haut.
      return { recto: [1, 4], verso: [3, 2] };
    case 'chevalet':
      return { recto: [1, 2], verso: [] };
  }
}

export function pagesAttendues(pliage: Pliage): number {
  const t = tablePages(pliage);
  return Math.max(...[...t.recto, ...t.verso].filter((x): x is number => x !== null));
}

/** Format développé d'après le format fini saisi : fermé pour l'italienne et le chevalet, développé sinon. */
export function developpeDe(p: ParamsImposition): { developpe: Dimension; ferme: Dimension } {
  const pliage = (p.pliage ?? 'roule_3') as Pliage;
  const base = Math.max(10, p.base_mm ?? 25);
  if (pliage === 'italienne') return { developpe: { largeur: p.fini.largeur, hauteur: arr(2 * p.fini.hauteur) }, ferme: p.fini };
  if (pliage === 'chevalet') return { developpe: { largeur: p.fini.largeur, hauteur: arr(2 * p.fini.hauteur + base) }, ferme: p.fini };
  const nb = pliage === 'croise_8' ? 2 : largeursVolets(pliage, p.fini.largeur, 'recto', 0, 0).length;
  const ferme = pliage === 'croise_8' ? { largeur: arr(p.fini.largeur / 2), hauteur: arr(p.fini.hauteur / 2) } : { largeur: arr(p.fini.largeur / nb), hauteur: p.fini.hauteur };
  return { developpe: p.fini, ferme };
}

interface Grille {
  feuille: Dimension;
  paysage: boolean;
  positions: { x: number; y: number }[];
  colonnes: number;
  rangs: number;
}

/** Autant de pièces développées que possible sur la feuille (grille centrée). */
function placerPieces(p: ParamsImposition, pw: number, ph: number, fp: number): Grille {
  const base = dimensionFeuille(p);
  const g = Math.max(0, p.gouttiere_mm);
  const m = Math.max(0, p.marge_mm);
  const essai = (feuille: Dimension, paysage: boolean): Grille => {
    const pasX = pw + 2 * fp + g;
    const pasY = ph + 2 * fp + g;
    const cols = Math.max(0, Math.floor((feuille.largeur - 2 * m + g + 1e-6) / pasX));
    const rows = Math.max(0, Math.floor((feuille.hauteur - 2 * m + g + 1e-6) / pasY));
    const blocW = cols * pasX - g;
    const blocH = rows * pasY - g;
    const x0 = (feuille.largeur - blocW) / 2 + fp;
    const y0 = (feuille.hauteur - blocH) / 2 + fp;
    const positions: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) positions.push({ x: arr(x0 + c * pasX), y: arr(y0 + (rows - 1 - r) * pasY) });
    return { feuille, paysage, positions, colonnes: cols, rangs: rows };
  };
  const portrait = essai(base, false);
  const paysage = essai({ largeur: base.hauteur, hauteur: base.largeur }, true);
  if (p.orientation === 'portrait') return portrait;
  if (p.orientation === 'paysage') return paysage;
  return paysage.positions.length > portrait.positions.length ? paysage : portrait;
}

/** Plan « dépliant ». `nbPages` : pages du document assemblé. */
export function planDepliant(p: ParamsImposition, nbPages: number): PlanBrut & { depliant: InfoDepliant } {
  const avertissements: string[] = [];
  const consignes: string[] = [];
  const pliage = (p.pliage ?? 'roule_3') as Pliage;
  const entree: 'developpe' | 'volets' = p.entree === 'volets' ? 'volets' : 'developpe';
  const reduction = p.reduction_volet_mm ?? 2;
  const jeu = p.jeu_central_mm ?? 3;
  const { developpe, ferme } = developpeDe(p);
  const D = developpe.largeur;
  const Hd = developpe.hauteur;
  const horizontal = pliage === 'italienne' || pliage === 'chevalet';
  const table = tablePages(pliage);
  const attendues = entree === 'developpe' ? (pliage === 'chevalet' ? 1 : 2) : pagesAttendues(pliage);
  if (entree === 'volets' && nbPages < attendues) avertissements.push(`${pliage === 'fenetre' ? 'Pli fenêtre' : 'Ce pliage'} attend ${attendues} pages (une par volet) : le document n’en a que ${nbPages}, les volets manquants restent vides.`);
  if (entree === 'developpe' && nbPages < attendues) avertissements.push(`Entrée « développé » : ${attendues} page${attendues > 1 ? 's' : ''} attendue${attendues > 1 ? 's' : ''} (extérieur${attendues > 1 ? ', intérieur' : ''}) ; le verso restera vide.`);
  const fp = Math.max(0, p.fonds_perdus_mm);
  const grille = placerPieces(p, D, Hd, fp);
  if (!grille.positions.length) throw new Error(`Le développé ${D} × ${Hd} mm ne tient pas sur cette feuille : choisissez une feuille plus grande.`);
  const page = (n: number | null) => (n !== null && n <= nbPages ? n : null);

  // Volets et plis de chaque face.
  const voletsRecto = horizontal ? [] : largeursVolets(pliage, D, 'recto', reduction, jeu);
  const voletsVerso = horizontal ? [] : largeursVolets(pliage, D, 'verso', reduction, jeu);
  const plisDe = (l: number[]) => l.slice(0, -1).map((_, i) => arr(l.slice(0, i + 1).reduce((t, x) => t + x, 0)));
  const plisRecto = horizontal ? (pliage === 'chevalet' ? [arr(p.base_mm ?? 25), arr((p.base_mm ?? 25) + ferme.hauteur)] : [ferme.hauteur]) : pliage === 'croise_8' ? [arr(D / 2)] : plisDe(voletsRecto);
  const plisVerso = horizontal ? plisRecto : pliage === 'croise_8' ? [arr(D / 2)] : plisDe(voletsVerso);
  const genreLigne: Ligne['genre'] = p.rainage || pliage === 'chevalet' ? 'rainage' : 'pli';

  const faceDe = (cote: 'recto' | 'verso'): Face | null => {
    if (cote === 'verso' && pliage === 'chevalet') return null;
    const poses: Pose[] = [];
    const lignes: Ligne[] = [];
    const plis: number[] = [];
    const plisH: number[] = [];
    const pages = cote === 'recto' ? table.recto : table.verso;
    const volets = cote === 'recto' ? voletsRecto : voletsVerso;
    grille.positions.forEach((pos, j) => {
      // Verso : la pièce tombe à la position miroir (axe vertical pour les plis verticaux, horizontal sinon).
      const X = cote === 'recto' || horizontal ? pos.x : arr(grille.feuille.largeur - pos.x - D);
      const Y = cote === 'recto' || !horizontal ? pos.y : arr(grille.feuille.hauteur - pos.y - Hd);
      if (entree === 'developpe' && pliage !== 'chevalet') {
        poses.push({ page: page(cote === 'recto' ? 1 : 2), numero: null, x: X, y: Y, largeur: D, hauteur: Hd, rang: j, colonne: 0 });
      } else if (pliage === 'croise_8') {
        const w2 = D / 2;
        const h2 = Hd / 2;
        pages.forEach((n, k) => {
          const haut = k < 2;
          const c = k % 2;
          const pose: Pose = { page: page(n), numero: null, x: arr(X + c * w2), y: arr(Y + (haut ? h2 : 0)), largeur: w2, hauteur: h2, rang: haut ? 0 : 1, colonne: c, joints: [c === 0 ? 'droite' : 'gauche', haut ? 'bas' : 'haut'] };
          if (haut) pose.rotation = 180;
          poses.push(pose);
        });
        plisH.push(arr(Y + h2));
      } else if (pliage === 'italienne') {
        const h = ferme.hauteur;
        const [bas, haut] = pages;
        poses.push({ page: page(bas!), numero: null, x: X, y: Y, largeur: D, hauteur: h, rang: 1, colonne: j, pli: 'haut', joints: ['haut'] });
        const pHaut: Pose = { page: page(haut!), numero: null, x: X, y: arr(Y + h), largeur: D, hauteur: h, rang: 0, colonne: j, pli: 'bas', joints: ['bas'] };
        // Extérieur : la 4e de couverture (en haut) est tournée pour se lire à l'endroit une fois la carte fermée.
        if (cote === 'recto') pHaut.rotation = 180;
        poses.push(pHaut);
        plisH.push(arr(Y + h));
      } else if (pliage === 'chevalet') {
        const h = ferme.hauteur;
        const b = Math.max(10, p.base_mm ?? 25);
        const [a, bb] = pages;
        poses.push({ page: null, numero: null, x: X, y: Y, largeur: D, hauteur: b, rang: 2, colonne: j, joints: ['haut'] });
        poses.push({ page: page(a!), numero: null, x: X, y: arr(Y + b), largeur: D, hauteur: h, rang: 1, colonne: j, joints: ['haut', 'bas'] });
        poses.push({ page: page(bb!) ?? page(a!), numero: null, x: X, y: arr(Y + b + h), largeur: D, hauteur: h, rang: 0, colonne: j, joints: ['bas'], rotation: 180 });
        plisH.push(arr(Y + b), arr(Y + b + h));
      } else {
        let x = X;
        volets.forEach((lv, k) => {
          const joints: Pose['joints'] = [];
          if (k > 0) joints.push('gauche');
          if (k < volets.length - 1) joints.push('droite');
          poses.push({ page: page(pages[k] ?? null), numero: null, x: arr(x), y: Y, largeur: lv, hauteur: Hd, rang: j, colonne: k, joints });
          if (k < volets.length - 1) plis.push(arr(x + lv));
          x += lv;
        });
      }
      if (entree === 'developpe' && !horizontal && pliage !== 'croise_8') for (const pl of cote === 'recto' ? plisRecto : plisVerso) plis.push(arr(X + pl));
    });
    const face: Face = { cote, poses, plis: [...new Set(plis)] };
    if (plisH.length) face.plis_h = [...new Set(plisH)];
    if (genreLigne === 'rainage') {
      // Les lignes de pli sont tracées par reperes.ts ; un rainage est signalé par des tirets plus serrés aux deux bouts.
      for (const x of face.plis) for (const [de, a] of [[5, 12.5], [grille.feuille.hauteur - 12.5, grille.feuille.hauteur - 5]] as const) lignes.push({ axe: 'x', pos: x, de, a, genre: 'rainage' });
      for (const y of face.plis_h ?? []) for (const [de, a] of [[5, 12.5], [grille.feuille.largeur - 12.5, grille.feuille.largeur - 5]] as const) lignes.push({ axe: 'y', pos: y, de, a, genre: 'rainage' });
      face.plis = [];
      face.plis_h = [];
    }
    if (lignes.length) face.lignes = lignes;
    return face;
  };

  const recto = faceDe('recto')!;
  const verso = faceDe('verso');
  const feuilles: FeuillePlan[] = [{ numero: 1, recto, verso, libelle: `${grille.positions.length} pièce${grille.positions.length > 1 ? 's' : ''} par feuille` }];
  const paysage = grille.paysage;
  const retournement: 'bord_long' | 'bord_court' = horizontal ? (paysage ? 'bord_long' : 'bord_court') : paysage ? 'bord_court' : 'bord_long';
  if (verso) consignes.push(`Pilote Xerox : recto-verso, retourner sur le ${retournement === 'bord_long' ? 'bord long' : 'bord court'} (feuille ${paysage ? 'paysage' : 'portrait'}).`);
  if (pliage === 'roule_3' || pliage === 'roule_4') consignes.push(`Pli roulé : le rabat rentrant est réduit de ${reduction} mm pour ne pas buter dans le pli.`);
  if (pliage === 'fenetre') consignes.push(`Pli fenêtre : jeu central de ${jeu} mm entre les deux volets rabattus.`);
  if (genreLigne === 'rainage') consignes.push('Rainer avant de plier (papier épais).');
  if (pliage === 'chevalet') consignes.push('Chevalet : recto seul ; plier sur les deux rainages, la base se glisse sous la face avant.');
  avertissements.push('Vérifier le sens des pages sur une maquette pliée avant le tirage : les conventions varient d’un atelier à l’autre.');
  const quantite = p.quantite && p.quantite > 0 ? p.quantite : null;
  const nbPieces = grille.positions.length;
  const info: InfoDepliant = {
    pliage,
    entree,
    developpe,
    ferme,
    volets: {
      recto: horizontal ? [] : voletsRecto.map((l, k) => ({ largeur: l, page: page(table.recto[k] ?? null) })),
      verso: horizontal ? [] : voletsVerso.map((l, k) => ({ largeur: l, page: page(table.verso[k] ?? null) })),
    },
    plis: { recto: plisRecto, verso: plisVerso },
    pages_attendues: attendues,
    pieces_par_feuille: nbPieces,
    axe: horizontal ? 'horizontal' : 'vertical',
  };
  return {
    operation: 'depliant',
    feuille: grille.feuille,
    paysage,
    fini: developpe,
    fonds_perdus_mm: fp,
    colonnes: grille.colonnes,
    rangs: grille.rangs,
    poses_par_face: nbPieces,
    nb_feuilles: 1,
    nb_pages_sortie: verso ? 2 : 1,
    feuilles_a_imprimer: quantite ? Math.ceil(quantite / nbPieces) : null,
    pages_blanches: 0,
    feuilles,
    avertissements,
    retournement_effectif: retournement,
    axe_verso: horizontal ? 'horizontal' : 'vertical',
    consignes,
    depliant: info,
  };
}
