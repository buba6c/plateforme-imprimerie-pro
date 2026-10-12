// Assistant IA de saisie : propose des spécifications de dossier ou de devis à partir de la
// description d'une demande. Il ne crée ni ne modifie rien ; le prix est recalculé par le
// serveur avec la grille. Deux fournisseurs (OpenAI, Google Gemini), chacun avec sa clé chiffrée
// et son modèle ; un fournisseur actif et un secours automatique vers l'autre. Configuration
// réservée à l'administrateur ; le journal d'usage garde chaque essai, jamais les clés.

import { Router, type Request } from 'express';
import { z } from 'zod';
import { calculerPrix, MACHINES } from '@evocom/shared';
import { one, query, tx } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, HttpError } from '../../lib/errors';
import { qInt } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { getTarifs } from '../../lib/tarifs';
import { chiffrer, CleIllisible, dechiffrer } from './chiffrement';
import { ErreurIA, FOURNISSEUR_LABELS, FOURNISSEURS_IA, type FournisseurIA, type StatutAppel } from './erreurs';
import { MODELES_GEMINI } from './gemini';
import { appelerAvecSecours, appelerFournisseur, autreFournisseur, MODELE_DEFAUT, MODELES_PAR_FOURNISSEUR, type Acces, type TentativeIA } from './fournisseurs';
import { MODELES_IA } from './openai';
import { messagesSuggestion, nettoyerSuggestion, reponseIASchema, schemaReponse } from './suggestion';

export const iaRouter = Router();
iaRouter.use(requireAuth);

const PAS_ACTIF = "L'assistant n'est pas activé.";

interface ConfigIA {
  actif: boolean;
  fournisseur: FournisseurIA;
  secours: boolean;
  modele: string;
  cle_chiffree: string | null;
  cle_fin: string | null;
  modele_gemini: string;
  cle_gemini_chiffree: string | null;
  cle_gemini_fin: string | null;
  updated_at: string | null;
  updated_by_nom: string | null;
}

async function lireConfig(): Promise<ConfigIA> {
  const c = await one<ConfigIA>(
    `SELECT c.actif, c.fournisseur, c.secours, c.modele, c.cle_chiffree, c.cle_fin, c.modele_gemini, c.cle_gemini_chiffree, c.cle_gemini_fin,
            c.updated_at, u.nom AS updated_by_nom
     FROM ia_config c LEFT JOIN users u ON u.id = c.updated_by WHERE c.id = 1`,
  );
  return (
    c ?? {
      actif: false,
      fournisseur: 'openai',
      secours: true,
      modele: MODELE_DEFAUT.openai,
      cle_chiffree: null,
      cle_fin: null,
      modele_gemini: MODELE_DEFAUT.gemini,
      cle_gemini_chiffree: null,
      cle_gemini_fin: null,
      updated_at: null,
      updated_by_nom: null,
    }
  );
}

/** Clé chiffrée, fin de clé et modèle d'un fournisseur. */
function acces(c: ConfigIA, f: FournisseurIA): { chiffree: string | null; fin: string | null; modele: string } {
  return f === 'gemini' ? { chiffree: c.cle_gemini_chiffree, fin: c.cle_gemini_fin, modele: c.modele_gemini } : { chiffree: c.cle_chiffree, fin: c.cle_fin, modele: c.modele };
}

function lisible(chiffree: string | null): boolean {
  if (!chiffree) return false;
  try {
    dechiffrer(chiffree);
    return true;
  } catch {
    return false;
  }
}

function vueFournisseur(c: ConfigIA, f: FournisseurIA) {
  const a = acces(c, f);
  const configuree = !!a.chiffree;
  return {
    modele: a.modele,
    modeles: MODELES_PAR_FOURNISSEUR[f],
    cle_configuree: configuree,
    cle_fin: configuree ? a.fin : null,
    cle_lisible: configuree ? lisible(a.chiffree) : null,
  };
}

