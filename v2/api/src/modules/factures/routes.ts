// Factures : émission depuis un dossier (numéro FAC sans trou) ou directement sans dossier
// (client de l'annuaire ou saisi, lignes libres), liste, fiche avec situation de paiement, PDF,
// annulation (le numéro n'est jamais réutilisé), envoi vers VosFactures.
//
// Montants : le montant du dossier est TTC. Les totaux de la facture viennent de
// ventilerTTC(montant). Les lignes sont exprimées hors taxes quand la TVA s'applique
// (sinon HT = TTC) et leur somme est toujours égale au total HT : un écart d'arrondi ou un
// prix convenu différent de la grille apparaît sur une ligne explicite. Les factures directes
// suivent la même règle : prix saisis TTC ou HT selon Paramètres > Prix (prix_saisis_ht).

import { Router } from 'express';
import { z } from 'zod';
import { MONTANT_MAX, situationPaiement, ventilerTTC, type ParamsPrix } from '@evocom/shared';
import { getPool, one, query, tx, type Db } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam, qInt, qList, qStr } from '../../lib/http';
import { prochainNumero } from '../../lib/numbering';
import { getParametres, type Parametres } from '../../lib/params';
import { chargerDossier, evenement, type DossierRow } from '../dossiers/service';
import { contentDisposition } from '../fichiers/routes';
import { aujourdhui, Conditions, estDateValide, intervalle, motifLike, pagination } from '../commun/requete';
import { pdfFacture } from '../pdf/documents';
import { lignesProduits, type LigneDocument } from '../pdf/lignes';
import { pdfFactureDistante } from '../vosfactures/client';
import { compteEnClair, liaisonConfiguree, lireConfigVosFactures } from '../vosfactures/config';
import { vosfacturesRouter } from '../vosfactures/routes';
import { annulerCoteVosFactures, envoyerAutomatiquement, envoyerVersVosFactures, lireJournal, reessayerAnnulationVosFactures, SELECT_JOURNAL_VOSFACTURES } from '../vosfactures/service';

/** Lignes de la facture d'un dossier, dont la somme vaut exactement `totalHt`. */
export function lignesFacture(d: DossierRow, params: Parametres, totalHt: number): LigneDocument[] {
  const p = params.prix;
  const detail = d.detail_prix as { lignes?: unknown[]; remise?: number; total_ttc?: number } | null;
  const produits = lignesProduits(d.machine, d.specs, detail as never);
  if (!produits.length) {
    const description = d.description ? String(d.description).slice(0, 300) : null;
    return [{ designation: `Travaux d'impression ${d.numero}`, detail: description, quantite: 1, unite: 'forfait', prix_unitaire: totalHt, total: totalHt }];
  }
  // Grille saisie TTC alors que la TVA s'applique : on ramène chaque ligne au hors taxes.
  const facteur = p.tva_applicable && !p.prix_saisis_ht ? 1 / (1 + p.tva_taux / 100) : 1;
  const lignes: LigneDocument[] = produits.map((l) => ({
    ...l,
    prix_unitaire: l.prix_unitaire === null ? null : Math.round(l.prix_unitaire * facteur),
    total: Math.round(l.total * facteur),
  }));
  const remise = detail?.remise ?? 0;
  if (remise > 0) {
    const motif = (d.specs as { remise?: { motif?: string | null } } | null)?.remise?.motif;
    lignes.push({ designation: motif ? `Remise (${motif})` : 'Remise', detail: null, quantite: null, unite: null, prix_unitaire: null, total: -Math.round(remise * facteur) });
  }
  const ecart = totalHt - lignes.reduce((s, l) => s + l.total, 0);
  if (ecart !== 0) {
    const prixConvenu = detail?.total_ttc !== undefined && detail.total_ttc !== d.montant;
    lignes.push({
      designation: prixConvenu ? 'Ajustement au prix convenu' : 'Arrondi',
      detail: null,
      quantite: null,
      unite: null,
      prix_unitaire: null,
      total: ecart,
    });
  }
  return lignes;
}

// ---------------------------------------------------------------------------
// Facture directe : lignes libres, remise, TVA selon les paramètres

