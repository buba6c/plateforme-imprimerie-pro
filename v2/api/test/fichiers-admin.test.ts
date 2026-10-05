import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes, envoyerFichier } from './helpers';

// Stockage propre à ce fichier : le contrôle d'intégrité compare la base au disque, il ne doit
// pas voir les fichiers d'une autre exécution.
const STOCKAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-test-fichiers-admin-'));
process.env.STORAGE_DIR = STOCKAGE;

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'prep2' | 'roland' | 'xerox' | 'livreur', Agent>;
const URL = '/api/gestion-fichiers';

const bache = {
  machine: 'roland',
  client_nom: 'Boutique Keur Yaye',
  specs: { lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 200, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
};
const flyers = {
  machine: 'xerox',
  client_nom: 'Mairie de Pikine',
  specs: { lignes: [{ support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 500, finitions: [], options: [] }], forfaits: [] },
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

function jour(decalage = 0): string {
  const d = new Date(Date.now() + decalage * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function creer(a: Agent, corps: object): Promise<{ id: number; numero: string }> {
  const r = await a.post('/api/dossiers').send(corps);
  expect(r.status).toBe(201);
  return r.body;
}

async function deposer(a: Agent, dossierId: number, nom: string, octets: number, type: string): Promise<number> {
  const up = await envoyerFichier(a, dossierId, nom, Buffer.alloc(octets, 1), type);
  expect(up.status).toBe(204);
  return up.fichierId!;
}

const ids = (r: supertest.Response) => (r.body.items as { id: number }[]).map((i) => i.id);

// Données : dossier Roland du préparateur (3 fichiers, dont un envoyé par l'admin),
// dossier Xerox validé du préparateur 2, dossier du préparateur 2 mis à la corbeille.
const D = {} as Record<'roland' | 'xerox' | 'supprime', { id: number; numero: string }>;
const F = {} as Record<'pdf' | 'png' | 'zip' | 'xerox' | 'supprime' | 'supprimeAvant', number>;

beforeAll(async () => {
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'prep2', 'roland', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);

  D.roland = await creer(A.prep, bache);
  F.pdf = await deposer(A.prep, D.roland.id, 'bâche-façade.pdf', 3000, 'application/pdf');
  F.png = await deposer(A.prep, D.roland.id, 'logo.png', 1000, 'image/png');
  F.zip = await deposer(A.admin, D.roland.id, 'sources.zip', 5000, 'application/zip');

  D.xerox = await creer(A.prep2, flyers);
  F.xerox = await deposer(A.prep2, D.xerox.id, 'flyers-a4.pdf', 2000, 'application/pdf');
  expect((await A.prep2.post(`/api/dossiers/${D.xerox.id}/actions/valider`).send({})).status).toBe(200);

  D.supprime = await creer(A.prep2, { ...bache, client_nom: 'Client disparu' });
  F.supprime = await deposer(A.prep2, D.supprime.id, 'secret-disparu.pdf', 4000, 'application/pdf');
  F.supprimeAvant = await deposer(A.prep2, D.supprime.id, 'ancien-essai.pdf', 100, 'application/pdf');
  expect((await A.prep2.delete(`/api/fichiers/${F.supprimeAvant}`)).status).toBe(204);
  expect((await A.admin.delete(`/api/dossiers/${D.supprime.id}`).send({ motif: 'Doublon' })).status).toBe(204);
});

afterAll(async () => {
  await viderDonnees();
  fs.rmSync(STOCKAGE, { recursive: true, force: true });
});

describe('gestionnaire de fichiers : droits', () => {
  it('refuse les imprimeurs et le livreur (403), et sans session (401)', async () => {
    for (const k of ['roland', 'xerox', 'livreur'] as const) {
      expect((await A[k].get(URL)).status).toBe(403);
      expect((await A[k].get(`${URL}/auteurs`)).status).toBe(403);
      expect((await A[k].get(`${URL}/corbeille`)).status).toBe(403);
      expect((await A[k].get(`${URL}/integrite`)).status).toBe(403);
      expect((await A[k].post(`${URL}/${F.pdf}/restaurer`)).status).toBe(403);
    }
    const anonyme = (await import('supertest')).default(await app());
    expect((await anonyme.get(URL)).status).toBe(401);
  });

  it('réserve la corbeille, la restauration et le contrôle à l’administrateur', async () => {
    expect((await A.prep.get(`${URL}/corbeille`)).status).toBe(403);
    expect((await A.prep.get(`${URL}/integrite`)).status).toBe(403);
    expect((await A.prep.post(`${URL}/${F.supprimeAvant}/restaurer`)).status).toBe(403);
  });

  it('le préparateur voit les fichiers des dossiers qu’il peut ouvrir, et seulement ceux-là', async () => {
    const prep = await A.prep.get(URL);
    expect(prep.status).toBe(200);
    expect(ids(prep).sort()).toEqual([F.pdf, F.png, F.zip, F.xerox].sort());
    // Les fichiers d'un dossier à la corbeille ne sont visibles par personne dans la liste.
    expect(ids(prep)).not.toContain(F.supprime);
    expect((await A.prep.get(`/api/dossiers/${D.supprime.id}`)).status).toBe(404);
    expect(ids(await A.prep.get(URL).query({ q: 'secret' }))).toEqual([]);

    // Contre-épreuve : chaque fichier listé appartient à un dossier que le préparateur peut ouvrir.
    for (const item of prep.body.items as { dossier_id: number }[]) {
      expect((await A.prep.get(`/api/dossiers/${item.dossier_id}`)).status).toBe(200);
    }
    const admin = await A.admin.get(URL);
    expect(admin.status).toBe(200);
    expect(ids(admin).sort()).toEqual(ids(prep).sort());
  });
});

describe('gestionnaire de fichiers : liste', () => {
  it('décrit chaque fichier avec son dossier et donne les totaux', async () => {
    const r = await A.admin.get(URL);
    expect(r.body.total).toBe(4);
    expect(r.body.taille_totale).toBe(3000 + 1000 + 5000 + 2000);
    expect(r.body.page).toBe(1);
    const pdf = r.body.items.find((i: any) => i.id === F.pdf);
    expect(pdf).toMatchObject({
      nom_original: 'bâche-façade.pdf',
      categorie: 'pdf',
      taille: 3000,
      dossier_id: D.roland.id,
      dossier_numero: D.roland.numero,
      dossier_statut: 'en_cours',
      machine: 'roland',
      client_nom: 'Boutique Keur Yaye',
      uploaded_by_nom: 'Fatou Sarr',
      importe: false,
    });
    expect(pdf).not.toHaveProperty('chemin');
    // Tri par défaut : envoi le plus récent d'abord.
    expect(ids(r)[0]).toBe(F.xerox);
  });

  it('filtre par recherche (fichier, numéro, client), type, machine, statut et auteur', async () => {
    expect(ids(await A.prep.get(URL).query({ q: 'FAÇADE' }))).toEqual([F.pdf]);
    expect(ids(await A.prep.get(URL).query({ q: D.xerox.numero }))).toEqual([F.xerox]);
    expect(ids(await A.prep.get(URL).query({ q: 'keur yaye' })).sort()).toEqual([F.pdf, F.png, F.zip].sort());
    expect(ids(await A.prep.get(URL).query({ q: '100%_' }))).toEqual([]);

    expect(ids(await A.prep.get(URL).query({ type: 'pdf' })).sort()).toEqual([F.pdf, F.xerox].sort());
    expect(ids(await A.prep.get(URL).query({ type: 'image' }))).toEqual([F.png]);
    expect(ids(await A.prep.get(URL).query({ type: 'autre' }))).toEqual([F.zip]);
    expect(ids(await A.prep.get(URL).query({ type: 'image,autre' })).sort()).toEqual([F.png, F.zip].sort());

    expect(ids(await A.prep.get(URL).query({ machine: 'xerox' }))).toEqual([F.xerox]);
    expect(ids(await A.prep.get(URL).query({ statut: 'pret_impression' }))).toEqual([F.xerox]);
    expect(ids(await A.prep.get(URL).query({ statut: 'en_cours,a_revoir' })).sort()).toEqual([F.pdf, F.png, F.zip].sort());

    const auteurs = await A.prep.get(`${URL}/auteurs`);
    expect(auteurs.status).toBe(200);
    const admin = auteurs.body.find((u: any) => u.role === 'admin');
    expect(admin).toMatchObject({ nom: 'Awa Ndiaye', nb: 1 });
    expect(auteurs.body.map((u: any) => u.nom)).not.toContain(undefined);
    expect(ids(await A.prep.get(URL).query({ uploaded_by: admin.id }))).toEqual([F.zip]);

    const filtre = await A.prep.get(URL).query({ type: 'pdf', machine: 'roland' });
    expect(filtre.body.total).toBe(1);
    expect(filtre.body.taille_totale).toBe(3000);
  });

  it('filtre par période d’envoi', async () => {
    expect((await A.prep.get(URL).query({ from: jour(0), to: jour(0) })).body.total).toBe(4);
    expect((await A.prep.get(URL).query({ from: jour(1) })).body.total).toBe(0);
    expect((await A.prep.get(URL).query({ to: jour(-1) })).body.total).toBe(0);
    expect((await A.prep.get(URL).query({ from: jour(0), to: jour(-1) })).status).toBe(400);
    expect((await A.prep.get(URL).query({ from: '02/10/2026' })).status).toBe(400);
  });

  it('trie par nom, taille ou date et pagine', async () => {
    expect(ids(await A.prep.get(URL).query({ tri: 'nom' }))).toEqual([F.pdf, F.xerox, F.png, F.zip]);
    expect(ids(await A.prep.get(URL).query({ tri: 'nom', ordre: 'desc' }))).toEqual([F.zip, F.png, F.xerox, F.pdf]);
    expect(ids(await A.prep.get(URL).query({ tri: 'taille' }))).toEqual([F.zip, F.pdf, F.xerox, F.png]);
    expect(ids(await A.prep.get(URL).query({ tri: 'date', ordre: 'asc' }))).toEqual([F.pdf, F.png, F.zip, F.xerox]);

    const p1 = await A.prep.get(URL).query({ tri: 'taille', limit: 3, page: 1 });
    const p2 = await A.prep.get(URL).query({ tri: 'taille', limit: 3, page: 2 });
    expect(ids(p1)).toEqual([F.zip, F.pdf, F.xerox]);
    expect(ids(p2)).toEqual([F.png]);
    expect(p1.body.total).toBe(4);
    expect(p2.body.total).toBe(4);
    expect(p1.body.taille_totale).toBe(p2.body.taille_totale);
    expect(p2.body).toMatchObject({ page: 2, limit: 3 });
  });

  it('refuse les valeurs de filtre inconnues avec un message clair', async () => {
    const r = await A.prep.get(URL).query({ type: 'video' });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('pdf, image, autre');
    expect((await A.prep.get(URL).query({ machine: 'epson' })).status).toBe(400);
    expect((await A.prep.get(URL).query({ statut: 'archive' })).status).toBe(400);
    expect((await A.prep.get(URL).query({ tri: 'client' })).status).toBe(400);
    expect((await A.prep.get(URL).query({ ordre: 'haut' })).status).toBe(400);
  });
});

describe('gestionnaire de fichiers : corbeille', () => {
  it('liste les fichiers supprimés et indique si le dossier est lui-même à la corbeille', async () => {
    expect((await A.prep.delete(`/api/fichiers/${F.png}`)).status).toBe(204);
    expect(ids(await A.prep.get(URL))).not.toContain(F.png);

    const r = await A.admin.get(`${URL}/corbeille`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.taille_totale).toBe(1000 + 100);
    const png = r.body.items.find((i: any) => i.id === F.png);
    expect(png).toMatchObject({ dossier_supprime: false, peut_restaurer: true, present: true, deleted_by_nom: 'Fatou Sarr', dossier_numero: D.roland.numero });
    expect(png.deleted_at).toBeTruthy();
    expect(png).not.toHaveProperty('chemin');
    const ancien = r.body.items.find((i: any) => i.id === F.supprimeAvant);
    expect(ancien).toMatchObject({ dossier_supprime: true, peut_restaurer: false });
    expect(ancien.dossier_deleted_at).toBeTruthy();
    // Le fichier encore attaché au dossier supprimé n'est pas « à la corbeille » lui-même.
    expect(ids(r)).not.toContain(F.supprime);
    expect(ids(await A.admin.get(`${URL}/corbeille`).query({ q: 'logo' }))).toEqual([F.png]);
  });

  it('restaure un fichier, le trace dans le journal et l’historique du dossier', async () => {
    const r = await A.admin.post(`${URL}/${F.png}/restaurer`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: F.png, nom_original: 'logo.png', dossier_id: D.roland.id });
    expect(ids(await A.prep.get(URL))).toContain(F.png);
    expect(ids(await A.admin.get(`${URL}/corbeille`))).not.toContain(F.png);

    const fiche = await A.prep.get(`/api/dossiers/${D.roland.id}`);
    expect(fiche.body.fichiers.map((f: any) => f.id)).toContain(F.png);
    expect(fiche.body.historique.some((e: any) => e.type === 'fichier' && e.action === 'restauration' && e.data?.fichier_id === F.png)).toBe(true);

    const journal = await A.admin.get('/api/journal').query({ action: 'fichier_restaure' });
    expect(journal.body.items).toHaveLength(1);
    expect(journal.body.items[0]).toMatchObject({ cible: 'fichier', cible_id: String(F.png), user_nom: 'Awa Ndiaye' });
    expect(journal.body.items[0].data).toMatchObject({ nom: 'logo.png', numero: D.roland.numero });

    // Contenu de nouveau servi par la route existante.
    expect((await A.prep.get(`/api/fichiers/${F.png}/contenu`)).status).toBe(200);
  });

  it('refuse de restaurer un fichier actif, inconnu, ou dont le dossier est à la corbeille', async () => {
    expect((await A.admin.post(`${URL}/${F.png}/restaurer`)).status).toBe(409);
    expect((await A.admin.post(`${URL}/999999/restaurer`)).status).toBe(404);
    expect((await A.admin.post(`${URL}/abc/restaurer`)).status).toBe(400);
    const r = await A.admin.post(`${URL}/${F.supprimeAvant}/restaurer`);
    expect(r.status).toBe(409);
    expect(r.body.error).toContain(D.supprime.numero);
    expect(r.body.details).toEqual({ dossier_id: D.supprime.id });
  });
});

describe('gestionnaire de fichiers : contrôle d’intégrité', () => {
  it('ne signale rien quand le disque correspond à la base', async () => {
    const r = await A.admin.get(`${URL}/integrite`);
    expect(r.status).toBe(200);
    expect(r.body.fichiers).toEqual({ nb: 6, taille: 3000 + 1000 + 5000 + 2000 + 4000 + 100 });
    expect(r.body.repartition).toEqual({
      actifs: { nb: 4, taille: 11000 },
      corbeille: { nb: 1, taille: 100 },
      dossiers_corbeille: { nb: 1, taille: 4000 },
    });
    expect(r.body.manquants).toEqual({ nb: 0, taille_declaree: 0, items: [] });
    expect(r.body.taille_differente.nb).toBe(0);
    expect(r.body.presents).toEqual({ nb: 6, taille: 15100 });
    expect(r.body.orphelins).toEqual({ nb: 0, taille: 0 });
    expect(r.body.espace?.libre_octets).toBeGreaterThan(0);
  });

  it('signale un fichier supprimé du disque à la main, une taille différente et un fichier orphelin', async () => {
    const chemins = new Map(
      (await getPool().query<{ id: number; chemin: string }>(`SELECT id, chemin FROM fichiers`)).rows.map((r) => [r.id, r.chemin]),
    );
    fs.rmSync(path.join(STOCKAGE, chemins.get(F.pdf)!));
    fs.appendFileSync(path.join(STOCKAGE, chemins.get(F.xerox)!), Buffer.alloc(10));
    fs.mkdirSync(path.join(STOCKAGE, 'dossiers', '424242'), { recursive: true });
    fs.writeFileSync(path.join(STOCKAGE, 'dossiers', '424242', 'reste.pdf'), Buffer.alloc(77));

    const r = await A.admin.get(`${URL}/integrite`);
    expect(r.body.manquants.nb).toBe(1);
    expect(r.body.manquants.taille_declaree).toBe(3000);
    expect(r.body.manquants.items[0]).toMatchObject({
      id: F.pdf,
      nom_original: 'bâche-façade.pdf',
      etat: 'actif',
      dossier_id: D.roland.id,
      dossier_numero: D.roland.numero,
      client_nom: 'Boutique Keur Yaye',
    });
    expect(r.body.taille_differente.nb).toBe(1);
    expect(r.body.taille_differente.items[0]).toMatchObject({ id: F.xerox, taille: 2000, taille_disque: 2010 });
    expect(r.body.presents.nb).toBe(5);
    expect(r.body.orphelins).toEqual({ nb: 1, taille: 77 });

    // La route de contenu existante confirme l'absence.
    expect((await A.prep.get(`/api/fichiers/${F.pdf}/contenu`)).status).toBe(404);
  });
});