/** Ce que voit l'administrateur : jamais les clés, seulement leurs 4 derniers caractères. */
function versVue(c: ConfigIA) {
  const principal = vueFournisseur(c, c.fournisseur);
  const secoursPossible = !!acces(c, autreFournisseur(c.fournisseur)).chiffree;
  return {
    actif: c.actif && principal.cle_configuree,
    fournisseur: c.fournisseur,
    secours: c.secours,
    secours_possible: secoursPossible,
    fournisseurs: { openai: vueFournisseur(c, 'openai'), gemini: vueFournisseur(c, 'gemini') },
    // Champs du fournisseur actif, à plat (compatibilité avec les premiers écrans).
    ...principal,
    updated_at: c.updated_at,
    updated_by_nom: c.updated_by_nom,
  };
}

/** Clé en clair d'un fournisseur, pour l'appel seulement ; 409 si absente ou illisible. */
function cleEnClair(c: ConfigIA, f: FournisseurIA): string {
  const a = acces(c, f);
  if (!a.chiffree) throw conflict(`Aucune clé ${FOURNISSEUR_LABELS[f]} n'est enregistrée : saisissez-la dans Administration, Assistant IA.`);
  try {
    return dechiffrer(a.chiffree);
  } catch (e) {
    if (e instanceof CleIllisible) throw new HttpError(409, e.message, undefined, 'ia_cle_illisible');
    throw e;
  }
}

/** Accès de secours : l'autre fournisseur, s'il est permis et que sa clé se lit. */
function accesSecours(c: ConfigIA): Acces | null {
  if (!c.secours) return null;
  const f = autreFournisseur(c.fournisseur);
  const a = acces(c, f);
  if (!a.chiffree || !lisible(a.chiffree)) return null;
  return { fournisseur: f, cle: dechiffrer(a.chiffree), modele: a.modele };
}

