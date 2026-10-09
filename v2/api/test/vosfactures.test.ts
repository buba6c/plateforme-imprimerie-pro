// Liaison VosFactures : configuration (clé chiffrée, jamais renvoyée), test de connexion, envoi
// d'une facture, clé refusée, erreur réseau, annulation propagée, envoi automatique. Un faux
// serveur HTTP local imite l'API VosFactures (https://github.com/vosfactures/API) : aucun appel
// réel n'est fait.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { dechiffrer } from '../src/modules/ia/chiffrement';
import { construirePayload } from '../src/modules/vosfactures/service';
import { agent, app, comptes } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'livreur', Agent>;
const ANNEE = new Date().getFullYear();
const CLE = 'VfTestCle0123456789abcdefghijkl';

// ---------------------------------------------------------------------------
// Faux VosFactures

interface Requete {
  methode: string;
  chemin: string;
  corps: any;
}

const faux = {
  serveur: null as http.Server | null,
  url: '',
  /** Clé acceptée ; toute autre clé → 401. */
  cle: CLE,
  /** Prochaine création : refus 422 avec ce message. */
  refuser422: null as null | Record<string, string[]>,
  /** Ne jamais répondre (délai) ; le délai de l'API est de 20 s, on ne le teste qu'en coupant le serveur. */
  requetes: [] as Requete[],
  factures: new Map<number, { id: number; number: string; cancelled: boolean; cancel_reason?: string }>(),
  prochainId: 100,
};

function repondre(res: http.ServerResponse, status: number, corps: unknown, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(corps) : (corps as Buffer));
}

function demarrerFaux(): Promise<void> {
  faux.serveur = http.createServer((req, res) => {
    const morceaux: Buffer[] = [];
    req.on('data', (c) => morceaux.push(c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const brut = Buffer.concat(morceaux).toString('utf8');
      const corps = brut ? JSON.parse(brut) : null;
      faux.requetes.push({ methode: req.method ?? '', chemin: url.pathname + url.search, corps });
      const jeton = req.method === 'GET' ? url.searchParams.get('api_token') : corps?.api_token;
      if (jeton !== faux.cle) return repondre(res, 401, { code: 'error', message: 'Invalid api_token' });

      if (req.method === 'GET' && url.pathname === '/invoices.json') {
        return repondre(res, 200, [...faux.factures.values()].slice(0, Number(url.searchParams.get('per_page') ?? 25)));
      }
      if (req.method === 'POST' && url.pathname === '/invoices.json') {
        if (faux.refuser422) {
          const message = faux.refuser422;
          faux.refuser422 = null;
          return repondre(res, 422, { code: 'error', message });
        }
        const inv = corps?.invoice ?? {};
        if (!inv.buyer_name || !Array.isArray(inv.positions) || !inv.positions.length) {
          return repondre(res, 422, { code: 'error', message: { buyer_name: ["doit être rempli(e)"] } });
        }
        const id = faux.prochainId++;
        const number = `FV ${ANNEE}/${String(id).padStart(4, '0')}`;
        faux.factures.set(id, { id, number, cancelled: false });
        return repondre(res, 201, { id, number, token: `tok${id}`, view_url: `${faux.url}/invoice/tok${id}`, kind: inv.kind, currency: inv.currency });
      }
      if (req.method === 'POST' && url.pathname === '/invoices/cancel.json') {
        const f = faux.factures.get(Number(corps?.cancel_invoice_id));
        if (!f) return repondre(res, 404, { code: 'error', message: 'Not found' });
        f.cancelled = true;
        f.cancel_reason = corps?.cancel_reason;
        return repondre(res, 200, { id: f.id, status: 'cancelled' });
      }
      const pdf = /^\/invoices\/(\d+)\.pdf$/.exec(url.pathname);
      if (req.method === 'GET' && pdf) {
        if (!faux.factures.has(Number(pdf[1]))) return repondre(res, 404, { code: 'error', message: 'Not found' });
        return repondre(res, 200, Buffer.from('%PDF-1.4 faux vosfactures'), 'application/pdf');
      }
      repondre(res, 404, { code: 'error', message: 'Not found' });
    });
  });
  return new Promise((resolve) => {
    faux.serveur!.listen(0, '127.0.0.1', () => {
      faux.url = `http://127.0.0.1:${(faux.serveur!.address() as AddressInfo).port}`;
      process.env.VOSFACTURES_URL = faux.url;
      resolve();
    });
  });
}

