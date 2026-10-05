// Import des données de production de l'ancienne plateforme EvocomPrint vers Evocom Print v2.
//
// Principes :
//   * l'ancienne base n'est jamais modifiée (connexion et transaction en lecture seule) ;
//   * les fichiers d'uploads sont COPIÉS (jamais déplacés), avec SHA-256 recalculé ;
//   * tout l'import se fait dans UNE transaction sur la base v2 : tout ou rien ;
//     en simulation (--dry-run) tout est exécuté puis annulé, et le rapport est quand même écrit ;
//   * rien n'est perdu en silence : chaque écart est signalé dans le rapport, et les colonnes
//     de l'ancienne base sans équivalent v2 sont conservées dans l'événement « import » du dossier.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  CATEGORIES_TARIF,
  ROLES,
  TARIFS_DEFAUT,
  type CategorieTarif,
  type Machine,
  type Role,
  type Statut,
  type StatutDevis,
  type UniteTarif,
} from '@evocom/shared';
import { migrate } from '../db/migrate';
import { seedBase } from '../db/seed';
import { nomDisque } from '../modules/fichiers/routes';
import { SourceLegacy, ident, memeBase, urlMasquee, type LigneLegacy } from './legacy';
import {
  categorieOrphelin,
  copierAvecEmpreinte,
  enParallele,
  IndexDisque,
  listerRecursif,
  resoudre,
  SuiviCopies,
} from './fichiers';
import {
  arrondirFcfa,
  booleen,
  cleClient,
  decoderJson,
  deduireMachine,
  entier,
  estEmail,
  estObjet,
  estUuid,
  horodatage,
  jourDe,
  lireMontant,
  mimeDepuisNom,
  normaliserMachine,
  normaliserMode,
  normaliserStatut,
  normaliserStatutPaiement,
  plusTard,
  plusTot,
  preciserDate,
  reparerMojibake,
  sansAccents,
  sansHorodatage,
  texte,
  texteLong,
} from './normalize';
import { Rapport, octets, resumeTexte, type FichierManquant, type RapportJson } from './rapport';

export interface ImportOptions {
  /** Ancienne base (lue en lecture seule). */
  legacyUrl: string;
  /** Base Evocom Print v2 (cible). */
  targetUrl: string;
  /** Racines des uploads de l'ancienne plateforme (ex. /var/www/imprimerie/uploads, /var/www/imprimerie/backend/uploads). */
  uploadsDirs: string[];
  /** Répertoire de stockage v2 (STORAGE_DIR). */
  storageDir: string;
  /** Simulation : tout est exécuté puis annulé ; aucun fichier n'est copié. */
  dryRun?: boolean;
  /** Vide les données métier de la cible avant l'import (sinon refus si la cible n'est pas vide). */
  remplacer?: boolean;
  /** Fichier du rapport JSON ; null pour ne pas l'écrire ; undefined pour le nom par défaut. */
  rapport?: string | null;
  /** Fuseau des horodatages (sans fuseau) de l'ancienne base ; par défaut celui du serveur d'origine. */
  fuseau?: string | null;
  /** Journal de progression (console par défaut). */
  log?: (message: string) => void;
  /** Copies de fichiers simultanées (défaut 4). */
  copiesSimultanees?: number;
}

export interface ImportResult {
  /** 0 succès, 1 erreur, 2 cible non vide sans --remplacer. */
  code: 0 | 1 | 2;
  message: string;
  rapport: RapportJson | null;
  rapportPath: string | null;
}

const TAILLE_LOT = 500;
const ACTION_IMPORT = 'import_ancienne_plateforme';
const CLIENT_INCONNU = 'Client non renseigné';
/** Tables de données métier : la cible doit être vide (sinon --remplacer). */
const TABLES_METIER = ['users', 'clients', 'dossiers', 'dossier_events', 'fichiers', 'devis', 'factures', 'paiements'];
/** Tables vidées par --remplacer (les paramètres et l'historique des sauvegardes sont conservés). */
const TABLES_A_VIDER = [
  'notifications',
  'journal',
  'paiements',
  'factures',
  'fichiers',
  'dossier_events',
  'dossiers',
  'devis',
  'clients',
  'compteurs',
  'tarifs',
  'users',
];

interface IndexDossier {
  folderId: string | null;
  client: string | null;
  tel: string | null;
  email: string | null;
  createdAt: string | null;
}

interface DossierImporte {
  id: number;
  numero: string;
  montant: number | null;
  statut: Statut;
  clientNom: string;
  /** Marqué « payé » dans l'ancienne plateforme (statut_paiement). */
  payeAncien: boolean;
}

interface Ctx {
  db: pg.PoolClient;
  src: SourceLegacy;
  rapport: Rapport;
  log: (m: string) => void;
  opts: Required<Pick<ImportOptions, 'dryRun' | 'storageDir' | 'copiesSimultanees'>>;
  index: IndexDisque;
  suivi: SuiviCopies;
  maintenant: string;
  users: Map<number, number>;
  idx: Map<number, IndexDossier>;
  parFolder: Map<string, number>;
  clients: Map<string, number>;
  devisRows: LigneLegacy[];
  facturesRows: LigneLegacy[];
  devisLegacyVersDossierLegacy: Map<number, number>;
  devisParDossier: Map<number, number>;
  dossiers: Map<number, DossierImporte>;
  factures: Map<number, number>;
  numeros: { serie: 'CMD' | 'DEV' | 'FAC'; numero: string }[];
}

// ---------------------------------------------------------------------------
// Point d'entrée

export async function runImport(options: ImportOptions): Promise<ImportResult> {
  const log = options.log ?? ((m: string) => console.log(m));
  const dryRun = options.dryRun ?? false;
  const remplacer = options.remplacer ?? false;
  const storageDir = path.resolve(options.storageDir);
  const racines = options.uploadsDirs.map((r) => path.resolve(r));
  const rapport = new Rapport({
    mode: dryRun ? 'simulation' : 'reel',
    sourceBase: urlMasquee(options.legacyUrl),
    cibleBase: urlMasquee(options.targetUrl),
    stockage: storageDir,
    racines,
    remplacement: remplacer,
  });
  const rapportPath = options.rapport === null ? null : path.resolve(options.rapport ?? nomRapportParDefaut(dryRun));
  const fin = (code: ImportResult['code'], message: string, ecrire = true): ImportResult => {
    if (ecrire && rapportPath) {
      try {
        rapport.ecrire(rapportPath);
      } catch (e) {
        log(`Impossible d'écrire le rapport ${rapportPath} : ${(e as Error).message}`);
      }
    }
    return { code, message, rapport: rapport.data, rapportPath: ecrire ? rapportPath : null };
  };

  if (!options.legacyUrl) return fin(1, "Adresse de l'ancienne base absente (--legacy-url ou LEGACY_DATABASE_URL).", false);
  if (!options.targetUrl) return fin(1, 'Adresse de la base v2 absente (DATABASE_URL).', false);
  if (memeBase(options.legacyUrl, options.targetUrl)) {
    return fin(1, "L'ancienne base et la base v2 désignent la même base de données : import refusé.", false);
  }
  if (racines.length === 0) {
    return fin(1, "Aucun dossier d'uploads indiqué (--uploads ou LEGACY_UPLOADS_DIRS) : les fichiers ne pourraient pas être retrouvés.", false);
  }
  for (const r of racines) {
    if (storageDir === r || storageDir.startsWith(r + path.sep) || r.startsWith(storageDir + path.sep)) {
      return fin(1, `Le stockage v2 (${storageDir}) et le dossier d'uploads ${r} se recouvrent : choisissez des répertoires distincts.`, false);
    }
  }

  const target = new pg.Pool({ connectionString: options.targetUrl, max: 3, application_name: 'evocom-import-legacy' });
  target.on('error', () => {});
  let src: SourceLegacy | null = null;
  const suivi = new SuiviCopies(storageDir);
  try {
    // 1. Schéma cible à jour, et refus si la cible contient déjà des données.
    rapport.data.cible.migrations_appliquees = await migrate(target, (m) => log(m));
    const existantes = await compterTables(target, TABLES_METIER);
    const nonVides = Object.entries(existantes).filter(([, n]) => n > 0);
    let vider = remplacer;
    if (nonVides.length && !remplacer) {
      const detail = nonVides.map(([t, n]) => `${t} ${n}`).join(', ');
      if (!dryRun) {
        rapport.terminer('refuse', `cible non vide (${detail})`);
        return fin(
          2,
          `La base v2 contient déjà des données (${detail}). Relancez avec --remplacer pour les effacer et refaire l'import, ou videz la base.`,
          false,
        );
      }
      // Une simulation n'écrit jamais rien : on la fait comme avec --remplacer, dans la transaction annulée.
      vider = true;
      rapport.anomalie(
        'cible',
        null,
        'cible_non_vide',
        'attention',
        `La base v2 contient déjà des données (${detail}) : la simulation a été faite comme avec --remplacer (rien n'a été modifié). L'import réel exigera --remplacer, qui effacera ces données.`,
      );
    }

    // 2. Inventaire du disque et ouverture de l'ancienne base en lecture seule.
    log(`Inventaire des fichiers sous ${racines.join(', ')}…`);
    const index = await IndexDisque.construire(racines, (n) => log(`  ${n} fichiers inventoriés…`));
    log(`  ${index.fichiers.size} fichier(s), ${octets(index.octetsTotal)}.`);
    src = await SourceLegacy.ouvrir(options.legacyUrl);
    const fuseau = options.fuseau || src.fuseau;
    rapport.data.source.fuseau = fuseau;
    log(`Ancienne base ouverte en lecture seule (${src.base}, fuseau ${fuseau}).`);
    if (!src.a('dossiers') || !src.a('users')) throw new Error("L'ancienne base ne contient pas les tables users et dossiers : ce n'est pas une base EvocomPrint.");
    const typeId = src.typeColonne('dossiers', 'id');
    if (!typeId || !['integer', 'bigint', 'smallint'].includes(typeId)) {
      throw new Error(`dossiers.id est de type ${typeId ?? 'inconnu'} : seule la variante à identifiants entiers est prise en charge.`);
    }
    for (const t of src.tables()) {
      rapport.data.source.tables[t] = await src.compter(t);
      rapport.data.source.empreinte_avant[t] = await src.empreinte(t);
    }

    // 3. Import dans une seule transaction.
    const db = await target.connect();
    const ctx: Ctx = {
      db,
      src,
      rapport,
      log,
      opts: { dryRun, storageDir, copiesSimultanees: options.copiesSimultanees ?? 4 },
      index,
      suivi,
      maintenant: new Date().toISOString(),
      users: new Map(),
      idx: new Map(),
      parFolder: new Map(),
      clients: new Map(),
      devisRows: [],
      facturesRows: [],
      devisLegacyVersDossierLegacy: new Map(),
      devisParDossier: new Map(),
      dossiers: new Map(),
      factures: new Map(),
      numeros: [],
    };
    try {
      await db.query('BEGIN');
      await db.query(`SELECT set_config('TimeZone', $1, true)`, [fuseau]);
      if (vider) await viderCible(ctx, existantes);
      await importerUtilisateurs(ctx);
      await indexerDossiers(ctx);
      ctx.devisRows = await src.toutes('devis');
      ctx.facturesRows = await src.toutes('factures');
      await importerClients(ctx);
      await importerDevis(ctx);
      const resume = await resumerHistorique(ctx);
      await importerDossiers(ctx, resume);
      await analyser(ctx, 'users', 'clients', 'devis', 'dossiers', 'dossier_events');
      await lierDevis(ctx);
      await importerHistorique(ctx);
      await importerFichiers(ctx);
      await importerFactures(ctx);
      await importerPaiements(ctx);
      await analyser(ctx, 'fichiers', 'factures', 'paiements', 'dossier_events');
      await controlerPaiements(ctx);
      await importerTarifs(ctx);
      await fixerCompteurs(ctx);
      await seedBase(db as unknown as pg.Pool);
      noterTablesNonReprises(ctx);
      await controlerCible(ctx);
      if (dryRun) {
        await db.query('ROLLBACK');
        log('Simulation terminée : transaction annulée (ROLLBACK), aucune donnée écrite.');
      } else {
        await db.query('COMMIT');
        log('Import validé (COMMIT).');
      }
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      const n = await suivi.annuler();
      if (n) log(`Import annulé : ${n} fichier(s) déjà copié(s) retiré(s) du stockage v2.`);
      throw err;
    } finally {
      db.release();
    }
    if (dryRun) await suivi.annuler();

    // L'import est validé à ce stade : une erreur dans les vérifications qui suivent est signalée
    // dans le rapport, sans faire croire à un échec de l'import.
    const apres = async (quoi: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e) {
        rapport.anomalie('import', null, 'verification_apres_import', 'attention', `${quoi} : ${(e as Error).message}`);
      }
    };
    // 4. Anciens fichiers v2 devenus orphelins (--remplacer) mis de côté, jamais supprimés.
    if (!dryRun && remplacer) {
      await apres('Mise de côté des anciens fichiers v2', () => mettreDeCoteFichiersV2(target, storageDir, rapport, log));
    }
    // 5. Preuve que l'ancienne base n'a pas bougé (nouvelle lecture, hors de l'instantané de l'import).
    await apres("Contrôle de l'ancienne base", async () => {
      await src!.nouvelInstantane();
      let inchangee = true;
      for (const t of src!.tables()) {
        const e = await src!.empreinte(t);
        rapport.data.source.empreinte_apres[t] = e;
        const avant = rapport.data.source.empreinte_avant[t];
        if (!avant || avant.md5 !== e.md5 || avant.lignes !== e.lignes) inchangee = false;
      }
      rapport.data.source.inchangee = inchangee;
      if (!inchangee) {
        rapport.anomalie(
          'source',
          null,
          'source_modifiee_pendant_import',
          'attention',
          "L'ancienne base a changé pendant l'import (l'ancienne application est-elle encore active ?). Relancez l'import une fois l'application arrêtée.",
        );
      }
    });
    rapport.terminer('ok');
    const r = fin(0, dryRun ? 'Simulation réussie.' : 'Import réussi.');
    log(resumeTexte(rapport.data, r.rapportPath));
    return r;
  } catch (err) {
    rapport.terminer('echec', err);
    const r = fin(1, `Échec de l'import : ${(err as Error).message}`);
    log(resumeTexte(rapport.data, r.rapportPath));
    if (process.env.IMPORT_DEBUG) log(String((err as Error).stack));
    return r;
  } finally {
    await src?.fermer();
    await target.end().catch(() => {});
  }
}

