import fs from 'node:fs';
import pino from 'pino';
import supertest from 'supertest';
import { loadConfig } from '../src/config';
import { getPool, initPool } from '../src/db/pool';
import { migrate } from '../src/db/migrate';
import { seedBase, seedDemoUsers } from '../src/db/seed';
import { initAuth } from '../src/lib/auth';
import { createApp } from '../src/app';

export const PASSWORD = 'Evocom2026!';
let ready: Promise<ReturnType<typeof createApp>> | null = null;

export function app() {
  if (!ready) {
    ready = (async () => {
      const config = loadConfig();
      fs.rmSync(config.storageDir, { recursive: true, force: true });
      fs.mkdirSync(config.storageDir, { recursive: true });
      let pool;
      try {
        pool = getPool();
      } catch {
        pool = initPool(config.databaseUrl);
      }
      await migrate(pool, () => {});
      await seedBase(pool);
      await seedDemoUsers(pool, PASSWORD);
      initAuth(config);
      return createApp(config, pino({ level: 'silent' }));
    })();
  }
  return ready;
}

export async function agent(email: string) {
  const a = supertest.agent(await app());
  const r = await a.post('/api/auth/login').send({ email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.body)}`);
  return a;
}

export const comptes = {
  admin: 'admin@evocom.test',
  prep: 'prep@evocom.test',
  prep2: 'prep2@evocom.test',
  roland: 'roland@evocom.test',
  xerox: 'xerox@evocom.test',
  livreur: 'livreur@evocom.test',
};

/** Envoie un fichier par le protocole tus, comme le fait le navigateur. */
export async function envoyerFichier(a: supertest.Agent, dossierId: number, nom: string, contenu: Buffer, type = 'application/pdf') {
  const meta = [`dossierId ${Buffer.from(String(dossierId)).toString('base64')}`, `filename ${Buffer.from(nom).toString('base64')}`, `filetype ${Buffer.from(type).toString('base64')}`].join(',');
  const create = await a
    .post('/api/uploads')
    .set('Tus-Resumable', '1.0.0')
    .set('Upload-Length', String(contenu.length))
    .set('Upload-Metadata', meta);
  if (create.status !== 201) return { status: create.status, body: create.text };
  const location = create.headers.location as string;
  const patch = await a
    .patch(location.startsWith('/') ? location : `/api/uploads/${location.split('/').pop()}`)
    .set('Tus-Resumable', '1.0.0')
    .set('Upload-Offset', '0')
    .set('Content-Type', 'application/offset+octet-stream')
    .send(contenu);
  return { status: patch.status, body: patch.text, fichierId: Number(patch.headers['x-fichier-id']) };
}
