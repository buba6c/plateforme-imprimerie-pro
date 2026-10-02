// Devis : chiffrage par le moteur de prix, envoi, acceptation, conversion en dossier, PDF.
//
// Circuit d'un devis (le statut « converti » n'est atteint que par POST /devis/:id/convertir) :
//   brouillon -> envoye -> accepte | refuse
//   accepte   -> refuse  (le client se rétracte)
//   refuse    -> envoye  (nouvelle proposition après négociation)
// Modification (PATCH) : brouillon ou envoyé ; le prix est recalculé dès que la machine ou les
// spécifications changent. Suppression : brouillon uniquement.

import { Router } from 'express';
import { z } from 'zod';
import {
  calculerPrix,
  MACHINES,
  MODES_PAIEMENT,
  specsSchemaFor,
  STATUT_DEVIS_LABELS,
  STATUTS_DEVIS,
  telephoneSchema,
  type Machine,
  type Specs,
  type StatutDevis,
} from '@evocom/shared';
import { getPool, one, query, tx, type Db } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors';
import { intParam, qList, qStr } from '../../lib/http';
import { prochainNumero } from '../../lib/numbering';
import { getParametres } from '../../lib/params';
import { getTarifs } from '../../lib/tarifs';
import type { AuthUser } from '../../types';
import { creerDossier, evenement } from '../dossiers/service';
import { contentDisposition } from '../fichiers/routes';
import { Conditions, motifLike, pagination } from '../commun/requete';
import { pdfDevis } from '../pdf/documents';
import { lignesProduits } from '../pdf/lignes';

export const devisRouter = Router();
devisRouter.use(requireAuth, requireRole('admin', 'preparateur'));

const TRANSITIONS: Record<StatutDevis, StatutDevis[]> = {
  brouillon: ['envoye'],
  envoye: ['accepte', 'refuse'],
  accepte: ['refuse'],
  refuse: ['envoye'],
  converti: [],
};
const MODIFIABLES: readonly StatutDevis[] = ['brouillon', 'envoye'];
const CONVERTIBLES: readonly StatutDevis[] = ['accepte', 'envoye'];

