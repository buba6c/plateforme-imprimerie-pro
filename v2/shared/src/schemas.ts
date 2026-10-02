// Schémas de validation partagés (formulaires de l'interface et entrées de l'API).

import { z } from 'zod';
import { MACHINES, MODES_PAIEMENT, ROLES, STATUTS } from './domain';

const texte = (max: number) => z.string().trim().max(max);
const texteOpt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const UNITES_DIMENSION = ['mm', 'cm', 'm'] as const;
export type UniteDimension = (typeof UNITES_DIMENSION)[number];

export const choixSchema = z.object({
  code: z.string().trim().min(1).max(64),
  quantite: z.number().int().positive().max(1_000_000).optional(),
});
export type Choix = z.infer<typeof choixSchema>;

export const ligneRolandSchema = z.object({
  support: z.string().trim().min(1, 'Choisissez un support').max(64),
  largeur: z.number({ invalid_type_error: 'Largeur invalide' }).positive('Largeur invalide').max(100_000),
  hauteur: z.number({ invalid_type_error: 'Hauteur invalide' }).positive('Hauteur invalide').max(100_000),
  unite: z.enum(UNITES_DIMENSION).default('cm'),
  quantite: z.number().int().positive('Quantité invalide').max(100_000),
  finitions: z.array(choixSchema).max(20).default([]),
  options: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  description: texteOpt(500),
});
export type LigneRoland = z.infer<typeof ligneRolandSchema>;

export const ligneXeroxSchema = z.object({
  support: z.string().trim().min(1, 'Choisissez un format').max(64),
  pages: z.number().int().positive('Nombre de pages invalide').max(10_000),
  recto_verso: z.boolean().default(false),
  quantite: z.number().int().positive('Nombre d\'exemplaires invalide').max(1_000_000),
  finitions: z.array(choixSchema).max(20).default([]),
  options: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  description: texteOpt(500),
});
export type LigneXerox = z.infer<typeof ligneXeroxSchema>;

export const remiseSchema = z
  .object({
    type: z.enum(['montant', 'pourcent']),
    valeur: z.number().nonnegative().max(100_000_000),
    motif: texteOpt(200),
  })
  .refine((r) => r.type !== 'pourcent' || r.valeur <= 100, { message: 'Une remise ne peut pas dépasser 100 %' });
export type Remise = z.infer<typeof remiseSchema>;

const specsBase = {
  forfaits: z.array(choixSchema).max(20).default([]),
  remise: remiseSchema.nullable().optional(),
  /** Données d'origine d'un dossier importé de l'ancienne plateforme (lecture seule). */
  legacy: z.unknown().optional(),
};

export const specsRolandSchema = z.object({ lignes: z.array(ligneRolandSchema).max(50).default([]), ...specsBase });
export const specsXeroxSchema = z.object({ lignes: z.array(ligneXeroxSchema).max(50).default([]), ...specsBase });
export type SpecsRoland = z.infer<typeof specsRolandSchema>;
export type SpecsXerox = z.infer<typeof specsXeroxSchema>;
export type Specs = SpecsRoland | SpecsXerox;

export function specsSchemaFor(machine: (typeof MACHINES)[number]) {
  return machine === 'roland' ? specsRolandSchema : specsXeroxSchema;
}

export const telephoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ().-]*$/, 'Numéro de téléphone invalide')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)')
  .nullable()
  .optional();

export const dossierCreateSchema = z.object({
  machine: z.enum(MACHINES),
  client_id: z.number().int().positive().nullable().optional(),
  client_nom: texte(200).min(1, 'Indiquez le client'),
  client_telephone: telephoneSchema,
  client_email: z.string().trim().email('Adresse e-mail invalide').max(200).nullable().optional().or(z.literal('').transform(() => null)),
  description: texteOpt(2000),
  consignes: texteOpt(2000),
  specs: z.unknown(),
  /** Montant TTC saisi à la main ; sinon calculé à partir des spécifications. */
  montant: z.number().int().nonnegative().max(1_000_000_000).nullable().optional(),
  urgent: z.boolean().default(false),
  date_promise: dateIso,
  adresse_livraison: texteOpt(500),
  mode_paiement_prevu: z.enum(MODES_PAIEMENT).nullable().optional(),
});
export type DossierCreateInput = z.infer<typeof dossierCreateSchema>;

export const dossierUpdateSchema = dossierCreateSchema.partial().omit({ machine: true }).extend({
  machine: z.enum(MACHINES).optional(),
});
export type DossierUpdateInput = z.infer<typeof dossierUpdateSchema>;

export const actionInputSchema = z.object({
  commentaire: texteOpt(2000),
  livraison: z
    .object({
      date_prevue: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)),
      adresse: texteOpt(500),
      notes: texteOpt(1000),
    })
    .optional(),
  encaissement: z
    .object({
      montant: z.number().int().positive().max(1_000_000_000),
      mode: z.enum(MODES_PAIEMENT),
      reference: texteOpt(120),
    })
    .nullable()
    .optional(),
});
export type ActionInput = z.infer<typeof actionInputSchema>;

export const paiementInputSchema = z.object({
  montant: z.number({ invalid_type_error: 'Montant invalide' }).int('Montant entier, sans centimes').positive('Montant invalide').max(1_000_000_000),
  mode: z.enum(MODES_PAIEMENT),
  reference: texteOpt(120),
  notes: texteOpt(500),
});
export type PaiementInput = z.infer<typeof paiementInputSchema>;

export const userCreateSchema = z.object({
  nom: texte(120).min(1, 'Indiquez le nom'),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(200),
  role: z.enum(ROLES),
  telephone: telephoneSchema,
  password: z.string().min(8, 'Au moins 8 caractères').max(200),
});
export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial().extend({
  is_active: z.boolean().optional(),
});

export const passwordChangeSchema = z.object({
  actuel: z.string().min(1),
  nouveau: z.string().min(8, 'Au moins 8 caractères').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const statutSchema = z.enum(STATUTS);