function nomRapportParDefaut(dryRun: boolean): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `import-report-${stamp}${dryRun ? '-simulation' : ''}.json`;
}

// ---------------------------------------------------------------------------
// Outils base cible

async function compterTables(db: pg.Pool | pg.PoolClient, tables: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tables) {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${ident(t)}`);
    out[t] = r.rows[0]?.n ?? 0;
  }
  return out;
}

/** Insertion par lots : un seul aller-retour par lot, conversions de types faites par PostgreSQL. */
async function inserer<T extends pg.QueryResultRow = any>(
  db: pg.PoolClient,
  table: string,
  colonnes: string[],
  lignes: Record<string, unknown>[],
  retour?: string,
): Promise<T[]> {
  if (lignes.length === 0) return [];
  const cols = colonnes.map(ident).join(', ');
  const r = await db.query<T>(
    `INSERT INTO ${ident(table)} (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::${ident(table)}, $1::jsonb)${retour ? ` RETURNING ${retour}` : ''}`,
    [JSON.stringify(lignes)],
  );
  return r.rows;
}

async function viderCible(ctx: Ctx, existantes: Record<string, number>) {
  // Toute table qui référence les tables vidées est vidée aussi, sauf les paramètres
  // (on retire seulement leur lien vers l'auteur de la modification).
  const aVider = new Set(TABLES_A_VIDER);
  for (;;) {
    const r = await ctx.db.query<{ t: string }>(
      `SELECT DISTINCT c.conrelid::regclass::text AS t FROM pg_constraint c
       WHERE c.contype = 'f' AND c.confrelid = ANY($1::regclass[])`,
      [[...aVider]],
    );
    const nouvelles = r.rows.map((x) => x.t.replace(/^public\./, '').replace(/"/g, '')).filter((t) => !aVider.has(t) && t !== 'parametres');
    if (nouvelles.length === 0) break;
    for (const t of nouvelles) aVider.add(t);
  }
  const avant = await compterTables(ctx.db, [...aVider]);
  // TRUNCATE users est impossible tant que parametres la référence : les utilisateurs sont supprimés
  // par DELETE une fois tout le reste vidé, puis leur séquence est remise à 1.
  aVider.delete('users');
  await ctx.db.query(`TRUNCATE ${[...aVider].map(ident).join(', ')} RESTART IDENTITY`);
  await ctx.db.query(`UPDATE parametres SET updated_by = NULL WHERE updated_by IS NOT NULL`);
  await ctx.db.query(`DELETE FROM users`);
  await ctx.db.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), 1, false)`);
  ctx.rapport.data.cible.lignes_supprimees_avant_import = Object.fromEntries(Object.entries(avant).filter(([, n]) => n > 0));
  const total = Object.values(existantes).reduce((s, n) => s + n, 0);
  ctx.log(`--remplacer : données v2 existantes effacées dans la transaction (${total} ligne(s) métier).`);
}

/**
 * Statistiques du planificateur après un chargement massif : sans elles, PostgreSQL croit les tables
 * vides (elles viennent d'être remplies dans la transaction) et choisit des plans quadratiques.
 */
async function analyser(ctx: Ctx, ...tables: string[]) {
  for (const t of tables) await ctx.db.query(`ANALYZE ${ident(t)}`);
}

function progression(ctx: Ctx, quoi: string, n: number, total: number) {
  if (n % TAILLE_LOT === 0 || n === total) ctx.log(`  ${quoi} : ${n} / ${total}`);
}

function resoudreDossier(ctx: Ctx, v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return ctx.idx.has(n) ? n : null;
  }
  if (estUuid(s)) {
    const n = ctx.parFolder.get(s.toLowerCase());
    return n !== undefined && n >= 0 ? n : null;
  }
  return null;
}

function utilisateur(ctx: Ctx, v: unknown, table: string, legacyId: unknown, role: string): number | null {
  const id = entier(v);
  if (id === null) return null;
  const n = ctx.users.get(id);
  if (n === undefined) {
    ctx.rapport.anomalie(table, legacyId, 'utilisateur_inconnu', 'info', `${role} : l'utilisateur #${id} n'existe pas dans l'ancienne base ; champ laissé vide.`);
    return null;
  }
  return n;
}

function sansCles(r: LigneLegacy, cles: string[]): LigneLegacy {
  const out: LigneLegacy = {};
  for (const [k, v] of Object.entries(r)) if (!cles.includes(k)) out[k] = v;
  return out;
}

// ---------------------------------------------------------------------------
// Utilisateurs

async function importerUtilisateurs(ctx: Ctx) {
  const t = ctx.rapport.table('users');
  const rows = await ctx.src.toutes('users');
  t.lus = rows.length;
  ctx.log(`Utilisateurs : ${rows.length}`);
  const groupes = new Map<string, LigneLegacy[]>();
  for (const u of rows) {
    let email = texte(u.email)?.toLowerCase() ?? null;
    if (!email || !estEmail(email)) {
      ctx.rapport.anomalie('users', u.id, 'email_invalide', 'attention', `E-mail absent ou invalide (« ${texte(u.email) ?? ''} ») : compte importé désactivé avec une adresse provisoire.`);
      email = `ancien-compte-${u.id}@import.invalid`;
      u.is_active = false;
    }
    const g = groupes.get(email);
    if (g) g.push(u);
    else groupes.set(email, [u]);
  }
  const lignes: Record<string, unknown>[] = [];
  const doublons = new Map<number, number>();
  for (const [email, g] of groupes) {
    g.sort((a, b) => {
      const actA = booleen(a.is_active) !== false ? 1 : 0;
      const actB = booleen(b.is_active) !== false ? 1 : 0;
      if (actA !== actB) return actB - actA;
      const la = horodatage(a.last_login) ?? '';
      const lb = horodatage(b.last_login) ?? '';
      if (la !== lb) return lb.localeCompare(la);
      return (entier(a.id) ?? 0) - (entier(b.id) ?? 0);
    });
    const garde = g[0]!;
    for (const autre of g.slice(1)) {
      doublons.set(entier(autre.id)!, entier(garde.id)!);
      t.ignores++;
      ctx.rapport.anomalie(
        'users',
        autre.id,
        'email_doublon',
        'attention',
        `Même e-mail que l'utilisateur #${garde.id} (${email}, à la casse près) : compte fusionné dans #${garde.id} (gardé : actif ou dernière connexion la plus récente). Ses dossiers et paiements lui sont rattachés.`,
        { nom: texte(autre.nom), email: texte(autre.email), role: texte(autre.role), is_active: autre.is_active },
      );
    }
    const id = entier(garde.id)!;
    let role = texte(garde.role)?.toLowerCase() ?? '';
    let actif = booleen(garde.is_active) ?? true;
    if (!(ROLES as readonly string[]).includes(role)) {
      ctx.rapport.anomalie('users', id, 'role_inconnu', 'erreur', `Rôle « ${role} » inconnu : compte importé comme préparateur DÉSACTIVÉ, à corriger par un administrateur.`);
      role = 'preparateur';
      actif = false;
    }
    const hash = texte(garde.password_hash) ?? '';
    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
      ctx.rapport.anomalie('users', id, 'hash_non_bcrypt', 'attention', 'Mot de passe non reconnu (pas un hachage bcrypt) : cet utilisateur ne pourra pas se connecter avant une réinitialisation par un administrateur.');
    }
    if (/@imprimerie\.local$|@test\.com$|^admin@imprimerie\.com$/.test(email)) {
      ctx.rapport.anomalie('users', id, 'compte_demo', 'attention', `${email} ressemble à un compte de démonstration à mot de passe connu : à désactiver s'il n'est pas utilisé.`);
    }
    let nom = texte(garde.nom) ?? texte(garde.username) ?? email;
    const prenom = texte(garde.prenom);
    if (prenom && !nom.toLowerCase().includes(prenom.toLowerCase())) nom = `${prenom} ${nom}`;
    const created = horodatage(garde.created_at) ?? ctx.maintenant;
    lignes.push({
      nom,
      email,
      telephone: texte(garde.telephone) ?? texte(garde.phone),
      role: role as Role,
      password_hash: hash || '!',
      is_active: actif,
      last_login_at: horodatage(garde.last_login) ?? horodatage(garde.last_login_at),
      legacy_id: id,
      created_at: created,
      updated_at: horodatage(garde.updated_at) ?? created,
    });
  }
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const res = await inserer<{ id: number; legacy_id: number }>(
      ctx.db,
      'users',
      ['nom', 'email', 'telephone', 'role', 'password_hash', 'is_active', 'last_login_at', 'legacy_id', 'created_at', 'updated_at'],
      lignes.slice(i, i + TAILLE_LOT),
      'id, legacy_id',
    );
    for (const r of res) ctx.users.set(r.legacy_id, r.id);
  }
  for (const [autre, garde] of doublons) {
    const n = ctx.users.get(garde);
    if (n !== undefined) ctx.users.set(autre, n);
  }
  t.importes = lignes.length;
}

// ---------------------------------------------------------------------------
// Index des dossiers (première lecture légère : clés, folder_id, clients)

