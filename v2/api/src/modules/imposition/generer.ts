// Génération du PDF imposé avec pdf-lib : chaque page source est intégrée une fois (XObject) puis dessinée
// à chaque pose. Fonds perdus : ceux du fichier (zone au-delà du TrimBox), ou fabriqués en miroir
// (les bandes de bord sont redessinées retournées, en vecteur, comme le font les outils de prépresse),
// par étirement (le visuel est agrandi de la valeur des fonds perdus) ou laissés blancs. Traits de coupe
// en bordure de feuille et aux angles, traits de pli pour le livret, numérotation des tickets.
// Les boîtes PDF (TrimBox, BleedBox) sont posées sur chaque feuille.

import { clip, degrees, endPath, grayscale, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts, type PDFEmbeddedPage, type PDFFont, type PDFPage } from 'pdf-lib';
import { chargerPdf } from './analyse';
import { pt, mm as enMm } from './formats';
import type { ParamsImposition, Plan, Pose } from './plan';

const TRAIT = 0.25; // pt
const LONGUEUR_TRAIT = 4; // mm
const ECART_TRAIT = 1; // mm au-delà des fonds perdus

interface SourcePage {
  emb: PDFEmbeddedPage;
  /** Taille du contenu intégré (pt), avant rotation. */
  largeur: number;
  hauteur: number;
  rotation: number;
}

interface Source {
  doc: PDFDocument;
  pages: Map<number, SourcePage>;
  /** Fonds perdus disponibles dans la source (mm), 0 si aucun. */
  fondsSource: number;
}

/** Zone finie (trim) et fonds perdus réellement présents d'une page source, en points, repère de la page. */
function zoneSource(page: PDFPage, finiMm: { largeur: number; hauteur: number }, fondsVoulusMm: number) {
  const media = page.getMediaBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const tourne = rotation === 90 || rotation === 270;
  const trimNode = page.node.TrimBox();
  const trim = trimNode ? page.getTrimBox() : null;
  // Format fini dans le repère non tourné de la page.
  const finiW = pt(tourne ? finiMm.hauteur : finiMm.largeur);
  const finiH = pt(tourne ? finiMm.largeur : finiMm.hauteur);
  let x: number;
  let y: number;
  if (trim && trim.width > 0 && trim.height > 0) {
    x = trim.x + (trim.width - finiW) / 2;
    y = trim.y + (trim.height - finiH) / 2;
  } else {
    x = media.x + (media.width - finiW) / 2;
    y = media.y + (media.height - finiH) / 2;
  }
  // Fonds perdus disponibles : ce qui reste entre la zone finie et le MediaBox, borné à la valeur voulue.
  const dispo = Math.max(0, Math.min(x - media.x, y - media.y, media.x + media.width - (x + finiW), media.y + media.height - (y + finiH)));
  const fonds = Math.min(dispo, pt(fondsVoulusMm));
  return { x, y, largeur: finiW, hauteur: finiH, fonds, rotation, tourne, media };
}

async function preparerSource(doc: PDFDocument, src: PDFDocument, numeros: number[], params: ParamsImposition): Promise<Source> {
  const pages = new Map<number, SourcePage>();
  let fondsSource = Infinity;
  for (const n of numeros) {
    const page = src.getPage(n - 1);
    const z = zoneSource(page, params.fini, params.fonds_perdus_mm);
    fondsSource = Math.min(fondsSource, z.fonds);
    const avecFonds = params.methode_fonds_perdus === 'source' ? z.fonds : 0;
    const emb = await doc.embedPage(page, { left: z.x - avecFonds, bottom: z.y - avecFonds, right: z.x + z.largeur + avecFonds, top: z.y + z.hauteur + avecFonds });
    pages.set(n, { emb, largeur: z.largeur + 2 * avecFonds, hauteur: z.hauteur + 2 * avecFonds, rotation: z.rotation });
  }
  return { doc, pages, fondsSource: Number.isFinite(fondsSource) ? enMm(fondsSource) : 0 };
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

/** Une pose : visuel + fonds perdus selon la méthode, clippé à la zone fini + fonds perdus. */
function dessinerPose(page: PDFPage, src: Source, pose: Pose, params: ParamsImposition) {
  if (pose.page === null) return;
  const s = src.pages.get(pose.page);
  if (!s) return;
  const fp = pt(Math.max(0, params.fonds_perdus_mm));
  const x = pt(pose.x);
  const y = pt(pose.y);
  const w = pt(pose.largeur);
  const h = pt(pose.hauteur);
  const methode = params.methode_fonds_perdus;
  avecClip(page, x - fp, y - fp, w + 2 * fp, h + 2 * fp, () => {
    if (fp === 0 || methode === 'blanc') {
      avecClip(page, x, y, w, h, () => dessiner(page, s, x, y, w, h));
      return;
    }
    if (methode === 'source') {
      // La page intégrée contient déjà ses fonds perdus (jusqu'à ce qui existe dans le fichier).
      const dispo = pt(src.fondsSource);
      const f = Math.min(fp, dispo);
      const k = (w + 2 * f) / s.largeur; // s.largeur = fini + 2·f (points)
      void k;
      dessiner(page, s, x - f, y - f, w + 2 * f, h + 2 * f);
      return;
    }
    if (methode === 'etirer') {
      // Le visuel est agrandi pour couvrir fini + fonds perdus (on perd un peu de bord, aucun raccord).
      dessiner(page, s, x - fp, y - fp, w + 2 * fp, h + 2 * fp);
      return;
    }
    // miroir : le visuel au centre, puis les 4 bandes et les 4 coins retournés.
    dessiner(page, s, x, y, w, h);
    avecClip(page, x - fp, y, fp, h, () => dessiner(page, s, x - w, y, w, h, true, false)); // gauche
    avecClip(page, x + w, y, fp, h, () => dessiner(page, s, x + w, y, w, h, true, false)); // droite
    avecClip(page, x, y - fp, w, fp, () => dessiner(page, s, x, y - h, w, h, false, true)); // bas
    avecClip(page, x, y + h, w, fp, () => dessiner(page, s, x, y + h, w, h, false, true)); // haut
    avecClip(page, x - fp, y - fp, fp, fp, () => dessiner(page, s, x - w, y - h, w, h, true, true));
    avecClip(page, x + w, y - fp, fp, fp, () => dessiner(page, s, x + w, y - h, w, h, true, true));
    avecClip(page, x - fp, y + h, fp, fp, () => dessiner(page, s, x - w, y + h, w, h, true, true));
    avecClip(page, x + w, y + h, fp, fp, () => dessiner(page, s, x + w, y + h, w, h, true, true));
  });
}

function ligne(page: PDFPage, x1: number, y1: number, x2: number, y2: number, pointilles = false) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: TRAIT, color: grayscale(0), dashArray: pointilles ? [3, 3] : undefined });
}

