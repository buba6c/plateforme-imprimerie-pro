// Paiements : encaissement sur un dossier, validation ou refus par l'administrateur,
// liste filtrée par rôle et état de la caisse.
//
// Règles :
// - un administrateur qui encaisse crée un paiement validé d'office ; préparateur et livreur
//   créent un paiement « à valider » (voir enregistrerPaiement dans le module dossiers) ;
// - le total des paiements validés d'un dossier ne dépasse jamais son montant : contrôlé à
//   l'encaissement (validés + en attente) et de nouveau à la validation ;
// - un paiement validé ou refusé ne change plus d'état ;
// - un paiement d'un dossier mis à la corbeille n'est pas validé ;
// - validation groupée (sélection, 500 au plus) et validation de l'historique importé
//   (mot de passe exigé) appliquent exactement les mêmes contrôles (voir validation.ts).

import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { formatFCFA, MODE_PAIEMENT_LABELS, MODES_PAIEMENT, paiementInputSchema, STATUTS_PAIEMENT, type ModePaiement } from '@evocom/shared';
import { getPool, one, query, tx, type Db } from '../../db/pool';
import { me, requireAuth, requireRole } from '../../lib/auth';
import { journal } from '../../lib/audit';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors';
import { intParam, qInt, qList, qStr } from '../../lib/http';
import { getParametres } from '../../lib/params';
import { notifier, signalPaiement } from '../../realtime';
import { chargerDossier, enregistrerPaiement, evenement } from '../dossiers/service';
import { aujourdhui, Conditions, estDateValide, filtrePeriode, intervalle, motifLike, pagination } from '../commun/requete';
import { appliquerValidation, trier, verrouillerDossiers, verrouillerPaiements, type Refus } from './validation';

const SELECT_PAIEMENT = `
  SELECT p.id, p.dossier_id, d.numero, d.client_nom, p.montant, p.mode, p.reference, p.statut, p.notes,
         p.encaisse_par, ue.nom AS encaisse_par_nom, p.encaisse_at,
         p.valide_par, uv.nom AS valide_par_nom, p.valide_at, p.motif_refus,
         (d.deleted_at IS NOT NULL) AS dossier_supprime, (p.legacy_id IS NOT NULL) AS importe,
         d.statut AS dossier_statut, d.machine
  FROM paiements p
  JOIN dossiers d ON d.id = p.dossier_id
  LEFT JOIN users ue ON ue.id = p.encaisse_par
  LEFT JOIN users uv ON uv.id = p.valide_par`;

export async function chargerPaiement(id: number, db?: Db) {
  const p = await one(`${SELECT_PAIEMENT} WHERE p.id = $1`, [id], db);
  if (!p) throw notFound("Ce paiement n'existe pas.");
  return p;
}

// ---------------------------------------------------------------------------
// /api/paiements

export const paiementsRouter = Router();
paiementsRouter.use(requireAuth);

