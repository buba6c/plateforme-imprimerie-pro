// Assistant IA de saisie : propose des spécifications de dossier ou de devis à partir de la
// description d'une demande. Il ne crée ni ne modifie rien ; le prix est recalculé par le
// serveur avec la grille. Configuration (clé chiffrée, modèle) réservée à l'administrateur.

import { Router, type Request } from 'express';
import { z } from 'zod';
import { calculerPrix, MACHINES } from '@evocom/shared';
import { one, query, tx } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { conflict, HttpError } from '../../lib/errors';
import { qInt } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { getTarifs } from '../../lib/tarifs';
import { chiffrer, CleIllisible, dechiffrer } from './chiffrement';
import { appelerOpenAI, ErreurOpenAI, MODELES_IA, type StatutAppel } from './openai';
import { messagesSuggestion, nettoyerSuggestion, reponseIASchema, schemaReponse } from './suggestion';

export const iaRouter = Router();
iaRouter.use(requireAuth);

const PAS_ACTIF = "L'assistant n'est pas activé.";

interface ConfigIA {
  actif: boolean;
  modele: string;
  cle_chiffree: string | null;
  cle_fin: string | null;
  updated_at: string | null;
  updated_by_nom: string | null;
}

async function lireConfig(): Promise<ConfigIA> {
  const c = await one<ConfigIA>(
    `SELECT c.actif, c.modele, c.cle_chiffree, c.cle_fin, c.updated_at, u.nom AS updated_by_nom
     FROM ia_config c LEFT JOIN users u ON u.id = c.updated_by WHERE c.id = 1`,
  );
  return c ?? { actif: false, modele: MODELES_IA[0], cle_chiffree: null, cle_fin: null, updated_at: null, updated_by_nom: null };
}

function cleLisible(c: ConfigIA): boolean {
  if (!c.cle_chiffree) return false;
  try {
    dechiffrer(c.cle_chiffree);
    return true;
  } catch {
    return false;
  }
}

/** Ce que voit l'administrateur : jamais la clé, seulement ses 4 derniers caractères. */
function versVue(c: ConfigIA) {
  const configuree = !!c.cle_chiffree;
  return {
    actif: c.actif && configuree,
    modele: c.modele,
    modeles: MODELES_IA,
    cle_configuree: configuree,
    cle_fin: configuree ? c.cle_fin : null,
    cle_lisible: configuree ? cleLisible(c) : null,
    updated_at: c.updated_at,
    updated_by_nom: c.updated_by_nom,
  };
}

/** Clé en clair, pour l'appel seulement ; 409 si le secret de chiffrement a changé. */
function cleEnClair(c: ConfigIA): string {
  if (!c.cle_chiffree) throw conflict("Aucune clé OpenAI n'est enregistrée : saisissez-la dans Administration, Assistant IA.");
  try {
    return dechiffrer(c.cle_chiffree);
  } catch (e) {
    if (e instanceof CleIllisible) throw new HttpError(409, e.message, undefined, 'ia_cle_illisible');
    throw e;
  }
}

