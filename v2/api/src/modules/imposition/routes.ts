// Imposition et préparation des fichiers d'impression (administrateur et préparateurs) : analyse d'un
// PDF du dossier, plan (positions, sans générer), génération du PDF imposé enregistré comme nouveau
// fichier du dossier, et proposition de plan par l'assistant IA. Le fichier source n'est jamais modifié.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../../config';
import { one, query, tx } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, HttpError, notFound, zodDetails } from '../../lib/errors';
import { signalDossier } from '../../realtime';
import type { AuthUser } from '../../types';
import { cheminSous } from '../commun/disque';
import { chargerDossier, evenement, peutDeposer, resumeSpecs, libellesTarifs } from '../dossiers/service';
import { peutVoirFichiers } from '../dossiers/access';
import { apercu, ApercuIndisponible, genreApercu, popplerPresent } from '../fichiers/apercu';
import { gsPresent, qpdfPresent } from '../traitement/outils';
import { contentDisposition } from '../fichiers/routes';
import { ErreurIA, type StatutAppel } from '../ia/erreurs';
import { appelerAvecSecours, type TentativeIA } from '../ia/fournisseurs';
import { accesIA, noterTentativesIA, noterUsageIA } from '../ia/routes';
import { analyserPdf, type AnalysePdf } from './analyse';
import { planifierTraitement } from '../traitement/file';
import { assembler, type Assemblage, type FichierPiece, type PieceEntree } from './sources';
import { CODES_FEUILLE, FEUILLES, FORMATS_FINIS, type Feuille } from './formats';
import { genererPdf } from './generer';
import { calculerPlan, paramsParDefaut, type ParamsImposition } from './plan';

const dim = z.object({ largeur: z.number().positive().max(2000), hauteur: z.number().positive().max(2000) });
const numerotationSchema = z.object({
  debut: z.number().int().min(0).max(9_999_999),
  chiffres: z.number().int().min(1).max(8),
  prefixe: z.string().max(12).default(''),
  position: z.enum(['bas_droite', 'bas_gauche', 'haut_droite', 'haut_gauche', 'bas_centre']).default('bas_droite'),
  taille_pt: z.number().min(6).max(72).default(12),
  verso: z.boolean().default(false),
});
export const paramsSchema = z.object({
  operation: z.enum(['poses', 'livret', 'fonds_perdus', 'assembler']),
  feuille: z.enum(CODES_FEUILLE as unknown as [Feuille, ...Feuille[]]),
  feuille_personnalisee: dim.optional(),
  orientation: z.enum(['auto', 'portrait', 'paysage']).default('auto'),
  fini: dim,
  fonds_perdus_mm: z.number().min(0).max(20).default(3),
  methode_fonds_perdus: z.enum(['source', 'intelligent', 'prolonger', 'miroir', 'etirer', 'blanc']).default('source'),
  gouttiere_mm: z.number().min(0).max(50).default(0),
  marge_mm: z.number().min(0).max(100).default(10),
  traits_de_coupe: z.boolean().default(true),
  recto_verso: z.boolean().default(false),
  retournement: z.enum(['bord_long', 'bord_court']).default('bord_long'),
  mode: z.enum(['repetition', 'sequence', 'coupe_empile']).default('repetition'),
  quantite: z.number().int().positive().max(100_000).optional(),
  numerotation: numerotationSchema.nullable().optional(),
  ajustement: z.enum(['centrer', 'adapter', 'remplir']).default('centrer'),
  chasse_mm: z.number().min(0).max(10).optional(),
  blanches: z.enum(['fin', 'avant_derniere']).default('fin'),
  reliure: z.enum(['piqure', 'dos_carre']).optional(),
  cahier_feuilles: z.number().int().min(1).max(16).optional(),
  couverture_separee: z.boolean().optional(),
  lecture: z.enum(['gauche_droite', 'droite_gauche']).optional(),
});

type FichierRow = { id: number; dossier_id: number; nom_original: string; chemin: string; chemin_traite: string | null; mime: string | null; taille: number; sha256: string | null };

async function fichierVisible(user: AuthUser, fichierId: number): Promise<{ f: FichierRow; abs: string }> {
  if (!peutVoirFichiers(user)) throw new HttpError(403, 'Vous ne pouvez pas accéder aux fichiers.');
  const f = await one<FichierRow>(`SELECT id, dossier_id, nom_original, chemin, chemin_traite, mime, taille, sha256 FROM fichiers WHERE id = $1 AND deleted_at IS NULL AND purge_at IS NULL`, [fichierId]);
  if (!f) throw notFound('Fichier introuvable.');
  await chargerDossier(user, f.dossier_id); // 404 si le dossier n'est pas visible
  if (genreApercu(f) === null) throw badRequest(`« ${f.nom_original} » n'est ni un PDF ni une image : il ne peut pas être imposé.`);
  return { f, abs: '' };
}

const JETON_RE = /^[a-f0-9]{32}$/;
const pieceSchema = z
  .object({
    fichier_id: z.number().int().positive().optional(),
    /** Fichier libre (déposé sans dossier) : jeton rendu par POST /imposition/libre. */
    libre: z.string().regex(JETON_RE, 'Jeton de fichier invalide').optional(),
    role: z.enum(['recto', 'verso', 'pages']).default('pages'),
    pages: z.array(z.number().int().positive()).max(500).optional(),
  })
  .refine((p) => (p.fichier_id !== undefined) !== (p.libre !== undefined), { message: 'Indiquez un fichier du dossier ou un fichier libre' });

