// Modèles de dossier : création, partage, droits, utilisation, suppression.
import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { agent, app, comptes } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'prep2' | 'xerox' | 'livreur', Agent>;
const specs = { lignes: [{ support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 500, finitions: [], options: [] }], forfaits: [] };

beforeAll(async () => {
  await app();
  for (const k of ['admin', 'prep', 'prep2', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

describe('modèles de dossier', () => {
  let partageId = 0;
  let priveId = 0;

  it('un préparateur enregistre un modèle partagé et un modèle privé', async () => {
    const r = await A.prep.post('/api/modeles').send({ nom: 'En-têtes A4', machine: 'xerox', specs, description: 'Papier en-tête', partage: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ nom: 'En-têtes A4', machine: 'xerox', partage: true, mien: true, usages: 0 });
    partageId = r.body.id;
    const p = await A.prep.post('/api/modeles').send({ nom: 'Mon brouillon', machine: 'xerox', specs, partage: false });
    expect(p.status).toBe(201);
    priveId = p.body.id;
  });

  it('les collègues voient les modèles partagés, pas les privés ; le livreur et l’imprimeur n’y ont pas accès', async () => {
    const noms = (r: supertest.Response) => (r.body as { nom: string; mien: boolean }[]).map((m) => `${m.nom}:${m.mien}`);
    expect(noms(await A.prep.get('/api/modeles'))).toEqual(expect.arrayContaining(['En-têtes A4:true', 'Mon brouillon:true']));
    const collegue = noms(await A.prep2.get('/api/modeles'));
    expect(collegue).toContain('En-têtes A4:false');
    expect(collegue).not.toContain('Mon brouillon:false');
    expect((await A.xerox.get('/api/modeles')).status).toBe(403);
    expect((await A.livreur.post('/api/modeles').send({ nom: 'x', machine: 'xerox', specs })).status).toBe(403);
  });

  it('refuse un modèle sans ligne complète', async () => {
    const r = await A.prep.post('/api/modeles').send({ nom: 'Vide', machine: 'roland', specs: { lignes: [], forfaits: [] } });
    expect(r.status).toBe(400);
    const r2 = await A.prep.post('/api/modeles').send({ nom: 'Incomplet', machine: 'roland', specs: { lignes: [{ support: 'bache_m2', quantite: 1 }], forfaits: [] } });
    expect(r2.status).toBe(400);
  });

  it('utiliser un modèle le fait remonter ; un privé n’est pas utilisable par un collègue', async () => {
    expect((await A.prep2.post(`/api/modeles/${partageId}/utiliser`)).status).toBe(204);
    expect((await A.prep2.post(`/api/modeles/${priveId}/utiliser`)).status).toBe(403);
    const liste = (await A.prep.get('/api/modeles')).body as { id: number; usages: number }[];
    expect(liste.find((m) => m.id === partageId)!.usages).toBe(1);
  });

  it('seul l’auteur ou un admin modifie ou supprime', async () => {
    expect((await A.prep2.patch(`/api/modeles/${partageId}`).send({ nom: 'Pirate' })).status).toBe(403);
    expect((await A.prep.patch(`/api/modeles/${partageId}`).send({ nom: 'En-têtes A4 250 g', partage: false })).body).toMatchObject({ nom: 'En-têtes A4 250 g', partage: false });
    expect((await A.prep2.delete(`/api/modeles/${partageId}`)).status).toBe(403);
    expect((await A.admin.delete(`/api/modeles/${partageId}`)).status).toBe(204);
    expect((await A.prep.get('/api/modeles')).body.some((m: { id: number }) => m.id === partageId)).toBe(false);
    expect((await A.prep.post(`/api/modeles/${partageId}/utiliser`)).status).toBe(404);
  });
});
