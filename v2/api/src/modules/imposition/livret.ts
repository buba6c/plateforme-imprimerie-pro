// Plans « livret » : piqûre à cheval, dos carré collé en cahiers, dos carré sur feuilles volantes.
//  - piqûre : un seul cahier, feuille s : recto [N−2s | 2s+1], verso [2s+2 | N−2s−1] ;
//  - dos carré collé : cahiers de N feuilles empilés, chacun imposé comme un petit livret, repères de dos
//    décalés pour vérifier l'ordre des cahiers ;
//  - feuilles volantes : chaque feuillet (recto/verso) est une pose ; coupe & empile des feuillets, le
//    bloc est fraisé puis collé ;
//  - couverture séparée : pages 1, 2, avant-dernière et dernière sur une feuille à part (papier plus épais),
//    avec un dos (largeur calculée d'après l'épaisseur des feuilles) pour le dos carré ;
//  - 2 ou 4 planches par feuille : la même planche répétée (k livrets par jeu) ou les planches empilées
//    (après la coupe, une pile par position : empiler les piles donne un livret complet) ;
//  - relié en haut (pli horizontal) : calendriers, blocs ; le verso est le miroir haut-bas ;
//  - lecture de droite à gauche : pages miroir sur chaque face (livres en arabe) ;
//  - folios, pages de garde, chasse calculée d'après l'épaisseur des feuilles, rognage choisi quand le
//    livret est sans fonds perdus (plié seulement, face, trois côtés).
// Pages blanches ajoutées pour atteindre un multiple de 4.

import type { Dimension } from './formats';
import { arrondiMm as arr, dimensionFeuille, type Face, type FeuillePlan, type InfoLivret, type ModeBlanches, type ParamsImposition, type PlanBrut, type Pose, type Rotation } from './plan';
import type { Ligne, Texte } from './reperes';

/**
 * Complète une suite de pages avec `n` blanches selon le mode. `couvertures` : la première et la
 * dernière page de la suite sont les couvertures (on ne les déplace pas à l'intérieur).
 */
export function completerBlanches(pages: (number | null)[], n: number, mode: ModeBlanches, couvertures: boolean): (number | null)[] {
  if (n <= 0) return pages;
  const b = (k: number) => Array<null>(k).fill(null);
  const debut = (k: number) => (couvertures && pages.length >= 1 ? [pages[0]!, ...b(k), ...pages.slice(1)] : [...b(k), ...pages]);
  const avantFin = (liste: (number | null)[], k: number) => (couvertures && liste.length >= 2 ? [...liste.slice(0, -1), ...b(k), liste[liste.length - 1]!] : [...liste, ...b(k)]);
  switch (mode) {
    case 'fin':
      return [...pages, ...b(n)];
    case 'apres_couverture':
      return debut(n);
    case 'reparties':
      return avantFin(debut(1), n - 1);
    case 'avant_derniere':
    case 'positions':
    default:
      return avantFin(pages, n);
  }
}

/** Épaisseur d'une feuille (mm) ; 0,10 mm = papier 80 à 115 g. */
const EPAISSEUR_DEFAUT = 0.1;

interface Planche {
  /** Pages de la face extérieure (recto) : première et seconde moitié dans l'ordre de lecture gauche → droite (ou haut → bas). */
  recto: [number | null, number | null];
  verso: [number | null, number | null];
  /** Décalage de chasse (mm). */
  dec: number;
  marques?: Face['marques'];
  libelle: string;
}

interface Placement {
  feuille: Dimension;
  paysage: boolean;
  /** Origine (bas-gauche, fini) de chaque planche posée, dans l'ordre de lecture. */
  positions: { x: number; y: number }[];
  colonnes: number;
  rangs: number;
}

