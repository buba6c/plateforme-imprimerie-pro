// Réglages du module WhatsApp : ligne « whatsapp » de la table parametres (administrateur seulement).
// Lus à chaque passage de la file (cache de 10 s), jamais exposés aux autres rôles.

import { z } from 'zod';
import { one, type Db } from '../../db/pool';

export const EVENEMENTS_WHATSAPP = ['pret_livraison', 'pret_retrait', 'en_livraison', 'livre'] as const;
export type EvenementWhatsApp = (typeof EVENEMENTS_WHATSAPP)[number];

export const EVENEMENT_LABELS: Record<EvenementWhatsApp | 'test', string> = {
  pret_livraison: 'Commande prête, livraison à venir',
  pret_retrait: 'Commande prête, à retirer',
  en_livraison: 'Livraison programmée',
  livre: 'Commande livrée ou remise',
  test: 'Message de test',
};

/** Variables acceptées dans les modèles (remplacées à la planification du message). */
export const VARIABLES_MODELE = ['client', 'numero', 'travail', 'montant', 'adresse', 'entreprise', 'date'] as const;
export type VariableModele = (typeof VARIABLES_MODELE)[number];

export interface ParametresWhatsApp {
  actif: boolean;
  modeles: Record<EvenementWhatsApp, string>;
  /** Heures d'envoi (HH:MM, fuseau des paramètres) : en dehors, les messages attendent. */
  heures: { debut: string; fin: string };
  limites: { par_heure: number; par_jour: number };
  /** Délai aléatoire entre deux envois, en secondes. */
  delai: { min_s: number; max_s: number };
  /** Ajoutée à la fin de chaque message (vide = rien). */
  signature: string;
}

export const PARAMETRES_WHATSAPP_DEFAUT: ParametresWhatsApp = {
  actif: false,
  modeles: {
    pret_livraison:
      'Bonjour {client}, votre commande {numero} ({travail}) est imprimée et prête : notre livreur vous contactera pour la livraison.',
    pret_retrait: 'Bonjour {client}, votre commande {numero} ({travail}) est imprimée et prête : vous pouvez venir la retirer à {entreprise}, {adresse}.',
    en_livraison: 'Bonjour {client}, votre commande {numero} ({travail}) sera livrée le {date}. Notre livreur vous appellera avant de passer.',
    livre: 'Bonjour {client}, votre commande {numero} ({travail}) a été livrée. Merci pour votre confiance !',
  },
  heures: { debut: '08:00', fin: '20:00' },
  limites: { par_heure: 20, par_jour: 120 },
  delai: { min_s: 25, max_s: 90 },
  signature: '',
};

const heure = (libelle: string) =>
  z
    .string({ invalid_type_error: `${libelle} : heure attendue (HH:MM)` })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${libelle} : heure au format HH:MM (ex. 08:00)`);

const entier = (libelle: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${libelle} : nombre attendu` })
    .int(`${libelle} : nombre entier`)
    .min(min, `${libelle} : ${min} au minimum`)
    .max(max, `${libelle} : ${max} au maximum`);

const modele = (libelle: string) =>
  z
    .string({ invalid_type_error: `${libelle} : texte attendu` })
    .trim()
    .min(10, `${libelle} : 10 caractères au minimum`)
    .max(700, `${libelle} : 700 caractères au maximum`)
    .refine((v) => !/https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd|rb\.gy)\//i.test(v), `${libelle} : pas de lien raccourci (WhatsApp les traite comme du spam)`);