async function noterUsage(
  req: Request,
  u: { type: 'suggestion' | 'test'; statut: StatutAppel; modele: string; debut: number; jetons_entree?: number | null; jetons_sortie?: number | null; demande?: string },
) {
  await query(
    `INSERT INTO ia_usage (user_id, type, statut, modele, duree_ms, jetons_entree, jetons_sortie, longueur_demande, extrait)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      me(req).id,
      u.type,
      u.statut,
      u.modele,
      Date.now() - u.debut,
      u.jetons_entree ?? null,
      u.jetons_sortie ?? null,
      u.demande === undefined ? null : u.demande.length,
      u.demande === undefined ? null : u.demande.replace(/\s+/g, ' ').trim().slice(0, 120),
    ],
  );
}

// ---------------------------------------------------------------------------
// Limite : 30 propositions par utilisateur et par heure (en mémoire, par processus).

const LIMITE_PAR_HEURE = 30;
const HEURE_MS = 3_600_000;
const appelsRecents = new Map<number, number[]>();

function reserverAppel(userId: number) {
  const maintenant = Date.now();
  const recents = (appelsRecents.get(userId) ?? []).filter((t) => maintenant - t < HEURE_MS);
  if (recents.length >= LIMITE_PAR_HEURE) {
    const minutes = Math.max(1, Math.ceil((HEURE_MS - (maintenant - recents[0]!)) / 60_000));
    appelsRecents.set(userId, recents);
    throw new HttpError(
      429,
      `Vous avez demandé ${LIMITE_PAR_HEURE} propositions en une heure : réessayez dans ${minutes} min.`,
      { reessayer_dans_min: minutes },
      'ia_limite_utilisateur',
    );
  }
  recents.push(maintenant);
  appelsRecents.set(userId, recents);
}

/** Pour les tests. */
export function viderLimitesIA() {
  appelsRecents.clear();
}

// ---------------------------------------------------------------------------

iaRouter.get('/statut', requireRole('admin', 'preparateur'), async (_req, res) => {
  const c = await lireConfig();
  res.json({ actif: c.actif && !!c.cle_chiffree });
});

iaRouter.get('/config', requireRole('admin'), async (_req, res) => {
  res.json(versVue(await lireConfig()));
});

const configSchema = z.object({
  actif: z.boolean({ invalid_type_error: 'Activation : oui ou non' }).optional(),
  modele: z.enum(MODELES_IA, { errorMap: () => ({ message: `Modèle inconnu : choisissez ${MODELES_IA.join(', ')}` }) }).optional(),
  cle: z
    .string({ invalid_type_error: 'Clé : texte attendu' })
    .trim()
    .min(20, 'Clé trop courte : copiez la clé complète, elle commence par « sk- »')
    .max(300, 'Clé trop longue : copiez uniquement la clé')
    .regex(/^sk-[\x21-\x7e]+$/, 'Clé OpenAI invalide : elle commence par « sk- » et ne contient pas d’espace')
    .nullable()
    .optional(),
});

iaRouter.put('/config', requireRole('admin'), async (req, res) => {
  const input = configSchema.parse(req.body ?? {});
  const avant = await lireConfig();

  let cleChiffree = avant.cle_chiffree;
  let cleFin = avant.cle_fin;
  const changements: Record<string, unknown> = {};
  if (input.cle === null) {
    if (avant.cle_chiffree) changements.cle = 'effacee';
    cleChiffree = null;
    cleFin = null;
  } else if (input.cle !== undefined) {
    changements.cle = avant.cle_chiffree ? 'remplacee' : 'enregistree';
    cleChiffree = chiffrer(input.cle);
    cleFin = input.cle.slice(-4);
  }

  // Sans clé, l'assistant ne peut pas être actif : effacer la clé le désactive.
  let actif = input.actif ?? avant.actif;
  if (!cleChiffree) {
    if (input.actif === true) throw conflict("Enregistrez d'abord une clé OpenAI pour activer l'assistant.");
    actif = false;
  }
  const modele = input.modele ?? avant.modele;
  if (actif !== avant.actif) changements.actif = { avant: avant.actif, apres: actif };
  if (modele !== avant.modele) changements.modele = { avant: avant.modele, apres: modele };

  if (Object.keys(changements).length) {
    await tx(async (db) => {
      await db.query(
        `INSERT INTO ia_config (id, actif, modele, cle_chiffree, cle_fin, updated_by, updated_at) VALUES (1, $1, $2, $3, $4, $5, now())
         ON CONFLICT (id) DO UPDATE SET actif = EXCLUDED.actif, modele = EXCLUDED.modele, cle_chiffree = EXCLUDED.cle_chiffree,
           cle_fin = EXCLUDED.cle_fin, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [actif, modele, cleChiffree, cleFin, me(req).id],
      );
      await journal(req, 'ia_config_modifiee', 'ia_config', null, changements, db);
    });
  }
  res.json(versVue(await lireConfig()));
});

const testSchema = z.object({
  /** Clé à essayer avant de l'enregistrer ; sinon la clé enregistrée. */
  cle: configSchema.shape.cle.unwrap().unwrap().optional(),
  modele: configSchema.shape.modele,
});

