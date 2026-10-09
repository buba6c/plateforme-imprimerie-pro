// Module WhatsApp : file, règles anti-spam, connexion (socket simulé, jamais de vraie connexion) et routes.
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pino from 'pino';
import supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { __tests as connexionTests, configurerConnexion, connecter, etatConnexion, type EvenementsSocket, type FabriqueSocket } from '../src/modules/whatsapp/connexion';
import { configurerEntrants, surEntrant, traiterEntrant } from '../src/modules/whatsapp/entrants';
import { __tests as fileTests, configurerFile, planifierWhatsApp, traiterFile } from '../src/modules/whatsapp/file';
import { invalidateParametresWhatsApp, PARAMETRES_WHATSAPP_DEFAUT, type ParametresWhatsApp } from '../src/modules/whatsapp/parametres';
import { agent, app, comptes, envoyerFichier } from './helpers';

const STOCKAGE = '/tmp/evocom-test-storage-whatsapp';
const AUTH = path.join(STOCKAGE, 'whatsapp', 'auth');
const log = pino({ level: 'silent' });

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'xerox' | 'livreur', Agent>;

// ---------------------------------------------------------------------------
// Faux socket : enregistre les envois, peut échouer à la demande, expose les événements.
const envois: { jid: string; texte: string }[] = [];
let echouer: Error | null = null;
let enregistre = false;
let fabriqueAppels = 0;
let ev: EvenementsSocket | null = null;
let fermetures: boolean[] = [];
const fausseFabrique: FabriqueSocket = async (opts) => {
  fabriqueAppels++;
  ev = opts.ev;
  opts.ev.surQr('QR-DE-TEST');
  return {
    async envoyer(jid, texte) {
      if (echouer) throw echouer;
      envois.push({ jid, texte });
    },
    async fermer(oublier) {
      fermetures.push(oublier);
    },
    estEnregistre: () => enregistre,
  };
};

const specs = { lignes: [{ support: 'papier_a4_couleur', pages: 2, recto_verso: false, quantite: 10, finitions: [], options: [] }], forfaits: [] };
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n', 'latin1');

async function dossier(extra: Record<string, unknown> = {}) {
  const r = await A.prep.post('/api/dossiers').send({ machine: 'xerox', client_nom: 'Awa Diop', client_telephone: '77 123 45 67', specs, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: number; numero: string };
}

async function action(a: Agent, id: number, nom: string, body: Record<string, unknown> = {}) {
  const r = await a.post(`/api/dossiers/${id}/actions/${nom}`).send(body);
  expect(r.status, `${nom}: ${JSON.stringify(r.body)}`).toBe(200);
  return r.body;
}

async function jusquImprime(extra: Record<string, unknown> = {}) {
  const d = await dossier(extra);
  expect((await envoyerFichier(A.prep, d.id, 'travail.pdf', pdf)).status).toBe(204);
  await action(A.prep, d.id, 'valider');
  await action(A.xerox, d.id, 'demarrer');
  await action(A.xerox, d.id, 'marquer_imprime');
  return d;
}

async function reglages(input: Partial<ParametresWhatsApp>) {
  const r = await A.admin.put('/api/parametres/whatsapp').send(input);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  invalidateParametresWhatsApp();
  return r.body as ParametresWhatsApp;
}

const messages = async (where = '') => (await getPool().query(`SELECT * FROM whatsapp_messages ${where} ORDER BY id`)).rows;

/** Aujourd'hui à Dakar (UTC) à l'heure donnée. */
const aujourdHui = (hhmm: string) => new Date(`${new Date().toISOString().slice(0, 10)}T${hhmm}:00Z`);
/** « Maintenant » pour la file : l'heure réelle (les messages planifiés sont dus), jamais avant 03:00 UTC. */
function base(): Date {
  const n = new Date();
  const min = aujourdHui('03:00');
  return n > min ? n : min;
}

async function viderTout() {
  const pool = getPool();
  await pool.query(`TRUNCATE whatsapp_messages, whatsapp_optout, whatsapp_entrants, notifications, journal, paiements, factures, dossier_events, fichiers, devis, dossiers, clients, compteurs RESTART IDENTITY CASCADE`);
  for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
    await pool.query(`INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`, [cle, JSON.stringify(valeur)]);
  }
  await pool.query(`UPDATE parametres SET valeur = $1 WHERE cle = 'entreprise'`, [JSON.stringify({ ...PARAMETRES_DEFAUT.entreprise, nom: 'Evocom Print', adresse: 'Sacré-Cœur 3, Dakar' })]);
  await pool.query(`UPDATE parametres SET valeur = '"Africa/Dakar"' WHERE cle = 'fuseau'`);
  await pool.query(`DELETE FROM parametres WHERE cle = 'whatsapp'`);
  invalidateParametres();
  invalidateTarifs();
  invalidateParametresWhatsApp();
}

