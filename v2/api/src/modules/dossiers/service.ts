import type pg from 'pg';
import {
  ACTIONS_BY_ID,
  actionsDisponibles,
  calculerPrix,
  formatFCFA,
  dossierCreateSchema,
  dossierUpdateSchema,
  isStatut,
  machineOfRole,
  resumeLigne,
  situationPaiement,
  specsSchemaFor,
  STATUT_LABELS,
  STATUTS_MODIFIABLES,
  verifierAction,
  type ActionId,
  type ActionInput,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Specs,
  type Statut,
} from '@evocom/shared';
import { getPool, one, query, tx, type Db } from '../../db/pool';
import { journal } from '../../lib/audit';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { prochainNumero } from '../../lib/numbering';
import { getParametres } from '../../lib/params';
import { getTarifs } from '../../lib/tarifs';
import { notifier, signalDossier, signalPaiement } from '../../realtime';
import type { AuthUser } from '../../types';
import { peutVoirContactClient, peutVoirFichiers, peutVoirMontants, visibilite } from './access';

// ---------------------------------------------------------------------------
// Lecture

const SELECT_DOSSIER = `
  SELECT d.*,
    (SELECT count(*)::int FROM fichiers f WHERE f.dossier_id = d.id AND f.deleted_at IS NULL) AS nb_fichiers,
    (SELECT coalesce(sum(p.montant),0)::int FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide') AS deja_paye,
    (SELECT coalesce(sum(p.montant),0)::int FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'a_valider') AS en_attente_validation,
    prep.nom AS preparateur_nom, imp.nom AS imprimeur_nom, liv.nom AS livreur_nom
  FROM dossiers d
  LEFT JOIN users prep ON prep.id = d.preparateur_id
  LEFT JOIN users imp ON imp.id = d.imprimeur_id
  LEFT JOIN users liv ON liv.id = d.livreur_id`;

export type DossierRow = Record<string, any> & {
  id: number;
  numero: string;
  statut: Statut;
  machine: Machine;
  preparateur_id: number | null;
  nb_fichiers: number;
  montant: number | null;
  deja_paye: number;
  en_attente_validation: number;
  deleted_at: string | null;
  client_nom: string;
};

export type Libelles = Map<string, string>;

/** Libellés des tarifs (sans les prix), pour décrire les spécifications à tous les rôles. */
export async function libellesTarifs(db?: Db): Promise<Libelles> {
  const tarifs = await getTarifs(db);
  return new Map(tarifs.map((t) => [`${t.machine}:${t.code}`, t.libelle]));
}

