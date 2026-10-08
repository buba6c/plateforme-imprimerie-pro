// Sauvegardes : historique, lancement de deploy/backup.sh depuis l'écran, téléchargement protégé.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { agent, app, comptes } from './helpers';

const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-test-sauvegardes-'));
const STOCKAGE = path.join(RACINE, 'storage');
const SAUVEGARDES = path.join(RACINE, 'sauvegardes');
fs.mkdirSync(STOCKAGE, { recursive: true });
process.env.STORAGE_DIR = STOCKAGE;
process.env.BACKUP_DIR = SAUVEGARDES;
delete process.env.RCLONE_DEST;

// Le vrai script a besoin de pg_dump, pg_restore, psql et rsync ; sans eux, ces tests sont sautés.
const outils = ['pg_dump', 'pg_restore', 'psql', 'rsync'].every((o) => spawnSync(o, ['--version']).status === 0);

const A = {} as Record<'admin' | 'prep', supertest.Agent>;

beforeAll(async () => {
  await app();
  await getPool().query(`TRUNCATE sauvegardes, journal RESTART IDENTITY`);
  A.admin = await agent(comptes.admin);
  A.prep = await agent(comptes.prep);
  // Stockage « ancien » : sans le touch du script, l'instantané hériterait de cette date et serait effacé aussitôt.
  fs.mkdirSync(path.join(STOCKAGE, 'dossiers', '1'), { recursive: true });
  fs.writeFileSync(path.join(STOCKAGE, 'dossiers', '1', 'a.pdf'), 'contenu');
  const ancien = new Date(Date.now() - 60 * 86_400_000);
  fs.utimesSync(STOCKAGE, ancien, ancien);
});

afterAll(async () => {
  delete process.env.BACKUP_SCRIPT;
  await getPool().query(`TRUNCATE sauvegardes RESTART IDENTITY`);
  fs.rmSync(RACINE, { recursive: true, force: true });
});

describe('sauvegardes', () => {
  it('sont réservées à l’administrateur', async () => {
    expect((await A.prep.get('/api/systeme/sauvegardes')).status).toBe(403);
    expect((await A.prep.post('/api/systeme/sauvegardes')).status).toBe(403);
    expect((await A.prep.get('/api/systeme/sauvegardes/1/telecharger')).status).toBe(403);
  });

  it.skipIf(!outils)('lance le script, une seule à la fois, et garde l’instantané du jour', async () => {
    const [r1, r2] = await Promise.all([
      A.admin.post('/api/systeme/sauvegardes'),
      new Promise((ok) => setTimeout(ok, 150)).then(() => A.admin.post('/api/systeme/sauvegardes')),
    ]);
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ ok: true });
    expect(r1.body.message).toContain('Sauvegarde terminée');
    expect(r1.body.duree_ms).toBeGreaterThan(0);
    expect(r2.status).toBe(409);

    const liste = await A.admin.get('/api/systeme/sauvegardes');
    expect(liste.status).toBe(200);
    expect(liste.body.en_cours).toBe(false);
    expect(liste.body.items).toHaveLength(1);
    const s = liste.body.items[0];
    expect(s).toMatchObject({ ok: true, present: true });
    expect(s.taille_reelle).toBe(s.taille);
    expect(s.nom).toMatch(/^evocom-\d{8}-\d{6}\.dump$/);

    // A1 : l'instantané des fichiers porte la date de la sauvegarde, pas celle du stockage.
    const snaps = fs.readdirSync(path.join(SAUVEGARDES, 'fichiers'));
    expect(snaps).toHaveLength(1);
    const st = fs.statSync(path.join(SAUVEGARDES, 'fichiers', snaps[0]!));
    expect(Date.now() - st.mtimeMs).toBeLessThan(10 * 60 * 1000);
    // Liens durs : le fichier de l'instantané est le même que celui du stockage.
    expect(fs.statSync(path.join(STOCKAGE, 'dossiers', '1', 'a.pdf')).nlink).toBe(2);

    const dl = await A.admin.get(`/api/systeme/sauvegardes/${s.id}/telecharger`).buffer(true).parse((res, cb) => {
      const morceaux: Buffer[] = [];
      res.on('data', (c: Buffer) => morceaux.push(c));
      res.on('end', () => cb(null, Buffer.concat(morceaux)));
    });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('attachment');
    expect((dl.body as Buffer).length).toBe(s.taille);
    expect((dl.body as Buffer).subarray(0, 5).toString()).toBe('PGDMP');

    const journal = await A.admin.get('/api/journal').query({ action: 'sauvegarde_lancee,sauvegarde_telechargee' });
    expect(journal.body.items.map((i: any) => i.action).sort()).toEqual(['sauvegarde_lancee', 'sauvegarde_telechargee']);
  });

  it('renvoie un message lisible quand le script échoue', async () => {
    const faux = path.join(RACINE, 'echec.sh');
    fs.writeFileSync(faux, '#!/usr/bin/env bash\necho "pg_dump: connexion refusée" >&2\nexit 3\n');
    process.env.BACKUP_SCRIPT = faux;
    try {
      const r = await A.admin.post('/api/systeme/sauvegardes');
      expect(r.status).toBe(500);
      expect(r.body.ok).toBe(false);
      expect(r.body.error).toContain('La sauvegarde a échoué (code 3) : pg_dump: connexion refusée');
      // Le script n'a rien enregistré : l'API trace l'échec dans l'historique.
      const liste = await A.admin.get('/api/systeme/sauvegardes');
      expect(liste.body.items[0]).toMatchObject({ ok: false, present: false });
    } finally {
      delete process.env.BACKUP_SCRIPT;
    }
  });

  it('ne sert que des fichiers situés sous BACKUP_DIR', async () => {
    fs.mkdirSync(SAUVEGARDES, { recursive: true });
    const dehors = path.join(RACINE, 'secret.txt');
    fs.writeFileSync(dehors, 'secret');
    fs.symlinkSync(dehors, path.join(SAUVEGARDES, 'lien.dump'));
    const ins = await getPool().query<{ id: number }>(
      `INSERT INTO sauvegardes (ok, fichier, taille, message) VALUES
         (true, $1, 6, 'hors du dossier'), (true, $2, 6, 'traversée'), (true, $3, 6, 'lien symbolique'), (true, 'relatif.dump', 6, 'relatif')
       RETURNING id`,
      [dehors, path.join(SAUVEGARDES, '..', 'secret.txt'), path.join(SAUVEGARDES, 'lien.dump')],
    );
    for (const { id } of ins.rows) {
      const r = await A.admin.get(`/api/systeme/sauvegardes/${id}/telecharger`);
      expect(r.status).toBe(404);
      expect(r.text).not.toContain('secret"');
    }
    expect((await A.admin.get('/api/systeme/sauvegardes/999999/telecharger')).status).toBe(404);
    const liste = await A.admin.get('/api/systeme/sauvegardes');
    for (const i of liste.body.items.filter((x: any) => ins.rows.some((r) => r.id === x.id))) expect(i.present).toBe(false);
  });
});
