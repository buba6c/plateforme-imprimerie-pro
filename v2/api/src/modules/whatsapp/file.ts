// File des messages sortants et règles anti-spam, toutes appliquées ici (côté serveur) :
// un seul message par (dossier, événement) ; jamais vers un numéro en liste STOP ; jamais hors des
// heures d'envoi (le message attend) ; limites par heure et par jour ; délai aléatoire entre deux
// envois ; au plus 3 tentatives puis « echec » avec le motif. La boucle (toutes les 15 s) n'envoie
// qu'un message par passage et seulement quand la connexion est ouverte.

import type { Logger } from 'pino';
import type { ActionId } from '@evocom/shared';
import { getPool, one, tx, type Db } from '../../db/pool';
import { getParametres } from '../../lib/params';
import { envoyerTexte, estConnecte, NonConnecte } from './connexion';
import { texteEvenement, type DossierPourMessage } from './modeles';
import { EVENEMENTS_WHATSAPP, getParametresWhatsApp, type EvenementWhatsApp } from './parametres';
import { normaliserTelephone } from './telephone';

export type StatutMessage = 'en_attente' | 'envoye' | 'echec' | 'annule' | 'ignore';

export interface MessageWhatsApp {
  id: number;
  dossier_id: number | null;
  evenement: EvenementWhatsApp | 'test';
  telephone: string | null;
  texte: string;
  statut: StatutMessage;
  motif: string | null;
  tentatives: number;
  planifie_at: string;
  envoye_at: string | null;
  created_at: string;
}

export const TENTATIVES_MAX = 3;
export const INTERVALLE_FILE_MS = 15_000;
export const TEXTE_TEST = 'Message de test {entreprise} : la connexion WhatsApp fonctionne. Vous pouvez ignorer ce message.';

let log: Logger | null = null;
let minuterie: NodeJS.Timeout | null = null;
/** Prochain envoi autorisé (délai aléatoire après le précédent), en ms depuis 1970. */
let prochainEnvoiAt = 0;
let aleatoire: () => number = Math.random;

export function configurerFile(opts: { log: Logger }) {
  log = opts.log;
}

/** Événement WhatsApp déclenché par une transition du circuit, ou null. */
export function evenementWhatsApp(action: ActionId, d: { mode_remise?: string | null }): EvenementWhatsApp | null {
  switch (action) {
    case 'marquer_imprime':
      return d.mode_remise === 'retrait' ? 'pret_retrait' : 'pret_livraison';
    case 'programmer_livraison':
      return 'en_livraison';
    case 'confirmer_livraison':
    case 'remettre_client':
      return 'livre';
    default:
      return null;
  }
}

async function enOptOut(telephone: string, db: Db): Promise<boolean> {
  return !!(await one(`SELECT 1 FROM whatsapp_optout WHERE telephone = $1`, [telephone], db));
}

interface Nouveau {
  dossier_id: number | null;
  evenement: string;
  telephone: string | null;
  texte: string;
  statut: StatutMessage;
  motif: string | null;
}

/** Insère le message ; null si (dossier, événement) existe déjà. */
async function inserer(n: Nouveau, db: Db): Promise<MessageWhatsApp | null> {
  return one<MessageWhatsApp>(
    `INSERT INTO whatsapp_messages (dossier_id, evenement, telephone, texte, statut, motif)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dossier_id, evenement) DO NOTHING
     RETURNING *`,
    [n.dossier_id, n.evenement, n.telephone, n.texte, n.statut, n.motif],
    db,
  );
}

type DossierRow = DossierPourMessage & { id: number; client_telephone: string | null; deleted_at: string | null };

/**
 * Planifie le message d'un événement pour un dossier. Ne lève jamais d'erreur (une notification
 * manquée n'annule pas l'action) ; renvoie la ligne créée, ou null si rien n'a été ajouté.
 * Le texte est figé maintenant ; les règles d'envoi (heures, limites, STOP) s'appliquent dans la file.
 */
