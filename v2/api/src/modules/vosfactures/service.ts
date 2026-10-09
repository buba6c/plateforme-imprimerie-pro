// Envoi d'une facture Evocom vers VosFactures, journal d'envoi (table factures_vosfactures),
// annulation distante quand la facture est annulée ici. Rien n'est jamais renvoyé deux fois :
// une facture déjà créée côté VosFactures garde son identifiant distant.

import type { Request } from 'express';
import { getPool, one, query, type Db } from '../../db/pool';
import { journal } from '../../lib/audit';
import { conflict, notFound } from '../../lib/errors';
import { getParametres } from '../../lib/params';
import { ajouterJours } from '../commun/requete';
import type { LigneDocument } from '../pdf/lignes';
import { annulerFactureDistante, creerFactureDistante, ErreurVosFactures, type FactureVosFactures, type PositionVosFactures } from './client';
import { compteEnClair, liaisonConfiguree, lireConfigVosFactures, vendeurEffectif, type VendeurVosFactures } from './config';

/** Journal d'envoi d'une facture, tel que renvoyé dans les fiches et les listes. */
export interface JournalVosFactures {
  id: number | null;
  numero: string | null;
  url: string | null;
  envoye_at: string | null;
  envoye_par_nom: string | null;
  erreur: string | null;
  erreur_at: string | null;
  tentatives: number;
  annulee_at: string | null;
  annulation_erreur: string | null;
}

export const SELECT_JOURNAL_VOSFACTURES = `
  json_build_object('id', v.vosfactures_id, 'numero', v.vosfactures_numero, 'url', v.vosfactures_url, 'envoye_at', v.envoye_at,
    'envoye_par_nom', uv.nom, 'erreur', v.erreur, 'erreur_at', v.erreur_at, 'tentatives', coalesce(v.tentatives, 0),
    'annulee_at', v.annulee_at, 'annulation_erreur', v.annulation_erreur)`;

/** Unités Evocom → libellés d'unité VosFactures (texte libre côté VosFactures). */
const UNITES: Record<string, string> = {
  m2: 'm²',
  ml: 'ml',
  page: 'face',
  feuille: 'feuille',
  exemplaire: 'ex.',
  unite: 'unité',
  forfait: 'forfait',
};

interface FacturePourEnvoi {
  id: number;
  numero: string;
  statut: string;
  dossier_numero: string | null;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  client_adresse: string | null;
  lignes: LigneDocument[];
  tva_taux: number;
  total_ttc: number;
  date_emission: string;
  date_echeance: string | null;
  notes: string | null;
}

/**
 * Facture VosFactures construite depuis une facture Evocom. Les lignes Evocom sont hors taxes
 * quand la TVA s'applique : chaque position est envoyée en TTC (total_price_gross) et la dernière
 * absorbe l'écart d'arrondi pour que la somme des positions soit exactement le total TTC.
 * Une remise ou un ajustement apparaît comme une position négative.
 */
export function construirePayload(f: FacturePourEnvoi, vendeur: VendeurVosFactures): FactureVosFactures {
  const taux = Number(f.tva_taux) || 0;
  const tax: number | 'disabled' = taux > 0 ? taux : 'disabled';
  const positions: PositionVosFactures[] = f.lignes.map((l) => ({
    name: [l.designation, l.detail].filter(Boolean).join(' – ').slice(0, 255),
    quantity: l.quantite ?? 1,
    quantity_unit: l.unite ? (UNITES[l.unite] ?? l.unite) : 'unité',
    total_price_gross: Math.round(l.total * (1 + taux / 100)),
    tax,
  }));
  const somme = positions.reduce((s, p) => s + p.total_price_gross, 0);
  const ecart = f.total_ttc - somme;
  if (ecart !== 0 && positions.length) positions[positions.length - 1]!.total_price_gross += ecart;
  const reference = `Réf. Evocom ${f.numero}${f.dossier_numero ? ` · Dossier ${f.dossier_numero}` : ''}`;
  const facture: FactureVosFactures = {
    kind: 'vat',
    issue_date: f.date_emission,
    sell_date: f.date_emission,
    payment_to: f.date_echeance ?? ajouterJours(f.date_emission, 30),
    seller_name: vendeur.nom,
    buyer_name: f.client_nom,
    currency: 'XOF',
    lang: 'fr',
    description: f.notes ? `${f.notes}\n${reference}`.slice(0, 1000) : reference,
    internal_note: reference,
    positions,
  };
  if (vendeur.nif) facture.seller_tax_no = vendeur.nif;
  if (vendeur.adresse) facture.seller_street = vendeur.adresse;
  if (vendeur.email) facture.seller_email = vendeur.email;
  if (vendeur.telephone) facture.seller_phone = vendeur.telephone;
  if (f.client_email) facture.buyer_email = f.client_email;
  if (f.client_telephone) facture.buyer_phone = f.client_telephone;
  if (f.client_adresse) facture.buyer_street = f.client_adresse;
  return facture;
}