/** Place `k` planches de `pw × ph` (+ fonds perdus) sur la feuille ; null si elles ne tiennent pas. */
function placerPlanches(p: ParamsImposition, pw: number, ph: number, fp: number, k: number, orientationForcee?: 'portrait' | 'paysage'): Placement | null {
  const base = dimensionFeuille(p);
  const g = Math.max(0, p.gouttiere_mm);
  const m = Math.max(0, p.marge_mm);
  const essai = (feuille: Dimension, paysage: boolean): Placement | null => {
    const pasX = pw + 2 * fp + g;
    const pasY = ph + 2 * fp + g;
    const cols = Math.floor((feuille.largeur - 2 * m + g + 1e-6) / pasX);
    const rows = Math.floor((feuille.hauteur - 2 * m + g + 1e-6) / pasY);
    if (cols * rows < k || cols < 1 || rows < 1) return null;
    // Répartition : empilées de préférence (une colonne), sinon côte à côte, sinon en grille.
    let cu = 1;
    let ru = k;
    if (ru > rows) {
      cu = Math.min(cols, Math.ceil(k / rows));
      ru = Math.ceil(k / cu);
    }
    if (k === 4 && cols >= 2 && rows >= 2) [cu, ru] = [2, 2];
    const blocW = cu * pasX - g;
    const blocH = ru * pasY - g;
    const x0 = (feuille.largeur - blocW) / 2 + fp;
    const y0 = (feuille.hauteur - blocH) / 2 + fp;
    const positions: { x: number; y: number }[] = [];
    for (let r = 0; r < ru && positions.length < k; r++) for (let c = 0; c < cu && positions.length < k; c++) positions.push({ x: arr(x0 + c * pasX), y: arr(y0 + (ru - 1 - r) * pasY) });
    return { feuille, paysage, positions, colonnes: cu, rangs: ru };
  };
  const portrait = essai(base, false);
  const paysage = essai({ largeur: base.hauteur, hauteur: base.largeur }, true);
  const o = orientationForcee ?? p.orientation;
  if (o === 'portrait') return portrait;
  if (o === 'paysage') return paysage;
  // Auto : la planche en paysage sur une feuille paysage (A4 → A3) est le cas courant ; sinon ce qui tient.
  if (k === 1) return paysage ?? portrait;
  return portrait ?? paysage;
}

/** Folio d'une page du livret, d'après l'ordre de lecture. */
function foliosDe(p: ParamsImposition, ordre: (number | null)[]): Map<number, number> {
  const f = p.folios;
  const m = new Map<number, number>();
  if (!f?.actif) return m;
  const debut = f.debut ?? 1;
  // Couverture exclue : la première et la dernière page (1re et 4e de couverture) n'ont pas de folio.
  const exclure = f.exclure_couverture !== false;
  const N = ordre.length;
  ordre.forEach((page, i) => {
    if (page === null) return;
    if (exclure && (i === 0 || i === N - 1)) return;
    m.set(page, debut + i - (exclure ? 1 : 0));
  });
  return m;
}

function texteFolio(p: ParamsImposition, q: Pose, folio: number): Texte {
  const position = p.folios?.position ?? 'bas_exterieur';
  const taille = p.folios?.taille_pt ?? 9;
  const tailleMm = (taille * 25.4) / 72;
  const marge = 7;
  const haut = position === 'haut_exterieur';
  const y = haut ? q.y + q.hauteur - marge - tailleMm : q.y + marge;
  if (position === 'bas_centre' || q.pli === 'haut' || q.pli === 'bas') return { x: arr(q.x + q.largeur / 2), y: arr(y), texte: String(folio), taille_pt: taille, rotation: 0, ancre: 'centre' };
  // Extérieur = côté opposé au pli.
  if (q.pli === 'droite') return { x: arr(q.x + marge), y: arr(y), texte: String(folio), taille_pt: taille, rotation: 0, ancre: 'gauche' };
  return { x: arr(q.x + q.largeur - marge), y: arr(y), texte: String(folio), taille_pt: taille, rotation: 0, ancre: 'droite' };
}

/**
 * Plan « livret ». `sansFonds` : la coupe retenue est sans fonds perdus (le rognage s'applique).
 */
