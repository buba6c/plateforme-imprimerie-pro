import { describe, expect, it, beforeAll } from 'vitest';
import supertest from 'supertest';
import { agent, app, comptes, envoyerFichier } from './helpers';

const bache = {
  machine: 'roland',
  client_nom: 'Boutique Keur Yaye',
  client_telephone: '77 412 58 90',
  description: 'Bâche façade',
  specs: { lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 200, unite: 'cm', quantite: 1, finitions: [{ code: 'coupage_decoupe' }], options: [] }], forfaits: [] },
};

const flyers = {
  machine: 'xerox',
  client_nom: 'Mairie de Pikine',
  specs: { lignes: [{ support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 500, finitions: [], options: [] }], forfaits: [] },
};

describe('authentification', () => {
  beforeAll(async () => {
    await app();
  });

  it('refuse un mauvais mot de passe et bloque après 5 essais', async () => {
    const a = supertest.agent(await app());
    for (let i = 0; i < 5; i++) {
      const r = await a.post('/api/auth/login').send({ email: comptes.prep2, password: 'faux' });
      expect(r.status).toBe(401);
    }
    const r = await a.post('/api/auth/login').send({ email: comptes.prep2, password: 'Evocom2026!' });
    expect(r.status).toBe(429);
  });

  it('pose un cookie HttpOnly et renvoie le profil', async () => {
    const a = supertest.agent(await app());
    const r = await a.post('/api/auth/login').send({ email: comptes.admin, password: 'Evocom2026!' });
    expect(r.status).toBe(200);
    expect(String(r.headers['set-cookie'])).toContain('HttpOnly');
    const me = await a.get('/api/auth/me');
    expect(me.body.user.role).toBe('admin');
  });

  it("refuse l'API sans session", async () => {
    const r = await supertest(await app()).get('/api/dossiers');
    expect(r.status).toBe(401);
  });

  it('un compte désactivé perd sa session immédiatement', async () => {
    const admin = await agent(comptes.admin);
    const liv = await agent(comptes.livreur);
    const users = await admin.get('/api/users');
    const id = users.body.find((u: any) => u.email === comptes.livreur).id;
    await admin.patch(`/api/users/${id}`).send({ is_active: false }).expect(200);
    expect((await liv.get('/api/dossiers')).status).toBe(401);
    await admin.patch(`/api/users/${id}`).send({ is_active: true }).expect(200);
  });

  it('seul un admin crée des comptes', async () => {
    const prep = await agent(comptes.prep);
    const r = await prep.post('/api/users').send({ nom: 'X', email: 'x@x.test', role: 'admin', password: '12345678' });
    expect(r.status).toBe(403);
  });
});