async function indexerDossiers(ctx: Ctx) {
  const sql = `SELECT j->>'id' AS id, j->>'folder_id' AS folder_id,
      coalesce(j->>'client', j->>'client_nom') AS client,
      coalesce(nullif(btrim(j->>'telephone_client'), ''), nullif(btrim(j->>'client_telephone'), '')) AS tel,
      j->>'client_email' AS email, j->>'created_at' AS created_at
    FROM (SELECT to_jsonb(d) AS j FROM public.dossiers d ORDER BY d.id) s`;
  const folders = new Map<string, number[]>();
  for await (const lot of ctx.src.paquets<{ id: string; folder_id: string | null; client: string | null; tel: string | null; email: string | null; created_at: string | null }>(sql, 2000)) {
    for (const r of lot) {
      const id = Number(r.id);
      const folder = texte(r.folder_id);
      ctx.idx.set(id, { folderId: folder, client: texte(r.client), tel: texte(r.tel), email: texte(r.email), createdAt: horodatage(r.created_at) });
      if (folder && estUuid(folder)) {
        const k = folder.toLowerCase();
        const l = folders.get(k);
        if (l) l.push(id);
        else folders.set(k, [id]);
      }
    }
  }
  for (const [k, ids] of folders) {
    if (ids.length === 1) ctx.parFolder.set(k, ids[0]!);
    else {
      ctx.parFolder.set(k, -1);
      ctx.rapport.anomalie('dossiers', ids.join(','), 'folder_id_doublon', 'attention', `folder_id ${k} partagé par les dossiers ${ids.join(', ')} : les références par ce folder_id ne peuvent pas être rattachées.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Clients (déduits des noms saisis sur les dossiers, devis et factures, + table clients si elle existe)

interface AgregatClient {
  variantes: Map<string, number>;
  premiere: string | null;
  derniere: string | null;
  tel: string | null;
  telAt: string;
  email: string | null;
  emailAt: string;
  adresse: string | null;
  notes: string[];
  dossiers: number;
}

async function importerClients(ctx: Ctx) {
  const agregats = new Map<string, AgregatClient>();
  const ajouter = (
    nomBrut: unknown,
    o: { tel?: string | null; email?: string | null; adresse?: string | null; notes?: string | null; at?: string | null; dossier?: boolean },
  ) => {
    const nom = texte(nomBrut);
    if (!nom) return;
    const cle = cleClient(nom);
    let a = agregats.get(cle);
    if (!a) {
      a = { variantes: new Map(), premiere: null, derniere: null, tel: null, telAt: '', email: null, emailAt: '', adresse: null, notes: [], dossiers: 0 };
      agregats.set(cle, a);
    }
    a.variantes.set(nom, (a.variantes.get(nom) ?? 0) + 1);
    const at = o.at ?? '';
    if (o.at) {
      a.premiere = plusTot(a.premiere, o.at);
      a.derniere = plusTard(a.derniere, o.at);
    }
    if (o.tel && (a.tel === null || at >= a.telAt)) {
      a.tel = o.tel;
      a.telAt = at;
    }
    if (o.email && (a.email === null || at >= a.emailAt)) {
      a.email = o.email.toLowerCase();
      a.emailAt = at;
    }
    if (o.adresse && !a.adresse) a.adresse = o.adresse;
    if (o.notes) a.notes.push(o.notes);
    if (o.dossier) a.dossiers++;
  };
  const contact = (v: unknown) => {
    const s = texte(v);
    if (!s) return { tel: null, email: null };
    return estEmail(s) ? { tel: null, email: s } : { tel: s, email: null };
  };

  let lus = 0;
  if (ctx.src.a('clients')) {
    for (const c of await ctx.src.toutes('clients')) {
      lus++;
      ajouter(c.nom ?? c.name ?? c.raison_sociale ?? c.client, {
        tel: texte(c.telephone ?? c.phone ?? c.tel),
        email: texte(c.email),
        adresse: texteLong(c.adresse ?? c.address),
        notes: texteLong(c.notes),
        at: horodatage(c.created_at),
      });
    }
  }
  for (const d of ctx.idx.values()) ajouter(d.client, { tel: d.tel, email: d.email, at: d.createdAt, dossier: true });
  for (const d of ctx.devisRows) {
    const c = contact(d.client_contact);
    ajouter(d.client_nom, { tel: c.tel, email: texte(d.client_email) ?? c.email, at: horodatage(d.created_at) });
  }
  for (const f of ctx.facturesRows) {
    const c = contact(f.client_contact);
    ajouter(f.client_nom, { tel: c.tel, email: c.email, adresse: texteLong(f.client_adresse), at: horodatage(f.created_at) });
  }

  const majuscules = (s: string) => (s.match(/\p{Lu}/gu) ?? []).length;
  const lignes: Record<string, unknown>[] = [];
  for (const a of agregats.values()) {
    const variantes = [...a.variantes.entries()].sort((x, y) => y[1] - x[1] || majuscules(y[0]) - majuscules(x[0]) || x[0].localeCompare(y[0]));
    const nom = variantes[0]![0];
    const notes: string[] = [];
    if (variantes.length > 1) {
      notes.push(`Variantes d'écriture dans l'ancienne plateforme : ${variantes.map(([v]) => `« ${v} »`).join(', ')}`);
      ctx.rapport.data.clients_fusionnes.push({ nom_retenu: nom, variantes: variantes.map(([v]) => v), dossiers: a.dossiers });
    }
    notes.push(...a.notes);
    const created = a.premiere ?? ctx.maintenant;
    lignes.push({
      nom,
      telephone: a.tel,
      email: a.email,
      adresse: a.adresse,
      notes: notes.length ? notes.join('\n') : null,
      created_at: created,
      updated_at: a.derniere ?? created,
    });
  }
  lignes.sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)) || String(x.nom).localeCompare(String(y.nom)));
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const res = await inserer<{ id: number; nom: string }>(
      ctx.db,
      'clients',
      ['nom', 'telephone', 'email', 'adresse', 'notes', 'created_at', 'updated_at'],
      lignes.slice(i, i + TAILLE_LOT),
      'id, nom',
    );
    // Le nom retenu est l'une des variantes du groupe : sa clé est celle du groupe.
    for (const r of res) ctx.clients.set(cleClient(r.nom), r.id);
  }
  if (ctx.clients.size !== lignes.length) throw new Error('Rattachement des clients incohérent.');
  const variantes = [...agregats.values()].reduce((s, a) => s + a.variantes.size, 0);
  const t = ctx.rapport.table('clients');
  t.lus = variantes;
  t.importes = lignes.length;
  ctx.log(`Clients : ${lignes.length} (à partir de ${variantes} nom(s) distinct(s)${lus ? `, dont ${lus} ligne(s) de la table clients` : ''}).`);
}

// ---------------------------------------------------------------------------
// Devis (avant les dossiers : un dossier issu d'un devis pointe vers lui)

const STATUT_DEVIS: Record<string, StatutDevis> = {
  brouillon: 'brouillon',
  en_attente: 'envoye',
  envoye: 'envoye',
  valide: 'accepte',
  accepte: 'accepte',
  refuse: 'refuse',
  converti: 'converti',
};

async function importerDevis(ctx: Ctx) {
  const t = ctx.rapport.table('devis');
  const histo = new Map<number, LigneLegacy[]>();
  if (ctx.src.a('devis_historique')) {
    const th = ctx.rapport.table('devis_historique');
    for (const h of await ctx.src.toutes('devis_historique')) {
      th.lus++;
      const id = entier(h.devis_id);
      if (id === null) {
        th.ignores++;
        continue;
      }
      const l = histo.get(id);
      if (l) l.push(h);
      else histo.set(id, [h]);
    }
  }
  const numeros = new Set<string>();
  const lignes: Record<string, unknown>[] = [];
  const liens = new Map<number, number>(); // devis legacy → dossier legacy
  for (const d of ctx.devisRows) {
    t.lus++;
    const id = entier(d.id)!;
    let numero = texte(d.numero) ?? texte(d.numero_devis) ?? `DEV-ANCIEN-${id}`;
    if (numeros.has(numero)) {
      const n2 = `${numero}-L${id}`;
      ctx.rapport.anomalie('devis', id, 'numero_doublon', 'attention', `Numéro ${numero} déjà utilisé : importé sous ${n2}.`);
      numero = n2;
    }
    numeros.add(numero);
    ctx.numeros.push({ serie: 'DEV', numero });
    const brut = texte(d.statut) ?? 'brouillon';
    let statut = STATUT_DEVIS[sansAccents(brut).toLowerCase()];
    if (!statut) {
      ctx.rapport.anomalie('devis', id, 'devis_statut_inconnu', 'attention', `Statut « ${brut} » inconnu : importé en brouillon.`);
      statut = 'brouillon';
    }
    const data = decoderJson(d.data_json);
    if (data.invalide) ctx.rapport.anomalie('devis', id, 'devis_json_invalide', 'info', 'data_json n’est pas un JSON valide : conservé tel quel (texte) dans les données d’origine.');
    let machine: Machine | null = normaliserMachine(d.machine_type) ?? normaliserMachine(d.machine);
    if (!machine) {
      machine = deduireMachine(data.valeur, null, null) ?? 'xerox';
      ctx.rapport.anomalie('devis', id, 'machine_inconnue', 'attention', `Machine « ${texte(d.machine_type) ?? ''} » non reconnue : ${machine} retenu, à vérifier.`);
    }
    const nom = texte(d.client_nom);
    const contact = texte(d.client_contact);
    const total = lireMontant(d.prix_final) ?? lireMontant(d.prix_estime);
    let ttc = 0;
    if (total && total.ok) {
      ttc = arrondirFcfa(total.valeur);
      if (ttc !== total.valeur) ctx.rapport.anomalie('devis', id, 'montant_arrondi', 'info', `Prix ${total.valeur} arrondi à ${ttc} FCFA.`);
    } else if (total && !total.ok) {
      ctx.rapport.anomalie('devis', id, 'montant_invalide', 'attention', `Prix illisible (${total.raison}) : total mis à 0, valeur d'origine conservée.`);
    }
    const detail = decoderJson(d.details_prix);
    const notes = [texteLong(d.notes), texteLong(d.commentaire_refus) ? `Motif du refus : ${texteLong(d.commentaire_refus)}` : null].filter(Boolean).join('\n') || null;
    const created = horodatage(d.created_at) ?? ctx.maintenant;
    const legacy = sansCles(d, ['id', 'numero', 'client_nom', 'client_contact', 'client_email', 'notes', 'created_at', 'updated_at']);
    legacy.data_json = data.valeur;
    if (histo.has(id)) {
      legacy.historique = histo.get(id);
      ctx.rapport.table('devis_historique').importes += histo.get(id)!.length;
    }
    lignes.push({
      numero,
      statut,
      machine,
      client_id: nom ? ctx.clients.get(cleClient(nom)) ?? null : null,
      client_nom: nom ?? CLIENT_INCONNU,
      client_telephone: contact && !estEmail(contact) ? contact : null,
      client_email: texte(d.client_email) ?? (contact && estEmail(contact) ? contact.toLowerCase() : null),
      description: texteLong(d.product_type) ?? texteLong(d.details),
      specs: { lignes: [], forfaits: [], legacy },
      detail_prix: estObjet(detail.valeur) ? detail.valeur : null,
      total_ht: ttc,
      tva: 0,
      total_ttc: ttc,
      notes,
      created_by: utilisateur(ctx, d.user_id, 'devis', id, 'Auteur du devis'),
      legacy_id: id,
      created_at: created,
      updated_at: horodatage(d.updated_at) ?? created,
    });
    const dl = resoudreDossier(ctx, d.dossier_id) ?? resoudreDossier(ctx, d.converted_folder_id);
    if (dl !== null) liens.set(id, dl);
    else if (texte(d.dossier_id) || texte(d.converted_folder_id)) {
      ctx.rapport.anomalie('devis', id, 'devis_lien_introuvable', 'info', `Dossier lié (${texte(d.dossier_id) ?? texte(d.converted_folder_id)}) introuvable : devis importé sans lien.`);
    }
  }
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const res = await inserer<{ id: number; legacy_id: number }>(
      ctx.db,
      'devis',
      ['numero', 'statut', 'machine', 'client_id', 'client_nom', 'client_telephone', 'client_email', 'description', 'specs', 'detail_prix', 'total_ht', 'tva', 'total_ttc', 'notes', 'created_by', 'legacy_id', 'created_at', 'updated_at'],
      lignes.slice(i, i + TAILLE_LOT),
      'id, legacy_id',
    );
    for (const r of res) {
      const dl = liens.get(r.legacy_id);
      if (dl === undefined) continue;
      if (ctx.devisParDossier.has(dl)) {
        ctx.rapport.anomalie('devis', r.legacy_id, 'devis_lien_doublon', 'attention', `Le dossier #${dl} est déjà lié à un autre devis : ce devis est importé sans lien vers le dossier.`);
        continue;
      }
      ctx.devisParDossier.set(dl, r.id);
      ctx.devisLegacyVersDossierLegacy.set(r.legacy_id, dl);
    }
  }
  t.importes = lignes.length;
  ctx.log(`Devis : ${lignes.length}`);
}

async function lierDevis(ctx: Ctx) {
  const liens: { id: number; dossier_id: number }[] = [];
  for (const [dl, devisId] of ctx.devisParDossier) {
    const d = ctx.dossiers.get(dl);
    if (d) liens.push({ id: devisId, dossier_id: d.id });
  }
  if (!liens.length) return;
  // Le déclencheur updated_at est suspendu le temps de poser le lien, pour garder les dates d'origine.
  await ctx.db.query('SAVEPOINT lien_devis');
  let sansDeclencheur = true;
  try {
    await ctx.db.query('ALTER TABLE devis DISABLE TRIGGER devis_touch');
  } catch {
    await ctx.db.query('ROLLBACK TO SAVEPOINT lien_devis');
    sansDeclencheur = false;
    ctx.rapport.anomalie('devis', null, 'devis_date_modifiee', 'info', "Droits insuffisants pour suspendre le déclencheur : la date de modification des devis liés à un dossier est celle de l'import.");
  }
  await ctx.db.query(
    `UPDATE devis d SET dossier_id = x.dossier_id FROM jsonb_to_recordset($1::jsonb) AS x(id int, dossier_id int) WHERE d.id = x.id`,
    [JSON.stringify(liens)],
  );
  if (sansDeclencheur) await ctx.db.query('ALTER TABLE devis ENABLE TRIGGER devis_touch');
  await ctx.db.query('RELEASE SAVEPOINT lien_devis');
}

// ---------------------------------------------------------------------------
// Historique : résumé des dates par statut (pour dater validation, impression, livraison)

type ResumeHisto = Map<number, Map<Statut, { premier: string; dernier: string }>>;

