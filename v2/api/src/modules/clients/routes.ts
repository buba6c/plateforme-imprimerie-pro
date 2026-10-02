// Clients : annuaire avec totaux, autocomplétion, fiche, création, modification, fusion.
//
// Totaux d'un client (dossiers supprimés exclus) :
//   nb_dossiers      = nombre de dossiers
//   total_commandes  = Σ montant des dossiers (montant inconnu compté 0)
//   total_paye       = Σ paiements validés de ces dossiers
//   reste_du         = Σ max(0, montant − paiements validés) par dossier (un trop-perçu
//                      sur un dossier ne compense pas la dette d'un autre)

import { Router } from 'express';
import { z } from 'zod';
import { telephoneSchema } from '@evocom/shared';
import { one, query, tx, type Db } from '../../db/pool';
import { requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { intParam, qStr } from '../../lib/http';
import { Conditions, motifLike, pagination } from '../commun/requete';

export const clientsRouter = Router();
clientsRouter.use(requireAuth, requireRole('admin', 'preparateur'));

/** Agrégats par client, en sous-requête latérale (alias `c` pour le client). */
const TOTAUX_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nb_dossiers,
           coalesce(sum(d.montant), 0)::bigint AS total_commandes,
           coalesce(sum(coalesce(pv.paye, 0)), 0)::bigint AS total_paye,
           coalesce(sum(greatest(0, coalesce(d.montant, 0) - coalesce(pv.paye, 0))), 0)::bigint AS reste_du,
           max(d.created_at) AS dernier_dossier_at
    FROM dossiers d
    LEFT JOIN LATERAL (
      SELECT sum(p.montant) AS paye FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide'
    ) pv ON true
    WHERE d.client_id = c.id AND d.deleted_at IS NULL
  ) t ON true`;

const texteOpt = (max: number, libelle: string) =>
  z
    .string({ invalid_type_error: `${libelle} : texte attendu` })
    .trim()
    .max(max, `${libelle} : ${max} caractères au maximum`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const clientSchema = z.object({
  nom: z
    .string({ required_error: 'Indiquez le nom du client', invalid_type_error: 'Nom : texte attendu' })
    .trim()
    .min(1, 'Indiquez le nom du client')
    .max(200, 'Nom : 200 caractères au maximum'),
  telephone: telephoneSchema,
  email: z
    .string()
    .trim()
    .max(200, 'E-mail : 200 caractères au maximum')
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Adresse e-mail invalide')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  adresse: texteOpt(500, 'Adresse'),
  notes: texteOpt(2000, 'Notes'),
});

const CHAMPS = ['nom', 'telephone', 'email', 'adresse', 'notes'] as const;

clientsRouter.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req, 50, 200);
  const c = new Conditions().add('c.fusionne_dans IS NULL');
  const q = qStr(req, 'q');
  if (q) {
    const chiffres = q.replace(/\D/g, '');
    if (chiffres.length >= 3) {
      c.add(
        `(lower(c.nom) LIKE ? OR lower(coalesce(c.email,'')) LIKE ? OR regexp_replace(coalesce(c.telephone,''), '\\D', '', 'g') LIKE ?)`,
        motifLike(q),
        motifLike(q),
        `%${chiffres}%`,
      );
    } else {
      c.add(`(lower(c.nom) LIKE ? OR lower(coalesce(c.email,'')) LIKE ?)`, motifLike(q), motifLike(q));
    }
  }
  const total = await one<{ n: number }>(`SELECT count(*)::int AS n FROM clients c ${c.where}`, c.args);
  const items = await query(
    `SELECT c.id, c.nom, c.telephone, c.email, c.adresse,
            coalesce(t.nb_dossiers, 0) AS nb_dossiers, coalesce(t.total_commandes, 0) AS total_commandes,
            coalesce(t.total_paye, 0) AS total_paye, coalesce(t.reste_du, 0) AS reste_du, t.dernier_dossier_at
     FROM clients c ${TOTAUX_LATERAL}
     ${c.where}
     ORDER BY t.dernier_dossier_at DESC NULLS LAST, lower(c.nom), c.id
     LIMIT ${limit} OFFSET ${offset}`,
    c.args,
  );
  res.json({ items, total: total?.n ?? 0, page, limit });
});

/** Autocomplétion : 10 clients actifs au plus, les noms qui commencent par la saisie d'abord. */
clientsRouter.get('/recherche', async (req, res) => {
  const q = (qStr(req, 'q') ?? '').slice(0, 100);
  if (!q) return void res.json([]);
  const c = new Conditions().add('c.fusionne_dans IS NULL');
  const qLower = c.param(q.toLowerCase());
  const like = c.param(motifLike(q));
  const debut = c.param(`${q.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  const chiffres = q.replace(/\D/g, '');
  const parTelephone = chiffres.length >= 3 ? ` OR regexp_replace(coalesce(c.telephone,''), '\\D', '', 'g') LIKE ${c.param(`%${chiffres}%`)}` : '';
  c.parts.push(`(lower(c.nom) LIKE ${like} OR lower(c.nom) % ${qLower}${parTelephone})`);
  const rows = await query(
    `SELECT c.id, c.nom, c.telephone, c.email
     FROM clients c ${c.where}
     ORDER BY (lower(c.nom) LIKE ${debut}) DESC, similarity(lower(c.nom), ${qLower}) DESC, lower(c.nom), c.id
     LIMIT 10`,
    c.args,
  );
  res.json(rows);
});

