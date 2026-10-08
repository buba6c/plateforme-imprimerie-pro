// Salles Socket.IO, notifications après COMMIT, fermeture des sockets d'un compte désactivé,
// et règles de notification (audit A11, A14).

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, query, tx } from '../src/db/pool';
import { closeRealtime, deconnecterUtilisateur, initRealtime, notifier, sallesDossier, verifierSockets } from '../src/realtime';
import {
  notifierAffectation,
  notifierReport,
  notifierStatutForce,
  notifierTransitionDossier,
  type DossierNotif,
} from '../src/modules/notifications/regles';
import { agent, app, comptes, envoyerFichier, PASSWORD } from './helpers';

type Recu = { evt: string; data: any };
interface Client {
  socket: Socket;
  recus: Recu[];
}

let url = '';
const ouverts: Socket[] = [];
const ids: Record<string, number> = {};

async function cookieDe(email: string, password = PASSWORD): Promise<string> {
  const r = await supertest(await app()).post('/api/auth/login').send({ email, password });
  if (r.status !== 200) throw new Error(`connexion ${email} : ${r.status}`);
  return ([] as string[]).concat(r.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
}

function ouvrir(cookie: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { path: '/socket.io', transports: ['websocket'], extraHeaders: { cookie }, reconnection: false, forceNew: true });
    ouverts.push(socket);
    const recus: Recu[] = [];
    socket.onAny((evt, data) => recus.push({ evt, data }));
    socket.once('connect', () => resolve({ socket, recus }));
    socket.once('connect_error', (e) => reject(e));
  });
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attendre(c: Client, test: (r: Recu) => boolean, ms = 2000): Promise<Recu> {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const r = c.recus.find(test);
    if (r) return r;
    await pause(20);
  }
  throw new Error('événement attendu non reçu');
}

const notificationsDe = (userId: number, dossierId: number) =>
  query<{ type: string; titre: string; message: string | null }>(`SELECT type, titre, message FROM notifications WHERE user_id = $1 AND dossier_id = $2 ORDER BY id`, [userId, dossierId]);

beforeAll(async () => {
  const server = http.createServer(await app());
  initRealtime(server, { verificationMs: 0 });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const u of await query<{ id: number; email: string }>(`SELECT id, email FROM users`)) ids[u.email] = u.id;
});

afterAll(() => {
  ouverts.forEach((s) => s.disconnect());
  closeRealtime();
});

describe('salles des dossiers', () => {
  const base = { id: 1, numero: 'CMD-2026-0001', machine: 'roland' as const, preparateur_id: 7 };

  it("un dossier jamais validé ne part pas à la salle de sa machine", () => {
    expect(sallesDossier({ ...base, statut: 'en_cours', ancien_statut: null, date_validation: null })).not.toContain('machine:roland');
    expect(sallesDossier({ ...base, statut: 'en_cours', ancien_statut: 'en_cours' })).not.toContain('machine:roland');
  });

  it('un dossier validé une fois y part, même revenu en préparation', () => {
    expect(sallesDossier({ ...base, statut: 'pret_impression', ancien_statut: 'en_cours' })).toContain('machine:roland');
    expect(sallesDossier({ ...base, statut: 'en_cours', ancien_statut: 'pret_impression' })).toContain('machine:roland');
    expect(sallesDossier({ ...base, statut: 'en_cours', ancien_statut: 'en_cours', date_validation: '2026-10-08T10:00:00Z' })).toContain('machine:roland');
  });

  it('le livreur et le préparateur du dossier sont dans les bonnes salles', () => {
    const s = sallesDossier({ ...base, statut: 'pret_livraison', ancien_statut: 'en_impression' });
    expect(s).toEqual(expect.arrayContaining(['role:admin', 'role:preparateur', 'role:livreur', 'user:7', 'machine:roland']));
    expect(sallesDossier({ ...base, statut: 'en_impression', ancien_statut: 'pret_impression' })).not.toContain('role:livreur');
  });
});