async function connexionOuverte(numero = '+221700000001') {
  await connexionTests.reinitialiser();
  await connecter({ parUtilisateur: true });
  ev!.surOuverture(numero);
  expect(etatConnexion().etat).toBe('connecte');
}

beforeAll(async () => {
  await app();
  await viderTout();
  fs.rmSync(STOCKAGE, { recursive: true, force: true });
  configurerConnexion({ dossierAuth: AUTH, log, fabrique: fausseFabrique, surEntrant });
  configurerFile({ log });
  configurerEntrants({ log });
  for (const k of ['admin', 'prep', 'xerox', 'livreur'] as const) A[k] = await agent(comptes[k]);
});

afterAll(async () => {
  await connexionTests.reinitialiser();
  await viderTout();
  fs.rmSync(STOCKAGE, { recursive: true, force: true });
});

beforeEach(() => {
  envois.length = 0;
  echouer = null;
  fermetures = [];
  fileTests.reinitialiserDelai();
  fileTests.definirAleatoire(() => 0.5);
});

// ---------------------------------------------------------------------------

describe('droits et réglages', () => {
  it('réserve le module à l’administrateur', async () => {
    expect((await supertest(await app()).get('/api/whatsapp/statut')).status).toBe(401);
    expect((await A.prep.get('/api/whatsapp/statut')).status).toBe(403);
    expect((await A.livreur.get('/api/parametres/whatsapp')).status).toBe(403);
    expect((await A.prep.put('/api/parametres/whatsapp').send({ actif: true })).status).toBe(403);
    expect((await A.xerox.get('/api/whatsapp/messages')).status).toBe(403);
  });

  it('démarre désactivé et déconnecté, sans contenu d’authentification', async () => {
    const r = await A.admin.get('/api/whatsapp/statut');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ actif: false, etat: 'deconnecte', numero: null, qr: null, disponible: true, file: { en_attente: 0, envoyes_aujourdhui: 0, echecs: 0 } });
    expect(JSON.stringify(r.body)).not.toMatch(/creds|noiseKey|signedIdentityKey/);
  });

  it('lit et enregistre la section whatsapp des paramètres', async () => {
    const avant = await A.admin.get('/api/parametres/whatsapp');
    expect(avant.status).toBe(200);
    expect(avant.body.actif).toBe(false);
    expect(avant.body.modeles.pret_livraison).toBe(PARAMETRES_WHATSAPP_DEFAUT.modeles.pret_livraison);
    expect(avant.body.apercu.pret_livraison).toContain('Awa Diop');
    expect(avant.body.variables).toContain('travail');

    const p = await reglages({ actif: true, heures: { debut: '08:00', fin: '20:00' }, delai: { min_s: 5, max_s: 5 }, signature: 'L’équipe Evocom' });
    expect(p.actif).toBe(true);
    expect(p.signature).toBe('L’équipe Evocom');
    expect(p.limites).toEqual({ par_heure: 20, par_jour: 120 });
    const relu = await getPool().query(`SELECT valeur FROM parametres WHERE cle = 'whatsapp'`);
    expect(relu.rows[0].valeur.actif).toBe(true);
    const j = await getPool().query(`SELECT action FROM journal WHERE action = 'whatsapp_parametres_modifies'`);
    expect(j.rowCount).toBe(1);
  });

  it('refuse des réglages incohérents ou inconnus', async () => {
    let r = await A.admin.put('/api/parametres/whatsapp').send({ heures: { debut: '21:00', fin: '20:00' } });
    expect(r.status).toBe(400);
    expect(r.body.champs['heures.fin']).toBeTruthy();
    r = await A.admin.put('/api/parametres/whatsapp').send({ modeles: { livre: 'Lien https://bit.ly/x' } });
    expect(r.status).toBe(400);
    r = await A.admin.put('/api/parametres/whatsapp').send({ inconnu: 1 });
    expect(r.status).toBe(400);
    r = await A.admin.put('/api/parametres/whatsapp').send({ delai: { min_s: 1 } });
    expect(r.status).toBe(400);
  });
});

