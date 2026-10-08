// Validation des paiements : droits, dépassement du montant (y compris en concurrence, défaut A8),
// validation groupée et validation de l'historique importé.
import { beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes, PASSWORD } from './helpers';

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'livreur' | 'roland', Agent>;
const ids = {} as Record<'admin' | 'prep' | 'livreur', number>;

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

/** Crée un dossier par l'API puis fixe son montant et son statut directement en base. */
async function dossier(montant: number | null, statut = 'en_cours'): Promise<number> {
  const r = await A.prep.post('/api/dossiers').send(flyers);
  expect(r.status).toBe(201);
  await getPool().query(`UPDATE dossiers SET montant = $2, statut = $3 WHERE id = $1`, [r.body.id, montant, statut]);
  return r.body.id;
}

/** Paiement inséré directement (contourne le contrôle de l'encaissement pour fabriquer les cas limites). */
async function paiement(dossierId: number, montant: number, o: { par?: number; legacy?: number; le?: string; statut?: string; mode?: string } = {}): Promise<number> {
  const r = await getPool().query(
    `INSERT INTO paiements (dossier_id, montant, mode, statut, encaisse_par, encaisse_at, legacy_id)
     VALUES ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7) RETURNING id`,
    [dossierId, montant, o.mode ?? 'especes', o.statut ?? 'a_valider', o.par === undefined ? ids.prep : o.par, o.le ?? null, o.legacy ?? null],
  );
  return r.rows[0].id;
}

async function statutPaiement(id: number): Promise<string> {
  return (await getPool().query(`SELECT statut FROM paiements WHERE id = $1`, [id])).rows[0].statut;
}

beforeAll(async () => {
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'livreur', 'roland'] as const) A[k] = await agent(comptes[k]);
  for (const k of ['admin', 'prep', 'livreur'] as const) {
    ids[k] = (await getPool().query(`SELECT id FROM users WHERE email = $1`, [comptes[k]])).rows[0].id;
  }
});

describe('droits', () => {
  it('seul l’administrateur valide en groupe ou l’historique', async () => {
    for (const a of [A.prep, A.livreur, A.roland]) {
      expect((await a.post('/api/paiements/valider-groupe').send({ ids: [1] })).status).toBe(403);
      expect((await a.post('/api/paiements/valider-historique').send({ avant: '2026-01-01', mot_de_passe: PASSWORD })).status).toBe(403);
      expect((await a.get('/api/paiements/historique?avant=2026-01-01')).status).toBe(403);
    }
  });

  it('refuse une liste vide, trop longue ou invalide', async () => {
    expect((await A.admin.post('/api/paiements/valider-groupe').send({})).status).toBe(400);
    expect((await A.admin.post('/api/paiements/valider-groupe').send({ ids: [] })).status).toBe(400);
    expect((await A.admin.post('/api/paiements/valider-groupe').send({ ids: Array.from({ length: 501 }, (_, i) => i + 1) })).status).toBe(400);
    expect((await A.admin.post('/api/paiements/valider-groupe').send({ ids: [1, 'a'] })).status).toBe(400);
    expect((await A.admin.post('/api/paiements/valider-groupe').send({ ids: [1.5] })).status).toBe(400);
    expect((await A.admin.post('/api/paiements/valider-groupe').send({ ids: [-3] })).status).toBe(400);
  });
});