describe('temps réel de bout en bout', () => {
  let roland: Client;
  let xerox: Client;
  let dossierId = 0;

  beforeAll(async () => {
    roland = await ouvrir(await cookieDe(comptes.roland));
    xerox = await ouvrir(await cookieDe(comptes.xerox));
  });

  it("l'imprimeur n'est prévenu qu'à la validation, et seulement celui de la machine", async () => {
    const prep = await agent(comptes.prep);
    const r = await prep.post('/api/dossiers').send({
      machine: 'roland',
      client_nom: 'Atelier Temps Réel',
      specs: { lignes: [{ support: 'bache_m2', largeur: 100, hauteur: 100, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
    });
    expect(r.status).toBe(201);
    dossierId = r.body.id;
    expect((await envoyerFichier(prep, dossierId, 'visuel.pdf', Buffer.from('%PDF-1.4 essai'))).status).toBe(204);
    await pause(300);
    expect(roland.recus.filter((x) => x.evt === 'dossier' && x.data.id === dossierId)).toHaveLength(0);

    expect((await prep.post(`/api/dossiers/${dossierId}/actions/valider`).send({})).status).toBe(200);
    await attendre(roland, (x) => x.evt === 'dossier' && x.data.id === dossierId && x.data.statut === 'pret_impression');
    const n = await attendre(roland, (x) => x.evt === 'notification' && x.data.dossier_id === dossierId);
    expect(n.data.type).toBe('nouveau_travail');
    await pause(200);
    expect(xerox.recus.filter((x) => x.data?.id === dossierId || x.data?.dossier_id === dossierId)).toHaveLength(0);
  });

  it("la notification n'est poussée qu'après le COMMIT, jamais après un ROLLBACK", async () => {
    const rolandId = ids[comptes.roland]!;
    const avant = roland.recus.length;
    await expect(
      tx(async (db) => {
        await notifier(db, { userIds: [rolandId] }, { type: 'urgent', titre: 'Annulée', dossier_id: dossierId });
        throw new Error('annulation');
      }),
    ).rejects.toThrow('annulation');
    await pause(200);
    expect(roland.recus.slice(avant).filter((x) => x.evt === 'notification')).toHaveLength(0);
    expect((await notificationsDe(rolandId, dossierId)).some((x) => x.titre === 'Annulée')).toBe(false);

    await tx(async (db) => {
      await notifier(db, { userIds: [rolandId] }, { type: 'urgent', titre: 'Validée', dossier_id: dossierId });
      await pause(150);
      expect(roland.recus.slice(avant).filter((x) => x.evt === 'notification')).toHaveLength(0);
    });
    const n = await attendre(roland, (x) => x.evt === 'notification' && x.data.titre === 'Validée');
    expect(n.data.dossier_id).toBe(dossierId);
  });

  it('deconnecterUtilisateur ferme tout de suite les sockets du compte', async () => {
    const liv = await ouvrir(await cookieDe(comptes.livreur));
    const ferme = new Promise<string>((r) => liv.socket.once('disconnect', (raison) => r(raison)));
    deconnecterUtilisateur(ids[comptes.livreur]!);
    expect(await ferme).toBe('io server disconnect');
    expect(roland.socket.connected).toBe(true);
  });

  it('un compte désactivé perd son socket tout de suite et ne peut plus se reconnecter', async () => {
    const admin = await agent(comptes.admin);
    const cree = await admin.post('/api/users').send({ nom: 'Livreur Temps Réel', email: 'livreur-tr@evocom.test', role: 'livreur', password: 'MotDePasse-Essai-1' });
    expect(cree.status).toBe(201);
    const cookie = await cookieDe('livreur-tr@evocom.test', 'MotDePasse-Essai-1');
    const c = await ouvrir(cookie);
    const ferme = new Promise<string>((r) => c.socket.once('disconnect', (raison) => r(raison)));
    expect(await verifierSockets()).toBe(0);
    // La désactivation ferme le socket immédiatement (deconnecterUtilisateur), sans attendre la vérification périodique.
    await admin.patch(`/api/users/${cree.body.id}`).send({ is_active: false }).expect(200);
    expect(await ferme).toBe('io server disconnect');
    expect(await verifierSockets()).toBe(0);
    await expect(ouvrir(cookie)).rejects.toThrow('non_connecte');
  });
});

describe('règles de notification (A11)', () => {
  const dossier = async (statut: string, extra: Record<string, unknown> = {}): Promise<DossierNotif> => {
    const d = await one<DossierNotif>(
      `INSERT INTO dossiers (numero, machine, client_nom, specs, statut, preparateur_id, livreur_id, livraison_prevue_at)
       VALUES ('TEST-' || floor(random() * 1e9)::text, 'xerox', 'Client Règles', '{"lignes":[],"forfaits":[]}', $1, $2, $3, $4) RETURNING *`,
      [statut, extra.preparateur_id === undefined ? ids[comptes.prep] : extra.preparateur_id, extra.livreur_id ?? null, extra.livraison_prevue_at ?? null],
    );
    return d!;
  };
  const admin = () => ({ id: ids[comptes.admin]!, role: 'admin' as const });

  it('révision sans préparateur : les administrateurs sont prévenus', async () => {
    const d = await dossier('a_revoir', { preparateur_id: null });
    const xeroxUser = { id: ids[comptes.xerox]!, role: 'imprimeur_xerox' as const };
    await notifierTransitionDossier(xeroxUser, 'demander_revision', { ...d, statut: 'pret_impression' }, d, 'Fichier en basse définition');
    expect((await notificationsDe(ids[comptes.admin]!, d.id)).map((n) => n.type)).toEqual(['revision']);
  });

  it("remise en impression : imprimeurs, préparateur, et le livreur perd sa livraison", async () => {
    const livreur = ids[comptes.livreur]!;
    const d = await dossier('pret_impression', { livreur_id: livreur });
    await notifierTransitionDossier(admin(), 'reimprimer', { ...d, statut: 'en_livraison' }, d, 'Couleurs fausses');
    expect((await notificationsDe(ids[comptes.xerox]!, d.id))[0]?.titre).toContain('Remis en impression');
    expect((await notificationsDe(ids[comptes.prep]!, d.id))[0]?.type).toBe('nouveau_travail');
    expect((await notificationsDe(livreur, d.id))[0]?.type).toBe('livraison_annulee');
    expect(await notificationsDe(ids[comptes.admin]!, d.id)).toHaveLength(0);
  });

  it('report par le livreur : administrateurs et préparateur, pas le livreur', async () => {
    const livreur = ids[comptes.livreur]!;
    const d = await dossier('en_livraison', { livreur_id: livreur, livraison_prevue_at: '2026-10-09T10:00:00Z' });
    await notifierReport({ id: livreur, role: 'livreur' }, d, '2026-10-09T10:00:00Z', '2026-10-10', 'Client absent');
    expect((await notificationsDe(ids[comptes.admin]!, d.id))[0]?.message).toContain('Client absent');
    expect((await notificationsDe(ids[comptes.prep]!, d.id))[0]?.type).toBe('report_livraison');
    expect(await notificationsDe(livreur, d.id)).toHaveLength(0);
  });

  it('statut forcé vers « prêt à livrer » : livreurs prévenus, avis au préparateur', async () => {
    const d = await dossier('pret_livraison');
    await notifierStatutForce(admin(), { ...d, statut: 'en_cours' }, d, 'Déjà imprimé hier');
    expect((await notificationsDe(ids[comptes.livreur]!, d.id))[0]?.type).toBe('pret_livraison');
    const prep = await notificationsDe(ids[comptes.prep]!, d.id);
    expect(prep.map((n) => n.type)).toEqual(['statut_force']);
    expect(prep[0]?.message).toContain('En préparation → Prêt à livrer');
  });

  it("changement de livreur : le nouveau et l'ancien sont prévenus, pas une réaffectation identique", async () => {
    const admin2 = await agent(comptes.admin);
    const cree = await admin2.post('/api/users').send({ nom: 'Livreur Deux', email: 'livreur-deux@evocom.test', role: 'livreur', password: 'MotDePasse-Essai-2' });
    const ancien = ids[comptes.livreur]!;
    const nouveau = cree.body.id as number;
    const d = await dossier('en_livraison', { livreur_id: nouveau });
    await notifierAffectation(admin(), { ...d, livreur_id: ancien }, d);
    expect((await notificationsDe(nouveau, d.id))[0]?.type).toBe('affectation');
    expect((await notificationsDe(ancien, d.id))[0]?.titre).toContain('autre livreur');
    await notifierAffectation(admin(), d, d);
    expect(await notificationsDe(nouveau, d.id)).toHaveLength(1);
  });
});
