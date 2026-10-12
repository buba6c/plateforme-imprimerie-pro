// Fonds perdus « raster » : la technique des logiciels de prépresse, avec deux outils libres déjà présents.
//  1. Poppler (pdftoppm) rend la zone finie de la page à 200 ppp ;
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
// 200 ppp suffisent : la bande est coupée au massicot, seuls 0,2 mm restent visibles sous la coupe.
export const DPI_BORDURE = 200;

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

export interface Bande {
  jpeg: Buffer;
  /** Position et taille (pt) relatives au coin bas-gauche de la zone finie (repère PDF). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Quatre bandes (haut et bas avec les coins, gauche, droite) : seul le pourtour est embarqué, pas la page entière. */
export interface Bordure {
  bandes: Bande[];
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
    p = fabriquer(cheminPdf, numero, zone, fondsMm, modes).catch((e: unknown) => {
      // Le moteur vectoriel prend le relais, mais l'échec doit rester visible dans les journaux.
      console.warn('[imposition] fonds perdus raster impossibles, moteur vectoriel utilisé :', e instanceof Error ? e.message : e);
      return null;
    });
    cache.set(cle, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return p;
}

async function fabriquer(cheminPdf: string, numero: number, zone: ZonePt, fondsMm: number, modes: ModesBords): Promise<Bordure | null> {
  if (!(await popplerPresent())) return null;
  const k = DPI_BORDURE / 72;
  // Zone demandée (pixels, origine en haut à gauche de la page) : elle peut dépasser la page quand le
  // visuel a été réduit pour tenir dans le format fini (bandes blanches) ; Poppler ne rend que la page,
  // le reste est complété en blanc.
  const x0 = Math.round((zone.x - zone.media.x) * k);
  const y0 = Math.round((zone.media.y + zone.media.height - (zone.y + zone.h)) * k);
  const cw = Math.max(1, Math.round(zone.w * k));
  const ch = Math.max(1, Math.round(zone.h * k));
  const pageW = Math.max(1, Math.round(zone.media.width * k));
  const pageH = Math.max(1, Math.round(zone.media.height * k));
  const cx = Math.min(pageW - 1, Math.max(0, x0));
  const cy = Math.min(pageH - 1, Math.max(0, y0));
  const rw = Math.max(1, Math.min(cw - (cx - x0), pageW - cx));
  const rh = Math.max(1, Math.min(ch - (cy - y0), pageH - cy));
  const temp = path.join(os.tmpdir(), `evocom-bordure-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  try {
    await exec('pdftoppm', ['-f', String(numero), '-l', String(numero), '-r', String(DPI_BORDURE), '-x', String(cx), '-y', String(cy), '-W', String(rw), '-H', String(rh), '-png', '-singlefile', '-aa', 'yes', '-aaVector', 'yes', cheminPdf, temp], {
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    const sharp = (await import('sharp')).default;
    const ext = Math.ceil(((fondsMm + 1) / 25.4) * DPI_BORDURE);
    const avec = (m: ModeBord) => (m === 'miroir' ? 'mirror' : 'copy') as 'mirror' | 'copy';
    const rendu = await sharp(`${temp}.png`).flatten({ background: '#ffffff' }).removeAlpha().metadata();
    const left = cx - x0;
    const top = cy - y0;
    const right = Math.max(0, cw - left - (rendu.width ?? rw));
    const bottom = Math.max(0, ch - top - (rendu.height ?? rh));
    const base = await sharp(`${temp}.png`).flatten({ background: '#ffffff' }).removeAlpha().extend({ left, top, right, bottom, background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
    const W = base.info.width;
    const H = base.info.height;
    // Profondeur prise dans la page : un peu plus que le débord, pour que le miroir ait de la matière.
    const d = Math.min(ext + 4, Math.floor(W / 2), Math.floor(H / 2));
    const brut = { raw: { width: W, height: H, channels: base.info.channels as 3 } };
    const bande = async (left: number, top: number, width: number, height: number, etendre: { top?: number; bottom?: number; left?: number; right?: number }, modes2: { top?: ModeBord; bottom?: ModeBord; left?: ModeBord; right?: ModeBord }) => {
      let buf = await sharp(base.data, brut).extract({ left, top, width, height }).png().toBuffer();
      for (const cote of ['top', 'bottom', 'left', 'right'] as const) {
        const n = etendre[cote];
        if (n) buf = await sharp(buf).extend({ [cote]: n, extendWith: avec(modes2[cote]!) }).png().toBuffer();
      }
      return sharp(buf).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
    };
    const extPt = ext / k;
    const dPt = d / k;
    const Wpt = zone.w;
    const Hpt = zone.h;
    const [haut, bas, gauche, droite] = await Promise.all([
      bande(0, 0, W, d, { top: ext, left: ext, right: ext }, { top: modes.haut, left: modes.gauche, right: modes.droite }),
      bande(0, H - d, W, d, { bottom: ext, left: ext, right: ext }, { bottom: modes.bas, left: modes.gauche, right: modes.droite }),
      bande(0, 0, d, H, { left: ext }, { left: modes.gauche }),
      bande(W - d, 0, d, H, { right: ext }, { right: modes.droite }),
    ]);
    return {
      debordPt: extPt,
      bandes: [
        { jpeg: gauche, x: -extPt, y: 0, w: extPt + dPt, h: Hpt },
        { jpeg: droite, x: Wpt - dPt, y: 0, w: dPt + extPt, h: Hpt },
        { jpeg: haut, x: -extPt, y: Hpt - dPt, w: Wpt + 2 * extPt, h: dPt + extPt },
        { jpeg: bas, x: -extPt, y: -extPt, w: Wpt + 2 * extPt, h: dPt + extPt },
      ],
    };
  } finally {
    await fs.promises.rm(`${temp}.png`, { force: true }).catch(() => {});
  }
}
