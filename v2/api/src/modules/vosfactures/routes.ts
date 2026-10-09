// Réglages de la liaison VosFactures (administrateur) : sous-domaine, clé API chiffrée (jamais
// renvoyée), envoi automatique, vendeur par défaut, test de connexion. Monté sous
// /api/factures/vosfactures par le module des factures.

import { Router } from 'express';
import { z } from 'zod';
import { tx } from '../../db/pool';
import { me, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { conflict } from '../../lib/errors';
import { getParametres } from '../../lib/params';
import { SOUS_DOMAINE_RE, testerConnexion } from './client';
import { chiffrerCle, compteEnClair, ecrireConfigVosFactures, lireConfigVosFactures, VENDEUR_VIDE, vueConfigVosFactures } from './config';

export const vosfacturesRouter = Router();
vosfacturesRouter.use(requireRole('admin'));

const texte = (libelle: string, max: number) => z.string({ invalid_type_error: `${libelle} : texte attendu` }).trim().max(max, `${libelle} : ${max} caractères au maximum`);

const sousDomaineSchema = texte('Sous-domaine', 63)
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, '').replace(/\.vosfactures\.fr.*$/, '').replace(/\/.*$/, ''))
  .refine((v) => v === '' || SOUS_DOMAINE_RE.test(v), 'Sous-domaine invalide : indiquez seulement la partie avant .vosfactures.fr (lettres, chiffres, tirets)');

const cleSchema = texte('Clé API', 200)
  .min(16, 'Clé trop courte : copiez la clé API complète affichée dans VosFactures')
  .regex(/^[\x21-\x7e]+$/, 'Clé API invalide : elle ne contient ni espace ni accent');

const vendeurSchema = z
  .object({
    nom: texte('Nom du vendeur', 200),
    adresse: texte('Adresse du vendeur', 300),
    nif: texte('NINEA / identifiant fiscal', 50),
    email: texte('E-mail du vendeur', 200).refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail du vendeur invalide'),
    telephone: texte('Téléphone du vendeur', 50),
  })
  .partial();

const configSchema = z.object({
  sous_domaine: sousDomaineSchema.optional(),
  cle: cleSchema.nullable().optional(),
  envoi_auto: z.boolean({ invalid_type_error: 'Envoi automatique : oui ou non' }).optional(),
  vendeur: vendeurSchema.optional(),
});

vosfacturesRouter.get('/config', async (_req, res) => {
  res.json(vueConfigVosFactures(await lireConfigVosFactures(), (await getParametres()).entreprise));
});

vosfacturesRouter.put('/config', async (req, res) => {
  const input = configSchema.parse(req.body ?? {});
  const avant = await lireConfigVosFactures();
  const changements: Record<string, unknown> = {};

  let cleChiffree = avant.cle_chiffree;
  let cleFin = avant.cle_fin;
  if (input.cle === null) {
    if (avant.cle_chiffree) changements.cle = 'effacee';
    cleChiffree = null;
    cleFin = null;
  } else if (input.cle !== undefined) {
    changements.cle = avant.cle_chiffree ? 'remplacee' : 'enregistree';
    ({ cle_chiffree: cleChiffree, cle_fin: cleFin } = chiffrerCle(input.cle));
  }
  const sousDomaine = input.sous_domaine ?? avant.sous_domaine;
  if (sousDomaine !== avant.sous_domaine) changements.sous_domaine = { avant: avant.sous_domaine, apres: sousDomaine };

  // Sans compte complet, l'envoi automatique ne peut pas être activé.
  let envoiAuto = input.envoi_auto ?? avant.envoi_auto;
  if (!cleChiffree || !sousDomaine) {
    if (input.envoi_auto === true) throw conflict("Enregistrez d'abord le sous-domaine et la clé API pour activer l'envoi automatique.");
    envoiAuto = false;
  }
  if (envoiAuto !== avant.envoi_auto) changements.envoi_auto = { avant: avant.envoi_auto, apres: envoiAuto };

  const vendeur = { ...VENDEUR_VIDE, ...(avant.vendeur ?? {}), ...(input.vendeur ?? {}) };
  if (JSON.stringify(vendeur) !== JSON.stringify({ ...VENDEUR_VIDE, ...(avant.vendeur ?? {}) })) changements.vendeur = { avant: avant.vendeur, apres: vendeur };

  if (Object.keys(changements).length) {
    await tx(async (db) => {
      await ecrireConfigVosFactures(db, { sous_domaine: sousDomaine, cle_chiffree: cleChiffree, cle_fin: cleFin, envoi_auto: envoiAuto, vendeur }, me(req).id);
      await journal(req, 'vosfactures_config_modifiee', 'vosfactures_config', null, changements, db);
    });
  }
  res.json(vueConfigVosFactures(await lireConfigVosFactures(), (await getParametres()).entreprise));
});

const testSchema = z.object({
  /** Valeurs à essayer avant de les enregistrer ; sinon celles enregistrées. */
  sous_domaine: sousDomaineSchema.optional(),
  cle: cleSchema.optional(),
});

/** GET /invoices.json?page=1&per_page=1 sur le compte : la clé et le sous-domaine sont-ils bons ? */
vosfacturesRouter.post('/test', async (req, res) => {
  const input = testSchema.parse(req.body ?? {});
  const config = await lireConfigVosFactures();
  const sousDomaine = input.sous_domaine || config.sous_domaine;
  if (!sousDomaine) throw conflict('Indiquez le sous-domaine du compte VosFactures avant de tester la connexion.');
  const cle = input.cle ?? (config.cle_chiffree ? compteEnClair({ ...config, sous_domaine: sousDomaine }).cle : null);
  if (!cle) throw conflict('Indiquez la clé API VosFactures avant de tester la connexion.');
  const debut = Date.now();
  const r = await testerConnexion({ sousDomaine, cle });
  await journal(req, 'vosfactures_test_connexion', 'vosfactures_config', null, { sous_domaine: sousDomaine, ok: true });
  res.json({ ok: true, sous_domaine: sousDomaine, nb_factures_visibles: r.nb_factures_visibles, duree_ms: Date.now() - debut });
});
