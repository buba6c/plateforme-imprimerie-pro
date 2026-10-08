// Actions groupées et purge définitive des fichiers (Fichiers > Corbeille), espace disque.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes, envoyerFichier, PASSWORD } from './helpers';

// Stockage propre à ce fichier ; « ancienne » imite les uploads de l'ancienne application (liens durs).
const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-test-purge-'));
const STOCKAGE = path.join(RACINE, 'storage');
const ANCIENNE = path.join(RACINE, 'ancienne-uploads');
fs.mkdirSync(STOCKAGE, { recursive: true });
fs.mkdirSync(ANCIENNE, { recursive: true });
process.env.STORAGE_DIR = STOCKAGE;

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'roland', Agent>;
const URL = '/api/gestion-fichiers';

const bache = {
  machine: 'roland',
  client_nom: 'Boutique Keur Yaye',
  specs: { lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 200, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
};

async function viderDonnees() {
  const pool = getPool();
  await pool.query(
    `TRUNCATE notifications, journal, paiements, factures, dossier_events, fichiers, devis, dossiers, clients, compteurs, sauvegardes RESTART IDENTITY CASCADE`,
  );
  for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
    await pool.query(`INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`, [cle, JSON.stringify(valeur)]);
  }
  await pool.query(`UPDATE users SET echecs_connexion = 0, bloque_jusqu_a = NULL`);
  invalidateParametres();
  invalidateTarifs();
}

async function deposer(a: Agent, dossierId: number, nom: string, octets: number): Promise<number> {
  const up = await envoyerFichier(a, dossierId, nom, Buffer.alloc(octets, 7), 'application/pdf');
  expect(up.status).toBe(204);
  return up.fichierId!;
}

async function cheminDisque(id: number): Promise<string> {
  const r = await getPool().query<{ chemin: string }>(`SELECT chemin FROM fichiers WHERE id = $1`, [id]);
  return path.join(STOCKAGE, r.rows[0]!.chemin);
}

const ids = (r: supertest.Response) => (r.body.items as { id: number }[]).map((i) => i.id);

let dossier: { id: number; numero: string };
let livre: { id: number; numero: string };
const F = {} as Record<'a' | 'b' | 'c' | 'lie' | 'garde' | 'livre', number>;

beforeAll(async () => {
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'roland'] as const) A[k] = await agent(comptes[k]);

  const r = await A.prep.post('/api/dossiers').send(bache);
  expect(r.status).toBe(201);
  dossier = r.body;
  F.a = await deposer(A.prep, dossier.id, 'affiche-a.pdf', 1000);
  F.b = await deposer(A.prep, dossier.id, 'affiche-b.pdf', 2000);
  F.c = await deposer(A.prep, dossier.id, 'affiche-c.pdf', 3000);
  F.lie = await deposer(A.prep, dossier.id, 'importe-lie.pdf', 4000);
  F.garde = await deposer(A.prep, dossier.id, 'garde.pdf', 500);
  // Dossier validé : le préparateur ne peut plus en retirer les fichiers, l'administrateur si (place disque).
  expect((await A.prep.post(`/api/dossiers/${dossier.id}/actions/valider`).send({})).status).toBe(200);

  const r2 = await A.prep.post('/api/dossiers').send({ ...bache, client_nom: 'Client livré' });
  livre = r2.body;
  F.livre = await deposer(A.prep, livre.id, 'livre.pdf', 700);
  await getPool().query(`UPDATE dossiers SET statut = 'livre', livre_at = now() - interval '4 months' WHERE id = $1`, [livre.id]);

  // Le fichier « importé » partage son contenu avec l'ancienne application (lien dur).
  fs.linkSync(await cheminDisque(F.lie), path.join(ANCIENNE, 'importe-lie.pdf'));
});

afterAll(async () => {
  await viderDonnees();
  fs.rmSync(RACINE, { recursive: true, force: true });
});

