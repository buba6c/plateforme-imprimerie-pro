// Génération du PDF imposé avec pdf-lib : chaque page source est intégrée une fois (XObject) puis dessinée
// à chaque pose. Fonds perdus : ceux du fichier (zone au-delà du TrimBox), ou fabriqués en miroir
// (les bandes de bord sont redessinées retournées, en vecteur, comme le font les outils de prépresse),
// par étirement (le visuel est agrandi de la valeur des fonds perdus) ou laissés blancs. Traits de coupe
// en bordure de feuille et aux angles, traits de pli pour le livret, numérotation des tickets.
// Les boîtes PDF (TrimBox, BleedBox) sont posées sur chaque feuille.

import { clip, clipEvenOdd, concatTransformationMatrix, degrees, endPath, grayscale, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts, type PDFEmbeddedPage, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { chargerPdf } from './analyse';
import { bordure, bordureDisponible, type ModesBords } from './bordure';
import { pt, mm as enMm, type Dimension } from './formats';
import type { Adaptation } from './ajuster';
import { emprise, type Face, type ParamsImposition, type Plan, type Pose } from './plan';

const TRAIT = 0.25; // pt
/** Chevauchement des zones découpées (pt) : supprime les filets blancs d'anticrénelage aux raccords. */
const RECOUVREMENT = 0.6;
/** Bande du bord prolongée dans les fonds perdus (mm). */
const BANDE_PROLONGEE = 0.5;

export type MethodeBord = 'prolonger' | 'miroir';
export interface BordsUnis {
  haut: boolean;
  bas: boolean;
  gauche: boolean;
  droite: boolean;
}

interface SourcePage {
  emb: PDFEmbeddedPage;
  /** Fonds perdus raster (anneau autour du visuel), préparés à la demande par méthode de bords. */
  bordures?: Map<string, { bandes: { image: PDFImage; x: number; y: number; w: number; h: number }[] } | null>;
  zone?: { x: number; y: number; w: number; h: number; media: { x: number; y: number; width: number; height: number } };
  /** Taille du contenu intégré (pt), avant rotation. */
  largeur: number;
  hauteur: number;
  rotation: number;
  /** Échelle de la mise au format (1 = taille d'origine). */
  echelle: number;
}

interface Source {
  doc: PDFDocument;
  pages: Map<number, SourcePage>;
  /** Chemin du PDF source sur le disque (pour le rendu des fonds perdus raster), si connu. */
  chemin?: string;
  raster: boolean;
  /** Fonds perdus disponibles dans la source (mm), 0 si aucun. */
  fondsSource: number;
}

/**
 * Zone de la page source à dessiner dans le format fini, en points, repère non tourné de la page :
 * le format fini centré sur le visuel (centre du TrimBox, sinon du MediaBox), divisé par l'échelle de
 * la mise au format (ajuster.ts). Un visuel pivoté est traité comme une page tournée d'un quart de tour.
 * `fonds` : fonds perdus réellement disponibles autour de cette zone (pt source), bornés à la demande.
 */
function zoneSource(page: PDFPage, finiMm: Dimension, fondsVoulusMm: number, adaptation: Adaptation | null | undefined) {
  const media = page.getMediaBox();
  const rotationPage = ((page.getRotation().angle % 360) + 360) % 360;
  const rotation = adaptation?.pivote ? (rotationPage + 90) % 360 : rotationPage;
  const tourne = rotation === 90 || rotation === 270;
  const trimNode = page.node.TrimBox();
  const trim = trimNode && page.getTrimBox().width > 0 && page.getTrimBox().height > 0 ? page.getTrimBox() : null;
  const cx = trim ? trim.x + trim.width / 2 : media.x + media.width / 2;
  const cy = trim ? trim.y + trim.height / 2 : media.y + media.height / 2;
  // Échelles dans le repère de la page : quand la page est tournée, sa largeur devient la hauteur finie.
  const ex = adaptation?.echelle_x ?? 1;
  const ey = adaptation?.echelle_y ?? 1;
  const [eX, eY] = tourne ? [ey, ex] : [ex, ey];
  const largeur = pt(tourne ? finiMm.hauteur : finiMm.largeur) / eX;
  const hauteur = pt(tourne ? finiMm.largeur : finiMm.hauteur) / eY;
  const x = cx - largeur / 2;
  const y = cy - hauteur / 2;
  const echelle = Math.min(ex, ey);
  // Fonds perdus disponibles : ce qui reste entre la zone et le MediaBox, borné à la valeur voulue (en pt source).
  const dispo = Math.max(0, Math.min(x - media.x, y - media.y, media.x + media.width - (x + largeur), media.y + media.height - (y + hauteur)));
  const fonds = Math.min(dispo, pt(fondsVoulusMm) / echelle);
  return { x, y, largeur, hauteur, fonds, fondsMm: enMm(fonds * echelle), rotation, tourne, media, echelle };
}

async function preparerSource(doc: PDFDocument, src: PDFDocument, numeros: number[], params: ParamsImposition, adaptation: Adaptation | null | undefined): Promise<Source> {
  const pages = new Map<number, SourcePage>();
  let fondsSource = Infinity;
  for (const n of numeros) {
    const page = src.getPage(n - 1);
    const z = zoneSource(page, params.fini, params.fonds_perdus_mm, adaptation);
    fondsSource = Math.min(fondsSource, z.fondsMm);
    const avecFonds = params.methode_fonds_perdus === 'source' ? z.fonds : 0;
    const emb = await doc.embedPage(page, { left: z.x - avecFonds, bottom: z.y - avecFonds, right: z.x + z.largeur + avecFonds, top: z.y + z.hauteur + avecFonds });
    pages.set(n, {
      emb,
      largeur: z.largeur + 2 * avecFonds,
      hauteur: z.hauteur + 2 * avecFonds,
      rotation: z.rotation,
      echelle: z.echelle,
      bordures: new Map(),
      zone: { x: z.x, y: z.y, w: z.largeur, h: z.hauteur, media: { x: z.media.x, y: z.media.y, width: z.media.width, height: z.media.height } },
    });
  }
  return { doc, pages, fondsSource: Number.isFinite(fondsSource) ? fondsSource : 0, raster: false };
}

/** Dessine une page intégrée dans un rectangle (pt), rotation de la source compensée, avec option miroir. */
function dessiner(page: PDFPage, s: SourcePage, x: number, y: number, w: number, h: number, miroirX = false, miroirY = false) {
  const tourne = s.rotation === 90 || s.rotation === 270;
  const xScale = (tourne ? h : w) / s.largeur;
  const yScale = (tourne ? w : h) / s.hauteur;
  const sx = xScale * (miroirX ? -1 : 1);
  const sy = yScale * (miroirY ? -1 : 1);
  // Origine de dessin : la page intégrée part de (x, y) ; un miroir la renvoie de l'autre côté de l'origine.
  let ox = x + (miroirX ? w : 0);
  let oy = y + (miroirY ? h : 0);
  let rotate = 0;
  if (s.rotation === 90) {
    // Contenu à afficher tourné de 90° horaire : on tourne de 270° anti-horaire autour de l'origine.
    rotate = 270;
    ox = x + (miroirX ? w : 0);
    oy = y + h - (miroirY ? h : 0);
  } else if (s.rotation === 270) {
    rotate = 90;
    ox = x + w - (miroirX ? w : 0);
    oy = y + (miroirY ? h : 0);
  } else if (s.rotation === 180) {
    rotate = 180;
    ox = x + w - (miroirX ? w : 0);
    oy = y + h - (miroirY ? h : 0);
  }
  page.drawPage(s.emb, { x: ox, y: oy, xScale: sx, yScale: sy, rotate: degrees(rotate) });
}

function avecClip(page: PDFPage, x: number, y: number, w: number, h: number, fn: () => void) {
  page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
  fn();
  page.pushOperators(popGraphicsState());
}

/** Méthode de chaque bord pour une page : « intelligent » prolonge les bords unis et retourne en miroir les autres. */
function methodesBords(methode: ParamsImposition['methode_fonds_perdus'], unis: BordsUnis | null | undefined): { haut: MethodeBord; bas: MethodeBord; gauche: MethodeBord; droite: MethodeBord } {
  if (methode === 'miroir') return { haut: 'miroir', bas: 'miroir', gauche: 'miroir', droite: 'miroir' };
  if (methode === 'prolonger' || !unis) return { haut: 'prolonger', bas: 'prolonger', gauche: 'prolonger', droite: 'prolonger' };
  const m = (u: boolean): MethodeBord => (u ? 'prolonger' : 'miroir');
  return { haut: m(unis.haut), bas: m(unis.bas), gauche: m(unis.gauche), droite: m(unis.droite) };
}

/**
 * Fonds perdus fabriqués autour d'une page sans fonds perdus. Repère PDF (y vers le haut) :
 * x, y, w, h = zone finie ; fp = largeur des fonds perdus (pt).
 *  - prolonger : la bande de 0,5 mm du bord est étirée sur toute la largeur des fonds perdus ;
 *  - miroir : la page est redessinée retournée de l'autre côté du bord.
 * Chaque bande déborde légèrement sur la zone finie (RECOUVREMENT) pour ne laisser aucun filet.
 */
function fabriquerFonds(page: PDFPage, s: SourcePage, x: number, y: number, w: number, h: number, fp: number, bords: ReturnType<typeof methodesBords>) {
  // Ordre de dessin pensé contre les filets d'anticrénelage : le visuel est déjà posé ; chaque bande
  // déborde de r sur lui (son bord tombe sur du visuel, jamais sur du blanc) ; les coins viennent en
  // dernier et débordent sur les bandes.
  const r = RECOUVREMENT;
  const sw = Math.min(pt(BANDE_PROLONGEE), w / 4, h / 4);
  const fx = fp / sw;
  avecClip(page, x - fp, y, fp + r, h, () =>
    bords.gauche === 'miroir' ? dessiner(page, s, x - w, y, w, h, true, false) : dessiner(page, s, x - fp, y, w * fx, h),
  );
  avecClip(page, x + w - r, y, fp + r, h, () =>
    bords.droite === 'miroir' ? dessiner(page, s, x + w, y, w, h, true, false) : dessiner(page, s, x + w - (w - sw) * fx, y, w * fx, h),
  );
  avecClip(page, x, y - fp, w, fp + r, () =>
    bords.bas === 'miroir' ? dessiner(page, s, x, y - h, w, h, false, true) : dessiner(page, s, x, y - fp, w, h * fx),
  );
  avecClip(page, x, y + h - r, w, fp + r, () =>
    bords.haut === 'miroir' ? dessiner(page, s, x, y + h, w, h, false, true) : dessiner(page, s, x, y + h - (h - sw) * fx, w, h * fx),
  );
  const coin = (cx: number, cy: number, gauche: boolean, bas: boolean, mx: MethodeBord, my: MethodeBord) => {
    // Le coin déborde de r vers l'intérieur (sur les deux bandes voisines et le visuel).
    const kx = gauche ? cx : cx - r;
    const ky = bas ? cy : cy - r;
    avecClip(page, kx, ky, fp + r, fp + r, () => {
      if (mx === 'miroir' || my === 'miroir') dessiner(page, s, gauche ? x - w : x + w, bas ? y - h : y + h, w, h, true, true);
      else dessiner(page, s, gauche ? x - fp : x + w - (w - sw) * fx, bas ? y - fp : y + h - (h - sw) * fx, w * fx, h * fx);
    });
  };
  coin(x - fp, y - fp, true, true, bords.gauche, bords.bas);
  coin(x + w, y - fp, false, true, bords.droite, bords.bas);
  coin(x - fp, y + h, true, false, bords.gauche, bords.haut);
  coin(x + w, y + h, false, false, bords.droite, bords.haut);
}

/** Anneau raster (fonds perdus) autour d'une pose, s'il a pu être fabriqué. Renvoie false sinon. */
async function poserBordure(page: PDFPage, src: Source, s: SourcePage, num: number, x: number, y: number, w: number, h: number, fp: number, fondsMm: number, modes: ModesBords): Promise<boolean> {
  if (!src.raster || !src.chemin || !s.zone || s.rotation !== 0) return false;
  const cle = `${fondsMm}|${modes.haut}${modes.bas}${modes.gauche}${modes.droite}`;
  let b = s.bordures!.get(cle);
  if (b === undefined) {
    // Les bandes sont prises dans la page source : un visuel réduit à 80 % a besoin de 25 % de bande en plus.
    const r = await bordure(src.chemin, num, s.zone, fondsMm / (s.echelle || 1), modes);
    b = r ? { bandes: await Promise.all(r.bandes.map(async (x2) => ({ ...x2, image: await src.doc.embedJpg(x2.jpeg) }))) } : null;
    s.bordures!.set(cle, b);
  }
  if (!b) return false;
  const r = RECOUVREMENT;
  // Les bandes ont été calculées pour la zone finie de la page source : mise à l'échelle de la pose.
  const kx = w / s.zone.w;
  const ky = h / s.zone.h;
  // Découpe en anneau (pair-impair) : zone fini + fonds perdus (+ r), moins la zone finie rentrée de r.
  page.pushOperators(
    pushGraphicsState(),
    rectangle(x - fp - r / 2, y - fp - r / 2, w + 2 * fp + r, h + 2 * fp + r),
    rectangle(x + r, y + r, w - 2 * r, h - 2 * r),
    clipEvenOdd(),
    endPath(),
  );
  for (const bd of b.bandes) page.drawImage(bd.image, { x: x + bd.x * kx, y: y + bd.y * ky, width: bd.w * kx, height: bd.h * ky });
  page.pushOperators(popGraphicsState());
  return true;
}

/**
 * Une pose, avec sa rotation et ses côtés joints. La pose est dessinée « déroulée » (contenu droit) dans
 * un repère tourné autour de son emprise : visuel, fonds perdus, numéro suivent sans rien savoir de la
 * rotation. Côtés joints (pli d'un livret, poses jointives aux fonds perdus partagés) : aucun fond perdu
 * ne déborde de ce côté sur la voisine ; la pose dessinée ensuite recouvre la précédente d'une fraction
 * de point pour ne laisser aucun filet.
 */
async function dessinerPose(page: PDFPage, src: Source, pose: Pose, params: ParamsImposition, unis: (n: number) => BordsUnis | null, font: PDFFont | null) {
  if (pose.page === null) return;
  const theta = pose.rotation ?? 0;
  const e = emprise(pose);
  const bx = pt(pose.x);
  const by = pt(pose.y);
  const bw = pt(e.largeur);
  const bh = pt(e.hauteur);
  let local = pose;
  if (theta) {
    // Matrice de rotation : le repère local (0, 0, w, h) tombe sur l'emprise (bx, by, bw, bh).
    const rad = (theta * Math.PI) / 180;
    const c = Math.round(Math.cos(rad));
    const s = Math.round(Math.sin(rad));
    const [tx, ty] = theta === 90 ? [bx + bw, by] : theta === 180 ? [bx + bw, by + bh] : [bx, by + bh];
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(c, s, -s, c, tx, ty));
    local = { ...pose, x: 0, y: 0, rotation: 0 };
  }
  const fp = pt(Math.max(0, params.fonds_perdus_mm));
  const x = pt(local.x);
  const y = pt(local.y);
  const w = pt(local.largeur);
  const h = pt(local.hauteur);
  const r = RECOUVREMENT / 2;
  let x1 = x - fp - 2, x2 = x + w + fp + 2, y1 = y - fp - 2, y2 = y + h + fp + 2;
  let restreint = false;
  if (local.pli) {
    const pli = (local.pli === 'droite' ? x + w : x) - pt(local.decalage_x ?? 0);
    if (local.pli === 'droite') x2 = pli;
    else x1 = pli;
    restreint = true;
  }
  for (const cote of local.joints ?? []) {
    if (cote === 'gauche' && !local.pli) x1 = x;
    if (cote === 'droite' && !local.pli) x2 = x + w + r;
    if (cote === 'bas') y1 = y - r;
    if (cote === 'haut') y2 = y + h;
    restreint = true;
  }
  if (restreint) page.pushOperators(pushGraphicsState(), rectangle(x1, y1, x2 - x1, y2 - y1), clip(), endPath());
  await dessinerPoseInterne(page, src, local, params, unis);
  if (font) numeroter(page, font, local, params);
  if (restreint) page.pushOperators(popGraphicsState());
  if (theta) page.pushOperators(popGraphicsState());
}

