// Sauvegardes : historique, lancement à la demande de deploy/backup.sh, téléchargement d'une copie de la base.
//
// Le script est celui de la tâche planifiée de la nuit (même verrou : une seule sauvegarde à la fois, code 75
// si une autre tourne). L'API lui passe ses propres variables (DATABASE_URL, STORAGE_DIR, BACKUP_DIR…) et
// ENV_FILE vide : il n'y a qu'une configuration, celle du service.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request } from 'express';
import type { Config } from '../../config';
import { one, query } from '../../db/pool';
import { journal } from '../../lib/audit';
import { conflict, HttpError, notFound } from '../../lib/errors';
import { parLots } from '../commun/disque';
import { invaliderStockage } from './stockage';

export const DELAI_MAX_MS = 30 * 60 * 1000;
const CODE_DEJA_EN_COURS = 75;
const SORTIE_MAX = 64 * 1024;

export function dossierSauvegardes(): string {
  return path.resolve(process.env.BACKUP_DIR || '/var/backups/evocom');
}

/**
 * Chemin du script de sauvegarde : BACKUP_SCRIPT s'il est défini, sinon deploy/backup.sh trouvé en remontant
 * depuis le code de l'API (src/modules/systeme en développement, dist/ une fois compilé) puis depuis le
 * répertoire courant.
 */
export function scriptSauvegarde(): string | null {
  if (process.env.BACKUP_SCRIPT) return path.resolve(process.env.BACKUP_SCRIPT);
  const departs = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const depart of departs) {
    let d = depart;
    for (let i = 0; i < 8; i++) {
      for (const c of [path.join(d, 'deploy', 'backup.sh'), path.join(d, 'v2', 'deploy', 'backup.sh')]) {
        if (fs.existsSync(c)) return c;
      }
      const parent = path.dirname(d);
      if (parent === d) break;
      d = parent;
    }
  }
  return null;
}

/** Fichier de sauvegarde enregistré, s'il existe vraiment sous BACKUP_DIR (liens symboliques résolus). */
async function fichierSousDossier(fichier: string | null): Promise<{ abs: string; taille: number } | null> {
  if (!fichier || !path.isAbsolute(fichier)) return null;
  const racine = await fs.promises.realpath(dossierSauvegardes()).catch(() => null);
  if (!racine) return null;
  const reel = await fs.promises.realpath(path.resolve(fichier)).catch(() => null);
  if (!reel || !reel.startsWith(racine + path.sep)) return null;
  const st = await fs.promises.stat(reel).catch(() => null);
  return st?.isFile() ? { abs: reel, taille: st.size } : null;
}

let enCours: { debut: number; par: number } | null = null;

export function sauvegardeEnCours(): boolean {
  return enCours !== null;
}

export async function listeSauvegardes() {
  const rows = await query<{ id: number; ok: boolean; fichier: string | null; taille: number | null; message: string | null; created_at: string }>(
    `SELECT id, ok, fichier, taille, message, created_at FROM sauvegardes ORDER BY created_at DESC, id DESC LIMIT 30`,
  );
  const items = await parLots(rows, 8, async (r) => {
    const f = await fichierSousDossier(r.fichier);
    return {
      ...r,
      nom: r.fichier ? path.basename(r.fichier) : null,
      present: !!f,
      taille_reelle: f?.taille ?? null,
    };
  });
  return { items, en_cours: sauvegardeEnCours(), dossier: dossierSauvegardes() };
}

/** Dernière ligne utile de la sortie du script, pour un message lisible. */
function derniereLigne(sortie: string): string {
  const lignes = sortie
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return (lignes[lignes.length - 1] ?? '').slice(0, 400);
}

export interface ResultatSauvegarde {
  ok: boolean;
  message: string;
  duree_ms: number;
}