function dernieresRequetes(chemin: string) {
  return faux.requetes.filter((r) => r.chemin.startsWith(chemin));
}

// ---------------------------------------------------------------------------

async function viderDonnees() {
  const pool = getPool();
  await pool.query(
    `TRUNCATE notifications, journal, paiements, factures, dossier_events, fichiers, devis, dossiers, clients, compteurs, sauvegardes RESTART IDENTITY CASCADE`,
  );
  for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
    await pool.query(`INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`, [cle, JSON.stringify(valeur)]);
  }
  await pool.query(`UPDATE vosfactures_config SET sous_domaine = '', cle_chiffree = NULL, cle_fin = NULL, envoi_auto = false, vendeur = '{}', updated_by = NULL WHERE id = 1`);
  await pool.query(`UPDATE users SET echecs_connexion = 0, bloque_jusqu_a = NULL`);
  invalidateParametres();
  invalidateTarifs();
}

const ligne = (designation: string, prix: number, quantite = 1) => ({ designation, quantite, unite: 'unite', prix_unitaire: prix });

async function creerFactureDirecte(a: Agent, client = 'Client VosFactures', lignes = [ligne('Bâche 3 × 2 m', 42000), ligne('Pose', 8000)]) {
  const r = await a.post('/api/factures').send({ client_nom: client, client_email: 'client@exemple.sn', client_telephone: '77 000 00 00', lignes });
  expect(r.status).toBe(201);
  return r.body;
}

beforeAll(async () => {
  await demarrerFaux();
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

afterEach(() => {
  faux.cle = CLE;
  faux.refuser422 = null;
  process.env.VOSFACTURES_URL = faux.url;
});

afterAll(async () => {
  delete process.env.VOSFACTURES_URL;
  await viderDonnees();
  await new Promise<void>((resolve) => faux.serveur?.close(() => resolve()));
});

describe('configuration de la liaison', () => {
  it('réservée à l’administrateur ; vide au départ', async () => {
    expect((await A.prep.get('/api/factures/vosfactures/config')).status).toBe(403);
    expect((await A.livreur.get('/api/factures/vosfactures/config')).status).toBe(403);
    const r = await A.admin.get('/api/factures/vosfactures/config');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sous_domaine: '', cle_configuree: false, cle_fin: null, envoi_auto: false, actif: false });
    expect(r.body.vendeur_effectif.nom).toBe('Evocom Print');
  });

  it('enregistre le sous-domaine et la clé (chiffrée AES-256-GCM, jamais renvoyée, fin affichée) ; journal sans la clé', async () => {
    const r = await A.admin.put('/api/factures/vosfactures/config').send({ sous_domaine: 'https://Evocom-Print.vosfactures.fr/', cle: CLE, vendeur: { nom: 'Evocom Print SARL', nif: '005551234' } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sous_domaine: 'evocom-print', cle_configuree: true, cle_fin: CLE.slice(-4), cle_lisible: true, actif: true, envoi_auto: false });
    expect(JSON.stringify(r.body)).not.toContain(CLE);
    const ligneConfig = await getPool().query(`SELECT cle_chiffree FROM vosfactures_config WHERE id = 1`);
    expect(ligneConfig.rows[0].cle_chiffree.startsWith('v1:')).toBe(true);
    expect(ligneConfig.rows[0].cle_chiffree).not.toContain(CLE);
    expect(dechiffrer(ligneConfig.rows[0].cle_chiffree)).toBe(CLE);
    const journal = await getPool().query(`SELECT data FROM journal WHERE action = 'vosfactures_config_modifiee' ORDER BY id DESC LIMIT 1`);
    expect(JSON.stringify(journal.rows[0].data)).not.toContain(CLE);
    expect(journal.rows[0].data.cle).toBe('enregistree');
  });

  it('refuse un sous-domaine ou une clé invalides, et l’envoi automatique sans compte complet', async () => {
    const sd = await A.admin.put('/api/factures/vosfactures/config').send({ sous_domaine: 'pas bon!' });
    expect(sd.status).toBe(400);
    expect(sd.body.champs.sous_domaine).toMatch(/Sous-domaine/);
    const cle = await A.admin.put('/api/factures/vosfactures/config').send({ cle: 'court' });
    expect(cle.status).toBe(400);
    expect(cle.body.champs.cle).toMatch(/courte/);
    const auto = await A.admin.put('/api/factures/vosfactures/config').send({ sous_domaine: '', envoi_auto: true });
    expect(auto.status).toBe(409);
    // Le sous-domaine vidé désactive la liaison ; on le remet.
    const r = await A.admin.put('/api/factures/vosfactures/config').send({ sous_domaine: 'evocom-print', envoi_auto: false });
    expect(r.body.actif).toBe(true);
  });

  it('teste la connexion (GET /invoices.json?page=1&per_page=1) : succès, puis clé refusée, puis serveur injoignable', async () => {
    const ok = await A.admin.post('/api/factures/vosfactures/test').send({});
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, sous_domaine: 'evocom-print', nb_factures_visibles: 0 });
    const req = dernieresRequetes('/invoices.json?').at(-1)!;
    expect(req.chemin).toContain('page=1');
    expect(req.chemin).toContain('per_page=1');

    const refus = await A.admin.post('/api/factures/vosfactures/test').send({ cle: 'UneAutreCleQuiNestPasLaBonne123' });
    expect(refus.status).toBe(502);
    expect(refus.body.code).toBe('vosfactures_cle_refusee');
    expect(refus.body.error).toMatch(/refusé la clé/);

    process.env.VOSFACTURES_URL = 'http://127.0.0.1:1';
    const reseau = await A.admin.post('/api/factures/vosfactures/test').send({});
    expect(reseau.status).toBe(502);
    expect(reseau.body.code).toBe('vosfactures_injoignable');
    expect(reseau.body.error).toMatch(/injoignable/);
    expect((await A.prep.post('/api/factures/vosfactures/test').send({})).status).toBe(403);
  });
});

