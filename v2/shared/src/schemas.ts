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

// Choix structurés d'une ligne. Les champs facultatifs ci-dessous enrichissent la commande ; ceux qui
// ont un prix passent par la grille (codes de tarif), les autres sont seulement informatifs (résumé,
// bon de travail). Les spécifications enregistrées avant leur ajout restent valides.

/** Type de document Xerox (informatif ; pré-remplit la ligne dans le formulaire). */
export const TYPES_DOCUMENT = ['carte_visite', 'flyer', 'brochure', 'depliant', 'affiche', 'catalogue', 'document', 'autre'] as const;
export type TypeDocument = (typeof TYPES_DOCUMENT)[number];
/** Partie d'un document en plusieurs parties (brochure : couverture + intérieur). Informatif. */
export const PARTIES_LIGNE = ['unique', 'couverture', 'interieur', 'encart'] as const;
export type PartieLigne = (typeof PARTIES_LIGNE)[number];
/** Format fini Xerox ; avec la couleur, il donne le code du support (papier_<format>_<couleur>). */
export const FORMATS_XEROX = ['a6', 'a5', 'a4', 'a3', 'sra3', 'cdv_85x55', 'cdv_90x50', '10x15', '13x18', '20x30', 'perso'] as const;
export type FormatXerox = (typeof FORMATS_XEROX)[number];
export const COULEURS_IMPRESSION = ['couleur', 'nb'] as const;
export type CouleurImpression = (typeof COULEURS_IMPRESSION)[number];
/** Papier : l'ordinaire 80 g est compris dans le prix du format, les autres ajoutent un supplément par feuille. */
export const PAPIERS_XEROX = ['ordinaire_80', 'couche_135', 'couche_170', 'couche_250', 'couche_300', 'couche_350', 'autocollant', 'offset', 'grimat'] as const;
export type PapierXerox = (typeof PAPIERS_XEROX)[number];
export const PELLICULAGES = ['mat', 'brillant'] as const;
export const FACES_PELLICULAGE = ['recto', 'recto_verso'] as const;
/** Conditionnement (informatif). */
export const CONDITIONNEMENTS = ['liasse_50', 'liasse_100', 'filme', 'etiquete'] as const;
export type Conditionnement = (typeof CONDITIONNEMENTS)[number];
/** Bords d'un grand format : œillets, ourlet ou collage ont chacun leur tarif. */
export const BORDS_ROLAND = ['aucun', 'oeillets', 'ourlet', 'collage'] as const;
export type BordsRoland = (typeof BORDS_ROLAND)[number];
export const POSITIONS_OEILLETS = ['angles', 'tous_cotes'] as const;
export type PositionOeillets = (typeof POSITIONS_OEILLETS)[number];
export const ESPACEMENT_OEILLETS_DEFAUT_CM = 50;

export const oeilletsSchema = z.object({
  position: z.enum(POSITIONS_OEILLETS).default('tous_cotes'),
  /** Écart entre deux œillets, en cm (seulement « tous les côtés »). */
  espacement_cm: z.number({ invalid_type_error: 'Espacement invalide' }).min(5, 'Espacement : 5 cm au minimum').max(500, 'Espacement : 500 cm au maximum').default(ESPACEMENT_OEILLETS_DEFAUT_CM),
});
export type Oeillets = z.infer<typeof oeilletsSchema>;

export const ligneRolandSchema = z.object({
  support: z.string().trim().min(1, 'Choisissez un support').max(64),
  largeur: z.number({ invalid_type_error: 'Largeur invalide' }).positive('Largeur invalide').max(100_000),
  hauteur: z.number({ invalid_type_error: 'Hauteur invalide' }).positive('Hauteur invalide').max(100_000),
  unite: z.enum(UNITES_DIMENSION).default('cm'),
  quantite: z.number().int().positive('Quantité invalide').max(100_000),
  finitions: z.array(choixSchema).max(20).default([]),
  options: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  description: texteOpt(500),
  bords: z.enum(BORDS_ROLAND).nullable().optional(),
  /** Pose des œillets quand bords = « oeillets » : le nombre est calculé par le moteur de prix. */
  oeillets: oeilletsSchema.nullable().optional(),
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
  type_document: z.enum(TYPES_DOCUMENT).nullable().optional(),
  partie: z.enum(PARTIES_LIGNE).nullable().optional(),
  format: z.enum(FORMATS_XEROX).nullable().optional(),
  /** Format personnalisé, en mm (informatif : le prix suit le support choisi). */
  format_largeur: z.number({ invalid_type_error: 'Largeur invalide' }).positive('Largeur invalide').max(2000, 'Largeur : 2 000 mm au maximum').nullable().optional(),
  format_hauteur: z.number({ invalid_type_error: 'Hauteur invalide' }).positive('Hauteur invalide').max(2000, 'Hauteur : 2 000 mm au maximum').nullable().optional(),
  couleur: z.enum(COULEURS_IMPRESSION).nullable().optional(),
  papier: z.enum(PAPIERS_XEROX).nullable().optional(),
  pelliculage: z.object({ type: z.enum(PELLICULAGES), faces: z.enum(FACES_PELLICULAGE).default('recto') }).nullable().optional(),
  numerotation: z
    .object({
      depart: z.number({ invalid_type_error: 'Numéro de départ invalide' }).int('Numéro de départ : nombre entier').nonnegative().max(999_999_999).default(1),
      chiffres: z.number({ invalid_type_error: 'Nombre de chiffres invalide' }).int().min(1, 'Au moins 1 chiffre').max(10, '10 chiffres au maximum').default(4),
    })
    .nullable()
    .optional(),
  conditionnement: z.array(z.enum(CONDITIONNEMENTS)).max(CONDITIONNEMENTS.length).optional(),
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
  /** La conception graphique (forfait conception_graphique) est offerte : sa valeur est déduite, visible sur le devis. */
  conception_offerte: z.boolean().optional(),
  /** Personne à contacter sur place pour une livraison (nom, téléphone). */
  livraison_contact: texteOpt(200),
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
  /** livraison : le livreur l'apporte ; retrait : le client vient le chercher sur place. */
  mode_remise: z.enum(['livraison', 'retrait']).default('livraison'),
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