async function resumerHistorique(ctx: Ctx): Promise<ResumeHisto> {
  const resume: ResumeHisto = new Map();
  const sources: { table: string; vers: string; date: string }[] = [];
  const src = ctx.src;
  if (src.a('historique_statuts') && src.aColonne('historique_statuts', 'dossier_id') && src.aColonne('historique_statuts', 'nouveau_statut')) {
    const date = src.aColonne('historique_statuts', 'created_at') ? 'created_at' : null;
    if (date) sources.push({ table: 'historique_statuts', vers: 'nouveau_statut', date });
  }
  if (src.a('dossier_status_history') && src.aColonne('dossier_status_history', 'dossier_id')) {
    const vers = src.aColonne('dossier_status_history', 'new_status') ? 'new_status' : src.aColonne('dossier_status_history', 'nouveau_statut') ? 'nouveau_statut' : null;
    const date = src.aColonne('dossier_status_history', 'changed_at') ? 'changed_at' : src.aColonne('dossier_status_history', 'created_at') ? 'created_at' : null;
    if (vers && date) sources.push({ table: 'dossier_status_history', vers, date });
  }
  for (const s of sources) {
    const sql = `SELECT dossier_id::text AS d, ${ident(s.vers)}::text AS s, min(${ident(s.date)})::text AS premier, max(${ident(s.date)})::text AS dernier
                 FROM public.${ident(s.table)} WHERE dossier_id IS NOT NULL AND ${ident(s.date)} IS NOT NULL GROUP BY 1, 2`;
    for await (const lot of src.paquets<{ d: string; s: string; premier: string; dernier: string }>(sql, 5000)) {
      for (const r of lot) {
        const dl = resoudreDossier(ctx, r.d);
        const st = normaliserStatut(r.s);
        if (dl === null || !st) continue;
        let m = resume.get(dl);
        if (!m) resume.set(dl, (m = new Map()));
        const p = horodatage(r.premier)!;
        const d = horodatage(r.dernier)!;
        const e = m.get(st);
        m.set(st, e ? { premier: plusTot(e.premier, p)!, dernier: plusTard(e.dernier, d)! } : { premier: p, dernier: d });
      }
    }
  }
  return resume;
}

// ---------------------------------------------------------------------------
// Dossiers

const COLONNES_DOSSIER = [
  'numero',
  'machine',
  'statut',
  'client_id',
  'client_nom',
  'client_telephone',
  'client_email',
  'description',
  'consignes',
  'specs',
  'montant',
  'montant_source',
  'mode_paiement_prevu',
  'urgent',
  'date_promise',
  'preparateur_id',
  'imprimeur_id',
  'livreur_id',
  'commentaire_revision',
  'date_validation',
  'date_debut_impression',
  'date_fin_impression',
  'livraison_prevue_at',
  'adresse_livraison',
  'notes_livraison',
  'livre_at',
  'termine_at',
  'devis_id',
  'legacy_id',
  'legacy_folder_id',
  'created_at',
  'updated_at',
];

const CLES_PRIX = ['prix', 'prix_total', 'total', 'montant'];

async function importerDossiers(ctx: Ctx, resume: ResumeHisto) {
  const t = ctx.rapport.table('dossiers');
  const total = ctx.idx.size;
  ctx.log(`Dossiers : ${total}`);
  const src = ctx.src;
  // Formulaires agrégés une fois puis joints (pas de sous-requête corrélée : l'ancienne base,
  // en lecture seule, n'a peut-être pas d'index sur dossier_formulaires.dossier_id).
  let sql = `SELECT to_jsonb(d) AS r, NULL::jsonb AS formulaires FROM public.dossiers d ORDER BY d.id`;
  if (src.a('dossier_formulaires') && src.aColonne('dossier_formulaires', 'dossier_id')) {
    const memeType = src.typeColonne('dossier_formulaires', 'dossier_id') === src.typeColonne('dossiers', 'id');
    const ordre = src.aColonne('dossier_formulaires', 'date_saisie') ? 'f.date_saisie' : src.aColonne('dossier_formulaires', 'id') ? 'f.id' : '1';
    sql = `SELECT to_jsonb(d) AS r, f.formulaires
           FROM public.dossiers d
           LEFT JOIN (SELECT f.dossier_id${memeType ? '' : '::text'} AS cle, jsonb_agg(to_jsonb(f) ORDER BY ${ordre}) AS formulaires
                      FROM public.dossier_formulaires f GROUP BY 1) f ON f.cle = d.id${memeType ? '' : '::text'}
           ORDER BY d.id`;
    const tf = ctx.rapport.table('dossier_formulaires');
    tf.lus = await src.compter('dossier_formulaires');
  }
  const numeros = new Set<string>();
  const m = ctx.rapport.data.montants.dossiers;
  let n = 0;
  for await (const lot of src.paquets<{ r: LigneLegacy; formulaires: LigneLegacy[] | null }>(sql, TAILLE_LOT)) {
    const lignes: Record<string, unknown>[] = [];
    const evenements = new Map<number, Record<string, unknown>>();
    const infos = new Map<number, Omit<DossierImporte, 'id'>>();
    for (const { r, formulaires: forms } of lot) {
      t.lus++;
      const id = entier(r.id)!;
      const anomalie = (code: string, gravite: 'info' | 'attention' | 'erreur', message: string, details?: unknown) =>
        ctx.rapport.anomalie('dossiers', id, code, gravite, message, details);

      // Numéro
      const numeroOrigine = texte(r.numero);
      let numero = numeroOrigine ?? texte(r.numero_commande);
      if (!numero) {
        numero = `ANCIEN-${id}`;
        anomalie('numero_vide', 'attention', `Dossier sans numéro : importé sous ${numero}.`);
      }
      if (numeros.has(numero)) {
        const n2 = `${numero}-L${id}`;
        anomalie('numero_doublon', 'attention', `Numéro ${numero} déjà utilisé par un autre dossier : importé sous ${n2}.`);
        numero = n2;
      }
      numeros.add(numero);
      const nc = texte(r.numero_commande);
      if (nc && numeroOrigine && nc !== numeroOrigine) anomalie('numero_commande_divergent', 'info', `numero_commande « ${nc} » différent du numéro « ${numeroOrigine} » (numéro conservé).`);

      // Statut
      const statutBrut = texte(r.statut) ?? texte(r.status);
      let statut = normaliserStatut(statutBrut);
      if (!statut) {
        anomalie('statut_inconnu', 'attention', `Statut « ${statutBrut ?? '(vide)'} » inconnu : importé « en_cours », à vérifier.`);
        statut = 'en_cours';
      }
      ctx.rapport.statut(statutBrut ?? '(vide)', statut);

      // Spécifications d'origine
      const df = decoderJson(r.data_formulaire);
      if (df.doubleEncode) anomalie('data_formulaire_double_encode', 'info', 'data_formulaire était un JSON double-encodé (texte) : décodé.');
      if (df.invalide) anomalie('data_formulaire_invalide', 'info', 'data_formulaire n’est pas un JSON valide : conservé tel quel.');
      const sections = decoderJson(r.sections).valeur;
      const supports = decoderJson(r.supports).valeur;

      // Machine
      const typeBrut = texte(r.type_formulaire) ?? texte(r.type);
      const m1 = normaliserMachine(typeBrut);
      const m2 = normaliserMachine(r.machine);
      let machine = m1 ?? m2;
      if (m1 && m2 && m1 !== m2) anomalie('machine_conflit', 'attention', `type_formulaire « ${typeBrut} » et machine « ${texte(r.machine)} » se contredisent : ${m1} retenu (type_formulaire).`);
      if (!machine) {
        const deduite = deduireMachine(df.valeur, sections, supports);
        const vu = [typeBrut, texte(r.machine)].filter(Boolean).map((v) => `« ${v} »`).join(' / ') || 'absente';
        if (deduite) {
          machine = deduite;
          anomalie('machine_deduite', 'attention', `Machine ${vu} : ${deduite} déduite des spécifications, à vérifier.`);
        } else {
          machine = 'xerox';
          anomalie('machine_inconnue', 'erreur', `Machine ${vu} et spécifications non reconnues : xerox par défaut, À VÉRIFIER (le dossier n'apparaîtra qu'aux imprimeurs Xerox).`);
        }
      }

      // Montant : première source valide parmi montant_cfa, amount, data_formulaire.prix|prix_total|total|montant
      const obj = estObjet(df.valeur) ? df.valeur : {};
      const candidats: [string, unknown][] = [
        ['montant_cfa', r.montant_cfa],
        ['amount', r.amount],
        ...CLES_PRIX.map((k): [string, unknown] => [`data_formulaire.${k}`, obj[k]]),
      ];
      let choisi: { source: string; valeur: number; brut: unknown } | null = null;
      const cfa = lireMontant(r.montant_cfa);
      if (cfa?.ok) m.somme_montant_cfa_ancienne_base += cfa.valeur;
      for (const [source, v] of candidats) {
        const lu = lireMontant(v);
        if (lu === null) continue;
        if (!lu.ok) {
          anomalie('montant_invalide', 'attention', `${source} illisible (${lu.raison}) : ignoré.`);
          continue;
        }
        if (lu.valeur === 0) continue;
        if (lu.texte || lu.note) anomalie('montant_texte', 'info', `${source} saisi en texte « ${String(v)} » : lu ${lu.valeur} FCFA${lu.note ? ` (${lu.note})` : ''}.`);
        choisi = { source, valeur: lu.valeur, brut: v };
        break;
      }
      const amt = lireMontant(r.amount);
      if (cfa?.ok && amt?.ok && cfa.valeur > 0 && amt.valeur > 0 && cfa.valeur !== amt.valeur) {
        anomalie('montant_divergent', 'info', `montant_cfa ${cfa.valeur} ≠ amount ${amt.valeur} : montant_cfa retenu (montant final) ; amount conservé dans l'historique.`);
      }
      let montant: number | null = null;
      if (choisi) {
        montant = arrondirFcfa(choisi.valeur);
        if (montant !== choisi.valeur) anomalie('montant_arrondi', 'info', `${choisi.source} ${choisi.valeur} arrondi à ${montant} FCFA (le FCFA n'a pas de centimes).`);
        m.somme_montants_retenus_avant_arrondi += choisi.valeur;
        m.somme_montants_retenus_arrondis += montant;
        m.ecart_explique_par_arrondis += montant - choisi.valeur;
        m.dossiers_avec_montant++;
        m.sources[choisi.source] = (m.sources[choisi.source] ?? 0) + 1;
      } else {
        m.dossiers_sans_montant++;
        if (statut === 'livre' || statut === 'termine') anomalie('montant_absent', 'info', 'Dossier livré ou terminé sans montant connu.');
      }

      // Client
      const clientNom = texte(r.client) ?? texte(r.client_nom);
      if (!clientNom) anomalie('client_vide', 'attention', `Nom du client vide : « ${CLIENT_INCONNU} » utilisé.`);

      // Dates
      const created = horodatage(r.created_at) ?? horodatage(r.date_reception) ?? ctx.maintenant;
      const updated = horodatage(r.updated_at) ?? created;
      const h = resume.get(id);
      const ferme = statut === 'livre' || statut === 'termine';
      const histoLivre = h?.get('livre')?.dernier ?? null;
      const dateValidation =
        horodatage(r.date_validation_preparateur) ?? (statut !== 'en_cours' ? (h?.get('pret_impression')?.premier ?? null) : null);
      const livreAt = ferme ? (preciserDate(horodatage(r.date_livraison_reelle), [histoLivre, updated]) ?? histoLivre ?? updated) : null;
      const termineAt = statut === 'termine' ? (h?.get('termine')?.dernier ?? updated) : null;

      // Commentaires
      const revision = texteLong(r.commentaire_revision) ?? texteLong(r.revision_comment) ?? (statut === 'a_revoir' ? texteLong(r.commentaire) : null);
      const consignes = [...new Set([texteLong(r.commentaires), texteLong(r.commentaire)])].filter((c): c is string => !!c && c !== revision);
      const report = texteLong(r.commentaire_report);
      const notesLivraison = [texteLong(r.notes_livraison), report ? `Report : ${report}` : null].filter(Boolean).join('\n') || null;

      // Paiement prévu
      const mf = normaliserMode(r.mode_paiement_final);
      const mp = normaliserMode(r.mode_paiement);
      const modePrevu = mf.mode ?? mp.mode;
      if (!modePrevu && (mf.inconnu || mp.inconnu)) anomalie('mode_paiement_inconnu', 'info', `Mode de paiement « ${texte(r.mode_paiement) ?? texte(r.mode_paiement_final)} » non reconnu : non repris (valeur conservée dans l'historique).`);

      // folder_id
      const folder = texte(r.folder_id);
      if (folder && !estUuid(folder)) anomalie('folder_id_invalide', 'info', `folder_id « ${folder} » n'est pas un UUID : conservé seulement dans l'historique.`);

      const urgent = booleen(r.urgent) ?? false;
      lignes.push({
        numero,
        machine,
        statut,
        client_id: clientNom ? ctx.clients.get(cleClient(clientNom)) ?? null : null,
        client_nom: clientNom ?? CLIENT_INCONNU,
        client_telephone: texte(r.telephone_client) ?? texte(r.client_telephone),
        client_email: texte(r.client_email)?.toLowerCase() ?? null,
        description: texteLong(r.description),
        consignes: consignes.length ? consignes.join('\n\n') : null,
        specs: {
          lignes: [],
          forfaits: [],
          legacy: {
            data_formulaire: df.valeur ?? null,
            sections: sections ?? null,
            supports: supports ?? null,
            ...(forms && forms.length ? { formulaires: forms } : {}),
          },
        },
        montant,
        montant_source: montant === null ? null : 'import',
        mode_paiement_prevu: modePrevu,
        urgent: urgent && !ferme,
        date_promise: jourDe(horodatage(r.date_livraison)),
        preparateur_id: utilisateur(ctx, r.preparateur_id ?? r.created_by, 'dossiers', id, 'Préparateur'),
        imprimeur_id: utilisateur(ctx, r.imprimeur_id, 'dossiers', id, 'Imprimeur'),
        livreur_id: utilisateur(ctx, r.livreur_id, 'dossiers', id, 'Livreur'),
        commentaire_revision: revision,
        date_validation: dateValidation,
        date_debut_impression: h?.get('en_impression')?.premier ?? null,
        date_fin_impression: h?.get('pret_livraison')?.premier ?? null,
        livraison_prevue_at: horodatage(r.date_livraison_prevue),
        adresse_livraison: texteLong(r.adresse_livraison),
        notes_livraison: notesLivraison,
        livre_at: livreAt,
        termine_at: termineAt,
        devis_id: ctx.devisParDossier.get(id) ?? null,
        legacy_id: id,
        legacy_folder_id: folder && estUuid(folder) ? folder : null,
        created_at: created,
        updated_at: updated,
      });
      evenements.set(id, {
        type: 'import',
        action: ACTION_IMPORT,
        commentaire: "Importé de l'ancienne plateforme",
        data: {
          legacy_id: id,
          folder_id: folder,
          numero_origine: numeroOrigine,
          statut_origine: statutBrut,
          machine_origine: { type_formulaire: typeBrut, machine: texte(r.machine) },
          montant_origine: choisi ? { source: choisi.source, valeur: choisi.brut } : null,
          colonnes: sansCles(r, ['data_formulaire', 'sections', 'supports']),
        },
      });
      const sp = sansAccents(texte(r.statut_paiement) ?? '').toLowerCase();
      infos.set(id, { numero, montant, statut, clientNom: clientNom ?? CLIENT_INCONNU, payeAncien: sp === 'paye' || sp === 'approuve_admin' || sp === 'encaisse' });
      ctx.numeros.push({ serie: 'CMD', numero });
    }
    const res = await inserer<{ id: number; legacy_id: number }>(ctx.db, 'dossiers', COLONNES_DOSSIER, lignes, 'id, legacy_id');
    const evts: Record<string, unknown>[] = [];
    for (const x of res) {
      ctx.dossiers.set(x.legacy_id, { id: x.id, ...infos.get(x.legacy_id)! });
      evts.push({ dossier_id: x.id, ...evenements.get(x.legacy_id)! });
    }
    await inserer(ctx.db, 'dossier_events', ['dossier_id', 'type', 'action', 'commentaire', 'data'], evts);
    t.importes += res.length;
    if (ctx.rapport.data.tables.dossier_formulaires) {
      ctx.rapport.data.tables.dossier_formulaires.importes += lot.reduce((s, l) => s + (l.formulaires?.length ?? 0), 0);
    }
    n += lot.length;
    progression(ctx, 'dossiers', n, total);
  }
}