/** Résumé lisible des spécifications : « Bâche standard · 300 × 200 cm · 1 ex. · +1 ligne ». */
export function resumeSpecs(machine: Machine, specs: any, description: string | null, libelles: Libelles): string {
  const lignes = (specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  if (!lignes.length) return description ?? '';
  const first = lignes[0]!;
  const lib = libelles.get(`${machine}:${first.support}`) ?? libelles.get(`global:${first.support}`) ?? first.support;
  const base = resumeLigne(machine, first, lib);
  return lignes.length > 1 ? `${base} · +${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : base;
}

/** Mise en forme pour l'API : retire ce que le rôle ne doit pas voir. */
export function presenter(row: DossierRow, user: AuthUser, libelles: Libelles = new Map()) {
  const montants = peutVoirMontants(user);
  const contact = peutVoirContactClient(user);
  const out: Record<string, unknown> = {
    id: row.id,
    public_id: row.public_id,
    numero: row.numero,
    machine: row.machine,
    statut: row.statut,
    statut_label: STATUT_LABELS[row.statut],
    client_id: row.client_id,
    client_nom: row.client_nom,
    description: row.description,
    consignes: row.consignes,
    specs: row.specs,
    resume_specs: resumeSpecs(row.machine, row.specs, row.description, libelles),
    urgent: row.urgent,
    date_promise: row.date_promise,
    preparateur_id: row.preparateur_id,
    preparateur_nom: row.preparateur_nom,
    imprimeur_id: row.imprimeur_id,
    imprimeur_nom: row.imprimeur_nom,
    livreur_id: row.livreur_id,
    livreur_nom: row.livreur_nom,
    commentaire_revision: row.commentaire_revision,
    date_validation: row.date_validation,
    date_debut_impression: row.date_debut_impression,
    date_fin_impression: row.date_fin_impression,
    livraison_prevue_at: row.livraison_prevue_at,
    livre_at: row.livre_at,
    termine_at: row.termine_at,
    nb_fichiers: row.nb_fichiers,
    devis_id: row.devis_id,
    importe: row.legacy_id !== null && row.legacy_id !== undefined,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (contact) {
    out.client_telephone = row.client_telephone;
    out.client_email = row.client_email;
    out.adresse_livraison = row.adresse_livraison;
    out.notes_livraison = row.notes_livraison;
  }
  if (montants) {
    const solde = row.montant === null ? null : Math.max(0, row.montant - row.deja_paye);
    out.montant = row.montant;
    out.montant_source = row.montant_source;
    out.mode_paiement_prevu = row.mode_paiement_prevu;
    out.deja_paye = row.deja_paye;
    out.en_attente_validation = row.en_attente_validation;
    out.solde = solde;
    out.situation_paiement = situationPaiement(row.montant, row.deja_paye);
    if (user.role !== 'livreur') out.detail_prix = row.detail_prix;
  }
  return out;
}

export interface ListeFiltres {
  statut?: string[];
  machine?: Machine;
  q?: string;
  urgent?: boolean;
  mine?: boolean;
  file?: 'travail' | 'historique';
  client_id?: number;
  page?: number;
  limit?: number;
  tri?: 'recent' | 'priorite' | 'ancien';
}

export async function listerDossiers(user: AuthUser, f: ListeFiltres) {
  const params = await getParametres();
  const vis = visibilite(user, 0, params.livreur_jours_historique);
  const where: string[] = [vis.sql];
  const args: unknown[] = [...vis.params];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    where.push(sql.replace('?', `$${args.length}`));
  };
  if (f.machine) add('d.machine = ?', f.machine);
  if (f.urgent) where.push('d.urgent');
  if (f.mine) add('(d.preparateur_id = ? )', user.id);
  if (f.client_id) add('d.client_id = ?', f.client_id);
  if (f.q && f.q.trim()) {
    add(`lower(d.client_nom || ' ' || d.numero || ' ' || coalesce(d.description,'')) LIKE ?`, `%${f.q.trim().toLowerCase()}%`);
  }
  if (f.file === 'travail' && machineOfRole(user.role)) {
    where.push(`(d.statut IN ('pret_impression','en_impression') OR (d.statut IN ('pret_livraison','a_revoir') AND d.updated_at > now() - interval '2 days'))`);
  }
  // Compteurs par statut, avant le filtre de statut, pour les onglets.
  const counts = await query<{ statut: Statut; n: number }>(
    `SELECT d.statut, count(*)::int AS n FROM dossiers d WHERE ${where.join(' AND ')} GROUP BY d.statut`,
    args,
  );
  if (f.statut?.length) add('d.statut = ANY(?)', f.statut.filter(isStatut));

  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const order =
    f.tri === 'ancien'
      ? 'd.created_at ASC'
      : f.tri === 'recent'
        ? 'd.created_at DESC'
        : `d.urgent DESC, d.date_promise ASC NULLS LAST, d.created_at ASC`;
  const totalRow = await one<{ n: number }>(`SELECT count(*)::int AS n FROM dossiers d WHERE ${where.join(' AND ')}`, args);
  const rows = await query<DossierRow>(
    `${SELECT_DOSSIER} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    args,
  );
  const libelles = await libellesTarifs();
  return {
    items: rows.map((r) => ({ ...presenter(r, user, libelles), actions: actionsDisponibles(user, r).map((a) => a.id) })),
    total: totalRow?.n ?? 0,
    page,
    limit,
    compteurs: Object.fromEntries(counts.map((c) => [c.statut, c.n])),
  };
}

/** Charge un dossier visible par l'utilisateur, ou lève 404. */
export async function chargerDossier(user: AuthUser, id: number, db: Db = getPool(), forUpdate = false): Promise<DossierRow> {
  const params = await getParametres(db);
  const vis = visibilite(user, 1, params.livreur_jours_historique);
  const row = await one<DossierRow>(
    forUpdate
      ? `SELECT d.*,
           (SELECT count(*)::int FROM fichiers f WHERE f.dossier_id = d.id AND f.deleted_at IS NULL) AS nb_fichiers,
           (SELECT coalesce(sum(p.montant),0)::int FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide') AS deja_paye,
           (SELECT coalesce(sum(p.montant),0)::int FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'a_valider') AS en_attente_validation
         FROM dossiers d WHERE d.id = $1 AND ${vis.sql} FOR UPDATE OF d`
      : `${SELECT_DOSSIER} WHERE d.id = $1 AND ${vis.sql}`,
    [id, ...vis.params],
    db,
  );
  if (!row) throw notFound("Ce dossier n'existe pas ou ne vous est pas accessible.");
  return row;
}

