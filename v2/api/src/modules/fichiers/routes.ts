// Fichiers d'impression : envoi reprenable (protocole tus), aperçu, téléchargement.
// Les fichiers ne sont jamais servis en accès libre : chaque lecture passe par la
// vérification des droits sur le dossier.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router, type Express } from 'express';
import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { z } from 'zod';
import type { Config } from '../../config';
import { getPool, one, query, tx } from '../../db/pool';
import { COOKIE_NAME, me, requireAuth, userFromToken } from '../../lib/auth';
import { forbidden, HttpError, notFound } from '../../lib/errors';
import { apercu, ApercuIndisponible, genreApercu, pagesPdf, popplerPresent } from './apercu';
import { intParam } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { signalDossier } from '../../realtime';
import type { AuthUser } from '../../types';
import { chargerDossier, evenement, peutDeposer } from '../dossiers/service';
import { peutVoirFichiers } from '../dossiers/access';

const INLINE_SAFE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** Nom de fichier sûr pour le disque : garde les accents, retire séparateurs et caractères de contrôle. */
export function nomDisque(original: string): string {
  const base = path.basename(original).normalize('NFC');
  const cleaned = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
  return (cleaned || 'fichier').slice(0, 180);
}

/** En-tête Content-Disposition compatible avec les noms accentués (RFC 6266 / 5987). */
export function contentDisposition(type: 'inline' | 'attachment', nom: string): string {
  const ascii = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

class TusRefus extends Error {
  constructor(
    public status_code: number,
    public body: string,
  ) {
    super(body);
  }
}

export function mountUploads(app: Express, config: Config) {
  const tusDir = path.join(config.storageDir, 'tus');
  fs.mkdirSync(tusDir, { recursive: true });
  const datastore = new FileStore({ directory: tusDir });

  const auth = async (req: Request): Promise<AuthUser> => {
    const user = await userFromToken(cookieValue(req.headers.get('cookie'), COOKIE_NAME));
    if (!user) throw new TusRefus(401, 'Connectez-vous pour envoyer des fichiers.');
    return user;
  };

  // Limites de Paramètres > Fichiers, sans jamais dépasser le plafond du serveur (MAX_UPLOAD_MB).
  const tailleMax = async () => Math.min(config.maxUploadBytes, (await getParametres()).fichiers.taille_max_mo * 1024 * 1024);

  const tus = new TusServer({
    path: '/api/uploads',
    datastore,
    maxSize: tailleMax,
    respectForwardedHeaders: true,
    relativeLocation: true,
    namingFunction: () => crypto.randomUUID(),
    async onIncomingRequest(req, uploadId) {
      const user = await auth(req);
      if (req.method !== 'POST' && uploadId) {
        const upload = await datastore.getUpload(uploadId).catch(() => null);
        if (upload && upload.metadata?.userId !== String(user.id)) throw new TusRefus(403, 'Cet envoi appartient à un autre utilisateur.');
      }
    },
    async onUploadCreate(req, upload) {
      const user = await auth(req);
      const dossierId = Number(upload.metadata?.dossierId);
      const filename = upload.metadata?.filename ?? '';
      if (!Number.isInteger(dossierId) || dossierId <= 0 || !filename) throw new TusRefus(400, 'Dossier ou nom de fichier manquant.');
      const { extensions } = (await getParametres()).fichiers;
      const ext = path.extname(nomDisque(filename)).slice(1).toLowerCase();
      if (extensions.length && !extensions.includes(ext)) {
        throw new TusRefus(415, `Type de fichier refusé${ext ? ` (.${ext})` : ''}. Extensions acceptées : ${extensions.map((e) => `.${e}`).join(', ')}.`);
      }
      let d;
      try {
        d = await chargerDossier(user, dossierId);
      } catch {
        throw new TusRefus(404, 'Dossier introuvable.');
      }
      if (!peutDeposer(user, d)) {
        throw new TusRefus(403, 'Le dossier est validé : les fichiers ne peuvent plus être modifiés.');
      }
      return { metadata: { ...upload.metadata, userId: String(user.id), dossierId: String(dossierId) } };
    },
    async onUploadFinish(req, upload) {
      const user = await auth(req);
      const dossierId = Number(upload.metadata?.dossierId);
      const nom = nomDisque(upload.metadata?.filename ?? 'fichier');
      const mime = upload.metadata?.filetype || 'application/octet-stream';
      const src = path.join(tusDir, upload.id);
      const relDir = path.join('dossiers', String(dossierId));
      fs.mkdirSync(path.join(config.storageDir, relDir), { recursive: true });
      const rel = path.join(relDir, `${upload.id}-${nom}`);
      const dest = path.join(config.storageDir, rel);
      await fs.promises.rename(src, dest);
      await fs.promises.rm(`${src}.json`, { force: true });
      const hash = await sha256(dest);
      const taille = (await fs.promises.stat(dest)).size;
      const row = await tx(async (db) => {
        const d = await chargerDossier(user, dossierId, db, true);
        if (!peutDeposer(user, d)) throw new TusRefus(403, 'Le dossier a été validé pendant l\'envoi.');
        const f = await one<{ id: number }>(
          `INSERT INTO fichiers (dossier_id, nom_original, chemin, mime, taille, sha256, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [dossierId, nom, rel, mime, taille, hash, user.id],
          db,
        );
        await evenement(db, dossierId, user.id, { type: 'fichier', action: 'ajout', data: { fichier_id: f!.id, nom, taille } });
        return { d, fichierId: f!.id };
      }).catch(async (err) => {
        await fs.promises.rm(dest, { force: true });
        throw err;
      });
      signalDossier({ ...row.d, ancien_statut: row.d.statut });
      return { status_code: 204, headers: { 'X-Fichier-Id': String(row.fichierId) } };
    },
    async onResponseError(_req, err) {
      if (err instanceof TusRefus) return { status_code: err.status_code, body: err.body };
      if ((err as { status_code?: number }).status_code === 413) {
        return { status_code: 413, body: `Fichier trop volumineux : ${Math.floor((await tailleMax()) / 1024 / 1024)} Mo au maximum par fichier.` };
      }
      return undefined;
    },
  });

  const handler = (req: any, res: any) => tus.handle(req, res);
  app.all('/api/uploads', handler);
  app.all('/api/uploads/*splat', handler);
}

export function fichiersRouter(config: Config) {
  const router = Router();
  router.use(requireAuth);

  async function fichierAccessible(user: AuthUser, id: number) {
    if (!peutVoirFichiers(user)) throw forbidden("Votre rôle n'a pas accès aux fichiers d'impression.");
    const f = await one<{ id: number; dossier_id: number; nom_original: string; chemin: string; mime: string | null; taille: number }>(
      `SELECT id, dossier_id, nom_original, chemin, mime, taille FROM fichiers WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!f) throw notFound('Fichier introuvable.');
    const d = await chargerDossier(user, f.dossier_id); // lève 404 si le dossier n'est pas visible
    return { f, d };
  }

  router.get('/:id/contenu', async (req, res) => {
    const { f } = await fichierAccessible(me(req), intParam(req));
    const abs = path.resolve(config.storageDir, f.chemin);
    if (!abs.startsWith(path.resolve(config.storageDir) + path.sep) || !fs.existsSync(abs)) {
      throw notFound('Le fichier est enregistré mais introuvable sur le disque. Prévenez l\'administrateur.');
    }
    const mime = f.mime || 'application/octet-stream';
    const inline = req.query.telecharger !== '1' && INLINE_SAFE.has(mime);
    res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', f.nom_original));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(abs, { headers: { 'Content-Type': mime }, acceptRanges: true });
  });

  // Miniature ou page en image (WebP), fabriquée par le serveur : ?page=1&largeur=480.
  router.get('/:id/apercu', async (req, res) => {
    const { f } = await fichierAccessible(me(req), intParam(req));
    const genre = genreApercu(f);
    if (!genre) throw new HttpError(415, 'Pas d’aperçu pour ce type de fichier : téléchargez-le.', undefined, 'apercu_type');
    const abs = path.resolve(config.storageDir, f.chemin);
    if (!abs.startsWith(path.resolve(config.storageDir) + path.sep) || !fs.existsSync(abs)) {
      throw notFound('Le fichier est enregistré mais introuvable sur le disque. Prévenez l\'administrateur.');
    }
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), 5000);
    const largeur = Math.min(Math.max(Math.round(Number(req.query.largeur) || 480), 80), 2000);
    try {
      const image = await apercu(config.storageDir, abs, genre, page, largeur);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(image, { headers: { 'Content-Type': 'image/webp' } });
    } catch (e) {
      if (e instanceof ApercuIndisponible) throw new HttpError(501, 'Les miniatures PDF ne sont pas disponibles sur ce serveur.', undefined, 'apercu_indisponible');
      throw new HttpError(422, (e as Error).message, undefined, 'apercu_impossible');
    }
  });

  // Nombre de pages d'un PDF, pour feuilleter les pages en image quand le navigateur n'y arrive pas.
  router.get('/:id/infos-apercu', async (req, res) => {
    const { f } = await fichierAccessible(me(req), intParam(req));
    const genre = genreApercu(f);
    const abs = path.resolve(config.storageDir, f.chemin);
    const pages = genre === 'pdf' && abs.startsWith(path.resolve(config.storageDir) + path.sep) ? await pagesPdf(abs) : genre ? 1 : null;
    res.json({ genre, pages, serveur: genre === 'image' || (genre === 'pdf' && (await popplerPresent())) });
  });

  router.patch('/:id', async (req, res) => {
    const user = me(req);
    const body = z.object({ a_reimprimer: z.boolean() }).parse(req.body);
    const { f, d } = await fichierAccessible(user, intParam(req));
    const imprimeurOk = user.role === `imprimeur_${d.machine}`;
    if (user.role !== 'admin' && !imprimeurOk && !(user.role === 'preparateur' && d.preparateur_id === user.id)) throw forbidden();
    await query(`UPDATE fichiers SET a_reimprimer = $2 WHERE id = $1`, [f.id, body.a_reimprimer]);
    await evenement(getPool(), d.id, user.id, {
      type: 'fichier',
      action: body.a_reimprimer ? 'a_reimprimer' : 'reimpression_annulee',
      data: { fichier_id: f.id, nom: f.nom_original },
    });
    signalDossier({ ...d, ancien_statut: d.statut });
    res.status(204).end();
  });

  router.delete('/:id', async (req, res) => {
    const user = me(req);
    const { f, d } = await fichierAccessible(user, intParam(req));
    if (!peutDeposer(user, d)) throw forbidden('Le dossier est validé : ses fichiers ne peuvent plus être supprimés.');
    await tx(async (db) => {
      await query(`UPDATE fichiers SET deleted_at = now(), deleted_by = $2 WHERE id = $1`, [f.id, user.id], db);
      await evenement(db, d.id, user.id, { type: 'fichier', action: 'suppression', data: { fichier_id: f.id, nom: f.nom_original } });
    });
    signalDossier({ ...d, ancien_statut: d.statut });
    res.status(204).end();
  });

  return router;
}