export function planLivret(p: ParamsImposition, nbPagesTotal: number, sansFonds = false): PlanBrut {
  const avertissements: string[] = [];
  const consignes: string[] = [];
  // Avec des pièces recto/verso appariées, le livret suit l'ordre recto1, verso1, recto2, verso2…
  const ordrePages = p.paires && p.paires.length ? p.paires.flatMap((x) => (x.verso !== null ? [x.recto, x.verso] : [x.recto])) : null;
  const nbPages = ordrePages ? ordrePages.length : nbPagesTotal;
  const fini = p.fini;
  const w = fini.largeur;
  const h = fini.hauteur;
  const bordHaut = p.reliure_bord === 'haut';
  const reliure: 'piqure' | 'dos_carre' | 'feuilles_volantes' = p.reliure === 'dos_carre' ? 'dos_carre' : p.reliure === 'feuilles_volantes' ? 'feuilles_volantes' : 'piqure';
  const t = p.epaisseur_feuille_mm ?? EPAISSEUR_DEFAUT;

  // 1. Pages, blanches placées à la main, couverture, complément à un multiple de 4.
  let pages: (number | null)[] = ordrePages ? [...ordrePages] : Array.from({ length: nbPages }, (_, i) => i + 1);
  let placees = 0;
  if (p.blanches === 'positions' && p.blanches_apres?.length) {
    const apres = p.blanches_apres.filter((k) => Number.isInteger(k) && k >= 0 && k <= pages.length).sort((a, b) => b - a).slice(0, 64);
    for (const k of apres) pages = [...pages.slice(0, k), -1, ...pages.slice(k)];
    placees = apres.length;
  }
  if (reliure === 'feuilles_volantes') return planFeuillesVolantes(p, pages, placees, avertissements, sansFonds);

  const couvSeparee = !!p.couverture_separee && pages.length >= 4;
  let couverture: (number | null)[] | null = null;
  let interieur = pages;
  if (couvSeparee) {
    couverture = [pages[0]!, pages[1]!, pages[pages.length - 2]!, pages[pages.length - 1]!];
    interieur = pages.slice(2, pages.length - 2);
  }
  const reste = interieur.length % 4;
  const completees = reste === 0 ? 0 : 4 - reste;
  if (completees) interieur = completerBlanches(interieur, completees, p.blanches, !couvSeparee);
  const blanches = placees + completees;
  if (completees) {
    const total = interieur.length + (couverture ? 4 : 0);
    const ou = { fin: 'à la fin', avant_derniere: couvSeparee ? 'à la fin de l’intérieur' : 'avant la 4e de couverture', apres_couverture: couvSeparee ? 'au début de l’intérieur' : 'après la 1re de couverture', reparties: couvSeparee ? 'au début et à la fin de l’intérieur' : 'en 2e et 3e de couverture', positions: couvSeparee ? 'à la fin de l’intérieur' : 'avant la 4e de couverture' }[p.blanches];
    const impair = nbPages % 2 === 1 ? `Le document a un nombre impair de pages (${nbPages}). ` : '';
    avertissements.push(`${impair}${completees} page${completees > 1 ? 's' : ''} blanche${completees > 1 ? 's' : ''} ajoutée${completees > 1 ? 's' : ''} ${ou} pour obtenir un multiple de 4 (${total} pages).${placees ? ` ${placees} autre${placees > 1 ? 's' : ''} placée${placees > 1 ? 's' : ''} à la main.` : ''}`);
  } else if (placees) {
    avertissements.push(`${placees} page${placees > 1 ? 's' : ''} blanche${placees > 1 ? 's' : ''} placée${placees > 1 ? 's' : ''} à la main.`);
  }
  const ordreBrut: (number | null)[] = couverture ? [couverture[0]!, couverture[1]!, ...interieur, couverture[2]!, couverture[3]!] : [...interieur];
  const blanchesManuelles = ordreBrut.flatMap((v, i) => (v === -1 ? [i] : []));
  const sansMarque = (l: (number | null)[]) => l.map((v) => (v === -1 ? null : v));
  const ordre = sansMarque(ordreBrut);
  interieur = sansMarque(interieur);
  if (couverture) couverture = sansMarque(couverture);

  // 2. Cahiers.
  const feuillesParCahier = reliure === 'dos_carre' ? Math.min(16, Math.max(1, Math.round(p.cahier_feuilles ?? 4))) : Infinity;
  const cahiers: (number | null)[][] = [];
  const pagesParCahier = Number.isFinite(feuillesParCahier) ? feuillesParCahier * 4 : Math.max(4, interieur.length);
  for (let i = 0; i < interieur.length; i += pagesParCahier) cahiers.push(interieur.slice(i, i + pagesParCahier));
  const nbFeuillesInterieur = cahiers.reduce((tt, c) => tt + c.length / 4, 0);

  // 3. Chasse : saisie, ou calculée d'après l'épaisseur des feuilles (piqûre, livret rogné).
  let chasseTotale = Math.max(0, p.chasse_mm ?? 0);
  if (chasseTotale === 0 && p.chasse_auto !== false && reliure === 'piqure' && nbFeuillesInterieur > 1) chasseTotale = arr(t * (nbFeuillesInterieur - 1));

  // 4. Planches logiques, dans l'ordre d'impression.
  const droiteGauche = p.lecture === 'droite_gauche' && !bordHaut;
  const ordonner = (a: number | null, b: number | null): [number | null, number | null] => (droiteGauche ? [b, a] : [a, b]);
  const planches: Planche[] = [];
  if (couverture) planches.push({ recto: ordonner(couverture[3]!, couverture[0]!), verso: ordonner(couverture[1]!, couverture[2]!), dec: 0, libelle: 'Couverture' });
  cahiers.forEach((c, ci) => {
    const n = c.length;
    const nbF = n / 4;
    for (let s2 = 0; s2 < nbF; s2++) {
      const dec = nbF > 1 ? arr((chasseTotale * s2) / (nbF - 1)) : 0;
      planches.push({
        recto: ordonner(c[n - 1 - 2 * s2] ?? null, c[2 * s2] ?? null),
        verso: ordonner(c[2 * s2 + 1] ?? null, c[n - 2 - 2 * s2] ?? null),
        dec,
        marques: reliure === 'dos_carre' && s2 === 0 ? [{ cahier: ci }] as unknown as Face['marques'] : undefined,
        libelle: cahiers.length > 1 || couverture ? `Cahier ${ci + 1} · feuille ${s2 + 1}/${nbF}` : `Feuille ${s2 + 1}/${nbF}`,
      });
    }
  });

  // 5. Placement des planches (k par feuille) et fonds perdus réellement possibles.
  const pw = bordHaut ? w : 2 * w;
  const ph = bordHaut ? 2 * h : h;
  let k: 1 | 2 | 4 = p.poses_livret ?? 1;
  const fpVoulu = Math.max(0, p.fonds_perdus_mm);
  let fp = fpVoulu;
  let placement = placerPlanches(p, pw, ph, fp, k);
  if (!placement && k > 1) {
    avertissements.push(`${k} planches ne tiennent pas sur cette feuille : une planche par feuille.`);
    k = 1;
    placement = placerPlanches(p, pw, ph, fp, 1);
  }
  if (!placement) {
    // Une planche sans fonds perdus, ou réduits, sur une feuille juste (A5 sur A4, A4 sur A3).
    const base = dimensionFeuille(p);
    const tient = (f: Dimension) => f.largeur + 0.5 >= pw && f.hauteur + 0.5 >= ph;
    const paysage = { largeur: base.hauteur, hauteur: base.largeur };
    const feuille = p.orientation === 'portrait' ? base : p.orientation === 'paysage' ? paysage : tient(paysage) ? paysage : base;
    if (!tient(feuille)) throw new Error(`Deux pages ${w} × ${h} mm côte à côte ne tiennent pas sur cette feuille : choisissez une feuille plus grande ou un format fini plus petit.`);
    const fpMax = Math.max(0, Math.min((feuille.largeur - pw) / 2, (feuille.hauteur - ph) / 2));
    fp = arr(Math.min(fpVoulu, fpMax));
    placement = { feuille, paysage: feuille === paysage, positions: [{ x: arr((feuille.largeur - pw) / 2), y: arr((feuille.hauteur - ph) / 2) }], colonnes: 1, rangs: 1 };
    if (fp < fpVoulu) {
      avertissements.push(fp > 0
        ? `La feuille est juste : les fonds perdus sont réduits à ${fp} mm (${fpVoulu} mm demandés). Pour garder ${fpVoulu} mm, prenez une feuille plus grande (SRA4 pour un A5, SRA3 pour un A4).`
        : `La feuille a exactement la taille de deux pages : aucun fond perdu ni trait de coupe possible. Pour en avoir, prenez une feuille plus grande (SRA4 pour un A5, SRA3 pour un A4).`);
    }
  }
  const { feuille, paysage } = placement;
  const W = feuille.largeur;
  const H = feuille.hauteur;
  // Feuille « exacte » : moins de 5 mm de reste en largeur et en hauteur, aucun repère de coupe possible.
  const feuilleExacte = W - pw < 5 && H - ph < 5;

  // 6. Dos de la couverture (dos carré avec couverture séparée).
  let dosMm: number | null = null;
  if (couverture && reliure === 'dos_carre') {
    dosMm = p.dos_mm != null && p.dos_mm >= 0 ? arr(p.dos_mm) : Math.round(((interieur.length / 2) * t + 1) * 2) / 2;
    if (dosMm < 3) avertissements.push(`Dos de ${dosMm} mm : trop fin pour un titre au dos.`);
    if (pw + dosMm + 2 * fp > W - 2 * Math.max(0, p.marge_mm) + 0.01) avertissements.push(`La couverture avec son dos (${arr(pw + dosMm)} mm) dépasse la zone utile de la feuille : prenez une feuille plus grande ou réduisez la marge.`);
  }

  // 7. Rognage retenu quand le livret est sans fonds perdus.
  let rognage: InfoLivret['rognage'] = null;
  if (sansFonds) {
    const demande = p.rognage ?? 'auto';
    rognage = demande === 'auto' ? (feuilleExacte ? 'aucun' : 'trois_cotes') : demande;
    if (rognage === 'aucun') {
      if (chasseTotale > 0) avertissements.push(`Plié, non rogné : la chasse n’est pas appliquée (la tranche montre l’escalier des feuilles intérieures, environ ${arr(t * Math.max(0, nbFeuillesInterieur - 1))} mm).`);
      chasseTotale = 0;
      for (const pl of planches) pl.dec = 0;
    }
  }

  // 8. Feuilles.
  const F = planches.length;
  const mode: 'repetition' | 'empile' = k > 1 ? (p.mode_planches ?? 'empile') : 'repetition';
  const nbFeuilles = k > 1 && mode === 'empile' ? Math.ceil(F / k) : F;
  const plancheDe = (s: number, j: number): Planche | null => (k > 1 && mode === 'empile' ? (planches[s + j * nbFeuilles] ?? null) : planches[s]!);
  const folios = foliosDe(p, ordre);
  const crans = Math.max(1, Math.floor((h - 16) / 5));
  const feuilles: FeuillePlan[] = [];
  const rotationVerso: Rotation = bordHaut && p.rotation_verso === '180' ? 180 : 0;

  const faceDe = (cote: 'recto' | 'verso', s: number): Face => {
    const poses: Pose[] = [];
    const plis: number[] = [];
    const plisH: number[] = [];
    const marques: NonNullable<Face['marques']> = [];
    const lignes: Ligne[] = [];
    const textes: Texte[] = [];
    placement!.positions.forEach((pos, j) => {
      const pl = plancheDe(s, j);
      // Verso : la planche tombe à la position miroir (gauche ↔ droite pour un pli vertical, haut ↔ bas pour un pli horizontal).
      const X = cote === 'recto' || bordHaut ? pos.x : arr(W - pos.x - pw);
      const Y = cote === 'recto' || !bordHaut ? pos.y : arr(H - pos.y - ph);
      const [a, b] = pl ? (cote === 'recto' ? pl.recto : pl.verso) : [null, null];
      const dec = pl?.dec ?? 0;
      const estCouvDos = pl?.libelle === 'Couverture' && dosMm !== null;
      const e = estCouvDos ? dosMm! : 0;
      const xDepart = estCouvDos ? arr(X - e / 2) : X;
      if (!bordHaut) {
        // Chasse : les pages des feuilles intérieures dépassent à la coupe une fois pliées ; leur visuel est
        // rapproché du pli d'autant, pour garder les mêmes marges extérieures d'une page à l'autre.
        const gauche: Pose = { page: a, numero: null, x: arr(xDepart + dec), y: Y, largeur: w, hauteur: h, decalage_x: dec, pli: 'droite', joints: ['droite'], rang: j, colonne: 0 };
        const droite: Pose = { page: b, numero: null, x: arr(xDepart + w + e - dec), y: Y, largeur: w, hauteur: h, decalage_x: -dec, pli: 'gauche', joints: ['gauche'], rang: j, colonne: 1 };
        if (estCouvDos) {
          poses.push(gauche, { page: null, numero: null, x: arr(xDepart + w), y: Y, largeur: e, hauteur: h, joints: ['gauche', 'droite'], rang: j, colonne: 2 }, droite);
          for (const xr of [xDepart + w, xDepart + w + e]) for (const [de, aa] of [[5, 12.5], [H - 12.5, H - 5]] as const) lignes.push({ axe: 'x', pos: arr(xr), de: arr(de), a: arr(aa), genre: 'rainage' });
          if (p.mors) for (const xr of [xDepart + w - 7, xDepart + w + e + 7]) for (const [de, aa] of [[5, 12.5], [H - 12.5, H - 5]] as const) lignes.push({ axe: 'x', pos: arr(xr), de: arr(de), a: arr(aa), genre: 'rainage' });
        } else {
          poses.push(gauche, droite);
          plis.push(arr(X + w));
        }
        if (rotationVerso) for (const q of poses) q.rotation = rotationVerso;
        if (pl?.marques && reliure === 'dos_carre') {
          const ci = (pl.marques as unknown as { cahier: number }[])[0]!.cahier;
          marques.push({ x: arr(X + w - 1.5), y: arr(Y + h - 8 - (ci % crans) * 5 - 5), largeur: 3, hauteur: 5 });
        }
      } else {
        // Relié en haut : première moitié en haut, seconde en bas ; chasse verticale vers le pli.
        const hautPose: Pose = { page: a, numero: null, x: X, y: arr(Y + h - dec), largeur: w, hauteur: h, decalage_y: -dec, pli: 'bas', joints: ['bas'], rang: 0, colonne: j };
        const basPose: Pose = { page: b, numero: null, x: X, y: arr(Y + dec), largeur: w, hauteur: h, decalage_y: dec, pli: 'haut', joints: ['haut'], rang: 1, colonne: j };
        if (rotationVerso && cote === 'verso') {
          hautPose.rotation = rotationVerso;
          basPose.rotation = rotationVerso;
        }
        poses.push(hautPose, basPose);
        plisH.push(arr(Y + h));
        if (pl?.marques && reliure === 'dos_carre') {
          const ci = (pl.marques as unknown as { cahier: number }[])[0]!.cahier;
          marques.push({ x: arr(X + 8 + (ci % crans) * 5), y: arr(Y + h - 1.5), largeur: 5, hauteur: 3 });
        }
      }
    });
    for (const q of poses) {
      const f = q.page !== null ? folios.get(q.page) : undefined;
      if (f !== undefined) textes.push(texteFolio(p, q, f));
    }
    const face: Face = { cote, poses, plis };
    if (plisH.length) face.plis_h = plisH;
    if (marques.length) face.marques = marques;
    if (lignes.length) face.lignes = lignes;
    if (textes.length) face.textes = textes;
    return face;
  };

  if (p.gardes === 4) {
    const vide = (cote: 'recto' | 'verso'): Face => {
      const poses: Pose[] = [];
      placement!.positions.forEach((pos, j) => {
        if (bordHaut) poses.push({ page: null, numero: null, x: pos.x, y: arr(pos.y + h), largeur: w, hauteur: h, pli: 'bas', rang: 0, colonne: j }, { page: null, numero: null, x: pos.x, y: pos.y, largeur: w, hauteur: h, pli: 'haut', rang: 1, colonne: j });
        else poses.push({ page: null, numero: null, x: pos.x, y: pos.y, largeur: w, hauteur: h, pli: 'droite', rang: j, colonne: 0 }, { page: null, numero: null, x: arr(pos.x + w), y: pos.y, largeur: w, hauteur: h, pli: 'gauche', rang: j, colonne: 1 });
      });
      const face: Face = { cote, poses, plis: bordHaut ? [] : placement!.positions.map((pos) => arr(pos.x + w)) };
      if (bordHaut) face.plis_h = placement!.positions.map((pos) => arr(pos.y + h));
      return face;
    };
    feuilles.push({ numero: 1, libelle: 'Gardes', recto: vide('recto'), verso: vide('verso') });
    avertissements.push('Pages de garde : une feuille blanche pliée en plus, à imprimer (ou à insérer) sur le papier de garde.');
  }
  for (let s = 0; s < nbFeuilles; s++) {
    const premiere = plancheDe(s, 0);
    const libelle = k > 1
      ? mode === 'empile'
        ? `Feuille ${s + 1}/${nbFeuilles} · planches ${placement.positions.map((_, j) => plancheDe(s, j) ? s + j * nbFeuilles + 1 : '—').join(', ')}`
        : `${premiere?.libelle ?? `Feuille ${s + 1}`} · ${k} planches`
      : premiere?.libelle;
    feuilles.push({ numero: feuilles.length + 1, libelle, recto: faceDe('recto', s), verso: faceDe('verso', s) });
  }

  // 9. Avertissements, consignes et informations.
  if (reliure === 'dos_carre' && cahiers.length > 1) avertissements.push(`Dos carré collé : ${cahiers.length} cahiers de ${feuillesParCahier} feuille${feuillesParCahier > 1 ? 's' : ''} (le dernier peut être plus court). Les repères noirs sur le dos doivent former un escalier une fois les cahiers empilés.`);
  if (k > 1 && mode === 'empile') avertissements.push(`${k} planches par feuille, empilées : après la coupe, ${k} piles ; empiler la pile de la première position sur la suivante donne un livret complet.`);
  if (k > 1 && mode === 'repetition') avertissements.push(`${k} planches identiques par feuille : chaque jeu de ${F} feuilles donne ${k} livrets après la coupe.`);
  if (p.recto_verso === false) avertissements.push('Un livret est toujours recto-verso : les deux faces de chaque feuille sont générées.');
  // Pli vertical : axe de retournement vertical (bord long en portrait, bord court en paysage) ; pli horizontal : l'inverse.
  const retournement: 'bord_long' | 'bord_court' = bordHaut ? (paysage ? 'bord_long' : 'bord_court') : paysage ? 'bord_court' : 'bord_long';
  consignes.push(`Pilote Xerox : recto-verso, retourner sur le ${retournement === 'bord_long' ? 'bord long' : 'bord court'} (feuille ${paysage ? 'paysage' : 'portrait'}).`);
  if (rognage === 'aucun') consignes.push('Plié, non rogné : agrafer puis plier, sans passage au massicot.');
  if (rognage === 'face') consignes.push('Rognage de face : une seule coupe sur la tranche opposée au pli, tête et pied non coupés.');
  const bordsFace: InfoLivret['bords_face'] = rognage === 'face'
    ? (bordHaut ? { axe: 'y', positions: placement.positions.map((pos) => pos.y) } : { axe: 'x', positions: placement.positions.flatMap((pos) => [pos.x, arr(pos.x + pw)]) })
    : undefined;
  const quantite = p.quantite && p.quantite > 0 ? p.quantite : null;
  return {
    operation: 'livret',
    feuille,
    paysage,
    fini,
    fonds_perdus_mm: fp,
    colonnes: bordHaut ? placement.colonnes : 2 * placement.colonnes,
    rangs: bordHaut ? 2 * placement.rangs : placement.rangs,
    poses_par_face: 2 * k,
    nb_feuilles: feuilles.length,
    nb_pages_sortie: feuilles.length * 2,
    feuilles_a_imprimer: quantite ? (k > 1 && mode === 'repetition' ? Math.ceil(quantite / k) * nbFeuilles : nbFeuilles * quantite) : feuilles.length,
    pages_blanches: blanches,
    ordre,
    blanches_manuelles: blanchesManuelles,
    feuilles,
    avertissements,
    retournement_effectif: retournement,
    axe_verso: bordHaut ? 'horizontal' : 'vertical',
    consignes,
    livret: { planches: k, mode, reliure, bord: bordHaut ? 'haut' : 'gauche', dos_mm: dosMm, rognage, chasse_mm: chasseTotale, ...(bordsFace ? { bords_face: bordsFace } : {}) },
  };
}