export async function detailDossier(user: AuthUser, id: number) {
  const row = await chargerDossier(user, id);
  const fichiers = peutVoirFichiers(user)
    ? await query(
        `SELECT f.id, f.nom_original, f.mime, f.taille, f.a_reimprimer, f.created_at, u.nom AS uploaded_by_nom
         FROM fichiers f LEFT JOIN users u ON u.id = f.uploaded_by
         WHERE f.dossier_id = $1 AND f.deleted_at IS NULL ORDER BY f.created_at`,
        [id],
      )
    : [];
  const events = await query(
    `SELECT e.id, e.type, e.action, e.de_statut, e.vers_statut, e.commentaire, e.created_at, e.user_id, u.nom AS user_nom, u.role AS user_role,
            CASE WHEN $2 OR e.type NOT IN ('modification','paiement') OR (e.type = 'paiement' AND $3) THEN e.data ELSE NULL END AS data
     FROM dossier_events e LEFT JOIN users u ON u.id = e.user_id
     WHERE e.dossier_id = $1 AND ($2 OR e.type <> 'modification') AND ($3 OR e.type <> 'paiement')
     ORDER BY e.created_at DESC, e.id DESC LIMIT 200`,
    [id, user.role === 'admin', peutVoirMontants(user)],
  );
  const paiements = peutVoirMontants(user)
    ? await query(
        `SELECT p.id, p.montant, p.mode, p.reference, p.statut, p.notes, p.encaisse_at, p.valide_at, p.motif_refus,
                ue.nom AS encaisse_par_nom, uv.nom AS valide_par_nom
         FROM paiements p LEFT JOIN users ue ON ue.id = p.encaisse_par LEFT JOIN users uv ON uv.id = p.valide_par
         WHERE p.dossier_id = $1 ORDER BY p.encaisse_at DESC`,
        [id],
      )
    : [];
  const facture =
    user.role === 'admin' || user.role === 'preparateur'
      ? await one(`SELECT id, numero, total_ttc, date_emission FROM factures WHERE dossier_id = $1 AND statut = 'emise'`, [id])
      : null;
  return {
    ...presenter(row, user, await libellesTarifs()),
    actions: actionsDisponibles(user, row).map((a) => a.id),
    peut_modifier: peutModifier(user, row),
    peut_supprimer: peutSupprimer(user, row),
    peut_deposer_fichiers: peutDeposer(user, row),
    fichiers,
    historique: events,
    paiements,
    facture,
  };
}

// ---------------------------------------------------------------------------
// Règles d'écriture

export function peutModifier(user: AuthUser, d: Pick<DossierRow, 'statut' | 'preparateur_id' | 'deleted_at'>): boolean {
  if (d.deleted_at) return false;
  if (user.role === 'admin') return true;
  return user.role === 'preparateur' && d.preparateur_id === user.id && STATUTS_MODIFIABLES.includes(d.statut);
}

export function peutDeposer(user: AuthUser, d: Pick<DossierRow, 'statut' | 'preparateur_id' | 'deleted_at'>): boolean {
  return peutModifier(user, d);
}

export function peutSupprimer(user: AuthUser, d: Pick<DossierRow, 'statut' | 'preparateur_id' | 'deleted_at' | 'deja_paye' | 'en_attente_validation'>): boolean {
  if (d.deleted_at) return false;
  if (user.role === 'admin') return true;
  return (
    user.role === 'preparateur' &&
    d.preparateur_id === user.id &&
    d.statut === 'en_cours' &&
    d.deja_paye === 0 &&
    d.en_attente_validation === 0
  );
}

// ---------------------------------------------------------------------------
// Création et modification

async function prixPour(machine: Machine, specs: Specs, db: Db) {
  if (!specs.lignes?.length) return null;
  const [tarifs, params] = await Promise.all([getTarifs(db), getParametres(db)]);
  return calculerPrix(machine, specs, tarifs, params.prix);
}

