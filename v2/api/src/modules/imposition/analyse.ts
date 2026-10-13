// Analyse d'un PDF à imposer : pages et leurs boîtes (MediaBox, TrimBox, BleedBox) en mm, format fini
// reconnu, fonds perdus présents ou non, et, quand Poppler est là, si le visuel va jusqu'au bord
// (ce qui réclame des fonds perdus) ou s'il est entouré d'une marge blanche. Jamais de rendu complet :
// les pages sont rendues petites (2 px/mm) et lues par sharp.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument, type PDFPage } from 'pdf-lib';
import { popplerPresent } from '../fichiers/apercu';
import { arrondi, detecterFormat, mm, type FormatDetecte } from './formats';

const exec = promisify(execFile);

export interface BoitePage {
  largeur: number;
  hauteur: number;
}

export interface Bords {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
}

export interface PageAnalysee {
  numero: number;
  /** Taille affichée (MediaBox, rotation appliquée), mm. */
  largeur: number;
  hauteur: number;
  rotation: number;
  /** TrimBox déclaré (mm), ou null. */
  trim: (BoitePage & { x: number; y: number }) | null;
  /** Fonds perdus déclarés : distance TrimBox → MediaBox sur le plus petit côté (mm). */
  fonds_perdus_declares: number;
  format: FormatDetecte | null;
  /** Analyse du rendu (Poppler) : part de pixels non blancs dans la bande de 1,5 mm de chaque bord. */
  bords: Bords | null;
  /** Marge blanche mesurée (mm) sur chaque bord, ou null sans rendu. */
  marge_blanche: Bords | null;
  /** Bord uni (aplat ou dégradé doux) sur 2 mm : prolongeable sans défaut. null sans rendu. */
  bords_unis: { haut: boolean; bas: boolean; gauche: boolean; droite: boolean } | null;
  /** Le visuel touche au moins un bord. */
  jusqu_au_bord: boolean | null;
  /** Fond clair non blanc (crème, gris pâle…) sur au moins un bord : une coupe franche y laisserait un filet visible. null sans rendu. */
  bord_clair: boolean | null;
}

export interface AnalysePdf {
  nb_pages: number;
  pages: PageAnalysee[];
  /** Toutes les pages ont la même taille. */
  uniforme: boolean;
  largeur: number;
  hauteur: number;
  format: FormatDetecte | null;
  fonds_perdus: 'declares' | 'absents' | 'incertains';
  fonds_perdus_mm: number;
  rendu: boolean;
  avertissements: string[];
  /** Taille finie recommandée (mm) : format reconnu, sinon page moins fonds perdus déclarés. */
  fini: BoitePage;
  /** Marge blanche la plus étroite (mm) sur toutes les pages rendues ; null sans rendu. */
  marge_encre_mm: number | null;
  /** Pages réellement rendues et contrôlées (bords, marges) : les premières et les dernières. */
  pages_controlees: number;
}

function boites(page: PDFPage) {
  const media = page.getMediaBox();
  const trimNode = page.node.TrimBox();
  const bleedNode = page.node.BleedBox();
  const lire = (b: ReturnType<PDFPage['getMediaBox']>) => ({ x: b.x, y: b.y, width: b.width, height: b.height });
  const trim = trimNode ? lire(page.getTrimBox()) : null;
  const bleed = bleedNode ? lire(page.getBleedBox()) : null;
  return { media: lire(media), trim, bleed };
}