/** Une pose : visuel + fonds perdus selon la méthode, découpée à la zone fini + fonds perdus. */
async function dessinerPoseInterne(page: PDFPage, src: Source, pose: Pose, params: ParamsImposition, unis: (n: number) => BordsUnis | null) {
  if (pose.page === null) return;
  const s = src.pages.get(pose.page);
  if (!s) return;
  const fp = pt(Math.max(0, params.fonds_perdus_mm));
  const x = pt(pose.x);
  const y = pt(pose.y);
  const w = pt(pose.largeur);
  const h = pt(pose.hauteur);
  const methode = params.methode_fonds_perdus;
  const r = fp > 0 ? RECOUVREMENT / 2 : 0;
  if (fp === 0 || methode === 'blanc') {
    // Cadre blanc par rognage : les bords du visuel disparaissent, l'échelle est gardée.
    const c = params.cadre_methode === 'rogner' ? pt(Math.max(0, params.cadre_blanc_mm ?? 0)) : 0;
    avecClip(page, x + c, y + c, w - 2 * c, h - 2 * c, () => dessiner(page, s, x, y, w, h));
    return;
  }
  if (methode === 'source' && src.fondsSource > 0) {
    // La page intégrée contient ses fonds perdus (jusqu'à ce qui existe dans le fichier).
    const f = Math.min(fp, pt(src.fondsSource));
    avecClip(page, x - fp - r, y - fp - r, w + 2 * fp + 2 * r, h + 2 * fp + 2 * r, () => {
      dessiner(page, s, x - f, y - f, w + 2 * f, h + 2 * f);
      if (f + 0.01 < fp) fabriquerFonds(page, s, x - f, y - f, w + 2 * f, h + 2 * f, fp - f, methodesBords('intelligent', unis(pose.page!)));
    });
    return;
  }
  if (methode === 'etirer') {
    avecClip(page, x - fp - r, y - fp - r, w + 2 * fp + 2 * r, h + 2 * fp + 2 * r, () => dessiner(page, s, x - fp, y - fp, w + 2 * fp, h + 2 * fp));
    return;
  }
  // Fonds perdus fabriqués : visuel vectoriel, puis anneau raster (Poppler + sharp) ou, à défaut, vectoriel.
  const modes = methodesBords(methode === 'source' ? 'intelligent' : methode, unis(pose.page));
  avecClip(page, x, y, w, h, () => dessiner(page, s, x, y, w, h));
  const fait = await poserBordure(page, src, s, pose.page, x, y, w, h, fp, params.fonds_perdus_mm, modes);
  if (!fait) avecClip(page, x - fp - r, y - fp - r, w + 2 * fp + 2 * r, h + 2 * fp + 2 * r, () => fabriquerFonds(page, s, x, y, w, h, fp, modes));
}