export async function planifierWhatsApp(evenement: EvenementWhatsApp, dossierId: number, db: Db = getPool()): Promise<MessageWhatsApp | null> {
  try {
    if (!EVENEMENTS_WHATSAPP.includes(evenement)) return null;
    const d = await one<DossierRow>(`SELECT * FROM dossiers WHERE id = $1`, [dossierId], db);
    if (!d || d.deleted_at) return null;
    const p = await getParametresWhatsApp(db);
    const tel = normaliserTelephone(d.client_telephone);
    const texte = await texteEvenement(evenement, d, p, db);
    let statut: StatutMessage = 'en_attente';
    let motif: string | null = null;
    if (!p.actif) {
      statut = 'ignore';
      motif = 'Messages WhatsApp désactivés dans les réglages';
    } else if (!tel) {
      statut = 'ignore';
      motif = d.client_telephone?.trim() ? `Numéro invalide : « ${d.client_telephone.trim()} »` : 'Pas de numéro de téléphone sur le dossier';
    } else if (await enOptOut(tel.e164, db)) {
      statut = 'ignore';
      motif = 'Numéro en liste STOP';
    }
    return await inserer({ dossier_id: d.id, evenement, telephone: tel?.e164 ?? d.client_telephone?.trim() ?? null, texte, statut, motif }, db);
  } catch (e) {
    log?.error({ err: e, evenement, dossierId }, 'Message WhatsApp non planifié');
    return null;
  }
}

/** Message de test vers un numéro (mêmes règles que les autres). Lève une erreur lisible si impossible. */
export async function planifierTest(telephoneBrut: string, db: Db = getPool()): Promise<{ message: MessageWhatsApp | null; erreur: string | null }> {
  const tel = normaliserTelephone(telephoneBrut);
  if (!tel) return { message: null, erreur: 'Numéro invalide : indiquez un mobile sénégalais (7X XXX XX XX) ou un numéro international (+…).' };
  const p = await getParametresWhatsApp(db);
  const entreprise = (await getParametres(db)).entreprise.nom.trim() || 'Evocom Print';
  const texte = TEXTE_TEST.replace('{entreprise}', entreprise) + (p.signature.trim() ? `\n${p.signature.trim()}` : '');
  if (!p.actif) return { message: null, erreur: 'Activez d’abord les messages WhatsApp dans les réglages.' };
  if (await enOptOut(tel.e164, db)) return { message: null, erreur: `Le numéro ${tel.affichage} est en liste STOP : retirez-le d’abord.` };
  const message = await inserer({ dossier_id: null, evenement: 'test', telephone: tel.e164, texte, statut: 'en_attente', motif: null }, db);
  return { message, erreur: null };
}

// ---------------------------------------------------------------------------
// Boucle d'envoi

export type Resultat =
  | 'deconnecte'
  | 'inactif'
  | 'hors_heures'
  | 'delai'
  | 'limite_heure'
  | 'limite_jour'
  | 'vide'
  | 'envoye'
  | 'reporte'
  | 'echec'
  | 'ignore';

export interface Passage {
  resultat: Resultat;
  id?: number;
  motif?: string;
}

function heureLocale(d: Date, fuseau: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(/^24/, '00');
  } catch {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(/^24/, '00');
  }
}

/** Vrai si `maintenant` est dans la plage d'envoi (début inclus, fin exclue). */
export function dansLesHeures(maintenant: Date, fuseau: string, heures: { debut: string; fin: string }): boolean {
  const h = heureLocale(maintenant, fuseau);
  return h >= heures.debut && h < heures.fin;
}

/** Envois de la dernière heure et du jour civil (fuseau de l'entreprise). */
export async function compteursEnvois(maintenant: Date, fuseau: string, db: Db = getPool()): Promise<{ heure: number; jour: number }> {
  const r = await one<{ heure: number; jour: number }>(
    `SELECT count(*) FILTER (WHERE envoye_at > $1::timestamptz - interval '1 hour')::int AS heure,
            count(*) FILTER (WHERE (envoye_at AT TIME ZONE $2)::date = ($1::timestamptz AT TIME ZONE $2)::date)::int AS jour
     FROM whatsapp_messages WHERE statut = 'envoye' AND envoye_at > $1::timestamptz - interval '2 days'`,
    [maintenant.toISOString(), fuseau],
    db,
  );
  return r ?? { heure: 0, jour: 0 };
}

/**
 * Un passage de la file : envoie au plus un message si toutes les règles le permettent.
 * `maintenant` est injectable pour les tests.
 */