async function chargerPourEnvoi(id: number, db: Db): Promise<FacturePourEnvoi> {
  const f = await one<FacturePourEnvoi>(
    `SELECT f.id, f.numero, f.statut, dos.numero AS dossier_numero, f.client_nom, f.client_telephone, f.client_email, f.client_adresse,
            f.lignes, f.tva_taux, f.total_ttc, f.date_emission, f.date_echeance, f.notes
     FROM factures f LEFT JOIN dossiers dos ON dos.id = f.dossier_id WHERE f.id = $1`,
    [id],
    db,
  );
  if (!f) throw notFound("Cette facture n'existe pas.");
  return f;
}

/** Message d'erreur conservé dans le journal (jamais la clé, jamais de détail technique brut). */
function messageJournal(e: unknown): string {
  if (e instanceof ErreurVosFactures) return e.message;
  if (e instanceof Error && 'status' in e) return e.message;
  return 'Erreur inattendue pendant l’envoi : réessayez ; si cela persiste, prévenez l’administrateur.';
}

const enCours = new Set<number>();

/**
 * Envoie (ou renvoie après une erreur) la facture `id` vers VosFactures. Journal mis à jour dans
 * tous les cas ; l'erreur est relancée pour que l'appelant décide (bouton : 502 ; envoi
 * automatique : ignorée, le journal l'affiche).
 */
export async function envoyerVersVosFactures(req: Request, id: number, origine: 'manuel' | 'auto'): Promise<JournalVosFactures> {
  const config = await lireConfigVosFactures();
  const compte = compteEnClair(config);
  const f = await chargerPourEnvoi(id, getPool());
  if (f.statut !== 'emise') throw conflict('Cette facture est annulée : elle ne s’envoie pas vers VosFactures.');
  const deja = await one<{ vosfactures_id: number | null }>(`SELECT vosfactures_id FROM factures_vosfactures WHERE facture_id = $1`, [id]);
  if (deja?.vosfactures_id) throw conflict(`Cette facture est déjà dans VosFactures (n° ${(await lireJournal(id))?.numero ?? deja.vosfactures_id}).`);
  if (enCours.has(id)) throw conflict('Cette facture est en cours d’envoi : patientez quelques secondes.');
  enCours.add(id);
  try {
    const params = await getParametres();
    const payload = construirePayload(f, vendeurEffectif(config, params.entreprise));
    try {
      const r = await creerFactureDistante(compte, payload);
      await query(
        `INSERT INTO factures_vosfactures (facture_id, vosfactures_id, vosfactures_numero, vosfactures_url, envoye_at, envoye_par, erreur, erreur_at, tentatives, updated_at)
         VALUES ($1, $2, $3, $4, now(), $5, NULL, NULL, 1, now())
         ON CONFLICT (facture_id) DO UPDATE SET vosfactures_id = EXCLUDED.vosfactures_id, vosfactures_numero = EXCLUDED.vosfactures_numero,
           vosfactures_url = EXCLUDED.vosfactures_url, envoye_at = now(), envoye_par = EXCLUDED.envoye_par, erreur = NULL, erreur_at = NULL,
           tentatives = factures_vosfactures.tentatives + 1, updated_at = now()`,
        [id, r.id, r.number, r.view_url, req.user?.id ?? null],
      );
      await journal(req, 'facture_envoyee_vosfactures', 'facture', id, { numero: f.numero, vosfactures_id: r.id, vosfactures_numero: r.number, origine });
    } catch (e) {
      const message = messageJournal(e);
      await query(
        `INSERT INTO factures_vosfactures (facture_id, erreur, erreur_at, tentatives, updated_at) VALUES ($1, $2, now(), 1, now())
         ON CONFLICT (facture_id) DO UPDATE SET erreur = EXCLUDED.erreur, erreur_at = now(), tentatives = factures_vosfactures.tentatives + 1, updated_at = now()`,
        [id, message],
      );
      await journal(req, 'facture_envoi_vosfactures_echoue', 'facture', id, { numero: f.numero, erreur: message, origine });
      throw e;
    }
  } finally {
    enCours.delete(id);
  }
  return (await lireJournal(id))!;
}

