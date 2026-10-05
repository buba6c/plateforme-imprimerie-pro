// Validation des paramètres : partagée par PUT /parametres et l'import de configuration.

import { z } from 'zod';
import { plafondsServeur, TYPES_NOTIFICATION } from '../../lib/params';

const champ = (libelle: string, max = 200) =>
  z
    .string({ invalid_type_error: `${libelle} : texte attendu` })
    .trim()
    .max(max, `${libelle} : ${max} caractères au maximum`);

const nombre = (libelle: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${libelle} : nombre attendu`, required_error: `${libelle} : valeur manquante` })
    .min(min, `${libelle} : ${min} au minimum`)
    .max(max, `${libelle} : ${max} au maximum`);

const entier = (libelle: string, min: number, max: number, unite = '') =>
  nombre(libelle, min, max).int(`${libelle} : nombre entier${unite ? ` de ${unite}` : ''}`);

const oui = (libelle: string) => z.boolean({ invalid_type_error: `${libelle} : oui ou non` });

export const entrepriseSchema = z
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

export const prixSchema = z
  .object({
    arrondi_pas: entier("Pas d'arrondi", 0, 10_000, 'FCFA'),
    tva_applicable: oui('TVA applicable'),
    tva_taux: nombre('Taux de TVA', 0, 100),
    prix_saisis_ht: oui('Prix saisis hors taxes'),
    surface_min_m2: nombre('Surface minimale facturée', 0, 100),
  })
  .partial();

export const securiteSchema = z
  .object({
    session_heures: entier('Durée de session', 1, 720, 'heures'),
    echecs_avant_blocage: entier('Échecs avant blocage', 3, 20),
    blocage_minutes: entier('Durée du blocage', 1, 1440, 'minutes'),
    mdp_longueur_min: entier('Longueur minimale des mots de passe', 8, 64, 'caractères'),
  })
  .partial();

const extension = z
  .string({ invalid_type_error: 'Extension : texte attendu' })
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^\.+/, ''))
  .refine((v) => /^[a-z0-9]{1,10}$/.test(v), (v) => ({ message: `Extension « ${v} » invalide : lettres et chiffres uniquement, 10 au plus (ex. pdf)` }));

/** Le plafond est lu à chaque validation : il dépend de MAX_UPLOAD_MB. */
export const fichiersSchema = () => {
  const plafond = plafondsServeur().taille_max_mo;
  return z
    .object({
      taille_max_mo: z
        .number({ invalid_type_error: 'Taille maximale par fichier : nombre attendu' })
        .int('Taille maximale par fichier : nombre entier de Mo')
        .min(1, 'Taille maximale par fichier : 1 Mo au minimum')
        .max(plafond, `Taille maximale par fichier : le serveur accepte au plus ${plafond} Mo (variable MAX_UPLOAD_MB)`),
      extensions: z
        .array(extension, { invalid_type_error: 'Extensions : liste attendue' })
        .max(60, 'Extensions : 60 au maximum')
        .transform((l) => [...new Set(l)].sort()),
    })
    .partial();
};

export const documentsSchema = z
  .object({
    devis_validite_jours: entier('Validité des devis', 1, 365, 'jours'),
    mentions_devis: champ('Mentions des devis', 1000),
    conditions_paiement: champ('Conditions de paiement', 1000),
  })
  .partial();

export const notificationsSchema = z
  .object(Object.fromEntries(TYPES_NOTIFICATION.map((t) => [t, oui(`Notification ${t}`)])) as Record<(typeof TYPES_NOTIFICATION)[number], z.ZodBoolean>)
  .partial()
  .strict('Type de notification inconnu');

/** Corps de PUT /parametres : chaque section est facultative et fusionnée avec l'existant. */
export function parametresSchema(strict = false) {
  const s = (o: z.AnyZodObject) => (strict ? o.strict('Champ inconnu') : o);
  const schema = z.object({
    entreprise: s(entrepriseSchema).optional(),
    prix: s(prixSchema).optional(),
    livreur_jours_historique: entier('Historique du livreur', 1, 90, 'jours').optional(),
    fuseau: z.string({ invalid_type_error: 'Fuseau horaire : texte attendu' }).trim().min(1).max(64).optional(),
    securite: s(securiteSchema).optional(),
    fichiers: s(fichiersSchema()).optional(),
    documents: s(documentsSchema).optional(),
    notifications: notificationsSchema.optional(),
  });
  return strict ? schema.strict('Section de paramètres inconnue') : schema;
}
export type ParametresInput = z.infer<ReturnType<typeof parametresSchema>>;