async function trouverOuCreerClient(db: Db, input: { client_id?: number | null; client_nom: string; client_telephone?: string | null; client_email?: string | null }): Promise<number> {
  if (input.client_id) {
    const c = await one<{ id: number; fusionne_dans: number | null }>('SELECT id, fusionne_dans FROM clients WHERE id = $1', [input.client_id], db);
    if (!c) throw badRequest('Client introuvable.');
    return c.fusionne_dans ?? c.id;
  }
  const existing = await one<{ id: number }>(
    `SELECT id FROM clients WHERE fusionne_dans IS NULL AND lower(trim(nom)) = lower(trim($1))
     ORDER BY (telephone IS NOT DISTINCT FROM $2) DESC, id LIMIT 1`,
    [input.client_nom, input.client_telephone ?? null],
    db,
  );
  if (existing) {
    if (input.client_telephone || input.client_email) {
      await query(
        `UPDATE clients SET telephone = coalesce(telephone, $2), email = coalesce(email, $3) WHERE id = $1`,
        [existing.id, input.client_telephone ?? null, input.client_email ?? null],
        db,
      );
    }
    return existing.id;
  }
  const created = await one<{ id: number }>(
    `INSERT INTO clients (nom, telephone, email) VALUES ($1, $2, $3) RETURNING id`,
    [input.client_nom.trim(), input.client_telephone ?? null, input.client_email ?? null],
    db,
  );
  return created!.id;
}

export async function evenement(
  db: Db,
  dossierId: number,
  userId: number | null,
  e: { type: string; action?: string | null; de?: string | null; vers?: string | null; commentaire?: string | null; data?: unknown },
) {
  await query(
    `INSERT INTO dossier_events (dossier_id, user_id, type, action, de_statut, vers_statut, commentaire, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [dossierId, userId, e.type, e.action ?? null, e.de ?? null, e.vers ?? null, e.commentaire ?? null, e.data === undefined ? null : JSON.stringify(e.data)],
    db,
  );
}

export async function creerDossier(user: AuthUser, body: unknown, opts: { devis_id?: number | null; montant_source?: string } = {}) {
  if (user.role !== 'admin' && user.role !== 'preparateur') throw forbidden('Seuls les préparateurs et les administrateurs créent des dossiers.');
  const input = dossierCreateSchema.parse(body);
  const specs = specsSchemaFor(input.machine).parse(input.specs ?? { lignes: [], forfaits: [] }) as Specs;
  const created = await tx(async (db) => {
    const prix = await prixPour(input.machine, specs, db);
    if (prix && !prix.ok && (input.montant === null || input.montant === undefined)) {
      throw unprocessable('Le prix ne peut pas être calculé. Corrigez les lignes ou saisissez le montant à la main.', { erreurs: prix.erreurs });
    }
    let montant: number | null = null;
    let source: string | null = null;
    if (input.montant !== null && input.montant !== undefined) {
      montant = input.montant;
      source = opts.montant_source ?? 'saisi';
    } else if (prix?.ok) {
      montant = prix.total_ttc;
      source = 'calcul';
    }
    const clientId = await trouverOuCreerClient(db, input);
    const numero = await prochainNumero(db, 'CMD');
    const d = await one<DossierRow>(
      `INSERT INTO dossiers (numero, machine, client_id, client_nom, client_telephone, client_email, description, consignes, specs,
         montant, montant_source, detail_prix, mode_paiement_prevu, urgent, date_promise, adresse_livraison, preparateur_id, devis_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        numero,
        input.machine,
        clientId,
        input.client_nom,
        input.client_telephone ?? null,
        input.client_email ?? null,
        input.description ?? null,
        input.consignes ?? null,
        JSON.stringify(specs),
        montant,
        source,
        prix?.ok ? JSON.stringify(prix) : null,
        input.mode_paiement_prevu ?? null,
        input.urgent,
        input.date_promise ?? null,
        input.adresse_livraison ?? null,
        user.id,
        opts.devis_id ?? null,
      ],
      db,
    );
    await evenement(db, d!.id, user.id, { type: 'creation', vers: 'en_cours' });
    return d!;
  });
  signalDossier({ ...created, ancien_statut: null }, 'created');
  return created;
}