paiementsRouter.get('/', requireRole('admin', 'preparateur', 'livreur'), async (req, res) => {
  const user = me(req);
  const params = await getParametres();
  const { page, limit, offset } = pagination(req, 50, 200);
  const { from, to } = intervalle(req);
  const c = new Conditions();
  if (user.role !== 'admin') {
    c.add('p.encaisse_par = ?', user.id);
  } else {
    const livreurId = qInt(req, 'livreur_id') ?? qInt(req, 'encaisse_par');
    if (livreurId) c.add('p.encaisse_par = ?', livreurId);
  }
  const statuts = qList(req, 'statut');
  if (statuts?.length) {
    const inconnus = statuts.filter((s) => !(STATUTS_PAIEMENT as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Statut de paiement inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${STATUTS_PAIEMENT.join(', ')}.`);
    c.add('p.statut = ANY(?)', statuts);
  }
  const modes = qList(req, 'mode');
  if (modes?.length) {
    const inconnus = modes.filter((s) => !(MODES_PAIEMENT as readonly string[]).includes(s));
    if (inconnus.length) throw badRequest(`Mode de paiement inconnu : ${inconnus.join(', ')}. Valeurs possibles : ${MODES_PAIEMENT.join(', ')}.`);
    c.add('p.mode = ANY(?)', modes);
  }
  const dossierId = qInt(req, 'dossier_id');
  if (dossierId) c.add('p.dossier_id = ?', dossierId);
  const q = qStr(req, 'q');
  if (q) {
    if (q.length > 100) throw badRequest('La recherche est trop longue (100 caractères au maximum).');
    c.add(`(lower(d.numero) LIKE ? OR lower(d.client_nom) LIKE ? OR lower(coalesce(p.reference, '')) LIKE ?)`, motifLike(q), motifLike(q), motifLike(q));
  }
  const importe = qStr(req, 'importe');
  if (importe === '1') c.add('p.legacy_id IS NOT NULL');
  else if (importe === '0') c.add('p.legacy_id IS NULL');
  filtrePeriode(c, 'p.encaisse_at', params.fuseau, from, to);

  const agg = await one<{ n: number; somme: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(p.montant), 0)::bigint AS somme FROM paiements p JOIN dossiers d ON d.id = p.dossier_id ${c.where}`,
    c.args,
  );
  const ordre = qStr(req, 'tri') === 'ancien' ? 'p.encaisse_at ASC, p.id ASC' : 'p.encaisse_at DESC, p.id DESC';
  const items = await query(`${SELECT_PAIEMENT} ${c.where} ORDER BY ${ordre} LIMIT ${limit} OFFSET ${offset}`, c.args);
  res.json({ items, total: agg?.n ?? 0, somme: agg?.somme ?? 0, page, limit });
});

function erreurRefus(r: Refus): HttpError {
  if (r.code === 'introuvable') return notFound(r.message);
  return conflict(r.message, r.details);
}

paiementsRouter.post('/:id/valider', requireRole('admin'), async (req, res) => {
  const admin = me(req);
  const id = intParam(req);
  const r = await tx(async (db) => {
    const [p] = await verrouillerPaiements(db, [id]);
    if (!p) throw notFound("Ce paiement n'existe pas.");
    // Le dossier est verrouillé et son total validé relu ensuite : deux validations ou un
    // encaissement simultanés ne peuvent pas dépasser son montant.
    const dossiers = await verrouillerDossiers(db, [p.dossier_id]);
    const { acceptes, refuses } = trier([p], dossiers);
    if (refuses[0]) throw erreurRefus(refuses[0]);
    await appliquerValidation(db, admin.id, acceptes);
    const d = dossiers.get(p.dossier_id)!;
    await journal(req, 'paiement_valide', 'paiement', id, { dossier_id: d.id, numero: d.numero, montant: p.montant, mode: p.mode }, db);
    return { p, d };
  });
  signalPaiement(r.d.id);
  if (r.p.encaisse_par && r.p.encaisse_par !== admin.id) {
    await notifier(
      getPool(),
      { userIds: [r.p.encaisse_par] },
      {
        type: 'paiement_valide',
        titre: `Paiement validé : ${r.d.numero}`,
        message: `${formatFCFA(r.p.montant)} en ${MODE_PAIEMENT_LABELS[r.p.mode as ModePaiement] ?? r.p.mode} · ${r.d.client_nom}`,
        dossier_id: r.d.id,
      },
    ).catch(() => {});
  }
  res.json(await chargerPaiement(id));
});

/** Lit `ids` : tableau de 1 à 500 identifiants entiers positifs (doublons retirés). */
function lireIds(body: unknown): number[] {
  const brut = (body as { ids?: unknown } | undefined)?.ids;
  if (!Array.isArray(brut) || brut.length === 0) {
    throw badRequest('Choisissez au moins un paiement à valider.', { champs: { ids: 'Liste de paiements vide' } });
  }
  if (brut.length > 500) throw badRequest('500 paiements au plus par validation groupée : validez la sélection en plusieurs fois.', { champs: { ids: '500 au maximum' } });
  if (!brut.every((v) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 2_147_483_647)) {
    throw badRequest('La liste des paiements est invalide : identifiants entiers attendus.', { champs: { ids: 'Identifiants invalides' } });
  }
  return [...new Set(brut as number[])];
}

/** Notifie chaque encaisseur (autre que l'administrateur) des paiements validés pour lui. */
async function notifierEncaisseurs(adminId: number, acceptes: { encaisse_par: number | null; montant: number }[]) {
  const parUser = new Map<number, { n: number; somme: number }>();
  for (const p of acceptes) {
    if (!p.encaisse_par || p.encaisse_par === adminId) continue;
    const t = parUser.get(p.encaisse_par) ?? { n: 0, somme: 0 };
    parUser.set(p.encaisse_par, { n: t.n + 1, somme: t.somme + p.montant });
  }
  for (const [userId, t] of parUser) {
    await notifier(
      getPool(),
      { userIds: [userId] },
      {
        type: 'paiement_valide',
        titre: t.n > 1 ? `${t.n} paiements validés` : 'Paiement validé',
        message: `${formatFCFA(t.somme)} ajoutés à l'encaissé.`,
        dossier_id: null,
      },
    ).catch(() => {});
  }
}

/** Signale les dossiers touchés (50 au plus ; au-delà, un seul signal recharge les listes). */
function signalerDossiers(ids: number[]) {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return;
  for (const id of uniques.slice(0, 50)) signalPaiement(id);
}

paiementsRouter.post('/valider-groupe', requireRole('admin'), async (req, res) => {
  const admin = me(req);
  const ids = lireIds(req.body);
  const r = await tx(async (db) => {
    const paiements = await verrouillerPaiements(db, ids);
    const trouves = new Set(paiements.map((p) => p.id));
    const dossiers = await verrouillerDossiers(db, paiements.map((p) => p.dossier_id));
    const { acceptes, refuses } = trier(paiements, dossiers);
    for (const id of ids) if (!trouves.has(id)) refuses.push({ id, numero: null, code: 'introuvable', message: "Ce paiement n'existe pas." });
    await appliquerValidation(db, admin.id, acceptes, 'groupe');
    for (const p of acceptes) {
      const d = dossiers.get(p.dossier_id)!;
      await journal(req, 'paiement_valide', 'paiement', p.id, { dossier_id: d.id, numero: d.numero, montant: p.montant, mode: p.mode, groupe: true }, db);
    }
    const somme = acceptes.reduce((s, p) => s + p.montant, 0);
    await journal(req, 'paiements_valides_groupe', 'paiement', null, { demandes: ids.length, valides: acceptes.length, somme, refuses: refuses.map((x) => ({ id: x.id, code: x.code })) }, db);
    return { acceptes, refuses, somme };
  });
  signalerDossiers(r.acceptes.map((p) => p.dossier_id));
  await notifierEncaisseurs(admin.id, r.acceptes);
  res.json({
    valides: r.acceptes.length,
    somme: r.somme,
    ids: r.acceptes.map((p) => p.id).sort((a, b) => a - b),
    refuses: r.refuses.sort((a, b) => a.id - b.id),
  });
});

// ---------------------------------------------------------------------------
// Historique importé de l'ancienne plateforme : les encaissements « livreur » repris de
// l'ancienne base (legacy_id renseigné) arrivent « à valider ». Ceux des dossiers livrés ou
// terminés, encaissés avant une date choisie, peuvent être validés d'un coup.

const HISTORIQUE_ECHECS_PAR_HEURE = 5;
const STATUTS_HISTORIQUE = ['livre', 'termine'];

/** Borne « avant » : AAAA-MM-JJ (début de ce jour dans le fuseau de l'entreprise) ou date-heure ISO 8601. */
async function lireAvant(valeur: unknown, fuseau: string, db?: Db): Promise<{ avant: string; borne: Date }> {
  const v = typeof valeur === 'string' ? valeur.trim() : '';
  if (!v) throw badRequest('Indiquez la date limite : les paiements encaissés avant cette date seront validés.', { champs: { avant: 'Date obligatoire' } });
  let borne: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    if (!estDateValide(v)) throw badRequest('La date limite est invalide : utilisez le format AAAA-MM-JJ (par exemple 2026-09-01).', { champs: { avant: 'Date invalide' } });
    const r = await one<{ b: Date }>(`SELECT ($1::date::timestamp AT TIME ZONE $2) AS b`, [v, fuseau], db);
    borne = r!.b;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v))) {
    borne = new Date(v);
  }
  if (!borne) throw badRequest('La date limite est invalide : utilisez le format AAAA-MM-JJ (par exemple 2026-09-01).', { champs: { avant: 'Date invalide' } });
  if (borne.getTime() > Date.now() + 86_400_000) {
    throw badRequest(`La date limite ne peut pas être dans le futur (au plus tard le ${aujourdhui(fuseau)}).`, { champs: { avant: 'Date future' } });
  }
  return { avant: v, borne };
}

