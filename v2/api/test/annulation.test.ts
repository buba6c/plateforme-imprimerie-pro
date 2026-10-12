// Statut « annulé » : jamais supprimé, repris possible, droits du préparateur limités à avant l'atelier,
// notifications à ceux qui l'avaient en main.
import { beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { agent, app, comptes, envoyerFichier } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'prep2' | 'roland' | 'livreur', Agent>;

const bache = {
  machine: 'roland',
  client_nom: 'Client Annulation',
  client_telephone: '77 123 45 67',
  specs: { lignes: [{ support: 'bache_m2', largeur: 100, hauteur: 100, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
};

async function creer(a: Agent): Promise<number> {
  const r = await a.post('/api/dossiers').send(bache);
  expect(r.status).toBe(201);
  return r.body.id;
}

describe('annulation d’un dossier', () => {
  beforeAll(async () => {
    await app();
    A.admin = await agent(comptes.admin);
    A.prep = await agent(comptes.prep);
    A.prep2 = await agent(comptes.prep2);
    A.roland = await agent(comptes.roland);
    A.livreur = await agent(comptes.livreur);
  });

  it('le préparateur annule son dossier en préparation, avec un motif, puis le reprend', async () => {
    const id = await creer(A.prep);
    await A.prep.post(`/api/dossiers/${id}/urgence`).send({ urgent: true });
    const sans = await A.prep.post(`/api/dossiers/${id}/actions/annuler`).send({});
    expect(sans.status).toBe(409); // motif obligatoire
    const r = await A.prep.post(`/api/dossiers/${id}/actions/annuler`).send({ commentaire: 'Le client a renoncé' });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe('annule');
    expect(r.body.annule_at).toBeTruthy();
    expect(r.body.urgent).toBe(false);
    expect(r.body.actions).toEqual(['reprendre']);
    // Toujours là, dans l'onglet Annulés ; pas de modification ni de validation possible.
    const liste = await A.prep.get('/api/dossiers?statut=annule');
    expect(liste.body.items.map((d: { id: number }) => d.id)).toContain(id);
    expect((await A.prep.get(`/api/dossiers/${id}`)).body.historique.some((e: { action: string | null; commentaire: string | null }) => e.action === 'annuler' && e.commentaire === 'Le client a renoncé')).toBe(true);
    // Un autre préparateur ne le reprend pas.
    expect((await A.prep2.post(`/api/dossiers/${id}/actions/reprendre`).send({ commentaire: 'Erreur' })).status).toBe(404);
    const rep = await A.prep.post(`/api/dossiers/${id}/actions/reprendre`).send({ commentaire: 'Le client revient finalement' });
    expect(rep.status).toBe(200);
    expect(rep.body.statut).toBe('en_cours');
    expect(rep.body.annule_at).toBeNull();
    expect(rep.body.actions).toContain('valider');
  });

  it('à l’atelier, seul l’administrateur annule ; imprimeur et préparateur sont prévenus, les messages WhatsApp en attente sont annulés', async () => {
    const id = await creer(A.prep);
    expect((await envoyerFichier(A.prep, id, 'visuel.pdf', Buffer.alloc(100, 1))).status).toBe(204);
    expect((await A.prep.post(`/api/dossiers/${id}/actions/valider`).send({})).body.statut).toBe('pret_impression');
    expect((await A.roland.post(`/api/dossiers/${id}/actions/demarrer`).send({})).body.statut).toBe('en_impression');
    const refus = await A.prep.post(`/api/dossiers/${id}/actions/annuler`).send({ commentaire: 'Trop tard ?' });
    expect(refus.status).toBe(409);
    expect((await A.prep.get(`/api/dossiers/${id}`)).body.actions).not.toContain('annuler');
    // Un message WhatsApp en attente sur ce dossier
    await getPool().query(
      `INSERT INTO whatsapp_messages (dossier_id, evenement, telephone, texte, statut) VALUES ($1, 'prete_livraison', '+221771234567', 'test', 'en_attente')`,
      [id],
    );
    const r = await A.admin.post(`/api/dossiers/${id}/actions/annuler`).send({ commentaire: 'Commande annulée par le client' });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe('annule');
    const notifRoland = await A.roland.get('/api/notifications');
    expect(notifRoland.body.items.some((n: { type: string; dossier_id: number }) => n.type === 'annulation' && n.dossier_id === id)).toBe(true);
    const notifPrep = await A.prep.get('/api/notifications');
    expect(notifPrep.body.items.some((n: { type: string; dossier_id: number }) => n.type === 'annulation' && n.dossier_id === id)).toBe(true);
    const wa = await getPool().query(`SELECT statut, motif FROM whatsapp_messages WHERE dossier_id = $1`, [id]);
    expect(wa.rows[0]).toMatchObject({ statut: 'annule', motif: 'Dossier annulé' });
    // L'imprimeur ne le voit plus dans sa file de travail, mais toujours dans son historique.
    const file = await A.roland.get('/api/dossiers?file=travail');
    expect(file.body.items.map((d: { id: number }) => d.id)).not.toContain(id);
    expect((await A.roland.get(`/api/dossiers/${id}`)).status).toBe(200);
  });

  it('le livreur perd la livraison d’un dossier annulé en tournée ; le statut forcé « annulé » pose annule_at', async () => {
    const id = await creer(A.prep);
    await envoyerFichier(A.prep, id, 'visuel.pdf', Buffer.alloc(100, 1));
    await A.prep.post(`/api/dossiers/${id}/actions/valider`).send({});
    await A.roland.post(`/api/dossiers/${id}/actions/demarrer`).send({});
    await A.roland.post(`/api/dossiers/${id}/actions/marquer_imprime`).send({});
    const prog = await A.livreur.post(`/api/dossiers/${id}/actions/programmer_livraison`).send({ livraison: { date_prevue: '2026-12-01T10:00', adresse: 'Plateau' } });
    expect(prog.status).toBe(200);
    const r = await A.admin.post(`/api/dossiers/${id}/actions/annuler`).send({ commentaire: 'Adresse introuvable, client injoignable' });
    expect(r.status).toBe(200);
    const n = await A.livreur.get('/api/notifications');
    expect(n.body.items.some((x: { type: string; dossier_id: number }) => x.type === 'livraison_annulee' && x.dossier_id === id)).toBe(true);
    expect((await A.livreur.get('/api/dossiers')).body.items.map((d: { id: number }) => d.id)).not.toContain(id);

    const id2 = await creer(A.admin);
    const force = await A.admin.post(`/api/dossiers/${id2}/forcer-statut`).send({ statut: 'annule', commentaire: 'Doublon' });
    expect(force.status).toBe(200);
    expect(force.body.statut).toBe('annule');
    expect(force.body.annule_at).toBeTruthy();
    const retour = await A.admin.post(`/api/dossiers/${id2}/forcer-statut`).send({ statut: 'en_cours', commentaire: 'Finalement non' });
    expect(retour.body.annule_at).toBeNull();
  });
});