// ---------------------------------------------------------------------------
// Historique des statuts et journal d'activité → dossier_events

const LIBELLE_ACTION: Record<string, string> = {
  created: 'Dossier créé (ancienne plateforme)',
  updated: 'Dossier modifié (ancienne plateforme)',
  status_changed: 'Changement de statut (ancienne plateforme)',
  file_uploaded: 'Fichier(s) ajouté(s) (ancienne plateforme)',
  file_deleted: 'Fichier supprimé (ancienne plateforme)',
  deleted: 'Dossier supprimé (ancienne plateforme)',
};

async function importerHistorique(ctx: Ctx) {
  const lot: Record<string, unknown>[] = [];
  const vider = async () => {
    await inserer(ctx.db, 'dossier_events', ['dossier_id', 'type', 'action', 'de_statut', 'vers_statut', 'user_id', 'commentaire', 'data', 'created_at'], lot.splice(0));
  };
  const transition = (
    table: string,
    r: LigneLegacy,
    o: { dossier: unknown; de: unknown; vers: unknown; user: unknown; commentaire: string | null; date: unknown },
  ) => {
    const t = ctx.rapport.table(table);
    t.lus++;
    const dl = resoudreDossier(ctx, o.dossier);
    const d = dl !== null ? ctx.dossiers.get(dl) : undefined;
    if (!d) {
      t.ignores++;
      ctx.rapport.anomalie(table, r.id, 'historique_orphelin', 'info', `Dossier « ${String(o.dossier)} » inexistant (supprimé) : entrée non importée, conservée ici.`, r);
      return;
    }
    const de = normaliserStatut(o.de);
    const vers = normaliserStatut(o.vers);
    if (!vers) ctx.rapport.anomalie(table, r.id, 'historique_statut_inconnu', 'info', `Statut « ${texte(o.vers) ?? '(vide)'} » inconnu : entrée importée comme note d'import.`);
    const estTransition = !!vers && de !== vers;
    lot.push({
      dossier_id: d.id,
      type: estTransition ? 'statut' : 'import',
      action: estTransition ? null : 'historique',
      de_statut: estTransition ? de : null,
      vers_statut: estTransition ? vers : null,
      user_id: utilisateur(ctx, o.user, table, r.id, 'Auteur'),
      commentaire: o.commentaire,
      data: { source: table, legacy_id: r.id ?? null, de: texte(o.de), vers: texte(o.vers) },
      created_at: horodatage(o.date) ?? ctx.maintenant,
    });
    t.importes++;
  };

  if (ctx.src.a('historique_statuts')) {
    const total = await ctx.src.compter('historique_statuts');
    let n = 0;
    for await (const rows of ctx.src.lignes('historique_statuts')) {
      for (const r of rows) {
        transition('historique_statuts', r, {
          dossier: r.dossier_id,
          de: r.ancien_statut,
          vers: r.nouveau_statut,
          user: r.user_id,
          commentaire: texteLong(r.commentaire),
          date: r.created_at,
        });
      }
      await vider();
      n += rows.length;
      progression(ctx, 'historique_statuts', n, total);
    }
  }
  if (ctx.src.a('dossier_status_history')) {
    const total = await ctx.src.compter('dossier_status_history');
    let n = 0;
    for await (const rows of ctx.src.lignes('dossier_status_history')) {
      for (const r of rows) {
        const commentaires = [texteLong(r.comment), texteLong(r.commentaire), texteLong(r.notes)].filter(Boolean);
        transition('dossier_status_history', r, {
          dossier: r.dossier_id ?? r.folder_id,
          de: r.old_status ?? r.ancien_statut,
          vers: r.new_status ?? r.nouveau_statut,
          user: r.changed_by ?? r.user_id,
          commentaire: commentaires.length ? [...new Set(commentaires)].join(' — ') : null,
          date: r.changed_at ?? r.created_at,
        });
      }
      await vider();
      n += rows.length;
      progression(ctx, 'dossier_status_history', n, total);
    }
  }
  if (ctx.src.a('dossier_activity_log')) {
    const t = ctx.rapport.table('dossier_activity_log');
    const total = await ctx.src.compter('dossier_activity_log');
    let n = 0;
    for await (const rows of ctx.src.lignes('dossier_activity_log')) {
      for (const r of rows) {
        t.lus++;
        const dl = resoudreDossier(ctx, r.dossier_id ?? r.folder_id);
        const d = dl !== null ? ctx.dossiers.get(dl) : undefined;
        const details = decoderJson(r.details).valeur;
        if (!d) {
          t.ignores++;
          ctx.rapport.anomalie('dossier_activity_log', r.id, 'journal_orphelin', 'info', `Entrée « ${texte(r.action)} » d'un dossier inexistant (${String(r.dossier_id)}, supprimé) : non importée, conservée ici.`, { ...r, details });
          continue;
        }
        const action = texte(r.action) ?? 'inconnue';
        const det = estObjet(details) ? details : {};
        const vers = action === 'status_changed' ? normaliserStatut(det.new_status ?? det.nouveau_statut) : null;
        const de = action === 'status_changed' ? normaliserStatut(det.old_status ?? det.ancien_statut) : null;
        const estTransition = !!vers && vers !== de;
        lot.push({
          dossier_id: d.id,
          type: estTransition ? 'statut' : 'import',
          action: estTransition ? null : action,
          de_statut: estTransition ? de : null,
          vers_statut: estTransition ? vers : null,
          user_id: utilisateur(ctx, r.user_id, 'dossier_activity_log', r.id, 'Auteur'),
          commentaire: estTransition ? (texteLong(det.commentaire) ?? null) : (LIBELLE_ACTION[action] ?? `Ancienne plateforme : ${action}`),
          data: { source: 'dossier_activity_log', legacy_id: r.id ?? null, action, details },
          created_at: horodatage(r.created_at) ?? ctx.maintenant,
        });
        t.importes++;
      }
      await vider();
      n += rows.length;
      progression(ctx, 'dossier_activity_log', n, total);
    }
  }
  await vider();

  // Une même transition peut avoir été écrite dans plusieurs tables (ou deux fois) : on fusionne
  // les doublons exacts (même dossier, même statut d'arrivée, à 5 s près, sans commentaire propre).
  // Jointure par hachage sur (dossier, statut) : coût linéaire, même sur des centaines de milliers
  // d'entrées (les statistiques sont rafraîchies juste avant, la table vient d'être remplie).
  await analyser(ctx, 'dossier_events');
  const rang = (e: string) => `CASE ${e}.data->>'source' WHEN 'historique_statuts' THEN 1 WHEN 'dossier_status_history' THEN 2 ELSE 3 END`;
  await ctx.db.query('SET LOCAL enable_nestloop = off');
  const doublons = await ctx.db.query<{ source: string; n: number }>(
    `WITH sup AS (
       DELETE FROM dossier_events a USING dossier_events b
       WHERE a.type = 'statut' AND a.data ? 'source' AND b.type = 'statut' AND b.data ? 'source'
         AND b.dossier_id = a.dossier_id AND b.vers_statut = a.vers_statut AND b.id <> a.id
         AND b.created_at BETWEEN a.created_at - interval '5 seconds' AND a.created_at + interval '5 seconds'
         AND (${rang('b')} < ${rang('a')} OR (${rang('b')} = ${rang('a')} AND b.id < a.id))
         AND (a.commentaire IS NULL OR a.commentaire = b.commentaire)
       RETURNING a.data->>'source' AS source)
     SELECT source, count(*)::int AS n FROM sup GROUP BY source`,
  );
  await ctx.db.query('SET LOCAL enable_nestloop = on');
  await analyser(ctx, 'dossier_events');
  for (const d of doublons.rows) {
    const t = ctx.rapport.table(d.source);
    t.importes -= d.n;
    t.ignores += d.n;
    ctx.rapport.anomalie(d.source, null, 'historique_doublon', 'info', `${d.n} changement(s) de statut déjà présent(s) dans une autre table d'historique : fusionné(s).`);
  }
}

// ---------------------------------------------------------------------------
// Fichiers

interface FichierACopier {
  legacyId: number | null;
  dossierId: number;
  dossierLegacyId: number;
  dossierNumero: string;
  src: string;
  taille: number;
  tailleDeclaree: number | null;
  nom: string;
  mime: string;
  uploadedBy: number | null;
  createdAt: string;
  checksum: string | null;
}