describe('envoi d’une facture', () => {
  let factureId: number;

  it('envoie la facture (POST /invoices.json) et garde numéro et lien distants ; une seule fois', async () => {
    const f = await creerFactureDirecte(A.prep);
    factureId = f.id;
    expect(f.vosfactures).toBeNull();
    expect(f.vosfactures_actif).toBe(true);
    const r = await A.prep.post(`/api/factures/${factureId}/vosfactures`);
    expect(r.status).toBe(200);
    expect(r.body.vosfactures).toMatchObject({ id: 100, numero: `FV ${ANNEE}/0100`, url: `${faux.url}/invoice/tok100`, erreur: null, tentatives: 1, annulee_at: null, envoye_par_nom: expect.any(String) });
    expect(r.body.vosfactures.envoye_at).toBeTruthy();

    const envoi = dernieresRequetes('/invoices.json').filter((x) => x.methode === 'POST').at(-1)!;
    expect(envoi.corps.api_token).toBe(CLE);
    const inv = envoi.corps.invoice;
    expect(inv).toMatchObject({ kind: 'vat', currency: 'XOF', lang: 'fr', buyer_name: 'Client VosFactures', buyer_email: 'client@exemple.sn', seller_name: 'Evocom Print SARL', seller_tax_no: '005551234' });
    expect(inv.issue_date).toBe(f.date_emission);
    expect(inv.payment_to > inv.issue_date).toBe(true);
    expect(inv.positions).toEqual([
      { name: 'Bâche 3 × 2 m', quantity: 1, quantity_unit: 'unité', total_price_gross: 42000, tax: 'disabled' },
      { name: 'Pose', quantity: 1, quantity_unit: 'unité', total_price_gross: 8000, tax: 'disabled' },
    ]);
    expect(inv.description).toContain(f.numero);

    const deux = await A.prep.post(`/api/factures/${factureId}/vosfactures`);
    expect(deux.status).toBe(409);
    expect(deux.body.error).toContain(`FV ${ANNEE}/0100`);
    expect(dernieresRequetes('/invoices.json').filter((x) => x.methode === 'POST')).toHaveLength(1);

    const liste = await A.admin.get('/api/factures?vosfactures=envoyee');
    expect(liste.body.total).toBe(1);
    expect(liste.body.items[0].vosfactures.numero).toBe(`FV ${ANNEE}/0100`);
    expect((await A.admin.get('/api/factures?q=0100')).body.total).toBe(1);
    expect((await A.livreur.post(`/api/factures/${factureId}/vosfactures`)).status).toBe(403);

    const journal = await getPool().query(`SELECT data FROM journal WHERE action = 'facture_envoyee_vosfactures'`);
    expect(journal.rows).toHaveLength(1);
    expect(JSON.stringify(journal.rows)).not.toContain(CLE);
  });

  it('sert le PDF édité par VosFactures sans exposer la clé', async () => {
    const pdf = await A.prep.get(`/api/factures/${factureId}/vosfactures.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(dernieresRequetes('/invoices/100.pdf').at(-1)!.chemin).toContain(`api_token=${CLE}`);
  });

  it('clé refusée : erreur en français dans le journal, puis nouvel essai réussi', async () => {
    const f = await creerFactureDirecte(A.admin, 'Client clé refusée');
    faux.cle = 'autre-cle-cote-vosfactures-0000';
    const r = await A.admin.post(`/api/factures/${f.id}/vosfactures`);
    expect(r.status).toBe(502);
    expect(r.body.code).toBe('vosfactures_cle_refusee');
    const fiche = await A.admin.get(`/api/factures/${f.id}`);
    expect(fiche.body.vosfactures).toMatchObject({ id: null, numero: null, tentatives: 1, erreur: expect.stringContaining('refusé la clé') });
    expect(fiche.body.vosfactures.erreur_at).toBeTruthy();
    expect((await A.admin.get('/api/factures?vosfactures=erreur')).body.total).toBe(1);

    faux.cle = CLE;
    const ok = await A.admin.post(`/api/factures/${f.id}/vosfactures`);
    expect(ok.status).toBe(200);
    expect(ok.body.vosfactures).toMatchObject({ id: 101, tentatives: 2, erreur: null, erreur_at: null });
    expect((await A.admin.get('/api/factures?vosfactures=erreur')).body.total).toBe(0);
  });

  it('erreur réseau et données refusées : messages clairs, rien n’est enregistré côté distant', async () => {
    const f = await creerFactureDirecte(A.admin, 'Client réseau');
    process.env.VOSFACTURES_URL = 'http://127.0.0.1:1';
    const reseau = await A.admin.post(`/api/factures/${f.id}/vosfactures`);
    expect(reseau.status).toBe(502);
    expect(reseau.body).toMatchObject({ code: 'vosfactures_injoignable', error: expect.stringContaining('injoignable') });
    process.env.VOSFACTURES_URL = faux.url;

    faux.refuser422 = { positions: ['quantity doit être rempli(e)'] };
    const refus = await A.admin.post(`/api/factures/${f.id}/vosfactures`);
    expect(refus.status).toBe(502);
    expect(refus.body.code).toBe('vosfactures_donnees_refusees');
    expect(refus.body.error).toContain('positions : quantity doit être rempli(e)');
    expect((await A.admin.get(`/api/factures/${f.id}`)).body.vosfactures).toMatchObject({ id: null, tentatives: 2, erreur: expect.stringContaining('refusé les données') });

    // Facture annulée : plus d'envoi possible.
    await A.admin.post(`/api/factures/${f.id}/annuler`).send({ motif: 'Test' }).expect(200);
    expect((await A.admin.post(`/api/factures/${f.id}/vosfactures`)).status).toBe(409);
  });

  it('annulation côté Evocom : annulée côté VosFactures (POST /invoices/cancel.json avec le motif)', async () => {
    const a = await A.admin.post(`/api/factures/${factureId}/annuler`).send({ motif: 'Erreur de montant' });
    expect(a.status).toBe(200);
    expect(a.body.statut).toBe('annulee');
    expect(a.body.vosfactures.annulee_at).toBeTruthy();
    expect(a.body.vosfactures.annulation_erreur).toBeNull();
    const cancel = dernieresRequetes('/invoices/cancel.json').at(-1)!;
    expect(cancel.corps).toMatchObject({ api_token: CLE, cancel_invoice_id: 100, cancel_reason: 'Erreur de montant' });
    expect(faux.factures.get(100)).toMatchObject({ cancelled: true, cancel_reason: 'Erreur de montant' });
    expect((await A.admin.post(`/api/factures/${factureId}/vosfactures/annuler`)).status).toBe(409);
  });

  it('annulation distante en échec : notée, l’annulation locale reste faite, nouvel essai possible', async () => {
    const f = await creerFactureDirecte(A.admin, 'Client annulation');
    await A.admin.post(`/api/factures/${f.id}/vosfactures`).expect(200);
    process.env.VOSFACTURES_URL = 'http://127.0.0.1:1';
    const a = await A.admin.post(`/api/factures/${f.id}/annuler`).send({ motif: 'Client parti' });
    expect(a.status).toBe(200);
    expect(a.body.statut).toBe('annulee');
    expect(a.body.vosfactures).toMatchObject({ annulee_at: null, annulation_erreur: expect.stringContaining('injoignable') });
    const encore = await A.admin.post(`/api/factures/${f.id}/vosfactures/annuler`);
    expect(encore.status).toBe(502);
    process.env.VOSFACTURES_URL = faux.url;
    const ok = await A.admin.post(`/api/factures/${f.id}/vosfactures/annuler`);
    expect(ok.status).toBe(200);
    expect(ok.body.vosfactures.annulee_at).toBeTruthy();
    expect(ok.body.vosfactures.annulation_erreur).toBeNull();
    expect((await A.prep.post(`/api/factures/${f.id}/vosfactures/annuler`)).status).toBe(403);
  });
});

describe('envoi automatique', () => {
  it('chaque facture émise part vers VosFactures ; un échec n’empêche pas l’émission', async () => {
    const r = await A.admin.put('/api/factures/vosfactures/config').send({ envoi_auto: true });
    expect(r.body.envoi_auto).toBe(true);
    const f = await creerFactureDirecte(A.prep, 'Client auto');
    expect(f.vosfactures).toMatchObject({ id: expect.any(Number), erreur: null });
    expect(f.vosfactures.numero).toMatch(/^FV /);

    const d = await A.prep.post('/api/dossiers').send({
      machine: 'roland',
      client_nom: 'Dossier auto',
      specs: { lignes: [{ support: 'bache_m2', largeur: 100, hauteur: 100, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
    });
    const fd = await A.prep.post(`/api/dossiers/${d.body.id}/facture`);
    expect(fd.status).toBe(201);
    expect(fd.body.vosfactures.id).toBeGreaterThan(0);
    expect(dernieresRequetes('/invoices.json').filter((x) => x.methode === 'POST').at(-1)!.corps.invoice.description).toContain(d.body.numero);

    process.env.VOSFACTURES_URL = 'http://127.0.0.1:1';
    const sansReseau = await creerFactureDirecte(A.prep, 'Client auto sans réseau');
    expect(sansReseau.statut).toBe('emise');
    expect(sansReseau.vosfactures).toMatchObject({ id: null, tentatives: 1, erreur: expect.stringContaining('injoignable') });
    expect((await A.admin.put('/api/factures/vosfactures/config').send({ envoi_auto: false })).body.envoi_auto).toBe(false);
  });

  it('avec TVA, les positions sont envoyées TTC avec le taux et totalisent exactement le TTC', () => {
    const payload = construirePayload(
      {
        id: 1,
        numero: 'FAC-2026-0009',
        statut: 'emise',
        dossier_numero: 'CMD-2026-0003',
        client_nom: 'Client',
        client_telephone: null,
        client_email: null,
        client_adresse: 'Dakar',
        lignes: [
          { designation: 'A', detail: null, quantite: 3, unite: 'm2', prix_unitaire: 2825, total: 8475 },
          { designation: 'Remise', detail: null, quantite: null, unite: null, prix_unitaire: null, total: -424 },
          { designation: 'Arrondi', detail: null, quantite: null, unite: null, prix_unitaire: null, total: 2 },
        ],
        tva_taux: 18,
        total_ttc: 9503,
        date_emission: '2026-10-01',
        date_echeance: null,
        notes: null,
      },
      { nom: 'Evocom', adresse: '', nif: '', email: '', telephone: '' },
    );
    expect(payload.positions.map((p) => p.tax)).toEqual([18, 18, 18]);
    expect(payload.positions.reduce((s, p) => s + p.total_price_gross, 0)).toBe(9503);
    expect(payload.positions[0]).toMatchObject({ quantity: 3, quantity_unit: 'm²', total_price_gross: 10001 });
    expect(payload.payment_to).toBe('2026-10-31');
    expect(payload.buyer_street).toBe('Dakar');
    expect(payload.internal_note).toContain('CMD-2026-0003');
  });
});