describe('dépassement du montant', () => {
  it('la validation unitaire refuse un dépassement et un dossier à la corbeille', async () => {
    const d = await dossier(45000);
    const p1 = await paiement(d, 30000);
    const p2 = await paiement(d, 30000);
    expect((await A.admin.post(`/api/paiements/${p1}/valider`)).status).toBe(200);
    const v2 = await A.admin.post(`/api/paiements/${p2}/valider`);
    expect(v2.status).toBe(409);
    expect(v2.body.details).toEqual({ deja_paye: 30000, montant_dossier: 45000 });
    expect(await statutPaiement(p2)).toBe('a_valider');

    const corbeille = await dossier(10000);
    const p3 = await paiement(corbeille, 5000);
    await getPool().query(`UPDATE dossiers SET deleted_at = now() WHERE id = $1`, [corbeille]);
    const v3 = await A.admin.post(`/api/paiements/${p3}/valider`);
    expect(v3.status).toBe(409);
    expect(v3.body.error).toContain('corbeille');
    expect(await statutPaiement(p3)).toBe('a_valider');
  });

  it('deux validations simultanées ne dépassent pas le montant (A8)', async () => {
    for (let essai = 0; essai < 5; essai++) {
      const d = await dossier(45000);
      const p1 = await paiement(d, 30000);
      const p2 = await paiement(d, 30000);
      const r = await Promise.all([A.admin.post(`/api/paiements/${p1}/valider`), A.admin.post(`/api/paiements/${p2}/valider`)]);
      expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
      const s = (await getPool().query(`SELECT coalesce(sum(montant),0)::int AS s FROM paiements WHERE dossier_id = $1 AND statut = 'valide'`, [d])).rows[0].s;
      expect(s).toBe(30000);
    }
  });

  it('deux encaissements simultanés ne dépassent pas le reste à payer (A8)', async () => {
    for (let essai = 0; essai < 5; essai++) {
      const d = await dossier(45000);
      const r = await Promise.all([
        A.admin.post(`/api/dossiers/${d}/paiements`).send({ montant: 30000, mode: 'especes' }),
        A.prep.post(`/api/dossiers/${d}/paiements`).send({ montant: 30000, mode: 'especes' }),
      ]);
      expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
      const s = (await getPool().query(`SELECT coalesce(sum(montant),0)::int AS s FROM paiements WHERE dossier_id = $1 AND statut <> 'refuse'`, [d])).rows[0].s;
      expect(s).toBe(30000);
    }
  });

  it('une validation groupée concurrente d’une validation unitaire ne dépasse pas', async () => {
    const d = await dossier(45000);
    const p1 = await paiement(d, 30000);
    const p2 = await paiement(d, 30000);
    const [g, u] = await Promise.all([A.admin.post('/api/paiements/valider-groupe').send({ ids: [p1] }), A.admin.post(`/api/paiements/${p2}/valider`)]);
    expect(g.status).toBe(200);
    const valides = g.body.valides + (u.status === 200 ? 1 : 0);
    expect(valides).toBe(1);
  });
});