/** Repères calculés par le plan (reperes.ts) : traits de coupe, lignes de pli, textes, marques. */
function dessinerReperes(page: PDFPage, face: Face, font: PDFFont | null, fontGras: PDFFont | null) {
  for (const t of face.traits ?? []) {
    page.drawLine({ start: { x: pt(t.x1), y: pt(t.y1) }, end: { x: pt(t.x2), y: pt(t.y2) }, thickness: t.epaisseur ?? TRAIT, color: grayscale(0) });
  }
  for (const l of face.lignes ?? []) {
    const start = l.axe === 'x' ? { x: pt(l.pos), y: pt(l.de) } : { x: pt(l.de), y: pt(l.pos) };
    const end = l.axe === 'x' ? { x: pt(l.pos), y: pt(l.a) } : { x: pt(l.a), y: pt(l.pos) };
    page.drawLine({ start, end, thickness: TRAIT, color: grayscale(0), dashArray: l.genre === 'perforation' ? [2, 1] : [3, 3] });
  }
  for (const m of face.marques ?? []) page.drawRectangle({ x: pt(m.x), y: pt(m.y), width: pt(m.largeur), height: pt(m.hauteur), color: grayscale(0) });
  for (const t of face.textes ?? []) {
    const f = (t.gras ? fontGras : font) ?? font ?? fontGras;
    if (!f) continue;
    const largeur = f.widthOfTextAtSize(t.texte, t.taille_pt);
    const dx = t.ancre === 'centre' ? -largeur / 2 : t.ancre === 'droite' ? -largeur : 0;
    const rad = ((t.rotation ?? 0) * Math.PI) / 180;
    page.drawText(t.texte, { x: pt(t.x) + dx * Math.cos(rad), y: pt(t.y) + dx * Math.sin(rad), size: t.taille_pt, font: f, color: grayscale(0), rotate: degrees(t.rotation ?? 0) });
  }
}