async function noterUsage(
  req: Request,
  u: {
    type: 'suggestion' | 'test';
    statut: StatutAppel;
    fournisseur: FournisseurIA;
    modele: string;
    duree_ms: number;
    jetons_entree?: number | null;
    jetons_sortie?: number | null;
    demande?: string;
    secours?: boolean;
    erreur?: string | null;
  },
) {
  await query(
    `INSERT INTO ia_usage (user_id, type, statut, fournisseur, modele, duree_ms, jetons_entree, jetons_sortie, longueur_demande, extrait, secours, erreur)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      me(req).id,
      u.type,
      u.statut,
      u.fournisseur,
      u.modele,
      u.duree_ms,
      u.jetons_entree ?? null,
      u.jetons_sortie ?? null,
      u.demande === undefined ? null : u.demande.length,
      u.demande === undefined ? null : u.demande.replace(/\s+/g, ' ').trim().slice(0, 120),
      u.secours ?? false,
      u.erreur ? u.erreur.slice(0, 300) : null,
    ],
  );
}

async function noterTentatives(req: Request, type: 'suggestion' | 'test', tentatives: TentativeIA[], demande?: string) {
  for (const t of tentatives) {
    await noterUsage(req, { type, statut: t.statut, fournisseur: t.fournisseur, modele: t.modele, duree_ms: t.duree_ms, jetons_entree: t.jetons_entree, jetons_sortie: t.jetons_sortie, demande, secours: t.secours, erreur: t.erreur });
  }
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
// Validation des clés : OpenAI commence par « sk- » ; Gemini (Google AI Studio) commence le plus
// souvent par « AIza ». Aucune espace, longueur raisonnable.

const cleOpenAISchema = z
  .string({ invalid_type_error: 'Clé : texte attendu' })
  .trim()
  .min(20, 'Clé trop courte : copiez la clé complète, elle commence par « sk- »')
  .max(300, 'Clé trop longue : copiez uniquement la clé')
  .regex(/^sk-[\x21-\x7e]+$/, 'Clé OpenAI invalide : elle commence par « sk- » et ne contient pas d’espace');

const cleGeminiSchema = z
  .string({ invalid_type_error: 'Clé : texte attendu' })
  .trim()
  .min(20, 'Clé trop courte : copiez la clé complète (Google AI Studio, rubrique « Get API key »)')
  .max(300, 'Clé trop longue : copiez uniquement la clé')
  .regex(/^[A-Za-z0-9_-]+$/, 'Clé Gemini invalide : elle ne contient ni espace ni caractère spécial (elle commence le plus souvent par « AIza »)');

const modeleOpenAISchema = z.enum(MODELES_IA, { errorMap: () => ({ message: `Modèle inconnu : choisissez ${MODELES_IA.join(', ')}` }) });
const modeleGeminiSchema = z.enum(MODELES_GEMINI, { errorMap: () => ({ message: `Modèle inconnu : choisissez ${MODELES_GEMINI.join(', ')}` }) });
const fournisseurSchema = z.enum(FOURNISSEURS_IA, { errorMap: () => ({ message: 'Fournisseur : openai ou gemini' }) });

const configSchema = z.object({
  actif: z.boolean({ invalid_type_error: 'Activation : oui ou non' }).optional(),
  fournisseur: fournisseurSchema.optional(),
  secours: z.boolean({ invalid_type_error: 'Secours : oui ou non' }).optional(),
  // Forme courte (OpenAI) gardée pour compatibilité.
  modele: modeleOpenAISchema.optional(),
  cle: cleOpenAISchema.nullable().optional(),
  openai: z.object({ cle: cleOpenAISchema.nullable().optional(), modele: modeleOpenAISchema.optional() }).optional(),
  gemini: z.object({ cle: cleGeminiSchema.nullable().optional(), modele: modeleGeminiSchema.optional() }).optional(),
});

// ---------------------------------------------------------------------------

iaRouter.get('/statut', requireRole('admin', 'preparateur'), async (_req, res) => {
  const c = await lireConfig();
  res.json({ actif: c.actif && !!acces(c, c.fournisseur).chiffree, fournisseur: c.fournisseur });
});

iaRouter.get('/config', requireRole('admin'), async (_req, res) => {
  res.json(versVue(await lireConfig()));
});

iaRouter.put('/config', requireRole('admin'), async (req, res) => {
  const input = configSchema.parse(req.body ?? {});
  const avant = await lireConfig();
  const changements: Record<string, unknown> = {};

  // Clés et modèles, fournisseur par fournisseur.
  const cles: Record<FournisseurIA, { chiffree: string | null; fin: string | null; modele: string }> = {
    openai: { chiffree: avant.cle_chiffree, fin: avant.cle_fin, modele: avant.modele },
    gemini: { chiffree: avant.cle_gemini_chiffree, fin: avant.cle_gemini_fin, modele: avant.modele_gemini },
  };
  const appliquer = (f: FournisseurIA, cle: string | null | undefined, modele: string | undefined) => {
    const nomCle = f === 'openai' ? 'cle' : 'cle_gemini';
    const nomModele = f === 'openai' ? 'modele' : 'modele_gemini';
    if (cle === null) {
      if (cles[f].chiffree) changements[nomCle] = 'effacee';
      cles[f] = { ...cles[f], chiffree: null, fin: null };
    } else if (cle !== undefined) {
      changements[nomCle] = cles[f].chiffree ? 'remplacee' : 'enregistree';
      cles[f] = { ...cles[f], chiffree: chiffrer(cle), fin: cle.slice(-4) };
    }
    if (modele !== undefined && modele !== cles[f].modele) {
      changements[nomModele] = { avant: cles[f].modele, apres: modele };
      cles[f] = { ...cles[f], modele };
    }
  };
  appliquer('openai', input.openai?.cle ?? input.cle, input.openai?.modele ?? input.modele);
  appliquer('gemini', input.gemini?.cle, input.gemini?.modele);

  // Fournisseur actif : il lui faut une clé.
  const fournisseur = input.fournisseur ?? avant.fournisseur;
  if (input.fournisseur && input.fournisseur !== avant.fournisseur && !cles[fournisseur].chiffree) {
    throw conflict(`Enregistrez d'abord une clé ${FOURNISSEUR_LABELS[fournisseur]} avant de le choisir comme fournisseur.`);
  }
  if (fournisseur !== avant.fournisseur) changements.fournisseur = { avant: avant.fournisseur, apres: fournisseur };

  // Sans clé pour le fournisseur actif, l'assistant ne peut pas être actif : effacer sa clé le désactive.
  let actif = input.actif ?? avant.actif;
  if (!cles[fournisseur].chiffree) {
    if (input.actif === true) throw conflict(`Enregistrez d'abord une clé ${FOURNISSEUR_LABELS[fournisseur]} pour activer l'assistant.`);
    actif = false;
  }
  if (actif !== avant.actif) changements.actif = { avant: avant.actif, apres: actif };
  const secours = input.secours ?? avant.secours;
  if (secours !== avant.secours) changements.secours = { avant: avant.secours, apres: secours };

  if (Object.keys(changements).length) {
    await tx(async (db) => {
      await db.query(
        `INSERT INTO ia_config (id, actif, fournisseur, secours, modele, cle_chiffree, cle_fin, modele_gemini, cle_gemini_chiffree, cle_gemini_fin, updated_by, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         ON CONFLICT (id) DO UPDATE SET actif = EXCLUDED.actif, fournisseur = EXCLUDED.fournisseur, secours = EXCLUDED.secours,
           modele = EXCLUDED.modele, cle_chiffree = EXCLUDED.cle_chiffree, cle_fin = EXCLUDED.cle_fin,
           modele_gemini = EXCLUDED.modele_gemini, cle_gemini_chiffree = EXCLUDED.cle_gemini_chiffree, cle_gemini_fin = EXCLUDED.cle_gemini_fin,
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [actif, fournisseur, secours, cles.openai.modele, cles.openai.chiffree, cles.openai.fin, cles.gemini.modele, cles.gemini.chiffree, cles.gemini.fin, me(req).id],
      );
      await journal(req, 'ia_config_modifiee', 'ia_config', null, changements, db);
    });
  }
  res.json(versVue(await lireConfig()));
});

const testSchema = z.object({
  fournisseur: fournisseurSchema.optional(),
  /** Clé à essayer avant de l'enregistrer ; sinon la clé enregistrée. */
  cle: z.string({ invalid_type_error: 'Clé : texte attendu' }).trim().min(1).max(300).optional(),
  modele: z.string().trim().min(1).max(80).optional(),
});

iaRouter.post('/test', requireRole('admin'), async (req, res) => {
  const input = testSchema.parse(req.body ?? {});
  const config = await lireConfig();
  const fournisseur = input.fournisseur ?? config.fournisseur;
  if (input.cle !== undefined) {
    const v = (fournisseur === 'gemini' ? cleGeminiSchema : cleOpenAISchema).safeParse(input.cle);
    if (!v.success) throw badRequest('Certains champs sont invalides.', { champs: { cle: v.error.issues[0]?.message ?? 'Clé invalide' } });
  }
  if (input.modele !== undefined && !MODELES_PAR_FOURNISSEUR[fournisseur].includes(input.modele)) {
    throw badRequest('Certains champs sont invalides.', { champs: { modele: `Modèle inconnu : choisissez ${MODELES_PAR_FOURNISSEUR[fournisseur].join(', ')}` } });
  }
  const cle = input.cle ?? cleEnClair(config, fournisseur);
  const modele = input.modele ?? acces(config, fournisseur).modele;
  const debut = Date.now();
  try {
    const r = await appelerFournisseur(fournisseur, { cle, modele, messages: [{ role: 'user', content: 'Réponds seulement : OK' }], maxJetons: 16 });
    await noterUsage(req, { type: 'test', statut: 'ok', fournisseur, modele, duree_ms: Date.now() - debut, jetons_entree: r.jetons_entree, jetons_sortie: r.jetons_sortie });
    res.json({ ok: true, fournisseur, modele: r.modele, duree_ms: Date.now() - debut });
  } catch (e) {
    const statut: StatutAppel = e instanceof ErreurIA ? e.statut : 'erreur';
    await noterUsage(req, { type: 'test', statut, fournisseur, modele, duree_ms: Date.now() - debut, erreur: e instanceof Error ? e.message : null });
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
  if (!config.actif || !acces(config, config.fournisseur).chiffree) throw new HttpError(409, PAS_ACTIF, undefined, 'ia_inactif');
  const principal: Acces = { fournisseur: config.fournisseur, cle: cleEnClair(config, config.fournisseur), modele: acces(config, config.fournisseur).modele };
  const secours = accesSecours(config);
  reserverAppel(me(req).id);

  const [tarifs, params] = await Promise.all([getTarifs(), getParametres()]);
  let resultat;
  try {
    resultat = await appelerAvecSecours(principal, secours, { messages: messagesSuggestion(description, tarifs, machine), schema: schemaReponse(machine), maxJetons: 2000 });
  } catch (e) {
    const tentatives = (e as { tentatives?: TentativeIA[] }).tentatives;
    if (tentatives) await noterTentatives(req, 'suggestion', tentatives, description);
    else await noterUsage(req, { type: 'suggestion', statut: 'erreur', fournisseur: principal.fournisseur, modele: principal.modele, duree_ms: 0, demande: description, erreur: e instanceof Error ? e.message : null });
    throw e;
  }

  let brut: unknown;
  try {
    brut = JSON.parse(resultat.reponse.contenu);
  } catch {
    brut = undefined;
  }
  const lu = reponseIASchema.safeParse(brut);
  if (!lu.success) {
    const derniere = resultat.tentatives[resultat.tentatives.length - 1]!;
    await noterTentatives(req, 'suggestion', [...resultat.tentatives.slice(0, -1), { ...derniere, statut: 'reponse_invalide', erreur: 'Réponse illisible (JSON inattendu)' }], description);
    throw new ErreurIA(502, "La réponse de l'assistant est illisible : réessayez ou reformulez la demande.", 'reponse_invalide', resultat.fournisseur);
  }
  await noterTentatives(req, 'suggestion', resultat.tentatives, description);

  const s = nettoyerSuggestion(lu.data, tarifs, machine);
  // Le prix vient toujours du moteur et de la grille, jamais de l'IA.
  const calcul = calculerPrix(s.machine, s.specs, tarifs, params.prix);
  res.json({
    machine: s.machine,
    specs: s.specs,
    // Prix calculé avec la grille (le préparateur, qui remplit le dossier, le voit aussi).
    prix: calcul.ok ? { total: calcul.total_ttc, ...calcul } : null,
    ...(calcul.ok ? {} : { erreur_prix: calcul.erreurs.join(' ') }),
    avertissements: s.avertissements,
    ...(s.remarques ? { remarques: s.remarques } : {}),
    fournisseur: resultat.fournisseur,
    modele: resultat.modele,
    secours: resultat.secours,
  });
});

/** Derniers appels (sans le texte complet des demandes) et totaux des 30 derniers jours. */
iaRouter.get('/usages', requireRole('admin'), async (req, res) => {
  const limit = Math.min(Math.max(qInt(req, 'limit') ?? 50, 1), 200);
  const items = await query(
    `SELECT a.id, a.user_id, u.nom AS user_nom, a.type, a.statut, a.fournisseur, a.modele, a.duree_ms, a.jetons_entree, a.jetons_sortie,
            a.longueur_demande, a.extrait, a.secours, a.erreur, a.created_at
     FROM ia_usage a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
  );
  const totaux = await one(
    `SELECT count(*) FILTER (WHERE type = 'suggestion')::int AS suggestions,
            count(*) FILTER (WHERE type = 'suggestion' AND statut <> 'ok')::int AS erreurs,
            count(*) FILTER (WHERE type = 'suggestion' AND statut = 'ok' AND secours)::int AS secours,
            count(*) FILTER (WHERE type = 'suggestion' AND fournisseur = 'openai')::int AS openai,
            count(*) FILTER (WHERE type = 'suggestion' AND fournisseur = 'gemini')::int AS gemini,
            coalesce(sum(jetons_entree), 0)::int AS jetons_entree,
            coalesce(sum(jetons_sortie), 0)::int AS jetons_sortie
     FROM ia_usage WHERE created_at > now() - interval '30 days'`,
  );
  res.json({ items, totaux_30_jours: totaux });
});