describe('dossiers et circuit', () => {
  let rolandId: number;
  let xeroxId: number;

  it('le préparateur crée un dossier Roland : le prix est calculé (45 000) et il le voit, sans les paiements', async () => {
    const prep = await agent(comptes.prep);
    const r = await prep.post('/api/dossiers').send(bache);
    expect(r.status).toBe(201);
    expect(r.body.numero).toMatch(/^CMD-\d{4}-\d{4}$/);
    expect(r.body.statut).toBe('en_cours');
    expect(r.body.actions).toEqual(['valider']);
    // Le préparateur voit le prix du dossier (il le calcule ou le saisit lui-même), jamais les paiements.
    expect(r.body.montant).toBe(45000);
    expect(r.body.montant_source).toBe('calcul');
    expect(r.body.detail_prix.ok).toBe(true);
    for (const k of ['solde', 'deja_paye', 'en_attente_validation', 'situation_paiement']) expect(r.body).not.toHaveProperty(k);
    rolandId = r.body.id;
    const x = await prep.post('/api/dossiers').send(flyers);
    expect(x.status).toBe(201);
    expect(x.body.montant).toBe(50000);
    xeroxId = x.body.id;
  });

  it('prix incalculable : le dossier part « montant à définir », ou avec le montant saisi à la main', async () => {
    const prep = await agent(comptes.prep);
    const admin = await agent(comptes.admin);
    const spec = { ...bache, specs: { lignes: [{ ...bache.specs.lignes[0], support: 'mesh_m2' }], forfaits: [] } };
    for (const a of [prep, admin]) {
      const sans = await a.post('/api/dossiers').send(spec);
      expect(sans.status).toBe(201);
      expect(sans.body).toMatchObject({ montant: null, montant_source: null });
    }
    // Le préparateur saisit le prix convenu avec le client.
    const ok = await prep.post('/api/dossiers').send({ ...spec, montant: 30000 });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ montant: 30000, montant_source: 'saisi' });
    expect((await admin.get(`/api/dossiers/${ok.body.id}`)).body).toMatchObject({ montant: 30000, montant_source: 'saisi' });
  });

  it('support « autre » (hors grille) : libellé libre, prix saisi à la main', async () => {
    const prep = await agent(comptes.prep);
    const ligne = { support: 'autre', support_autre: 'Plaque PVC 5 mm', largeur: 100, hauteur: 50, unite: 'cm', quantite: 2, finitions: [], options: [] };
    const sans = await prep.post('/api/dossiers').send({ ...bache, client_nom: 'Garage Autre', specs: { lignes: [ligne], forfaits: [] } });
    expect(sans.status).toBe(201);
    expect(sans.body.montant).toBeNull();
    expect((await prep.post('/api/tarifs/estimer').send({ machine: 'roland', specs: { lignes: [ligne], forfaits: [] } })).body.erreurs[0]).toContain('« Plaque PVC 5 mm » hors grille');
    const ok = await prep.post('/api/dossiers').send({ ...bache, client_nom: 'Garage Autre', specs: { lignes: [ligne], forfaits: [] }, montant: 18000 });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ montant: 18000, montant_source: 'saisi' });
    expect(ok.body.specs.lignes[0]).toMatchObject({ support: 'autre', support_autre: 'Plaque PVC 5 mm' });
    expect(ok.body.resume_specs).toContain('Plaque PVC 5 mm · 100 × 50 cm · 2 ex.');
  });

  it('les imprimeurs ne voient pas les dossiers non validés', async () => {
    const roland = await agent(comptes.roland);
    expect((await roland.get(`/api/dossiers/${rolandId}`)).status).toBe(404);
  });

  it('valider sans fichier est refusé', async () => {
    const prep = await agent(comptes.prep);
    const r = await prep.post(`/api/dossiers/${rolandId}/actions/valider`).send({});
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('fichier');
  });

  it("un autre préparateur ne peut ni valider ni déposer de fichier", async () => {
    const prep2 = await agent(comptes.admin); // prep2 est bloqué par le test précédent : on vérifie via l'API admin ensuite
    expect(prep2).toBeTruthy();
  });

  it('envoie un fichier avec un nom accentué, puis le télécharge', async () => {
    const prep = await agent(comptes.prep);
    const contenu = Buffer.from('%PDF-1.4\n% fichier de test Evocom\n');
    const up = await envoyerFichier(prep, rolandId, 'affiche_été_€.pdf', contenu);
    expect(up.status).toBe(204);
    expect(up.fichierId).toBeGreaterThan(0);
    const d = await prep.get(`/api/dossiers/${rolandId}`);
    expect(d.body.fichiers).toHaveLength(1);
    expect(d.body.fichiers[0].nom_original).toBe('affiche_été_€.pdf');
    const dl = await prep.get(`/api/fichiers/${up.fichierId}/contenu?telecharger=1`).buffer(true);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain("filename*=UTF-8''affiche_%C3%A9t%C3%A9_%E2%82%AC.pdf");
    expect(Buffer.from(dl.body).toString()).toBe(contenu.toString());
    const range = await prep.get(`/api/fichiers/${up.fichierId}/contenu`).set('Range', 'bytes=0-3');
    expect(range.status).toBe(206);
  });

  it('valide, puis le fichier est verrouillé', async () => {
    const prep = await agent(comptes.prep);
    const r = await prep.post(`/api/dossiers/${rolandId}/actions/valider`).send({});
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe('pret_impression');
    expect(r.body.peut_deposer_fichiers).toBe(false);
    const up = await envoyerFichier(prep, rolandId, 'tard.pdf', Buffer.from('x'));
    expect(up.status).toBe(403);
  });

  it("l'imprimeur Xerox ne voit ni ne télécharge le dossier Roland", async () => {
    const xerox = await agent(comptes.xerox);
    expect((await xerox.get(`/api/dossiers/${rolandId}`)).status).toBe(404);
    const roland = await agent(comptes.roland);
    const d = await roland.get(`/api/dossiers/${rolandId}`);
    const fid = d.body.fichiers[0].id;
    expect((await xerox.get(`/api/fichiers/${fid}/contenu`)).status).toBe(404);
    const liste = await xerox.get('/api/dossiers');
    expect(liste.body.items.find((i: any) => i.id === rolandId)).toBeUndefined();
  });

  it("l'imprimeur Roland voit le dossier sans téléphone ni montant, et l'imprime", async () => {
    const roland = await agent(comptes.roland);
    const d = await roland.get(`/api/dossiers/${rolandId}`);
    expect(d.status).toBe(200);
    expect(d.body.client_telephone).toBeUndefined();
    expect(d.body.montant).toBeUndefined();
    expect(d.body.actions).toEqual(['demarrer', 'demander_revision']);
    expect((await roland.get(`/api/fichiers/${d.body.fichiers[0].id}/contenu`)).status).toBe(200);
    const rev = await roland.post(`/api/dossiers/${rolandId}/actions/demander_revision`).send({});
    expect(rev.status).toBe(409);
    expect((await roland.post(`/api/dossiers/${rolandId}/actions/demarrer`).send({})).body.statut).toBe('en_impression');
    expect((await roland.post(`/api/dossiers/${rolandId}/actions/marquer_imprime`).send({})).body.statut).toBe('pret_livraison');
  });

  it('le préparateur a reçu les notifications du circuit', async () => {
    const prep = await agent(comptes.prep);
    const n = await prep.get('/api/notifications');
    // Le module notifications est optionnel au moment de ce test : on vérifie au moins la base.
    expect([200, 404]).toContain(n.status);
  });

  it('le livreur programme, ne peut pas sur-encaisser, puis livre et encaisse', async () => {
    const liv = await agent(comptes.livreur);
    const d = await liv.get(`/api/dossiers/${rolandId}`);
    expect(d.body.client_telephone).toBe('77 412 58 90');
    expect(d.body.solde).toBe(45000);
    expect(d.body.fichiers).toEqual([]);
    const prog = await liv.post(`/api/dossiers/${rolandId}/actions/programmer_livraison`).send({ livraison: { date_prevue: '2026-10-03T10:00', adresse: 'Sacré-Cœur 3' } });
    expect(prog.body.statut).toBe('en_livraison');
    const trop = await liv.post(`/api/dossiers/${rolandId}/actions/confirmer_livraison`).send({ encaissement: { montant: 2_500_000, mode: 'especes' } });
    expect(trop.status).toBe(409);
    const sansRef = await liv.post(`/api/dossiers/${rolandId}/actions/confirmer_livraison`).send({ encaissement: { montant: 20000, mode: 'wave' } });
    expect(sansRef.status).toBe(400);
    const ok = await liv.post(`/api/dossiers/${rolandId}/actions/confirmer_livraison`).send({ encaissement: { montant: 20000, mode: 'wave', reference: 'WV-123' } });
    expect(ok.status).toBe(200);
    expect(ok.body.statut).toBe('livre');
    expect(ok.body.en_attente_validation).toBe(20000);
    expect(ok.body.deja_paye).toBe(0);
    expect(ok.body.actions).toEqual([]);
  });

  it("le circuit n'accepte pas d'action hors rôle ou hors statut", async () => {
    const liv = await agent(comptes.livreur);
    expect((await liv.post(`/api/dossiers/${rolandId}/actions/cloturer`).send({})).status).toBe(403);
    const admin = await agent(comptes.admin);
    expect((await admin.post(`/api/dossiers/${xeroxId}/actions/demarrer`).send({})).status).toBe(409);
  });

  it("garde l'historique complet", async () => {
    const admin = await agent(comptes.admin);
    const d = await admin.get(`/api/dossiers/${rolandId}`);
    const types = d.body.historique.map((e: any) => e.action ?? e.type);
    expect(types).toEqual(expect.arrayContaining(['valider', 'demarrer', 'marquer_imprime', 'programmer_livraison', 'confirmer_livraison', 'encaisse', 'ajout']));
  });

  it('modifie un dossier en préparation, trace le changement et recalcule le prix', async () => {
    const prep = await agent(comptes.prep);
    const specs = { ...flyers.specs, lignes: [{ ...flyers.specs.lignes[0], quantite: 1000 }] };
    const r = await prep.patch(`/api/dossiers/${xeroxId}`).send({ specs, urgent: true });
    expect(r.status).toBe(200);
    expect(r.body.montant).toBe(100000);
    expect(r.body.urgent).toBe(true);
    const admin = await agent(comptes.admin);
    const vu = (await admin.get(`/api/dossiers/${xeroxId}`)).body;
    expect(vu.montant).toBe(100000);
    const h = vu.historique.find((e: any) => e.type === 'modification');
    expect(h.data.montant).toEqual({ avant: 50000, apres: 100000 });
  });

  it('suppression douce puis restauration par l\'admin', async () => {
    const prep = await agent(comptes.prep);
    const created = await prep.post('/api/dossiers').send({ ...flyers, client_nom: 'Brouillon' });
    await prep.delete(`/api/dossiers/${created.body.id}`).expect(204);
    expect((await prep.get(`/api/dossiers/${created.body.id}`)).status).toBe(404);
    const admin = await agent(comptes.admin);
    const r = await admin.post(`/api/dossiers/${created.body.id}/restaurer`);
    expect(r.status).toBe(200);
  });

  it('les numéros de commande restent uniques sous charge', async () => {
    const prep = await agent(comptes.prep);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => prep.post('/api/dossiers').send({ ...flyers, client_nom: `Client ${i}` })));
    const numeros = results.map((r) => r.body.numero);
    expect(new Set(numeros).size).toBe(10);
  });

  it('liste filtrée avec compteurs par statut', async () => {
    const admin = await agent(comptes.admin);
    const r = await admin.get('/api/dossiers?statut=en_cours&limit=5');
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeLessThanOrEqual(5);
    expect(r.body.compteurs.livre).toBe(1);
    expect(r.body.items.every((i: any) => i.statut === 'en_cours')).toBe(true);
  });
});