/** Id interne stable d'un fichier libre : négatif, dérivé du jeton (jamais confondu avec un fichier du dossier). */
const idLibre = (jeton: string) => -(parseInt(jeton.slice(0, 12), 16) % 2_000_000_000) - 1;
const piecesSchema = z.array(pieceSchema).min(1, 'Choisissez au moins un fichier').max(20, '20 fichiers au plus');

/** `pieces` ou, pour compatibilité, `fichier_id` seul. */
function lirePieces(body: Record<string, unknown>): PieceEntree[] {
  if (Array.isArray(body.pieces)) {
    const r = piecesSchema.safeParse(body.pieces);
    if (!r.success) throw badRequest('Pièces invalides.', { champs: zodDetails(r.error) });
    return r.data.map((p) => ({ fichier_id: p.fichier_id ?? idLibre(p.libre!), libre: p.libre, role: p.role, pages: p.pages }));
  }
  const r = z.object({ fichier_id: z.number({ required_error: 'Choisissez un fichier' }).int().positive() }).safeParse(body);
  if (!r.success) throw badRequest('Choisissez un fichier.', { champs: zodDetails(r.error) });
  return [{ fichier_id: r.data.fichier_id, role: 'pages' }];
}

// Analyses gardées en mémoire (par empreinte) : relire un PDF de 300 Mo à chaque réglage serait trop long.
const cacheAnalyses = new Map<string, { at: number; analyse: AnalysePdf }>();
const CACHE_MS = 15 * 60_000;

export interface PieceAnalysee {
  fichier_id: number;
  libre?: string;
  nom: string;
  genre: 'pdf' | 'image';
  taille: number;
  pages: number;
  largeur: number | null;
  hauteur: number | null;
  format: AnalysePdf['format'];
  fonds_perdus: AnalysePdf['fonds_perdus'] | null;
  avertissements: string[];
}