async function detailClient(id: number, db?: Db) {
  const client = await one(
    `SELECT c.*, cf.nom AS fusionne_dans_nom FROM clients c LEFT JOIN clients cf ON cf.id = c.fusionne_dans WHERE c.id = $1`,
    [id],
    db,
  );
  if (!client) throw notFound("Ce client n'existe pas.");
  const totaux = await one(
    `SELECT coalesce(t.nb_dossiers, 0) AS nb_dossiers, coalesce(t.total_commandes, 0) AS total_commandes,
            coalesce(t.total_paye, 0) AS total_paye, coalesce(t.reste_du, 0) AS reste_du, t.dernier_dossier_at
     FROM clients c ${TOTAUX_LATERAL} WHERE c.id = $1`,
    [id],
    db,
  );
  const dossiers = await query(
    `SELECT d.id, d.numero, d.machine, d.statut, d.client_nom, d.description, d.montant, d.urgent, d.date_promise, d.created_at, d.livre_at,
            coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide'), 0)::bigint AS deja_paye
     FROM dossiers d WHERE d.client_id = $1 AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC, d.id DESC LIMIT 20`,
    [id],
    db,
  );
  return {
    ...client,
    dossiers,
    totaux: {
      nb_dossiers: totaux?.nb_dossiers ?? 0,
      total_commandes: totaux?.total_commandes ?? 0,
      total_paye: totaux?.total_paye ?? 0,
      reste_du: totaux?.reste_du ?? 0,
    },
  };
}

clientsRouter.get('/:id', async (req, res) => {
  res.json(await detailClient(intParam(req)));
});

async function verifierDoublon(nom: string, telephone: string | null, saufId?: number) {
  const doublon = await one<{ id: number }>(
    `SELECT id FROM clients
     WHERE fusionne_dans IS NULL AND lower(trim(nom)) = lower(trim($1)) AND telephone IS NOT DISTINCT FROM $2
       AND ($3::int IS NULL OR id <> $3)
     LIMIT 1`,
    [nom, telephone, saufId ?? null],
  );
  if (doublon) {
    throw conflict(
      `Un client « ${nom} »${telephone ? ` avec le numéro ${telephone}` : ' sans téléphone'} existe déjà (fiche n° ${doublon.id}). Choisissez-le dans la liste ou précisez le nom.`,
      { client_id: doublon.id },
    );
  }
}