describe('connexion (socket simulé)', () => {
  it('génère un code QR puis se connecte', async () => {
    await connexionTests.reinitialiser();
    const r = await A.admin.post('/api/whatsapp/connecter');
    expect(r.status).toBe(200);
    expect(['connexion', 'qr']).toContain(r.body.etat);
    let qr: string | null = null;
    for (let i = 0; i < 40 && !qr; i++) {
      await new Promise((f) => setTimeout(f, 25));
      qr = (await A.admin.get('/api/whatsapp/statut')).body.qr;
    }
    expect(qr).toMatch(/^data:image\/png;base64,/);
    expect((await getPool().query(`SELECT 1 FROM journal WHERE action = 'whatsapp_connexion'`)).rowCount).toBe(1);

    ev!.surOuverture('+221700000001');
    const s = await A.admin.get('/api/whatsapp/statut');
    expect(s.body).toMatchObject({ etat: 'connecte', numero: '+221700000001', qr: null });
    expect(s.body.depuis).toBeTruthy();
  });

  it('ne fait jamais plus d’une tentative automatique par 30 s', async () => {
    await connexionOuverte();
    const avant = fabriqueAppels;
    enregistre = true;
    ev!.surFermeture({ deconnecte: false, code: 428, motif: 'Connexion fermée par WhatsApp' });
    expect(etatConnexion().etat).toBe('connexion');
    expect(connexionTests.reconnexionProgrammee()).toBe(true);
    await connecter({ parUtilisateur: false });
    expect(fabriqueAppels).toBe(avant);
    enregistre = false;
  });

  it('un code QR jamais scanné ne provoque pas de reconnexion', async () => {
    await connexionTests.reinitialiser();
    await connecter({ parUtilisateur: true });
    enregistre = false;
    ev!.surFermeture({ deconnecte: false, code: 408, motif: 'Délai dépassé' });
    const e = etatConnexion();
    expect(e.etat).toBe('deconnecte');
    expect(e.erreur).toMatch(/code QR a expiré/);
    expect(connexionTests.reconnexionProgrammee()).toBe(false);
  });

  it('un appareil déconnecté depuis le téléphone efface les identifiants et ne réessaie pas', async () => {
    await connexionOuverte();
    fs.mkdirSync(AUTH, { recursive: true });
    fs.writeFileSync(path.join(AUTH, 'creds.json'), JSON.stringify({ registered: true }));
    ev!.surFermeture({ deconnecte: true, code: 401, motif: 'Appareil déconnecté depuis le téléphone' });
    const e = etatConnexion();
    expect(e.etat).toBe('deconnecte');
    expect(e.enregistre).toBe(false);
    expect(fs.existsSync(path.join(AUTH, 'creds.json'))).toBe(false);
    expect(connexionTests.reconnexionProgrammee()).toBe(false);
    expect(e.erreur).toMatch(/téléphone/);
  });

  it('déconnecter ferme la session, oublie l’appareil et est journalisé', async () => {
    await connexionOuverte();
    fs.mkdirSync(AUTH, { recursive: true });
    fs.writeFileSync(path.join(AUTH, 'creds.json'), JSON.stringify({ registered: true }));
    const r = await A.admin.post('/api/whatsapp/deconnecter');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ etat: 'deconnecte', numero: null, enregistre: false });
    expect(fermetures.at(-1)).toBe(true);
    expect(fs.existsSync(path.join(AUTH, 'creds.json'))).toBe(false);
    expect((fs.statSync(AUTH).mode & 0o777).toString(8)).toBe('700');
  });

  it('continue sans WhatsApp quand la bibliothèque manque', async () => {
    await connexionTests.reinitialiser();
    connexionTests.definirFabrique(async () => {
      throw Object.assign(new Error("Cannot find package '@whiskeysockets/baileys'"), { code: 'ERR_MODULE_NOT_FOUND' });
    });
    const r = await A.admin.post('/api/whatsapp/connecter');
    expect(r.status).toBe(200);
    expect(r.body.disponible).toBe(false);
    expect(r.body.etat).toBe('deconnecte');
    expect(r.body.erreur).toMatch(/bibliothèque WhatsApp/i);
    expect((await A.admin.get('/api/dossiers')).status).toBe(200);
    connexionTests.definirFabrique(fausseFabrique);
    await connexionTests.reinitialiser();
  });
});

