import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { agent, app, comptes } from './helpers';

describe('Apparence', () => {
  it("donne la palette de l'entreprise sans être connecté", async () => {
    const r = await supertest(await app()).get('/api/apparence');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ palette_defaut: 'evocom', couleurs_perso: null });
  });

  it("réserve la modification à l'administrateur et valide les couleurs", async () => {
    const prep = await agent(comptes.prep);
    expect((await prep.put('/api/apparence').send({ palette_defaut: 'sobre', couleurs_perso: null })).status).toBe(403);
    expect((await supertest(await app()).put('/api/apparence').send({ palette_defaut: 'sobre', couleurs_perso: null })).status).toBe(401);

    const admin = await agent(comptes.admin);
    const sansCouleurs = await admin.put('/api/apparence').send({ palette_defaut: 'perso', couleurs_perso: null });
    expect(sansCouleurs.status).toBe(400);
    expect(sansCouleurs.body.champs.couleurs_perso).toMatch(/deux couleurs/);
    const mauvaise = await admin.put('/api/apparence').send({ palette_defaut: 'perso', couleurs_perso: { debut: 'rouge', fin: '#00c6ff' } });
    expect(mauvaise.status).toBe(400);
    expect((await admin.put('/api/apparence').send({ palette_defaut: 'arc-en-ciel', couleurs_perso: null })).status).toBe(400);

    const ok = await admin.put('/api/apparence').send({ palette_defaut: 'perso', couleurs_perso: { debut: '#E30613', fin: '#ff9f00' } });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ palette_defaut: 'perso', couleurs_perso: { debut: '#e30613', fin: '#ff9f00' } });
    expect((await supertest(await app()).get('/api/apparence')).body.palette_defaut).toBe('perso');

    const journal = await admin.get('/api/journal').query({ action: 'apparence_modifiee' });
    expect(journal.status).toBe(200);
    expect(JSON.stringify(journal.body)).toContain('apparence_modifiee');

    await admin.put('/api/apparence').send({ palette_defaut: 'evocom', couleurs_perso: null });
  });

  it('garde les préférences de chacun, modifiables partiellement', async () => {
    const roland = await agent(comptes.roland);
    expect((await roland.get('/api/preferences')).body).toEqual({ theme: 'system', palette: null, contraste: 'normal' });

    const r1 = await roland.put('/api/preferences').send({ theme: 'dark' });
    expect(r1.body).toEqual({ theme: 'dark', palette: null, contraste: 'normal' });
    const r2 = await roland.put('/api/preferences').send({ palette: 'sobre', contraste: 'eleve' });
    expect(r2.body).toEqual({ theme: 'dark', palette: 'sobre', contraste: 'eleve' });
    // palette: null revient à la palette de l'entreprise ; un champ absent ne change pas.
    const r3 = await roland.put('/api/preferences').send({ palette: null });
    expect(r3.body).toEqual({ theme: 'dark', palette: null, contraste: 'eleve' });
    expect((await roland.put('/api/preferences').send({ theme: 'violet' })).status).toBe(400);

    // Les préférences d'un autre utilisateur ne sont pas touchées.
    const xerox = await agent(comptes.xerox);
    expect((await xerox.get('/api/preferences')).body.theme).toBe('system');
    expect((await supertest(await app()).get('/api/preferences')).status).toBe(401);
  });
});
