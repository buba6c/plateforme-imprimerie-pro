// Fichiers de l'ancienne plateforme : inventaire des dossiers d'uploads, résolution du fichier
// physique d'une ligne `fichiers` (les chemins en base ne correspondent pas toujours au disque),
// copie en flux avec calcul du SHA-256. Les sources ne sont JAMAIS déplacées ni modifiées.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { aHorodatage, estUuid } from './normalize';

interface EntreeDisque {
  reel: string;
  taille: number;
  racine: string;
}

/** Inventaire de tous les fichiers sous les racines d'uploads (une seule lecture du disque). */
export class IndexDisque {
  /** Chemin absolu normalisé NFC → fichier réel. */
  readonly fichiers = new Map<string, EntreeDisque>();
  /** Nom de fichier (NFC) → chemins absolus normalisés. */
  private parNom = new Map<string, string[]>();
  readonly utilises = new Set<string>();
  octetsTotal = 0;

  constructor(readonly racines: string[]) {}

  static async construire(racines: string[], progression?: (n: number) => void): Promise<IndexDisque> {
    const reelles: string[] = [];
    for (const r of racines) {
      const abs = path.resolve(r);
      const st = await fs.promises.stat(abs).catch(() => null);
      if (!st?.isDirectory()) throw new Error(`Dossier d'uploads introuvable : ${abs}`);
      const reel = await fs.promises.realpath(abs);
      if (!reelles.includes(reel)) reelles.push(reel);
    }
    const index = new IndexDisque(reelles);
    const vus = new Set<string>();
    for (const racine of reelles) await index.parcourir(racine, racine, vus, progression);
    return index;
  }

  private async parcourir(dir: string, racine: string, vus: Set<string>, progression?: (n: number) => void) {
    const reel = await fs.promises.realpath(dir).catch(() => dir);
    if (vus.has(reel)) return; // racines imbriquées ou lien symbolique en boucle
    vus.add(reel);
    const d = await fs.promises.opendir(dir).catch(() => null);
    if (!d) return;
    for await (const e of d) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await this.parcourir(abs, racine, vus, progression);
      } else if (e.isFile() || e.isSymbolicLink()) {
        // Un lien symbolique vers un répertoire n'est pas suivi (risque de boucle) ; vers un fichier, il l'est.
        const st = await fs.promises.stat(abs).catch(() => null);
        if (!st?.isFile()) continue;
        const cle = abs.normalize('NFC');
        if (this.fichiers.has(cle)) continue;
        this.fichiers.set(cle, { reel: abs, taille: st.size, racine });
        this.octetsTotal += st.size;
        const nom = path.basename(cle);
        const l = this.parNom.get(nom);
        if (l) l.push(cle);
        else this.parNom.set(nom, [cle]);
        if (progression && this.fichiers.size % 5000 === 0) progression(this.fichiers.size);
      }
    }
  }

  trouver(p: string): EntreeDisque | null {
    return this.fichiers.get(path.resolve(p).normalize('NFC')) ?? null;
  }

  cle(e: EntreeDisque): string {
    return e.reel.normalize('NFC');
  }

  parNomFichier(nom: string): string[] {
    return this.parNom.get(nom.normalize('NFC')) ?? [];
  }

  /** Chemin réel complet (pour le rapport : plusieurs racines peuvent s'appeler « uploads »). */
  relatif(cle: string): string {
    return this.fichiers.get(cle)?.reel ?? cle;
  }

  orphelins(): { cle: string; entree: EntreeDisque }[] {
    const out: { cle: string; entree: EntreeDisque }[] = [];
    for (const [cle, entree] of this.fichiers) if (!this.utilises.has(cle)) out.push({ cle, entree });
    return out.sort((a, b) => a.cle.localeCompare(b.cle));
  }
}