describe('mise à la corbeille groupée', () => {
  it('est réservée à l’administrateur', async () => {
    expect((await A.prep.post(`${URL}/corbeille-groupee`).send({ ids: [F.a] })).status).toBe(403);
    expect((await A.roland.post(`${URL}/corbeille-groupee`).send({ ids: [F.a] })).status).toBe(403);
    expect((await A.prep.post(`${URL}/restaurer-groupe`).send({ ids: [F.a] })).status).toBe(403);
    expect((await A.prep.post(`${URL}/purger`).send({ ids: [F.a], mot_de_passe: PASSWORD })).status).toBe(403);
    // Le préparateur ne peut plus retirer un fichier d'un dossier validé.
    expect((await A.prep.delete(`/api/fichiers/${F.a}`)).status).toBe(403);
  });

  it('refuse une liste vide, trop longue ou mal formée', async () => {
    expect((await A.admin.post(`${URL}/corbeille-groupee`).send({ ids: [] })).status).toBe(400);
    expect((await A.admin.post(`${URL}/corbeille-groupee`).send({})).status).toBe(400);
    expect((await A.admin.post(`${URL}/corbeille-groupee`).send({ ids: ['x'] })).status).toBe(400);
    const trop = await A.admin.post(`${URL}/corbeille-groupee`).send({ ids: Array.from({ length: 501 }, (_, i) => i + 1) });
    expect(trop.status).toBe(400);
    expect(trop.body.error).toContain('500');
  });

  it('met à la corbeille des fichiers d’un dossier validé, avec historique et journal', async () => {
    const r = await A.admin.post(`${URL}/corbeille-groupee`).send({ ids: [F.a, F.b, F.c, F.lie, F.a, 999999] });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ mis_a_la_corbeille: 4, taille: 10000, introuvables: [999999], deja_a_la_corbeille: [] });

    const liste = await A.admin.get(URL);
    expect(ids(liste).sort()).toEqual([F.garde, F.livre].sort());
    const corbeille = await A.admin.get(`${URL}/corbeille`);
    expect(ids(corbeille).sort()).toEqual([F.a, F.b, F.c, F.lie].sort());
    const lie = corbeille.body.items.find((i: any) => i.id === F.lie);
    expect(lie).toMatchObject({ present: true, partage: true });
    expect(corbeille.body.items.find((i: any) => i.id === F.a)).toMatchObject({ partage: false });

    const fiche = await A.admin.get(`/api/dossiers/${dossier.id}`);
    const suppressions = fiche.body.historique.filter((e: any) => e.type === 'fichier' && e.action === 'suppression');
    expect(suppressions).toHaveLength(4);

    const journal = await A.admin.get('/api/journal').query({ action: 'fichiers_corbeille_groupee' });
    expect(journal.body.items).toHaveLength(1);
    expect(journal.body.items[0].data).toMatchObject({ nb: 4, taille: 10000 });

    // Deuxième passage : rien de neuf.
    const encore = await A.admin.post(`${URL}/corbeille-groupee`).send({ ids: [F.a] });
    expect(encore.body).toMatchObject({ mis_a_la_corbeille: 0, deja_a_la_corbeille: [F.a] });
  });

  it('restaure un groupe et explique ce qui n’a pas pu l’être', async () => {
    const r = await A.admin.post(`${URL}/restaurer-groupe`).send({ ids: [F.c, F.garde] });
    expect(r.status).toBe(200);
    expect(r.body.restaures).toBe(1);
    expect(r.body.ignores).toEqual([expect.objectContaining({ id: F.garde, raison: 'pas_a_la_corbeille' })]);
    expect(ids(await A.admin.get(URL))).toContain(F.c);
    // On la remet à la corbeille pour la suite.
    expect((await A.admin.post(`${URL}/corbeille-groupee`).send({ ids: [F.c] })).body.mis_a_la_corbeille).toBe(1);
  });
});

