import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes, envoyerFichier } from './helpers';

type Agent = supertest.Agent;

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

const ANNEE = new Date().getFullYear();

/** Lit le corps brut (PDF, CSV) sans transformation. */
function binaire(res: any, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

/** Jour civil (AAAA-MM-JJ) à Dakar, décalé de n jours. */
function jour(decalage = 0): string {
  const d = new Date(Date.now() + decalage * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Repart de tables métier vides (les comptes et les tarifs sont conservés). */
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

const A = {} as Record<'admin' | 'prep' | 'roland' | 'xerox' | 'livreur', Agent>;

beforeAll(async () => {
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'roland', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

afterAll(async () => {
  // Laisse une base propre aux autres fichiers de test, quel que soit l'ordre d'exécution.
  await viderDonnees();
});

/** Dossier Roland validé (avec un fichier), prêt pour l'imprimeur. */
async function dossierRolandValide(extra: Record<string, unknown> = {}) {
  const r = await A.prep.post('/api/dossiers').send({ ...bache, ...extra });
  expect(r.status).toBe(201);
  const up = await envoyerFichier(A.prep, r.body.id, 'façade.pdf', Buffer.from('%PDF-1.4\n%test\n'));
  expect(up.status).toBe(204);
  const v = await A.prep.post(`/api/dossiers/${r.body.id}/actions/valider`).send({});
  expect(v.body.statut).toBe('pret_impression');
  return r.body as { id: number; numero: string; montant: number };
}

// ---------------------------------------------------------------------------

describe('notifications', () => {
  it("le préparateur est notifié quand l'imprimeur demande une révision, et marque comme lu", async () => {
    const d = await dossierRolandValide();
    const rev = await A.roland.post(`/api/dossiers/${d.id}/actions/demander_revision`).send({ commentaire: 'Fichier en basse résolution' });
    expect(rev.status).toBe(200);
    expect(rev.body.statut).toBe('a_revoir');

    const liste = await A.prep.get('/api/notifications');
    expect(liste.status).toBe(200);
    const n = liste.body.items.find((i: any) => i.type === 'revision' && i.dossier_id === d.id);
    expect(n).toBeTruthy();
    expect(n.titre).toContain(d.numero);
    expect(n.message).toBe('Fichier en basse résolution');
    expect(n.lu_at).toBeNull();
    expect(liste.body.non_lues).toBeGreaterThanOrEqual(1);

    // Un autre utilisateur ne peut pas marquer la notification du préparateur.
    await A.roland.post('/api/notifications/lues').send({ ids: [n.id] }).expect(204);
    const toujours = await A.prep.get('/api/notifications?non_lues=1');
    expect(toujours.body.items.some((i: any) => i.id === n.id)).toBe(true);

    await A.prep.post('/api/notifications/lues').send({ ids: [n.id] }).expect(204);
    const apres = await A.prep.get('/api/notifications?non_lues=1');
    expect(apres.body.items.some((i: any) => i.id === n.id)).toBe(false);
    expect(apres.body.non_lues).toBe(liste.body.non_lues - 1);

    await A.prep.post('/api/notifications/lues').send({}).expect(204);
    expect((await A.prep.get('/api/notifications')).body.non_lues).toBe(0);

    const invalide = await A.prep.post('/api/notifications/lues').send({ ids: 'tout' });
    expect(invalide.status).toBe(400);
  });
});

describe('paramètres', () => {
  it('lecture pour tous, écriture réservée à l’administrateur', async () => {
    const r = await A.livreur.get('/api/parametres');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['entreprise', 'fuseau', 'livreur_jours_historique', 'prix']);
    expect(r.body.fuseau).toBe('Africa/Dakar');
    expect((await A.prep.put('/api/parametres').send({ livreur_jours_historique: 3 })).status).toBe(403);
  });

  it('refuse les valeurs hors bornes et les fuseaux inconnus', async () => {
    const r = await A.admin.put('/api/parametres').send({ prix: { arrondi_pas: 2.5, tva_taux: 150 }, livreur_jours_historique: 0 });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.champs)).toEqual(expect.arrayContaining(['prix.arrondi_pas', 'prix.tva_taux', 'livreur_jours_historique']));
    const tz = await A.admin.put('/api/parametres').send({ fuseau: 'Mars/Olympus' });
    expect(tz.status).toBe(400);
    expect(tz.body.error).toContain('Mars/Olympus');
    const long = await A.admin.put('/api/parametres').send({ entreprise: { nom: 'x'.repeat(201) } });
    expect(long.status).toBe(400);
  });

  it("enregistre, journalise et s'applique au calcul des prix (arrondi_pas 0)", async () => {
    const spec = { machine: 'roland', specs: { lignes: [{ support: 'bache_m2', largeur: 110, hauteur: 130, unite: 'cm', quantite: 1 }] } };
    const avant = await A.prep.post('/api/tarifs/estimer').send(spec);
    expect(avant.body.total_ttc).toBe(10100); // 1,43 m² x 7 000 = 10 010, arrondi à 100

    const r = await A.admin.put('/api/parametres').send({
      entreprise: { nom: 'Evocom Print SARL', adresse: 'Rue 10, Dakar', ninea: '005551234', pied_facture: 'Merci de votre confiance.' },
      prix: { arrondi_pas: 0 },
    });
    expect(r.status).toBe(200);
    expect(r.body.prix.arrondi_pas).toBe(0);
    expect(r.body.prix.tva_taux).toBe(18); // champs non fournis conservés
    expect(r.body.entreprise.nom).toBe('Evocom Print SARL');
    expect(r.body.entreprise.telephone).toBe('');

    expect((await A.livreur.get('/api/parametres')).body.entreprise.ninea).toBe('005551234');
    const apres = await A.prep.post('/api/tarifs/estimer').send(spec);
    expect(apres.body.total_ttc).toBe(10010);

    const j = await A.admin.get('/api/journal?action=parametres_modifies');
    expect(j.body.total).toBe(1);
    expect(j.body.items[0].data.prix.avant.arrondi_pas).toBe(100);
    expect(j.body.items[0].user_nom).toBe('Awa Ndiaye');

    await A.admin.put('/api/parametres').send({ prix: { arrondi_pas: 100 } }).expect(200);
  });
});

describe('clients', () => {
  let terangaId: number;
  let doublonId: number;

  it('crée, refuse un doublon exact et propose les clients en autocomplétion', async () => {
    const c = await A.prep.post('/api/clients').send({ nom: 'Imprimerie Teranga', telephone: '77 000 11 22', email: 'contact@teranga.sn' });
    expect(c.status).toBe(201);
    terangaId = c.body.id;
    expect(c.body.totaux).toEqual({ nb_dossiers: 0, total_commandes: 0, total_paye: 0, reste_du: 0 });
    const doublon = await A.prep.post('/api/clients').send({ nom: 'imprimerie teranga ', telephone: '77 000 11 22' });
    expect(doublon.status).toBe(409);
    expect(doublon.body.details.client_id).toBe(terangaId);
    const d2 = await A.prep.post('/api/clients').send({ nom: 'Teranga Impression', adresse: 'Thiès' });
    expect(d2.status).toBe(201);
    doublonId = d2.body.id;
    expect((await A.prep.post('/api/clients').send({ nom: '' })).status).toBe(400);

    const r = await A.prep.get('/api/clients/recherche?q=teran');
    expect(r.status).toBe(200);
    expect(r.body.map((x: any) => x.id)).toEqual(expect.arrayContaining([terangaId, doublonId]));
    expect(Object.keys(r.body[0]).sort()).toEqual(['email', 'id', 'nom', 'telephone']);
    const tel = await A.prep.get('/api/clients/recherche?q=770001');
    expect(tel.body.map((x: any) => x.id)).toEqual([terangaId]);
    expect((await A.prep.get('/api/clients/recherche?q=')).body).toEqual([]);
    expect((await A.livreur.get('/api/clients/recherche?q=ter')).status).toBe(403);
  });

  it('agrège les dossiers du client, puis fusionne deux fiches', async () => {
    const d = await A.prep.post('/api/dossiers').send({ ...flyers, client_id: doublonId, client_nom: 'Teranga Impression' });
    expect(d.status).toBe(201);
    expect(d.body.client_id).toBe(doublonId);
    const liste = await A.prep.get('/api/clients?q=teranga');
    const ligne = liste.body.items.find((c: any) => c.id === doublonId);
    expect(ligne).toMatchObject({ nb_dossiers: 1, total_commandes: 50000, reste_du: 50000 });
    expect(ligne.dernier_dossier_at).toBeTruthy();

    expect((await A.prep.post(`/api/clients/${doublonId}/fusionner`).send({ dans_id: terangaId })).status).toBe(403);
    expect((await A.admin.post(`/api/clients/${doublonId}/fusionner`).send({ dans_id: doublonId })).status).toBe(400);
    const f = await A.admin.post(`/api/clients/${doublonId}/fusionner`).send({ dans_id: terangaId });
    expect(f.status).toBe(200);
    expect(f.body.id).toBe(terangaId);
    expect(f.body.fusion.dossiers).toBe(1);
    expect(f.body.adresse).toBe('Thiès'); // coordonnée manquante reprise de la fiche fusionnée
    expect(f.body.totaux).toMatchObject({ nb_dossiers: 1, total_commandes: 50000, total_paye: 0, reste_du: 50000 });
    expect(f.body.dossiers[0].id).toBe(d.body.id);

    const source = await A.prep.get(`/api/clients/${doublonId}`);
    expect(source.body.fusionne_dans).toBe(terangaId);
    const r = await A.prep.get('/api/clients/recherche?q=teran');
    expect(r.body.map((x: any) => x.id)).toEqual([terangaId]);
    expect((await A.admin.post(`/api/clients/${doublonId}/fusionner`).send({ dans_id: terangaId })).status).toBe(409);
    expect((await A.prep.patch(`/api/clients/${doublonId}`).send({ notes: 'x' })).status).toBe(409);

    const j = await A.admin.get('/api/journal?action=client_fusionne');
    expect(j.body.items[0].data.destination.id).toBe(terangaId);

    const p = await A.prep.patch(`/api/clients/${terangaId}`).send({ notes: 'Client fidèle' });
    expect(p.status).toBe(200);
    expect(p.body.notes).toBe('Client fidèle');
  });
});

describe('paiements', () => {
  let dossierId: number;

  it('encaissement à valider, refus du dépassement, validation et solde', async () => {
    const d = await A.prep.post('/api/dossiers').send(bache);
    dossierId = d.body.id;
    expect(d.body.montant).toBe(45000);

    const p1 = await A.prep.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 20000, mode: 'especes' });
    expect(p1.status).toBe(201);
    expect(p1.body).toMatchObject({ statut: 'a_valider', montant: 20000, numero: d.body.numero, encaisse_par_nom: 'Fatou Sarr' });

    const trop = await A.prep.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 30000, mode: 'especes' });
    expect(trop.status).toBe(409);
    const sansRef = await A.prep.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 1000, mode: 'wave' });
    expect(sansRef.status).toBe(400);
    expect((await A.roland.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 1000, mode: 'especes' })).status).toBe(403);
    // Le livreur ne voit pas un dossier en préparation : il ne peut pas y encaisser.
    expect((await A.livreur.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 1000, mode: 'especes' })).status).toBe(404);

    expect((await A.prep.post(`/api/paiements/${p1.body.id}/valider`)).status).toBe(403);

    const aValider = await A.admin.get('/api/paiements?statut=a_valider');
    expect(aValider.body.total).toBe(1);
    expect(aValider.body.somme).toBe(20000);
    expect((await A.admin.get('/api/paiements?statut=inconnu')).status).toBe(400);

    const v = await A.admin.post(`/api/paiements/${p1.body.id}/valider`);
    expect(v.status).toBe(200);
    expect(v.body).toMatchObject({ statut: 'valide', valide_par_nom: 'Awa Ndiaye' });
    expect((await A.admin.post(`/api/paiements/${p1.body.id}/valider`)).status).toBe(409);

    const fiche = await A.prep.get(`/api/dossiers/${dossierId}`);
    expect(fiche.body.deja_paye).toBe(20000);
    expect(fiche.body.solde).toBe(25000);
    expect(fiche.body.situation_paiement).toBe('partiel');
    expect(fiche.body.historique.map((e: any) => e.action)).toEqual(expect.arrayContaining(['encaisse', 'valide']));

    const notifs = await A.prep.get('/api/notifications');
    expect(notifs.body.items.some((n: any) => n.type === 'paiement_valide' && n.dossier_id === dossierId)).toBe(true);
  });

  it('le refus exige un motif et notifie ; un paiement refusé ne se valide plus', async () => {
    const p = await A.prep.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 5000, mode: 'orange_money', reference: 'OM-778899' });
    expect(p.status).toBe(201);
    const sans = await A.admin.post(`/api/paiements/${p.body.id}/refuser`).send({});
    expect(sans.status).toBe(400);
    expect(sans.body.error).toContain('motif');
    expect((await A.prep.post(`/api/paiements/${p.body.id}/refuser`).send({ motif: 'Doublon' })).status).toBe(403);
    const r = await A.admin.post(`/api/paiements/${p.body.id}/refuser`).send({ motif: 'Transaction introuvable chez Orange Money' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ statut: 'refuse', motif_refus: 'Transaction introuvable chez Orange Money' });
    expect((await A.admin.post(`/api/paiements/${p.body.id}/valider`)).status).toBe(409);
    expect((await A.admin.post(`/api/paiements/${p.body.id}/refuser`).send({ motif: 'Encore' })).status).toBe(409);
    const notifs = await A.prep.get('/api/notifications');
    expect(notifs.body.items.some((n: any) => n.type === 'paiement_refuse')).toBe(true);
  });

  it("l'administrateur encaisse validé d'office ; plus rien ne dépasse le montant", async () => {
    const p = await A.admin.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 25000, mode: 'especes' });
    expect(p.status).toBe(201);
    expect(p.body.statut).toBe('valide');
    const fiche = await A.admin.get(`/api/dossiers/${dossierId}`);
    expect(fiche.body.deja_paye).toBe(45000);
    expect(fiche.body.situation_paiement).toBe('paye');
    expect((await A.prep.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 1, mode: 'especes' })).status).toBe(409);
  });

  it('revérifie le montant à la validation', async () => {
    const d = await A.prep.post('/api/dossiers').send(flyers); // 50 000
    const p = await A.prep.post(`/api/dossiers/${d.body.id}/paiements`).send({ montant: 30000, mode: 'especes' });
    expect(p.status).toBe(201);
    await A.admin.patch(`/api/dossiers/${d.body.id}`).send({ montant: 20000 }).expect(200);
    const v = await A.admin.post(`/api/paiements/${p.body.id}/valider`);
    expect(v.status).toBe(409);
    expect(v.body.details).toEqual({ deja_paye: 0, montant_dossier: 20000 });
  });

  it('chacun voit ses encaissements ; la caisse résume par encaisseur et par mode', async () => {
    const mine = await A.prep.get('/api/paiements');
    expect(mine.status).toBe(200);
    expect(mine.body.items.length).toBeGreaterThan(0);
    expect(mine.body.items.every((p: any) => p.encaisse_par_nom === 'Fatou Sarr')).toBe(true);
    const liv = await A.livreur.get('/api/paiements');
    expect(liv.body).toMatchObject({ items: [], total: 0, somme: 0 });
    expect((await A.roland.get('/api/paiements')).status).toBe(403);

    const caisse = await A.admin.get('/api/caisse');
    expect(caisse.status).toBe(200);
    const prep = caisse.body.par_encaisseur.find((e: any) => e.nom === 'Fatou Sarr');
    expect(prep.a_valider).toEqual({ n: 1, somme: 30000 });
    expect(prep.valide_aujourdhui).toEqual({ n: 1, somme: 20000 });
    const admin = caisse.body.par_encaisseur.find((e: any) => e.nom === 'Awa Ndiaye');
    expect(admin.valide_aujourdhui).toEqual({ n: 1, somme: 25000 });
    const especes = caisse.body.par_mode.find((m: any) => m.mode === 'especes');
    expect(especes.valide_aujourdhui).toEqual({ n: 2, somme: 45000 });
    expect(caisse.body.totaux.a_valider).toEqual({ n: 1, somme: 30000 });
    expect((await A.prep.get('/api/caisse')).status).toBe(403);
  });
});

