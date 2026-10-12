// Assemblage des pièces d'un travail d'imposition : plusieurs fichiers du dossier (PDF ou images)
// réunis en un seul document de travail, chaque pièce avec un rôle :
//  - « recto » / « verso » : les deux faces viennent de fichiers séparés (deux PDF d'une carte de visite,
//    deux images) ; elles sont appariées page à page ;
//  - « pages » : les pages se suivent (brochure en plusieurs fichiers, flyers différents).
// Les images (JPEG, PNG, WebP, TIFF…) deviennent une page PDF : taille d'après leur résolution (dpi)
// quand elle est connue, sinon ajustée au format fini + fonds perdus demandés.
// Le document assemblé est gardé quelques minutes sur le disque (analyse, plan, génération).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { genreApercu } from '../fichiers/apercu';
import { chargerPdf } from './analyse';
import { reparer } from '../traitement/pdf';
import { pt, type Dimension } from './formats';

export type RolePiece = 'recto' | 'verso' | 'pages';

export interface PieceEntree {
  /** Fichier du dossier (id) ; un fichier libre reçoit un id négatif dérivé de son jeton. */
  fichier_id: number;
  libre?: string;
  role: RolePiece;
  /** Pages à prendre (1-based) ; toutes si absent. */
  pages?: number[];
}

export interface FichierPiece {
  id: number;
  /** Fichier libre (déposé sans dossier) : son jeton, pour les aperçus. */
  libre?: string;
  nom_original: string;
  mime: string | null;
  taille: number;
  sha256: string | null;
  abs: string;
}

export interface PageVirtuelle {
  /** Numéro dans le document assemblé (1-based). */
  numero: number;
  fichier_id: number;
  libre?: string;
  nom: string;
  page_source: number;
  role: RolePiece;
  genre: 'pdf' | 'image';
}

export interface Paire {
  recto: number;
  verso: number | null;
}

export interface Assemblage {
  signature: string;
  chemin: string;
  pages: PageVirtuelle[];
  /** Appariement recto/verso quand des pièces ont ces rôles ; null si tout est en « pages ». */
  paires: Paire[] | null;
  nb_images: number;
  /** Première pièce : dossier de destination du résultat. */
  dossier_id: number;
}

const TTL_MS = 30 * 60_000;
const cache = new Map<string, { at: number; a: Assemblage }>();

export function signaturePieces(pieces: PieceEntree[], fichiers: FichierPiece[], fini: Dimension | undefined, fonds: number | undefined): string {
  const h = crypto.createHash('sha1');
  for (const p of pieces) {
    const f = fichiers.find((x) => x.id === p.fichier_id);
    h.update(`${p.fichier_id}|${f?.libre ?? ''}|${f?.sha256 ?? f?.taille ?? ''}|${p.role}|${(p.pages ?? []).join(',')};`);
  }
  if (pieces.some((p) => fichiers.find((x) => x.id === p.fichier_id && genreApercu(x) === 'image'))) h.update(`fini=${fini?.largeur ?? ''}x${fini?.hauteur ?? ''}+${fonds ?? ''}`);
  return h.digest('hex');
}

async function imageEnPage(doc: PDFDocument, abs: string, fini: Dimension | undefined, fonds: number | undefined): Promise<{ largeur: number; hauteur: number }> {
  const sharp = (await import('sharp')).default;
  const img = sharp(abs, { limitInputPixels: 400_000_000 }).rotate();
  const meta = await img.metadata();
  const pxW = meta.width ?? 0;
  const pxH = meta.height ?? 0;
  if (!pxW || !pxH) throw new Error('image illisible');
  // Taille physique : densité connue (dpi) → mm ; sinon ajustée au format fini + fonds perdus, sinon 300 dpi.
  let largeurMm: number;
  let hauteurMm: number;
  const densite = meta.density && meta.density >= 50 && meta.density <= 2400 ? meta.density : null;
  if (densite) {
    largeurMm = (pxW / densite) * 25.4;
    hauteurMm = (pxH / densite) * 25.4;
  } else if (fini && fini.largeur > 0 && fini.hauteur > 0) {
    const fp = Math.max(0, fonds ?? 0);
    const cibleW = fini.largeur + 2 * fp;
    const cibleH = fini.hauteur + 2 * fp;
    const paysageImage = pxW > pxH;
    const paysageCible = cibleW > cibleH;
    const [cw, ch] = paysageImage === paysageCible ? [cibleW, cibleH] : [cibleH, cibleW];
    // L'image couvre la cible (recadrée au besoin par l'imposition) : échelle sur le côté le plus contraint.
    const k = Math.max(cw / pxW, ch / pxH);
    largeurMm = pxW * k;
    hauteurMm = pxH * k;
  } else {
    largeurMm = (pxW / 300) * 25.4;
    hauteurMm = (pxH / 300) * 25.4;
  }
  const png = await img.png().toBuffer();
  const image = await doc.embedPng(png);
  const page = doc.addPage([pt(largeurMm), pt(hauteurMm)]);
  page.drawImage(image, { x: 0, y: 0, width: pt(largeurMm), height: pt(hauteurMm) });
  return { largeur: largeurMm, hauteur: hauteurMm };
}