async function rendreEtMesurer(abs: string, numero: number, largeurMm: number, hauteurMm: number): Promise<{ bords: Bords; marge: Bords; unis: { haut: boolean; bas: boolean; gauche: boolean; droite: boolean }; clair: boolean } | null> {
  const px = Math.max(60, Math.min(900, Math.round(largeurMm * 2)));
  const temp = path.join(os.tmpdir(), `evocom-imposition-${process.pid}-${Date.now()}-${numero}`);
  try {
    await exec('pdftoppm', ['-f', String(numero), '-l', String(numero), '-scale-to-x', String(px), '-scale-to-y', '-1', '-png', '-singlefile', abs, temp], { timeout: 60000, maxBuffer: 1024 * 1024 });
    const sharp = (await import('sharp')).default;
    const { data: rgb, info: infoRgb } = await sharp(`${temp}.png`).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = await sharp(`${temp}.png`).flatten({ background: '#ffffff' }).grayscale().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    // Uniformité d'une bande : écart-type des trois couches de couleur et variation le long du bord.
    const uni = (x0: number, y0: number, x1: number, y1: number) => {
      const c = infoRgb.channels;
      let n = 0;
      const somme: [number, number, number] = [0, 0, 0];
      const carres: [number, number, number] = [0, 0, 0];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * infoRgb.width + x) * c;
          for (let k = 0 as 0 | 1 | 2; k < 3; k = (k + 1) as 0 | 1 | 2) {
            const v = rgb[i + k]!;
            somme[k] += v;
            carres[k] += v * v;
          }
          n++;
        }
      }
      if (!n) return true;
      const ecart = Math.max(...[0, 1, 2].map((k) => Math.sqrt(Math.max(0, carres[k]! / n - (somme[k]! / n) ** 2))));
      return ecart < 9; // ~3,5 % : aplat ou dégradé très doux
    };
    const pxParMm = w / largeurMm;
    const bande = Math.max(1, Math.round(1.5 * pxParMm));
    const sombre = (x: number, y: number) => data[y * w + x]! < 235;
    const part = (x0: number, y0: number, x1: number, y1: number) => {
      let n = 0;
      let s = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { n++; if (sombre(x, y)) s++; }
      return n ? s / n : 0;
    };
    const bords: Bords = {
      haut: part(0, 0, w, bande),
      bas: part(0, h - bande, w, h),
      gauche: part(0, 0, bande, h),
      droite: part(w - bande, 0, w, h),
    };
    // Marge blanche : on avance depuis chaque bord tant que la ligne (ou colonne) est presque blanche.
    const ligneVide = (y: number) => part(0, y, w, y + 1) < 0.01;
    const colonneVide = (x: number) => part(x, 0, x + 1, h) < 0.01;
    let haut = 0; while (haut < h / 2 && ligneVide(haut)) haut++;
    let bas = 0; while (bas < h / 2 && ligneVide(h - 1 - bas)) bas++;
    let gauche = 0; while (gauche < w / 2 && colonneVide(gauche)) gauche++;
    let droite = 0; while (droite < w / 2 && colonneVide(w - 1 - droite)) droite++;
    const marge: Bords = { haut: arrondi(haut / pxParMm), bas: arrondi(bas / pxParMm), gauche: arrondi(gauche / pxParMm), droite: arrondi(droite / pxParMm) };
    const b2 = Math.max(2, Math.round(2 * pxParMm));
    const unis = { haut: uni(0, 0, w, b2), bas: uni(0, h - b2, w, h), gauche: uni(0, 0, b2, h), droite: uni(w - b2, 0, w, h) };
    // Fond clair non blanc sur un bord (gris 200 à 250) : lu comme « vide » par la marge blanche, mais
    // visible à la coupe franche.
    const partClaire = (x0: number, y0: number, x1: number, y1: number) => {
      let n = 0;
      let c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { n++; const v = data[y * w + x]!; if (v >= 200 && v < 250) c++; }
      return n ? c / n : 0;
    };
    const clair = [partClaire(0, 0, w, bande), partClaire(0, h - bande, w, h), partClaire(0, 0, bande, h), partClaire(w - bande, 0, w, h)].some((v) => v > 0.3);
    void hauteurMm;
    return { bords, marge, unis, clair };
  } catch {
    return null;
  } finally {
    await fs.promises.rm(`${temp}.png`, { force: true }).catch(() => {});
  }
}

const MAX_PAGES_RENDUES = 8;

export async function chargerPdf(octets: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
}

/** Analyse complète d'un PDF (chemin absolu). Les pages rendues se limitent aux premières et dernières. */
export async function analyserPdf(abs: string): Promise<AnalysePdf> {
  const octets = await fs.promises.readFile(abs);
  const doc = await chargerPdf(octets);
  return analyserDocument(abs, doc);
}

