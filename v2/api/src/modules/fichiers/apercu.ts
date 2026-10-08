// Miniatures et pages en image, fabriquées par le serveur : un PDF de n'importe quelle taille (seule la
// page demandée est lue, par pdftoppm de Poppler), les fichiers Illustrator compatibles PDF, et les
// images (PNG, JPEG, TIFF, GIF, WebP, HEIF) par sharp. Le résultat est gardé sur disque : la même
// miniature n'est fabriquée qu'une fois. Sans Poppler sur le serveur, les PDF répondent 501 et
// l'interface dessine la miniature elle-même avec PDF.js.

import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export type GenreApercu = 'pdf' | 'image';

const IMAGES = /\.(png|jpe?g|tiff?|gif|webp|heic|heif)$/i;

export function genreApercu(f: { mime: string | null; nom_original: string }): GenreApercu | null {
  const mime = (f.mime ?? '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/illustrator' || /\.(pdf|ai)$/i.test(f.nom_original)) return 'pdf';
  if (mime.startsWith('image/') || IMAGES.test(f.nom_original)) return 'image';
  return null;
}

let popplerDispo: boolean | null = null;
export async function popplerPresent(): Promise<boolean> {
  if (popplerDispo === null) {
    popplerDispo = await exec('pdftoppm', ['-v'], { timeout: 5000 }).then(
      () => true,
      (e: NodeJS.ErrnoException & { stderr?: string }) => e.code !== 'ENOENT' && /pdftoppm/i.test(String(e.stderr ?? '')),
    );
  }
  return popplerDispo;
}

// Deux fabrications à la fois au plus : un lot de miniatures ne doit pas saturer le serveur.
let enCours = 0;
const attente: (() => void)[] = [];
async function file<T>(fn: () => Promise<T>): Promise<T> {
  if (enCours >= 2) await new Promise<void>((ok) => attente.push(ok));
  enCours++;
  try {
    return await fn();
  } finally {
    enCours--;
    attente.shift()?.();
  }
}

async function sharpModule() {
  return (await import('sharp')).default;
}

/** Nombre de pages d'un PDF (pdfinfo), ou null si inconnu. */
export async function pagesPdf(abs: string): Promise<number | null> {
  if (!(await popplerPresent())) return null;
  try {
    const { stdout } = await exec('pdfinfo', [abs], { timeout: 15000, maxBuffer: 1024 * 1024 });
    const m = /^Pages:\s+(\d+)/m.exec(stdout);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export class ApercuIndisponible extends Error {}

/**
 * Chemin d'une image WebP de la page `page` (PDF) ou de l'image, de `largeur` pixels de large.
 * Fabriquée une fois, puis relue depuis `${stockage}/apercus`.
 */
export async function apercu(stockage: string, abs: string, genre: GenreApercu, page: number, largeur: number): Promise<string> {
  const st = await fs.promises.stat(abs);
  const cle = crypto.createHash('sha1').update(`${abs}|${st.size}|${st.mtimeMs}|${page}|${largeur}`).digest('hex');
  const dossier = path.join(stockage, 'apercus', cle.slice(0, 2));
  const sortie = path.join(dossier, `${cle}.webp`);
  if (fs.existsSync(sortie)) return sortie;
  await fs.promises.mkdir(dossier, { recursive: true });
  return file(async () => {
    if (fs.existsSync(sortie)) return sortie;
    const sharp = await sharpModule();
    const temp = `${sortie}.${process.pid}.${Date.now()}`;
    try {
      if (genre === 'pdf') {
        if (!(await popplerPresent())) throw new ApercuIndisponible('Poppler (pdftoppm) absent du serveur.');
        // -scale-to : largeur cible ; une seule page lue, même dans un PDF de plusieurs centaines de Mo.
        await exec('pdftoppm', ['-f', String(page), '-l', String(page), '-scale-to-x', String(largeur), '-scale-to-y', '-1', '-png', '-singlefile', '-aa', 'yes', '-aaVector', 'yes', abs, temp], {
          timeout: 45000,
          maxBuffer: 1024 * 1024,
        });
        await sharp(`${temp}.png`).flatten({ background: '#ffffff' }).webp({ quality: 82 }).toFile(sortie);
      } else {
        await sharp(abs, { limitInputPixels: 400_000_000, pages: 1 })
          .rotate()
          .resize({ width: largeur, withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .webp({ quality: 82 })
          .toFile(sortie);
      }
      return sortie;
    } catch (e) {
      if (e instanceof ApercuIndisponible) throw e;
      const err = e as NodeJS.ErrnoException & { stderr?: string };
      if (err.code === 'ENOENT' && genre === 'pdf') {
        popplerDispo = false;
        throw new ApercuIndisponible('Poppler (pdftoppm) absent du serveur.');
      }
      throw new Error(`Aperçu impossible : ${String(err.stderr ?? err.message).split('\n')[0]}`);
    } finally {
      await fs.promises.rm(`${temp}.png`, { force: true }).catch(() => {});
    }
  });
}