/**
 * Dos carré sur feuilles volantes : chaque feuillet (recto, verso) est une pose ; coupe & empile des
 * feuillets (pose k, feuille s → feuillet k·F + s), les piles empilées dans l'ordre forment le bloc.
 */
function planFeuillesVolantes(p: ParamsImposition, pagesBrutes: (number | null)[], placees: number, avertissements: string[], sansFonds: boolean): PlanBrut {
  const w = p.fini.largeur;
  const h = p.fini.hauteur;
  let pages = pagesBrutes;
  const impair = pages.length % 2 === 1;
  if (impair) pages = completerBlanches(pages, 1, p.blanches === 'positions' ? 'avant_derniere' : p.blanches, true);
  const ordreBrut = pages;
  const blanchesManuelles = ordreBrut.flatMap((v, i) => (v === -1 ? [i] : []));
  const ordre = ordreBrut.map((v) => (v === -1 ? null : v));
  if (impair) avertissements.push(`Nombre impair de pages : une page blanche ajoutée ${p.blanches === 'fin' ? 'à la fin' : 'avant la dernière page'} (${ordre.length} pages).`);
  const fp = sansFonds ? 0 : Math.max(0, p.fonds_perdus_mm);
  const g = Math.max(0, p.gouttiere_mm);
  const m = Math.max(0, p.marge_mm);
  const base = dimensionFeuille(p);
  const essai = (feuille: Dimension, paysage: boolean) => {
    const pasX = w + 2 * fp + g;
    const pasY = h + 2 * fp + g;
    const cols = Math.floor((feuille.largeur - 2 * m + g + 1e-6) / pasX);
    const rows = Math.floor((feuille.hauteur - 2 * m + g + 1e-6) / pasY);
    return { feuille, paysage, cols, rows, pasX, pasY, n: cols * rows };
  };
  const portrait = essai(base, false);
  const paysage = essai({ largeur: base.hauteur, hauteur: base.largeur }, true);
  const gr = p.orientation === 'portrait' ? portrait : p.orientation === 'paysage' ? paysage : paysage.n > portrait.n ? paysage : portrait;
  if (gr.n < 1) throw new Error('Aucun feuillet ne tient sur la feuille : réduisez les marges ou choisissez une feuille plus grande.');
  const n = gr.n;
  const feuillets = ordre.length / 2;
  const F = Math.ceil(feuillets / n);
  const blocW = gr.cols * gr.pasX - g;
  const blocH = gr.rows * gr.pasY - g;
  const x0 = (gr.feuille.largeur - blocW) / 2 + fp;
  const y0 = (gr.feuille.hauteur - blocH) / 2 + fp;
  const positions: { x: number; y: number; rang: number; colonne: number }[] = [];
  for (let r = 0; r < gr.rows; r++) for (let c = 0; c < gr.cols; c++) positions.push({ x: arr(x0 + c * gr.pasX), y: arr(y0 + (gr.rows - 1 - r) * gr.pasY), rang: r, colonne: c });
  const folios = foliosDe(p, ordre);
  const feuilles: FeuillePlan[] = [];
  for (let s = 0; s < F; s++) {
    const recto: Pose[] = [];
    const verso: Pose[] = [];
    positions.forEach((pos, k) => {
      const idx = k * F + s;
      const feuillet = idx < feuillets ? idx : null;
      const pr = feuillet === null ? null : ordre[2 * feuillet]!;
      const pv = feuillet === null ? null : ordre[2 * feuillet + 1]!;
      recto.push({ page: pr, numero: null, x: pos.x, y: pos.y, largeur: w, hauteur: h, rang: pos.rang, colonne: pos.colonne });
      verso.push({ page: pv, numero: null, x: arr(gr.feuille.largeur - pos.x - w), y: pos.y, largeur: w, hauteur: h, rang: pos.rang, colonne: pos.colonne });
    });
    const textesDe = (poses: Pose[]) => poses.flatMap((q) => { const f = q.page !== null ? folios.get(q.page) : undefined; return f === undefined ? [] : [texteFolio(p, { ...q, pli: q.page !== null && ordre.indexOf(q.page) % 2 === 0 ? 'gauche' : 'droite' }, f)]; });
    const fr: Face = { cote: 'recto', poses: recto, plis: [] };
    const fv: Face = { cote: 'verso', poses: verso, plis: [] };
    const tr = textesDe(recto);
    const tv = textesDe(verso);
    if (tr.length) fr.textes = tr;
    if (tv.length) fv.textes = tv;
    feuilles.push({ numero: s + 1, libelle: `Feuille ${s + 1}/${F} · ${n} feuillet${n > 1 ? 's' : ''}`, recto: fr, verso: fv });
  }
  avertissements.push(`Feuilles volantes : ${feuillets} feuillet${feuillets > 1 ? 's' : ''} sur ${F} feuille${F > 1 ? 's' : ''} ; après la coupe, ${n} pile${n > 1 ? 's' : ''} à empiler dans l’ordre de lecture (gauche → droite, haut → bas), puis fraisage et collage du dos.`);
  const retournement: 'bord_long' | 'bord_court' = gr.paysage ? 'bord_court' : 'bord_long';
  const quantite = p.quantite && p.quantite > 0 ? p.quantite : null;
  return {
    operation: 'livret',
    feuille: gr.feuille,
    paysage: gr.paysage,
    fini: p.fini,
    fonds_perdus_mm: fp,
    colonnes: gr.cols,
    rangs: gr.rows,
    poses_par_face: n,
    nb_feuilles: F,
    nb_pages_sortie: F * 2,
    feuilles_a_imprimer: quantite ? F * quantite : F,
    pages_blanches: placees + (impair ? 1 : 0),
    ordre,
    blanches_manuelles: blanchesManuelles,
    feuilles,
    avertissements,
    retournement_effectif: retournement,
    axe_verso: 'vertical',
    consignes: [`Pilote Xerox : recto-verso, retourner sur le ${retournement === 'bord_long' ? 'bord long' : 'bord court'} (feuille ${gr.paysage ? 'paysage' : 'portrait'}).`],
    livret: { planches: 1, mode: 'repetition', reliure: 'feuilles_volantes', bord: 'gauche', dos_mm: null, rognage: sansFonds ? 'trois_cotes' : null, chasse_mm: 0 },
  };
}
