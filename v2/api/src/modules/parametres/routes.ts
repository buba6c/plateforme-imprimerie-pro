// Paramètres de l'entreprise et règles de calcul des prix.
// Lecture : tous les rôles (aucune donnée sensible). Écriture : administrateur, journalisée.

import { Router } from 'express';
import { z } from 'zod';
import { one, tx } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest } from '../../lib/errors';
import { getParametres, invalidateParametres, type Parametres } from '../../lib/params';

export const parametresRouter = Router();
parametresRouter.use(requireAuth);

const champ = (libelle: string) =>
  z
    .string({ invalid_type_error: `${libelle} : texte attendu` })
    .trim()
    .max(200, `${libelle} : 200 caractères au maximum`);

const entrepriseSchema = z
  .object({
    nom: champ("Nom de l'entreprise").min(1, "Le nom de l'entreprise ne peut pas être vide"),
    adresse: champ('Adresse'),
    telephone: champ('Téléphone'),
    email: champ('E-mail').refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Adresse e-mail invalide'),
    ninea: champ('NINEA'),
    rccm: champ('RCCM'),
    pied_facture: champ('Pied de facture'),
  })
  .partial();

const nombre = (libelle: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${libelle} : nombre attendu`, required_error: `${libelle} : valeur manquante` })
    .min(min, `${libelle} : ${min} au minimum`)
    .max(max, `${libelle} : ${max} au maximum`);

const prixSchema = z
  .object({
    arrondi_pas: nombre("Pas d'arrondi", 0, 10_000).int("Pas d'arrondi : nombre entier de FCFA"),
    tva_applicable: z.boolean({ invalid_type_error: 'TVA applicable : oui ou non' }),
    tva_taux: nombre('Taux de TVA', 0, 100),
    prix_saisis_ht: z.boolean({ invalid_type_error: 'Prix saisis hors taxes : oui ou non' }),
    surface_min_m2: nombre('Surface minimale facturée', 0, 100),
  })
  .partial();

const parametresSchema = z.object({
  entreprise: entrepriseSchema.optional(),
  prix: prixSchema.optional(),
  livreur_jours_historique: nombre('Historique du livreur (jours)', 1, 90).int('Historique du livreur : nombre entier de jours').optional(),
  fuseau: z.string({ invalid_type_error: 'Fuseau horaire : texte attendu' }).trim().min(1).max(64).optional(),
});

function fuseauValide(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

parametresRouter.get('/', async (_req, res) => {
  res.json(await getParametres());
});

parametresRouter.put('/', requireRole('admin'), async (req, res) => {
  const input = parametresSchema.parse(req.body ?? {});
  invalidateParametres();
  const avant = await getParametres();

  if (input.fuseau !== undefined) {
    const connu = await one(`SELECT 1 FROM pg_timezone_names WHERE name = $1`, [input.fuseau]);
    if (!fuseauValide(input.fuseau) || !connu) {
      throw badRequest(`Fuseau horaire « ${input.fuseau} » inconnu : utilisez un nom IANA, par exemple Africa/Dakar.`, {
        champs: { fuseau: 'Fuseau horaire inconnu' },
      });
    }
  }

  const apres: Parametres = {
    entreprise: { ...avant.entreprise, ...stripUndefined(input.entreprise) },
    prix: { ...avant.prix, ...stripUndefined(input.prix) },
    livreur_jours_historique: input.livreur_jours_historique ?? avant.livreur_jours_historique,
    fuseau: input.fuseau ?? avant.fuseau,
  };

  const changements: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const cle of Object.keys(apres) as (keyof Parametres)[]) {
    if (JSON.stringify(avant[cle]) !== JSON.stringify(apres[cle])) changements[cle] = { avant: avant[cle], apres: apres[cle] };
  }

  if (Object.keys(changements).length) {
    await tx(async (db) => {
      for (const cle of Object.keys(changements) as (keyof Parametres)[]) {
        await db.query(
          `INSERT INTO parametres (cle, valeur, updated_by, updated_at) VALUES ($1, $2, $3, now())
           ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [cle, JSON.stringify(apres[cle]), me(req).id],
        );
      }
      await journal(req, 'parametres_modifies', 'parametres', null, changements, db);
    });
  }
  invalidateParametres();
  res.json(await getParametres());
});

function stripUndefined<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