export interface LigneSaisie {
  designation: string;
  detail?: string | null;
  quantite: number;
  unite: string;
  prix_unitaire: number;
}

export interface TotauxDirecte {
  lignes: LigneDocument[];
  total_ht: number;
  tva_taux: number;
  tva: number;
  total_ttc: number;
  /** Sous-total des lignes saisies, avant remise, dans l'unité de saisie (TTC ou HT). */
  sous_total: number;
}

/**
 * Totaux d'une facture directe. Les prix saisis sont TTC, sauf si la TVA s'applique et que
 * Paramètres > Prix indique des prix hors taxes. Les lignes enregistrées sont hors taxes quand
 * la TVA s'applique et totalisent exactement le total HT (remise et arrondi sur des lignes explicites).
 */
export function totauxFactureDirecte(saisies: LigneSaisie[], remise: number, prix: Pick<ParamsPrix, 'tva_applicable' | 'tva_taux' | 'prix_saisis_ht'>): TotauxDirecte {
  const brutes = saisies.map((l) => ({
    designation: l.designation,
    detail: l.detail ?? null,
    quantite: l.quantite,
    unite: l.unite,
    prix_unitaire: l.prix_unitaire,
    total: Math.round(l.quantite * l.prix_unitaire),
  }));
  const sousTotal = brutes.reduce((s, l) => s + l.total, 0);
  if (remise > sousTotal) throw badRequest('La remise dépasse le total des lignes : réduisez-la.', { champs: { remise: 'Remise supérieure au total des lignes' } });
  const net = sousTotal - remise;
  const tva = prix.tva_applicable && prix.tva_taux > 0;
  const facteur = tva && !prix.prix_saisis_ht ? 1 / (1 + prix.tva_taux / 100) : 1;
  const lignes: LigneDocument[] = brutes.map((l) => ({ ...l, prix_unitaire: Math.round(l.prix_unitaire * facteur), total: Math.round(l.total * facteur) }));
  if (remise > 0) lignes.push({ designation: 'Remise', detail: null, quantite: null, unite: null, prix_unitaire: null, total: -Math.round(remise * facteur) });

  let totalHt: number;
  let montantTva: number;
  let totalTtc: number;
  if (!tva) {
    totalHt = totalTtc = net;
    montantTva = 0;
  } else if (prix.prix_saisis_ht) {
    totalHt = net;
    montantTva = Math.round(net * (prix.tva_taux / 100));
    totalTtc = totalHt + montantTva;
  } else {
    const v = ventilerTTC(net, prix);
    totalHt = v.ht;
    montantTva = v.tva;
    totalTtc = v.ttc;
  }
  const ecart = totalHt - lignes.reduce((s, l) => s + l.total, 0);
  if (ecart !== 0) lignes.push({ designation: 'Arrondi', detail: null, quantite: null, unite: null, prix_unitaire: null, total: ecart });
  return { lignes, total_ht: totalHt, tva_taux: tva ? prix.tva_taux : 0, tva: montantTva, total_ttc: totalTtc, sous_total: sousTotal };
}

const texteCourt = (libelle: string, max: number) =>
  z.string({ invalid_type_error: `${libelle} : texte attendu` }).trim().max(max, `${libelle} : ${max} caractères au maximum`);
