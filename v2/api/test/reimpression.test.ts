// Réimpression / duplication, retrait sur place, cloisonnement des livreurs, prix figé par une facture,
// retour au prix calculé avec des spécifications envoyées.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { agent, app, comptes, envoyerFichier, PASSWORD } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'xerox' | 'livreur' | 'livreur3', Agent>;
const specs = { lignes: [{ support: 'papier_a4_couleur', pages: 2, recto_verso: false, quantite: 10, finitions: [], options: [] }], forfaits: [] };
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n', 'latin1');

async function dossier(extra: Record<string, unknown> = {}) {
  const r = await A.prep.post('/api/dossiers').send({ machine: 'xerox', client_nom: 'Client test réimpression', specs, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: number; numero: string; montant: number };
}

async function jusquImprime(id: number) {
  expect((await envoyerFichier(A.prep, id, 'travail.pdf', pdf)).status).toBe(204);
  expect((await A.prep.post(`/api/dossiers/${id}/actions/valider`).send({})).status).toBe(200);
  expect((await A.xerox.post(`/api/dossiers/${id}/actions/demarrer`).send({})).status).toBe(200);
  expect((await A.xerox.post(`/api/dossiers/${id}/actions/marquer_imprime`).send({})).status).toBe(200);
}

beforeAll(async () => {
  await app();
  for (const k of ['admin', 'prep', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);
  const u = await A.admin.post('/api/users').send({ nom: 'Livreur Trois', email: 'livreur3@evocom.test', role: 'livreur', password: PASSWORD });
  expect([201, 409]).toContain(u.status);
  await getPool().query(`UPDATE users SET is_active = true WHERE email = 'livreur3@evocom.test'`);
  A.livreur3 = await agent('livreur3@evocom.test');
});

afterAll(async () => {
  await getPool().query(`UPDATE users SET is_active = false WHERE email = 'livreur3@evocom.test'`);
  await getPool().query(`TRUNCATE notifications, journal, paiements, factures, dossier_events, fichiers, devis, dossiers, clients, compteurs RESTART IDENTITY CASCADE`);
});

describe('réimpression et duplication', () => {
  it('réimpression sans modification : nouvelle commande liée, mêmes fichiers, directement chez l’imprimeur', async () => {
    const o = await dossier();
    await jusquImprime(o.id);
    await A.xerox.post('/api/notifications/lues').send({});
    const r = await A.admin.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'reimpression', prix: 'gratuit', modifications: false, reprendre_fichiers: true, motif: 'Couleurs ternes' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.statut).toBe('pret_impression');
    const n = (await A.admin.get(`/api/dossiers/${r.body.id}`)).body;
    expect(n.montant).toBe(0);
    expect(n.origine_id).toBe(o.id);
    expect(n.origine_type).toBe('reimpression');
    expect(n.fichiers).toHaveLength(1);
    expect(n.consignes).toContain('Couleurs ternes');
    expect(n.liens.origine.numero).toBe(o.numero);
    const orig = (await A.admin.get(`/api/dossiers/${o.id}`)).body;
    expect(orig.liens.copies.map((c: { id: number }) => c.id)).toContain(r.body.id);
    expect(orig.historique.some((e: { type: string }) => e.type === 'reimpression')).toBe(true);
    const notif = (await A.xerox.get('/api/notifications?non_lues=1')).body.items;
    expect(notif.some((x: { dossier_id: number; titre: string }) => x.dossier_id === r.body.id && /Réimpression/.test(x.titre))).toBe(true);
  });

  it('avec modifications ou sans fichiers : la copie repart en préparation', async () => {
    const o = await dossier();
    const r = await A.admin.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'reimpression', prix: 'meme', modifications: true, reprendre_fichiers: true, motif: 'Changer le texte' });
    expect(r.body.statut).toBe('en_cours');
    expect((await A.admin.get(`/api/dossiers/${r.body.id}`)).body.montant).toBe(o.montant);
  });

  it('droits et validations', async () => {
    const o = await dossier();
    expect((await A.prep.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'reimpression', prix: 'meme', modifications: false, reprendre_fichiers: true, motif: 'abc' })).status).toBe(403);
    expect((await A.prep.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'nouvelle_commande', prix: 'grille', modifications: false, reprendre_fichiers: false })).status).toBe(201);
    expect((await A.admin.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'reimpression', prix: 'meme', modifications: false, reprendre_fichiers: true })).status).toBe(400);
    expect((await A.admin.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'nouvelle_commande', prix: 'manuel', modifications: false, reprendre_fichiers: false })).status).toBe(400);
    expect((await A.xerox.post(`/api/dossiers/${o.id}/dupliquer`).send({ type: 'nouvelle_commande', prix: 'meme', modifications: false, reprendre_fichiers: false })).status).toBe(403);
  });
});