clientsRouter.post('/', async (req, res) => {
  const input = clientSchema.parse(req.body ?? {});
  await verifierDoublon(input.nom, input.telephone ?? null);
  const c = await one<{ id: number }>(
    `INSERT INTO clients (nom, telephone, email, adresse, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [input.nom, input.telephone ?? null, input.email ?? null, input.adresse ?? null, input.notes ?? null],
  );
  res.status(201).json(await detailClient(c!.id));
});

clientsRouter.patch('/:id', async (req, res) => {
  const id = intParam(req);
  const input = clientSchema.partial().parse(req.body ?? {});
  const avant = await one(`SELECT * FROM clients WHERE id = $1`, [id]);
  if (!avant) throw notFound("Ce client n'existe pas.");
  if (avant.fusionne_dans) {
    throw conflict(`Ce client a été fusionné dans la fiche n° ${avant.fusionne_dans} : modifiez plutôt cette fiche.`, {
      fusionne_dans: avant.fusionne_dans,
    });
  }
  const sets: string[] = [];
  const args: unknown[] = [];
  const changements: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const k of CHAMPS) {
    if (input[k] === undefined) continue;
    const v = input[k] ?? null;
    if (v === avant[k]) continue;
    args.push(v);
    sets.push(`${k} = $${args.length}`);
    changements[k] = { avant: avant[k], apres: v };
  }
  if (sets.length) {
    if (changements.nom || changements.telephone) {
      await verifierDoublon(input.nom ?? avant.nom, input.telephone !== undefined ? (input.telephone ?? null) : avant.telephone, id);
    }
    args.push(id);
    await query(`UPDATE clients SET ${sets.join(', ')} WHERE id = $${args.length}`, args);
    await journal(req, 'client_modifie', 'client', id, changements);
  }
  res.json(await detailClient(id));
});

/**
 * Fusion de deux fiches du même client : tout ce qui pointe vers la source (dossiers, devis,
 * factures, anciennes fiches déjà fusionnées) est rattaché à la destination ; la source
 * reste en base, marquée `fusionne_dans`, et n'apparaît plus dans les listes.
 */
clientsRouter.post('/:id/fusionner', requireRole('admin'), async (req, res) => {
  const id = intParam(req);
  const { dans_id } = z
    .object({
      dans_id: z
        .number({ required_error: 'Indiquez la fiche de destination (dans_id)', invalid_type_error: 'Fiche de destination invalide' })
        .int()
        .positive('Fiche de destination invalide'),
    })
    .parse(req.body ?? {});
  if (dans_id === id) throw badRequest('Choisissez une autre fiche : un client ne peut pas être fusionné avec lui-même.');

  const resultat = await tx(async (db) => {
    // Verrouillage dans un ordre fixe pour éviter les interblocages.
    const rows = await query<{ id: number; nom: string; fusionne_dans: number | null; telephone: string | null; email: string | null; adresse: string | null; notes: string | null }>(
      `SELECT id, nom, fusionne_dans, telephone, email, adresse, notes FROM clients WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [[id, dans_id]],
      db,
    );
    const source = rows.find((r) => r.id === id);
    const cible = rows.find((r) => r.id === dans_id);
    if (!source) throw notFound("Le client à fusionner n'existe pas.");
    if (!cible) throw notFound("La fiche de destination n'existe pas.");
    if (source.fusionne_dans) throw conflict(`Ce client a déjà été fusionné dans la fiche n° ${source.fusionne_dans}.`);
    if (cible.fusionne_dans) {
      throw conflict(`La fiche de destination a elle-même été fusionnée dans la fiche n° ${cible.fusionne_dans} : choisissez celle-ci.`);
    }
    const dossiers = await query(`UPDATE dossiers SET client_id = $2 WHERE client_id = $1 RETURNING id`, [id, dans_id], db);
    const devis = await query(`UPDATE devis SET client_id = $2 WHERE client_id = $1 RETURNING id`, [id, dans_id], db);
    const factures = await query(`UPDATE factures SET client_id = $2 WHERE client_id = $1 RETURNING id`, [id, dans_id], db);
    await query(`UPDATE clients SET fusionne_dans = $2 WHERE fusionne_dans = $1`, [id, dans_id], db);
    // Les coordonnées manquantes de la destination sont complétées par celles de la source.
    await query(
      `UPDATE clients SET telephone = coalesce(telephone, $2), email = coalesce(email, $3), adresse = coalesce(adresse, $4),
         notes = CASE WHEN $5::text IS NULL THEN notes WHEN notes IS NULL THEN $5 ELSE notes || E'\\n' || $5 END
       WHERE id = $1`,
      [dans_id, source.telephone, source.email, source.adresse, source.notes],
      db,
    );
    await query(`UPDATE clients SET fusionne_dans = $2 WHERE id = $1`, [id, dans_id], db);
    const data = {
      source: { id, nom: source.nom },
      destination: { id: dans_id, nom: cible.nom },
      dossiers: dossiers.length,
      devis: devis.length,
      factures: factures.length,
    };
    await journal(req, 'client_fusionne', 'client', id, data, db);
    return data;
  });
  res.json({ ...(await detailClient(dans_id)), fusion: resultat });
});