async function candidatsHistorique(db: Db, borne: Date): Promise<number[]> {
  const rows = await query<{ id: number }>(
    `SELECT p.id FROM paiements p JOIN dossiers d ON d.id = p.dossier_id
     WHERE p.statut = 'a_valider' AND p.legacy_id IS NOT NULL AND p.encaisse_at < $1
       AND d.statut = ANY($2::text[]) AND d.deleted_at IS NULL
     ORDER BY p.id`,
    [borne, STATUTS_HISTORIQUE],
    db,
  );
  return rows.map((r) => r.id);
}

function bilan(acceptes: { montant: number }[], refuses: Refus[], paiements: { id: number; montant: number }[]) {
  const montants = new Map(paiements.map((p) => [p.id, p.montant]));
  const depassements = refuses.filter((r) => r.code === 'depassement');
  return {
    n: acceptes.length,
    somme: acceptes.reduce((s, p) => s + p.montant, 0),
    ignores: {
      n: refuses.length,
      somme: refuses.reduce((s, r) => s + (montants.get(r.id) ?? 0), 0),
      depassement: depassements.length,
      exemples: refuses.slice(0, 20).map((r) => ({ id: r.id, numero: r.numero, code: r.code, message: r.message })),
    },
  };
}

/** Aperçu sans rien modifier : combien de paiements seraient validés, pour quelle somme. */
paiementsRouter.get('/historique', requireRole('admin'), async (req, res) => {
  const params = await getParametres();
  const { avant, borne } = await lireAvant(req.query.avant, params.fuseau);
  const r = await tx(async (db) => {
    await query(`SET TRANSACTION READ ONLY`, [], db);
    const ids = await candidatsHistorique(db, borne);
    const paiements = ids.length ? await query<any>(`SELECT id, dossier_id, montant, mode, statut, encaisse_par, encaisse_at, legacy_id FROM paiements WHERE id = ANY($1::int[])`, [ids], db) : [];
    const dossiers = new Map(
      (
        await query<any>(
          `SELECT d.id, d.numero, d.client_nom, d.montant, d.statut, d.deleted_at,
                  coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.dossier_id = d.id AND p.statut = 'valide'), 0)::bigint AS deja_paye
           FROM dossiers d WHERE d.id = ANY($1::int[])`,
          [[...new Set(paiements.map((p: any) => p.dossier_id))]],
          db,
        )
      ).map((d) => [d.id, d]),
    );
    const { acceptes, refuses } = trier(paiements, dossiers);
    return bilan(acceptes, refuses, paiements);
  });
  const total = await one<{ n: number; somme: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(montant), 0)::bigint AS somme FROM paiements WHERE statut = 'a_valider' AND legacy_id IS NOT NULL`,
  );
  res.json({ avant, borne: borne.toISOString(), ...r, importes_a_valider: total ?? { n: 0, somme: 0 } });
});

paiementsRouter.post('/valider-historique', requireRole('admin'), async (req: Request, res) => {
  const admin = me(req);
  const echecs = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM journal WHERE user_id = $1 AND action = 'validation_historique_refusee' AND created_at > now() - interval '1 hour'`,
    [admin.id],
  );
  if ((echecs?.n ?? 0) >= HISTORIQUE_ECHECS_PAR_HEURE) {
    throw new HttpError(429, 'Trop de mots de passe incorrects : la validation de l’historique est bloquée pendant une heure.', undefined, 'trop_de_tentatives');
  }
  const params = await getParametres();
  const { avant, borne } = await lireAvant(req.body?.avant, params.fuseau);
  const motDePasse = typeof req.body?.mot_de_passe === 'string' ? (req.body.mot_de_passe as string) : '';
  if (!motDePasse) {
    throw badRequest('Saisissez votre mot de passe pour confirmer la validation de l’historique.', { champs: { mot_de_passe: 'Saisissez votre mot de passe' } });
  }
  const u = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [admin.id]);
  if (!u || motDePasse.length > 200 || !(await bcrypt.compare(motDePasse, u.password_hash))) {
    await journal(req, 'validation_historique_refusee', 'paiement', null, { motif: 'mot_de_passe', avant });
    throw badRequest('Mot de passe incorrect : aucun paiement n’a été validé.', { champs: { mot_de_passe: 'Mot de passe incorrect' } });
  }
  const r = await tx(async (db) => {
    const ids = await candidatsHistorique(db, borne);
    const paiements = await verrouillerPaiements(db, ids);
    const dossiers = await verrouillerDossiers(db, paiements.map((p) => p.dossier_id));
    // Revérifié après les verrous : le dossier peut avoir changé d'état entre-temps.
    const eligibles = paiements.filter((p) => {
      const d = dossiers.get(p.dossier_id);
      return p.legacy_id !== null && d && STATUTS_HISTORIQUE.includes(d.statut);
    });
    const { acceptes, refuses } = trier(eligibles, dossiers);
    await appliquerValidation(db, admin.id, acceptes, 'historique');
    const b = bilan(acceptes, refuses, eligibles);
    await journal(
      req,
      'paiements_historique_valides',
      'paiement',
      null,
      { avant, borne: borne.toISOString(), valides: b.n, somme: b.somme, ignores: b.ignores.n, somme_ignoree: b.ignores.somme, ids: acceptes.map((p) => p.id) },
      db,
    );
    return { b, dossiers: acceptes.map((p) => p.dossier_id) };
  });
  signalerDossiers(r.dossiers);
  res.json({ avant, borne: borne.toISOString(), ...r.b });
});

