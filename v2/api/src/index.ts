import http from 'node:http';
import fs from 'node:fs';
import pino from 'pino';
import { ConfigError, loadConfig } from './config';
import { initPool, closePool } from './db/pool';
import { pendingMigrations } from './db/migrate';
import { initAuth } from './lib/auth';
import { createApp } from './app';
import { closeRealtime, initRealtime } from './realtime';
import { arreterWhatsApp, demarrerWhatsApp } from './modules/whatsapp';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: undefined });

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      log.fatal(e.message);
      process.exit(1);
    }
    throw e;
  }
  fs.mkdirSync(config.storageDir, { recursive: true });
  const pool = initPool(config.databaseUrl);
  await pool.query('SELECT 1').catch((e) => {
    log.fatal(`Connexion à PostgreSQL impossible : ${e.message}`);
    process.exit(1);
  });
  const pending = await pendingMigrations(pool);
  if (pending.length) {
    log.fatal(`La base n'est pas à jour (${pending.join(', ')}). Lancez d'abord : npm run migrate`);
    process.exit(1);
  }
  initAuth(config);
  const app = createApp(config, log);
  const server = http.createServer(app);
  server.requestTimeout = 0; // les envois de gros fichiers peuvent durer
  initRealtime(server, { corsOrigin: config.env === 'development' ? config.appUrl : undefined });
  server.listen(config.port, config.host, () => log.info(`Evocom Print API sur http://${config.host}:${config.port}`));
  // WhatsApp client : reprend la connexion si l'appareil est déjà lié ; jamais bloquant.
  await demarrerWhatsApp(config, log);

  const stop = async (signal: string) => {
    log.info(`${signal} reçu, arrêt propre`);
    await arreterWhatsApp();
    closeRealtime();
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}

main().catch((e) => {
  log.fatal(e);
  process.exit(1);
});