/** Corps de PUT /parametres/whatsapp : chaque partie est facultative et fusionnée avec l'existant. */
export const parametresWhatsAppSchema = z
  .object({
    actif: z.boolean({ invalid_type_error: 'Activation : oui ou non' }),
    modeles: z
      .object({
        pret_livraison: modele('Modèle « prête, livraison »'),
        pret_retrait: modele('Modèle « prête, retrait »'),
        en_livraison: modele('Modèle « livraison programmée »'),
        livre: modele('Modèle « livrée »'),
      })
      .partial()
      .strict('Événement inconnu'),
    heures: z
      .object({ debut: heure("Début des envois"), fin: heure('Fin des envois') })
      .partial()
      .strict('Champ inconnu'),
    limites: z
      .object({ par_heure: entier('Limite par heure', 1, 60), par_jour: entier('Limite par jour', 1, 500) })
      .partial()
      .strict('Champ inconnu'),
    delai: z
      .object({ min_s: entier('Délai minimum', 5, 600), max_s: entier('Délai maximum', 5, 900) })
      .partial()
      .strict('Champ inconnu'),
    signature: z.string({ invalid_type_error: 'Signature : texte attendu' }).trim().max(120, 'Signature : 120 caractères au maximum'),
  })
  .partial()
  .strict('Section inconnue');
export type ParametresWhatsAppInput = z.infer<typeof parametresWhatsAppSchema>;

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function completer(brut: unknown): ParametresWhatsApp {
  const d = PARAMETRES_WHATSAPP_DEFAUT;
  const o = objet(brut);
  const modeles = objet(o.modeles);
  return {
    actif: o.actif === true,
    modeles: Object.fromEntries(
      EVENEMENTS_WHATSAPP.map((e) => [e, typeof modeles[e] === 'string' && (modeles[e] as string).trim() ? (modeles[e] as string) : d.modeles[e]]),
    ) as Record<EvenementWhatsApp, string>,
    heures: { ...d.heures, ...objet(o.heures) } as ParametresWhatsApp['heures'],
    limites: { ...d.limites, ...objet(o.limites) } as ParametresWhatsApp['limites'],
    delai: { ...d.delai, ...objet(o.delai) } as ParametresWhatsApp['delai'],
    signature: typeof o.signature === 'string' ? o.signature : d.signature,
  };
}

let cache: { at: number; value: ParametresWhatsApp } | null = null;

export async function getParametresWhatsApp(db?: Db): Promise<ParametresWhatsApp> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  const row = await one<{ valeur: unknown }>(`SELECT valeur FROM parametres WHERE cle = 'whatsapp'`, [], db);
  const value = completer(row?.valeur);
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateParametresWhatsApp() {
  cache = null;
}

/** Réglages obtenus en appliquant `input` sur `avant` ; vérifie la cohérence des heures et des délais. */
export function fusionnerParametresWhatsApp(avant: ParametresWhatsApp, input: ParametresWhatsAppInput): { apres: ParametresWhatsApp; erreurs: Record<string, string> } {
  const sans = <T extends object>(o: T | undefined): Partial<T> => (o ? (Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>) : {});
  const apres: ParametresWhatsApp = {
    actif: input.actif ?? avant.actif,
    modeles: { ...avant.modeles, ...sans(input.modeles) },
    heures: { ...avant.heures, ...sans(input.heures) },
    limites: { ...avant.limites, ...sans(input.limites) },
    delai: { ...avant.delai, ...sans(input.delai) },
    signature: input.signature ?? avant.signature,
  };
  const erreurs: Record<string, string> = {};
  if (apres.heures.debut >= apres.heures.fin) erreurs['heures.fin'] = "L'heure de fin doit être après l'heure de début.";
  if (apres.delai.min_s > apres.delai.max_s) erreurs['delai.max_s'] = 'Le délai maximum doit être au moins égal au délai minimum.';
  return { apres, erreurs };
}

export async function ecrireParametresWhatsApp(db: Db, valeur: ParametresWhatsApp, userId: number | null): Promise<void> {
  await db.query(
    `INSERT INTO parametres (cle, valeur, updated_by, updated_at) VALUES ('whatsapp', $1, $2, now())
     ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(valeur), userId],
  );
  invalidateParametresWhatsApp();
}