export function categorieOrphelin(chemin: string): string {
  const c = chemin.replace(/\\/g, '/').toLowerCase();
  if (c.includes('temp-chunks') || c.includes('/tmp/') || c.includes('/chunks/') || c.includes('/tus/')) return 'morceau d’envoi temporaire';
  if (/\/factures\/|\/devis\//.test(c)) return 'PDF généré (factures/devis, régénéré par v2)';
  if (c.includes('/config/')) return 'configuration';
  return 'sans ligne en base';
}

export interface LigneFichier {
  legacyId: number | null;
  dossierLegacyId: number | null;
  folderId: string | null;
  chemins: string[];
  noms: string[];
}

export interface Resolution {
  src: string | null;
  cle: string | null;
  taille: number;
  regle: string | null;
  raison: string | null;
}

/**
 * Trouve le fichier physique d'une ligne `fichiers`. Ordre des essais :
 *   1. chemin en base (chemin_stockage, chemin, file_path, filepath), absolu ou relatif à chaque racine
 *      et au parent de chaque racine ;
 *   2. partie du chemin après « uploads/ », sous chaque racine ;
 *   3. <racine>/dossiers/<id du dossier>/<nom> ;
 *   4. <racine>/dossiers/<folder_id>/<nom> ;
 *   5. recherche par nom sous toutes les racines, uniquement si la correspondance est unique
 *      (nom horodaté, ou nom rangé dans un répertoire au numéro / folder_id du dossier).
 */
export function resoudre(index: IndexDisque, l: LigneFichier): Resolution {
  const essayer = (p: string, regle: string): Resolution | null => {
    const e = index.trouver(p);
    if (e) return { src: e.reel, cle: index.cle(e), taille: e.taille, regle, raison: null };
    return null;
  };
  // Seuls les fichiers situés sous les racines d'uploads sont lus : un chemin absolu en base qui pointe
  // ailleurs (valeur corrompue, autre serveur) n'est jamais copié, il est signalé.
  let horsRacines: string | null = null;
  const viaLienSymbolique = (p: string, regle: string): Resolution | null => {
    try {
      const reel = fs.realpathSync(p);
      const r = essayer(reel, regle);
      if (r) return r;
      if (fs.statSync(reel).isFile()) horsRacines ??= p;
    } catch {
      /* absent */
    }
    return null;
  };

  // 1. Chemin en base.
  for (const c of l.chemins) {
    const p = c.replace(/\\/g, '/');
    if (path.isAbsolute(p)) {
      const r = essayer(p, 'chemin_bd') ?? viaLienSymbolique(p, 'chemin_bd');
      if (r) return r;
    }
    const rel = p.replace(/^\/+/, '');
    for (const racine of index.racines) {
      const r = essayer(path.join(racine, rel), 'chemin_bd') ?? essayer(path.join(path.dirname(racine), rel), 'chemin_bd');
      if (r) return r;
    }
  }
  // 2. Suffixe après « uploads/ ».
  for (const c of l.chemins) {
    const p = c.replace(/\\/g, '/');
    const i = p.search(/(^|\/)uploads\//);
    if (i < 0) continue;
    const queue = p.slice(p.indexOf('uploads/', i) + 'uploads/'.length);
    for (const racine of index.racines) {
      const r = essayer(path.join(racine, queue), 'suffixe_uploads');
      if (r) return r;
    }
  }
  const noms = [...new Set(l.noms.filter((n) => n && !n.includes('/') && !n.includes('\\')))];
  // 3 et 4. Répertoire du dossier (id entier puis folder_id).
  const reps: [string, string][] = [];
  if (l.dossierLegacyId !== null) reps.push([String(l.dossierLegacyId), 'dossier_id']);
  if (l.folderId && estUuid(l.folderId)) reps.push([l.folderId, 'folder_id']);
  for (const [rep, regle] of reps) {
    for (const racine of index.racines) {
      for (const n of noms) {
        const r = essayer(path.join(racine, 'dossiers', rep, n), regle) ?? essayer(path.join(racine, rep, n), regle);
        if (r) return r;
      }
    }
  }
  // 5. Recherche par nom (correspondance unique seulement).
  let raison = horsRacines
    ? `présent hors des dossiers d'uploads indiqués (${horsRacines}) : non lu ; ajoutez son dossier avec --uploads si ce fichier doit être repris`
    : 'introuvable sur le disque';
  for (const n of noms) {
    const trouves = index.parNomFichier(n).filter((cle) => !index.utilises.has(cle));
    if (trouves.length === 0) continue;
    const dansRepDossier = trouves.filter((cle) => {
      const e = index.fichiers.get(cle)!;
      const segs = path.relative(e.racine, e.reel).split(path.sep).slice(0, -1);
      return reps.some(([rep]) => segs.includes(rep));
    });
    let choix: string | null = null;
    if (dansRepDossier.length === 1) choix = dansRepDossier[0]!;
    else if (dansRepDossier.length === 0 && trouves.length === 1 && aHorodatage(n)) choix = trouves[0]!;
    if (choix) {
      const e = index.fichiers.get(choix)!;
      return { src: e.reel, cle: choix, taille: e.taille, regle: 'recherche_nom', raison: null };
    }
    raison =
      trouves.length > 1
        ? `introuvable à l'emplacement attendu ; ${trouves.length} fichiers portent le nom « ${n} » ailleurs, aucun n'a été choisi`
        : `introuvable à l'emplacement attendu ; un fichier « ${n} » existe ailleurs (${index.relatif(trouves[0]!)}) mais le nom n'est pas assez distinctif pour le rattacher`;
  }
  return { src: null, cle: null, taille: 0, regle: null, raison };
}

/** Copie en flux (jamais d'écrasement) et calcule taille + SHA-256 du contenu réellement copié. */
export async function copierAvecEmpreinte(src: string, dest: string): Promise<{ taille: number; sha256: string }> {
  const hash = crypto.createHash('sha256');
  let taille = 0;
  const compteur = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      taille += chunk.length;
      cb(null, chunk);
    },
  });
  await pipeline(fs.createReadStream(src, { highWaterMark: 1024 * 1024 }), compteur, fs.createWriteStream(dest, { flags: 'wx' }));
  const st = await fs.promises.stat(src).catch(() => null);
  if (st) await fs.promises.utimes(dest, st.atime, st.mtime).catch(() => {});
  return { taille, sha256: hash.digest('hex') };
}

