// Réparation et optimisation d'un PDF pour l'impression. Toujours sur une copie : le fichier d'origine
// n'est jamais modifié. Le résultat n'est gardé que s'il est lisible et apporte quelque chose
// (réparé, ou nettement plus léger) ; sinon l'original reste la version servie.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { exec, gsPresent, qpdfPresent } from './outils';

/** Ghostscript en priorité basse : le serveur reste fluide pendant les traitements. */
const gsBas = (args: string[], opts: { timeout: number; maxBuffer: number }) => exec('nice', ['-n', '15', 'gs', ...args], opts).catch((e: NodeJS.ErrnoException) => (e.code === 'ENOENT' ? exec('gs', args, opts) : Promise.reject(e)));

export interface RapportTraitement {
  statut: 'optimise' | 'repare' | 'inchange' | 'illisible' | 'ignore' | 'erreur';
  outils: string[];
  /** Le PDF d'origine était illisible pour pdf-lib (références cassées…) et a été réparé. */
  repare: boolean;
  taille_avant: number;
  taille_apres: number | null;
  pages: number | null;
  /** Polices non incorporées détectées avant traitement (pdffonts). */
  polices_non_incorporees: string[];
  /** Plus petite résolution d'image trouvée (ppp), si Poppler est là. */
  dpi_min: number | null;
  avertissements: string[];
  duree_ms: number;
  fait_le: string;
}

/** Le PDF s'ouvre-t-il avec pdf-lib (utilisé par l'imposition) ? */
export async function lisible(abs: string): Promise<{ ok: boolean; pages: number | null; erreur?: string }> {
  try {
    const doc = await PDFDocument.load(await fs.promises.readFile(abs), { ignoreEncryption: true, updateMetadata: false });
    return { ok: true, pages: doc.getPageCount() };
  } catch (e) {
    return { ok: false, pages: null, erreur: e instanceof Error ? e.message : String(e) };
  }
}

/** Répare un PDF avec qpdf (puis Ghostscript en dernier recours). Renvoie le chemin réparé ou null. */
export async function reparer(abs: string, sortie: string): Promise<{ chemin: string; outil: string } | null> {
  if (await qpdfPresent()) {
    try {
      // Code 3 = réussi avec avertissements (fichier réparé) : accepté.
      await exec('qpdf', ['--object-streams=generate', '--compress-streams=y', abs, sortie], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 }).catch((e: { code?: number }) => {
        if (e.code !== 3) throw e;
      });
      if ((await lisible(sortie)).ok) return { chemin: sortie, outil: 'qpdf' };
    } catch {
      /* Ghostscript ensuite */
    }
  }
  if (await gsPresent()) {
    try {
      await gsBas(['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', '-dPDFSETTINGS=/prepress', `-sOutputFile=${sortie}`, abs], { timeout: 600000, maxBuffer: 4 * 1024 * 1024 });
      if ((await lisible(sortie)).ok) return { chemin: sortie, outil: 'ghostscript' };
    } catch {
      /* irréparable */
    }
  }
  return null;
}