async function importerFichiers(ctx: Ctx) {
  const t = ctx.rapport.table('fichiers');
  const fr = ctx.rapport.data.fichiers;
  const aCopier: FichierACopier[] = [];
  const manquantsParDossier = new Map<number, FichierManquant[]>();
  const sourcesVues = new Map<string, number | null>();
  const manquant = (m: FichierManquant, dossierId: number | null) => {
    fr.manquants.push(m);
    fr.octets_manquants_declares += m.taille_declaree ?? 0;
    if (dossierId !== null) {
      const l = manquantsParDossier.get(dossierId);
      if (l) l.push(m);
      else manquantsParDossier.set(dossierId, [m]);
    }
  };

  if (ctx.src.a('fichiers')) {
    const total = await ctx.src.compter('fichiers');
    ctx.log(`Fichiers : ${total} ligne(s) à rapprocher du disque`);
    for await (const rows of ctx.src.lignes('fichiers')) {
      for (const r of rows) {
        t.lus++;
        const legacyId = entier(r.id);
        const dl = resoudreDossier(ctx, r.dossier_id ?? r.folder_id);
        const d = dl !== null ? ctx.dossiers.get(dl) : undefined;
        const chemins = [r.chemin_stockage, r.chemin, r.file_path, r.filepath, r.path].map(texte).filter((c): c is string => !!c);
        const nomsStockes = [r.nom_fichier, r.filename, r.stored_filename].map(texte).filter((c): c is string => !!c);
        const nomsOriginaux = [r.nom_original, r.nom, r.original_filename, r.original_name].map(texte).filter((c): c is string => !!c);
        const noms = [...nomsStockes, ...chemins.map((c) => path.basename(c.replace(/\\/g, '/'))), ...nomsOriginaux];
        const folderId = dl !== null ? (ctx.idx.get(dl)?.folderId ?? null) : estUuid(r.folder_id) ? String(r.folder_id) : null;
        const tailleDeclaree = entier(r.taille_bytes) ?? entier(r.taille) ?? entier(r.size) ?? entier(r.file_size);
        let nom = nomsOriginaux[0] ?? sansHorodatage(nomsStockes[0] ?? (chemins[0] ? path.basename(chemins[0]) : 'fichier'));
        const repare = reparerMojibake(nom);
        if (repare) {
          ctx.rapport.anomalie('fichiers', legacyId, 'nom_repare', 'info', `Nom mal encodé « ${nom} » corrigé en « ${repare} ».`);
          nom = repare;
        }
        nom = nom.normalize('NFC');
        const res = resoudre(ctx.index, { legacyId, dossierLegacyId: dl, folderId, chemins, noms });
        if (!d) {
          t.ignores++;
          ctx.rapport.anomalie('fichiers', legacyId, 'fichier_sans_dossier', 'attention', `Rattaché au dossier « ${String(r.dossier_id)} » qui n'existe pas : non importé${res.src ? ` (le fichier ${ctx.index.relatif(res.cle!)} reste listé parmi les orphelins)` : ''}.`, r);
          continue;
        }
        if (!res.src) {
          t.ignores++;
          manquant(
            { legacy_id: legacyId, dossier_legacy_id: dl, dossier_numero: d.numero, nom, chemins_base: chemins, taille_declaree: tailleDeclaree, raison: res.raison ?? 'introuvable' },
            d.id,
          );
          ctx.rapport.anomalie('fichiers', legacyId, 'fichier_manquant', 'attention', `« ${nom} » (dossier ${d.numero}) ${res.raison} ; chemin en base : ${chemins.join(' | ') || '(aucun)'}.`);
          continue;
        }
        ctx.index.utilises.add(res.cle!);
        if (sourcesVues.has(res.cle!)) {
          ctx.rapport.anomalie('fichiers', legacyId, 'fichier_partage', 'info', `Même fichier physique que la ligne #${sourcesVues.get(res.cle!)} : copié une seconde fois.`);
        }
        sourcesVues.set(res.cle!, legacyId);
        fr.par_regle[res.regle!] = (fr.par_regle[res.regle!] ?? 0) + 1;
        const typeBrut = texte(r.type);
        const mime = texte(r.type_mime) ?? texte(r.mime_type) ?? texte(r.mimetype) ?? (typeBrut && typeBrut.includes('/') ? typeBrut : null) ?? mimeDepuisNom(nom) ?? 'application/octet-stream';
        aCopier.push({
          legacyId,
          dossierId: d.id,
          dossierLegacyId: dl!,
          dossierNumero: d.numero,
          src: res.src,
          taille: res.taille,
          tailleDeclaree,
          nom,
          mime,
          uploadedBy: utilisateur(ctx, r.uploaded_by ?? r.uploade_par, 'fichiers', legacyId, 'Déposé par'),
          createdAt: horodatage(r.created_at) ?? horodatage(r.uploaded_at) ?? horodatage(r.date_upload) ?? ctx.maintenant,
          checksum: texte(r.checksum)?.toLowerCase() ?? null,
        });
      }
    }
  }

  // Espace disque
  const besoin = aCopier.reduce((s, f) => s + f.taille, 0);
  const libre = await espaceLibre(ctx.opts.storageDir);
  fr.espace_libre_cible = libre;
  if (libre !== null && besoin > libre * 0.98) {
    const msg = `Espace disque insuffisant dans ${ctx.opts.storageDir} : ${octets(besoin)} à copier, ${octets(libre)} libres.`;
    if (!ctx.opts.dryRun) throw new Error(msg);
    ctx.rapport.anomalie('fichiers', null, 'espace_insuffisant', 'erreur', msg);
  }
  if (ctx.opts.dryRun) {
    fr.simulation_a_copier = aCopier.length;
    fr.simulation_octets_a_copier = besoin;
    ctx.log(`  ${aCopier.length} fichier(s) seraient copiés (${octets(besoin)}) ; simulation : aucune copie.`);
  } else {
    ctx.log(`  Copie de ${aCopier.length} fichier(s) (${octets(besoin)}) vers ${ctx.opts.storageDir}…`);
  }

  let faits = 0;
  let octetsFaits = 0;
  for (let i = 0; i < aCopier.length; i += TAILLE_LOT) {
    const lot = aCopier.slice(i, i + TAILLE_LOT);
    const lignes: Record<string, unknown>[] = [];
    await enParallele(lot, ctx.opts.copiesSimultanees, async (f) => {
      const nomFichier = `${crypto.randomUUID()}-${nomSurDisque(f.nom)}`;
      const rel = path.join('dossiers', String(f.dossierId), nomFichier);
      let taille = f.taille;
      let sha256: string | null = null;
      if (!ctx.opts.dryRun) {
        const dest = path.join(ctx.opts.storageDir, rel);
        await ctx.suivi.preparerRepertoire(path.dirname(dest));
        ctx.suivi.ajouter(dest);
        try {
          const c = await copierAvecEmpreinte(f.src, dest);
          taille = c.taille;
          sha256 = c.sha256;
        } catch (err) {
          await fs.promises.rm(dest, { force: true }).catch(() => {});
          const e = err as NodeJS.ErrnoException;
          if (e.path !== f.src) throw err; // écriture impossible côté v2 : erreur fatale, tout est annulé
          t.ignores++;
          const m: FichierManquant = {
            legacy_id: f.legacyId,
            dossier_legacy_id: f.dossierLegacyId,
            dossier_numero: f.dossierNumero,
            nom: f.nom,
            chemins_base: [f.src],
            taille_declaree: f.tailleDeclaree,
            raison: `illisible (${e.code ?? e.message})`,
          };
          fr.manquants.push(m);
          fr.octets_manquants_declares += f.tailleDeclaree ?? 0;
          const l = manquantsParDossier.get(f.dossierId);
          if (l) l.push(m);
          else manquantsParDossier.set(f.dossierId, [m]);
          ctx.rapport.anomalie('fichiers', f.legacyId, 'fichier_illisible', 'attention', `« ${f.nom} » (dossier ${f.dossierNumero}) illisible : ${e.code ?? e.message}.`);
          return;
        }
        fr.copies++;
        fr.octets_copies += taille;
        octetsFaits += taille;
        if (f.checksum && /^[0-9a-f]{64}$/.test(f.checksum) && f.checksum !== sha256) {
          ctx.rapport.anomalie('fichiers', f.legacyId, 'checksum_different', 'attention', `« ${f.nom} » : SHA-256 du fichier (${sha256}) différent de celui enregistré (${f.checksum}). Fichier importé tel qu'il est sur le disque.`);
        }
      }
      if (f.tailleDeclaree !== null && f.tailleDeclaree !== taille) {
        ctx.rapport.anomalie('fichiers', f.legacyId, 'taille_differente', 'info', `« ${f.nom} » : ${taille} octets sur le disque, ${f.tailleDeclaree} déclarés en base.`);
      }
      lignes.push({
        dossier_id: f.dossierId,
        nom_original: f.nom,
        chemin: rel,
        mime: f.mime,
        taille,
        sha256,
        uploaded_by: f.uploadedBy,
        legacy_id: f.legacyId,
        created_at: f.createdAt,
      });
    });
    await inserer(ctx.db, 'fichiers', ['dossier_id', 'nom_original', 'chemin', 'mime', 'taille', 'sha256', 'uploaded_by', 'legacy_id', 'created_at'], lignes);
    t.importes += lignes.length;
    faits += lot.length;
    if (faits % TAILLE_LOT === 0 || faits === aCopier.length) {
      ctx.log(`  fichiers : ${faits} / ${aCopier.length}${ctx.opts.dryRun ? '' : ` (${octets(octetsFaits)})`}`);
    }
  }

  // Les métadonnées des fichiers manquants restent visibles dans l'historique du dossier.
  if (manquantsParDossier.size) {
    await ctx.db.query(
      `UPDATE dossier_events e SET data = coalesce(e.data, '{}'::jsonb) || jsonb_build_object('fichiers_manquants', x.f)
       FROM jsonb_to_recordset($1::jsonb) AS x(dossier_id int, f jsonb)
       WHERE e.dossier_id = x.dossier_id AND e.type = 'import' AND e.action = $2`,
      [JSON.stringify([...manquantsParDossier].map(([dossier_id, f]) => ({ dossier_id, f }))), ACTION_IMPORT],
    );
  }

  for (const o of ctx.index.orphelins()) {
    const chemin = ctx.index.relatif(o.cle);
    fr.orphelins.push({ chemin, taille: o.entree.taille, categorie: categorieOrphelin(o.entree.reel) });
    fr.octets_orphelins += o.entree.taille;
  }
}

/**
 * Même convention que les envois v2 (nomDisque), avec en plus une limite en OCTETS : les systèmes de
 * fichiers limitent un nom à 255 octets et un nom accentué de 180 caractères peut les dépasser.
 */
function nomSurDisque(nom: string): string {
  const n = nomDisque(nom);
  if (Buffer.byteLength(n) <= 200) return n;
  const ext = path.extname(n).length <= 16 ? path.extname(n) : '';
  const base = Array.from(n.slice(0, n.length - ext.length));
  while (base.length && Buffer.byteLength(base.join('') + ext) > 200) base.pop();
  return base.join('') + ext;
}