iaRouter.post('/test', requireRole('admin'), async (req, res) => {
  const input = testSchema.parse(req.body ?? {});
  const config = await lireConfig();
  const cle = input.cle ?? cleEnClair(config);
  const modele = input.modele ?? config.modele;
  const debut = Date.now();
  try {
    const r = await appelerOpenAI({ cle, modele, messages: [{ role: 'user', content: 'Réponds seulement : OK' }], maxJetons: 16 });
    await noterUsage(req, { type: 'test', statut: 'ok', modele, debut, jetons_entree: r.jetons_entree, jetons_sortie: r.jetons_sortie });
    res.json({ ok: true, modele: r.modele, duree_ms: Date.now() - debut });
  } catch (e) {
    await noterUsage(req, { type: 'test', statut: e instanceof ErreurOpenAI ? e.statut : 'erreur', modele, debut });
    throw e;
  }
});

const suggestionSchema = z.object({
  description: z
    .string({ required_error: 'Décrivez la demande du client', invalid_type_error: 'Description : texte attendu' })
    .trim()
    .min(1, 'Décrivez la demande du client')
    .max(2000, 'Description : 2000 caractères au maximum'),
  machine: z.enum(MACHINES, { errorMap: () => ({ message: 'Machine : roland ou xerox' }) }).optional(),
});

iaRouter.post('/suggestion', requireRole('admin', 'preparateur'), async (req, res) => {
  const { description, machine } = suggestionSchema.parse(req.body ?? {});
  const config = await lireConfig();
  if (!config.actif || !config.cle_chiffree) throw new HttpError(409, PAS_ACTIF, undefined, 'ia_inactif');
  const cle = cleEnClair(config);
  reserverAppel(me(req).id);

  const [tarifs, params] = await Promise.all([getTarifs(), getParametres()]);
  const debut = Date.now();
  const usage = { type: 'suggestion' as const, modele: config.modele, debut, demande: description, jetons_entree: null as number | null, jetons_sortie: null as number | null };
  let reponse: Record<string, unknown>;
  try {
    const r = await appelerOpenAI({
      cle,
      modele: config.modele,
      messages: messagesSuggestion(description, tarifs, machine),
      schema: schemaReponse(machine),
      maxJetons: 2000,
    });
    usage.jetons_entree = r.jetons_entree;
    usage.jetons_sortie = r.jetons_sortie;
    let brut: unknown;
    try {
      brut = JSON.parse(r.contenu);
    } catch {
      brut = undefined;
    }
    const lu = reponseIASchema.safeParse(brut);
    if (!lu.success) {
      throw new ErreurOpenAI(502, "La réponse de l'assistant est illisible : réessayez ou reformulez la demande.", 'reponse_invalide');
    }
    const s = nettoyerSuggestion(lu.data, tarifs, machine);
    // Le prix vient toujours du moteur et de la grille, jamais de l'IA.
    const calcul = calculerPrix(s.machine, s.specs, tarifs, params.prix);
    reponse = {
      machine: s.machine,
      specs: s.specs,
      prix: calcul.ok ? { total: calcul.total_ttc, ...calcul } : null,
      ...(calcul.ok ? {} : { erreur_prix: calcul.erreurs.join(' ') }),
      avertissements: s.avertissements,
      ...(s.remarques ? { remarques: s.remarques } : {}),
    };
  } catch (e) {
    await noterUsage(req, { ...usage, statut: e instanceof ErreurOpenAI ? e.statut : 'erreur' });
    throw e;
  }
  await noterUsage(req, { ...usage, statut: 'ok' });
  res.json(reponse);
});

/** Derniers appels (sans le texte complet des demandes) et totaux des 30 derniers jours. */
iaRouter.get('/usages', requireRole('admin'), async (req, res) => {
  const limit = Math.min(Math.max(qInt(req, 'limit') ?? 50, 1), 200);
  const items = await query(
    `SELECT a.id, a.user_id, u.nom AS user_nom, a.type, a.statut, a.modele, a.duree_ms, a.jetons_entree, a.jetons_sortie,
            a.longueur_demande, a.extrait, a.created_at
     FROM ia_usage a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
  );
  const totaux = await one(
    `SELECT count(*) FILTER (WHERE type = 'suggestion')::int AS suggestions,
            count(*) FILTER (WHERE type = 'suggestion' AND statut <> 'ok')::int AS erreurs,
            coalesce(sum(jetons_entree), 0)::int AS jetons_entree,
            coalesce(sum(jetons_sortie), 0)::int AS jetons_sortie
     FROM ia_usage WHERE created_at > now() - interval '30 days'`,
  );
  res.json({ items, totaux_30_jours: totaux });
});