describe('purge définitive', () => {
  it('refuse sans mot de passe ou avec un mot de passe faux, sans rien toucher', async () => {
    const sans = await A.admin.post(`${URL}/purger`).send({ ids: [F.a] });
    expect(sans.status).toBe(400);
    expect(sans.body.champs).toHaveProperty('mot_de_passe');
    const faux = await A.admin.post(`${URL}/purger`).send({ ids: [F.a], mot_de_passe: 'pas-le-bon' });
    expect(faux.status).toBe(400);
    expect(faux.body.error).toContain('Mot de passe incorrect');
    expect(fs.existsSync(await cheminDisque(F.a))).toBe(true);
    const ligne = await getPool().query(`SELECT purge_at FROM fichiers WHERE id = $1`, [F.a]);
    expect(ligne.rows[0].purge_at).toBeNull();
    const journal = await A.admin.get('/api/journal').query({ action: 'purge_refusee' });
    expect(journal.body.items).toHaveLength(1);
  });

  it('refuse un fichier qui n’est pas à la corbeille, et ne purge alors aucun fichier de la sélection', async () => {
    const r = await A.admin.post(`${URL}/purger`).send({ ids: [F.a, F.garde], mot_de_passe: PASSWORD });
    expect(r.status).toBe(409);
    expect(r.body.details).toMatchObject({ hors_corbeille: [F.garde] });
    expect(fs.existsSync(await cheminDisque(F.a))).toBe(true);
    expect(fs.existsSync(await cheminDisque(F.garde))).toBe(true);
    const lignes = await getPool().query(`SELECT count(*)::int AS n FROM fichiers WHERE purge_at IS NOT NULL`);
    expect(lignes.rows[0].n).toBe(0);
  });

  it('efface du disque, compte la place libérée et la place partagée, garde l’original du lien dur', async () => {
    const cheminA = await cheminDisque(F.a);
    const cheminB = await cheminDisque(F.b);
    const cheminLie = await cheminDisque(F.lie);
    const r = await A.admin.post(`${URL}/purger`).send({ ids: [F.a, F.b, F.lie], mot_de_passe: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      purges: 3,
      supprimes_du_disque: 3,
      octets_liberes_maintenant: 3000,
      octets_partages: 4000,
      fichiers_partages: 1,
      erreurs: [],
    });
    expect(fs.existsSync(cheminA)).toBe(false);
    expect(fs.existsSync(cheminB)).toBe(false);
    expect(fs.existsSync(cheminLie)).toBe(false);
    // L'ancienne application garde son fichier, intact.
    const ancien = path.join(ANCIENNE, 'importe-lie.pdf');
    expect(fs.statSync(ancien).size).toBe(4000);
    expect(fs.statSync(ancien).nlink).toBe(1);
    expect(fs.readFileSync(ancien).every((o) => o === 7)).toBe(true);

    // La ligne reste comme trace.
    const lignes = await getPool().query(`SELECT id, purge_at, purge_par, purge_resultat, deleted_at FROM fichiers WHERE id = ANY($1) ORDER BY id`, [[F.a, F.b, F.lie]]);
    expect(lignes.rows).toHaveLength(3);
    for (const l of lignes.rows) {
      expect(l.purge_at).toBeTruthy();
      expect(l.purge_par).toBeTruthy();
      expect(l.deleted_at).toBeTruthy();
    }
    expect(lignes.rows.find((l) => l.id === F.a).purge_resultat).toBe('supprime');
    expect(lignes.rows.find((l) => l.id === F.lie).purge_resultat).toContain('partagé');

    // Journal : id, chemin, sha256, taille de chaque fichier.
    const journal = await A.admin.get('/api/journal').query({ action: 'fichiers_purges' });
    expect(journal.body.items).toHaveLength(1);
    const traces = journal.body.items[0].data.fichiers as any[];
    expect(traces.map((t) => t.id).sort()).toEqual([F.a, F.b, F.lie].sort());
    for (const t of traces) {
      expect(t.chemin).toMatch(/^dossiers\//);
      expect(t.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(t.taille).toBeGreaterThan(0);
    }
  });

  it('un fichier purgé disparaît de la corbeille et du contrôle, et ne peut plus être restauré', async () => {
    const corbeille = await A.admin.get(`${URL}/corbeille`);
    expect(ids(corbeille)).toEqual([F.c]);
    const restaurer = await A.admin.post(`${URL}/${F.a}/restaurer`);
    expect(restaurer.status).toBe(409);
    expect(restaurer.body.error).toContain('définitivement');
    const groupe = await A.admin.post(`${URL}/restaurer-groupe`).send({ ids: [F.a] });
    expect(groupe.body).toMatchObject({ restaures: 0, ignores: [expect.objectContaining({ id: F.a, raison: 'purge' })] });
    // La base elle-même refuse de « dé-supprimer » une ligne purgée.
    await expect(getPool().query(`UPDATE fichiers SET deleted_at = NULL WHERE id = $1`, [F.a])).rejects.toThrow(/fichiers_purge_apres_corbeille/);
    expect((await A.admin.get(`/api/fichiers/${F.a}/contenu`)).status).toBe(404);
    // Deuxième purge du même fichier : refusée.
    expect((await A.admin.post(`${URL}/purger`).send({ ids: [F.a], mot_de_passe: PASSWORD })).status).toBe(409);

    const controle = await A.admin.get(`${URL}/integrite`);
    expect(controle.body.manquants.nb).toBe(0);
    expect(controle.body.fichiers.nb).toBe(3);
  });

  it('garde sur le disque un chemin encore utilisé par une autre ligne', async () => {
    const chemin = (await getPool().query<{ chemin: string }>(`SELECT chemin FROM fichiers WHERE id = $1`, [F.c])).rows[0]!.chemin;
    await getPool().query(`UPDATE fichiers SET chemin = $1 WHERE id = $2`, [chemin, F.garde]);
    const r = await A.admin.post(`${URL}/purger`).send({ ids: [F.c], mot_de_passe: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ purges: 1, supprimes_du_disque: 0, octets_liberes_maintenant: 0 });
    expect(r.body.erreurs).toHaveLength(1);
    expect(fs.existsSync(path.join(STOCKAGE, chemin))).toBe(true);
  });

  it('bloque après 5 mots de passe faux dans l’heure', async () => {
    for (let i = 0; i < 4; i++) expect((await A.admin.post(`${URL}/purger`).send({ ids: [F.c], mot_de_passe: 'faux' })).status).toBe(400);
    expect((await A.admin.post(`${URL}/purger`).send({ ids: [F.c], mot_de_passe: PASSWORD })).status).toBe(429);
    await getPool().query(`DELETE FROM journal WHERE action = 'purge_refusee'`);
  });
});

describe('espace disque', () => {
  it('répartit les fichiers et compte les fichiers partagés', async () => {
    expect((await A.prep.get('/api/systeme/stockage')).status).toBe(403);
    // Un fichier actif partagé avec l'ancienne application.
    fs.linkSync(await cheminDisque(F.livre), path.join(ANCIENNE, 'livre.pdf'));
    const r = await A.admin.get('/api/systeme/stockage').query({ rafraichir: 1 });
    expect(r.status).toBe(200);
    expect(r.body.disque.total).toBeGreaterThan(0);
    expect(r.body.disque.libre).toBeGreaterThan(0);
    expect(r.body.fichiers).toEqual({
      actifs: { nb: 2, taille: 500 + 700 },
      corbeille: { nb: 0, taille: 0 },
      purges: { nb: 4, taille: 1000 + 2000 + 3000 + 4000 },
    });
    expect(r.body.liberable.dossiers_livres_plus_3_mois).toEqual({ nb: 1, taille: 700 });
    expect(r.body.partages).toMatchObject({ nb: 1, taille: 700 });
  });
});