describe('validation groupée', () => {
  it('valide ce qui peut l’être, dans l’ordre, et détaille les refus', async () => {
    await getPool().query(`TRUNCATE journal, notifications`);
    const d1 = await dossier(45000);
    const a = await paiement(d1, 20000, { le: '2026-10-01T09:00:00Z' });
    const b = await paiement(d1, 20000, { le: '2026-10-01T10:00:00Z', mode: 'wave' });
    const c = await paiement(d1, 10000, { le: '2026-10-01T11:00:00Z' }); // 20 000 + 20 000 + 10 000 > 45 000
    const d2 = await dossier(null); // sans montant : pas de plafond
    const e = await paiement(d2, 7000, { par: ids.livreur });
    const d3 = await dossier(10000);
    const f = await paiement(d3, 5000);
    await getPool().query(`UPDATE dossiers SET deleted_at = now() WHERE id = $1`, [d3]);
    const g = await paiement(d2, 1000, { statut: 'refuse' });
    const h = await paiement(d2, 2000, { statut: 'valide', par: ids.admin });
    const adminAvant = await paiement(d2, 3000, { par: ids.admin });

    const r = await A.admin.post('/api/paiements/valider-groupe').send({ ids: [c, b, a, e, f, g, h, 999999, a, adminAvant] });
    expect(r.status).toBe(200);
    expect(r.body.valides).toBe(4);
    expect(r.body.somme).toBe(20000 + 20000 + 7000 + 3000);
    expect(r.body.ids).toEqual([a, b, e, adminAvant].sort((x, y) => x - y));
    const codes = Object.fromEntries(r.body.refuses.map((x: any) => [x.id, x.code]));
    expect(codes).toEqual({ [c]: 'depassement', [f]: 'dossier_supprime', [g]: 'refuse', [h]: 'deja_valide', 999999: 'introuvable' });
    const dep = r.body.refuses.find((x: any) => x.id === c);
    expect(dep.details).toEqual({ deja_paye: 40000, montant_dossier: 45000 });
    expect(dep.numero).toMatch(/^CMD/);

    expect(await statutPaiement(a)).toBe('valide');
    expect(await statutPaiement(c)).toBe('a_valider');
    expect(await statutPaiement(f)).toBe('a_valider');

    // Historique du dossier, journal et notifications des encaisseurs.
    const fiche = await A.admin.get(`/api/dossiers/${d1}`);
    expect(fiche.body.deja_paye).toBe(40000);
    expect(fiche.body.historique.filter((x: any) => x.type === 'paiement' && x.action === 'valide')).toHaveLength(2);
    const journal = (await getPool().query(`SELECT action, cible_id, data FROM journal ORDER BY id`)).rows;
    expect(journal.filter((j) => j.action === 'paiement_valide')).toHaveLength(4);
    const resume = journal.find((j) => j.action === 'paiements_valides_groupe');
    expect(resume.data).toMatchObject({ demandes: 9, valides: 4, somme: 50000 });
    const notifs = (await getPool().query(`SELECT user_id, titre, message FROM notifications WHERE type = 'paiement_valide' ORDER BY user_id`)).rows;
    expect(notifs.map((n) => n.user_id).sort()).toEqual([ids.prep, ids.livreur].sort());
    expect(notifs.find((n) => n.user_id === ids.prep).titre).toBe('2 paiements validés');

    // Rejouer la même demande ne valide rien de plus.
    const again = await A.admin.post('/api/paiements/valider-groupe').send({ ids: [a, b] });
    expect(again.body.valides).toBe(0);
    expect(again.body.refuses.every((x: any) => x.code === 'deja_valide')).toBe(true);
  });

  it('la liste porte importe et le statut du dossier, et se filtre par recherche', async () => {
    const d = await dossier(9000, 'livre');
    await paiement(d, 4000, { legacy: 777, le: '2026-01-05T10:00:00Z', mode: 'wave' });
    await getPool().query(`UPDATE paiements SET reference = 'WAVE-XYZ-42' WHERE legacy_id = 777`);
    const l = await A.admin.get('/api/paiements?q=xyz-42');
    expect(l.status).toBe(200);
    expect(l.body.total).toBe(1);
    expect(l.body.items[0]).toMatchObject({ importe: true, dossier_statut: 'livre', machine: 'xerox', reference: 'WAVE-XYZ-42' });
    const imp = await A.admin.get('/api/paiements?importe=1');
    expect(imp.body.items.every((p: any) => p.importe)).toBe(true);
    const caisse = await A.admin.get('/api/caisse');
    expect(caisse.body.totaux.refuse_aujourdhui).toEqual({ n: 0, somme: 0 });
  });
});