describe('retrait sur place', () => {
  it('ne passe pas par le livreur ; le préparateur le remet au client', async () => {
    const o = await dossier({ mode_remise: 'retrait' });
    await jusquImprime(o.id);
    expect((await A.livreur.get(`/api/dossiers/${o.id}`)).status).toBe(404);
    expect((await A.admin.post(`/api/dossiers/${o.id}/actions/programmer_livraison`).send({ livraison: { date_prevue: '2030-01-01T10:00' } })).status).toBe(409);
    const d = (await A.prep.get(`/api/dossiers/${o.id}`)).body;
    expect(d.actions).toContain('remettre_client');
    expect(d.actions).not.toContain('confirmer_livraison');
    const r = await A.prep.post(`/api/dossiers/${o.id}/actions/remettre_client`).send({ encaissement: { montant: o.montant, mode: 'especes' } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.statut).toBe('livre');
    const apres = (await A.admin.get(`/api/dossiers/${o.id}`)).body;
    expect(apres.livre_at).toBeTruthy();
    expect(apres.paiements).toHaveLength(1);
  });

  it('un dossier à livrer ne propose pas « Remis au client »', async () => {
    const o = await dossier();
    await jusquImprime(o.id);
    expect((await A.prep.post(`/api/dossiers/${o.id}/actions/remettre_client`).send({})).status).toBe(409);
  });
});

describe('cloisonnement des livreurs', () => {
  it('un livreur ne confirme ni ne retire la tournée d’un autre', async () => {
    const o = await dossier();
    await jusquImprime(o.id);
    expect((await A.livreur.post(`/api/dossiers/${o.id}/actions/programmer_livraison`).send({ livraison: { date_prevue: '2030-01-01T10:00' } })).status).toBe(200);
    // La programmation désigne le livreur ; un autre ne peut plus agir.
    await getPool().query(`UPDATE dossiers SET livreur_id = (SELECT id FROM users WHERE email = $1) WHERE id = $2`, [comptes.livreur, o.id]);
    expect((await A.livreur3.post(`/api/dossiers/${o.id}/actions/confirmer_livraison`).send({})).status).toBe(409);
    expect((await A.livreur3.post(`/api/dossiers/${o.id}/actions/retirer_tournee`).send({})).status).toBe(409);
    expect((await A.livreur.post(`/api/dossiers/${o.id}/actions/confirmer_livraison`).send({})).status).toBe(200);
  });

  it('une action inconnue (« constructor ») renvoie 404, pas 500', async () => {
    const o = await dossier();
    expect((await A.admin.post(`/api/dossiers/${o.id}/actions/constructor`).send({})).status).toBe(404);
  });
});

describe('prix', () => {
  it('« revenir au prix calculé » avec les spécifications fonctionne', async () => {
    const o = await dossier({ montant: 99999 });
    const r = await A.prep.patch(`/api/dossiers/${o.id}`).send({ montant: null, specs });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.montant).not.toBe(99999);
    expect(r.body.montant_source).toBe('calcul');
  });

  it('un montant issu d’un devis ne bouge pas quand on change une précision', async () => {
    const o = await dossier();
    await getPool().query(`UPDATE dossiers SET montant = 12345, montant_source = 'devis' WHERE id = $1`, [o.id]);
    const s2 = { ...specs, lignes: [{ ...specs.lignes[0], description: 'Papier 170 g' }] };
    const r = await A.prep.patch(`/api/dossiers/${o.id}`).send({ specs: s2 });
    expect(r.status).toBe(200);
    expect(r.body.montant).toBe(12345);
  });

  it('le montant d’un dossier facturé est figé', async () => {
    const o = await dossier();
    expect((await A.admin.post(`/api/dossiers/${o.id}/facture`).send({})).status).toBe(201);
    const r = await A.admin.patch(`/api/dossiers/${o.id}`).send({ montant: o.montant + 1000 });
    expect(r.status).toBe(409);
  });
});
