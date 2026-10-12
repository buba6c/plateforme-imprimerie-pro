// Libérer de l'espace (Sauvegardes et état) : vider la corbeille, effacer les fichiers des commandes anciennes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { agent, app, comptes, envoyerFichier, PASSWORD } from './helpers';

const STOCKAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-test-nettoyage-'));
process.env.STORAGE_DIR = STOCKAGE;

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep', Agent>;

const flyers = {
  machine: 'xerox',
  client_nom: 'Client Nettoyage',
  specs: { lignes: [{ support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 10, finitions: [], options: [] }], forfaits: [] },
};

async function creer(a: Agent): Promise<number> {
  const r = await a.post('/api/dossiers').send(flyers);
  expect(r.status).toBe(201);
  return r.body.id;
}
async function deposer(a: Agent, id: number, nom: string, octets: number): Promise<number> {
  const up = await envoyerFichier(a, id, nom, Buffer.alloc(octets, 1));
  expect(up.status).toBe(204);
  return up.fichierId!;
}
const chemin = async (fichierId: number) => (await getPool().query<{ chemin: string }>(`SELECT chemin FROM fichiers WHERE id = $1`, [fichierId])).rows[0]!.chemin;

describe('libérer de l’espace', () => {
  beforeAll(async () => {
    await app();
    A.admin = await agent(comptes.admin);
    A.prep = await agent(comptes.prep);
  });

  it('aperçu puis vidage de la corbeille : fichiers à la corbeille et fichiers des dossiers supprimés', async () => {
    const d1 = await creer(A.admin);
    const f1 = await deposer(A.admin, d1, 'corbeille.pdf', 1000);
    expect((await A.admin.delete(`/api/fichiers/${f1}`)).status).toBeLessThan(300);
    const d2 = await creer(A.admin);
    const f2 = await deposer(A.admin, d2, 'dossier-supprime.pdf', 2000);
    expect((await A.admin.delete(`/api/dossiers/${d2}`).send({ motif: 'test' })).status).toBeLessThan(300);
    const d3 = await creer(A.admin);
    const f3 = await deposer(A.admin, d3, 'vivant.pdf', 3000);

    const avant = await A.admin.get('/api/systeme/nettoyage?mois=6');
    expect(avant.status).toBe(200);
    expect(avant.body.corbeille.nb).toBeGreaterThanOrEqual(2);
    expect(avant.body.corbeille.dossiers_supprimes).toBeGreaterThanOrEqual(1);

    expect((await A.admin.post('/api/systeme/nettoyage').send({ cible: 'corbeille', mot_de_passe: 'faux' })).status).toBe(400);
    expect((await A.prep.post('/api/systeme/nettoyage').send({ cible: 'corbeille', mot_de_passe: PASSWORD })).status).toBe(403);
    const [c1, c2, c3] = [await chemin(f1), await chemin(f2), await chemin(f3)];
    const r = await A.admin.post('/api/systeme/nettoyage').send({ cible: 'corbeille', mot_de_passe: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body.cible).toBe('corbeille');
    expect(r.body.purges).toBeGreaterThanOrEqual(2);
    expect(r.body.octets_liberes_maintenant).toBeGreaterThanOrEqual(3000);
    expect(r.body.reste).toBe(0);
    expect(fs.existsSync(path.join(STOCKAGE, c1))).toBe(false);
    expect(fs.existsSync(path.join(STOCKAGE, c2))).toBe(false);
    expect(fs.existsSync(path.join(STOCKAGE, c3))).toBe(true);
    const lignes = await getPool().query(`SELECT id, purge_at, deleted_at FROM fichiers WHERE id = ANY($1::int[])`, [[f1, f2, f3]]);
    expect(lignes.rows.find((x) => x.id === f1)?.purge_at).toBeTruthy();
    expect(lignes.rows.find((x) => x.id === f2)?.purge_at).toBeTruthy();
    expect(lignes.rows.find((x) => x.id === f3)?.purge_at).toBeNull();
    expect((await A.admin.get('/api/systeme/nettoyage?mois=6')).body.corbeille.nb).toBe(0);
    // Le dossier supprimé reste restaurable (sans ses fichiers).
    expect((await A.admin.post(`/api/dossiers/${d2}/restaurer`)).status).toBe(200);
    expect((await A.admin.get(`/api/dossiers/${d2}`)).body.nb_fichiers).toBe(0);
  });

  it('fichiers des commandes finies depuis plus de N mois : effacés, trace dans l’historique, dossier intact', async () => {
    const vieux = await creer(A.admin);
    const fv = await deposer(A.admin, vieux, 'ancien.pdf', 5000);
    const recent = await creer(A.admin);
    const fr = await deposer(A.admin, recent, 'recent.pdf', 500);
    await getPool().query(`UPDATE dossiers SET statut = 'livre', livre_at = now() - interval '8 months', date_validation = now() - interval '9 months' WHERE id = $1`, [vieux]);
    await getPool().query(`UPDATE dossiers SET statut = 'livre', livre_at = now() - interval '1 month', date_validation = now() - interval '2 months' WHERE id = $1`, [recent]);

    expect((await A.admin.get('/api/systeme/nettoyage?mois=12')).body.anciens.nb).toBe(0);
    const a6 = await A.admin.get('/api/systeme/nettoyage?mois=6');
    expect(a6.body.anciens).toMatchObject({ mois: 6, nb: 1, dossiers: 1, taille: 5000 });
    expect((await A.admin.get('/api/systeme/nettoyage?mois=5')).status).toBe(400);

    const cv = await chemin(fv);
    const r = await A.admin.post('/api/systeme/nettoyage').send({ cible: 'anciens', mois: 6, mot_de_passe: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ cible: 'anciens', mois: 6, purges: 1, dossiers: 1, reste: 0, octets_liberes_maintenant: 5000 });
    expect(fs.existsSync(path.join(STOCKAGE, cv))).toBe(false);
    expect(fs.existsSync(path.join(STOCKAGE, await chemin(fr)))).toBe(true);
    const fiche = await A.admin.get(`/api/dossiers/${vieux}`);
    expect(fiche.status).toBe(200);
    expect(fiche.body.statut).toBe('livre');
    expect(fiche.body.nb_fichiers).toBe(0);
    expect(fiche.body.historique.some((e: { type: string; action: string | null }) => e.type === 'fichier' && e.action === 'nettoyage')).toBe(true);
    // Un fichier effacé ne revient pas dans la corbeille des fichiers.
    const corb = await A.admin.get('/api/gestion-fichiers/corbeille');
    expect(corb.status).toBe(200);
    expect(JSON.stringify(corb.body)).not.toContain('ancien.pdf');
  });
});