describe('devis', () => {
  let devisId: number;
  let dossierId: number;

  it('chiffre avec le moteur et refuse un devis incalculable (422)', async () => {
    const r = await A.prep.post('/api/devis').send({ ...flyers, description: 'Flyers fête de quartier', notes: 'Livraison possible' });
    expect(r.status).toBe(201);
    expect(r.body.numero).toBe(`DEV-${ANNEE}-0001`);
    expect(r.body).toMatchObject({ statut: 'brouillon', total_ttc: 50000, validite_jours: 15, peut_modifier: true, peut_supprimer: true });
    expect(r.body.detail_prix.lignes[0].total).toBe(50000);
    expect(r.body.transitions).toEqual(['envoye']);
    devisId = r.body.id;

    const ko = await A.prep.post('/api/devis').send({ ...bache, specs: { lignes: [{ ...bache.specs.lignes[0], support: 'mesh_m2' }] } });
    expect(ko.status).toBe(422);
    expect(ko.body.details.erreurs[0]).toContain('Bâche mesh');
    expect((await A.prep.post('/api/devis').send({ ...flyers, specs: { lignes: [] } })).status).toBe(422);
    expect((await A.livreur.get('/api/devis')).status).toBe(403);
  });

  it('recalcule à la modification et suit le circuit des statuts', async () => {
    const p = await A.prep.patch(`/api/devis/${devisId}`).send({ specs: { lignes: [{ ...flyers.specs.lignes[0], quantite: 1000 }] } });
    expect(p.status).toBe(200);
    expect(p.body.total_ttc).toBe(100000);
    expect((await A.prep.post(`/api/devis/${devisId}/convertir`)).status).toBe(409);
    expect((await A.prep.post(`/api/devis/${devisId}/statut`).send({ statut: 'accepte' })).status).toBe(409);
    expect((await A.prep.post(`/api/devis/${devisId}/statut`).send({ statut: 'converti' })).status).toBe(400);
    const e = await A.prep.post(`/api/devis/${devisId}/statut`).send({ statut: 'envoye' });
    expect(e.status).toBe(200);
    expect(e.body.transitions).toEqual(['accepte', 'refuse']);
    expect((await A.prep.post(`/api/devis/${devisId}/statut`).send({ statut: 'accepte' })).body.statut).toBe('accepte');
    expect((await A.prep.patch(`/api/devis/${devisId}`).send({ notes: 'trop tard' })).status).toBe(409);
    expect((await A.prep.delete(`/api/devis/${devisId}`)).status).toBe(409);
    const liste = await A.prep.get('/api/devis?statut=accepte');
    expect(liste.body.total).toBe(1);
    expect(liste.body.items[0].id).toBe(devisId);
  });

  it('convertit en dossier au montant du devis, une seule fois', async () => {
    const c = await A.prep.post(`/api/devis/${devisId}/convertir`).send({ urgent: true });
    expect(c.status).toBe(201);
    dossierId = c.body.dossier_id;
    const d = await A.prep.get(`/api/dossiers/${dossierId}`);
    expect(d.body).toMatchObject({ montant: 100000, montant_source: 'devis', devis_id: devisId, urgent: true, client_nom: 'Mairie de Pikine' });
    expect(d.body.detail_prix.total_ttc).toBe(100000);
    const dv = await A.prep.get(`/api/devis/${devisId}`);
    expect(dv.body).toMatchObject({ statut: 'converti', dossier_id: dossierId, peut_convertir: false });
    expect(dv.body.dossier_numero).toBe(d.body.numero);
    const encore = await A.prep.post(`/api/devis/${devisId}/convertir`);
    expect(encore.status).toBe(409);
    expect(encore.body.details.dossier_id).toBe(dossierId);
  });

  it('deux conversions simultanées ne créent qu’un dossier', async () => {
    const r = await A.prep.post('/api/devis').send(flyers);
    await A.prep.post(`/api/devis/${r.body.id}/statut`).send({ statut: 'envoye' }).expect(200);
    const [a, b] = await Promise.all([A.prep.post(`/api/devis/${r.body.id}/convertir`), A.admin.post(`/api/devis/${r.body.id}/convertir`)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const n = await getPool().query(`SELECT count(*)::int AS n FROM dossiers WHERE devis_id = $1`, [r.body.id]);
    expect(n.rows[0].n).toBe(1);
  });

  it("un préparateur ne voit que ses devis ; l'administrateur les voit tous", async () => {
    const r = await A.admin.post('/api/devis').send({ ...flyers, client_nom: 'Devis admin' });
    expect(r.status).toBe(201);
    expect((await A.prep.get(`/api/devis/${r.body.id}`)).status).toBe(404);
    expect((await A.prep.get(`/api/devis/${r.body.id}/pdf`)).status).toBe(404);
    expect((await A.prep.post(`/api/devis/${r.body.id}/statut`).send({ statut: 'envoye' })).status).toBe(404);
    const liste = await A.prep.get('/api/devis?limit=200');
    expect(liste.body.items.some((d: any) => d.id === r.body.id)).toBe(false);
    const tous = await A.admin.get('/api/devis?q=devis admin');
    expect(tous.body.items.map((d: any) => d.id)).toEqual([r.body.id]);
  });

  it('supprime un brouillon et produit le PDF', async () => {
    const r = await A.prep.post('/api/devis').send(bache);
    const pdf = await A.prep.get(`/api/devis/${r.body.id}/pdf`).buffer(true).parse(binaire);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(`Devis ${r.body.numero}.pdf`);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.body as Buffer).length).toBeGreaterThan(1500);
    await A.prep.delete(`/api/devis/${r.body.id}`).expect(204);
    expect((await A.prep.get(`/api/devis/${r.body.id}`)).status).toBe(404);
  });
});

