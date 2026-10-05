// Paramètres de l'entreprise, règles de calcul des prix et réglages de l'application.
// Lecture : l'administrateur voit tout ; les autres rôles, les sections publiques (aucune donnée sensible)
// et les règles utiles à la saisie (/regles). Écriture : administrateur, journalisée.

import { Router } from 'express';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { tx } from '../../db/pool';
import { getParametres, invalidateParametres, plafondsServeur, SECTIONS_PUBLIQUES, type Parametres } from '../../lib/params';
import { parametresSchema } from './schemas';
import { ecrire, fusionner, parametresFrais } from './service';

export const parametresRouter = Router();
parametresRouter.use(requireAuth);

function pourRole(p: Parametres, admin: boolean) {
  if (admin) return p;
  return Object.fromEntries(SECTIONS_PUBLIQUES.map((k) => [k, p[k]]));
}

parametresRouter.get('/', async (req, res) => {
  res.json(pourRole(await getParametres(), me(req).role === 'admin'));
});

/** Règles que l'interface affiche ou vérifie avant d'envoyer (tous les rôles). */
parametresRouter.get('/regles', async (_req, res) => {
  const p = await getParametres();
  res.json({
    fichiers: { ...p.fichiers, plafond_serveur_mo: plafondsServeur().taille_max_mo },
    securite: { mdp_longueur_min: p.securite.mdp_longueur_min },
    documents: { devis_validite_jours: p.documents.devis_validite_jours },
  });
});

parametresRouter.put('/', requireRole('admin'), async (req, res) => {
  const input = parametresSchema().parse(req.body ?? {});
  const { apres, changements } = await fusionner(await parametresFrais(), input);
  if (Object.keys(changements).length) {
    await tx(async (db) => {
      await ecrire(db, req, apres, changements);
      await journal(req, 'parametres_modifies', 'parametres', null, changements, db);
    });
  }
  invalidateParametres();
  res.json(await getParametres());
});