const texteOpt = (max: number, libelle: string) =>
  z
    .string({ invalid_type_error: `${libelle} : texte attendu` })
    .trim()
    .max(max, `${libelle} : ${max} caractères au maximum`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const devisSchema = z.object({
  machine: z.enum(MACHINES, { errorMap: () => ({ message: 'Choisissez la machine : roland ou xerox' }) }),
  client_id: z.number({ invalid_type_error: 'Client invalide' }).int().positive().nullable().optional(),
  client_nom: z
    .string({ required_error: 'Indiquez le client', invalid_type_error: 'Nom du client : texte attendu' })
    .trim()
    .min(1, 'Indiquez le client')
    .max(200, 'Nom du client : 200 caractères au maximum'),
  client_telephone: telephoneSchema,
  client_email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Adresse e-mail invalide')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  description: texteOpt(2000, 'Description'),
  specs: z.unknown(),
  notes: texteOpt(2000, 'Remarques'),
  validite_jours: z
    .number({ invalid_type_error: 'Durée de validité : nombre de jours attendu' })
    .int('Durée de validité : nombre entier de jours')
    .min(1, 'Durée de validité : 1 jour au minimum')
    .max(365, 'Durée de validité : 365 jours au maximum')
    .optional(),
});

const SELECT_DEVIS = `
  SELECT dv.*, u.nom AS created_by_nom, dos.numero AS dossier_numero,
         ((dv.created_at AT TIME ZONE $2)::date + dv.validite_jours) AS date_validite,
         (dv.statut IN ('brouillon','envoye') AND (dv.created_at AT TIME ZONE $2)::date + dv.validite_jours < (now() AT TIME ZONE $2)::date) AS expire
  FROM devis dv
  LEFT JOIN users u ON u.id = dv.created_by
  LEFT JOIN dossiers dos ON dos.id = dv.dossier_id`;

type DevisRow = Record<string, any> & {
  id: number;
  numero: string;
  statut: StatutDevis;
  machine: Machine;
  created_by: number | null;
  dossier_id: number | null;
  total_ttc: number;
};

function estAuteurOuAdmin(user: AuthUser, d: DevisRow): boolean {
  return user.role === 'admin' || d.created_by === user.id;
}

async function chargerDevis(user: AuthUser, id: number, db: Db = getPool(), verrou = false): Promise<DevisRow> {
  const params = await getParametres(db);
  if (verrou) {
    // FOR NO KEY UPDATE : sérialise les conversions concurrentes sans bloquer la clé étrangère
    // dossiers.devis_id posée par la création du dossier (verrou FOR KEY SHARE compatible).
    const locked = await one(`SELECT id FROM devis WHERE id = $1 FOR NO KEY UPDATE`, [id], db);
    if (!locked) throw notFound("Ce devis n'existe pas ou ne vous est pas accessible.");
  }
  const d = await one<DevisRow>(`${SELECT_DEVIS} WHERE dv.id = $1`, [id, params.fuseau], db);
  if (!d || !estAuteurOuAdmin(user, d)) throw notFound("Ce devis n'existe pas ou ne vous est pas accessible.");
  return d;
}

function presenter(user: AuthUser, d: DevisRow) {
  const auteur = estAuteurOuAdmin(user, d);
  return {
    ...d,
    statut_label: STATUT_DEVIS_LABELS[d.statut],
    transitions: auteur ? TRANSITIONS[d.statut] : [],
    peut_modifier: auteur && MODIFIABLES.includes(d.statut),
    peut_supprimer: auteur && d.statut === 'brouillon',
    peut_convertir: auteur && CONVERTIBLES.includes(d.statut) && !d.dossier_id,
  };
}

/** Calcule le prix ; 422 avec la liste des erreurs si la grille ne permet pas de chiffrer. */
async function chiffrer(machine: Machine, specsBrutes: unknown, db: Db) {
  const specs = specsSchemaFor(machine).parse(specsBrutes ?? { lignes: [], forfaits: [] }) as Specs;
  const [tarifs, params] = await Promise.all([getTarifs(db), getParametres(db)]);
  const prix = calculerPrix(machine, specs, tarifs, params.prix);
  if (!prix.ok) {
    throw unprocessable('Le prix du devis ne peut pas être calculé : corrigez les lignes signalées ou complétez la grille tarifaire.', {
      erreurs: prix.erreurs,
    });
  }
  // Le détail garde la règle de TVA appliquée, pour réimprimer le devis à l'identique.
  const detail = { ...prix, tva_applicable: params.prix.tva_applicable, tva_taux: params.prix.tva_taux, prix_saisis_ht: params.prix.prix_saisis_ht };
  return { specs, prix, detail };
}

async function clientExistant(db: Db, clientId: number | null | undefined): Promise<number | null> {
  if (!clientId) return null;
  const c = await one<{ id: number; fusionne_dans: number | null }>(`SELECT id, fusionne_dans FROM clients WHERE id = $1`, [clientId], db);
  if (!c) throw badRequest("Le client choisi n'existe pas : choisissez-le de nouveau dans la liste ou saisissez son nom.");
  return c.fusionne_dans ?? c.id;
}

// ---------------------------------------------------------------------------

devisRouter.get('/', async (req, res) => {
  const user = me(req);
  const params = await getParametres();
  const { page, limit, offset } = pagination(req, 50, 200);
  const c = new Conditions();
  if (user.role !== 'admin') c.add('dv.created_by = ?', user.id);
  const statuts = qList(req, 'statut');
  if (statuts?.length) {
    const inconnus = statuts.filter((s) => !(STATUTS_DEVIS as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Statut de devis inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${STATUTS_DEVIS.join(', ')}.`);
    c.add('dv.statut = ANY(?)', statuts);
  }
  const q = qStr(req, 'q');
  if (q) c.add(`lower(dv.numero || ' ' || dv.client_nom || ' ' || coalesce(dv.description, '')) LIKE ?`, motifLike(q));
  const total = await one<{ n: number }>(`SELECT count(*)::int AS n FROM devis dv ${c.where}`, c.args);
  const tz = `$${c.args.length + 1}`; // fuseau, pour les colonnes calculées
  const rows = await query<DevisRow>(
    `SELECT dv.id, dv.numero, dv.statut, dv.machine, dv.client_id, dv.client_nom, dv.client_telephone, dv.description,
            dv.total_ht, dv.tva, dv.total_ttc, dv.validite_jours, dv.dossier_id, dv.created_by, dv.created_at, dv.updated_at,
            u.nom AS created_by_nom, dos.numero AS dossier_numero,
            ((dv.created_at AT TIME ZONE ${tz})::date + dv.validite_jours) AS date_validite,
            (dv.statut IN ('brouillon','envoye') AND (dv.created_at AT TIME ZONE ${tz})::date + dv.validite_jours < (now() AT TIME ZONE ${tz})::date) AS expire
     FROM devis dv
     LEFT JOIN users u ON u.id = dv.created_by
     LEFT JOIN dossiers dos ON dos.id = dv.dossier_id
     ${c.where}
     ORDER BY dv.created_at DESC, dv.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [...c.args, params.fuseau],
  );
  res.json({ items: rows.map((r) => ({ ...r, statut_label: STATUT_DEVIS_LABELS[r.statut] })), total: total?.n ?? 0, page, limit });
});

devisRouter.post('/', async (req, res) => {
  const user = me(req);
  const input = devisSchema.parse(req.body ?? {});
  const id = await tx(async (db) => {
    const { specs, prix, detail } = await chiffrer(input.machine, input.specs, db);
    const clientId = await clientExistant(db, input.client_id);
    const numero = await prochainNumero(db, 'DEV');
    const r = await one<{ id: number }>(
      `INSERT INTO devis (numero, machine, client_id, client_nom, client_telephone, client_email, description, specs, detail_prix,
         total_ht, tva, total_ttc, validite_jours, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [
        numero,
        input.machine,
        clientId,
        input.client_nom,
        input.client_telephone ?? null,
        input.client_email ?? null,
        input.description ?? null,
        JSON.stringify(specs),
        JSON.stringify(detail),
        prix.total_ht,
        prix.tva,
        prix.total_ttc,
        input.validite_jours ?? 15,
        input.notes ?? null,
        user.id,
      ],
      db,
    );
    return r!.id;
  });
  res.status(201).json(presenter(user, await chargerDevis(user, id)));
});

devisRouter.get('/:id', async (req, res) => {
  const user = me(req);
  res.json(presenter(user, await chargerDevis(user, intParam(req))));
});

devisRouter.patch('/:id', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const input = devisSchema.partial().parse(req.body ?? {});
  await tx(async (db) => {
    const d = await chargerDevis(user, id, db, true);
    if (!MODIFIABLES.includes(d.statut)) {
      throw conflict(`Un devis « ${STATUT_DEVIS_LABELS[d.statut]} » ne se modifie plus. Créez un nouveau devis si nécessaire.`);
    }
    const sets: string[] = [];
    const args: unknown[] = [];
    const set = (col: string, v: unknown) => {
      args.push(v);
      sets.push(`${col} = $${args.length}`);
    };
    for (const k of ['client_nom', 'client_telephone', 'client_email', 'description', 'notes', 'validite_jours'] as const) {
      if (input[k] !== undefined) set(k, input[k] ?? (k === 'validite_jours' ? 15 : null));
    }
    if (input.client_id !== undefined) set('client_id', await clientExistant(db, input.client_id));
    if (input.machine !== undefined || input.specs !== undefined) {
      const machine = input.machine ?? d.machine;
      const { specs, prix, detail } = await chiffrer(machine, input.specs ?? d.specs, db);
      set('machine', machine);
      set('specs', JSON.stringify(specs));
      set('detail_prix', JSON.stringify(detail));
      set('total_ht', prix.total_ht);
      set('tva', prix.tva);
      set('total_ttc', prix.total_ttc);
    }
    if (!sets.length) return;
    args.push(id);
    await query(`UPDATE devis SET ${sets.join(', ')} WHERE id = $${args.length}`, args, db);
  });
  res.json(presenter(user, await chargerDevis(user, id)));
});

devisRouter.post('/:id/statut', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const { statut } = z
    .object({
      statut: z.enum(['envoye', 'accepte', 'refuse'], {
        errorMap: () => ({ message: 'Statut attendu : envoye, accepte ou refuse (la conversion passe par « Convertir en dossier »).' }),
      }),
    })
    .parse(req.body ?? {});
  await tx(async (db) => {
    const d = await chargerDevis(user, id, db, true);
    if (d.statut === statut) throw conflict(`Le devis est déjà « ${STATUT_DEVIS_LABELS[statut]} ».`);
    if (!TRANSITIONS[d.statut].includes(statut)) {
      const possibles = TRANSITIONS[d.statut].map((s) => `« ${STATUT_DEVIS_LABELS[s]} »`).join(' ou ');
      throw conflict(
        `Un devis « ${STATUT_DEVIS_LABELS[d.statut]} » ne peut pas passer à « ${STATUT_DEVIS_LABELS[statut]} »${possibles ? ` : il peut seulement passer à ${possibles}` : ''}.`,
      );
    }
    await query(`UPDATE devis SET statut = $2 WHERE id = $1`, [id, statut], db);
  });
  res.json(presenter(user, await chargerDevis(user, id)));
});

const conversionSchema = z.object({
  urgent: z.boolean().optional(),
  date_promise: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date promise invalide (AAAA-MM-JJ)').nullable().optional(),
  consignes: texteOpt(2000, 'Consignes'),
  adresse_livraison: texteOpt(500, 'Adresse de livraison'),
  mode_paiement_prevu: z.enum(MODES_PAIEMENT).nullable().optional(),
});

devisRouter.post('/:id/convertir', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const extras = conversionSchema.parse(req.body ?? {});
  let dossierCree: { id: number; numero: string } | null = null;
  try {
    await tx(async (db) => {
      const d = await chargerDevis(user, id, db, true);
      if (d.statut === 'converti' || d.dossier_id) {
        throw conflict(`Ce devis a déjà été converti en dossier${d.dossier_numero ? ` ${d.dossier_numero}` : ''}.`, { dossier_id: d.dossier_id });
      }
      if (!CONVERTIBLES.includes(d.statut)) {
        throw conflict(
          d.statut === 'brouillon'
            ? "Ce devis est encore un brouillon : passez-le à « Envoyé » ou « Accepté » avant de le convertir en dossier."
            : 'Ce devis a été refusé : repassez-le à « Envoyé » si le client l’accepte finalement, puis convertissez-le.',
        );
      }
      // Le dossier est créé par le service des dossiers (sa propre transaction) ; le verrou posé
      // sur le devis empêche une seconde conversion simultanée.
      const dossier = await creerDossier(
        user,
        {
          machine: d.machine,
          client_id: d.client_id,
          client_nom: d.client_nom,
          client_telephone: d.client_telephone,
          client_email: d.client_email,
          description: d.description,
          specs: d.specs,
          montant: d.total_ttc,
          urgent: extras.urgent ?? false,
          date_promise: extras.date_promise ?? null,
          consignes: extras.consignes ?? null,
          adresse_livraison: extras.adresse_livraison ?? null,
          mode_paiement_prevu: extras.mode_paiement_prevu ?? null,
        },
        { devis_id: d.id, montant_source: 'devis' },
      );
      dossierCree = { id: dossier.id, numero: dossier.numero };
      // Le détail du dossier reprend celui du devis (prix convenus), pas la grille du jour.
      await query(`UPDATE dossiers SET detail_prix = $2 WHERE id = $1`, [dossier.id, d.detail_prix === null ? null : JSON.stringify(d.detail_prix)], db);
      await query(`UPDATE devis SET statut = 'converti', dossier_id = $2, client_id = coalesce(client_id, $3) WHERE id = $1`, [d.id, dossier.id, dossier.client_id], db);
      await evenement(db, dossier.id, user.id, { type: 'modification', action: 'devis_converti', data: { devis_id: d.id, devis_numero: d.numero } });
    });
  } catch (err) {
    // Compensation : si la conversion échoue après la création du dossier, le dossier part à la corbeille.
    const cree = dossierCree as { id: number; numero: string } | null;
    if (cree) {
      await query(`UPDATE dossiers SET deleted_at = now(), deleted_by = $2, devis_id = NULL WHERE id = $1`, [cree.id, user.id]).catch(() => {});
    }
    throw err;
  }
  const cree = dossierCree as { id: number; numero: string } | null;
  res.status(201).json({ dossier_id: cree!.id, numero: cree!.numero });
});

devisRouter.get('/:id/pdf', async (req, res) => {
  const user = me(req);
  const d = await chargerDevis(user, intParam(req));
  const params = await getParametres();
  const pdf = await pdfDevis(
    {
      numero: d.numero,
      statut: d.statut,
      machine: d.machine,
      client_nom: d.client_nom,
      client_telephone: d.client_telephone,
      client_email: d.client_email,
      description: d.description,
      notes: d.notes,
      validite_jours: d.validite_jours,
      created_at: d.created_at,
      total_ht: d.total_ht,
      tva: d.tva,
      total_ttc: d.total_ttc,
      detail_prix: d.detail_prix,
      lignes: lignesProduits(d.machine, d.specs, d.detail_prix),
      auteur_nom: d.created_by_nom,
    },
    params,
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDisposition(req.query.telecharger === '1' ? 'attachment' : 'inline', `Devis ${d.numero}.pdf`));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

devisRouter.delete('/:id', async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  await tx(async (db) => {
    const d = await chargerDevis(user, id, db, true);
    if (d.statut !== 'brouillon') {
      throw conflict(`Seul un brouillon peut être supprimé ; ce devis est « ${STATUT_DEVIS_LABELS[d.statut]} ». Passez-le à « Refusé » s'il n'est plus d'actualité.`);
    }
    await query(`DELETE FROM devis WHERE id = $1`, [id], db);
  });
  res.status(204).end();
});
