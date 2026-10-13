// Repères d'une feuille, calculés dans le plan (mm, origine bas-gauche) : traits de coupe selon le style,
// lignes de pli, cotes de coupe. Le moteur PDF et l'aperçu SVG tracent exactement ces segments, donc
// l'écran montre ce qui sortira de la machine.
//
// Règle des traits de coupe (style « auto ») : aux angles de chaque pose seulement s'ils ne tombent pas
// sur une pose voisine (gouttière ≥ 2 × (fonds perdus + 1 + 4) mm) ou pour une pose unique ; sinon un trait
// par ligne de coupe, autour du bloc de poses, jamais sur un visuel. Repères de 5 mm en bordure de
// feuille quand il reste de la place. Tout ce qui tombe dans le bord non imprimable de la machine est
// raccourci, et omis s'il n'en reste rien de lisible.

import type { Face, Plan, ParamsImposition, Pose, Rotation, StyleTraits } from './plan';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Épaisseur (pt) ; 0,25 par défaut. */
  epaisseur?: number;
}

export interface Ligne {
  axe: 'x' | 'y';
  /** Position de la ligne (x pour une ligne verticale, y pour une horizontale), mm. */
  pos: number;
  de: number;
  a: number;
  genre: 'pli' | 'rainage' | 'perforation';
}

export interface Texte {
  x: number;
  y: number;
  texte: string;
  taille_pt: number;
  rotation: Rotation;
  gras?: boolean;
  ancre?: 'gauche' | 'centre' | 'droite';
}

export const LONGUEUR_TRAIT = 4; // mm
export const ECART_TRAIT = 1; // mm au-delà des fonds perdus
const BORD_FEUILLE = 5; // mm : repères en bordure de feuille
const arr = (v: number) => Math.round(v * 100) / 100;

interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}

function boite(q: Pose): Boite {
  const tourne = q.rotation === 90 || q.rotation === 270;
  return { x: q.x, y: q.y, w: tourne ? q.hauteur : q.largeur, h: tourne ? q.largeur : q.hauteur };
}

/** Coupe un segment axé (vertical ou horizontal) sur les intervalles des boîtes qu'il traverse. */
function retrancher(seg: Segment, boites: Boite[]): Segment[] {
  const vertical = Math.abs(seg.x1 - seg.x2) < 1e-6;
  let intervalles: [number, number][] = [[Math.min(seg.y1, seg.y2), Math.max(seg.y1, seg.y2)]];
  if (!vertical) intervalles = [[Math.min(seg.x1, seg.x2), Math.max(seg.x1, seg.x2)]];
  for (const b of boites) {
    const traverse = vertical ? seg.x1 > b.x - 1e-6 && seg.x1 < b.x + b.w + 1e-6 : seg.y1 > b.y - 1e-6 && seg.y1 < b.y + b.h + 1e-6;
    if (!traverse) continue;
    const [lo, hi] = vertical ? [b.y, b.y + b.h] : [b.x, b.x + b.w];
    const suite: [number, number][] = [];
    for (const [a, c] of intervalles) {
      if (hi <= a || lo >= c) suite.push([a, c]);
      else {
        if (lo > a) suite.push([a, lo]);
        if (hi < c) suite.push([hi, c]);
      }
    }
    intervalles = suite;
  }
  return intervalles
    .filter(([a, c]) => c - a >= 1)
    .map(([a, c]) => (vertical ? { ...seg, y1: arr(a), y2: arr(c) } : { ...seg, x1: arr(a), x2: arr(c) }));
}

/** Borne un segment à la zone imprimable ; null s'il n'en reste pas 1 mm. */
function borner(seg: Segment, W: number, H: number, mt: number): Segment | null {
  const x1 = Math.min(Math.max(seg.x1, mt), W - mt);
  const x2 = Math.min(Math.max(seg.x2, mt), W - mt);
  const y1 = Math.min(Math.max(seg.y1, mt), H - mt);
  const y2 = Math.min(Math.max(seg.y2, mt), H - mt);
  if (Math.hypot(x2 - x1, y2 - y1) < 1 - 1e-6) return null;
  return { ...seg, x1: arr(x1), y1: arr(y1), x2: arr(x2), y2: arr(y2) };
}

/**
 * Traits de coupe d'une face. `gouttiere` : la plus petite gouttière entre poses (0 pour un livret).
 * Renvoie les segments et le nombre de repères perdus dans le bord non imprimable.
 */