describe('factures', () => {
  let rolandId: number;
  let factureId: number;

  it('émet la facture d’un dossier (lignes du détail de prix), une seule fois, numéros sans trou', async () => {
    const d = await A.prep.post('/api/dossiers').send({ ...bache, client_nom: 'Hôtel Saly' });
    rolandId = d.body.id;
    const sansMontant = await A.prep.post('/api/dossiers').send({ ...flyers, client_nom: 'Sans prix', specs: { lignes: [] } });
    expect(sansMontant.body.montant).toBeNull();
    const ko = await A.prep.post(`/api/dossiers/${sansMontant.body.id}/facture`);
    expect(ko.status).toBe(409);
    expect(ko.body.error).toContain('montant');

    const f = await A.prep.post(`/api/dossiers/${rolandId}/facture`);
    expect(f.status).toBe(201);
    factureId = f.body.id;
    expect(f.body).toMatchObject({ numero: `FAC-${ANNEE}-0001`, statut: 'emise', total_ttc: 45000, total_ht: 45000, tva: 0, client_nom: 'Hôtel Saly' });
    expect(f.body.lignes.map((l: any) => l.designation)).toEqual(['Bâche standard', 'Découpe à la forme']);
    expect(f.body.lignes.reduce((s: number, l: any) => s + l.total, 0)).toBe(45000);
    expect(f.body.lignes[0].detail).toContain('300 × 200 cm');
    expect(f.body).toMatchObject({ deja_paye: 0, reste: 45000, situation_paiement: 'non_paye' });

    const deux = await A.prep.post(`/api/dossiers/${rolandId}/facture`);
    expect(deux.status).toBe(409);
    expect(deux.body.details.facture_id).toBe(factureId);

    // Dossier issu d'un devis : facture suivante, sans trou malgré les refus précédents.
    const devisDossier = (await A.admin.get('/api/dossiers?q=pikine&tri=ancien')).body.items.find((i: any) => i.devis_id);
    const f2 = await A.admin.post(`/api/dossiers/${devisDossier.id}/facture`);
    expect(f2.status).toBe(201);
    expect(f2.body.numero).toBe(`FAC-${ANNEE}-0002`);
    expect(f2.body.total_ttc).toBe(100000);
    expect((await A.livreur.post(`/api/dossiers/${rolandId}/facture`)).status).toBe(403);

    const fiche = await A.prep.get(`/api/dossiers/${rolandId}`);
    expect(fiche.body.facture.numero).toBe(`FAC-${ANNEE}-0001`);
  });

  it('avec TVA, les lignes sont ramenées au hors taxes et totalisent exactement le HT', async () => {
    const { lignesFacture } = await import('../src/modules/factures/routes');
    const { calculerPrix, TARIFS_DEFAUT, ventilerTTC } = await import('@evocom/shared');
    for (const prixSaisisHt of [false, true]) {
      const prix = { arrondi_pas: 100, tva_applicable: true, tva_taux: 18, prix_saisis_ht: prixSaisisHt, surface_min_m2: 0 };
      const detail = calculerPrix('roland', bache.specs as any, TARIFS_DEFAUT, prix);
      if (!detail.ok) throw new Error('prix');
      const v = ventilerTTC(detail.total_ttc, prix);
      const lignes = lignesFacture({ numero: 'CMD-X', machine: 'roland', specs: bache.specs, detail_prix: detail, montant: detail.total_ttc } as any, { ...PARAMETRES_DEFAUT, prix }, v.ht);
      expect(lignes.reduce((s2, l) => s2 + l.total, 0)).toBe(v.ht);
      expect(lignes[0]!.designation).toBe('Bâche standard');
      if (!prixSaisisHt) expect(lignes[0]!.total).toBe(Math.round(42000 / 1.18));
    }
  });

  it('une facture sans détail de prix porte une ligne « Travaux d’impression »', async () => {
    const d = await A.prep.post('/api/dossiers').send({ ...flyers, client_nom: 'Forfait', specs: { lignes: [] }, montant: 12000 });
    const f = await A.prep.post(`/api/dossiers/${d.body.id}/facture`);
    expect(f.status).toBe(201);
    expect(f.body.lignes).toHaveLength(1);
    expect(f.body.lignes[0]).toMatchObject({ designation: `Travaux d'impression ${d.body.numero}`, total: 12000 });
  });

  it('liste avec somme, situation de paiement et PDF', async () => {
    await A.admin.post(`/api/dossiers/${rolandId}/paiements`).send({ montant: 15000, mode: 'especes' }).expect(201);
    const f = await A.prep.get(`/api/factures/${factureId}`);
    expect(f.body).toMatchObject({ deja_paye: 15000, reste: 30000, situation_paiement: 'partiel', dossier_numero: expect.stringMatching(/^CMD-/) });
    const liste = await A.prep.get('/api/factures');
    expect(liste.body.total).toBe(3);
    expect(liste.body.somme_ttc).toBe(45000 + 100000 + 12000);
    expect((await A.prep.get('/api/factures?q=hôtel')).body.total).toBe(1);
    expect((await A.prep.get(`/api/factures?from=${jour(1)}`)).body.total).toBe(0);
    expect((await A.prep.get('/api/factures?from=2026-13-01')).status).toBe(400);
    expect((await A.roland.get('/api/factures')).status).toBe(403);

    const pdf = await A.prep.get(`/api/factures/${factureId}/pdf`).buffer(true).parse(binaire);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it("l'annulation exige un motif, garde le numéro et libère le dossier", async () => {
    expect((await A.prep.post(`/api/factures/${factureId}/annuler`).send({ motif: 'Erreur' })).status).toBe(403);
    expect((await A.admin.post(`/api/factures/${factureId}/annuler`).send({})).status).toBe(400);
    const a = await A.admin.post(`/api/factures/${factureId}/annuler`).send({ motif: 'Erreur sur le client' });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ statut: 'annulee', motif_annulation: 'Erreur sur le client', numero: `FAC-${ANNEE}-0001`, annulee_par_nom: 'Awa Ndiaye' });
    expect((await A.admin.post(`/api/factures/${factureId}/annuler`).send({ motif: 'Encore' })).status).toBe(409);
    const liste = await A.prep.get('/api/factures');
    expect(liste.body.somme_ttc).toBe(100000 + 12000);
    const pdf = await A.prep.get(`/api/factures/${factureId}/pdf`).buffer(true).parse(binaire);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const nouvelle = await A.prep.post(`/api/dossiers/${rolandId}/facture`);
    expect(nouvelle.status).toBe(201);
    expect(nouvelle.body.numero).toBe(`FAC-${ANNEE}-0004`);
  });
});

