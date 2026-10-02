import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config';
import { errorHandler, notFound } from './lib/errors';
import { authRouter } from './modules/auth/routes';
import { usersRouter } from './modules/users/routes';
import { dossiersRouter } from './modules/dossiers/routes';
import { fichiersRouter, mountUploads } from './modules/fichiers/routes';
import { tarifsRouter } from './modules/tarifs/routes';
import { registerModules } from './modules';

export function createApp(config: Config, log: Logger): Express {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: config.serveWebDir
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'"],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              frameSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  if (config.env !== 'test') {
    app.use(
      pinoHttp({
        logger: log,
        autoLogging: { ignore: (req) => req.url === '/api/health' || req.url?.startsWith('/api/uploads') === true },
        serializers: { req: (req) => ({ method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
      }),
    );
  }
  app.use(cookieParser());

  // Envoi de fichiers : avant le parseur JSON (le protocole tus lit le flux brut).
  mountUploads(app, config);

  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Trop de requêtes, patientez une minute.' } }),
  );

  app.get('/api/health', (_req, res) => res.json({ ok: true, version: process.env.npm_package_version ?? '2.0.0' }));
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/dossiers', dossiersRouter);
  app.use('/api/fichiers', fichiersRouter(config));
  app.use('/api/tarifs', tarifsRouter);
  registerModules(app, config);
  app.use('/api', (_req, _res, next) => next(notFound('Adresse d\'API inconnue.')));

  // Interface web compilée (optionnel : Nginx peut la servir directement).
  if (config.serveWebDir && fs.existsSync(config.serveWebDir)) {
    const dir = config.serveWebDir;
    app.use(express.static(dir, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, file) => {
      if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    } }));
    app.get(['/', '/*splat'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dir, 'index.html'));
    });
  }

  app.use(errorHandler(log));
  return app;
}