export function traitsFace(face: Face, feuille: { largeur: number; hauteur: number }, fondsMm: number, gouttiereMm: number, style: StyleTraits, mt: number): { traits: Segment[]; perdus: number } {
  if (style === 'aucun') return { traits: [], perdus: 0 };
  const L = LONGUEUR_TRAIT;
  const e = fondsMm + ECART_TRAIT;
  const W = feuille.largeur;
  const H = feuille.hauteur;
  const pleines = face.poses.filter((q) => q.page !== null || face.poses.length === 1);
  if (!pleines.length) return { traits: [], perdus: 0 };
  const boites = pleines.map(boite);
  const xs = new Set<number>();
  const ys = new Set<number>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boites) {
    xs.add(arr(b.x)); xs.add(arr(b.x + b.w)); ys.add(arr(b.y)); ys.add(arr(b.y + b.h));
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  // Un pli n'est pas une coupe : les bords de poses qui tombent sur un pli (ou un rainage) ne reçoivent pas de trait.
  const plisX = new Set([...face.plis, ...(face.lignes ?? []).filter((l) => l.axe === 'x' && l.genre !== 'perforation').map((l) => l.pos)].map(arr));
  const plisY = new Set([...(face.plis_h ?? []), ...(face.lignes ?? []).filter((l) => l.axe === 'y' && l.genre !== 'perforation').map((l) => l.pos)].map(arr));
  for (const x of plisX) xs.delete(x);
  for (const y of plisY) ys.delete(y);
  const anglesPossibles = gouttiereMm >= 2 * (fondsMm + ECART_TRAIT + L) || pleines.length === 1;
  const styleEff: Exclude<StyleTraits, 'auto'> = style === 'auto' ? (anglesPossibles ? 'angles' : 'bloc') : style;
  const bruts: Segment[] = [];
  const seg = (x1: number, y1: number, x2: number, y2: number) => bruts.push({ x1: arr(x1), y1: arr(y1), x2: arr(x2), y2: arr(y2) });
  // Zones interdites aux traits : les poses pleines avec leurs fonds perdus et un demi-millimètre.
  const interdites = boites.map((b) => ({ x: b.x - fondsMm - 0.5, y: b.y - fondsMm - 0.5, w: b.w + 2 * fondsMm + 1, h: b.h + 2 * fondsMm + 1 }));
  if (styleEff === 'angles') {
    for (const b of boites) {
      const autres = interdites.filter((z) => !(Math.abs(z.x + fondsMm + 0.5 - b.x) < 1e-6 && Math.abs(z.y + fondsMm + 0.5 - b.y) < 1e-6));
      const angles: Segment[] = [];
      for (const cx of [b.x, b.x + b.w]) {
        angles.push({ x1: cx, y1: b.y - e, x2: cx, y2: b.y - e - L });
        angles.push({ x1: cx, y1: b.y + b.h + e, x2: cx, y2: b.y + b.h + e + L });
      }
      for (const cy of [b.y, b.y + b.h]) {
        angles.push({ x1: b.x - e, y1: cy, x2: b.x - e - L, y2: cy });
        angles.push({ x1: b.x + b.w + e, y1: cy, x2: b.x + b.w + e + L, y2: cy });
      }
      // Un trait qui entrerait dans une voisine est raccourci (angles forcés avec une petite gouttière).
      for (const a of angles) for (const s of anglesPossibles ? [a] : retrancher(a, autres)) seg(s.x1, s.y1, s.x2, s.y2);
    }
  } else if (styleEff === 'bloc') {
    for (const x of xs) {
      seg(x, minY - e, x, Math.max(0, minY - e - L));
      seg(x, maxY + e, x, Math.min(H, maxY + e + L));
    }
    for (const y of ys) {
      seg(minX - e, y, Math.max(0, minX - e - L), y);
      seg(maxX + e, y, Math.min(W, maxX + e + L), y);
    }
  } else if (styleEff === 'traversants') {
    for (const x of xs) for (const s of retrancher({ x1: x, y1: 0, x2: x, y2: H }, interdites)) bruts.push(s);
    for (const y of ys) for (const s of retrancher({ x1: 0, y1: y, x2: W, y2: y }, interdites)) bruts.push(s);
  }
  // Bordure de feuille, pour couper au massicot d'un seul trait (hors de toute pose) : repères de 5 mm
  // qui partent du bord imprimable (le bord non imprimable de la machine ne reçoit rien).
  if (styleEff !== 'traversants') {
    const marge = BORD_FEUILLE;
    const bord = styleEff === 'bord_feuille';
    for (const x of xs) {
      if (bord || minY - e - L > mt + marge) seg(x, mt, x, mt + marge);
      if (bord || H - (maxY + e + L) > mt + marge) seg(x, H - mt, x, H - mt - marge);
    }
    for (const y of ys) {
      if (bord || minX - e - L > mt + marge) seg(mt, y, mt + marge, y);
      if (bord || W - (maxX + e + L) > mt + marge) seg(W - mt, y, W - mt - marge, y);
    }
  }
  const traits: Segment[] = [];
  let perdus = 0;
  for (const s of bruts) {
    const b = borner(s, W, H, mt);
    if (b) traits.push(b);
    else perdus++;
  }
  return { traits, perdus };
}