async function analyserDocument(abs: string, doc: PDFDocument): Promise<AnalysePdf> {
  const pages = doc.getPages();
  const avertissements: string[] = [];
  const rendu = await popplerPresent();
  const aRendre = new Set<number>();
  for (let i = 0; i < Math.min(pages.length, MAX_PAGES_RENDUES / 2); i++) aRendre.add(i);
  for (let i = Math.max(0, pages.length - MAX_PAGES_RENDUES / 2); i < pages.length; i++) aRendre.add(i);

  const analysees: PageAnalysee[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const { media, trim } = boites(page);
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const tourne = rotation === 90 || rotation === 270;
    const largeur = arrondi(mm(tourne ? media.height : media.width), 2);
    const hauteur = arrondi(mm(tourne ? media.width : media.height), 2);
    let fondsDeclares = 0;
    let trimMm: PageAnalysee['trim'] = null;
    if (trim && (trim.width < media.width - 0.5 || trim.height < media.height - 0.5)) {
      const marges = [trim.x - media.x, trim.y - media.y, media.x + media.width - (trim.x + trim.width), media.y + media.height - (trim.y + trim.height)].map(mm);
      fondsDeclares = arrondi(Math.max(0, Math.min(...marges)), 2);
      trimMm = { x: arrondi(mm(trim.x - media.x), 2), y: arrondi(mm(trim.y - media.y), 2), largeur: arrondi(mm(trim.width), 2), hauteur: arrondi(mm(trim.height), 2) };
    }
    let format = detecterFormat(largeur, hauteur);
    if (trimMm) {
      const f = detecterFormat(tourne ? trimMm.hauteur : trimMm.largeur, tourne ? trimMm.largeur : trimMm.hauteur);
      if (f) format = { ...f, avec_fonds_perdus: fondsDeclares > 0, fonds_perdus_mm: fondsDeclares };
    }
    let bords: Bords | null = null;
    let marge: Bords | null = null;
    let unis: PageAnalysee['bords_unis'] = null;
    let clair: boolean | null = null;
    if (rendu && aRendre.has(i)) {
      const r = await rendreEtMesurer(abs, i + 1, largeur, hauteur);
      if (r) {
        bords = { haut: arrondi(r.bords.haut, 3), bas: arrondi(r.bords.bas, 3), gauche: arrondi(r.bords.gauche, 3), droite: arrondi(r.bords.droite, 3) };
        marge = r.marge;
        unis = r.unis;
        clair = r.clair;
      }
    }
    const jusquAuBord = bords ? Object.values(bords).some((v) => v > 0.04) : null;
    analysees.push({ numero: i + 1, largeur, hauteur, rotation, trim: trimMm, fonds_perdus_declares: fondsDeclares, format, bords, marge_blanche: marge, bords_unis: unis, jusqu_au_bord: jusquAuBord, bord_clair: clair });
  }

  const p0 = analysees[0]!;
  const uniforme = analysees.every((p) => Math.abs(p.largeur - p0.largeur) < 0.6 && Math.abs(p.hauteur - p0.hauteur) < 0.6);
  if (!uniforme) avertissements.push('Les pages n’ont pas toutes la même taille : l’imposition utilise la taille de la première page, les autres seront adaptées.');
  const declares = analysees.filter((p) => p.fonds_perdus_declares >= 1.5).length;
  const fondsPerdus: AnalysePdf['fonds_perdus'] = declares === analysees.length ? 'declares' : p0.format?.avec_fonds_perdus ? 'incertains' : 'absents';
  const fondsMm = declares === analysees.length ? p0.fonds_perdus_declares : p0.format?.avec_fonds_perdus ? p0.format.fonds_perdus_mm : 0;
  const touche = analysees.filter((p) => p.jusqu_au_bord === true).length;
  if (fondsPerdus === 'absents' && touche > 0) {
    avertissements.push(`Le visuel va jusqu’au bord sur ${touche > 1 ? `${touche} pages` : 'une page'} sans fonds perdus déclarés : ajoutez des fonds perdus (miroir ou étirement) ou demandez au client un fichier avec 3 mm de fonds perdus.`);
  }
  if (fondsPerdus === 'incertains') {
    avertissements.push(`La page mesure le format fini plus ${fondsMm} mm de chaque côté : les fonds perdus semblent présents mais ne sont pas déclarés (TrimBox) ; ils seront pris comme tels.`);
  }
  if (!p0.format) avertissements.push('Format non reconnu : vérifiez la taille finie proposée avant de générer.');
  if (analysees.some((p) => p.rotation !== 0)) avertissements.push('Certaines pages portent une rotation : elles sont remises droites dans l’imposition.');
  if (!rendu) avertissements.push('Poppler est absent de ce serveur : le contenu au bord des pages n’a pas pu être contrôlé.');

  const fini: AnalysePdf['fini'] = p0.format
    ? p0.format.paysage
      ? { largeur: p0.format.hauteur, hauteur: p0.format.largeur }
      : { largeur: p0.format.largeur, hauteur: p0.format.hauteur }
    : p0.trim
      ? { largeur: p0.trim.largeur, hauteur: p0.trim.hauteur }
      : { largeur: arrondi(p0.largeur - 2 * fondsMm), hauteur: arrondi(p0.hauteur - 2 * fondsMm) };

  const rendues = analysees.filter((p) => p.marge_blanche);
  const margeEncre = rendues.length ? arrondi(Math.min(...rendues.map((p) => Math.min(...Object.values(p.marge_blanche!))))) : null;

  return {
    nb_pages: analysees.length,
    pages: analysees,
    uniforme,
    marge_encre_mm: margeEncre,
    pages_controlees: rendues.length,
    largeur: p0.largeur,
    hauteur: p0.hauteur,
    format: p0.format,
    fonds_perdus: fondsPerdus,
    fonds_perdus_mm: fondsMm,
    rendu,
    avertissements,
    fini,
  };
}
