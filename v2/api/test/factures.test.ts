// Factures : liste fiable (toutes par défaut, sans filtre caché), factures directes sans dossier,
// numérotation FAC commune aux deux origines, TVA selon les paramètres, PDF, annulation.
import { beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { totauxFactureDirecte } from '../src/modules/factures/routes';
import { agent, app, comptes } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'livreur', Agent>;
const ANNEE = new Date().getFullYear();

const bache = {
  machine: 'roland',
  client_nom: 'Boutique Keur Yaye',
  client_telephone: '77 412 58 90',
  description: 'Bâche façade',
  specs: { lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 200, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
};

const directe = {
  client_nom: 'Pharmacie du Point E',
  client_telephone: '33 824 10 10',
  client_email: 'contact@pharmacie-pointe.sn',
  client_adresse: 'Point E, Dakar',
  lignes: [
    { designation: 'Flyers A5 couleur', detail: '135 g, recto-verso', quantite: 500, unite: 'exemplaire', prix_unitaire: 90 },
    { designation: 'Conception graphique', quantite: 1, unite: 'forfait', prix_unitaire: 15000 },
  ],
  remise: 5000,
  notes: 'Livraison incluse.',
  conditions_paiement: 'Paiement à réception.',
};

function binaire(res: any, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

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

async function reglerPrix(prix: Record<string, unknown>) {
  const r = await A.admin.put('/api/parametres').send({ prix });
  expect(r.status).toBe(200);
  invalidateParametres();
}

beforeAll(async () => {
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

describe('liste des factures', () => {
  it('sans aucune facture : liste vide, total 0, aucune erreur (cause du « on ne voit aucune facture »)', async () => {
    const r = await A.admin.get('/api/factures');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ items: [], total: 0, somme_ttc: 0, compteurs: { emise: 0, annulee: 0 }, vosfactures_actif: false });
  });
});

describe('totaux d’une facture directe', () => {
  const lignes = [
    { designation: 'A', quantite: 3, unite: 'unite', prix_unitaire: 1000 },
    { designation: 'B', quantite: 1.5, unite: 'm2', prix_unitaire: 4000 },
  ];

  it('sans TVA : HT = TTC = lignes moins remise, remise sur une ligne explicite', () => {
    const t = totauxFactureDirecte(lignes, 500, { tva_applicable: false, tva_taux: 18, prix_saisis_ht: false });
    expect(t).toMatchObject({ sous_total: 9000, total_ht: 8500, tva: 0, total_ttc: 8500, tva_taux: 0 });
    expect(t.lignes.map((l) => l.total)).toEqual([3000, 6000, -500]);
  });

  it('TVA et prix saisis TTC : lignes ramenées au HT, somme exacte du HT', () => {
    const t = totauxFactureDirecte(lignes, 500, { tva_applicable: true, tva_taux: 18, prix_saisis_ht: false });
    expect(t.total_ttc).toBe(8500);
    expect(t.total_ht).toBe(Math.round(8500 / 1.18));
    expect(t.tva).toBe(8500 - t.total_ht);
    expect(t.lignes.reduce((s, l) => s + l.total, 0)).toBe(t.total_ht);
    expect(t.lignes[0]!.prix_unitaire).toBe(Math.round(1000 / 1.18));
  });

  it('TVA et prix saisis HT : la TVA s’ajoute', () => {
    const t = totauxFactureDirecte(lignes, 0, { tva_applicable: true, tva_taux: 18, prix_saisis_ht: true });
    expect(t).toMatchObject({ total_ht: 9000, tva: 1620, total_ttc: 10620, tva_taux: 18 });
    expect(t.lignes.reduce((s, l) => s + l.total, 0)).toBe(9000);
  });

  it('refuse une remise supérieure au total', () => {
    expect(() => totauxFactureDirecte(lignes, 10_000, { tva_applicable: false, tva_taux: 18, prix_saisis_ht: false })).toThrow(/remise/i);
  });
});

describe('facture directe (sans dossier)', () => {
  let directeId: number;
  let dossierId: number;

  it('refuse une facture sans ligne, à 0 ou avec une remise trop forte, avec les champs en cause', async () => {
    const vide = await A.prep.post('/api/factures').send({ client_nom: 'X', lignes: [] });
    expect(vide.status).toBe(400);
    expect(vide.body.champs.lignes).toMatch(/au moins une ligne/);
    const sansNom = await A.prep.post('/api/factures').send({ client_nom: '', lignes: directe.lignes });
    expect(sansNom.status).toBe(400);
    expect(sansNom.body.champs.client_nom).toBeTruthy();
    const zero = await A.prep.post('/api/factures').send({ client_nom: 'X', lignes: [{ designation: 'Offert', quantite: 1, unite: 'unite', prix_unitaire: 0 }] });
    expect(zero.status).toBe(400);
    expect(zero.body.error).toMatch(/supérieur à 0/);
    const remise = await A.prep.post('/api/factures').send({ client_nom: 'X', lignes: directe.lignes, remise: 999_999 });
    expect(remise.status).toBe(400);
    expect(remise.body.champs.remise).toBeTruthy();
    const decimale = await A.prep.post('/api/factures').send({ client_nom: 'X', lignes: [{ designation: 'A', quantite: 1, unite: 'unite', prix_unitaire: 10.5 }] });
    expect(decimale.status).toBe(400);
    expect(decimale.body.champs['lignes.0.prix_unitaire']).toMatch(/entier/);
    const echeance = await A.prep.post('/api/factures').send({ ...directe, date_emission: '2026-03-10', date_echeance: '2026-03-01' });
    expect(echeance.status).toBe(400);
    expect(echeance.body.champs.date_echeance).toBeTruthy();
    expect((await A.livreur.post('/api/factures').send(directe)).status).toBe(403);
  });

  it('crée la facture avec un client saisi (ajouté à l’annuaire), numéro FAC sans trou, lignes et remise', async () => {
    const r = await A.prep.post('/api/factures').send(directe);
    expect(r.status).toBe(201);
    directeId = r.body.id;
    expect(r.body).toMatchObject({
      numero: `FAC-${ANNEE}-0001`,
      statut: 'emise',
      dossier_id: null,
      dossier_numero: null,
      origine: 'directe',
      client_nom: 'Pharmacie du Point E',
      client_email: 'contact@pharmacie-pointe.sn',
      client_adresse: 'Point E, Dakar',
      total_ht: 55000,
      tva: 0,
      total_ttc: 55000,
      remise: 5000,
      notes: 'Livraison incluse.',
      conditions_paiement: 'Paiement à réception.',
      reste: null,
      situation_paiement: null,
      created_by_nom: expect.any(String),
      vosfactures: null,
    });
    expect(r.body.lignes).toEqual([
      { designation: 'Flyers A5 couleur', detail: '135 g, recto-verso', quantite: 500, unite: 'exemplaire', prix_unitaire: 90, total: 45000 },
      { designation: 'Conception graphique', detail: null, quantite: 1, unite: 'forfait', prix_unitaire: 15000, total: 15000 },
      { designation: 'Remise', detail: null, quantite: null, unite: null, prix_unitaire: null, total: -5000 },
    ]);
    expect(r.body.client_id).toBeGreaterThan(0);
    const clients = await A.prep.get('/api/clients/recherche?q=pharmacie');
    expect(clients.body).toHaveLength(1);
    expect(clients.body[0]).toMatchObject({ id: r.body.client_id, telephone: '33 824 10 10' });

    const journal = await getPool().query(`SELECT action, data FROM journal WHERE action = 'facture_emise' ORDER BY id DESC LIMIT 1`);
    expect(journal.rows[0].data).toMatchObject({ numero: `FAC-${ANNEE}-0001`, directe: true });
  });

  it('réutilise un client existant (client_id) et suit une fusion ; la fiche client affiche la facture', async () => {
    const c = await A.admin.post('/api/clients').send({ nom: 'Ancien nom', telephone: '70 000 00 00' });
    const cible = await A.admin.post('/api/clients').send({ nom: 'Groupe Diop', telephone: '70 111 11 11' });
    await A.admin.post(`/api/clients/${c.body.id}/fusionner`).send({ dans_id: cible.body.id }).expect(200);
    const r = await A.admin.post('/api/factures').send({
      client_id: c.body.id,
      client_nom: 'Groupe Diop',
      date_emission: '2026-02-01',
      date_echeance: '2026-03-03',
      lignes: [{ designation: 'Kakémono', quantite: 2, unite: 'unite', prix_unitaire: 25000 }],
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ numero: `FAC-${ANNEE}-0002`, client_id: cible.body.id, total_ttc: 50000, date_emission: '2026-02-01', date_echeance: '2026-03-03' });
    const inconnu = await A.admin.post('/api/factures').send({ client_id: 99_999, client_nom: 'X', lignes: directe.lignes });
    expect(inconnu.status).toBe(400);
    expect(inconnu.body.champs.client_id).toBeTruthy();
  });

  it('la numérotation reste commune et sans trou avec les factures de dossier ; la liste joint les dossiers en LEFT JOIN', async () => {
    const d = await A.prep.post('/api/dossiers').send(bache);
    dossierId = d.body.id;
    const f = await A.prep.post(`/api/dossiers/${dossierId}/facture`);
    expect(f.status).toBe(201);
    expect(f.body).toMatchObject({ numero: `FAC-${ANNEE}-0003`, origine: 'dossier', dossier_numero: d.body.numero, reste: 42000, situation_paiement: 'non_paye' });

    const liste = await A.admin.get('/api/factures');
    expect(liste.body.total).toBe(3);
    expect(liste.body.somme_ttc).toBe(55000 + 50000 + 42000);
    expect(liste.body.compteurs).toEqual({ emise: 3, annulee: 0 });
    expect(liste.body.items.map((x: any) => x.numero)).toEqual([`FAC-${ANNEE}-0003`, `FAC-${ANNEE}-0001`, `FAC-${ANNEE}-0002`]);
    const sansDossier = liste.body.items.find((x: any) => x.id === directeId);
    expect(sansDossier).toMatchObject({ dossier_id: null, dossier_numero: null, origine: 'directe', deja_paye: null, reste: null, situation_paiement: null, vosfactures: null });
    const avecDossier = liste.body.items.find((x: any) => x.id === f.body.id);
    expect(avecDossier).toMatchObject({ dossier_numero: d.body.numero, deja_paye: 0, situation_paiement: 'non_paye' });

    expect((await A.admin.get('/api/factures?q=pharmacie')).body.total).toBe(1);
    expect((await A.admin.get('/api/factures?origine=directe')).body.total).toBe(2);
    expect((await A.admin.get('/api/factures?origine=dossier')).body.total).toBe(1);
    expect((await A.admin.get('/api/factures?origine=autre')).status).toBe(400);
    expect((await A.admin.get('/api/factures?from=2026-02-01&to=2026-02-01')).body.total).toBe(1);
    expect((await A.admin.get(`/api/factures?client_id=${sansDossier.client_id}`)).body.total).toBe(1);
    expect((await A.admin.get('/api/factures?vosfactures=envoyee')).body.total).toBe(0);
    expect((await A.admin.get('/api/factures?vosfactures=non_envoyee')).body.total).toBe(3);
    expect((await A.admin.get('/api/factures?vosfactures=nimporte')).status).toBe(400);
  });

  it('PDF de la facture directe (sans dossier) et de la facture de dossier', async () => {
    for (const id of [directeId, dossierId ? (await A.admin.get(`/api/factures?dossier_id=${dossierId}`)).body.items[0].id : directeId]) {
      const pdf = await A.prep.get(`/api/factures/${id}/pdf`).buffer(true).parse(binaire);
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      expect((pdf.body as Buffer).length).toBeGreaterThan(1500);
    }
  });

  it('avec TVA (prix saisis TTC), les lignes sont hors taxes et la facture porte le taux', async () => {
    await reglerPrix({ tva_applicable: true, tva_taux: 18, prix_saisis_ht: false });
    const r = await A.prep.post('/api/factures').send({ client_nom: 'Client TVA', lignes: [{ designation: 'Roll-up', quantite: 1, unite: 'unite', prix_unitaire: 118000 }] });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ total_ttc: 118000, total_ht: 100000, tva: 18000, tva_taux: 18 });
    expect(r.body.lignes[0]).toMatchObject({ prix_unitaire: 100000, total: 100000 });
    await reglerPrix({ tva_applicable: true, tva_taux: 18, prix_saisis_ht: true });
    const ht = await A.prep.post('/api/factures').send({ client_nom: 'Client TVA', lignes: [{ designation: 'Roll-up', quantite: 1, unite: 'unite', prix_unitaire: 100000 }] });
    expect(ht.body).toMatchObject({ total_ttc: 118000, total_ht: 100000, tva: 18000 });
    await reglerPrix({ tva_applicable: false, prix_saisis_ht: false });
  });

  it('une facture directe reste immuable et s’annule comme les autres (administrateur, motif obligatoire)', async () => {
    await expect(getPool().query(`UPDATE factures SET total_ttc = 1 WHERE id = $1`, [directeId])).rejects.toThrow(/annulée/);
    expect((await A.prep.post(`/api/factures/${directeId}/annuler`).send({ motif: 'Erreur' })).status).toBe(403);
    const a = await A.admin.post(`/api/factures/${directeId}/annuler`).send({ motif: 'Doublon' });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ statut: 'annulee', motif_annulation: 'Doublon', numero: `FAC-${ANNEE}-0001` });
    const liste = await A.admin.get('/api/factures?statut=annulee');
    expect(liste.body.total).toBe(1);
    expect((await A.admin.get('/api/factures')).body.compteurs.annulee).toBe(1);
    const pdf = await A.prep.get(`/api/factures/${directeId}/pdf`).buffer(true).parse(binaire);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const suivante = await A.prep.post('/api/factures').send({ client_nom: 'Suivante', lignes: [{ designation: 'A', quantite: 1, unite: 'unite', prix_unitaire: 1000 }] });
    expect(suivante.body.numero).toBe(`FAC-${ANNEE}-0006`);
  });
});