describe('file et règles anti-spam', () => {
  beforeAll(async () => {
    await reglages({ actif: true, heures: { debut: '00:00', fin: '23:59' }, limites: { par_heure: 20, par_jour: 120 }, delai: { min_s: 30, max_s: 60 }, signature: '' });
  });

  it('planifie un seul message par (dossier, événement) avec le texte personnalisé', async () => {
    const d = await jusquImprime();
    const rows = await messages(`WHERE dossier_id = ${d.id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ evenement: 'pret_livraison', statut: 'en_attente', telephone: '+221771234567', tentatives: 0 });
    expect(rows[0].texte).toBe(`Bonjour Awa Diop, votre commande ${d.numero} (A4 couleur · 2 p. · 10 ex.) est imprimée et prête : notre livreur vous contactera pour la livraison.`);
    expect(await planifierWhatsApp('pret_livraison', d.id)).toBeNull();
    expect(await messages(`WHERE dossier_id = ${d.id}`)).toHaveLength(1);
  });

  it('retrait sur place : adresse de l’entreprise ; livraison programmée et livrée : un message chacun', async () => {
    const d = await jusquImprime({ mode_remise: 'retrait' });
    let rows = await messages(`WHERE dossier_id = ${d.id}`);
    expect(rows[0]).toMatchObject({ evenement: 'pret_retrait' });
    expect(rows[0].texte).toContain('vous pouvez venir la retirer à Evocom Print, Sacré-Cœur 3, Dakar.');
    await action(A.prep, d.id, 'remettre_client');
    rows = await messages(`WHERE dossier_id = ${d.id}`);
    expect(rows.map((r) => r.evenement)).toEqual(['pret_retrait', 'livre']);
    expect(rows[1].texte).toContain('a été livrée. Merci pour votre confiance !');

    const l = await jusquImprime();
    await action(A.livreur, l.id, 'programmer_livraison', { livraison: { date_prevue: '2030-01-10T14:00:00Z' } });
    await action(A.livreur, l.id, 'confirmer_livraison');
    rows = await messages(`WHERE dossier_id = ${l.id}`);
    expect(rows.map((r) => r.evenement)).toEqual(['pret_livraison', 'en_livraison', 'livre']);
    expect(rows[1].texte).toContain('sera livrée le jeudi 10 janvier à 14:00');
  });

  it('numéro absent ou invalide → ignoré avec le motif', async () => {
    const sans = await jusquImprime({ client_telephone: '' });
    expect((await messages(`WHERE dossier_id = ${sans.id}`))[0]).toMatchObject({ statut: 'ignore', motif: 'Pas de numéro de téléphone sur le dossier' });
    const faux = await jusquImprime({ client_telephone: '33 821 12 34' });
    expect((await messages(`WHERE dossier_id = ${faux.id}`))[0]).toMatchObject({ statut: 'ignore', motif: 'Numéro invalide : « 33 821 12 34 »', telephone: '33 821 12 34' });
  });

  it('module désactivé → ignoré, rien ne part', async () => {
    await reglages({ actif: false });
    const d = await jusquImprime();
    expect((await messages(`WHERE dossier_id = ${d.id}`))[0]).toMatchObject({ statut: 'ignore', motif: 'Messages WhatsApp désactivés dans les réglages' });
    await connexionOuverte();
    expect((await traiterFile({ maintenant: base() })).resultat).toBe('inactif');
    await reglages({ actif: true });
  });

  it('n’envoie que connecté, dans les heures, avec un délai aléatoire entre deux envois', async () => {
    await getPool().query(`UPDATE whatsapp_messages SET statut = 'annule', motif = 'test' WHERE statut = 'en_attente'`);
    const d1 = await jusquImprime({ client_telephone: '77 111 11 11' });
    const d2 = await jusquImprime({ client_telephone: '77 222 22 22' });
    connexionTests.forcerEtat('deconnecte');
    expect((await traiterFile({ maintenant: base() })).resultat).toBe('deconnecte');
    await connexionOuverte();
    await reglages({ heures: { debut: '08:00', fin: '09:00' } });
    expect((await traiterFile({ maintenant: aujourdHui('07:59') })).resultat).toBe('hors_heures');
    expect((await traiterFile({ maintenant: aujourdHui('09:00') })).resultat).toBe('hors_heures');
    expect((await traiterFile({ maintenant: aujourdHui('23:30') })).resultat).toBe('hors_heures');
    expect(envois).toHaveLength(0);
    await reglages({ heures: { debut: '00:00', fin: '23:59' } });

    const t0 = base();
    const p1 = await traiterFile({ maintenant: t0 });
    expect(p1).toMatchObject({ resultat: 'envoye' });
    expect(envois).toEqual([{ jid: '221771111111@s.whatsapp.net', texte: expect.stringContaining(d1.numero) }]);
    // Délai aléatoire : 30 + 0,5 × (60 − 30) = 45 s.
    expect(fileTests.prochainEnvoiAt()).toBe(t0.getTime() + 45_000);
    expect((await traiterFile({ maintenant: new Date(t0.getTime() + 44_000) })).resultat).toBe('delai');
    expect((await traiterFile({ maintenant: new Date(t0.getTime() + 45_000) })).resultat).toBe('envoye');
    expect(envois[1]!.texte).toContain(d2.numero);
    fileTests.reinitialiserDelai();
    expect((await traiterFile({ maintenant: t0 })).resultat).toBe('vide');
    const rows = await messages(`WHERE dossier_id IN (${d1.id}, ${d2.id})`);
    expect(rows.map((r) => r.statut)).toEqual(['envoye', 'envoye']);
    expect(rows[0].envoye_at).toBeTruthy();
    expect(rows[0].tentatives).toBe(1);
  });

  it('respecte les limites par heure et par jour', async () => {
    await connexionOuverte();
    await getPool().query(`UPDATE whatsapp_messages SET statut = 'annule', motif = 'test' WHERE statut = 'en_attente'`);
    await jusquImprime({ client_telephone: '77 333 33 33' });
    const t0 = base();
    await getPool().query(`UPDATE whatsapp_messages SET envoye_at = $1 WHERE statut = 'envoye'`, [new Date(t0.getTime() - 30 * 60_000).toISOString()]);
    const envoyes = (await messages(`WHERE statut = 'envoye'`)).length;
    expect(envoyes).toBeGreaterThanOrEqual(2);

    await reglages({ limites: { par_heure: envoyes, par_jour: 120 } });
    expect((await traiterFile({ maintenant: t0 })).resultat).toBe('limite_heure');
    // Envois vieux de plus d'une heure : la limite horaire est libérée, pas la journalière.
    await getPool().query(`UPDATE whatsapp_messages SET envoye_at = $1 WHERE statut = 'envoye'`, [new Date(t0.getTime() - 90 * 60_000).toISOString()]);
    await reglages({ limites: { par_heure: 20, par_jour: envoyes } });
    expect((await traiterFile({ maintenant: t0 })).resultat).toBe('limite_jour');
    await reglages({ limites: { par_heure: 20, par_jour: 120 } });
    expect((await traiterFile({ maintenant: t0 })).resultat).toBe('envoye');
  });

  it('abandonne après 3 tentatives, avec le motif', async () => {
    await connexionOuverte();
    await getPool().query(`UPDATE whatsapp_messages SET statut = 'annule', motif = 'test' WHERE statut = 'en_attente'`);
    const d = await jusquImprime({ client_telephone: '77 444 44 44' });
    echouer = new Error('Réseau coupé');
    const t0 = base();
    const p1 = await traiterFile({ maintenant: t0 });
    expect(p1).toMatchObject({ resultat: 'reporte', motif: 'Tentative 1 échouée : Réseau coupé' });
    let m = (await messages(`WHERE dossier_id = ${d.id}`))[0];
    expect(m).toMatchObject({ statut: 'en_attente', tentatives: 1 });
    expect(new Date(m.planifie_at).getTime()).toBe(t0.getTime() + 2 * 60_000);
    fileTests.reinitialiserDelai();
    // Pas encore l'heure de la nouvelle tentative.
    expect((await traiterFile({ maintenant: new Date(t0.getTime() + 60_000) })).resultat).toBe('vide');
    expect((await traiterFile({ maintenant: new Date(t0.getTime() + 2 * 60_000) })).resultat).toBe('reporte');
    fileTests.reinitialiserDelai();
    const p3 = await traiterFile({ maintenant: new Date(t0.getTime() + 10 * 60_000) });
    expect(p3).toMatchObject({ resultat: 'echec', motif: 'Échec après 3 tentatives : Réseau coupé' });
    m = (await messages(`WHERE dossier_id = ${d.id}`))[0];
    expect(m).toMatchObject({ statut: 'echec', tentatives: 3 });
    expect(envois).toHaveLength(0);
    echouer = null;

    // Réessayer depuis l'écran : repart à zéro, puis part.
    const r = await A.admin.post(`/api/whatsapp/messages/${m.id}/reessayer`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ statut: 'en_attente', tentatives: 0, motif: null, numero: d.numero, client_nom: 'Awa Diop' });
    await getPool().query(`UPDATE whatsapp_messages SET planifie_at = $2 WHERE id = $1`, [m.id, t0.toISOString()]);
    fileTests.reinitialiserDelai();
    expect((await traiterFile({ maintenant: new Date(t0.getTime() + 11 * 60_000) })).resultat).toBe('envoye');
    expect((await A.admin.post(`/api/whatsapp/messages/${m.id}/reessayer`)).status).toBe(409);
    expect((await A.admin.post(`/api/whatsapp/messages/${m.id}/annuler`)).status).toBe(409);
  });

  it('liste STOP : jamais de message, STOP reçu = exclusion automatique avec accusé', async () => {
    await connexionOuverte();
    await getPool().query(`UPDATE whatsapp_messages SET statut = 'annule', motif = 'test' WHERE statut = 'en_attente'`);
    const d = await jusquImprime({ client_telephone: '77 555 55 55' });
    expect((await messages(`WHERE dossier_id = ${d.id}`))[0].statut).toBe('en_attente');

    // Le client répond STOP depuis son téléphone.
    const r = await traiterEntrant('221775555555@s.whatsapp.net', '  Stop svp, merci ');
    expect(r).toEqual({ telephone: '+221775555555', stop: true, accuse: true });
    expect(envois).toEqual([{ jid: '221775555555@s.whatsapp.net', texte: 'Vous ne recevrez plus de messages de Evocom Print. Merci.' }]);
    expect((await messages(`WHERE dossier_id = ${d.id}`))[0]).toMatchObject({ statut: 'annule', motif: 'Le client a demandé STOP' });
    const optout = await A.admin.get('/api/whatsapp/optout');
    expect(optout.body).toEqual([{ telephone: '+221775555555', motif: 'STOP reçu par WhatsApp', created_at: expect.any(String) }]);
    const entrants = await A.admin.get('/api/whatsapp/entrants');
    expect(entrants.body.items[0]).toMatchObject({ telephone: '+221775555555', texte: 'Stop svp, merci' });

    // Un second STOP n'envoie pas de nouvel accusé ; les événements suivants sont ignorés.
    envois.length = 0;
    expect((await traiterEntrant('221775555555@s.whatsapp.net', 'STOP')).accuse).toBe(false);
    expect(envois).toHaveLength(0);
    await action(A.livreur, d.id, 'programmer_livraison', { livraison: { date_prevue: '2030-01-10T14:00:00Z' } });
    expect((await messages(`WHERE dossier_id = ${d.id} AND evenement = 'en_livraison'`))[0]).toMatchObject({ statut: 'ignore', motif: 'Numéro en liste STOP' });
    expect((await A.admin.post(`/api/whatsapp/messages/${(await messages(`WHERE dossier_id = ${d.id} AND evenement = 'en_livraison'`))[0].id}/reessayer`)).status).toBe(409);

    // Un message déjà en attente vers un numéro passé en STOP est ignoré au moment de l'envoi.
    const autre = await jusquImprime({ client_telephone: '77 666 66 66' });
    await getPool().query(`INSERT INTO whatsapp_optout (telephone, motif) VALUES ('+221776666666', 'manuel')`);
    expect(await traiterFile({ maintenant: base() })).toMatchObject({ resultat: 'ignore', motif: 'Numéro en liste STOP' });
    expect((await messages(`WHERE dossier_id = ${autre.id}`))[0].statut).toBe('ignore');

    // Retrait de la liste par l'administrateur.
    expect((await A.admin.delete(`/api/whatsapp/optout/${encodeURIComponent('+221775555555')}`)).status).toBe(204);
    expect((await A.admin.delete(`/api/whatsapp/optout/${encodeURIComponent('+221775555555')}`)).status).toBe(404);
    expect((await A.admin.get('/api/whatsapp/optout')).body).toHaveLength(1);
    const texte = 'x'.repeat(600);
    await traiterEntrant('221775555555@s.whatsapp.net', texte);
    const long = (await A.admin.get('/api/whatsapp/entrants')).body.items[0];
    expect(long.texte).toHaveLength(500);
  });
});

describe('routes : journal, test, annulation', () => {
  beforeAll(async () => {
    await viderTout();
    await reglages({ actif: true, heures: { debut: '00:00', fin: '23:59' }, delai: { min_s: 5, max_s: 5 } });
    await connexionOuverte();
  });

  it('message de test : mêmes règles, numéro vérifié', async () => {
    let r = await A.admin.post('/api/whatsapp/test').send({ telephone: '12' });
    expect(r.status).toBe(422);
    expect(r.body.champs.telephone).toMatch(/invalide/);
    r = await A.admin.post('/api/whatsapp/test').send({});
    expect(r.status).toBe(400);
    r = await A.admin.post('/api/whatsapp/test').send({ telephone: '77 000 00 00' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ evenement: 'test', evenement_label: 'Message de test', statut: 'en_attente', telephone: '+221770000000', dossier_id: null });
    expect(r.body.texte).toContain('Message de test Evocom Print');
    expect((await traiterFile({ maintenant: base() })).resultat).toBe('envoye');
    expect(envois[0]!.jid).toBe('221770000000@s.whatsapp.net');
    // Un second test est possible (pas de dossier : la contrainte d'unicité ne s'applique pas).
    expect((await A.admin.post('/api/whatsapp/test').send({ telephone: '77 000 00 00' })).status).toBe(201);
    await reglages({ actif: false });
    r = await A.admin.post('/api/whatsapp/test').send({ telephone: '77 000 00 00' });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/Activez/);
    await reglages({ actif: true });
  });

  it('journal filtré par statut et recherche, annulation d’un message en attente', async () => {
    const d = await jusquImprime({ client_nom: 'Boutique Keur Yaye', client_telephone: '78 123 00 00' });
    let r = await A.admin.get('/api/whatsapp/messages');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(3);
    expect(r.body.compteurs).toMatchObject({ en_attente: 2, envoye: 1 });
    expect(r.body.items[0]).toMatchObject({ numero: d.numero, client_nom: 'Boutique Keur Yaye', evenement_label: 'Commande prête, livraison à venir' });

    r = await A.admin.get('/api/whatsapp/messages').query({ q: d.numero });
    expect(r.body.items.map((m: { dossier_id: number | null }) => m.dossier_id)).toEqual([d.id]);
    r = await A.admin.get('/api/whatsapp/messages').query({ q: '78 123' });
    expect(r.body.total).toBe(1);
    r = await A.admin.get('/api/whatsapp/messages').query({ q: 'keur' });
    expect(r.body.total).toBe(1);
    r = await A.admin.get('/api/whatsapp/messages').query({ statut: 'envoye' });
    expect(r.body.items.every((m: { statut: string }) => m.statut === 'envoye')).toBe(true);
    expect((await A.admin.get('/api/whatsapp/messages').query({ statut: 'bidon' })).status).toBe(400);

    const id = (await messages(`WHERE dossier_id = ${d.id}`))[0].id;
    r = await A.admin.post(`/api/whatsapp/messages/${id}/annuler`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ statut: 'annule', motif: expect.stringMatching(/^Annulé par /) });
    expect((await A.admin.post(`/api/whatsapp/messages/${id}/annuler`)).status).toBe(409);
    expect((await A.admin.post(`/api/whatsapp/messages/999999/annuler`)).status).toBe(404);
    const j = await getPool().query(`SELECT action FROM journal WHERE action IN ('whatsapp_annulation', 'whatsapp_test') ORDER BY id`);
    expect(j.rows.map((x) => x.action)).toContain('whatsapp_annulation');
    expect(j.rows.map((x) => x.action)).toContain('whatsapp_test');

    const statut = await A.admin.get('/api/whatsapp/statut');
    expect(statut.body.file).toMatchObject({ en_attente: 1, envoyes_aujourdhui: 1, echecs: 0 });
  });
});