/** Envoi automatique après émission, si la liaison est configurée et l'option activée. Ne bloque jamais l'émission. */
export async function envoyerAutomatiquement(req: Request, id: number): Promise<void> {
  const config = await lireConfigVosFactures();
  if (!config.envoi_auto || !liaisonConfiguree(config)) return;
  try {
    await envoyerVersVosFactures(req, id, 'auto');
  } catch {
    // L'erreur est dans le journal d'envoi de la facture ; un nouvel essai reste possible depuis la fiche.
  }
}

/**
 * Facture annulée côté Evocom : si elle a été envoyée, elle est annulée côté VosFactures aussi
 * (POST /invoices/cancel.json). Un échec est noté dans le journal, sans empêcher l'annulation locale.
 */
export async function annulerCoteVosFactures(req: Request, id: number, motif: string): Promise<void> {
  const j = await lireJournal(id);
  if (!j?.id || j.annulee_at) return;
  try {
    const compte = compteEnClair(await lireConfigVosFactures());
    await annulerFactureDistante(compte, j.id, motif);
    await query(`UPDATE factures_vosfactures SET annulee_at = now(), annulation_erreur = NULL, updated_at = now() WHERE facture_id = $1`, [id]);
    await journal(req, 'facture_annulee_vosfactures', 'facture', id, { vosfactures_id: j.id, vosfactures_numero: j.numero });
  } catch (e) {
    const message = messageJournal(e);
    await query(`UPDATE factures_vosfactures SET annulation_erreur = $2, updated_at = now() WHERE facture_id = $1`, [id, message]);
    await journal(req, 'facture_annulation_vosfactures_echouee', 'facture', id, { vosfactures_id: j.id, erreur: message });
  }
}

/** Nouvel essai d'annulation distante (bouton de la fiche quand la première a échoué). */
export async function reessayerAnnulationVosFactures(req: Request, id: number): Promise<JournalVosFactures> {
  const f = await one<{ statut: string; motif_annulation: string | null }>(`SELECT statut, motif_annulation FROM factures WHERE id = $1`, [id]);
  if (!f) throw notFound("Cette facture n'existe pas.");
  if (f.statut !== 'annulee') throw conflict('Cette facture n’est pas annulée.');
  const j = await lireJournal(id);
  if (!j?.id) throw conflict('Cette facture n’a jamais été envoyée vers VosFactures.');
  if (j.annulee_at) throw conflict('Cette facture est déjà annulée dans VosFactures.');
  await annulerCoteVosFactures(req, id, f.motif_annulation ?? 'Annulée dans Evocom');
  const apres = (await lireJournal(id))!;
  if (apres.annulation_erreur) throw new ErreurVosFactures(502, apres.annulation_erreur, 'erreur');
  return apres;
}

export async function lireJournal(id: number, db?: Db): Promise<JournalVosFactures | null> {
  const r = await one<{ j: JournalVosFactures }>(
    `SELECT ${SELECT_JOURNAL_VOSFACTURES} AS j FROM factures_vosfactures v LEFT JOIN users uv ON uv.id = v.envoye_par WHERE v.facture_id = $1`,
    [id],
    db,
  );
  return r?.j ?? null;
}