/** Traits de coupe : aux angles de chaque pose (hors fonds perdus) et en bordure de feuille. */
function traitsDeCoupe(page: PDFPage, poses: Pose[], feuille: { largeur: number; hauteur: number }, fondsMm: number, plis: number[]) {
  const L = pt(LONGUEUR_TRAIT);
  const e = pt(fondsMm + ECART_TRAIT);
  const W = pt(feuille.largeur);
  const H = pt(feuille.hauteur);
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const q of poses) {
    const x = pt(q.x);
    const y = pt(q.y);
    const w = pt(q.largeur);
    const h = pt(q.hauteur);
    xs.add(Math.round(x * 100) / 100);
    xs.add(Math.round((x + w) * 100) / 100);
    ys.add(Math.round(y * 100) / 100);
    ys.add(Math.round((y + h) * 100) / 100);
    // Angles : 8 petits traits, en dehors des fonds perdus.
    for (const [cx, dir] of [[x, -1], [x + w, 1]] as const) {
      ligne(page, cx, y - e, cx, y - e - L);
      ligne(page, cx, y + h + e, cx, y + h + e + L);
      void dir;
    }
    for (const cy of [y, y + h]) {
      ligne(page, x - e, cy, x - e - L, cy);
      ligne(page, x + w + e, cy, x + w + e + L, cy);
    }
  }
  // Bordure de feuille : repères de chaque ligne de coupe, pour couper au massicot d'un seul trait.
  const marge = pt(6);
  for (const x of xs) {
    ligne(page, x, 0, x, marge);
    ligne(page, x, H, x, H - marge);
  }
  for (const y of ys) {
    ligne(page, 0, y, marge, y);
    ligne(page, W, y, W - marge, y);
  }
  for (const p of plis) {
    const x = pt(p);
    ligne(page, x, 0, x, marge * 1.5, true);
    ligne(page, x, H, x, H - marge * 1.5, true);
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
export async function genererPdf(octetsSource: Uint8Array, plan: Plan, params: ParamsImposition, nom: string): Promise<ResultatGeneration> {
  const src = await chargerPdf(octetsSource);
  const doc = await PDFDocument.create();
  doc.setTitle(`${nom} — imposition`);
  doc.setProducer('Evocom Print v2 — imposition');
  doc.setCreator('Evocom Print v2');
  const numeros = new Set<number>();
  for (const f of plan.feuilles) for (const face of [f.recto, f.verso]) if (face) for (const q of face.poses) if (q.page !== null && q.page <= src.getPageCount()) numeros.add(q.page);
  const source = await preparerSource(doc, src, [...numeros], params);
  const font = params.numerotation ? await doc.embedFont(StandardFonts.HelveticaBold) : null;
  const W = pt(plan.feuille.largeur);
  const H = pt(plan.feuille.hauteur);
  const fp = pt(Math.max(0, params.fonds_perdus_mm));

  for (const f of plan.feuilles) {
    for (const face of [f.recto, f.verso]) {
      if (!face) continue;
      const page = doc.addPage([W, H]);
      for (const q of face.poses) {
        if (q.page !== null && q.page > src.getPageCount()) continue;
        dessinerPose(page, source, q, params);
        if (font) numeroter(page, font, q, params);
      }
      if (params.traits_de_coupe) traitsDeCoupe(page, face.poses, plan.feuille, params.fonds_perdus_mm, face.plis);
      // Boîtes : pour une seule pose, TrimBox = format fini, BleedBox = fini + fonds perdus.
      if (face.poses.length === 1 && face.poses[0]) {
        const q = face.poses[0];
        page.setTrimBox(pt(q.x), pt(q.y), pt(q.largeur), pt(q.hauteur));
        page.setBleedBox(pt(q.x) - fp, pt(q.y) - fp, pt(q.largeur) + 2 * fp, pt(q.hauteur) + 2 * fp);
      }
    }
  }
  const octets = await doc.save({ useObjectStreams: true });
  return { octets, nb_pages: doc.getPageCount() };
}
