// Réponses reçues sur le numéro dédié : enregistrées (texte seul, 500 caractères) et, si le client
// écrit STOP / ARRET, inscription automatique en liste STOP avec un accusé « Vous ne recevrez plus… ».

import type { Logger } from 'pino';
import { getPool, one, query, type Db } from '../../db/pool';
import { getParametres } from '../../lib/params';
import { envoyerTexte } from './connexion';
import { estDemandeStop, telephoneDepuisJid } from './telephone';

export const TEXTE_MAX = 500;
let log: Logger | null = null;

export function configurerEntrants(opts: { log: Logger }) {
  log = opts.log;
}

export interface Entrant {
  id: number;
  telephone: string;
  texte: string;
  recu_at: string;
}

/** Inscrit un numéro en liste STOP ; vrai s'il n'y était pas déjà. */
export async function inscrireOptOut(telephone: string, motif: string, db: Db = getPool()): Promise<boolean> {
  const r = await one(`INSERT INTO whatsapp_optout (telephone, motif) VALUES ($1, $2) ON CONFLICT (telephone) DO NOTHING RETURNING telephone`, [telephone, motif], db);
  if (r) {
    await query(`UPDATE whatsapp_messages SET statut = 'annule', motif = $2 WHERE telephone = $1 AND statut = 'en_attente'`, [telephone, 'Le client a demandé STOP'], db);
  }
  return !!r;
}

/**
 * Traite un message entrant (appelé par la connexion). Renvoie ce qui a été fait.
 * `envoyerAccuse` : envoi direct de l'accusé STOP (hors file : le numéro vient d'être exclu).
 */
export async function traiterEntrant(jid: string, texteBrut: string, db: Db = getPool()): Promise<{ telephone: string | null; stop: boolean; accuse: boolean }> {
  const telephone = telephoneDepuisJid(jid);
  if (!telephone) return { telephone: null, stop: false, accuse: false };
  const texte = texteBrut.replace(/\s+/g, ' ').trim().slice(0, TEXTE_MAX);
  if (!texte) return { telephone, stop: false, accuse: false };
  await query(`INSERT INTO whatsapp_entrants (telephone, texte) VALUES ($1, $2)`, [telephone, texte], db);
  if (!estDemandeStop(texte)) return { telephone, stop: false, accuse: false };
  const nouveau = await inscrireOptOut(telephone, 'STOP reçu par WhatsApp', db);
  let accuse = false;
  if (nouveau) {
    const entreprise = (await getParametres(db)).entreprise.nom.trim() || 'notre imprimerie';
    try {
      await envoyerTexte(jid, `Vous ne recevrez plus de messages de ${entreprise}. Merci.`);
      accuse = true;
    } catch (e) {
      log?.warn({ err: e, telephone }, 'Accusé STOP non envoyé');
    }
  }
  log?.info({ telephone, nouveau }, 'STOP reçu : numéro exclu des envois');
  return { telephone, stop: true, accuse };
}

/** Branché sur la connexion : ne lève jamais. */
export function surEntrant(jid: string, texte: string) {
  traiterEntrant(jid, texte).catch((e) => log?.error({ err: e }, 'Message WhatsApp entrant non traité'));
}