const texteFacultatif = (libelle: string, max: number) =>
  texteCourt(libelle, max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
const dateIso = (libelle: string) =>
  z.string({ invalid_type_error: `${libelle} : date attendue` }).refine(estDateValide, `${libelle} : date invalide (format AAAA-MM-JJ)`);

const ligneSchema = z.object({
  designation: texteCourt('Désignation', 200).min(1, 'Désignation obligatoire'),
  detail: texteFacultatif('Précision', 300),
  quantite: z
    .number({ invalid_type_error: 'Quantité : nombre attendu', required_error: 'Quantité obligatoire' })
    .positive('Quantité : plus de 0')
    .max(1_000_000, 'Quantité : 1 000 000 au maximum')
    .refine((q) => Math.round(q * 100) === q * 100, 'Quantité : deux décimales au maximum'),
  unite: texteCourt('Unité', 20).min(1, 'Unité obligatoire'),
  prix_unitaire: z
    .number({ invalid_type_error: 'Prix unitaire : nombre entier de FCFA attendu', required_error: 'Prix unitaire obligatoire' })
    .int('Prix unitaire : nombre entier de FCFA')
    .min(0, 'Prix unitaire : 0 au minimum')
    .max(MONTANT_MAX, 'Prix unitaire trop élevé'),
});

export const factureDirecteSchema = z.object({
  client_id: z.number({ invalid_type_error: 'Client : identifiant attendu' }).int().positive().nullable().optional(),
  client_nom: texteCourt('Nom du client', 200).min(1, 'Indiquez le nom du client'),
  client_telephone: texteFacultatif('Téléphone', 50),
  client_email: texteFacultatif('E-mail', 200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail du client invalide'),
  client_adresse: texteFacultatif('Adresse', 300),
  date_emission: dateIso("Date d'émission").optional(),
  date_echeance: dateIso("Date d'échéance").nullable().optional(),
  lignes: z.array(ligneSchema, { invalid_type_error: 'Lignes : liste attendue', required_error: 'Ajoutez au moins une ligne' }).min(1, 'Ajoutez au moins une ligne').max(50, 'Lignes : 50 au maximum'),
  remise: z.number({ invalid_type_error: 'Remise : nombre entier de FCFA attendu' }).int('Remise : nombre entier de FCFA').min(0, 'Remise : 0 au minimum').max(MONTANT_MAX).optional(),
  notes: texteFacultatif('Remarques', 1000),
  conditions_paiement: texteFacultatif('Conditions de paiement', 1000),
});
export type FactureDirecteInput = z.infer<typeof factureDirecteSchema>;

/** Client de l'annuaire (fusions suivies) ou retrouvé/créé par son nom, comme pour un dossier. */
async function resoudreClient(db: Db, input: FactureDirecteInput): Promise<{ id: number; nom: string; telephone: string | null; email: string | null; adresse: string | null }> {
  if (input.client_id) {
    const c = await one<{ id: number; fusionne_dans: number | null }>('SELECT id, fusionne_dans FROM clients WHERE id = $1', [input.client_id], db);
    if (!c) throw badRequest('Ce client n’existe plus dans l’annuaire : choisissez-en un autre ou saisissez son nom.', { champs: { client_id: 'Client introuvable' } });
    const id = c.fusionne_dans ?? c.id;
    await query(
      `UPDATE clients SET telephone = coalesce(telephone, $2), email = coalesce(email, $3), adresse = coalesce(adresse, $4), updated_at = now() WHERE id = $1`,
      [id, input.client_telephone ?? null, input.client_email ?? null, input.client_adresse ?? null],
      db,
    );
    const fiche = await one<{ nom: string; telephone: string | null; email: string | null; adresse: string | null }>('SELECT nom, telephone, email, adresse FROM clients WHERE id = $1', [id], db);
    return {
      id,
      nom: input.client_nom || fiche!.nom,
      telephone: input.client_telephone ?? fiche!.telephone,
      email: input.client_email ?? fiche!.email,
      adresse: input.client_adresse ?? fiche!.adresse,
    };
  }
  const existant = await one<{ id: number; telephone: string | null; email: string | null; adresse: string | null }>(
    `SELECT id, telephone, email, adresse FROM clients WHERE fusionne_dans IS NULL AND lower(trim(nom)) = lower(trim($1))
     ORDER BY (telephone IS NOT DISTINCT FROM $2) DESC, id LIMIT 1`,
    [input.client_nom, input.client_telephone ?? null],
    db,
  );
  if (existant) {
    await query(
      `UPDATE clients SET telephone = coalesce(telephone, $2), email = coalesce(email, $3), adresse = coalesce(adresse, $4), updated_at = now() WHERE id = $1`,
      [existant.id, input.client_telephone ?? null, input.client_email ?? null, input.client_adresse ?? null],
      db,
    );
    return {
      id: existant.id,
      nom: input.client_nom,
      telephone: input.client_telephone ?? existant.telephone,
      email: input.client_email ?? existant.email,
      adresse: input.client_adresse ?? existant.adresse,
    };
  }
  const cree = await one<{ id: number }>(
    `INSERT INTO clients (nom, telephone, email, adresse) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.client_nom, input.client_telephone ?? null, input.client_email ?? null, input.client_adresse ?? null],
    db,
  );
  return { id: cree!.id, nom: input.client_nom, telephone: input.client_telephone ?? null, email: input.client_email ?? null, adresse: input.client_adresse ?? null };
}

// ---------------------------------------------------------------------------
// Lecture

const SELECT_FACTURE = `
  SELECT f.*, dos.numero AS dossier_numero, dos.montant AS dossier_montant, dos.machine AS dossier_machine, dos.description AS dossier_description,
         uc.nom AS created_by_nom, ua.nom AS annulee_par_nom,
         coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = f.dossier_id AND p.statut = 'valide'), 0)::bigint AS deja_paye,
         coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = f.dossier_id AND p.statut = 'a_valider'), 0)::bigint AS en_attente_validation,
         CASE WHEN v.facture_id IS NULL THEN NULL ELSE ${SELECT_JOURNAL_VOSFACTURES} END AS vosfactures
  FROM factures f
  LEFT JOIN dossiers dos ON dos.id = f.dossier_id
  LEFT JOIN users uc ON uc.id = f.created_by
  LEFT JOIN users ua ON ua.id = f.annulee_par
  LEFT JOIN factures_vosfactures v ON v.facture_id = f.id
  LEFT JOIN users uv ON uv.id = v.envoye_par`;

async function detailFacture(id: number, db?: Db) {
  const f = await one(`${SELECT_FACTURE} WHERE f.id = $1`, [id], db);
  if (!f) throw notFound("Cette facture n'existe pas.");
  const config = await lireConfigVosFactures(db);
  // Sans dossier, aucun paiement n'est rattaché : la situation de paiement n'est pas suivie ici.
  const suivie = f.dossier_id !== null;
  const reste = suivie ? Math.max(0, f.total_ttc - f.deja_paye) : null;
  return {
    ...f,
    reste,
    situation_paiement: suivie ? situationPaiement(f.total_ttc, f.deja_paye) : null,
    origine: f.dossier_id === null ? 'directe' : 'dossier',
    vosfactures_actif: liaisonConfiguree(config),
  };
}

// ---------------------------------------------------------------------------
// /api/factures

export const facturesRouter = Router();
facturesRouter.use(requireAuth, requireRole('admin', 'preparateur'));

// Réglages de la liaison (administrateur) : avant les routes /:id.
facturesRouter.use('/vosfactures', vosfacturesRouter);

const FILTRES_VOSFACTURES = ['envoyee', 'non_envoyee', 'erreur'] as const;

facturesRouter.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req, 50, 200);
  const { from, to } = intervalle(req);
  const c = new Conditions();
  const q = qStr(req, 'q');
  if (q) c.add(`lower(f.numero || ' ' || f.client_nom || ' ' || coalesce(dos.numero, '') || ' ' || coalesce(v.vosfactures_numero, '')) LIKE ?`, motifLike(q));
  if (from) c.add('f.date_emission >= ?::date', from);
  if (to) c.add('f.date_emission <= ?::date', to);
  const statuts = qList(req, 'statut');
  if (statuts?.length) {
    const inconnus = statuts.filter((s) => s !== 'emise' && s !== 'annulee');
    if (inconnus.length) throw badRequest(`Statut de facture inconnu : ${inconnus.join(', ')}. Valeurs possibles : emise, annulee.`);
    c.add('f.statut = ANY(?)', statuts);
  }
  const vosfactures = qStr(req, 'vosfactures');
  if (vosfactures) {
    if (!(FILTRES_VOSFACTURES as readonly string[]).includes(vosfactures)) {
      throw badRequest(`Filtre VosFactures inconnu : ${vosfactures}. Valeurs possibles : ${FILTRES_VOSFACTURES.join(', ')}.`);
    }
    if (vosfactures === 'envoyee') c.add('v.vosfactures_id IS NOT NULL');
    else if (vosfactures === 'non_envoyee') c.add('v.vosfactures_id IS NULL');
    else c.add('v.vosfactures_id IS NULL AND v.erreur IS NOT NULL');
  }
  const origine = qStr(req, 'origine');
  if (origine === 'directe') c.add('f.dossier_id IS NULL');
  else if (origine === 'dossier') c.add('f.dossier_id IS NOT NULL');
  else if (origine) throw badRequest(`Origine inconnue : ${origine}. Valeurs possibles : dossier, directe.`);
  const clientId = qInt(req, 'client_id');
  if (clientId) c.add('f.client_id = ?', clientId);
  const dossierId = qInt(req, 'dossier_id');
  if (dossierId) c.add('f.dossier_id = ?', dossierId);
  const FROM = `FROM factures f LEFT JOIN dossiers dos ON dos.id = f.dossier_id LEFT JOIN factures_vosfactures v ON v.facture_id = f.id`;
  const agg = await one<{ n: number; somme: number; emises: number; annulees: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(f.total_ttc) FILTER (WHERE f.statut = 'emise'), 0)::bigint AS somme,
            count(*) FILTER (WHERE f.statut = 'emise')::int AS emises, count(*) FILTER (WHERE f.statut = 'annulee')::int AS annulees
     ${FROM} ${c.where}`,
    c.args,
  );
  const items = await query(
    `SELECT f.id, f.numero, f.statut, f.dossier_id, dos.numero AS dossier_numero, f.client_id, f.client_nom,
            f.total_ht, f.tva_taux, f.tva, f.total_ttc, f.date_emission, f.date_echeance, f.annulee_at, f.motif_annulation, f.created_at,
            uc.nom AS created_by_nom,
            CASE WHEN f.dossier_id IS NULL THEN NULL
                 ELSE (SELECT coalesce(sum(p.montant),0)::int FROM paiements p WHERE p.dossier_id = f.dossier_id AND p.statut = 'valide') END AS deja_paye,
            CASE WHEN v.facture_id IS NULL THEN NULL ELSE ${SELECT_JOURNAL_VOSFACTURES} END AS vosfactures
     ${FROM} LEFT JOIN users uc ON uc.id = f.created_by LEFT JOIN users uv ON uv.id = v.envoye_par
     ${c.where}
     ORDER BY f.date_emission DESC, f.numero DESC
     LIMIT ${limit} OFFSET ${offset}`,
    c.args,
  );
  const config = await lireConfigVosFactures();
  // somme_ttc : total des factures émises (les annulées ne comptent pas) parmi les résultats filtrés.
  const lignes = items.map((f: any) => ({
    ...f,
    origine: f.dossier_id === null ? 'directe' : 'dossier',
    reste: f.deja_paye === null ? null : Math.max(0, f.total_ttc - f.deja_paye),
    situation_paiement: f.deja_paye === null ? null : situationPaiement(f.total_ttc, f.deja_paye),
  }));
  res.json({
    items: lignes,
    total: agg?.n ?? 0,
    somme_ttc: agg?.somme ?? 0,
    compteurs: { emise: agg?.emises ?? 0, annulee: agg?.annulees ?? 0 },
    page,
    limit,
    vosfactures_actif: liaisonConfiguree(config),
  });
});