const CHAMPS_SUIVIS = [
  'client_nom',
  'client_telephone',
  'client_email',
  'description',
  'consignes',
  'montant',
  'mode_paiement_prevu',
  'urgent',
  'date_promise',
  'adresse_livraison',
  'machine',
] as const;

export async function modifierDossier(user: AuthUser, id: number, body: unknown) {
  const input = dossierUpdateSchema.parse(body);
  const updated = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    if (!peutModifier(user, d)) {
      throw forbidden(
        user.role === 'preparateur' && d.preparateur_id === user.id
          ? 'Le dossier est validé : demandez à un administrateur de le renvoyer en préparation pour le modifier.'
          : "Vous ne pouvez pas modifier ce dossier.",
      );
    }
    const machine = (input.machine ?? d.machine) as Machine;
    if (input.machine && input.machine !== d.machine && d.statut !== 'en_cours' && d.statut !== 'a_revoir') {
      throw conflict('La machine ne peut plus changer après validation.');
    }
    const sets: string[] = [];
    const args: unknown[] = [];
    const changes: Record<string, { avant: unknown; apres: unknown }> = {};
    const set = (col: string, value: unknown) => {
      args.push(value);
      sets.push(`${col} = $${args.length}`);
    };
    const montantSaisi = input.montant !== undefined && input.montant !== null;
    // montant: null envoyé explicitement = revenir au prix calculé à partir des spécifications.
    const revenirAuCalcul = input.montant === null && d.montant_source === 'saisi';
    for (const k of CHAMPS_SUIVIS) {
      if (input[k] === undefined) continue;
      if (k === 'montant' && revenirAuCalcul) continue;
      const v = input[k] ?? null;
      if (JSON.stringify(v) !== JSON.stringify(d[k] ?? null)) {
        changes[k] = { avant: d[k] ?? null, apres: v };
        set(k, v);
      }
    }
    if (montantSaisi) set('montant_source', 'saisi');
    if (revenirAuCalcul) {
      const specsActuelles = specsSchemaFor(machine).parse(input.specs ?? d.specs) as Specs;
      const prix = await prixPour(machine, specsActuelles, db);
      if (!prix?.ok) throw unprocessable('Le prix ne peut pas être recalculé : corrigez les lignes ou gardez le montant saisi.', { erreurs: prix && !prix.ok ? prix.erreurs : [] });
      if (prix.total_ttc !== d.montant) changes.montant = { avant: d.montant, apres: prix.total_ttc };
      set('montant', prix.total_ttc);
      set('montant_source', 'calcul');
      set('detail_prix', JSON.stringify(prix));
    }
    if (input.specs !== undefined || input.machine) {
      const specs = specsSchemaFor(machine).parse(input.specs ?? d.specs) as Specs;
      if (JSON.stringify(specs) !== JSON.stringify(d.specs)) changes.specs = { avant: d.specs, apres: specs };
      set('specs', JSON.stringify(specs));
      const prix = await prixPour(machine, specs, db);
      if (prix?.ok) {
        set('detail_prix', JSON.stringify(prix));
        if (!montantSaisi && !revenirAuCalcul && d.montant_source !== 'saisi') {
          if (prix.total_ttc !== d.montant) changes.montant = { avant: d.montant, apres: prix.total_ttc };
          set('montant', prix.total_ttc);
          set('montant_source', 'calcul');
        }
      } else if (prix && !prix.ok && !montantSaisi && !revenirAuCalcul && d.montant_source !== 'saisi') {
        throw unprocessable('Le prix ne peut pas être calculé. Corrigez les lignes ou saisissez le montant à la main.', { erreurs: prix.erreurs });
      }
    }
    if (input.client_nom !== undefined || input.client_id !== undefined) {
      const clientId = await trouverOuCreerClient(db, {
        client_id: input.client_id ?? null,
        client_nom: input.client_nom ?? d.client_nom,
        client_telephone: input.client_telephone ?? d.client_telephone,
        client_email: input.client_email ?? d.client_email,
      });
      if (clientId !== d.client_id) set('client_id', clientId);
    }
    if (!sets.length) return d;
    args.push(id);
    const row = await one<DossierRow>(`UPDATE dossiers SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING *`, args, db);
    if (Object.keys(changes).length) await evenement(db, id, user.id, { type: 'modification', data: changes });
    return row!;
  });
  signalDossier({ ...updated, ancien_statut: updated.statut });
  return updated;
}

// ---------------------------------------------------------------------------
// Circuit