function numeroter(page: PDFPage, font: PDFFont, pose: Pose, params: ParamsImposition) {
  const n = params.numerotation;
  if (!n || !pose.numero) return;
  const taille = Math.max(6, Math.min(72, n.taille_pt || 12));
  const texte = pose.numero;
  const largeur = font.widthOfTextAtSize(texte, taille);
  const marge = pt(4);
  const x0 = pt(pose.x);
  const y0 = pt(pose.y);
  const w = pt(pose.largeur);
  const h = pt(pose.hauteur);
  let x = x0 + w - marge - largeur;
  let y = y0 + marge;
  if (n.position === 'bas_gauche') x = x0 + marge;
  if (n.position === 'bas_centre') x = x0 + (w - largeur) / 2;
  if (n.position === 'haut_droite' || n.position === 'haut_gauche') y = y0 + h - marge - taille;
  if (n.position === 'haut_gauche') x = x0 + marge;
  page.drawText(texte, { x, y, size: taille, font, color: rgb(0, 0, 0) });
}

export interface ResultatGeneration {
  octets: Uint8Array;
  nb_pages: number;
}

/** Produit le PDF imposé à partir des octets source et du plan. */
export async function genererPdf(octetsSource: Uint8Array, plan: Plan, paramsDemandes: ParamsImposition, nom: string, bordsUnis: (BordsUnis | null)[] = [], cheminSource?: string): Promise<ResultatGeneration> {
  // Le moteur ne lit que les réglages effectifs du plan (coupe résolue, calepinage, fonds perdus réellement possibles).
  const params: ParamsImposition = { ...(plan.params_effectifs ?? paramsDemandes), fonds_perdus_mm: plan.fonds_perdus_mm };
  const src = await chargerPdf(octetsSource);
  const doc = await PDFDocument.create();
  doc.setTitle(`${nom} — imposition`);
  doc.setProducer('Evocom Print v2 — imposition');
  doc.setCreator('Evocom Print v2');
  const numeros = new Set<number>();
  for (const f of plan.feuilles) for (const face of [f.recto, f.verso]) if (face) for (const q of face.poses) if (q.page !== null && q.page <= src.getPageCount()) numeros.add(q.page);
  const source = await preparerSource(doc, src, [...numeros], params, plan.adaptation);
  source.chemin = cheminSource;
  source.raster = !!cheminSource && (await bordureDisponible());
  const avecTextes = plan.feuilles.some((f) => [f.recto, f.verso].some((face) => face?.textes?.length));
  const fontGras = params.numerotation || avecTextes ? await doc.embedFont(StandardFonts.HelveticaBold) : null;
  const font = avecTextes ? await doc.embedFont(StandardFonts.Helvetica) : null;
  const W = pt(plan.feuille.largeur);
  const H = pt(plan.feuille.hauteur);
  const fp = pt(Math.max(0, params.fonds_perdus_mm));

  for (const f of plan.feuilles) {
    for (const face of [f.recto, f.verso]) {
      if (!face) continue;
      const page = doc.addPage([W, H]);
      for (const q of face.poses) {
        if (q.page !== null && q.page > src.getPageCount()) continue;
        await dessinerPose(page, source, q, params, (n) => bordsUnis[n - 1] ?? null, params.numerotation ? fontGras : null);
      }
      dessinerReperes(page, face, font, fontGras);
      // Boîtes : TrimBox = bloc des poses (format fini pour une pose unique), BleedBox = bloc + fonds perdus.
      const pleines = face.poses.filter((q) => q.page !== null || face.poses.length === 1);
      if (pleines.length) {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const q of pleines) {
          const e = emprise(q);
          x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y); x2 = Math.max(x2, q.x + e.largeur); y2 = Math.max(y2, q.y + e.hauteur);
        }
        page.setTrimBox(pt(x1), pt(y1), pt(x2 - x1), pt(y2 - y1));
        page.setBleedBox(Math.max(0, pt(x1) - fp), Math.max(0, pt(y1) - fp), Math.min(W, pt(x2 - x1) + 2 * fp), Math.min(H, pt(y2 - y1) + 2 * fp));
      }
    }
  }
  const octets = await doc.save({ useObjectStreams: true });
  return { octets, nb_pages: doc.getPageCount() };
}