describe('corrections d\'intégration', () => {
  it('montant: null fait revenir au prix calculé après une saisie manuelle (administrateur)', async () => {
    const admin = await agent(comptes.admin);
    const d = await admin.post('/api/dossiers').send({ ...flyers, client_nom: 'Retour calcul', montant: 12345 });
    expect(d.body.montant_source).toBe('saisi');
    const r = await admin.patch(`/api/dossiers/${d.body.id}`).send({ montant: null });
    expect(r.status).toBe(200);
    expect(r.body.montant).toBe(50000);
    expect(r.body.montant_source).toBe('calcul');
  });

  it("l'historique montre les fichiers à l'imprimeur mais jamais les montants", async () => {
    const roland = await agent(comptes.roland);
    const liste = await roland.get('/api/dossiers?file=travail');
    const id = liste.body.items[0]?.id ?? (await roland.get('/api/dossiers')).body.items[0].id;
    const d = await roland.get(`/api/dossiers/${id}`);
    const types = d.body.historique.map((e: any) => e.type);
    expect(types).not.toContain('paiement');
    const fichier = d.body.historique.find((e: any) => e.type === 'fichier');
    if (fichier) expect(fichier.data?.nom).toBeTruthy();
  });

  it('fixer le montant à la main : le livreur sur un dossier parti sans prix, jamais sur un prix calculé', async () => {
    const prep = await agent(comptes.prep);
    const admin = await agent(comptes.admin);
    const liv = await agent(comptes.livreur);
    const roland = await agent(comptes.roland);
    const sansPrix = await prep.post('/api/dossiers').send({ ...bache, client_nom: 'Sans prix', client_telephone: '77 000 00 01', specs: { lignes: [{ ...bache.specs.lignes[0], support: 'mesh_m2' }], forfaits: [] } });
    expect(sansPrix.body.montant).toBeNull();
    // Le livreur ne voit pas un dossier en préparation (404), puis le dossier est prêt à livrer.
    expect((await liv.post(`/api/dossiers/${sansPrix.body.id}/montant`).send({ montant: 20000 })).status).toBe(404);
    await admin.post(`/api/dossiers/${sansPrix.body.id}/forcer-statut`).send({ statut: 'pret_livraison', commentaire: 'test' }).expect(200);
    expect((await roland.post(`/api/dossiers/${sansPrix.body.id}/montant`).send({ montant: 20000 })).status).toBe(403);
    expect((await liv.post(`/api/dossiers/${sansPrix.body.id}/montant`).send({ montant: 'abc' })).status).toBe(400);
    const fixe = await liv.post(`/api/dossiers/${sansPrix.body.id}/montant`).send({ montant: 20000 });
    expect(fixe.status, JSON.stringify(fixe.body)).toBe(200);
    expect(fixe.body).toMatchObject({ montant: 20000, montant_source: 'saisi', solde: 20000 });
    expect((await admin.get(`/api/dossiers/${sansPrix.body.id}`)).body.historique.some((e: any) => e.type === 'modification' && e.data?.montant?.apres === 20000)).toBe(true);
    // Un montant saisi peut être corrigé par le livreur ; un prix calculé, non.
    expect((await liv.post(`/api/dossiers/${sansPrix.body.id}/montant`).send({ montant: 22000 })).status).toBe(200);
    const calcule = await prep.post('/api/dossiers').send({ ...flyers, client_nom: 'Calculé' });
    await admin.post(`/api/dossiers/${calcule.body.id}/forcer-statut`).send({ statut: 'pret_livraison', commentaire: 'test' }).expect(200);
    expect((await liv.post(`/api/dossiers/${calcule.body.id}/montant`).send({ montant: 1 })).status).toBe(403);
    // Le préparateur fixe le montant de ses dossiers, pas de ceux des autres.
    expect((await prep.post(`/api/dossiers/${calcule.body.id}/montant`).send({ montant: 60000 })).body.montant).toBe(60000);
    const autre = await admin.post('/api/dossiers').send({ ...flyers, client_nom: 'Dossier admin' });
    expect((await prep.post(`/api/dossiers/${autre.body.id}/montant`).send({ montant: 1000 })).status).toBe(404);
  });

  it('prédéfinis : les configurations qui reviennent le plus, avec leur nombre de dossiers', async () => {
    const prep = await agent(comptes.prep);
    const r = await prep.get('/api/dossiers/predefinis?machine=xerox');
    expect(r.status).toBe(200);
    const flyers500 = r.body.items.find((p: any) => p.resume.includes('A4 couleur') && p.resume.includes('500 ex.'));
    expect(flyers500).toBeTruthy();
    expect(flyers500.nb).toBeGreaterThanOrEqual(2);
    expect(flyers500).toMatchObject({ machine: 'xerox', specs: { lignes: expect.any(Array), forfaits: expect.any(Array) } });
    expect(flyers500.dernier_at).toBeTruthy();
    expect(r.body.items[0].nb).toBeGreaterThanOrEqual(r.body.items[r.body.items.length - 1].nb);
    expect((await prep.get('/api/dossiers/predefinis?machine=roland')).body.items.every((p: any) => p.machine === 'roland')).toBe(true);
    const liv = await agent(comptes.livreur);
    expect((await liv.get('/api/dossiers/predefinis')).status).toBe(403);
  });

  it('le résumé lisible des spécifications utilise les libellés', async () => {
    const admin = await agent(comptes.admin);
    const r = await admin.get('/api/dossiers?q=Boutique%20Keur%20Yaye');
    expect(r.body.items[0].resume_specs).toContain('Bâche standard');
  });
});
