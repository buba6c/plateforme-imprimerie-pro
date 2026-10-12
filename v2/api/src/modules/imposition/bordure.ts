// Fonds perdus « raster » : la technique des logiciels de prépresse, avec deux outils libres déjà présents.
//  1. Poppler (pdftoppm) rend la zone finie de la page à 300 ppp ;
//  2. sharp (libvips) étend l'image bord par bord : « copy » répète la dernière rangée de pixels
//     (prolonger), « mirror » retourne le bord (miroir). Les coins se font naturellement.
// L'image obtenue est posée en anneau autour du visuel vectoriel (qui reste net) et déborde de quelques
// dixièmes de millimètre sur lui : aucun liseré blanc, même avec les fichiers qui ont un fond blanc sous
// le dessin (exports Canva, Illustrator…). Sans Poppler, le moteur vectoriel prend le relais.

import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { popplerPresent } from '../fichiers/apercu';

const exec = promisify(execFile);
export const DPI_BORDURE = 300;

export type ModeBord = 'prolonger' | 'miroir';
export interface ModesBords {
  haut: ModeBord;
  bas: ModeBord;
  gauche: ModeBord;
  droite: ModeBord;
}

export interface ZonePt {
  /** Zone finie dans le repère de la page (pt, origine bas-gauche du MediaBox). */
  x: number;
  y: number;
  w: number;
  h: number;
  media: { x: number; y: number; width: number; height: number };
}

export interface Bordure {
  jpeg: Buffer;
  /** Débord de l'image autour de la zone finie, en pt. */
  debordPt: number;
}

const cache = new Map<string, Promise<Bordure | null>>();

export async function bordureDisponible(): Promise<boolean> {
  return popplerPresent();
}

/**
 * Image de la zone finie étendue de `fondsMm + 1` mm de chaque côté selon le mode de chaque bord.
 * null si le rendu est impossible (le moteur vectoriel prend alors le relais).
 */
export function bordure(cheminPdf: string, numero: number, zone: ZonePt, fondsMm: number, modes: ModesBords): Promise<Bordure | null> {
  const cle = `${cheminPdf}|${numero}|${zone.x.toFixed(2)},${zone.y.toFixed(2)},${zone.w.toFixed(2)},${zone.h.toFixed(2)}|${fondsMm}|${modes.haut}${modes.bas}${modes.gauche}${modes.droite}`;
  let p = cache.get(cle);
  if (!p) {
    p = fabriquer(cheminPdf, numero, zone, fondsMm, modes).catch(() => null);
    cache.set(cle, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return p;
}

async function fabriquer(cheminPdf: string, numero: number, zone: ZonePt, fondsMm: number, modes: ModesBords): Promise<Bordure | null> {
  if (!(await popplerPresent())) return null;
  const k = DPI_BORDURE / 72;
  const cx = Math.max(0, Math.round((zone.x - zone.media.x) * k));
  const cy = Math.max(0, Math.round((zone.media.y + zone.media.height - (zone.y + zone.h)) * k));
  const cw = Math.max(1, Math.round(zone.w * k));
  const ch = Math.max(1, Math.round(zone.h * k));
  const temp = path.join(os.tmpdir(), `evocom-bordure-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    await exec('pdftoppm', ['-f', String(numero), '-l', String(numero), '-r', String(DPI_BORDURE), '-x', String(cx), '-y', String(cy), '-W', String(cw), '-H', String(ch), '-png', '-singlefile', '-aa', 'yes', '-aaVector', 'yes', cheminPdf, temp], {
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    const sharp = (await import('sharp')).default;
    const ext = Math.ceil(((fondsMm + 1) / 25.4) * DPI_BORDURE);
    const avec = (m: ModeBord) => (m === 'miroir' ? 'mirror' : 'copy') as 'mirror' | 'copy';
    // Côtés d'abord, puis haut et bas : les coins prolongent ou retournent les bandes latérales.
    let buf = await sharp(`${temp}.png`).flatten({ background: '#ffffff' }).toBuffer();
    buf = await sharp(buf).extend({ left: ext, extendWith: avec(modes.gauche) }).toBuffer();
    buf = await sharp(buf).extend({ right: ext, extendWith: avec(modes.droite) }).toBuffer();
    buf = await sharp(buf).extend({ top: ext, extendWith: avec(modes.haut) }).toBuffer();
    buf = await sharp(buf).extend({ bottom: ext, extendWith: avec(modes.bas) }).toBuffer();
    const jpeg = await sharp(buf).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
    return { jpeg, debordPt: ext / k };
  } finally {
    await fs.promises.rm(`${temp}.png`, { force: true }).catch(() => {});
  }
}
