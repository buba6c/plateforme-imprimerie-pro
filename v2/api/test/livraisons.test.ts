import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes, PASSWORD } from './helpers';

type Agent = supertest.Agent;

/** Jour civil (AAAA-MM-JJ) à Dakar, décalé de n jours. */
function jour(decalage = 0): string {
  const d = new Date(Date.now() + decalage * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function plus(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function viderDonnees() {
  const pool = getPool();
  await pool.query(
    `TRUNCATE notifications, journal, paiements, factures, dossier_events, fichiers, devis, dossiers, clients, compteurs, sauvegardes RESTART IDENTITY CASCADE`,
  );
  for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
    await pool.query(`INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`, [cle, JSON.stringify(valeur)]);
  }
  invalidateParametres();
  invalidateTarifs();
}

async function fuseau(tz: string) {
  await getPool().query(`UPDATE parametres SET valeur = $1 WHERE cle = 'fuseau'`, [JSON.stringify(tz)]);
  invalidateParametres();
}

const A = {} as Record<'admin' | 'prep' | 'roland' | 'xerox' | 'livreur' | 'livreur2', Agent>;
let livreurId = 0;
let livreur2Id = 0;
let seq = 0;

beforeAll(async () => {
  await app();
  await viderDonnees();
  for (const k of ['admin', 'prep', 'roland', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);
  const u = await A.admin.post('/api/users').send({ nom: 'Mamadou Sow', email: 'livreur2@evocom.test', role: 'livreur', password: PASSWORD });
  expect([201, 409]).toContain(u.status);
  await getPool().query(`UPDATE users SET is_active = true WHERE email = 'livreur2@evocom.test'`);
  A.livreur2 = await agent('livreur2@evocom.test');
  livreurId = (await A.livreur.get('/api/auth/me')).body.user.id;
  livreur2Id = (await A.livreur2.get('/api/auth/me')).body.user.id;
});

afterAll(async () => {
  await getPool().query(`UPDATE users SET is_active = false WHERE email = 'livreur2@evocom.test'`);
  await viderDonnees();
});

/** Dossier prêt à livrer (montant 30 000 FCFA), sans passer par l'atelier. */
async function pretALivrer(extra: Record<string, unknown> = {}) {
  const r = await A.prep.post('/api/dossiers').send({
    machine: 'xerox',
    client_nom: `Client livraison ${++seq}`,
    client_telephone: '77 123 45 67',
    adresse_livraison: 'Mermoz, rue MZ-84',
    montant: 30000,
    specs: { lignes: [], forfaits: [] },
    ...extra,
  });
  expect(r.status).toBe(201);
  await getPool().query(
    `UPDATE dossiers SET statut = 'pret_livraison', date_validation = now(), date_fin_impression = now() WHERE id = $1`,
    [r.body.id],
  );
  return r.body as { id: number; numero: string; client_nom: string };
}

async function programmer(a: Agent, id: number, date_prevue: string) {
  const r = await a.post(`/api/dossiers/${id}/actions/programmer_livraison`).send({ livraison: { date_prevue } });
  expect(r.status).toBe(200);
  expect(r.body.statut).toBe('en_livraison');
}

async function livrer(a: Agent, id: number, encaissement: Record<string, unknown> | null = null) {
  const r = await a.post(`/api/dossiers/${id}/actions/confirmer_livraison`).send({ encaissement });
  expect(r.status).toBe(200);
  expect(r.body.statut).toBe('livre');
}

const planning = (a: Agent, debut: string, fin: string, extra = '') => a.get(`/api/livraisons/planning?debut=${debut}&fin=${fin}${extra}`);
const ids = (items: { id: number }[]) => items.map((i) => i.id).sort((x, y) => x - y);

// ---------------------------------------------------------------------------

describe('livraisons : droits', () => {
  it('refuse le préparateur et les imprimeurs (403), et les visiteurs non connectés (401)', async () => {
    for (const k of ['prep', 'roland', 'xerox'] as const) {
      const p = await planning(A[k], jour(0), jour(6));
      expect(p.status).toBe(403);
      expect(p.body.code).toBe('interdit');
      expect((await A[k].get('/api/livraisons/historique')).status).toBe(403);
    }
    const anonyme = supertest(await app());
    expect((await anonyme.get(`/api/livraisons/planning?debut=${jour(0)}&fin=${jour(6)}`)).status).toBe(401);
    expect((await anonyme.get('/api/livraisons/historique')).status).toBe(401);
  });
});

describe('livraisons : planning', () => {
  const J = jour(10);

  it('le livreur voit ses livraisons et celles sans livreur, pas celles d’un autre ; l’admin voit tout et filtre', async () => {
    const mien = await pretALivrer({ client_nom: 'Pharmacie Ndiaye', client_telephone: '78 220 14 33' });
    await programmer(A.livreur, mien.id, `${J}T10:00:00Z`);
    const autre = await pretALivrer();
    await programmer(A.livreur2, autre.id, `${J}T11:00:00Z`);
    const sansLivreur = await pretALivrer();
    await programmer(A.admin, sansLivreur.id, `${J}T12:00:00Z`);
    const pret = await pretALivrer({ urgent: true });

    const r = await planning(A.livreur, J, J);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ debut: J, fin: J, fuseau: 'Africa/Dakar', livreur_id: livreurId, jours_historique: 7, aujourdhui: jour(0) });
    expect(ids(r.body.items)).toEqual([mien.id, sansLivreur.id]);
    const m = r.body.items.find((i: any) => i.id === mien.id);
    expect(m).toMatchObject({
      numero: mien.numero,
      statut: 'en_livraison',
      statut_label: 'En livraison',
      client_nom: 'Pharmacie Ndiaye',
      client_telephone: '78 220 14 33',
      adresse_livraison: 'Mermoz, rue MZ-84',
      jour: J,
      heure: '10:00',
      montant: 30000,
      reste_a_encaisser: 30000,
      nb_reports: 0,
      livreur_id: livreurId,
      livreur_nom: 'Ousmane Gueye',
    });
    expect(m).not.toHaveProperty('detail_prix');
    expect(m).not.toHaveProperty('specs');
    expect(m.actions).toEqual(expect.arrayContaining(['confirmer_livraison', 'retirer_tournee']));
    expect(r.body.items.find((i: any) => i.id === sansLivreur.id).livreur_id).toBeNull();
    // « À programmer » : les dossiers prêts à livrer, avec l'action de programmation.
    const ap = r.body.a_programmer.find((i: any) => i.id === pret.id);
    expect(ap).toMatchObject({ statut: 'pret_livraison', urgent: true, reste_a_encaisser: 30000 });
    expect(ap.actions).toContain('programmer_livraison');

    // Le filtre livreur_id est ignoré pour un livreur.
    const force = await planning(A.livreur, J, J, `&livreur_id=${livreur2Id}`);
    expect(ids(force.body.items)).toEqual([mien.id, sansLivreur.id]);
    expect(ids((await planning(A.livreur2, J, J)).body.items)).toEqual([autre.id, sansLivreur.id]);

    const admin = await planning(A.admin, J, J);
    expect(ids(admin.body.items)).toEqual([mien.id, autre.id, sansLivreur.id]);
    expect(admin.body.livreur_id).toBeNull();
    const filtre = await planning(A.admin, J, J, `&livreur_id=${livreur2Id}`);
    expect(ids(filtre.body.items)).toEqual([autre.id]);
    expect(filtre.body.items[0].livreur_nom).toBe('Mamadou Sow');
    expect((await planning(A.admin, J, J, '&livreur_id=abc')).status).toBe(400);
  });

  it('borne la période sur les jours du fuseau de l’entreprise (autour de minuit)', async () => {
    const J2 = jour(20);
    const soir = await pretALivrer();
    await programmer(A.livreur, soir.id, `${J2}T23:59:00Z`);
    const minuit = await pretALivrer();
    await programmer(A.livreur, minuit.id, `${plus(J2, 1)}T00:00:00Z`);

    // Dakar est à UTC+0 : 23:59 reste le jour J2, minuit appartient au lendemain.
    const j = await planning(A.livreur, J2, J2);
    expect(ids(j.body.items)).toEqual([soir.id]);
    expect(j.body.items[0]).toMatchObject({ jour: J2, heure: '23:59' });
    const lendemain = await planning(A.livreur, plus(J2, 1), plus(J2, 1));
    expect(ids(lendemain.body.items)).toEqual([minuit.id]);
    expect(lendemain.body.items[0]).toMatchObject({ jour: plus(J2, 1), heure: '00:00' });

    // Dans un fuseau à UTC+9, les deux livraisons tombent le lendemain matin.
    await fuseau('Asia/Tokyo');
    try {
      expect((await planning(A.livreur, J2, J2)).body.items).toEqual([]);
      const tokyo = await planning(A.livreur, plus(J2, 1), plus(J2, 1));
      expect(ids(tokyo.body.items)).toEqual([soir.id, minuit.id]);
      expect(tokyo.body.items.map((i: any) => i.heure)).toEqual(['08:59', '09:00']);
    } finally {
      await fuseau('Africa/Dakar');
    }
  });

  it('refuse une période absente, inversée, invalide ou de plus de 62 jours', async () => {
    const d = jour(0);
    expect((await planning(A.livreur, d, plus(d, 61))).status).toBe(200);
    const long = await planning(A.livreur, d, plus(d, 62));
    expect(long.status).toBe(400);
    expect(long.body.error).toContain('62 jours');
    expect((await planning(A.admin, plus(d, 1), d)).status).toBe(400);
    expect((await A.livreur.get(`/api/livraisons/planning?debut=${d}`)).status).toBe(400);
    expect((await planning(A.livreur, '2026-02-30', '2026-03-02')).status).toBe(400);
  });

  it('signale les retards, compte les reports et déduit les encaissements en attente', async () => {
    const d = await pretALivrer();
    await programmer(A.livreur, d.id, `${jour(-2)}T09:00:00Z`);
    const semaine = await planning(A.livreur, jour(0), jour(6));
    expect(semaine.body.items.some((i: any) => i.id === d.id)).toBe(false);
    expect(semaine.body.en_retard.map((i: any) => i.id)).toContain(d.id);
    // Un retard chez un autre livreur ne le concerne pas.
    expect((await planning(A.livreur2, jour(0), jour(6))).body.en_retard.some((i: any) => i.id === d.id)).toBe(false);

    await A.livreur.post(`/api/dossiers/${d.id}/reporter`).send({ date_prevue: `${jour(3)}T15:00:00Z`, motif: 'Client absent' }).expect(200);
    await A.livreur.post(`/api/dossiers/${d.id}/paiements`).send({ montant: 10000, mode: 'especes' }).expect(201);
    const apres = await planning(A.livreur, jour(0), jour(6));
    expect(apres.body.en_retard.some((i: any) => i.id === d.id)).toBe(false);
    expect(apres.body.items.find((i: any) => i.id === d.id)).toMatchObject({
      jour: jour(3),
      heure: '15:00',
      nb_reports: 1,
      deja_paye: 0,
      en_attente_validation: 10000,
      solde: 30000,
      reste_a_encaisser: 20000,
    });
  });

  it('place une livraison effectuée au jour de la livraison et la sort de « à programmer »', async () => {
    const d = await pretALivrer();
    expect((await planning(A.livreur, jour(0), jour(0))).body.a_programmer.some((i: any) => i.id === d.id)).toBe(true);
    await livrer(A.livreur, d.id);
    const r = await planning(A.livreur, jour(0), jour(0));
    expect(r.body.a_programmer.some((i: any) => i.id === d.id)).toBe(false);
    expect(r.body.items.find((i: any) => i.id === d.id)).toMatchObject({ statut: 'livre', jour: jour(0) });
    // Les livraisons effectuées par un autre livreur n'apparaissent pas.
    expect((await planning(A.livreur2, jour(0), jour(0))).body.items.some((i: any) => i.id === d.id)).toBe(false);
  });
});

describe('livraisons : historique', () => {
  const ref: Record<string, { id: number; numero: string; client_nom: string }> = {};

  beforeAll(async () => {
    await viderDonnees();
    ref.wave = await pretALivrer({ client_nom: 'Clinique du Golf' });
    await livrer(A.livreur, ref.wave.id, { montant: 30000, mode: 'wave', reference: 'WV-1001' });
    ref.ancien = await pretALivrer({ client_nom: 'Mairie de Pikine', adresse_livraison: 'Pikine, rond-point' });
    await livrer(A.livreur, ref.ancien.id, { montant: 12000, mode: 'especes' });
    ref.sans = await pretALivrer({ client_nom: 'Lycée Blaise Diagne' });
    // Acompte encaissé par le préparateur : ce n'est pas un encaissement du livreur.
    await A.prep.post(`/api/dossiers/${ref.sans.id}/paiements`).send({ montant: 5000, mode: 'especes' }).expect(201);
    await livrer(A.livreur, ref.sans.id);
    ref.autre = await pretALivrer({ client_nom: 'Garage Sall Auto' });
    await livrer(A.livreur2, ref.autre.id, { montant: 30000, mode: 'especes' });
    // Livraison d'il y a 20 jours : hors de la fenêtre de 7 jours de la liste principale.
    await getPool().query(`UPDATE dossiers SET livre_at = now() - interval '20 days' WHERE id = $1`, [ref.ancien.id]);
  });

  it('ne montre au livreur que ses livraisons, au-delà de la fenêtre de 7 jours, sans données superflues', async () => {
    const r = await A.livreur.get('/api/livraisons/historique');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.items.map((i: any) => i.id)).toEqual([ref.sans.id, ref.wave.id, ref.ancien.id]);
    const ancien = r.body.items.find((i: any) => i.id === ref.ancien.id);
    expect(Object.keys(ancien).sort()).toEqual(
      ['adresse_livraison', 'client_nom', 'encaisse', 'encaissements', 'fiche_accessible', 'id', 'livre_at', 'livreur_id', 'livreur_nom', 'numero'].sort(),
    );
    expect(ancien).toMatchObject({ numero: ref.ancien.numero, adresse_livraison: 'Pikine, rond-point', fiche_accessible: false, encaisse: 12000 });
    expect(ancien.encaissements).toEqual([expect.objectContaining({ montant: 12000, mode: 'especes', statut: 'a_valider' })]);
    // La fiche n'est plus accessible au livreur, mais l'historique la garde.
    expect((await A.livreur.get(`/api/dossiers/${ref.ancien.id}`)).status).toBe(404);
    expect(r.body.items.find((i: any) => i.id === ref.wave.id).fiche_accessible).toBe(true);
    expect(r.body.items.find((i: any) => i.id === ref.sans.id)).toMatchObject({ encaisse: 0, encaissements: [] });

    const autre = await A.livreur2.get('/api/livraisons/historique');
    expect(autre.body.items.map((i: any) => i.id)).toEqual([ref.autre.id]);
  });

  it('totalise par mode et suit la validation de ses encaissements', async () => {
    const avant = await A.livreur.get('/api/livraisons/historique');
    expect(avant.body.totaux).toEqual({
      nb_livraisons: 3,
      encaisse: 42000,
      valide: 0,
      en_attente_validation: 42000,
      refuse: 0,
      par_mode: [
        { mode: 'especes', libelle: 'Espèces', nb: 1, montant: 12000, valide: 0, en_attente_validation: 12000 },
        { mode: 'wave', libelle: 'Wave', nb: 1, montant: 30000, valide: 0, en_attente_validation: 30000 },
      ],
    });

    const paiements = (await A.admin.get('/api/paiements?statut=a_valider')).body.items;
    const pWave = paiements.find((p: any) => p.dossier_id === ref.wave.id);
    const pAncien = paiements.find((p: any) => p.dossier_id === ref.ancien.id);
    await A.admin.post(`/api/paiements/${pWave.id}/valider`).send({}).expect(200);
    await A.admin.post(`/api/paiements/${pAncien.id}/refuser`).send({ motif: 'Montant non remis' }).expect(200);

    const apres = await A.livreur.get('/api/livraisons/historique');
    expect(apres.body.totaux).toMatchObject({ nb_livraisons: 3, encaisse: 30000, valide: 30000, en_attente_validation: 0, refuse: 12000 });
    expect(apres.body.totaux.par_mode).toEqual([{ mode: 'wave', libelle: 'Wave', nb: 1, montant: 30000, valide: 30000, en_attente_validation: 0 }]);
    const ancien = apres.body.items.find((i: any) => i.id === ref.ancien.id);
    expect(ancien.encaisse).toBe(0);
    expect(ancien.encaissements[0]).toMatchObject({ statut: 'refuse', motif_refus: 'Montant non remis' });
  });

  it('filtre par mode, période et recherche, et pagine', async () => {
    const wave = await A.livreur.get('/api/livraisons/historique?mode_paiement=wave');
    expect(wave.body.items.map((i: any) => i.id)).toEqual([ref.wave.id]);
    expect(wave.body.totaux.nb_livraisons).toBe(1);
    expect((await A.livreur.get('/api/livraisons/historique?mode_paiement=bitcoin')).status).toBe(400);

    const recents = await A.livreur.get(`/api/livraisons/historique?du=${jour(-1)}`);
    expect(recents.body.items.map((i: any) => i.id)).toEqual([ref.sans.id, ref.wave.id]);
    const anciens = await A.livreur.get(`/api/livraisons/historique?au=${jour(-10)}`);
    expect(anciens.body.items.map((i: any) => i.id)).toEqual([ref.ancien.id]);
    expect((await A.livreur.get(`/api/livraisons/historique?du=${jour(0)}&au=${jour(-1)}`)).status).toBe(400);

    const q = await A.livreur.get('/api/livraisons/historique?q=golf');
    expect(q.body.items.map((i: any) => i.id)).toEqual([ref.wave.id]);
    expect((await A.livreur.get(`/api/livraisons/historique?q=${ref.ancien.numero}`)).body.total).toBe(1);

    const p2 = await A.livreur.get('/api/livraisons/historique?taille=2&page=2');
    expect(p2.body).toMatchObject({ total: 3, page: 2, taille: 2 });
    expect(p2.body.items.map((i: any) => i.id)).toEqual([ref.ancien.id]);
  });

  it('l’administrateur voit toutes les livraisons et peut filtrer par livreur', async () => {
    const tout = await A.admin.get('/api/livraisons/historique');
    expect(tout.body.total).toBe(4);
    expect(tout.body.items.every((i: any) => i.fiche_accessible)).toBe(true);
    const l2 = await A.admin.get(`/api/livraisons/historique?livreur_id=${livreur2Id}`);
    expect(l2.body.items.map((i: any) => i.id)).toEqual([ref.autre.id]);
    expect(l2.body.items[0]).toMatchObject({ livreur_nom: 'Mamadou Sow', encaisse: 30000 });
    expect(l2.body.totaux.par_mode).toEqual([expect.objectContaining({ mode: 'especes', montant: 30000 })]);
  });
});