export async function executerAction(user: AuthUser, id: number, actionId: string, input: ActionInput) {
  const action = ACTIONS_BY_ID[actionId as ActionId];
  if (!action) throw notFound('Action inconnue.');
  const result = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    const check = verifierAction(action, user, d, { commentaire: input.commentaire ?? null });
    if (!check.ok) throw check.code === 'role' || check.code === 'proprietaire' || check.code === 'machine' ? forbidden(check.message) : conflict(check.message);

    const sets: string[] = ['statut = $1'];
    const args: unknown[] = [action.to];
    const set = (sql: string, v?: unknown) => {
      if (v === undefined) sets.push(sql);
      else {
        args.push(v);
        sets.push(sql.replace('?', `$${args.length}`));
      }
    };
    switch (action.id) {
      case 'valider':
        set('date_validation = now()');
        set('commentaire_revision = NULL');
        break;
      case 'demarrer':
        set('date_debut_impression = now()');
        if (machineOfRole(user.role)) set('imprimeur_id = ?', user.id);
        break;
      case 'marquer_imprime':
        set('date_fin_impression = now()');
        if (machineOfRole(user.role)) set('imprimeur_id = ?', user.id);
        break;
      case 'demander_revision':
        set('commentaire_revision = ?', input.commentaire);
        break;
      case 'programmer_livraison': {
        if (!input.livraison?.date_prevue) throw badRequest('Indiquez la date de livraison prévue.');
        set('livraison_prevue_at = ?', input.livraison.date_prevue);
        if (input.livraison.adresse) set('adresse_livraison = ?', input.livraison.adresse);
        if (input.livraison.notes !== undefined) set('notes_livraison = ?', input.livraison.notes);
        if (user.role === 'livreur') set('livreur_id = ?', user.id);
        break;
      }
      case 'confirmer_livraison':
        set('livre_at = now()');
        set('urgent = false');
        if (user.role === 'livreur') set('livreur_id = ?', user.id);
        break;
      case 'cloturer':
        set('termine_at = now()');
        break;
      case 'rouvrir':
        set('termine_at = NULL');
        break;
      case 'reimprimer':
        set('date_fin_impression = NULL');
        set('date_debut_impression = NULL');
        break;
      default:
        break;
    }
    args.push(id);
    const row = await one<DossierRow>(`UPDATE dossiers SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING *`, args, db);
    await evenement(db, id, user.id, {
      type: 'statut',
      action: action.id,
      de: d.statut,
      vers: action.to,
      commentaire: input.commentaire ?? null,
      data: action.id === 'programmer_livraison' ? input.livraison : undefined,
    });

    let paiementId: number | null = null;
    if (action.id === 'confirmer_livraison' && input.encaissement) {
      paiementId = await enregistrerPaiement(db, user, { ...d, deja_paye: d.deja_paye, en_attente_validation: d.en_attente_validation }, {
        montant: input.encaissement.montant,
        mode: input.encaissement.mode,
        reference: input.encaissement.reference ?? null,
        notes: 'Encaissé à la livraison',
      });
    }
    return { avant: d, apres: row!, paiementId };
  });

  const { avant, apres } = result;
  signalDossier({ ...apres, ancien_statut: avant.statut });
  if (result.paiementId) signalPaiement(apres.id);
  await notifierTransition(user, action.id, apres, input.commentaire ?? null).catch(() => {});
  return apres;
}

async function notifierTransition(user: AuthUser, action: ActionId, d: DossierRow, commentaire: string | null) {
  const db = getPool();
  const ref = `${d.numero} · ${d.client_nom}`;
  switch (action) {
    case 'valider':
      await notifier(db, { machine: d.machine }, { type: 'nouveau_travail', titre: `Nouveau dossier à imprimer`, message: ref, dossier_id: d.id });
      break;
    case 'demander_revision':
      if (d.preparateur_id)
        await notifier(db, { userIds: [d.preparateur_id], roles: ['admin'], exclure: user.id }, { type: 'revision', titre: `Révision demandée : ${d.numero}`, message: commentaire, dossier_id: d.id });
      break;
    case 'marquer_imprime':
      await notifier(db, { roles: ['livreur'], userIds: d.preparateur_id ? [d.preparateur_id] : [] }, { type: 'pret_livraison', titre: 'Dossier prêt à livrer', message: ref, dossier_id: d.id });
      break;
    case 'confirmer_livraison':
      await notifier(db, { roles: ['admin'], userIds: d.preparateur_id ? [d.preparateur_id] : [], exclure: user.id }, { type: 'livre', titre: `Dossier livré : ${d.numero}`, message: d.client_nom, dossier_id: d.id });
      break;
    default:
      break;
  }
}

