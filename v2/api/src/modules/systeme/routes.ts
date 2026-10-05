// Outils système de l'administrateur : numérotation, export / import de la configuration,
// réinitialisation encadrée de la plateforme. Toutes les routes sont réservées à l'administrateur.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';
import { loadConfig } from '../../config';
import { one } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, forbidden, HttpError, zodDetails } from '../../lib/errors';
import { contentDisposition } from '../fichiers/routes';
import { apercuImport, appliquerImport, exporterConfiguration, importSchema } from './configuration';
import { avancerNumerotation, etatNumerotation, numerotationSchema } from './numerotation';
import { etatReinitialisation, PHRASE, reinitialiser, VARIABLE, verifierTentatives } from './reinitialisation';

export const systemeRouter = Router();
systemeRouter.use(requireAuth, requireRole('admin'));

// Relue à chaque appel : ces routes sont rares et dépendent de variables d'environnement (ALLOW_SYSTEM_RESET).
const config = () => loadConfig();

// ---------------------------------------------------------------------------
// Numérotation

systemeRouter.get('/numerotation', async (_req, res) => {
  res.json(await etatNumerotation());
});

systemeRouter.put('/numerotation', async (req, res) => {
  const input = numerotationSchema.parse(req.body ?? {});
  res.json(await avancerNumerotation(req, input));
});

// ---------------------------------------------------------------------------
// Export / import de la configuration

systemeRouter.get('/configuration', async (req, res) => {
  const contenu = await exporterConfiguration(me(req));
  await journal(req, 'configuration_exportee', 'configuration', null, { tarifs: contenu.tarifs.length });
  res.setHeader('Content-Disposition', contentDisposition('attachment', `evocom-configuration-${contenu.exporte_le.slice(0, 10)}.json`));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(contenu);
});

/** Erreurs de validation du fichier, avec le chemin de chaque champ fautif. */
function lireImport(body: unknown) {
  const r = importSchema.safeParse(body ?? {});
  if (!r.success) {
    throw badRequest("Le fichier de configuration est invalide : rien n'a été importé.", { champs: zodDetails(r.error as ZodError) });
  }
  return r.data;
}

systemeRouter.post('/configuration/apercu', async (req, res) => {
  res.json(await apercuImport(lireImport(req.body)));
});

systemeRouter.post('/configuration/importer', async (req, res) => {
  res.json(await appliquerImport(req, lireImport(req.body)));
});

// ---------------------------------------------------------------------------
// Réinitialisation de la plateforme

systemeRouter.get('/reinitialisation', async (req, res) => {
  res.json(await etatReinitialisation(config(), me(req).id));
});

const reinitialisationSchema = z.object({
  mot_de_passe: z.string({ required_error: 'Saisissez votre mot de passe', invalid_type_error: 'Mot de passe : texte attendu' }).min(1, 'Saisissez votre mot de passe').max(200),
  phrase: z.string({ required_error: `Recopiez la phrase ${PHRASE}`, invalid_type_error: 'Phrase : texte attendu' }).max(100),
});

let enCours = false;

systemeRouter.post('/reinitialiser', async (req, res) => {
  const cfg = config();
  const user = me(req);
  if (!cfg.allowSystemReset) {
    throw forbidden(
      `La réinitialisation est désactivée sur ce serveur. Pour l'autoriser, ajoutez ${VARIABLE}=true dans le fichier .env de l'API puis redémarrez-la ; remettez ${VARIABLE}=false une fois l'opération terminée.`,
    );
  }
  if (enCours) throw conflict('Une réinitialisation est déjà en cours.');
  await verifierTentatives(user.id);

  const refuser = async (motif: string, message: string, champs: Record<string, string>) => {
    await journal(req, 'reinitialisation_refusee', 'systeme', null, { motif });
    throw badRequest(message, { champs });
  };
  const parsed = reinitialisationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return refuser('requete_invalide', 'Saisissez votre mot de passe et recopiez la phrase de confirmation.', zodDetails(parsed.error));
  const { mot_de_passe, phrase } = parsed.data;
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
  if (!u || !(await bcrypt.compare(mot_de_passe, u.password_hash))) {
    return refuser('mot_de_passe', 'Mot de passe incorrect : la réinitialisation n’a pas été lancée.', { mot_de_passe: 'Mot de passe incorrect' });
  }
  if (phrase.trim() !== PHRASE) {
    return refuser('phrase', `La phrase de confirmation ne correspond pas : recopiez exactement ${PHRASE}.`, { phrase: `Recopiez exactement : ${PHRASE}` });
  }

  enCours = true;
  try {
    res.json(await reinitialiser(req, cfg));
  } catch (e) {
    const err = e as HttpError;
    await journal(req, 'reinitialisation_echouee', 'systeme', null, { message: err.message, details: err.details ?? null }).catch(() => {});
    throw e;
  } finally {
    enCours = false;
  }
});