export async function traiterFile(opts: { maintenant?: Date } = {}): Promise<Passage> {
  const maintenant = opts.maintenant ?? new Date();
  if (!estConnecte()) return { resultat: 'deconnecte' };
  const p = await getParametresWhatsApp();
  if (!p.actif) return { resultat: 'inactif' };
  const fuseau = (await getParametres()).fuseau;
  if (!dansLesHeures(maintenant, fuseau, p.heures)) return { resultat: 'hors_heures' };
  if (maintenant.getTime() < prochainEnvoiAt) return { resultat: 'delai' };
  const c = await compteursEnvois(maintenant, fuseau);
  if (c.heure >= p.limites.par_heure) return { resultat: 'limite_heure' };
  if (c.jour >= p.limites.par_jour) return { resultat: 'limite_jour' };

  return tx(async (db) => {
    const m = await one<MessageWhatsApp>(
      `SELECT * FROM whatsapp_messages WHERE statut = 'en_attente' AND planifie_at <= $1
       ORDER BY planifie_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [maintenant.toISOString()],
      db,
    );
    if (!m) return { resultat: 'vide' };
    const ignorer = async (motif: string): Promise<Passage> => {
      await db.query(`UPDATE whatsapp_messages SET statut = 'ignore', motif = $2 WHERE id = $1`, [m.id, motif]);
      return { resultat: 'ignore', id: m.id, motif };
    };
    const tel = normaliserTelephone(m.telephone);
    if (!tel) return ignorer(`Numéro invalide : « ${m.telephone ?? ''} »`);
    if (await enOptOut(tel.e164, db)) return ignorer('Numéro en liste STOP');

    // Délai aléatoire avant le prochain envoi, réussi ou non.
    const [minS, maxS] = [Math.min(p.delai.min_s, p.delai.max_s), Math.max(p.delai.min_s, p.delai.max_s)];
    prochainEnvoiAt = maintenant.getTime() + Math.round((minS + aleatoire() * (maxS - minS)) * 1000);

    try {
      await envoyerTexte(tel.jid, m.texte);
    } catch (e) {
      if (e instanceof NonConnecte) {
        prochainEnvoiAt = 0;
        return { resultat: 'deconnecte', id: m.id };
      }
      const message = e instanceof Error ? e.message : String(e);
      const tentatives = m.tentatives + 1;
      if (tentatives >= TENTATIVES_MAX) {
        const motif = `Échec après ${tentatives} tentatives : ${message}`;
        await db.query(`UPDATE whatsapp_messages SET statut = 'echec', tentatives = $2, motif = $3 WHERE id = $1`, [m.id, tentatives, motif]);
        log?.warn({ id: m.id, motif }, 'Message WhatsApp en échec');
        return { resultat: 'echec', id: m.id, motif };
      }
      const motif = `Tentative ${tentatives} échouée : ${message}`;
      await db.query(
        `UPDATE whatsapp_messages SET tentatives = $2, motif = $3, planifie_at = $4::timestamptz + make_interval(mins => 2 * $2) WHERE id = $1`,
        [m.id, tentatives, motif, maintenant.toISOString()],
      );
      return { resultat: 'reporte', id: m.id, motif };
    }
    await db.query(`UPDATE whatsapp_messages SET statut = 'envoye', tentatives = tentatives + 1, motif = NULL, envoye_at = $2 WHERE id = $1`, [m.id, maintenant.toISOString()]);
    log?.info({ id: m.id, evenement: m.evenement }, 'Message WhatsApp envoyé');
    return { resultat: 'envoye', id: m.id };
  });
}

export function demarrerFile() {
  if (minuterie) return;
  minuterie = setInterval(() => {
    traiterFile().catch((e) => log?.error({ err: e }, 'File WhatsApp : passage en erreur'));
  }, INTERVALLE_FILE_MS);
  minuterie.unref();
}

export function arreterFile() {
  if (minuterie) clearInterval(minuterie);
  minuterie = null;
}

/** Compteurs affichés dans l'état : en attente, envoyés aujourd'hui (fuseau de l'entreprise), échecs. */
export async function compteursFile(db: Db = getPool()): Promise<{ en_attente: number; envoyes_aujourdhui: number; echecs: number }> {
  const fuseau = (await getParametres(db)).fuseau;
  const r = await one<{ en_attente: number; envoyes_aujourdhui: number; echecs: number }>(
    `SELECT count(*) FILTER (WHERE statut = 'en_attente')::int AS en_attente,
            count(*) FILTER (WHERE statut = 'envoye' AND (envoye_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date)::int AS envoyes_aujourdhui,
            count(*) FILTER (WHERE statut = 'echec')::int AS echecs
     FROM whatsapp_messages`,
    [fuseau],
    db,
  );
  return r ?? { en_attente: 0, envoyes_aujourdhui: 0, echecs: 0 };
}

/** Réservé aux tests. */
export const __tests = {
  reinitialiserDelai() {
    prochainEnvoiAt = 0;
  },
  prochainEnvoiAt: () => prochainEnvoiAt,
  definirAleatoire(f: () => number) {
    aleatoire = f;
  },
};