describe('bon de travail', () => {
  it("PDF pour l'imprimeur de la machine, refusé aux autres", async () => {
    const d = await dossierRolandValide({ urgent: true, consignes: 'Œillets tous les 50 cm — couleurs fidèles au BAT', date_promise: jour(2) });
    const r = await A.roland.get(`/api/dossiers/${d.id}/bon-de-travail.pdf`).buffer(true).parse(binaire);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toContain('Bon de travail');
    expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await A.prep.get(`/api/dossiers/${d.id}/bon-de-travail.pdf`)).status).toBe(200);
    expect((await A.xerox.get(`/api/dossiers/${d.id}/bon-de-travail.pdf`)).status).toBe(404);
    expect((await A.livreur.get(`/api/dossiers/${d.id}/bon-de-travail.pdf`)).status).toBe(403);
    // Les routes existantes des dossiers ne sont pas masquées.
    expect((await A.roland.get(`/api/dossiers/${d.id}`)).body.numero).toBe(d.numero);
  });
});

describe('administration', () => {
  it('journal paginé et filtré, corbeille, santé', async () => {
    const j = await A.admin.get('/api/journal?limit=2');
    expect(j.status).toBe(200);
    expect(j.body.items).toHaveLength(2);
    expect(j.body.total).toBeGreaterThan(2);
    const filtre = await A.admin.get('/api/journal?action=paiement_valide,paiement_refuse');
    expect(filtre.body.items.every((i: any) => ['paiement_valide', 'paiement_refuse'].includes(i.action))).toBe(true);
    expect(filtre.body.total).toBe(2);
    expect((await A.admin.get(`/api/journal?from=${jour(1)}`)).body.total).toBe(0);
    expect((await A.prep.get('/api/journal')).status).toBe(403);

    const d = await A.prep.post('/api/dossiers').send({ ...flyers, client_nom: 'À supprimer' });
    await A.prep.delete(`/api/dossiers/${d.body.id}`).send({ motif: 'Créé par erreur' }).expect(204);
    const c = await A.admin.get('/api/corbeille');
    expect(c.status).toBe(200);
    expect(c.body[0]).toMatchObject({ id: d.body.id, numero: d.body.numero, client_nom: 'À supprimer', deleted_by_nom: 'Fatou Sarr', motif: 'Créé par erreur' });
    expect((await A.prep.get('/api/corbeille')).status).toBe(403);

    await getPool().query(`INSERT INTO sauvegardes (ok, fichier, taille, message) VALUES (true, 'evocom-2026.dump', 123456, 'Sauvegarde complète')`);
    const s = await A.admin.get('/api/sante');
    expect(s.status).toBe(200);
    expect(s.body.base.ok).toBe(true);
    expect(s.body.stockage.libre_octets).toBeGreaterThan(0);
    expect(s.body.migrations).toEqual({ a_jour: true, en_attente: [] });
    expect(s.body.derniere_sauvegarde).toMatchObject({ ok: true, taille: 123456, message: 'Sauvegarde complète' });
    expect(typeof s.body.version).toBe('string');
    expect((await A.livreur.get('/api/sante')).status).toBe(403);
  });

  it('exports CSV : BOM, séparateur « ; », en-têtes français, montants entiers', async () => {
    const r = await A.admin.get('/api/exports/dossiers.csv').buffer(true).parse(binaire);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(r.headers['content-disposition']).toContain('attachment');
    const buf = r.body as Buffer;
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lignes = buf.subarray(3).toString('utf8').split('\r\n');
    expect(lignes[0]).toBe(
      'Numéro;Créé le;Client;Téléphone;Machine;Statut;Préparateur;Description;Montant (FCFA);Payé (FCFA);Reste à payer (FCFA);Urgent;Date promise;Livré le;Facture',
    );
    const hotel = lignes.find((l) => l.includes('Hôtel Saly'))!;
    expect(hotel).toMatch(/^CMD-\d{4}-\d{4};\d{2}\/\d{2}\/\d{4} \d{2}:\d{2};Hôtel Saly;77 412 58 90;Roland;En préparation;Fatou Sarr;Bâche façade;45000;15000;30000;Non;;;FAC-\d{4}-0004$/);
    expect(lignes.some((l) => l.includes('À supprimer'))).toBe(false);

    const p = await A.admin.get(`/api/exports/paiements.csv?from=${jour(0)}&to=${jour(0)}`).buffer(true).parse(binaire);
    const pl = (p.body as Buffer).toString('utf8').replace(/^﻿/, '').split('\r\n');
    expect(pl[0]).toContain('Encaissé le;Dossier;Client;Montant (FCFA);Mode');
    expect(pl.some((l) => l.includes(';Orange Money;OM-778899;Refusé;'))).toBe(true);

    const f = await A.admin.get('/api/exports/factures.csv').buffer(true).parse(binaire);
    const fl = (f.body as Buffer).toString('utf8').replace(/^﻿/, '').split('\r\n');
    expect(fl[0]).toBe("Numéro;Date d'émission;Dossier;Client;Total HT (FCFA);Taux de TVA (%);TVA (FCFA);Total TTC (FCFA);Statut;Annulée le;Motif d'annulation");
    expect(fl.some((l) => l.startsWith(`FAC-${ANNEE}-0001;`) && l.includes(';Annulée;') && l.endsWith(';Erreur sur le client'))).toBe(true);
    expect((await A.prep.get('/api/exports/dossiers.csv')).status).toBe(403);
  });

  it('échappe les cellules CSV', async () => {
    const { celluleCsv } = await import('../src/modules/admin/routes');
    expect(celluleCsv('Dupont; fils')).toBe('"Dupont; fils"');
    expect(celluleCsv('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(celluleCsv('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
    expect(celluleCsv('=SOMME(A1:A2)')).toBe("'=SOMME(A1:A2)");
    expect(celluleCsv('+221 77 000 11 22')).toBe('+221 77 000 11 22');
    expect(celluleCsv(45000)).toBe('45000');
    expect(celluleCsv(null)).toBe('');
  });
});

describe('statistiques', () => {
  it('aperçu exact sur un jeu de données connu', async () => {
    await viderDonnees();
    // D1 : Roland 45 000, livré, 20 000 encaissés et validés -> reste 25 000.
    const d1 = await A.prep.post('/api/dossiers').send(bache);
    await A.admin.post(`/api/dossiers/${d1.body.id}/forcer-statut`).send({ statut: 'livre', commentaire: 'Jeu de test' }).expect(200);
    await A.admin.post(`/api/dossiers/${d1.body.id}/paiements`).send({ montant: 20000, mode: 'especes' }).expect(201);
    // D2 : Xerox 50 000, urgent, promis hier (en retard), 10 000 à valider.
    const d2 = await A.prep.post('/api/dossiers').send({ ...flyers, urgent: true, date_promise: jour(-1) });
    await A.prep.post(`/api/dossiers/${d2.body.id}/paiements`).send({ montant: 10000, mode: 'wave', reference: 'WV-1' }).expect(201);
    // D3 : supprimé, ne compte nulle part.
    const d3 = await A.prep.post('/api/dossiers').send({ ...flyers, client_nom: 'Supprimé', urgent: true });
    await A.admin.delete(`/api/dossiers/${d3.body.id}`).send({}).expect(204);

    for (const periode of ['jour', 'semaine', 'mois', 'annee']) {
      const r = await A.admin.get(`/api/stats/apercu?periode=${periode}`);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        periode,
        commandes: { nb: 2, montant: 95000 },
        encaisse: { montant: 20000 },
        a_valider: { nb: 1, montant: 10000 },
        reste_a_encaisser: { montant: 25000 },
        retards: { nb: 1 },
        urgents: { nb: 1 },
      });
      expect(r.body.production.par_statut).toMatchObject({ livre: 1, en_cours: 1, termine: 0 });
      expect(r.body.production.par_machine.roland.livre).toBe(1);
      expect(r.body.production.par_machine.xerox.en_cours).toBe(1);
    }
    const jourR = await A.admin.get('/api/stats/apercu?periode=jour');
    expect(jourR.body.du).toBe(jour(0));
    expect(jourR.body.au).toBe(jour(0));
    expect((await A.admin.get('/api/stats/apercu?periode=siecle')).status).toBe(400);
    expect((await A.livreur.get('/api/stats/apercu')).status).toBe(403);
    expect((await A.prep.get('/api/stats/apercu')).status).toBe(403);
  });

  it('évolution, production et meilleurs clients', async () => {
    const ev = await A.admin.get(`/api/stats/evolution?pas=jour&from=${jour(-2)}&to=${jour(0)}`);
    expect(ev.status).toBe(200);
    expect(ev.body.map((p: any) => p.periode)).toEqual([jour(-2), jour(-1), jour(0)]);
    expect(ev.body[0]).toEqual({ periode: jour(-2), commandes: 0, montant_commandes: 0, encaisse: 0 });
    expect(ev.body[2]).toEqual({ periode: jour(0), commandes: 2, montant_commandes: 95000, encaisse: 20000 });
    const mois = await A.admin.get('/api/stats/evolution?pas=mois');
    expect(mois.body).toHaveLength(12);
    expect(mois.body[11]).toMatchObject({ commandes: 2, montant_commandes: 95000 });
    expect((await A.admin.get('/api/stats/evolution?pas=jour&from=2020-01-01&to=2026-01-01')).status).toBe(400);

    const prod = await A.admin.get('/api/stats/production');
    expect(prod.status).toBe(200);
    expect(prod.body.par_machine.find((m: any) => m.machine === 'xerox')).toMatchObject({ crees: 1, montant: 50000 });
    const prep = prod.body.par_utilisateur.find((u: any) => u.nom === 'Fatou Sarr');
    expect(prep.actions.creation).toBe(2);
    expect(prod.body.delais).toHaveProperty('creation_validation');

    const top = await A.admin.get('/api/stats/top-clients?limit=5');
    expect(top.status).toBe(200);
    expect(top.body.map((c: any) => [c.nom, c.nb, c.montant])).toEqual([
      ['Mairie de Pikine', 1, 50000],
      ['Boutique Keur Yaye', 1, 45000],
    ]);
  });
});