/** Polices non incorporées (pdffonts de Poppler), pour avertir avant l'impression. */
async function policesNonIncorporees(abs: string): Promise<string[]> {
  try {
    const { stdout } = await exec('pdffonts', [abs], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    return stdout
      .split('\n')
      .slice(2)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => / no +(yes|no) +(yes|no) +\d+ +\d+$/.test(l) || /\s(no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+$/.test(l))
      .map((l) => l.split(/\s+/)[0]!)
      .slice(0, 10);
  } catch {
    return [];
  }
}

/** Plus petite résolution d'image (pdfimages -list de Poppler). */
async function dpiMin(abs: string): Promise<number | null> {
  try {
    const { stdout } = await exec('pdfimages', ['-list', abs], { timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    const lignes = stdout.split('\n').slice(2).filter(Boolean);
    let min: number | null = null;
    for (const l of lignes) {
      const c = l.trim().split(/\s+/);
      // page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
      const type = c[2];
      const w = Number(c[3]);
      const xppi = Number(c[12]);
      const yppi = Number(c[13]);
      if (type !== 'image' || !(w > 32)) continue;
      const v = Math.min(xppi, yppi);
      if (Number.isFinite(v) && v > 0) min = min === null ? v : Math.min(min, v);
    }
    return min;
  } catch {
    return null;
  }
}

/**
 * Traitement complet d'un PDF : contrôle, réparation si besoin, optimisation prépresse.
 * `destination` : chemin où écrire la version traitée si elle est retenue.
 */
export async function traiterPdf(abs: string, destination: string): Promise<{ rapport: RapportTraitement; chemin: string | null }> {
  const debut = Date.now();
  const tailleAvant = (await fs.promises.stat(abs)).size;
  const temp = path.join(os.tmpdir(), `evocom-traitement-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  await fs.promises.mkdir(temp, { recursive: true });
  const outils: string[] = [];
  const avertissements: string[] = [];
  const rapport = (r: Partial<RapportTraitement> & Pick<RapportTraitement, 'statut'>): RapportTraitement => ({
    outils,
    repare: false,
    taille_avant: tailleAvant,
    taille_apres: null,
    pages: null,
    polices_non_incorporees: [],
    dpi_min: null,
    avertissements,
    duree_ms: Date.now() - debut,
    fait_le: new Date().toISOString(),
    ...r,
  });
  try {
    if (!(await qpdfPresent()) && !(await gsPresent())) return { rapport: rapport({ statut: 'ignore', avertissements: ['Outils de traitement absents du serveur (ghostscript, qpdf).'] }), chemin: null };

    // 1. Lisible ? Sinon réparation.
    let source = abs;
    let repare = false;
    const l = await lisible(abs);
    if (!l.ok) {
      const r = await reparer(abs, path.join(temp, 'repare.pdf'));
      if (!r) return { rapport: rapport({ statut: 'illisible', avertissements: [`PDF illisible et irréparable (${(l.erreur ?? '').slice(0, 120)}) : demandez au client un nouvel export.`] }), chemin: null };
      outils.push(r.outil);
      source = r.chemin;
      repare = true;
    }

    // 2. Contrôles qualité (sur la source lisible).
    const [polices, dpi] = await Promise.all([policesNonIncorporees(source), dpiMin(source)]);
    if (polices.length) avertissements.push(`Polices non incorporées : ${polices.join(', ')}. Ghostscript les remplace si possible ; vérifiez le rendu du texte.`);
    if (dpi !== null && dpi < 200) avertissements.push(`Une image est à ${dpi} ppp : risque de flou à l'impression (300 ppp conseillés).`);

    // 3. Optimisation prépresse (Ghostscript) : polices incorporées, images ≥ 300 ppp, compression.
    let candidat: string | null = repare ? source : null;
    if (await gsPresent()) {
      const sortie = path.join(temp, 'optimise.pdf');
      try {
        await gsBas(
          [
            '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.6',
            '-dPDFSETTINGS=/prepress',
            '-dEmbedAllFonts=true', '-dSubsetFonts=true', '-dCompressFonts=true',
            '-dAutoRotatePages=/None',
            '-dDetectDuplicateImages=true',
            // Images : jamais sous 300 ppp ; seulement réduites au-dessus de 450 ppp.
            '-dDownsampleColorImages=true', '-dColorImageResolution=300', '-dColorImageDownsampleThreshold=1.5', '-dColorImageDownsampleType=/Bicubic',
            '-dDownsampleGrayImages=true', '-dGrayImageResolution=300', '-dGrayImageDownsampleThreshold=1.5', '-dGrayImageDownsampleType=/Bicubic',
            '-dDownsampleMonoImages=true', '-dMonoImageResolution=1200', '-dMonoImageDownsampleThreshold=1.5',
            '-dPassThroughJPEGImages=true',
            '-sColorConversionStrategy=LeaveColorUnchanged',
            `-sOutputFile=${sortie}`,
            source,
          ],
          { timeout: 900000, maxBuffer: 8 * 1024 * 1024 },
        );
        outils.push('ghostscript');
        if ((await lisible(sortie)).ok) candidat = sortie;
      } catch (e) {
        avertissements.push(`Optimisation Ghostscript impossible : ${(e instanceof Error ? e.message : String(e)).split('\n')[0]!.slice(0, 120)}`);
      }
    }
    // 4. Compactage sans perte (qpdf) de ce qui a été retenu.
    if (candidat && (await qpdfPresent())) {
      const compact = path.join(temp, 'compact.pdf');
      try {
        await exec('qpdf', ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', candidat, compact], { timeout: 180000 }).catch((e: { code?: number }) => {
          if (e.code !== 3) throw e;
        });
        if ((await fs.promises.stat(compact)).size < (await fs.promises.stat(candidat)).size && (await lisible(compact)).ok) {
          candidat = compact;
          if (!outils.includes('qpdf')) outils.push('qpdf');
        }
      } catch {
        /* on garde candidat */
      }
    }

    // 5. On garde la version traitée si elle est réparée, ou au moins 5 % plus légère.
    const lu = await lisible(candidat ?? abs);
    if (candidat) {
      const tailleApres = (await fs.promises.stat(candidat)).size;
      if (repare || tailleApres < tailleAvant * 0.95) {
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.copyFile(candidat, destination);
        return {
          rapport: rapport({ statut: repare ? 'repare' : 'optimise', repare, taille_apres: tailleApres, pages: lu.pages, polices_non_incorporees: polices, dpi_min: dpi }),
          chemin: destination,
        };
      }
    }
    return { rapport: rapport({ statut: 'inchange', pages: lu.pages, polices_non_incorporees: polices, dpi_min: dpi }), chemin: null };
  } catch (e) {
    return { rapport: rapport({ statut: 'erreur', avertissements: [...avertissements, (e instanceof Error ? e.message : String(e)).slice(0, 200)] }), chemin: null };
  } finally {
    await fs.promises.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}