/** Facture directe, sans dossier : client de l'annuaire ou saisi, lignes libres. */
facturesRouter.post('/', async (req, res) => {
  const user = me(req);
  const input = factureDirecteSchema.parse(req.body ?? {});
  if (input.date_echeance && input.date_emission && input.date_echeance < input.date_emission) {
    throw badRequest("La date d'échéance précède la date d'émission : corrigez-la.", { champs: { date_echeance: "Avant la date d'émission" } });
  }
  const factureId = await tx(async (db) => {
    const params = await getParametres(db);
    const totaux = totauxFactureDirecte(input.lignes, input.remise ?? 0, params.prix);
    if (totaux.total_ttc <= 0) throw badRequest('Le total de la facture doit être supérieur à 0 FCFA.', { champs: { lignes: 'Total à 0' } });
    if (totaux.total_ttc > MONTANT_MAX) throw badRequest('Le total dépasse le plafond autorisé : vérifiez les quantités et les prix.');
    const dateEmission = input.date_emission ?? aujourdhui(params.fuseau);
    if (input.date_echeance && input.date_echeance < dateEmission) {
      throw badRequest("La date d'échéance précède la date d'émission : corrigez-la.", { champs: { date_echeance: "Avant la date d'émission" } });
    }
    const client = await resoudreClient(db, input);
    const numero = await prochainNumero(db, 'FAC');
    const f = await one<{ id: number }>(
      `INSERT INTO factures (numero, dossier_id, client_id, client_nom, client_telephone, client_email, client_adresse, lignes,
         total_ht, tva_taux, tva, total_ttc, remise, date_emission, date_echeance, notes, conditions_paiement, created_by)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::date, $15, $16, $17) RETURNING id`,
      [
        numero,
        client.id,
        client.nom,
        client.telephone,
        client.email,
        client.adresse,
        JSON.stringify(totaux.lignes),
        totaux.total_ht,
        totaux.tva_taux,
        totaux.tva,
        totaux.total_ttc,
        input.remise ?? 0,
        dateEmission,
        input.date_echeance ?? null,
        input.notes ?? null,
        input.conditions_paiement ?? null,
        user.id,
      ],
      db,
    );
    await journal(req, 'facture_emise', 'facture', f!.id, { numero, directe: true, client_id: client.id, client_nom: client.nom, total_ttc: totaux.total_ttc }, db);
    return f!.id;
  });
  await envoyerAutomatiquement(req, factureId);
  res.status(201).json(await detailFacture(factureId, getPool()));
});