paiementsRouter.post('/:id/refuser', requireRole('admin'), async (req, res) => {
  const admin = me(req);
  const id = intParam(req);
  const motif = typeof req.body?.motif === 'string' ? req.body.motif.trim() : '';
  if (motif.length < 3) {
    throw badRequest('Indiquez le motif du refus (3 caractères au moins) : il est transmis à la personne qui a encaissé.', {
      champs: { motif: 'Motif obligatoire' },
    });
  }
  if (motif.length > 500) throw badRequest('Le motif du refus est trop long (500 caractères au maximum).');
  const r = await tx(async (db) => {
    const p = await one<{ id: number; dossier_id: number; montant: number; mode: ModePaiement; statut: string; encaisse_par: number | null }>(
      `SELECT id, dossier_id, montant, mode, statut, encaisse_par FROM paiements WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!p) throw notFound("Ce paiement n'existe pas.");
    if (p.statut === 'refuse') throw conflict('Ce paiement est déjà refusé.');
    if (p.statut !== 'a_valider') throw conflict('Ce paiement est déjà validé : il ne peut plus être refusé.');
    const d = await one<{ id: number; numero: string; client_nom: string }>(`SELECT id, numero, client_nom FROM dossiers WHERE id = $1`, [p.dossier_id], db);
    await query(`UPDATE paiements SET statut = 'refuse', motif_refus = $2, valide_par = $3, valide_at = now() WHERE id = $1`, [id, motif, admin.id], db);
    await evenement(db, p.dossier_id, admin.id, {
      type: 'paiement',
      action: 'refuse',
      commentaire: motif,
      data: { paiement_id: id, montant: p.montant, mode: p.mode },
    });
    await journal(req, 'paiement_refuse', 'paiement', id, { dossier_id: p.dossier_id, montant: p.montant, motif }, db);
    return { p, d: d! };
  });
  signalPaiement(r.d.id);
  if (r.p.encaisse_par && r.p.encaisse_par !== admin.id) {
    await notifier(
      getPool(),
      { userIds: [r.p.encaisse_par] },
      { type: 'paiement_refuse', titre: `Paiement refusé : ${r.d.numero}`, message: `${formatFCFA(r.p.montant)} · ${motif}`, dossier_id: r.d.id },
    ).catch(() => {});
  }
  res.json(await chargerPaiement(id));
});

// ---------------------------------------------------------------------------
// /api/dossiers/:id/paiements (monté sur /api/dossiers après le routeur des dossiers :
// aucune route de ce dernier ne correspond à ce chemin, il n'y a donc pas de masquage)

export const dossierPaiementsRouter = Router();

dossierPaiementsRouter.post('/:id/paiements', requireAuth, requireRole('admin', 'preparateur', 'livreur'), async (req, res) => {
  const user = me(req);
  const id = intParam(req);
  const input = paiementInputSchema.parse(req.body ?? {});
  const paiementId = await tx(async (db) => {
    const d = await chargerDossier(user, id, db, true);
    // Sommes relues après la prise du verrou : un encaissement concurrent sur le même dossier,
    // validé entre-temps, est ainsi compté dans le reste à payer.
    const sommes = await one<{ deja_paye: number; en_attente_validation: number }>(
      `SELECT coalesce(sum(montant) FILTER (WHERE statut = 'valide'), 0)::int AS deja_paye,
              coalesce(sum(montant) FILTER (WHERE statut = 'a_valider'), 0)::int AS en_attente_validation
       FROM paiements WHERE dossier_id = $1`,
      [id],
      db,
    );
    return enregistrerPaiement(db, user, { ...d, ...sommes! }, {
      montant: input.montant,
      mode: input.mode,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    });
  });
  signalPaiement(id);
  res.status(201).json(await chargerPaiement(paiementId));
});

// ---------------------------------------------------------------------------
// /api/caisse : ce que chaque encaisseur détient (à valider) et ce qui a été validé aujourd'hui.

export const caisseRouter = Router();
caisseRouter.use(requireAuth, requireRole('admin'));

caisseRouter.get('/', async (_req, res) => {
  const params = await getParametres();
  const tz = params.fuseau;
  const debutJour = `(date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)`;
  const colonnes = `
    count(*) FILTER (WHERE p.statut = 'a_valider')::int AS av_n,
    coalesce(sum(p.montant) FILTER (WHERE p.statut = 'a_valider'), 0)::bigint AS av_s,
    count(*) FILTER (WHERE p.statut = 'valide' AND p.valide_at >= ${debutJour})::int AS vj_n,
    coalesce(sum(p.montant) FILTER (WHERE p.statut = 'valide' AND p.valide_at >= ${debutJour}), 0)::bigint AS vj_s,
    count(*) FILTER (WHERE p.statut = 'refuse' AND p.valide_at >= ${debutJour})::int AS rj_n,
    coalesce(sum(p.montant) FILTER (WHERE p.statut = 'refuse' AND p.valide_at >= ${debutJour}), 0)::bigint AS rj_s`;
  const filtre = `WHERE p.statut = 'a_valider' OR (p.statut IN ('valide', 'refuse') AND p.valide_at >= ${debutJour})`;
  type Ligne = { av_n: number; av_s: number; vj_n: number; vj_s: number; rj_n: number; rj_s: number };
  const parUser = await query<{ user_id: number | null; nom: string | null; role: string | null } & Ligne>(
    `SELECT p.encaisse_par AS user_id, u.nom, u.role, ${colonnes}
     FROM paiements p LEFT JOIN users u ON u.id = p.encaisse_par
     ${filtre}
     GROUP BY p.encaisse_par, u.nom, u.role
     ORDER BY av_s DESC, vj_s DESC, rj_s DESC, u.nom`,
    [tz],
  );
  const parMode = await query<{ mode: ModePaiement } & Ligne>(
    `SELECT p.mode, ${colonnes} FROM paiements p ${filtre} GROUP BY p.mode ORDER BY p.mode`,
    [tz],
  );
  const bloc = (n: number, somme: number) => ({ n, somme });
  const tot = parUser.reduce(
    (acc, r) => ({
      av_n: acc.av_n + r.av_n,
      av_s: acc.av_s + r.av_s,
      vj_n: acc.vj_n + r.vj_n,
      vj_s: acc.vj_s + r.vj_s,
      rj_n: acc.rj_n + r.rj_n,
      rj_s: acc.rj_s + r.rj_s,
    }),
    { av_n: 0, av_s: 0, vj_n: 0, vj_s: 0, rj_n: 0, rj_s: 0 },
  );
  res.json({
    par_encaisseur: parUser.map((r) => ({
      user_id: r.user_id,
      nom: r.nom ?? 'Encaisseur inconnu (données importées)',
      role: r.role,
      a_valider: bloc(r.av_n, r.av_s),
      valide_aujourdhui: bloc(r.vj_n, r.vj_s),
      refuse_aujourdhui: bloc(r.rj_n, r.rj_s),
    })),
    par_mode: parMode.map((r) => ({
      mode: r.mode,
      libelle: MODE_PAIEMENT_LABELS[r.mode] ?? r.mode,
      a_valider: bloc(r.av_n, r.av_s),
      valide_aujourdhui: bloc(r.vj_n, r.vj_s),
      refuse_aujourdhui: bloc(r.rj_n, r.rj_s),
    })),
    totaux: { a_valider: bloc(tot.av_n, tot.av_s), valide_aujourdhui: bloc(tot.vj_n, tot.vj_s), refuse_aujourdhui: bloc(tot.rj_n, tot.rj_s) },
  });
});
