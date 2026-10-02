import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details, 'requete_invalide');
export const unauthorized = (message = 'Connectez-vous pour continuer.') => new HttpError(401, message, undefined, 'non_connecte');
export const forbidden = (message = "Vous n'avez pas accès à cette ressource.") => new HttpError(403, message, undefined, 'interdit');
export const notFound = (message = 'Élément introuvable.') => new HttpError(404, message, undefined, 'introuvable');
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details, 'conflit');
export const unprocessable = (message: string, details?: unknown) => new HttpError(422, message, details, 'invalide');

export function zodDetails(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function errorHandler(log: { error: (o: unknown, m?: string) => void }) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Certains champs sont invalides.', code: 'requete_invalide', champs: zodDetails(err) });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    }
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
    if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Corps de requête JSON invalide.' });
    log.error({ err, url: req.originalUrl, method: req.method }, 'Erreur non gérée');
    return res.status(500).json({ error: "Une erreur inattendue s'est produite. Réessayez ; si elle persiste, prévenez l'administrateur.", code: 'erreur_serveur' });
  };
}