/** Assemble les pièces ; `dossierTemp` reçoit le PDF de travail. */
export async function assembler(pieces: PieceEntree[], fichiers: FichierPiece[], dossierTemp: string, fini?: Dimension, fonds?: number): Promise<Assemblage> {
  const signature = signaturePieces(pieces, fichiers, fini, fonds);
  const c = cache.get(signature);
  if (c && Date.now() - c.at < TTL_MS && fs.existsSync(c.a.chemin)) return c.a;

  const doc = await PDFDocument.create();
  const pages: PageVirtuelle[] = [];
  let nbImages = 0;
  for (const p of pieces) {
    const f = fichiers.find((x) => x.id === p.fichier_id);
    if (!f) throw new Error(`Fichier ${p.fichier_id} introuvable.`);
    const genre = genreApercu(f);
    if (genre === 'pdf') {
      let src;
      try {
        src = await chargerPdf(await fs.promises.readFile(f.abs));
      } catch (e) {
        // PDF abîmé (références invalides…) : réparé avec qpdf ou Ghostscript, puis relu.
        const repare = path.join(dossierTemp, `repare-${f.id}-${Date.now()}.pdf`);
        await fs.promises.mkdir(dossierTemp, { recursive: true });
        const r = await reparer(f.abs, repare);
        if (!r) throw new Error(`« ${f.nom_original} » est illisible et n’a pas pu être réparé (${e instanceof Error ? e.message.slice(0, 80) : 'erreur'}). Demandez au client un nouvel export PDF.`);
        src = await chargerPdf(await fs.promises.readFile(r.chemin));
      }
      const total = src.getPageCount();
      const voulues = (p.pages?.length ? p.pages : Array.from({ length: total }, (_, i) => i + 1)).filter((n) => n >= 1 && n <= total);
      if (!voulues.length) throw new Error(`« ${f.nom_original} » : aucune page valide demandée.`);
      const copiees = await doc.copyPages(src, voulues.map((n) => n - 1));
      copiees.forEach((pg, i) => {
        doc.addPage(pg);
        pages.push({ numero: pages.length + 1, fichier_id: f.id, libre: f.libre, nom: f.nom_original, page_source: voulues[i]!, role: p.role, genre: 'pdf' });
      });
    } else if (genre === 'image') {
      await imageEnPage(doc, f.abs, fini, fonds);
      nbImages++;
      pages.push({ numero: pages.length + 1, fichier_id: f.id, libre: f.libre, nom: f.nom_original, page_source: 1, role: p.role, genre: 'image' });
    } else {
      throw new Error(`« ${f.nom_original} » n'est ni un PDF ni une image : il ne peut pas être imposé.`);
    }
  }
  if (!pages.length) throw new Error('Aucune page à imposer.');

  // Appariement recto/verso.
  let paires: Paire[] | null = null;
  if (pieces.some((p) => p.role === 'verso' || p.role === 'recto')) {
    const rectos = pages.filter((x) => x.role !== 'verso').map((x) => x.numero);
    const versos = pages.filter((x) => x.role === 'verso').map((x) => x.numero);
    paires = rectos.map((r, i) => ({ recto: r, verso: versos[i] ?? null }));
    if (!rectos.length && versos.length) paires = versos.map((v) => ({ recto: v, verso: null }));
  }

  await fs.promises.mkdir(dossierTemp, { recursive: true });
  const chemin = path.join(dossierTemp, `${signature}.pdf`);
  await fs.promises.writeFile(chemin, await doc.save({ useObjectStreams: true }));
  const a: Assemblage = { signature, chemin, pages, paires, nb_images: nbImages, dossier_id: 0 };
  cache.set(signature, { at: Date.now(), a });
  // Ménage : fichiers de travail trop vieux.
  void nettoyerTemp(dossierTemp).catch(() => {});
  return a;
}

async function nettoyerTemp(dossierTemp: string) {
  const entrees = await fs.promises.readdir(dossierTemp).catch(() => [] as string[]);
  const limite = Date.now() - TTL_MS;
  for (const e of entrees) {
    const abs = path.join(dossierTemp, e);
    const st = await fs.promises.stat(abs).catch(() => null);
    if (st && st.isFile() && st.mtimeMs < limite) await fs.promises.rm(abs, { force: true }).catch(() => {});
  }
  for (const [k, v] of cache) if (Date.now() - v.at > TTL_MS) cache.delete(k);
}