/**
 * Lien dur vers le fichier d'origine : aucune place en plus sur le disque, le fichier source n'est ni
 * déplacé ni modifié (supprimer l'un des deux noms laisse l'autre intact). Taille + SHA-256 lus sur le
 * contenu lié. Si le lien est impossible (autre disque, système de fichiers sans liens), copie normale.
 */
export async function lierAvecEmpreinte(src: string, dest: string): Promise<{ taille: number; sha256: string; lie: boolean }> {
  try {
    await fs.promises.link(src, dest);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EXDEV' || e.code === 'EPERM' || e.code === 'EMLINK' || e.code === 'ENOTSUP') {
      return { ...(await copierAvecEmpreinte(src, dest)), lie: false };
    }
    // Comme pour la copie : e.path = src signale un fichier source introuvable, sinon l'erreur vient de la destination.
    const sourceLisible = await fs.promises.access(src, fs.constants.R_OK).then(
      () => true,
      () => false,
    );
    if (sourceLisible) e.path = dest;
    throw e;
  }
  const hash = crypto.createHash('sha256');
  let taille = 0;
  for await (const chunk of fs.createReadStream(dest, { highWaterMark: 1024 * 1024 })) {
    hash.update(chunk as Buffer);
    taille += (chunk as Buffer).length;
  }
  return { taille, sha256: hash.digest('hex'), lie: true };
}

/** Périphérique (disque) qui porte `dir`, ou celui de son premier parent existant. */
export async function peripherique(dir: string): Promise<number | null> {
  let d = path.resolve(dir);
  while (!fs.existsSync(d)) {
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
  return fs.promises.stat(d).then(
    (s) => s.dev,
    () => null,
  );
}

/** Garde la trace des fichiers copiés pour pouvoir tout retirer si l'import est annulé. */
export class SuiviCopies {
  private fichiers: string[] = [];
  private repertoires = new Set<string>();

  constructor(private stockage: string) {}

  async preparerRepertoire(dir: string) {
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
      this.repertoires.add(dir);
    }
  }

  ajouter(f: string) {
    this.fichiers.push(f);
  }

  get nombre() {
    return this.fichiers.length;
  }

  async annuler(): Promise<number> {
    let n = 0;
    for (const f of this.fichiers) {
      await fs.promises.rm(f, { force: true }).catch(() => {});
      n++;
    }
    const reps = [...this.repertoires].sort((a, b) => b.length - a.length);
    for (const d of reps) await fs.promises.rmdir(d).catch(() => {});
    const racine = path.join(this.stockage, 'dossiers');
    await fs.promises.rmdir(racine).catch(() => {});
    this.fichiers = [];
    this.repertoires.clear();
    return n;
  }
}

/** Liste récursive des fichiers d'un répertoire (chemins relatifs). */
export async function listerRecursif(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  const d = await fs.promises.opendir(dir).catch(() => null);
  if (!d) return out;
  for await (const e of d) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listerRecursif(abs, base)));
    else if (e.isFile()) out.push(path.relative(base, abs));
  }
  return out;
}

/** Exécute fn sur chaque élément avec au plus n tâches simultanées. */
export async function enParallele<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  let erreur: unknown = null;
  const travailleurs = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length && erreur === null) {
      const item = items[i++]!;
      try {
        await fn(item);
      } catch (e) {
        erreur ??= e;
      }
    }
  });
  // On attend que toutes les tâches en cours soient terminées avant de propager l'erreur :
  // aucune copie ne doit continuer pendant le nettoyage.
  await Promise.all(travailleurs);
  if (erreur !== null) throw erreur;
}