export async function forcerStatut(user: AuthUser, id: number, statut: string, commentaire: string | null) {
  if (user.role !== 'admin') throw forbidden();
  if (!isStatut(statut)) throw badRequest('Statut inconnu.');
  if (!commentaire || commentaire.trim().length < 3) throw badRequest('Expliquez pourquoi vous forcez le statut.');
  const r = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    if (d.statut === statut) throw conflict('Le dossier a déjà ce statut.');
    const row = await one<DossierRow>(`UPDATE dossiers SET statut = $1 WHERE id = $2 RETURNING *`, [statut, id], db);
    await evenement(db, id, user.id, { type: 'statut', action: 'forcer', de: d.statut, vers: statut, commentaire });
    await journal(null, 'dossier_statut_force', 'dossier', id, { numero: d.numero, de: d.statut, vers: statut, commentaire, user_id: user.id }, db);
    return { avant: d, apres: row! };
  });
  signalDossier({ ...r.apres, ancien_statut: r.avant.statut });
  return r.apres;
}

export async function reporterLivraison(user: AuthUser, id: number, date: string, motif: string | null) {
  if (user.role !== 'livreur' && user.role !== 'admin') throw forbidden();
  const row = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    if (d.statut !== 'en_livraison' && d.statut !== 'pret_livraison') throw conflict("Ce dossier n'est pas en cours de livraison.");
    const r = await one<DossierRow>(`UPDATE dossiers SET livraison_prevue_at = $1 WHERE id = $2 RETURNING *`, [date, id], db);
    await evenement(db, id, user.id, { type: 'livraison', action: 'reporter', commentaire: motif, data: { avant: d.livraison_prevue_at, apres: date } });
    return r!;
  });
  signalDossier({ ...row, ancien_statut: row.statut });
  return row;
}

export async function definirUrgence(user: AuthUser, id: number, urgent: boolean) {
  const row = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    const ok = user.role === 'admin' || (user.role === 'preparateur' && d.preparateur_id === user.id);
    if (!ok) throw forbidden("Seul le préparateur du dossier ou un administrateur peut changer l'urgence.");
    if (d.urgent === urgent) return d;
    const r = await one<DossierRow>(`UPDATE dossiers SET urgent = $1 WHERE id = $2 RETURNING *`, [urgent, id], db);
    await evenement(db, id, user.id, { type: 'urgence', data: { urgent } });
    return r!;
  });
  signalDossier({ ...row, ancien_statut: row.statut });
  if (urgent && ['pret_impression', 'en_impression'].includes(row.statut)) {
    await notifier(getPool(), { machine: row.machine }, { type: 'urgent', titre: `Dossier passé en urgent`, message: `${row.numero} · ${row.client_nom}`, dossier_id: row.id }).catch(() => {});
  }
  return row;
}

export async function affecter(user: AuthUser, id: number, body: { imprimeur_id?: number | null; livreur_id?: number | null }) {
  if (user.role !== 'admin') throw forbidden();
  const row = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    const sets: string[] = [];
    const args: unknown[] = [];
    for (const k of ['imprimeur_id', 'livreur_id'] as const) {
      if (body[k] === undefined) continue;
      if (body[k] !== null) {
        const u = await one<{ role: string }>('SELECT role FROM users WHERE id = $1 AND is_active', [body[k]], db);
        const attendu = k === 'livreur_id' ? ['livreur'] : [`imprimeur_${d.machine}`];
        if (!u || !attendu.includes(u.role)) throw badRequest(k === 'livreur_id' ? 'Choisissez un livreur actif.' : `Choisissez un imprimeur ${d.machine === 'roland' ? 'Roland' : 'Xerox'} actif.`);
      }
      args.push(body[k]);
      sets.push(`${k} = $${args.length}`);
    }
    if (!sets.length) return d;
    args.push(id);
    const r = await one<DossierRow>(`UPDATE dossiers SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING *`, args, db);
    await evenement(db, id, user.id, { type: 'affectation', data: body });
    return r!;
  });
  signalDossier({ ...row, ancien_statut: row.statut });
  for (const uid of [body.imprimeur_id, body.livreur_id]) {
    if (uid) await notifier(getPool(), { userIds: [uid] }, { type: 'affectation', titre: 'Dossier qui vous est confié', message: `${row.numero} · ${row.client_nom}`, dossier_id: row.id }).catch(() => {});
  }
  return row;
}

