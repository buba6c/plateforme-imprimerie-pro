// Import de l'ancienne plateforme : bout en bout sur le jeu de données « sale » de v2/import/fixtures.
// Bases dédiées (créées ici, distinctes de evocom_test) : evocom_import_legacy_test (ancienne base) et
// evocom_import_test (cible v2). Stockage v2 dans un répertoire temporaire.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import pino from 'pino';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STATUTS, TARIFS_DEFAUT } from '@evocom/shared';
import { runImport, type ImportOptions, type ImportResult } from '../src/import';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { closePool, initPool } from '../src/db/pool';
import { initAuth } from '../src/lib/auth';
import { prochainNumero } from '../src/lib/numbering';

const FIXTURES = fileURLToPath(new URL('../../import/fixtures/', import.meta.url));
const RACINES = [path.join(FIXTURES, 'uploads'), path.join(FIXTURES, 'backend', 'uploads')];

function urlBase(nom: string): string {
  const u = new URL(process.env.DATABASE_URL ?? 'postgres://evocom:evocom_dev@localhost:5432/evocom_test');
  u.pathname = `/${nom}`;
  return u.toString();
}
const LEGACY = urlBase('evocom_import_legacy_test');
const CIBLE = urlBase('evocom_import_test');

let tmp: string;
let storageDir: string;
let cible: pg.Pool;
let legacy: pg.Pool;
let reel: ImportResult;

const base = (): ImportOptions => ({
  legacyUrl: LEGACY,
  targetUrl: CIBLE,
  uploadsDirs: RACINES,
  storageDir,
  log: () => {},
});

async function recreerBase(nom: string) {
  const admin = new pg.Client({ connectionString: urlBase('postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${nom} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${nom}`);
  await admin.end();
}

/** Nombre de lignes et md5 de chaque table de l'ancienne base. */
async function empreinteLegacy(): Promise<Record<string, string>> {
  const tables = await legacy.query<{ t: string }>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`);
  const out: Record<string, string> = {};
  for (const { t } of tables.rows) {
    const r = await legacy.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text), '')) AS h FROM "${t}" x`);
    out[t] = `${r.rows[0].n}:${r.rows[0].h}`;
  }
  const seqs = await legacy.query(`SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1`);
  out.__sequences = JSON.stringify(seqs.rows);
  return out;
}

function sha256(f: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}

function inventaire(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else out[path.relative(dir, p)] = sha256(p);
    }
  };
  if (fs.existsSync(dir)) parcourir(dir);
  return out;
}

async function compte(table: string): Promise<number> {
  return (await cible.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
}

/** Vue stable des données importées (sans identifiants aléatoires ni dates d'import). */
async function projection() {
  const q = async (sql: string) => (await cible.query(sql)).rows;
  return {
    users: await q(`SELECT legacy_id, email, role, is_active, password_hash FROM users ORDER BY legacy_id`),
    clients: await q(`SELECT nom, telephone, email FROM clients ORDER BY nom`),
    dossiers: await q(
      `SELECT d.legacy_id, d.numero, d.machine, d.statut, d.montant, d.client_nom, c.nom AS client, u.legacy_id AS prep, d.livre_at, d.date_validation, d.specs
       FROM dossiers d LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN users u ON u.id = d.preparateur_id ORDER BY d.legacy_id`,
    ),
    events: await q(`SELECT d.legacy_id, e.type, e.action, e.de_statut, e.vers_statut, e.commentaire, e.data - 'colonnes' AS data FROM dossier_events e JOIN dossiers d ON d.id = e.dossier_id WHERE e.action IS DISTINCT FROM 'import_ancienne_plateforme' ORDER BY d.legacy_id, e.created_at, e.type, e.action, e.commentaire`),
    fichiers: await q(`SELECT f.legacy_id, d.legacy_id AS dossier, f.nom_original, f.taille, f.sha256, f.mime FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id ORDER BY f.legacy_id`),
    paiements: await q(`SELECT p.legacy_id, d.legacy_id AS dossier, p.montant, p.mode, p.statut, p.reference FROM paiements p JOIN dossiers d ON d.id = p.dossier_id ORDER BY p.legacy_id`),
    factures: await q(`SELECT numero, statut, total_ht, tva, total_ttc FROM factures ORDER BY numero`),
    devis: await q(`SELECT numero, statut, total_ttc, dossier_id IS NOT NULL AS lie FROM devis ORDER BY numero`),
    tarifs: await q(`SELECT machine, code, unite, prix, actif FROM tarifs ORDER BY machine, code`),
    compteurs: await q(`SELECT * FROM compteurs ORDER BY cle, annee`),
  };
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-import-'));
  storageDir = path.join(tmp, 'storage');
  await recreerBase('evocom_import_legacy_test');
  await recreerBase('evocom_import_test');
  legacy = new pg.Pool({ connectionString: LEGACY, max: 2 });
  for (const f of ['legacy_schema.sql', 'legacy_seed.sql', 'legacy_seed_extra.sql']) {
    await legacy.query(fs.readFileSync(path.join(FIXTURES, f), 'utf8'));
  }
  cible = new pg.Pool({ connectionString: CIBLE, max: 2 });
});