async function espaceLibre(dir: string): Promise<number | null> {
  let d = path.resolve(dir);
  while (!fs.existsSync(d)) {
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
  try {
    const s = await fs.promises.statfs(d);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Factures

async function importerFactures(ctx: Ctx) {
  const t = ctx.rapport.table('factures');
  const mf = ctx.rapport.data.montants.factures;
  const numeros = new Set<string>();
  const emises = new Set<number>();
  const lignes: Record<string, unknown>[] = [];
  const extras = new Map<number, unknown[]>();
  const legacyParLigne: number[] = [];
  for (const f of ctx.facturesRows) {
    t.lus++;
    const id = entier(f.id)!;
    const anomalie = (code: string, gravite: 'info' | 'attention' | 'erreur', message: string, details?: unknown) =>
      ctx.rapport.anomalie('factures', id, code, gravite, message, details);
    const ttcLu = lireMontant(f.montant_ttc);
    if (ttcLu?.ok) mf.somme_ttc_ancienne_base += ttcLu.valeur;
    const devisLegacy = entier(f.devis_id);
    const dl = resoudreDossier(ctx, f.dossier_id) ?? (devisLegacy !== null ? (ctx.devisLegacyVersDossierLegacy.get(devisLegacy) ?? null) : null);
    const d = dl !== null ? ctx.dossiers.get(dl) : undefined;
    if (!d) {
      t.ignores++;
      if (ttcLu?.ok) mf.somme_ttc_ignoree += ttcLu.valeur;
      anomalie('facture_sans_dossier', 'erreur', `Facture ${texte(f.numero) ?? id} : dossier « ${texte(f.dossier_id) ?? '(vide)'} » introuvable. Non importée (la v2 exige un dossier) : à ressaisir ou rattacher à la main.`, f);
      continue;
    }
    if (!ttcLu || !ttcLu.ok) {
      t.ignores++;
      anomalie('facture_montant_invalide', 'erreur', `Facture ${texte(f.numero) ?? id} : montant TTC illisible (${ttcLu && !ttcLu.ok ? ttcLu.raison : 'absent'}). Non importée.`, f);
      continue;
    }
    let numero = texte(f.numero) ?? `FAC-ANCIEN-${id}`;
    if (numeros.has(numero)) {
      const n2 = `${numero}-L${id}`;
      anomalie('numero_doublon', 'erreur', `Numéro de facture ${numero} en double : importée sous ${n2}. À régulariser avec le comptable.`);
      numero = n2;
    }
    numeros.add(numero);
    const ttc = arrondirFcfa(ttcLu.valeur);
    const htLu = lireMontant(f.montant_ht);
    const tvaLu = lireMontant(f.montant_tva);
    const ht = htLu?.ok ? arrondirFcfa(htLu.valeur) : ttc;
    let tva = tvaLu?.ok ? arrondirFcfa(tvaLu.valeur) : ttc - ht;
    if (ht + tva !== ttc) {
      anomalie('facture_totaux', 'info', `HT ${htLu?.ok ? htLu.valeur : '?'} + TVA ${tvaLu?.ok ? tvaLu.valeur : '?'} ≠ TTC ${ttcLu.valeur} après arrondi : TVA recalculée = TTC − HT (${ttc - ht}).`);
      tva = ttc - ht;
    }
    if (ttc !== ttcLu.valeur) anomalie('montant_arrondi', 'info', `TTC ${ttcLu.valeur} arrondi à ${ttc} FCFA.`);
    const statutBrut = sansAccents(texte(f.statut_paiement) ?? '').toLowerCase();
    let statut: 'emise' | 'annulee' = statutBrut === 'annule' || sansAccents(texte(f.statut) ?? '').toLowerCase().startsWith('annul') ? 'annulee' : 'emise';
    let motif: string | null = statut === 'annulee' ? "Annulée dans l'ancienne plateforme" : null;
    if (statut === 'emise' && emises.has(d.id)) {
      statut = 'annulee';
      motif = "Import : seconde facture émise pour ce dossier dans l'ancienne plateforme (la v2 n'en admet qu'une) — à vérifier";
      anomalie('facture_doublon_dossier', 'attention', `Le dossier ${d.numero} a déjà une facture émise : ${numero} importée comme annulée, à vérifier.`);
    }
    if (statut === 'emise') emises.add(d.id);
    const created = horodatage(f.created_at) ?? ctx.maintenant;
    const contact = texte(f.client_contact);
    const clientNom = texte(f.client_nom) ?? d.clientNom;
    lignes.push({
      numero,
      statut,
      dossier_id: d.id,
      client_id: ctx.clients.get(cleClient(clientNom)) ?? null,
      client_nom: clientNom,
      client_telephone: contact && !estEmail(contact) ? contact : null,
      client_adresse: texteLong(f.client_adresse),
      lignes: [
        {
          designation: `Dossier ${d.numero}`,
          detail: "Facture reprise de l'ancienne plateforme",
          quantite: 1,
          unite: null,
          prix_unitaire: ht,
          total: ht,
        },
      ],
      total_ht: ht,
      tva_taux: ht > 0 && tva > 0 ? Math.round((tva / ht) * 10000) / 100 : 0,
      tva,
      total_ttc: ttc,
      date_emission: jourDe(created),
      annulee_at: statut === 'annulee' ? (horodatage(f.updated_at) ?? created) : null,
      motif_annulation: motif,
      created_by: utilisateur(ctx, f.user_id, 'factures', id, 'Auteur de la facture'),
      legacy_id: id,
      created_at: created,
    });
    legacyParLigne.push(dl!);
    mf.somme_ttc_importee += ttc;
    ctx.factures.set(id, dl!);
    ctx.numeros.push({ serie: 'FAC', numero });
    const ex = extras.get(d.id) ?? [];
    ex.push({
      legacy_id: id,
      numero,
      pdf_path: texte(f.pdf_path),
      mode_paiement: texte(f.mode_paiement),
      statut_paiement: texte(f.statut_paiement),
      date_paiement: texte(f.date_paiement),
      notes: texteLong(f.notes),
      details_json: decoderJson(f.details_json).valeur ?? null,
    });
    extras.set(d.id, ex);
  }
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    await inserer(
      ctx.db,
      'factures',
      ['numero', 'statut', 'dossier_id', 'client_id', 'client_nom', 'client_telephone', 'client_adresse', 'lignes', 'total_ht', 'tva_taux', 'tva', 'total_ttc', 'date_emission', 'annulee_at', 'motif_annulation', 'created_by', 'legacy_id', 'created_at'],
      lignes.slice(i, i + TAILLE_LOT),
    );
  }
  t.importes = lignes.length;
  if (extras.size) {
    await ctx.db.query(
      `UPDATE dossier_events e SET data = coalesce(e.data, '{}'::jsonb) || jsonb_build_object('factures_ancienne_plateforme', x.f)
       FROM jsonb_to_recordset($1::jsonb) AS x(dossier_id int, f jsonb)
       WHERE e.dossier_id = x.dossier_id AND e.type = 'import' AND e.action = $2`,
      [JSON.stringify([...extras].map(([dossier_id, f]) => ({ dossier_id, f }))), ACTION_IMPORT],
    );
  }
  ctx.log(`Factures : ${lignes.length} / ${ctx.facturesRows.length}`);
}

// ---------------------------------------------------------------------------
// Paiements

async function importerPaiements(ctx: Ctx) {
  if (!ctx.src.a('paiements')) return;
  const t = ctx.rapport.table('paiements');
  const mp = ctx.rapport.data.montants.paiements;
  const total = await ctx.src.compter('paiements');
  ctx.log(`Paiements : ${total}`);
  let n = 0;
  for await (const rows of ctx.src.lignes('paiements')) {
    const lignes: Record<string, unknown>[] = [];
    for (const p of rows) {
      t.lus++;
      const id = entier(p.id);
      const anomalie = (code: string, gravite: 'info' | 'attention' | 'erreur', message: string, details?: unknown) =>
        ctx.rapport.anomalie('paiements', id, code, gravite, message, details);
      const lu = lireMontant(p.montant);
      if (lu?.ok) mp.somme_ancienne_base += lu.valeur;
      const ignorer = (code: string, message: string) => {
        t.ignores++;
        if (lu?.ok) mp.somme_ignoree += lu.valeur;
        anomalie(code, 'attention', message, p);
      };
      const factureId = entier(p.facture_id);
      const dl = resoudreDossier(ctx, p.dossier_id) ?? (factureId !== null ? (ctx.factures.get(factureId) ?? null) : null);
      const d = dl !== null ? ctx.dossiers.get(dl) : undefined;
      if (!d) {
        ignorer('paiement_sans_dossier', `Paiement de ${lu?.ok ? lu.valeur : '?'} FCFA rattaché à aucun dossier existant (dossier « ${String(p.dossier_id ?? '')} », facture « ${String(p.facture_id ?? '')} ») : non importé.`);
        continue;
      }
      if (!lu || !lu.ok || arrondirFcfa(lu.valeur) <= 0) {
        ignorer('paiement_montant_invalide', `Montant « ${String(p.montant ?? '')} » (dossier ${d.numero}) nul, négatif ou illisible : non importé.`);
        continue;
      }
      const montant = arrondirFcfa(lu.valeur);
      if (montant !== lu.valeur) anomalie('montant_arrondi', 'info', `Montant ${lu.valeur} arrondi à ${montant} FCFA.`);
      const statutBrut = texte(p.statut);
      let statut = normaliserStatutPaiement(statutBrut);
      if (!statut) {
        statut = 'a_valider';
        anomalie('paiement_statut_inconnu', 'attention', `Statut « ${statutBrut ?? '(vide)'} » inconnu (dossier ${d.numero}) : importé « à valider » pour contrôle par un administrateur.`);
      }
      const mf = normaliserMode(p.mode_paiement_final);
      const mm = normaliserMode(p.mode_paiement);
      let mode = mf.mode ?? mm.mode;
      if (!mode) {
        mode = 'especes';
        const vu = texte(p.mode_paiement) ?? texte(p.mode_paiement_final);
        anomalie('paiement_mode_inconnu', vu ? 'attention' : 'info', `Mode de paiement « ${vu ?? '(vide)'} » non reconnu (dossier ${d.numero}) : « especes » retenu, à vérifier.`);
      }
      const admin = [texteLong(p.notes_admin), texteLong(p.commentaire_admin)].filter(Boolean);
      const notes = [
        texteLong(p.notes),
        ...[...new Set(admin)].map((a) => `Note admin : ${a}`),
        texte(p.photo_recu_path) ? `Reçu (ancienne plateforme) : ${texte(p.photo_recu_path)}` : null,
      ].filter(Boolean);
      const created = horodatage(p.created_at) ?? ctx.maintenant;
      const updated = horodatage(p.updated_at) ?? created;
      lignes.push({
        dossier_id: d.id,
        montant,
        mode,
        reference: texte(p.reference_paiement) ?? texte(p.reference_transaction) ?? texte(p.reference),
        statut,
        notes: notes.length ? notes.join(' | ') : null,
        encaisse_par: utilisateur(ctx, p.livreur_id ?? p.user_id, 'paiements', id, 'Encaissé par'),
        encaisse_at: horodatage(p.date_encaissement) ?? horodatage(p.date_paiement) ?? created,
        valide_par:
          statut === 'valide'
            ? utilisateur(ctx, p.approuve_par, 'paiements', id, 'Validé par')
            : statut === 'refuse'
              ? utilisateur(ctx, p.refuse_par, 'paiements', id, 'Refusé par')
              : null,
        valide_at: statut === 'valide' ? (horodatage(p.date_approbation) ?? updated) : statut === 'refuse' ? (horodatage(p.date_refus) ?? updated) : null,
        motif_refus: statut === 'refuse' ? (texteLong(p.raison_refus) ?? "Refusé dans l'ancienne plateforme") : null,
        legacy_id: id,
        created_at: created,
      });
      mp.somme_importee += montant;
      mp.par_statut_v2[statut] = (mp.par_statut_v2[statut] ?? 0) + montant;
    }
    await inserer(
      ctx.db,
      'paiements',
      ['dossier_id', 'montant', 'mode', 'reference', 'statut', 'notes', 'encaisse_par', 'encaisse_at', 'valide_par', 'valide_at', 'motif_refus', 'legacy_id', 'created_at'],
      lignes,
    );
    t.importes += lignes.length;
    n += rows.length;
    progression(ctx, 'paiements', n, total);
  }
}

async function controlerPaiements(ctx: Ctx) {
  const trop = await ctx.db.query<{ legacy_id: number; numero: string; montant: number | null; valide: number }>(
    `SELECT d.legacy_id, d.numero, d.montant, sum(p.montant)::int AS valide
     FROM dossiers d JOIN paiements p ON p.dossier_id = d.id AND p.statut = 'valide'
     GROUP BY d.id HAVING sum(p.montant) > coalesce(d.montant, 0) ORDER BY d.legacy_id`,
  );
  for (const r of trop.rows) {
    if (r.montant === null) {
      ctx.rapport.anomalie('paiements', null, 'paiement_sans_montant', 'attention', `Dossier ${r.numero} (#${r.legacy_id}) : ${r.valide} FCFA validés alors que le dossier n'a pas de montant.`);
    } else {
      ctx.rapport.anomalie('paiements', null, 'trop_percu', 'attention', `Dossier ${r.numero} (#${r.legacy_id}) : ${r.valide} FCFA validés pour un montant de ${r.montant} FCFA (trop-perçu de ${r.valide - r.montant}). Importé tel quel, à vérifier.`);
    }
  }
  const doubles = await ctx.db.query<{ numero: string; montant: number; n: number }>(
    `SELECT d.numero, p.montant, count(*)::int AS n FROM paiements p JOIN dossiers d ON d.id = p.dossier_id
     WHERE p.statut = 'valide' GROUP BY d.numero, p.montant HAVING count(*) > 1`,
  );
  for (const r of doubles.rows) {
    ctx.rapport.anomalie('paiements', null, 'paiement_doublon_probable', 'attention', `Dossier ${r.numero} : ${r.n} paiements validés de ${r.montant} FCFA (double encaissement ?).`);
  }
  // En v2, « payé » se déduit des paiements validés : un dossier marqué payé dans l'ancienne plateforme
  // sans paiement validé suffisant apparaîtra comme non payé (ou acompte).
  const payes = [...ctx.dossiers.entries()].filter(([, d]) => d.payeAncien && d.montant !== null).map(([legacyId]) => legacyId);
  if (payes.length) {
    const r = await ctx.db.query<{ legacy_id: number; numero: string; montant: number; valide: number; attente: number }>(
      `SELECT d.legacy_id, d.numero, d.montant,
              coalesce(sum(p.montant) FILTER (WHERE p.statut = 'valide'), 0)::int AS valide,
              coalesce(sum(p.montant) FILTER (WHERE p.statut = 'a_valider'), 0)::int AS attente
       FROM dossiers d LEFT JOIN paiements p ON p.dossier_id = d.id
       WHERE d.legacy_id = ANY($1::int[]) GROUP BY d.id ORDER BY d.legacy_id`,
      [payes],
    );
    for (const x of r.rows) {
      if (x.valide >= x.montant) continue;
      ctx.rapport.anomalie(
        'dossiers',
        x.legacy_id,
        'statut_paiement_divergent',
        'attention',
        `Dossier ${x.numero} marqué « payé » dans l'ancienne plateforme, mais seuls ${x.valide} FCFA sur ${x.montant} sont validés` +
          `${x.attente ? ` (${x.attente} FCFA à valider)` : ''} : il apparaîtra comme ${x.valide > 0 ? 'acompte' : 'non payé'} en v2. Valider ou saisir le paiement manquant.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Tarifs

const UNITES: Record<string, UniteTarif> = {
  m2: 'm2',
  'm²': 'm2',
  metre_carre: 'm2',
  page: 'page',
  pages: 'page',
  face: 'page',
  forfait: 'forfait',
  ml: 'ml',
  metre_lineaire: 'ml',
  feuille: 'feuille',
  exemplaire: 'exemplaire',
  ex: 'exemplaire',
  unite: 'unite',
  piece: 'unite',
  pourcent: 'pourcent',
  '%': 'pourcent',
};

async function importerTarifs(ctx: Ctx) {
  const avant = await ctx.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM tarifs`);
  if ((avant.rows[0]?.n ?? 0) > 0) {
    ctx.rapport.anomalie('tarifs_config', null, 'grille_v2_remplacee', 'info', `${avant.rows[0]!.n} tarif(s) déjà présents dans la base v2 (grille par défaut) remplacés par la grille de l'ancienne plateforme.`);
    await ctx.db.query('DELETE FROM tarifs');
  }
  const t = ctx.rapport.table('tarifs_config');
  const vus = new Set<string>();
  const lignes: Record<string, unknown>[] = [];
  const rows = ctx.src.a('tarifs_config') ? await ctx.src.toutes('tarifs_config') : [];
  for (const r of rows) {
    t.lus++;
    const id = entier(r.id);
    const anomalie = (code: string, gravite: 'info' | 'attention' | 'erreur', message: string) => ctx.rapport.anomalie('tarifs_config', id, code, gravite, message);
    const machine = texte(r.type_machine)?.toLowerCase() ?? '';
    const code = texte(r.cle);
    if (!['roland', 'xerox', 'global'].includes(machine) || !code) {
      t.ignores++;
      anomalie('tarif_invalide', 'attention', `Tarif sans machine valide (« ${machine} ») ou sans clé : non importé.`);
      continue;
    }
    const cleUnique = `${machine}:${code}`;
    if (vus.has(cleUnique)) {
      t.ignores++;
      anomalie('tarif_doublon', 'attention', `Code ${code} déjà présent pour ${machine} (catégorie différente) : seul le premier est gardé.`);
      continue;
    }
    vus.add(cleUnique);
    let categorie = sansAccents(texte(r.categorie) ?? '').toLowerCase() as CategorieTarif;
    if (!(CATEGORIES_TARIF as readonly string[]).includes(categorie)) {
      anomalie('tarif_categorie_inconnue', 'info', `Catégorie « ${texte(r.categorie) ?? ''} » inconnue pour ${code} : classé en « divers ».`);
      categorie = 'divers';
    }
    const uniteBrute = texte(r.unite);
    const uk = uniteBrute ? sansAccents(uniteBrute).toLowerCase().replace(/\s+/g, '_') : '';
    let unite = UNITES[uniteBrute ?? ''] ?? UNITES[uk];
    let actif = booleen(r.actif) ?? true;
    if (!unite) {
      unite = 'forfait';
      actif = false;
      anomalie('tarif_unite_inconnue', 'attention', `Unité « ${uniteBrute ?? '(vide)'} » non reconnue pour ${code} : « forfait » retenu et tarif DÉSACTIVÉ, à corriger dans Tarifs.`);
    }
    const pu = lireMontant(r.prix_unitaire);
    const val = lireMontant(r.valeur);
    const prixBrut = pu?.ok ? pu.valeur : val?.ok ? val.valeur : null;
    if (pu?.ok && val?.ok && pu.valeur !== val.valeur) {
      anomalie('tarif_prix_divergent', 'attention', `${code} : prix_unitaire ${pu.valeur} (modifié dans l'écran admin) retenu ; valeur ${val.valeur} (lue par les anciens estimateurs) écartée. À confirmer.`);
    }
    const prix = prixBrut === null ? null : arrondirFcfa(prixBrut);
    if (prixBrut !== null && prix !== prixBrut) anomalie('montant_arrondi', 'info', `${code} : prix ${prixBrut} arrondi à ${prix} FCFA.`);
    if (code === 'impression_recto_verso' && unite === 'page') {
      // L'ancienne plateforme facturait ce supplément par feuille (pages × exemplaires ÷ 2), quelle que soit l'unité affichée.
      unite = 'feuille';
      anomalie('tarif_unite_corrigee', 'info', "impression_recto_verso : l'ancienne plateforme le facturait par feuille (pages × exemplaires ÷ 2) ; unité « feuille » retenue pour garder les mêmes prix.");
    }
    if (code.startsWith('reliure') && unite === 'forfait') {
      anomalie('tarif_a_verifier', 'attention', `${code} est au forfait : probablement par exemplaire, à vérifier dans Tarifs.`);
    }
    const created = horodatage(r.created_at) ?? ctx.maintenant;
    lignes.push({
      machine,
      categorie,
      code,
      libelle: texte(r.label) ?? texte(r.libelle) ?? code,
      unite,
      prix,
      actif,
      ordre: lignes.length,
      description: texteLong(r.description),
      created_at: created,
      updated_at: horodatage(r.updated_at) ?? created,
    });
  }
  t.importes = lignes.length;
  if (!rows.length) ctx.rapport.anomalie('tarifs_config', null, 'tarifs_absents', 'attention', "Aucun tarif dans l'ancienne base : grille par défaut v2 utilisée.");
  for (const d of TARIFS_DEFAUT) {
    if (vus.has(`${d.machine}:${d.code}`)) continue;
    vus.add(`${d.machine}:${d.code}`);
    lignes.push({ machine: d.machine, categorie: d.categorie, code: d.code, libelle: d.libelle, unite: d.unite, prix: d.prix, actif: d.actif, ordre: lignes.length, description: null, created_at: ctx.maintenant, updated_at: ctx.maintenant });
    ctx.rapport.anomalie('tarifs', null, 'tarif_ajoute', 'info', `${d.machine}/${d.code} (« ${d.libelle} ») ajouté depuis la grille par défaut v2${d.prix === null ? ' sans prix : à renseigner dans Tarifs' : ` (${d.prix} FCFA)`}.`);
  }
  await inserer(ctx.db, 'tarifs', ['machine', 'categorie', 'code', 'libelle', 'unite', 'prix', 'actif', 'ordre', 'description', 'created_at', 'updated_at'], lignes);
}

// ---------------------------------------------------------------------------
// Compteurs de numérotation

async function fixerCompteurs(ctx: Ctx) {
  const max = new Map<string, number>();
  for (const { serie, numero } of ctx.numeros) {
    const m = /^(CMD|DEV|FAC)-(\d{4})-(\d+)$/.exec(numero);
    if (!m || m[1] !== serie) continue;
    const valeur = Number(m[3]);
    // Les numéros « de repli » de l'ancienne plateforme (6 derniers chiffres de l'horloge) ne font pas
    // partie de la séquence : les prendre en compte ferait sauter la numérotation à 100 000+.
    if (valeur >= 100000) {
      ctx.rapport.anomalie('compteurs', null, 'compteur_hors_sequence', 'info', `${numero} : numéro de repli hors séquence, ignoré pour le compteur ${serie} ${m[2]} (aucune collision avant ${valeur} numéros dans l'année).`);
      continue;
    }
    const cle = `${serie}:${m[2]}`;
    max.set(cle, Math.max(max.get(cle) ?? 0, valeur));
  }
  const lignes = [...max].map(([k, valeur]) => {
    const [cle, annee] = k.split(':') as [string, string];
    return { cle, annee: Number(annee), valeur };
  });
  lignes.sort((a, b) => a.cle.localeCompare(b.cle) || a.annee - b.annee);
  for (const l of lignes) {
    await ctx.db.query(
      `INSERT INTO compteurs (cle, annee, valeur) VALUES ($1, $2, $3)
       ON CONFLICT (cle, annee) DO UPDATE SET valeur = GREATEST(compteurs.valeur, EXCLUDED.valeur)`,
      [l.cle, l.annee, l.valeur],
    );
    ctx.rapport.data.compteurs.push({ ...l, prochain: `${l.cle}-${l.annee}-${String(l.valeur + 1).padStart(4, '0')}` });
  }
}

// ---------------------------------------------------------------------------
// Bilan

const NON_REPRISES: Record<string, string> = {
  themes: "thèmes d'interface : la v2 a sa propre présentation",
  user_theme_preferences: "préférences de thème : sans objet en v2",
  openai_config: "configuration de l'assistant IA : non reprise (la clé API y était stockée en clair, à révoquer)",
  system_config: "réglages techniques de l'ancienne application : sans objet en v2",
  dossier_files: 'variante de la table fichiers non utilisée par l’application du VPS',
  activity_logs: 'journal d’une autre lignée de l’application, non utilisé par le VPS',
};

const TRAITEES = new Set([
  'users',
  'clients',
  'dossiers',
  'dossier_formulaires',
  'historique_statuts',
  'dossier_status_history',
  'dossier_activity_log',
  'fichiers',
  'devis',
  'devis_historique',
  'factures',
  'paiements',
  'tarifs_config',
]);

function noterTablesNonReprises(ctx: Ctx) {
  for (const t of ctx.src.tables()) {
    if (TRAITEES.has(t)) continue;
    const lignes = ctx.rapport.data.source.tables[t] ?? 0;
    ctx.rapport.data.tables_non_reprises.push({
      table: t,
      lignes,
      raison: NON_REPRISES[t] ?? "table inconnue de l'importeur : non reprise, vérifier son contenu",
    });
    if (!NON_REPRISES[t] && lignes > 0) {
      ctx.rapport.anomalie(t, null, 'table_non_reprise', 'attention', `Table « ${t} » (${lignes} ligne(s)) inconnue de l'importeur : non reprise, vérifier qu'elle ne contient rien d'utile.`);
    }
  }
}

async function controlerCible(ctx: Ctx) {
  const r = ctx.rapport.data;
  r.cible.lignes_apres_import = await compterTables(ctx.db, [...TABLES_METIER, 'tarifs', 'compteurs', 'parametres']);
  const st = await ctx.db.query<{ statut: string; n: number }>(`SELECT statut, count(*)::int AS n FROM dossiers GROUP BY statut ORDER BY statut`);
  r.statuts.apres = Object.fromEntries(st.rows.map((x) => [x.statut, x.n]));
  const somme = await ctx.db.query<{ s: number }>(`SELECT coalesce(sum(montant), 0)::bigint AS s FROM dossiers`);
  const m = r.montants.dossiers;
  m.somme_v2 = Number(somme.rows[0]?.s ?? 0);
  const arrondi = (x: number) => Math.round(x * 100) / 100;
  m.somme_montant_cfa_ancienne_base = arrondi(m.somme_montant_cfa_ancienne_base);
  m.somme_montants_retenus_avant_arrondi = arrondi(m.somme_montants_retenus_avant_arrondi);
  m.ecart_explique_par_arrondis = arrondi(m.ecart_explique_par_arrondis);
  m.ecart_v2_moins_retenus = arrondi(m.somme_v2 - m.somme_montants_retenus_avant_arrondi);
  if (m.somme_v2 !== m.somme_montants_retenus_arrondis || Math.abs(m.ecart_v2_moins_retenus - m.ecart_explique_par_arrondis) > 0.005) {
    throw new Error(`Contrôle des montants en échec : Σ v2 ${m.somme_v2} ≠ Σ retenus arrondis ${m.somme_montants_retenus_arrondis}.`);
  }
  const p = await ctx.db.query<{ s: number }>(`SELECT coalesce(sum(montant), 0)::bigint AS s FROM paiements`);
  if (Number(p.rows[0]?.s ?? 0) !== r.montants.paiements.somme_importee) throw new Error('Contrôle des paiements en échec : somme importée incohérente.');
  r.montants.paiements.somme_ancienne_base = arrondi(r.montants.paiements.somme_ancienne_base);
  r.montants.paiements.somme_ignoree = arrondi(r.montants.paiements.somme_ignoree);
  const f = await ctx.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM fichiers`);
  if ((f.rows[0]?.n ?? 0) !== (r.tables.fichiers?.importes ?? 0)) throw new Error('Contrôle des fichiers en échec : nombre de lignes incohérent.');
  const sansStatut = await ctx.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM dossiers WHERE legacy_id IS NULL`);
  if ((sansStatut.rows[0]?.n ?? 0) !== 0) throw new Error('Contrôle des dossiers en échec : dossier sans identifiant d’origine.');
}

// ---------------------------------------------------------------------------
// --remplacer : les fichiers v2 qui ne sont plus référencés sont déplacés à part, jamais supprimés.

async function mettreDeCoteFichiersV2(target: pg.Pool, storageDir: string, rapport: Rapport, log: (m: string) => void) {
  const racine = path.join(storageDir, 'dossiers');
  if (!fs.existsSync(racine)) return;
  const refs = new Set((await target.query<{ chemin: string }>(`SELECT chemin FROM fichiers`)).rows.map((r) => path.normalize(r.chemin)));
  const tous = await listerRecursif(racine, storageDir);
  const aDeplacer = tous.filter((f) => !refs.has(path.normalize(f)));
  if (!aDeplacer.length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(storageDir, `remplaces-${stamp}`);
  let octetsTotal = 0;
  for (const f of aDeplacer) {
    const de = path.join(storageDir, f);
    const vers = path.join(dest, f);
    await fs.promises.mkdir(path.dirname(vers), { recursive: true });
    octetsTotal += (await fs.promises.stat(de)).size;
    await fs.promises.rename(de, vers);
  }
  // Répertoires de dossiers devenus vides.
  for (const d of await fs.promises.readdir(racine)) {
    await fs.promises.rmdir(path.join(racine, d)).catch(() => {});
  }
  rapport.data.cible.fichiers_v2_mis_de_cote = { nombre: aDeplacer.length, octets: octetsTotal, dossier: dest };
  log(`${aDeplacer.length} ancien(s) fichier(s) v2 non référencé(s) déplacé(s) dans ${dest} (à supprimer après vérification).`);
}