facturesRouter.get('/:id', async (req, res) => {
  res.json(await detailFacture(intParam(req)));
});

facturesRouter.get('/:id/pdf', async (req, res) => {
  const f = await detailFacture(intParam(req));
  const params = await getParametres();
  const pdf = await pdfFacture(
    {
      numero: f.numero,
      machine: f.dossier_machine,
      objet: f.dossier_description,
      statut: f.statut,
      date_emission: f.date_emission,
      date_echeance: f.date_echeance,
      dossier_numero: f.dossier_numero,
      client_nom: f.client_nom,
      client_telephone: f.client_telephone,
      client_email: f.client_email,
      client_adresse: f.client_adresse,
      lignes: f.lignes,
      total_ht: f.total_ht,
      tva_taux: Number(f.tva_taux),
      tva: f.tva,
      total_ttc: f.total_ttc,
      deja_paye: f.deja_paye,
      reste: f.reste,
      notes: f.notes,
      conditions_paiement: f.conditions_paiement,
      annulee_at: f.annulee_at,
      motif_annulation: f.motif_annulation,
    },
    params,
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDisposition(req.query.telecharger === '1' ? 'attachment' : 'inline', `Facture ${f.numero}.pdf`));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

facturesRouter.post('/:id/annuler', requireRole('admin'), async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const motif = typeof req.body?.motif === 'string' ? req.body.motif.trim() : '';
  if (motif.length < 3) {
    throw badRequest("Indiquez le motif de l'annulation (3 caractères au moins) : il reste attaché à la facture.", { champs: { motif: 'Motif obligatoire' } });
  }
  if (motif.length > 500) throw badRequest("Le motif de l'annulation est trop long (500 caractères au maximum).");
  await tx(async (db) => {
    const f = await one<{ id: number; numero: string; statut: string; dossier_id: number | null; total_ttc: number }>(
      `SELECT id, numero, statut, dossier_id, total_ttc FROM factures WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!f) throw notFound("Cette facture n'existe pas.");
    if (f.statut === 'annulee') throw conflict('Cette facture est déjà annulée.');
    await query(`UPDATE factures SET statut = 'annulee', annulee_at = now(), annulee_par = $2, motif_annulation = $3 WHERE id = $1`, [id, user.id, motif], db);
    if (f.dossier_id !== null) {
      await evenement(db, f.dossier_id, user.id, { type: 'modification', action: 'facture_annulee', commentaire: motif, data: { facture_id: id, numero: f.numero } });
    }
    await journal(req, 'facture_annulee', 'facture', id, { numero: f.numero, dossier_id: f.dossier_id, total_ttc: f.total_ttc, motif }, db);
  });
  // Envoyée à VosFactures : annulée là-bas aussi (un échec est noté dans le journal d'envoi, réessayable).
  await annulerCoteVosFactures(req, id, motif);
  res.json(await detailFacture(id));
});

// ---------------------------------------------------------------------------
// Liaison VosFactures d'une facture

/** Envoi (ou nouvel essai) vers VosFactures ; 502 avec le message en clair si VosFactures refuse. */
facturesRouter.post('/:id/vosfactures', async (req, res) => {
  const id = intParam(req);
  await envoyerVersVosFactures(req, id, 'manuel');
  res.json(await detailFacture(id));
});

/** Nouvel essai d'annulation côté VosFactures quand la première a échoué. */
facturesRouter.post('/:id/vosfactures/annuler', requireRole('admin'), async (req, res) => {
  const id = intParam(req);
  await reessayerAnnulationVosFactures(req, id);
  res.json(await detailFacture(id));
});

/** PDF édité par VosFactures, servi par le serveur (la clé API ne sort jamais vers le navigateur). */
facturesRouter.get('/:id/vosfactures.pdf', async (req, res) => {
  const id = intParam(req);
  const f = await one<{ numero: string }>('SELECT numero FROM factures WHERE id = $1', [id]);
  if (!f) throw notFound("Cette facture n'existe pas.");
  const j = await lireJournal(id);
  if (!j?.id) throw conflict("Cette facture n'a pas été envoyée vers VosFactures.");
  const compte = compteEnClair(await lireConfigVosFactures());
  const pdf = await pdfFactureDistante(compte, j.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDisposition(req.query.telecharger === '1' ? 'attachment' : 'inline', `Facture VosFactures ${j.numero ?? f.numero}.pdf`));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

// ---------------------------------------------------------------------------
// /api/dossiers/:id/facture (monté sur /api/dossiers, sans conflit avec les routes des dossiers)

export const dossierFactureRouter = Router();

dossierFactureRouter.post('/:id/facture', requireAuth, requireRole('admin', 'preparateur'), async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const factureId = await tx(async (db) => {
    // Le verrou sur le dossier sérialise deux émissions simultanées pour le même dossier.
    const d = await chargerDossier(user, id, db, true);
    if (d.montant === null || d.montant <= 0) {
      throw conflict("Ce dossier n'a pas encore de montant : renseignez-le (ou faites calculer le prix) avant d'émettre la facture.");
    }
    const existante = await one<{ id: number; numero: string }>(`SELECT id, numero FROM factures WHERE dossier_id = $1 AND statut = 'emise'`, [id], db);
    if (existante) {
      throw conflict(`Ce dossier est déjà facturé (${existante.numero}). Annulez cette facture pour en émettre une nouvelle.`, { facture_id: existante.id });
    }
    const params = await getParametres(db);
    const v = ventilerTTC(d.montant, params.prix);
    const lignes = lignesFacture(d, params, v.ht);
    const client = d.client_id ? await one<{ adresse: string | null; email: string | null }>(`SELECT adresse, email FROM clients WHERE id = $1`, [d.client_id], db) : null;
    const numero = await prochainNumero(db, 'FAC');
    const f = await one<{ id: number }>(
      `INSERT INTO factures (numero, dossier_id, client_id, client_nom, client_telephone, client_email, client_adresse, lignes,
         total_ht, tva_taux, tva, total_ttc, date_emission, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,(now() AT TIME ZONE $13)::date,$14) RETURNING id`,
      [
        numero,
        id,
        d.client_id,
        d.client_nom,
        d.client_telephone,
        d.client_email ?? client?.email ?? null,
        client?.adresse ?? d.adresse_livraison ?? null,
        JSON.stringify(lignes),
        v.ht,
        params.prix.tva_applicable ? params.prix.tva_taux : 0,
        v.tva,
        v.ttc,
        params.fuseau,
        user.id,
      ],
      db,
    ).catch((e) => {
      if (e.code === '23505') throw conflict('Ce dossier vient d’être facturé par quelqu’un d’autre : rechargez la fiche du dossier.');
      throw e;
    });
    await evenement(db, id, user.id, { type: 'modification', action: 'facture_emise', data: { facture_id: f!.id, numero, total_ttc: v.ttc } });
    await journal(req, 'facture_emise', 'facture', f!.id, { numero, dossier_id: id, dossier_numero: d.numero, total_ttc: v.ttc }, db);
    return f!.id;
  });
  await envoyerAutomatiquement(req, factureId);
  res.status(201).json(await detailFacture(factureId, getPool()));
});