afterAll(async () => {
  await closePool().catch(() => {});
  await legacy?.end();
  await cible?.end();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("import de l'ancienne plateforme", () => {
  let legacyAvant: Record<string, string>;
  let uploadsAvant: Record<string, string>;

  beforeAll(async () => {
    legacyAvant = await empreinteLegacy();
    uploadsAvant = Object.assign({}, ...RACINES.map((r) => inventaire(r)));
  });

  it('la simulation (--dry-run) écrit le rapport mais laisse la base v2 et le stockage vides', async () => {
    const fichier = path.join(tmp, 'rapport-simulation.json');
    const r = await runImport({ ...base(), dryRun: true, rapport: fichier });
    expect(r.code, r.message).toBe(0);
    expect(r.rapport!.mode).toBe('simulation');
    expect(fs.existsSync(fichier)).toBe(true);
    expect(JSON.parse(fs.readFileSync(fichier, 'utf8')).tables.dossiers.importes).toBe(28);
    for (const t of ['users', 'clients', 'dossiers', 'dossier_events', 'fichiers', 'devis', 'factures', 'paiements', 'tarifs', 'compteurs']) {
      expect(await compte(t), t).toBe(0);
    }
    expect(r.rapport!.fichiers.simulation_a_copier).toBe(11);
    expect(Object.keys(inventaire(storageDir))).toEqual([]);
  });

  it("importe tout en une transaction et écrit le rapport", async () => {
    const fichier = path.join(tmp, 'rapport.json');
    reel = await runImport({ ...base(), rapport: fichier });
    expect(reel.code, reel.message).toBe(0);
    expect(reel.rapport!.statut).toBe('ok');
    expect(reel.rapport!.mode).toBe('reel');
    const json = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    expect(json.anomalies.length).toBe(reel.rapport!.anomalies.length);
    expect(reel.rapport!.tables.dossiers).toEqual({ lus: 28, importes: 28, ignores: 0 });
  });

  it('reprend les utilisateurs avec leur mot de passe et fusionne les doublons d’e-mail', async () => {
    expect(await compte('users')).toBe(7);
    expect(reel.rapport!.tables.users).toEqual({ lus: 8, importes: 7, ignores: 1 });
    const prep = (await cible.query(`SELECT * FROM users WHERE email = 'preparateur@evocom.test'`)).rows[0];
    expect(prep.legacy_id).toBe(2);
    expect(await bcrypt.compare('Test1234!', prep.password_hash)).toBe(true);
    const admin = (await cible.query(`SELECT password_hash FROM users WHERE legacy_id = 1`)).rows[0];
    expect(admin.password_hash.startsWith('$2a$12$')).toBe(true);
    expect(await bcrypt.compare('Test1234!', admin.password_hash)).toBe(true);
    // Le dossier du compte en double (#6) est rattaché au compte gardé (#2).
    const d26 = (await cible.query(`SELECT u.legacy_id FROM dossiers d JOIN users u ON u.id = d.preparateur_id WHERE d.legacy_id = 26`)).rows[0];
    expect(d26.legacy_id).toBe(2);
    const codes = reel.rapport!.anomalies.filter((a) => a.table === 'users').map((a) => `${a.code}:${a.legacy_id}`);
    expect(codes).toEqual(expect.arrayContaining(['email_doublon:6', 'compte_demo:7', 'hash_non_bcrypt:8']));
  });

  it('normalise les statuts des deux vocabulaires', async () => {
    const rows = (await cible.query(`SELECT legacy_id, statut FROM dossiers ORDER BY legacy_id`)).rows;
    const statut = Object.fromEntries(rows.map((r) => [r.legacy_id, r.statut]));
    for (const r of rows) expect(STATUTS).toContain(r.statut);
    expect(statut[1]).toBe('en_cours'); // 'En cours'
    expect(statut[2]).toBe('livre'); // 'Livré'
    expect(statut[3]).toBe('termine'); // 'Terminé'
    expect(statut[4]).toBe('a_revoir'); // 'À revoir'
    expect(statut[5]).toBe('pret_impression'); // 'Prêt impression'
    expect(statut[7]).toBe('pret_livraison'); // 'Imprimé'
    expect(statut[8]).toBe('pret_livraison'); // 'Prêt livraison'
    expect(statut[10]).toBe('en_cours'); // 'nouveau'
    expect(statut[18]).toBe('pret_livraison'); // 'imprime'
    expect(statut[21]).toBe('livre'); // 'livre'
    expect(statut[27]).toBe('pret_livraison'); // 'pret livraison'
    expect(statut[26]).toBe('en_cours'); // 'Annulé' : inconnu
    expect(reel.rapport!.anomalies.some((a) => a.code === 'statut_inconnu' && a.legacy_id === '26')).toBe(true);
    const avant = reel.rapport!.statuts.correspondances.map((c) => c.avant);
    expect(avant).toEqual(expect.arrayContaining(['Livré', 'livre', 'Imprimé', 'imprime', 'nouveau', 'Terminé', 'termine']));
    const total = Object.values(reel.rapport!.statuts.apres).reduce((s, n) => s + n, 0);
    expect(total).toBe(28);
    // Dates de livraison reconstituées pour les dossiers livrés.
    const livres = (await cible.query(`SELECT count(*)::int AS n FROM dossiers WHERE statut IN ('livre','termine') AND livre_at IS NULL`)).rows[0];
    expect(livres.n).toBe(0);
  });

  it('retrouve les montants (colonnes et textes saisis) et les sommes concordent avec le rapport', async () => {
    const m = reel.rapport!.montants.dossiers;
    const somme = (await cible.query(`SELECT coalesce(sum(montant),0)::bigint AS s FROM dossiers`)).rows[0].s;
    expect(somme).toBe(m.somme_v2);
    expect(m.somme_v2).toBe(m.somme_montants_retenus_arrondis);
    expect(Math.abs(m.somme_v2 - m.somme_montants_retenus_avant_arrondi - m.ecart_explique_par_arrondis)).toBeLessThan(0.01);
    const montant = Object.fromEntries((await cible.query(`SELECT legacy_id, montant FROM dossiers`)).rows.map((r) => [r.legacy_id, r.montant]));
    expect(montant[2]).toBe(45000); // montant_cfa
    expect(montant[3]).toBe(120000); // amount
    expect(montant[7]).toBe(42000); // data_formulaire.prix_total « 42 000 »
    expect(montant[8]).toBe(25000); // data_formulaire.montant
    expect(montant[23]).toBe(32000); // montant_cfa prioritaire sur amount
    expect(montant[24]).toBe(8000); // data_formulaire double-encodé
    expect(montant[26]).toBe(12501); // « 12 500,50 FCFA »
    expect(montant[28]).toBe(15000); // 15000.40
    expect(montant[27]).toBeNull(); // « à définir »
    expect(montant[1]).toBeNull();
    const codes = reel.rapport!.anomalies.map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(['montant_texte', 'montant_arrondi', 'montant_invalide', 'montant_divergent']));
  });

  it('copie les fichiers (SHA-256, nom accentué) et signale manquants et orphelins', async () => {
    const rows = (await cible.query(`SELECT f.*, d.legacy_id AS dossier_legacy FROM fichiers f JOIN dossiers d ON d.id = f.dossier_id ORDER BY f.legacy_id`)).rows;
    expect(rows.length).toBe(11);
    for (const f of rows) {
      expect(path.isAbsolute(f.chemin)).toBe(false);
      expect(f.chemin.startsWith(`dossiers/${f.dossier_id}/`)).toBe(true);
      const abs = path.join(storageDir, f.chemin);
      expect(fs.existsSync(abs), f.chemin).toBe(true);
      expect(sha256(abs)).toBe(f.sha256);
      expect(fs.statSync(abs).size).toBe(f.taille);
    }
    const ete = rows.find((f) => f.legacy_id === 2)!;
    expect(ete.nom_original).toBe('affiche_été_€.pdf'.normalize('NFC'));
    expect(ete.chemin.endsWith('-affiche_été_€.pdf')).toBe(true);
    expect(ete.sha256).toBe(sha256(path.join(RACINES[0]!, 'dossiers/14/1767600000500_affiche_été_€.pdf')));
    expect(rows.find((f) => f.legacy_id === 10)!.nom_original).toBe('menu_café_été.png');
    // Seconde racine (backend/uploads), recherche par nom, chemin incohérent → folder_id, chemin absolu.
    expect(rows.find((f) => f.legacy_id === 12)!.sha256).toBe(sha256(path.join(RACINES[1]!, 'dossiers/26/1769000000000_maquette_finale.pdf')));
    expect(rows.find((f) => f.legacy_id === 13)!.nom_original).toBe('logo HD.png');
    expect(rows.find((f) => f.legacy_id === 9)!.dossier_legacy).toBe(17);
    expect(rows.find((f) => f.legacy_id === 6)!.dossier_legacy).toBe(2);
    const fr = reel.rapport!.fichiers;
    expect(fr.copies).toBe(11);
    expect(fr.manquants.map((x) => x.legacy_id).sort((a, b) => a! - b!)).toEqual([4, 8, 11, 14]);
    expect(fr.manquants.find((x) => x.legacy_id === 14)!.raison).toContain('2 fichiers');
    const orphelins = fr.orphelins.map((o) => path.basename(o.chemin));
    expect(orphelins).toEqual(expect.arrayContaining(['1765000000000_orphelin_sans_ligne.pdf', 'chunk_1767000000000_ab12cd', 'FAC-2025-001.pdf', 'plan.pdf']));
    expect(fr.octets_orphelins).toBeGreaterThan(0);
    // Les métadonnées d'un fichier manquant restent dans l'historique du dossier.
    const ev = (await cible.query(`SELECT e.data FROM dossier_events e JOIN dossiers d ON d.id = e.dossier_id WHERE d.legacy_id = 15 AND e.action = 'import_ancienne_plateforme'`)).rows[0];
    expect(ev.data.fichiers_manquants[0]).toMatchObject({ legacy_id: 4, nom: 'logo_sonatel_vectoriel.ai', taille_declaree: 1843200 });
    expect(ev.data.colonnes.numero).toBe('CMD-2026-0014');
    const codes = reel.rapport!.anomalies.map((a) => `${a.code}:${a.legacy_id}`);
    expect(codes).toEqual(expect.arrayContaining(['checksum_different:15', 'taille_differente:15', 'nom_repare:10']));
  });

  it('reprend les paiements (statuts, modes, rattachements) et signale les écarts', async () => {
    const p = Object.fromEntries((await projection()).paiements.map((x) => [x.legacy_id, x]));
    expect(Object.keys(p).length).toBe(8);
    expect(p[1]).toMatchObject({ dossier: 2, montant: 45000, mode: 'especes', statut: 'valide' });
    expect(p[2]).toMatchObject({ dossier: 21, mode: 'wave', statut: 'valide', reference: 'WAVE-TX-88231' });
    expect(p[3]).toMatchObject({ dossier: 22, statut: 'a_valider' }); // encaisse_livreur
    expect(p[4]).toMatchObject({ dossier: 23, mode: 'orange_money', statut: 'refuse' });
    expect(p[5]).toMatchObject({ dossier: 23, mode: 'cheque', statut: 'a_valider' }); // rattaché par la facture
    expect(p[7]).toMatchObject({ dossier: 25, montant: 45000, mode: 'carte', statut: 'valide' }); // 'cb', 45000.40
    expect(p[10]).toMatchObject({ dossier: 28, mode: 'especes', statut: 'a_valider' });
    const refus = (await cible.query(`SELECT motif_refus, valide_at FROM paiements WHERE legacy_id = 4`)).rows[0];
    expect(refus.motif_refus).toContain('32000');
    expect(refus.valide_at).not.toBeNull();
    const codes = reel.rapport!.anomalies.map((a) => `${a.code}:${a.legacy_id ?? ''}`);
    expect(codes).toEqual(
      expect.arrayContaining(['paiement_sans_dossier:9', 'paiement_montant_invalide:6', 'paiement_statut_inconnu:10', 'paiement_mode_inconnu:10', 'trop_percu:']),
    );
    const mp = reel.rapport!.montants.paiements;
    const somme = (await cible.query(`SELECT sum(montant)::bigint AS s FROM paiements`)).rows[0].s;
    expect(somme).toBe(mp.somme_importee);
    expect(mp.somme_ignoree).toBe(20000);
  });

  it('reprend devis et factures avec leurs liens', async () => {
    const pr = await projection();
    expect(pr.factures.map((f) => `${f.numero}:${f.statut}`)).toEqual(['FAC-2025-001:emise', 'FAC-2026-001:emise', 'FAC-2026-003:annulee']);
    expect(pr.factures[0]).toMatchObject({ total_ht: 101695, tva: 18305, total_ttc: 120000 });
    expect(reel.rapport!.anomalies.some((a) => a.code === 'facture_sans_dossier' && a.legacy_id === '3')).toBe(true);
    expect(pr.devis.map((d) => `${d.numero}:${d.statut}:${d.lie}`)).toEqual(['DEV-2026-001:accepte:false', 'DEV-2026-002:converti:true', 'DEV-2026-003:brouillon:false']);
    const lien = (await cible.query(`SELECT d.legacy_id, v.numero, v.updated_at FROM dossiers d JOIN devis v ON v.id = d.devis_id AND v.dossier_id = d.id`)).rows;
    expect(lien).toHaveLength(1);
    expect(lien[0].legacy_id).toBe(25);
    expect(new Date(lien[0].updated_at).toISOString()).toBe('2026-09-26T16:00:00.000Z'); // date d'origine conservée
  });

  it("reprend l'historique sans doublon et la grille tarifaire complète", async () => {
    const ev = (await cible.query(`SELECT e.type, e.de_statut, e.vers_statut FROM dossier_events e JOIN dossiers d ON d.id = e.dossier_id WHERE d.legacy_id = 2 AND e.type = 'statut' ORDER BY e.created_at`)).rows;
    expect(ev.map((e) => `${e.de_statut}>${e.vers_statut}`)).toEqual(['en_cours>pret_impression', 'pret_impression>en_impression', 'en_impression>pret_livraison', 'pret_livraison>livre']);
    // Dossier 14 : même transition dans dossier_status_history et dossier_activity_log → une seule.
    const d14 = (await cible.query(`SELECT count(*)::int AS n FROM dossier_events e JOIN dossiers d ON d.id = e.dossier_id WHERE d.legacy_id = 14 AND e.type = 'statut' AND e.vers_statut = 'pret_impression'`)).rows[0];
    expect(d14.n).toBe(1);
    const imports = (await cible.query(`SELECT count(*)::int AS n FROM dossier_events WHERE type = 'import' AND action = 'import_ancienne_plateforme' AND commentaire = 'Importé de l''ancienne plateforme'`)).rows[0];
    expect(imports.n).toBe(28);
    const tarifs = (await projection()).tarifs;
    for (const d of TARIFS_DEFAUT) expect(tarifs.some((t) => t.machine === d.machine && t.code === d.code), d.code).toBe(true);
    const t = (code: string) => tarifs.find((x) => x.code === code)!;
    expect(t('bache_m2').prix).toBe(7500); // prix_unitaire prioritaire sur valeur
    expect(t('agrafage_coin')).toMatchObject({ unite: 'forfait', actif: false });
    expect(reel.rapport!.anomalies.filter((a) => a.code === 'tarif_a_verifier').map((a) => a.message).join(' ')).toContain('reliure_spirale');
  });

  it('fixe les compteurs pour continuer la numérotation sans collision', async () => {
    const c = Object.fromEntries((await projection()).compteurs.map((x) => [`${x.cle}-${x.annee}`, x.valeur]));
    expect(c['CMD-2025']).toBe(8);
    expect(c['CMD-2026']).toBe(24); // CMD-2026-104233 (numéro de repli) écarté et signalé
    expect(c['DEV-2026']).toBe(3);
    expect(c['FAC-2026']).toBe(3);
    const client = await cible.connect();
    try {
      await client.query('BEGIN');
      const cmd = await prochainNumero(client, 'CMD', new Date('2026-06-01T12:00:00Z'));
      const fac = await prochainNumero(client, 'FAC', new Date('2026-06-01T12:00:00Z'));
      expect(cmd).toBe('CMD-2026-0025');
      expect(fac).toBe('FAC-2026-0004');
      expect((await client.query(`SELECT 1 FROM dossiers WHERE numero = $1`, [cmd])).rowCount).toBe(0);
      expect((await client.query(`SELECT 1 FROM factures WHERE numero = $1`, [fac])).rowCount).toBe(0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it("n'a rien modifié dans l'ancienne base ni dans les uploads", async () => {
    expect(await empreinteLegacy()).toEqual(legacyAvant);
    expect(reel.rapport!.source.inchangee).toBe(true);
    expect(Object.assign({}, ...RACINES.map((r) => inventaire(r)))).toEqual(uploadsAvant);
  });

  it('refuse une base v2 déjà remplie sans --remplacer (code 2)', async () => {
    const avant = await compte('dossiers');
    const r = await runImport({ ...base(), rapport: null });
    expect(r.code).toBe(2);
    expect(r.message).toContain('--remplacer');
    expect(await compte('dossiers')).toBe(avant);
  });

  it('une relance avec --remplacer donne exactement le même résultat', async () => {
    const avant = await projection();
    const fichiersAvant = Object.keys(inventaire(path.join(storageDir, 'dossiers'))).length;
    const r = await runImport({ ...base(), remplacer: true, rapport: null });
    expect(r.code, r.message).toBe(0);
    expect(await projection()).toEqual(avant);
    expect(r.rapport!.anomalies_par_code).toEqual(reel.rapport!.anomalies_par_code);
    // Les copies précédentes ne sont plus référencées : déplacées à part, jamais supprimées.
    expect(r.rapport!.cible.fichiers_v2_mis_de_cote.nombre).toBe(fichiersAvant);
    expect(Object.keys(inventaire(path.join(storageDir, 'dossiers'))).length).toBe(11);
    expect(await empreinteLegacy()).toEqual(legacyAvant);
  });

  it("permet de se connecter à la v2 et de travailler sur les données importées", async () => {
    const config = { ...loadConfig(), databaseUrl: CIBLE, storageDir };
    initPool(CIBLE);
    initAuth(config);
    const app = createApp(config, pino({ level: 'silent' }));
    const a = supertest.agent(app);
    const login = await a.post('/api/auth/login').send({ email: 'preparateur@evocom.test', password: 'Test1234!' });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.body.user.role).toBe('preparateur');

    const liste = await a.get('/api/dossiers?limit=200');
    expect(liste.status).toBe(200);
    expect(liste.body.total).toBe(28);
    const d2 = liste.body.items.find((d: any) => d.numero === 'CMD-2025-0001');
    expect(d2).toMatchObject({ statut: 'livre', montant: 45000, importe: true, situation_paiement: 'paye' });

    const id14 = liste.body.items.find((d: any) => d.numero === 'CMD-2026-0013').id;
    const detail = await a.get(`/api/dossiers/${id14}`);
    expect(detail.status).toBe(200);
    expect(detail.body.fichiers.map((f: any) => f.nom_original).sort()).toEqual(['Affiche Wave 60x40.pdf', 'affiche_été_€.pdf']);
    const ete = detail.body.fichiers.find((f: any) => f.nom_original === 'affiche_été_€.pdf');
    const contenu = await a.get(`/api/fichiers/${ete.id}/contenu`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(contenu.status).toBe(200);
    expect(crypto.createHash('sha256').update(contenu.body as Buffer).digest('hex')).toBe(
      sha256(path.join(RACINES[0]!, 'dossiers/14/1767600000500_affiche_été_€.pdf')),
    );

    // Un imprimeur Roland voit les dossiers Roland validés.
    const roland = supertest.agent(app);
    expect((await roland.post('/api/auth/login').send({ email: 'roland@evocom.test', password: 'Test1234!' })).status).toBe(200);
    const file = await roland.get('/api/dossiers?limit=200');
    expect(file.status).toBe(200);
    expect(file.body.items.length).toBeGreaterThan(0);
    expect(file.body.items.every((d: any) => d.machine === 'roland')).toBe(true);
  });
});