/** Lignes de pli d'une face (pointillés aux deux bouts de la feuille, hors des poses). */
export function lignesFace(face: Face, feuille: { largeur: number; hauteur: number }, mt: number, genre: Ligne['genre'] = 'pli'): Ligne[] {
  const lignes: Ligne[] = [];
  const W = feuille.largeur;
  const H = feuille.hauteur;
  const long = 7.5;
  for (const x of face.plis) {
    const bas = { de: mt, a: Math.min(H - mt, long) };
    const haut = { de: Math.max(mt, H - long), a: H - mt };
    if (bas.a - bas.de >= 1) lignes.push({ axe: 'x', pos: arr(x), de: arr(bas.de), a: arr(bas.a), genre });
    if (haut.a - haut.de >= 1) lignes.push({ axe: 'x', pos: arr(x), de: arr(haut.de), a: arr(haut.a), genre });
  }
  for (const y of face.plis_h ?? []) {
    const gauche = { de: mt, a: Math.min(W - mt, long) };
    const droite = { de: Math.max(mt, W - long), a: W - mt };
    if (gauche.a - gauche.de >= 1) lignes.push({ axe: 'y', pos: arr(y), de: arr(gauche.de), a: arr(gauche.a), genre });
    if (droite.a - droite.de >= 1) lignes.push({ axe: 'y', pos: arr(y), de: arr(droite.de), a: arr(droite.a), genre });
  }
  return lignes;
}

/** Remplit traits, lignes et cotes de chaque face du plan ; signale les repères perdus. */
export function decorerPlan(plan: Plan, p: ParamsImposition, margeTechnique: number): void {
  const style: StyleTraits = p.traits_de_coupe === false ? 'aucun' : (p.traits_style ?? 'auto');
  const gouttiere = plan.operation === 'livret' ? 0 : Math.min(Math.max(0, p.gouttiere_mm), Math.max(0, p.gouttiere_y_mm ?? p.gouttiere_mm));
  const fp = plan.operation === 'assembler' ? 0 : plan.fonds_perdus_mm;
  let perdus = 0;
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const f of plan.feuilles) {
    for (const face of [f.recto, f.verso]) {
      if (!face) continue;
      if (plan.operation === 'assembler') {
        face.traits = [];
        face.lignes = [];
        continue;
      }
      const r = traitsFace(face, plan.feuille, fp, gouttiere, style, margeTechnique);
      face.traits = r.traits;
      perdus += r.perdus;
      face.lignes = style === 'aucun' && plan.livret?.rognage !== 'aucun' ? [] : [...lignesFace(face, plan.feuille, margeTechnique), ...(face.lignes ?? []).filter((l) => l.genre !== 'pli')];
      if (face.cote === 'recto') {
        for (const q of face.poses) {
          if (q.page === null && face.poses.length > 1) continue;
          const b = boite(q);
          xs.add(arr(b.x)); xs.add(arr(b.x + b.w)); ys.add(arr(b.y)); ys.add(arr(b.y + b.h));
        }
      }
    }
  }
  plan.cotes = { x: [...xs].sort((a, b) => a - b), y: [...ys].sort((a, b) => a - b) };
  if (perdus > 0 && style !== 'aucun') {
    plan.avertissements.push(`${perdus} repère${perdus > 1 ? 's' : ''} de coupe omis : il${perdus > 1 ? 's' : ''} tomb${perdus > 1 ? 'ent' : 'e'} dans le bord non imprimable de ${margeTechnique} mm. Augmentez la marge de feuille ou réduisez les fonds perdus pour les retrouver ; les cotes de coupe restent dans le rapport.`);
  }
}