export async function lancerSauvegarde(req: Request, cfg: Config, userId: number): Promise<ResultatSauvegarde> {
  if (enCours) throw conflict('Une sauvegarde est déjà en cours : attendez qu’elle se termine (quelques minutes).');
  const script = scriptSauvegarde();
  const debut = Date.now();
  enCours = { debut, par: userId };
  try {
    // Lignes écrites par le script pendant ce lancement : celles dont l'id dépasse le dernier connu.
    const avant = (await one<{ id: number }>(`SELECT coalesce(max(id), 0)::int AS id FROM sauvegardes`))?.id ?? 0;
    let resultat: ResultatSauvegarde;
    if (!script || !fs.existsSync(script)) {
      resultat = {
        ok: false,
        message: `Le script de sauvegarde est introuvable${script ? ` (${script})` : ''} : vérifiez l’installation (v2/deploy/backup.sh) ou la variable BACKUP_SCRIPT.`,
        duree_ms: 0,
      };
    } else {
      const { code, signal, sortie, delaiDepasse, erreurLancement } = await executer(script, cfg);
      const duree_ms = Date.now() - debut;
      if (code === CODE_DEJA_EN_COURS) {
        throw conflict('Une sauvegarde est déjà en cours (celle de la nuit, ou une autre lancée depuis cet écran) : réessayez dans quelques minutes.');
      }
      if (code === 0) {
        const ligne = await one<{ message: string | null }>(
          `SELECT message FROM sauvegardes WHERE id > $1 AND ok ORDER BY id DESC LIMIT 1`,
          [avant],
        );
        resultat = { ok: true, message: ligne?.message ?? 'Sauvegarde terminée.', duree_ms };
      } else {
        const detail = derniereLigne(sortie);
        const message = delaiDepasse
          ? `La sauvegarde a dépassé ${DELAI_MAX_MS / 60000} minutes : elle a été arrêtée. Lancez deploy/backup.sh sur le serveur pour voir ce qui la bloque.`
          : erreurLancement
            ? `La sauvegarde n’a pas pu démarrer : ${erreurLancement}.`
            : `La sauvegarde a échoué${signal ? ` (arrêtée par ${signal})` : ` (code ${code})`}${detail ? ` : ${detail}` : '.'}`;
        resultat = { ok: false, message, duree_ms };
      }
    }
    if (!resultat.ok) {
      // Le script enregistre lui-même ses échecs ; s'il n'a rien pu écrire (introuvable, arrêté), on le fait ici.
      const deja = await one<{ n: number }>(`SELECT count(*)::int AS n FROM sauvegardes WHERE id > $1`, [avant]);
      if (!deja?.n) await query(`INSERT INTO sauvegardes (ok, fichier, taille, message) VALUES (false, NULL, 0, $1)`, [resultat.message]);
    }
    await journal(req, 'sauvegarde_lancee', 'sauvegarde', null, resultat);
    return resultat;
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      await journal(req, 'sauvegarde_lancee', 'sauvegarde', null, { ok: false, message: e.message, deja_en_cours: true }).catch(() => {});
    }
    throw e;
  } finally {
    enCours = null;
    // Un instantané ajoute un nom (lien dur) à chaque fichier : le compte des fichiers partagés change.
    invaliderStockage();
  }
}

function executer(script: string, cfg: Config) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null; sortie: string; delaiDepasse: boolean; erreurLancement?: string }>((resolve) => {
    let sortie = '';
    let delaiDepasse = false;
    const garder = (b: Buffer) => {
      sortie += b.toString('utf8');
      if (sortie.length > SORTIE_MAX) sortie = sortie.slice(-SORTIE_MAX);
    };
    const enfant = spawn('bash', [script], {
      env: {
        ...process.env,
        ENV_FILE: '',
        DATABASE_URL: cfg.databaseUrl,
        STORAGE_DIR: cfg.storageDir,
        BACKUP_DIR: dossierSauvegardes(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    enfant.stdout.on('data', garder);
    enfant.stderr.on('data', garder);
    const minuteur = setTimeout(() => {
      delaiDepasse = true;
      enfant.kill('SIGTERM');
      setTimeout(() => enfant.kill('SIGKILL'), 10_000).unref();
    }, DELAI_MAX_MS);
    minuteur.unref();
    enfant.on('error', (e) => {
      clearTimeout(minuteur);
      resolve({ code: null, signal: null, sortie, delaiDepasse, erreurLancement: e.message });
    });
    enfant.on('close', (code, signal) => {
      clearTimeout(minuteur);
      resolve({ code, signal, sortie, delaiDepasse });
    });
  });
}

/** Fichier d'une sauvegarde, seulement s'il est sous BACKUP_DIR. */
export async function fichierSauvegarde(id: number): Promise<{ abs: string; nom: string; taille: number }> {
  const r = await one<{ fichier: string | null }>(`SELECT fichier FROM sauvegardes WHERE id = $1`, [id]);
  if (!r) throw notFound('Cette sauvegarde n’existe pas.');
  const f = await fichierSousDossier(r.fichier);
  if (!f) throw notFound('Le fichier de cette sauvegarde n’est plus sur le serveur (supprimé après le délai de conservation, ou sauvegarde échouée).');
  return { ...f, nom: path.basename(f.abs) };
}