export function impositionRouter(config: Config) {
  const router = Router();
  const racine = path.resolve(config.storageDir);
  router.use(requireAuth, requireRole('admin', 'preparateur'));

  const resoudre = (f: FichierRow) => {
    // La version traitée (réparée, optimisée) si elle existe, sinon l'original.
    const traite = f.chemin_traite ? cheminSous(racine, f.chemin_traite) : null;
    if (traite && fs.existsSync(traite)) return traite;
    const abs = cheminSous(racine, f.chemin);
    if (!abs || !fs.existsSync(abs)) throw notFound('Le fichier n’est plus sur le serveur.');
    return abs;
  };

  const tempDir = path.join(racine, 'tus', 'imposition');
  const libreDir = path.join(tempDir, 'libre');
  const LIBRE_TTL_MS = 6 * 3600_000;

  // ---------------------------------------------------------------------------
  // Fichiers libres : déposés sans dossier, gardés six heures, imposés puis téléchargés.

  interface FichierLibre {
    jeton: string;
    nom: string;
    mime: string;
    taille: number;
    chemin: string;
    user_id: number;
    genre: 'pdf' | 'image' | 'resultat';
  }
  const libres = new Map<string, FichierLibre>();

  async function lireLibre(jeton: string, user: AuthUser): Promise<FichierLibre> {
    let l = libres.get(jeton);
    if (!l) {
      // Après un redémarrage : le fichier et son descripteur sont encore sur le disque.
      const meta = await fs.promises.readFile(path.join(libreDir, `${jeton}.json`), 'utf8').catch(() => null);
      if (meta) {
        l = JSON.parse(meta) as FichierLibre;
        libres.set(jeton, l);
      }
    }
    if (!l || !fs.existsSync(l.chemin)) throw notFound('Ce fichier déposé a expiré (6 heures) : déposez-le de nouveau.');
    if (l.user_id !== user.id && user.role !== 'admin') throw new HttpError(403, 'Ce fichier a été déposé par quelqu’un d’autre.');
    return l;
  }

  async function nettoyerLibres() {
    const entrees = await fs.promises.readdir(libreDir).catch(() => [] as string[]);
    const limite = Date.now() - LIBRE_TTL_MS;
    for (const e of entrees) {
      const abs = path.join(libreDir, e);
      const st = await fs.promises.stat(abs).catch(() => null);
      if (st && st.isFile() && st.mtimeMs < limite) {
        await fs.promises.rm(abs, { force: true }).catch(() => {});
        libres.delete(e.replace(/\..*$/, ''));
      }
    }
  }

  const EXT_RE = /\.(pdf|ai|png|jpe?g|webp|tiff?|gif|heic|heif)$/i;

  router.post('/libre', express.raw({ type: () => true, limit: '300mb' }), async (req, res) => {
    const user = me(req);
    const nom = String(req.query.nom ?? '').trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'fichier';
    const corps = req.body as Buffer;
    if (!Buffer.isBuffer(corps) || corps.length === 0) throw badRequest('Fichier vide.');
    if (!EXT_RE.test(nom)) throw badRequest('Déposez un PDF ou une image (PNG, JPEG, WebP, TIFF).');
    const mime = String(req.headers['content-type'] ?? '').split(';')[0] || 'application/octet-stream';
    const genre = genreApercu({ mime, nom_original: nom });
    if (!genre) throw badRequest('Déposez un PDF ou une image (PNG, JPEG, WebP, TIFF).');
    const jeton = crypto.randomBytes(16).toString('hex');
    await fs.promises.mkdir(libreDir, { recursive: true });
    const chemin = path.join(libreDir, `${jeton}${path.extname(nom).toLowerCase()}`);
    await fs.promises.writeFile(chemin, corps);
    const l: FichierLibre = { jeton, nom, mime, taille: corps.length, chemin, user_id: user.id, genre };
    libres.set(jeton, l);
    await fs.promises.writeFile(path.join(libreDir, `${jeton}.json`), JSON.stringify(l));
    void nettoyerLibres().catch(() => {});
    res.status(201).json({ libre: jeton, nom, taille: corps.length, mime, genre });
  });

  router.get('/libre/:jeton/apercu', async (req, res) => {
    const jeton = String(req.params.jeton);
    if (!JETON_RE.test(jeton)) throw notFound('Fichier introuvable.');
    const l = await lireLibre(jeton, me(req));
    const genre = l.genre === 'resultat' ? 'pdf' : l.genre;
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), 5000);
    const largeur = Math.min(Math.max(Math.round(Number(req.query.largeur) || 480), 80), 2000);
    try {
      const image = await apercu(racine, l.chemin, genre, page, largeur);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(image, { headers: { 'Content-Type': 'image/webp' } });
    } catch (e) {
      if (e instanceof ApercuIndisponible) throw new HttpError(501, 'Les miniatures PDF ne sont pas disponibles sur ce serveur.', undefined, 'apercu_indisponible');
      throw new HttpError(422, (e as Error).message, undefined, 'apercu_impossible');
    }
  });

  /** Ajoute un fichier libre (le PDF généré sans dossier) à un dossier existant. */
  router.post('/libre/:jeton/rattacher', async (req, res) => {
    const jeton = String(req.params.jeton);
    if (!JETON_RE.test(jeton)) throw notFound('Fichier introuvable.');
    const user = me(req);
    const l = await lireLibre(jeton, user);
    const r = z.object({ dossier_id: z.number({ required_error: 'Choisissez un dossier' }).int().positive() }).safeParse(req.body ?? {});
    if (!r.success) throw badRequest('Choisissez un dossier.', { champs: zodDetails(r.error) });
    const d = await chargerDossier(user, r.data.dossier_id);
    if (!peutDeposer(user, d)) throw new HttpError(403, 'Ce dossier n’accepte plus de nouveaux fichiers (validé, livré ou annulé) : demandez son retour en préparation.');
    const octets = await fs.promises.readFile(l.chemin);
    const id = crypto.randomUUID();
    const rel = path.join('dossiers', String(d.id), `${id}-${l.nom}`);
    const dest = path.join(racine, rel);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, octets);
    const sha = crypto.createHash('sha256').update(octets).digest('hex');
    const mime = l.genre === 'image' ? l.mime : 'application/pdf';
    const nouveau = await tx(async (db) => {
      const row = await one<{ id: number }>(
        `INSERT INTO fichiers (dossier_id, nom_original, chemin, mime, taille, sha256, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [d.id, l.nom, rel, mime, octets.byteLength, sha, user.id],
        db,
      );
      await evenement(db, d.id, user.id, { type: 'fichier', action: l.genre === 'resultat' ? 'imposition' : 'ajout', data: { fichier_id: row!.id, nom: l.nom, taille: octets.byteLength, rattache: true } });
      await journal(req, 'fichier_rattache', 'fichier', row!.id, { dossier_id: d.id, nom: l.nom }, db);
      return row!.id;
    }).catch(async (e) => {
      await fs.promises.rm(dest, { force: true });
      throw e;
    });
    signalDossier({ ...d, ancien_statut: d.statut });
    planifierTraitement(nouveau);
    res.status(201).json({ fichier: { id: nouveau, nom: l.nom, taille: octets.byteLength, dossier_id: d.id }, dossier: { id: d.id, numero: d.numero, client_nom: d.client_nom } });
  });

  router.get('/libre/:jeton/contenu', async (req, res) => {
    const jeton = String(req.params.jeton);
    if (!JETON_RE.test(jeton)) throw notFound('Fichier introuvable.');
    const l = await lireLibre(jeton, me(req));
    res.setHeader('Content-Disposition', contentDisposition(req.query.telecharger ? 'attachment' : 'inline', l.nom));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(l.chemin, { headers: { 'Content-Type': l.genre === 'image' ? l.mime : 'application/pdf' } });
  });

  async function analyseFichier(cle: string, abs: string): Promise<AnalysePdf> {
    const c = cacheAnalyses.get(cle);
    if (c && Date.now() - c.at < CACHE_MS) return c.analyse;
    let a: AnalysePdf;
    try {
      a = await analyserPdf(abs);
    } catch (e) {
      throw badRequest(`Ce PDF n’a pas pu être lu : ${e instanceof Error ? e.message : 'fichier illisible'}. Demandez un export PDF standard (sans mot de passe).`);
    }
    cacheAnalyses.set(cle, { at: Date.now(), analyse: a });
    if (cacheAnalyses.size > 200) {
      const plusVieux = [...cacheAnalyses.entries()].sort((x, y) => x[1].at - y[1].at).slice(0, 50);
      for (const [k] of plusVieux) cacheAnalyses.delete(k);
    }
    return a;
  }

  /** Charge les fichiers des pièces (droits vérifiés), assemble le document de travail et l'analyse. */
  async function preparer(user: AuthUser, pieces: PieceEntree[], fini?: { largeur: number; hauteur: number }, fonds?: number) {
    const fichiers: FichierPiece[] = [];
    let dossierId: number | null = null;
    for (const p of pieces) {
      if (p.libre) {
        const l = await lireLibre(p.libre, user);
        if (l.genre === 'resultat') throw badRequest('Un résultat d’imposition ne peut pas être réimposé : déposez le fichier d’origine.');
        fichiers.push({ id: p.fichier_id, libre: p.libre, nom_original: l.nom, mime: l.mime, taille: l.taille, sha256: null, abs: l.chemin });
        continue;
      }
      const { f } = await fichierVisible(user, p.fichier_id);
      if (dossierId === null) dossierId = f.dossier_id;
      fichiers.push({ id: f.id, nom_original: f.nom_original, mime: f.mime, taille: f.taille, sha256: f.sha256, abs: resoudre(f) });
    }
    let assemblage: Assemblage;
    try {
      assemblage = await assembler(pieces, fichiers, tempDir, fini, fonds);
    } catch (e) {
      throw badRequest(`Les fichiers n’ont pas pu être assemblés : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
    assemblage.dossier_id = dossierId ?? 0;
    const analyse = await analyseFichier(`assemblage|${assemblage.signature}`, assemblage.chemin);
    return { fichiers, assemblage, analyse, dossierId };
  }

  /** Analyse de chaque pièce, pour le panneau des pièces (format, fonds perdus, pages). */
  async function analyserPieces(fichiers: FichierPiece[]): Promise<PieceAnalysee[]> {
    const out: PieceAnalysee[] = [];
    for (const f of fichiers) {
      const genre = genreApercu(f);
      if (genre === 'pdf') {
        const a = await analyseFichier(`${f.id}|${f.sha256 ?? f.taille}`, f.abs);
        out.push({ fichier_id: f.id, libre: f.libre, nom: f.nom_original, genre: 'pdf', taille: f.taille, pages: a.nb_pages, largeur: a.largeur, hauteur: a.hauteur, format: a.format, fonds_perdus: a.fonds_perdus, avertissements: a.avertissements });
      } else {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(f.abs, { limitInputPixels: 400_000_000 }).rotate().metadata().catch(() => null);
        const d = meta?.density && meta.density >= 50 ? meta.density : null;
        const w = meta?.width && d ? Math.round(((meta.width / d) * 25.4) * 10) / 10 : null;
        const h = meta?.height && d ? Math.round(((meta.height / d) * 25.4) * 10) / 10 : null;
        const av: string[] = [];
        if (!d) av.push('Résolution inconnue : l’image sera ajustée au format fini choisi (vérifiez qu’elle est assez définie, 300 dpi conseillés).');
        else if (d < 200) av.push(`Résolution ${Math.round(d)} dpi : risque de flou à l’impression (300 dpi conseillés).`);
        const { detecterFormat } = await import('./formats');
        const format = w && h ? detecterFormat(w, h) : null;
        out.push({ fichier_id: f.id, libre: f.libre, nom: f.nom_original, genre: 'image', taille: f.taille, pages: 1, largeur: w, hauteur: h, format, fonds_perdus: format ? (format.avec_fonds_perdus ? 'incertains' : 'absents') : null, avertissements: av });
      }
    }
    return out;
  }

  /** Ce que le serveur sait faire : aperçus PDF (Poppler), traitement (Ghostscript, qpdf). */
  router.get('/capacites', async (_req, res) => {
    const [poppler, gs, qpdf] = await Promise.all([popplerPresent(), gsPresent(), qpdfPresent()]);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({ apercus_pdf: poppler, optimisation: gs, reparation: qpdf || gs });
  });

  router.get('/catalogue', (_req, res) => {
    res.json({
      feuilles: Object.entries(FEUILLES).map(([code, f]) => ({ code, ...f })),
      formats: FORMATS_FINIS,
    });
  });

  const finiOpt = z.object({ largeur: z.number().positive().max(2000), hauteur: z.number().positive().max(2000) }).optional();

  router.post('/analyser', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pieces = lirePieces(body);
    const fini = finiOpt.safeParse(body.fini).data;
    const fonds = typeof body.fonds_perdus_mm === 'number' ? body.fonds_perdus_mm : undefined;
    const { fichiers, assemblage, analyse, dossierId } = await preparer(me(req), pieces, fini, fonds);
    const premier = fichiers[0]!;
    const defaut = paramsParDefaut(analyse);
    if (assemblage.paires?.some((x) => x.verso !== null)) defaut.recto_verso = true;
    if (assemblage.paires && defaut.mode === 'sequence' && assemblage.paires.length === 1) defaut.mode = 'repetition';
    res.json({
      fichier: { id: premier.id, nom: premier.nom_original, taille: premier.taille, dossier_id: dossierId },
      sans_dossier: dossierId === null,
      pieces: await analyserPieces(fichiers),
      pages: assemblage.pages,
      paires: assemblage.paires,
      analyse,
      params_defaut: defaut,
    });
  });

  const avecParams = (body: Record<string, unknown>) => {
    const r = paramsSchema.safeParse(body.params);
    if (!r.success) throw badRequest('Certains réglages sont invalides.', { champs: zodDetails(r.error) });
    return r.data as ParamsImposition;
  };

  router.post('/plan', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pieces = lirePieces(body);
    const params = avecParams(body);
    const { assemblage, analyse } = await preparer(me(req), pieces, params.fini, params.fonds_perdus_mm);
    try {
      res.json({ plan: calculerPlan({ ...params, paires: assemblage.paires }, analyse.nb_pages, analyse.pages), pages: assemblage.pages });
    } catch (e) {
      throw conflict(e instanceof Error ? e.message : 'Plan impossible.');
    }
  });

  let generationsEnCours = 0;

  router.post('/generer', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pieces = lirePieces(body);
    const params = avecParams(body);
    const nomVoulu = typeof body.nom === 'string' ? body.nom.trim().slice(0, 120) : '';
    const user = me(req);
    const { fichiers, assemblage, analyse, dossierId } = await preparer(user, pieces, params.fini, params.fonds_perdus_mm);
    const f = fichiers[0]!;
    const d = dossierId !== null ? await chargerDossier(user, dossierId) : null;
    if (d && !peutDeposer(user, d)) throw new HttpError(403, 'Le dossier n’accepte plus de nouveaux fichiers (validé, livré ou annulé) : demandez son retour en préparation.');
    if (generationsEnCours >= 2) throw conflict('Deux impositions sont déjà en cours sur le serveur : réessayez dans un instant.');
    let plan;
    try {
      plan = calculerPlan({ ...params, paires: assemblage.paires }, analyse.nb_pages, analyse.pages);
    } catch (e) {
      throw conflict(e instanceof Error ? e.message : 'Plan impossible.');
    }
    if (plan.nb_pages_sortie > 2000) throw conflict(`Le résultat ferait ${plan.nb_pages_sortie} pages : réduisez la quantité ou découpez le travail.`);

    generationsEnCours++;
    let octets: Uint8Array;
    try {
      const source = await fs.promises.readFile(assemblage.chemin);
      if (params.operation === 'assembler') {
        // Réunir seulement : les pages dans l'ordre des pièces (recto1, verso1, recto2…), telles quelles.
        const { PDFDocument } = await import('pdf-lib');
        const src = await PDFDocument.load(source, { ignoreEncryption: true });
        const out = await PDFDocument.create();
        out.setTitle(`${f.nom_original} — assemblage`);
        out.setProducer('Evocom Print v2 — imposition');
        const ordre = plan.feuilles.map((x) => x.recto.poses[0]!.page!).filter((n) => n >= 1 && n <= src.getPageCount());
        const copies = await out.copyPages(src, ordre.map((n) => n - 1));
        copies.forEach((pg) => out.addPage(pg));
        octets = await out.save({ useObjectStreams: true });
      } else {
        octets = (await genererPdf(source, plan, params, f.nom_original, analyse.pages.map((pg) => pg.bords_unis), assemblage.chemin)).octets;
      }
    } catch (e) {
      throw new HttpError(502, `La génération a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}.`);
    } finally {
      generationsEnCours--;
    }

    const r = { data: { params, nom: nomVoulu || undefined } };
    const base = f.nom_original.replace(/\.(pdf|ai|png|jpe?g|webp|tiff?)$/i, '');
    // Sans dossier : résultat gardé six heures, à télécharger.
    if (dossierId === null || !d) {
      const suffixeLibre = params.operation === 'livret' ? 'LIVRET' : params.operation === 'fonds_perdus' ? 'FONDS-PERDUS' : params.operation === 'assembler' ? 'ASSEMBLE' : `IMPOSITION-${plan.poses_par_face}POSES`;
      const nomLibre = (r.data.nom && r.data.nom.trim()) || `${base}_${suffixeLibre}.pdf`;
      const jeton = crypto.randomBytes(16).toString('hex');
      await fs.promises.mkdir(libreDir, { recursive: true });
      const chemin = path.join(libreDir, `${jeton}.pdf`);
      await fs.promises.writeFile(chemin, octets);
      const l: FichierLibre = { jeton, nom: nomLibre, mime: 'application/pdf', taille: octets.byteLength, chemin, user_id: user.id, genre: 'resultat' };
      libres.set(jeton, l);
      await fs.promises.writeFile(path.join(libreDir, `${jeton}.json`), JSON.stringify(l));
      await journal(req, 'fichier_impose', 'fichier', null, { sans_dossier: true, sources: fichiers.map((x) => x.nom_original), operation: plan.operation, poses: plan.poses_par_face, pages: plan.nb_pages_sortie });
      res.status(201).json({ fichier: null, libre: { jeton, nom: nomLibre, taille: octets.byteLength, telechargement: `/api/imposition/libre/${jeton}/contenu?telecharger=1` }, plan });
      return;
    }
    // Enregistrement comme fichier du dossier, à côté de la source.
    const suffixe = r.data.params.operation === 'livret' ? 'LIVRET' : r.data.params.operation === 'fonds_perdus' ? 'FONDS-PERDUS' : r.data.params.operation === 'assembler' ? 'ASSEMBLE' : `IMPOSITION-${plan.poses_par_face}POSES`;
    const nom = (r.data.nom && r.data.nom.trim()) || `${base}_${suffixe}.pdf`;
    const id = crypto.randomUUID();
    const relDir = path.join('dossiers', String(dossierId));
    const rel = path.join(relDir, `${id}-${nom}`);
    const dest = path.join(racine, rel);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, octets);
    const sha = crypto.createHash('sha256').update(octets).digest('hex');
    const nouveau = await tx(async (db) => {
      const row = await one<{ id: number }>(
        `INSERT INTO fichiers (dossier_id, nom_original, chemin, mime, taille, sha256, uploaded_by) VALUES ($1,$2,$3,'application/pdf',$4,$5,$6) RETURNING id`,
        [dossierId, nom, rel, octets.byteLength, sha, user.id],
        db,
      );
      await evenement(db, dossierId, user.id, {
        type: 'fichier',
        action: 'imposition',
        data: { fichier_id: row!.id, nom, taille: octets.byteLength, source_id: f.id, source_nom: fichiers.length > 1 ? `${fichiers.length} fichiers (${fichiers.map((x) => x.nom_original).join(', ')})` : f.nom_original, operation: plan.operation, poses: plan.poses_par_face, feuilles: plan.nb_feuilles, pages: plan.nb_pages_sortie, feuille: `${plan.feuille.largeur} × ${plan.feuille.hauteur} mm` },
      });
      await journal(req, 'fichier_impose', 'fichier', row!.id, { dossier_id: dossierId, sources: fichiers.map((x) => x.id), operation: plan.operation, poses: plan.poses_par_face, pages: plan.nb_pages_sortie }, db);
      return row!.id;
    }).catch(async (e) => {
      await fs.promises.rm(dest, { force: true });
      throw e;
    });
    signalDossier({ ...d, ancien_statut: d.statut });
    planifierTraitement(nouveau);
    res.status(201).json({ fichier: { id: nouveau, nom, taille: octets.byteLength, dossier_id: dossierId }, plan });
  });

  // ---------------------------------------------------------------------------
  // Modèles d'imposition : lus par tous (administrateurs et préparateurs), gérés par l'administrateur.

  const modeleSchema = z.object({
    nom: z.string({ required_error: 'Donnez un nom au modèle' }).trim().min(1, 'Donnez un nom au modèle').max(80, '80 caractères au plus'),
    description: z.string().trim().max(300).nullable().optional(),
    params: paramsSchema,
  });

  type ModeleRow = { id: number; nom: string; description: string | null; params: ParamsImposition; ordre: number; created_by_nom: string | null; updated_at: string };
  const listerModeles = () =>
    query<ModeleRow>(`SELECT m.id, m.nom, m.description, m.params, m.ordre, u.nom AS created_by_nom, m.updated_at FROM imposition_modeles m LEFT JOIN users u ON u.id = m.created_by ORDER BY m.ordre, lower(m.nom)`);

  router.get('/modeles', async (_req, res) => {
    res.json({ items: await listerModeles() });
  });

  router.post('/modeles', requireRole('admin'), async (req, res) => {
    const r = modeleSchema.safeParse(req.body ?? {});
    if (!r.success) throw badRequest('Certains champs sont invalides.', { champs: zodDetails(r.error) });
    const existe = await one(`SELECT 1 FROM imposition_modeles WHERE lower(nom) = lower($1)`, [r.data.nom]);
    if (existe) throw conflict(`Un modèle « ${r.data.nom} » existe déjà : choisissez un autre nom ou modifiez-le.`);
    const row = await one<{ id: number }>(
      `INSERT INTO imposition_modeles (nom, description, params, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [r.data.nom, r.data.description ?? null, JSON.stringify(r.data.params), me(req).id],
    );
    await journal(req, 'imposition_modele_cree', 'imposition_modele', row!.id, { nom: r.data.nom, operation: r.data.params.operation });
    res.status(201).json({ items: await listerModeles(), id: row!.id });
  });

  router.put('/modeles/:id', requireRole('admin'), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw notFound('Modèle introuvable.');
    const r = modeleSchema.safeParse(req.body ?? {});
    if (!r.success) throw badRequest('Certains champs sont invalides.', { champs: zodDetails(r.error) });
    const row = await one<{ id: number }>(
      `UPDATE imposition_modeles SET nom = $2, description = $3, params = $4, updated_at = now() WHERE id = $1 RETURNING id`,
      [id, r.data.nom, r.data.description ?? null, JSON.stringify(r.data.params)],
    );
    if (!row) throw notFound('Modèle introuvable.');
    await journal(req, 'imposition_modele_modifie', 'imposition_modele', id, { nom: r.data.nom });
    res.json({ items: await listerModeles() });
  });

  router.delete('/modeles/:id', requireRole('admin'), async (req, res) => {
    const id = Number(req.params.id);
    const row = await one<{ nom: string }>(`DELETE FROM imposition_modeles WHERE id = $1 RETURNING nom`, [id]);
    if (!row) throw notFound('Modèle introuvable.');
    await journal(req, 'imposition_modele_supprime', 'imposition_modele', id, { nom: row.nom });
    res.json({ items: await listerModeles() });
  });

  // ---------------------------------------------------------------------------
  // Proposition de plan par l'assistant IA

  const iaSchema = z.object({ question: z.string().trim().max(600).optional() });
  const schemaPlanIA = {
    name: 'plan_imposition',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type_document: { type: 'string' },
        confiance: { type: 'string', enum: ['haute', 'moyenne', 'basse'] },
        operation: { type: 'string', enum: ['poses', 'livret', 'fonds_perdus'] },
        feuille: { type: 'string', enum: CODES_FEUILLE.filter((c) => c !== 'personnalisee') },
        orientation: { type: 'string', enum: ['auto', 'portrait', 'paysage'] },
        fini_largeur_mm: { type: 'number' },
        fini_hauteur_mm: { type: 'number' },
        fonds_perdus_mm: { type: 'number' },
        methode_fonds_perdus: { type: 'string', enum: ['source', 'miroir', 'etirer', 'blanc'] },
        gouttiere_mm: { type: 'number' },
        marge_mm: { type: 'number' },
        recto_verso: { type: 'boolean' },
        mode: { type: 'string', enum: ['repetition', 'sequence', 'coupe_empile'] },
        quantite: { type: ['integer', 'null'] },
        numeroter: { type: 'boolean' },
        explication: { type: 'string' },
        points_de_vigilance: { type: 'array', items: { type: 'string' } },
      },
      required: ['type_document', 'confiance', 'operation', 'feuille', 'orientation', 'fini_largeur_mm', 'fini_hauteur_mm', 'fonds_perdus_mm', 'methode_fonds_perdus', 'gouttiere_mm', 'marge_mm', 'recto_verso', 'mode', 'quantite', 'numeroter', 'explication', 'points_de_vigilance'],
    },
  };
  const reponseIASchema = z.object({
    type_document: z.string(),
    confiance: z.enum(['haute', 'moyenne', 'basse']),
    operation: z.enum(['poses', 'livret', 'fonds_perdus']),
    feuille: z.string(),
    orientation: z.enum(['auto', 'portrait', 'paysage']),
    fini_largeur_mm: z.number(),
    fini_hauteur_mm: z.number(),
    fonds_perdus_mm: z.number(),
    methode_fonds_perdus: z.enum(['source', 'miroir', 'etirer', 'blanc']),
    gouttiere_mm: z.number(),
    marge_mm: z.number(),
    recto_verso: z.boolean(),
    mode: z.enum(['repetition', 'sequence', 'coupe_empile']),
    quantite: z.number().int().nullable(),
    numeroter: z.boolean(),
    explication: z.string(),
    points_de_vigilance: z.array(z.string()),
  });

  // Propositions de l'assistant gardées 12 h par travail (fichiers + question) : redemander ne coûte rien.
  const cacheIA = new Map<string, { at: number; reponse: unknown }>();
  const CACHE_IA_MS = 12 * 3600_000;

  router.post('/ia', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { question } = iaSchema.parse(body);
    const pieces = lirePieces(body);
    const user = me(req);
    const { fichiers, assemblage, analyse: a, dossierId } = await preparer(user, pieces);
    const f = fichiers[0]!;
    const cleIA = `${assemblage.signature}|${dossierId ?? 0}|${(question ?? '').trim().toLowerCase()}`;
    const enCache = body.forcer === true ? undefined : cacheIA.get(cleIA);
    if (enCache && Date.now() - enCache.at < CACHE_IA_MS) {
      res.json({ ...(enCache.reponse as object), depuis_cache: true });
      return;
    }
    const [d, libelles] = await Promise.all([dossierId !== null ? chargerDossier(user, dossierId) : Promise.resolve(null), libellesTarifs()]);
    const { principal, secours } = await accesIA();
    const quantite = (d?.specs?.lignes ?? []).reduce((t: number, l: { quantite?: number }) => t + (Number(l.quantite) || 0), 0) || null;
    const contexte = {
      dossier: d ? { numero: d.numero, machine: d.machine, description: d.description, specs: resumeSpecs(d.machine, d.specs, d.description, libelles), quantite_totale: quantite } : null,
      fichier: { nom: fichiers.length > 1 ? fichiers.map((x) => `${x.nom_original} (${assemblage.pages.find((pg) => pg.fichier_id === x.id)?.role ?? 'pages'})`).join(' + ') : f.nom_original, pieces: fichiers.length, recto_verso_separes: !!assemblage.paires?.some((x) => x.verso !== null), pages: a.nb_pages, page_mm: { largeur: a.largeur, hauteur: a.hauteur }, format_reconnu: a.format ? { libelle: a.format.libelle, famille: a.format.famille, paysage: a.format.paysage } : null, fonds_perdus: a.fonds_perdus, fonds_perdus_mm: a.fonds_perdus_mm, fini_propose_mm: a.fini, visuel_jusqu_au_bord: a.pages.some((p) => p.jusqu_au_bord === true), marge_blanche_min_mm: a.pages[0]?.marge_blanche ? Math.min(...Object.values(a.pages[0].marge_blanche)) : null, avertissements: a.avertissements.map((m) => m.slice(0, 160)).slice(0, 4), bords_unis: a.pages[0]?.bords_unis ?? null },
      feuilles_disponibles: Object.entries(FEUILLES).filter(([c]) => c !== 'personnalisee').map(([code, x]) => ({ code, largeur: x.largeur, hauteur: x.hauteur })),
      question: question ?? null,
    };
    const messages: { role: 'system' | 'user'; content: string }[] = [
      {
        role: 'system',
        content: [
          'Tu es le responsable prépresse d’une imprimerie numérique à Dakar (machines : Xerox feuille à feuille jusqu’au SRA3, Roland grand format).',
          'On te donne l’analyse d’un fichier PDF et les spécifications du dossier. Propose le plan d’imposition le plus économique et le plus sûr, en respectant ces règles :',
          '- cartes de visite, flyers, tickets : opération « poses » sur SRA3 (320 × 450) ou A3, fonds perdus 3 mm, gouttière 0, marge 10 mm ; « repetition » pour un seul visuel, « sequence » quand les pages se suivent, « coupe_empile » pour des tickets numérotés ou des exemplaires différents à empiler ;',
          '- brochures, livrets, programmes : « livret » (piqûre à cheval), feuille égale à deux fois le format fini (A4 → A3 ou SRA3, A5 → A4 ou SRA4), recto_verso vrai ;',
          '- fichier à préparer seulement : « fonds_perdus » ;',
          '- fonds perdus : « source » s’ils sont déclarés ou présents dans le fichier, sinon « miroir » si le visuel va jusqu’au bord, « blanc » si le visuel a une marge blanche partout ;',
          '- recto_verso vrai si le fichier a 2 pages (recto/verso) ou si les spécifications disent recto-verso ;',
          '- numeroter vrai seulement pour des tickets, billets ou bons numérotés ; quantite = nombre d’exemplaires finis attendus, sinon null.',
          '« type_document » : ce que tu reconnais (carte de visite, flyer, dépliant, brochure, ticket, affiche, étiquette…) et « confiance » : haute, moyenne ou basse selon que la taille des pages, le nombre de pages et les spécifications concordent. Si la taille de la page est ambiguë (par exemple 91 × 61 mm : carte 85 × 55 avec 3 mm de fonds perdus, ou format spécial), dis-le dans « points_de_vigilance ».',
          'Réponds uniquement par le JSON demandé ; « explication » en français, en deux ou trois phrases simples ; « points_de_vigilance » : liste courte de ce que le préparateur doit vérifier.',
        ].join('\n'),
      },
      { role: 'user', content: JSON.stringify(contexte) },
    ];
    let resultat;
    try {
      resultat = await appelerAvecSecours(principal, secours, { messages, schema: schemaPlanIA, maxJetons: 600 });
    } catch (e) {
      const tentatives = (e as { tentatives?: TentativeIA[] }).tentatives;
      if (tentatives) await noterTentativesIA(req, 'imposition', tentatives, `${f.nom_original}${d ? ` · ${d.numero}` : ''}`);
      else await noterUsageIA(req, { type: 'imposition', statut: 'erreur', fournisseur: principal.fournisseur, modele: principal.modele, duree_ms: 0, demande: f.nom_original, erreur: e instanceof Error ? e.message : null });
      throw e;
    }
    let brut: unknown;
    try {
      brut = JSON.parse(resultat.reponse.contenu);
    } catch {
      brut = undefined;
    }
    const lu = reponseIASchema.safeParse(brut);
    if (!lu.success) {
      const derniere = resultat.tentatives[resultat.tentatives.length - 1]!;
      await noterTentativesIA(req, 'imposition', [...resultat.tentatives.slice(0, -1), { ...derniere, statut: 'reponse_invalide' as StatutAppel, erreur: 'Réponse illisible (JSON inattendu)' }], f.nom_original);
      throw new ErreurIA(502, "La réponse de l'assistant est illisible : réessayez.", 'reponse_invalide', resultat.fournisseur);
    }
    await noterTentativesIA(req, 'imposition', resultat.tentatives, `${f.nom_original}${d ? ` · ${d.numero}` : ''}`);
    const p = lu.data;
    const defaut = paramsParDefaut(a, p.operation);
    const params: ParamsImposition = {
      ...defaut,
      operation: p.operation,
      feuille: (CODES_FEUILLE as string[]).includes(p.feuille) ? (p.feuille as ParamsImposition['feuille']) : 'sra3',
      orientation: p.orientation,
      fini: { largeur: Math.min(2000, Math.max(10, p.fini_largeur_mm)), hauteur: Math.min(2000, Math.max(10, p.fini_hauteur_mm)) },
      fonds_perdus_mm: Math.min(20, Math.max(0, p.fonds_perdus_mm)),
      methode_fonds_perdus: p.methode_fonds_perdus,
      gouttiere_mm: Math.min(50, Math.max(0, p.gouttiere_mm)),
      marge_mm: Math.min(100, Math.max(0, p.marge_mm)),
      recto_verso: p.recto_verso,
      mode: p.mode,
      quantite: p.quantite && p.quantite > 0 ? Math.min(100_000, p.quantite) : undefined,
      numerotation: p.numeroter ? { debut: 1, chiffres: 4, prefixe: '', position: 'bas_droite', taille_pt: 12, verso: false } : null,
    };
    if (params.numerotation && params.mode !== 'coupe_empile') params.mode = 'coupe_empile';
    if (assemblage.paires?.some((x) => x.verso !== null)) params.recto_verso = true;
    let plan = null;
    let erreurPlan: string | null = null;
    try {
      plan = calculerPlan({ ...params, paires: assemblage.paires }, a.nb_pages);
    } catch (e) {
      erreurPlan = e instanceof Error ? e.message : 'Plan impossible';
    }
    const reponse = { params, plan, erreur_plan: erreurPlan, type_document: p.type_document, confiance: p.confiance, explication: p.explication, points_de_vigilance: p.points_de_vigilance, fournisseur: resultat.fournisseur, modele: resultat.modele, secours: resultat.secours, jetons: (resultat.reponse.jetons_entree ?? 0) + (resultat.reponse.jetons_sortie ?? 0) };
    cacheIA.set(cleIA, { at: Date.now(), reponse });
    if (cacheIA.size > 500) cacheIA.delete(cacheIA.keys().next().value!);
    res.json({ ...reponse, depuis_cache: false });
  });

  return router;
}