export async function commenter(user: AuthUser, id: number, texte: string) {
  if (!texte || texte.trim().length < 2) throw badRequest('Le commentaire est vide.');
  const d = await chargerDossier(user, id);
  await evenement(getPool(), id, user.id, { type: 'commentaire', commentaire: texte.trim().slice(0, 2000) });
  signalDossier({ ...d, ancien_statut: d.statut });
}

export async function supprimerDossier(user: AuthUser, id: number, motif: string | null) {
  const row = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    if (!peutSupprimer(user, d)) {
      throw forbidden(
        user.role === 'preparateur'
          ? 'Vous ne pouvez supprimer que vos dossiers en préparation, sans paiement.'
          : 'Vous ne pouvez pas supprimer ce dossier.',
      );
    }
    await query(`UPDATE dossiers SET deleted_at = now(), deleted_by = $1 WHERE id = $2`, [user.id, id], db);
    await evenement(db, id, user.id, { type: 'suppression', commentaire: motif });
    await journal(null, 'dossier_supprime', 'dossier', id, { numero: d.numero, client: d.client_nom, motif, user_id: user.id }, db);
    return d;
  });
  signalDossier(row, 'deleted');
}

export async function restaurerDossier(user: AuthUser, id: number) {
  if (user.role !== 'admin') throw forbidden();
  const row = await tx(async (db) => {
    const d = await one<DossierRow>(`SELECT * FROM dossiers WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE`, [id], db);
    if (!d) throw notFound('Ce dossier n\'est pas dans la corbeille.');
    const r = await one<DossierRow>(`UPDATE dossiers SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 RETURNING *`, [id], db);
    await evenement(db, id, user.id, { type: 'restauration' });
    await journal(null, 'dossier_restaure', 'dossier', id, { numero: d.numero, user_id: user.id }, db);
    return r!;
  });
  signalDossier({ ...row, ancien_statut: null }, 'created');
  return row;
}

// ---------------------------------------------------------------------------
// Paiements rattachés à un dossier (utilisé aussi par le module paiements)

export async function enregistrerPaiement(
  db: pg.PoolClient | Db,
  user: AuthUser,
  d: Pick<DossierRow, 'id' | 'montant' | 'deja_paye' | 'en_attente_validation' | 'statut'>,
  p: { montant: number; mode: string; reference: string | null; notes: string | null },
): Promise<number> {
  if (!['admin', 'preparateur', 'livreur'].includes(user.role)) throw forbidden();
  if (['wave', 'orange_money', 'virement', 'cheque'].includes(p.mode) && !p.reference) {
    throw badRequest('La référence de la transaction est obligatoire pour ce mode de paiement.');
  }
  if (d.montant !== null) {
    const reste = d.montant - d.deja_paye - d.en_attente_validation;
    if (p.montant > reste) {
      throw conflict(
        reste <= 0
          ? 'Ce dossier est déjà entièrement payé (ou en attente de validation).'
          : `Le montant dépasse le reste à payer (${reste} FCFA).`,
      );
    }
  }
  const statut = user.role === 'admin' ? 'valide' : 'a_valider';
  const r = await one<{ id: number }>(
    `INSERT INTO paiements (dossier_id, montant, mode, reference, statut, notes, encaisse_par, valide_par, valide_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [d.id, p.montant, p.mode, p.reference, statut, p.notes, user.id, statut === 'valide' ? user.id : null, statut === 'valide' ? new Date() : null],
    db,
  );
  await evenement(db, d.id, user.id, {
    type: 'paiement',
    action: statut === 'valide' ? 'encaisse_valide' : 'encaisse',
    data: { paiement_id: r!.id, montant: p.montant, mode: p.mode, reference: p.reference },
  });
  if (statut === 'a_valider') {
    await notifier(db, { roles: ['admin'], exclure: user.id }, { type: 'paiement_a_valider', titre: 'Paiement à valider', message: formatFCFA(p.montant), dossier_id: d.id });
  }
  return r!.id;
}
