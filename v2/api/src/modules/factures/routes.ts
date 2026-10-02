// Factures : émission depuis un dossier (numéro FAC sans trou), liste, fiche avec situation de
// paiement, PDF, annulation (le numéro n'est jamais réutilisé).
//
// Montants : le montant du dossier est TTC. Les totaux de la facture viennent de
// ventilerTTC(montant). Les lignes sont exprimées hors taxes quand la TVA s'applique
// (sinon HT = TTC) et leur somme est toujours égale au total HT : un écart d'arrondi ou un
// prix convenu différent de la grille apparaît sur une ligne explicite.

import { Router } from 'express';
import { situationPaiement, ventilerTTC } from '@evocom/shared';
import { getPool, one, query, tx, type Db } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam, qInt, qList, qStr } from '../../lib/http';
import { prochainNumero } from '../../lib/numbering';
import { getParametres, type Parametres } from '../../lib/params';
import { chargerDossier, evenement, type DossierRow } from '../dossiers/service';
import { contentDisposition } from '../fichiers/routes';
import { Conditions, intervalle, motifLike, pagination } from '../commun/requete';
import { pdfFacture } from '../pdf/documents';
import { lignesProduits, type LigneDocument } from '../pdf/lignes';

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

const SELECT_FACTURE = `
  SELECT f.*, dos.numero AS dossier_numero, dos.montant AS dossier_montant,
         uc.nom AS created_by_nom, ua.nom AS annulee_par_nom,
         coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = f.dossier_id AND p.statut = 'valide'), 0)::bigint AS deja_paye,
         coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = f.dossier_id AND p.statut = 'a_valider'), 0)::bigint AS en_attente_validation
  FROM factures f
  JOIN dossiers dos ON dos.id = f.dossier_id
  LEFT JOIN users uc ON uc.id = f.created_by
  LEFT JOIN users ua ON ua.id = f.annulee_par`;

async function detailFacture(id: number, db?: Db) {
  const f = await one(`${SELECT_FACTURE} WHERE f.id = $1`, [id], db);
  if (!f) throw notFound("Cette facture n'existe pas.");
  const reste = Math.max(0, f.total_ttc - f.deja_paye);
  return { ...f, reste, situation_paiement: situationPaiement(f.total_ttc, f.deja_paye) };
}

// ---------------------------------------------------------------------------
// /api/factures

export const facturesRouter = Router();
facturesRouter.use(requireAuth, requireRole('admin', 'preparateur'));

facturesRouter.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req, 50, 200);
  const { from, to } = intervalle(req);
  const c = new Conditions();
  const q = qStr(req, 'q');
  if (q) c.add(`lower(f.numero || ' ' || f.client_nom || ' ' || dos.numero) LIKE ?`, motifLike(q));
  if (from) c.add('f.date_emission >= ?::date', from);
  if (to) c.add('f.date_emission <= ?::date', to);
  const statuts = qList(req, 'statut');
  if (statuts?.length) {
    const inconnus = statuts.filter((s) => s !== 'emise' && s !== 'annulee');
    if (inconnus.length) throw badRequest(`Statut de facture inconnu : ${inconnus.join(', ')}. Valeurs possibles : emise, annulee.`);
    c.add('f.statut = ANY(?)', statuts);
  }
  const clientId = qInt(req, 'client_id');
  if (clientId) c.add('f.client_id = ?', clientId);
  const dossierId = qInt(req, 'dossier_id');
  if (dossierId) c.add('f.dossier_id = ?', dossierId);
  const agg = await one<{ n: number; somme: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(f.total_ttc) FILTER (WHERE f.statut = 'emise'), 0)::bigint AS somme
     FROM factures f JOIN dossiers dos ON dos.id = f.dossier_id ${c.where}`,
    c.args,
  );
  const items = await query(
    `SELECT f.id, f.numero, f.statut, f.dossier_id, dos.numero AS dossier_numero, f.client_id, f.client_nom,
            f.total_ht, f.tva_taux, f.tva, f.total_ttc, f.date_emission, f.annulee_at, f.motif_annulation, f.created_at,
            uc.nom AS created_by_nom
     FROM factures f JOIN dossiers dos ON dos.id = f.dossier_id LEFT JOIN users uc ON uc.id = f.created_by
     ${c.where}
     ORDER BY f.date_emission DESC, f.numero DESC
     LIMIT ${limit} OFFSET ${offset}`,
    c.args,
  );
  // somme_ttc : total des factures émises (les annulées ne comptent pas) parmi les résultats filtrés.
  res.json({ items, total: agg?.n ?? 0, somme_ttc: agg?.somme ?? 0, page, limit });
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
      statut: f.statut,
      date_emission: f.date_emission,
      dossier_numero: f.dossier_numero,
      client_nom: f.client_nom,
      client_telephone: f.client_telephone,
      client_adresse: f.client_adresse,
      lignes: f.lignes,
      total_ht: f.total_ht,
      tva_taux: Number(f.tva_taux),
      tva: f.tva,
      total_ttc: f.total_ttc,
      deja_paye: f.deja_paye,
      reste: f.reste,
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
    const f = await one<{ id: number; numero: string; statut: string; dossier_id: number; total_ttc: number }>(
      `SELECT id, numero, statut, dossier_id, total_ttc FROM factures WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!f) throw notFound("Cette facture n'existe pas.");
    if (f.statut === 'annulee') throw conflict('Cette facture est déjà annulée.');
    await query(`UPDATE factures SET statut = 'annulee', annulee_at = now(), annulee_par = $2, motif_annulation = $3 WHERE id = $1`, [id, user.id, motif], db);
    await evenement(db, f.dossier_id, user.id, { type: 'modification', action: 'facture_annulee', commentaire: motif, data: { facture_id: id, numero: f.numero } });
    await journal(req, 'facture_annulee', 'facture', id, { numero: f.numero, dossier_id: f.dossier_id, total_ttc: f.total_ttc, motif }, db);
  });
  res.json(await detailFacture(id));
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
    const client = d.client_id ? await one<{ adresse: string | null }>(`SELECT adresse FROM clients WHERE id = $1`, [d.client_id], db) : null;
    const numero = await prochainNumero(db, 'FAC');
    const f = await one<{ id: number }>(
      `INSERT INTO factures (numero, dossier_id, client_id, client_nom, client_telephone, client_adresse, lignes,
         total_ht, tva_taux, tva, total_ttc, date_emission, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,(now() AT TIME ZONE $12)::date,$13) RETURNING id`,
      [
        numero,
        id,
        d.client_id,
        d.client_nom,
        d.client_telephone,
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
  res.status(201).json(await detailFacture(factureId, getPool()));
});