describe('historique importé', () => {
  let l1a: number, l1b: number, l2: number, recent: number, enImpression: number, supprime: number, nonImporte: number;

  beforeAll(async () => {
    await getPool().query(`UPDATE paiements SET statut = 'refuse', motif_refus = 'nettoyage' WHERE statut = 'a_valider'`);
    await getPool().query(`TRUNCATE journal`);
    const d1 = await dossier(45000, 'livre');
    l1a = await paiement(d1, 20000, { legacy: 1, le: '2026-01-10T10:00:00Z', par: null as any });
    l1b = await paiement(d1, 30000, { legacy: 2, le: '2026-01-12T10:00:00Z', par: null as any }); // dépasse
    const d2 = await dossier(null, 'termine');
    l2 = await paiement(d2, 5000, { legacy: 3, le: '2026-02-01T10:00:00Z' });
    const d3 = await dossier(8000, 'livre');
    recent = await paiement(d3, 8000, { legacy: 4, le: '2026-09-20T10:00:00Z' });
    const d4 = await dossier(8000, 'en_impression');
    enImpression = await paiement(d4, 8000, { legacy: 5, le: '2026-01-20T10:00:00Z' });
    const d5 = await dossier(8000, 'livre');
    supprime = await paiement(d5, 8000, { legacy: 6, le: '2026-01-20T10:00:00Z' });
    await getPool().query(`UPDATE dossiers SET deleted_at = now() WHERE id = $1`, [d5]);
    const d6 = await dossier(8000, 'livre');
    nonImporte = await paiement(d6, 8000, { le: '2026-01-20T10:00:00Z' });
  });

  it('contrôle la date', async () => {
    expect((await A.admin.get('/api/paiements/historique')).status).toBe(400);
    expect((await A.admin.get('/api/paiements/historique?avant=2026-02-30')).status).toBe(400);
    expect((await A.admin.get('/api/paiements/historique?avant=hier')).status).toBe(400);
    expect((await A.admin.get('/api/paiements/historique?avant=2099-01-01')).status).toBe(400);
    expect((await A.admin.post('/api/paiements/valider-historique').send({ mot_de_passe: PASSWORD })).status).toBe(400);
  });

  it('montre un aperçu sans rien modifier', async () => {
    const r = await A.admin.get('/api/paiements/historique?avant=2026-03-01');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ avant: '2026-03-01', n: 2, somme: 25000, ignores: { n: 1, somme: 30000, depassement: 1 } });
    expect(r.body.importes_a_valider).toEqual({ n: 6, somme: 20000 + 30000 + 5000 + 8000 * 3 });
    expect(await statutPaiement(l1a)).toBe('a_valider');
  });

  it('exige le mot de passe de l’administrateur', async () => {
    const sans = await A.admin.post('/api/paiements/valider-historique').send({ avant: '2026-03-01' });
    expect(sans.status).toBe(400);
    expect(sans.body.champs).toHaveProperty('mot_de_passe');
    const faux = await A.admin.post('/api/paiements/valider-historique').send({ avant: '2026-03-01', mot_de_passe: 'pas-le-bon' });
    expect(faux.status).toBe(400);
    expect(await statutPaiement(l1a)).toBe('a_valider');
    const j = (await getPool().query(`SELECT count(*)::int AS n FROM journal WHERE action = 'validation_historique_refusee'`)).rows[0].n;
    expect(j).toBe(1);
  });

  it('valide les paiements importés des dossiers livrés ou terminés encaissés avant la date', async () => {
    const r = await A.admin.post('/api/paiements/valider-historique').send({ avant: '2026-03-01', mot_de_passe: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ n: 2, somme: 25000, ignores: { n: 1, somme: 30000, depassement: 1 } });
    expect(await statutPaiement(l1a)).toBe('valide');
    expect(await statutPaiement(l2)).toBe('valide');
    for (const id of [l1b, recent, enImpression, supprime, nonImporte]) expect(await statutPaiement(id)).toBe('a_valider');
    const v = (await getPool().query(`SELECT valide_par, valide_at FROM paiements WHERE id = $1`, [l1a])).rows[0];
    expect(v.valide_par).toBe(ids.admin);
    expect(v.valide_at).not.toBeNull();
    const j = (await getPool().query(`SELECT data FROM journal WHERE action = 'paiements_historique_valides'`)).rows;
    expect(j).toHaveLength(1);
    expect(j[0].data).toMatchObject({ avant: '2026-03-01', valides: 2, somme: 25000, ignores: 1, ids: [l1a, l2].sort((a, b) => a - b) });
    const ev = (await getPool().query(`SELECT data FROM dossier_events WHERE type = 'paiement' AND action = 'valide' AND (data->>'paiement_id')::int = $1`, [l2])).rows;
    expect(ev[0].data).toMatchObject({ origine: 'historique', montant: 5000 });

    const encore = await A.admin.post('/api/paiements/valider-historique').send({ avant: '2026-03-01', mot_de_passe: PASSWORD });
    expect(encore.body.n).toBe(0);
  });

  it('bloque une heure après cinq mots de passe faux', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await A.admin.post('/api/paiements/valider-historique').send({ avant: '2026-03-01', mot_de_passe: 'faux' })).status).toBe(400);
    }
    const bloque = await A.admin.post('/api/paiements/valider-historique').send({ avant: '2026-03-01', mot_de_passe: PASSWORD });
    expect(bloque.status).toBe(429);
    await getPool().query(`DELETE FROM journal WHERE action = 'validation_historique_refusee'`);
  });
});
