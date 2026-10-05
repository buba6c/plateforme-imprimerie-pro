// Configuration lue une seule fois au démarrage. Toute valeur obligatoire manquante arrête le serveur
// avec un message clair plutôt que de retomber sur une valeur par défaut dangereuse.

import path from 'node:path';

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export interface Config {
  env: 'production' | 'development' | 'test';
  port: number;
  host: string;
  databaseUrl: string;
  jwtSecret: string;
  sessionHours: number;
  cookieSecure: boolean;
  trustProxy: number;
  storageDir: string;
  maxUploadBytes: number;
  serveWebDir: string | null;
  appUrl: string;
  allowSystemReset: boolean;
}

export class ConfigError extends Error {}

export function loadConfig(): Config {
  const nodeEnv = (env('NODE_ENV', 'development') as Config['env']) ?? 'development';
  const jwtSecret = env('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new ConfigError(
      'JWT_SECRET est absent ou trop court (32 caractères minimum). Générez-en un avec : openssl rand -hex 32',
    );
  }
  const databaseUrl =
    env('DATABASE_URL') ??
    (env('PGDATABASE')
      ? `postgres://${encodeURIComponent(env('PGUSER', 'postgres')!)}:${encodeURIComponent(env('PGPASSWORD', '')!)}@${env('PGHOST', 'localhost')}:${env('PGPORT', '5432')}/${env('PGDATABASE')}`
      : undefined);
  if (!databaseUrl) throw new ConfigError('DATABASE_URL est absent (ex. postgres://evocom:motdepasse@localhost:5432/evocom).');

  return {
    env: nodeEnv,
    port: Number(env('PORT', '4000')),
    host: env('HOST', '127.0.0.1')!,
    databaseUrl,
    jwtSecret,
    sessionHours: Number(env('SESSION_HOURS', '12')),
    cookieSecure: env('COOKIE_SECURE', nodeEnv === 'production' ? 'true' : 'false') === 'true',
    trustProxy: Number(env('TRUST_PROXY', '1')),
    storageDir: path.resolve(env('STORAGE_DIR', path.resolve(process.cwd(), 'storage'))!),
    maxUploadBytes: Number(env('MAX_UPLOAD_MB', '4096')) * 1024 * 1024,
    serveWebDir: env('SERVE_WEB_DIR') ? path.resolve(env('SERVE_WEB_DIR')!) : null,
    appUrl: env('APP_URL', 'http://localhost:5173')!,
    // Réinitialisation de la plateforme (Paramètres > Zone dangereuse) : désactivée sauf activation explicite.
    allowSystemReset: env('ALLOW_SYSTEM_RESET', 'false') === 'true',
  };
}
