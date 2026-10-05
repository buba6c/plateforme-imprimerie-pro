import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { getPool } from '../src/db/pool';
import { invalidateParametres, PARAMETRES_DEFAUT, TYPES_NOTIFICATION } from '../src/lib/params';
import { invalidateTarifs } from '../src/lib/tarifs';
import { agent, app, comptes, envoyerFichier, PASSWORD } from './helpers';

// Stockage propre à ce fichier : la réinitialisation y déplace des fichiers et y écrit sa sauvegarde.
const STOCKAGE = '/tmp/evocom-test-storage-parametres';
process.env.STORAGE_DIR = STOCKAGE;
delete process.env.ALLOW_SYSTEM_RESET;

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'livreur', Agent>;
const ANNEE = new Date().getFullYear();

const bache = {
  machine: 'roland',
  client_nom: 'Boutique Keur Yaye',
  client_telephone: '77 412 58 90',
  specs: { lignes: [{ support: 'bache_m2', largeur: 300, hauteur: 200, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] },
};

function binaire(res: any, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

/** Texte d'un PDF produit par pdfkit : flux décompressés, chaînes hexadécimales des opérateurs TJ. */
function textePdf(pdf: Buffer): string {
  const brut = pdf.toString('latin1');
  const lignes: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(brut))) {
    const debut = m.index + m[0].length;
    const fin = brut.indexOf('endstream', debut);
    let contenu: string;
    try {
      contenu = zlib.inflateSync(pdf.subarray(debut, fin)).toString('latin1');
    } catch {
      continue;
    }
    for (const tj of contenu.matchAll(/\[(.*?)\]\s*TJ/g)) {
      lignes.push([...tj[1]!.matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => Buffer.from(h[1]!, 'hex').toString('latin1')).join(''));
    }
  }
  return lignes.join('\n');
}

async function remettreParDefaut() {
  const pool = getPool();
  for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
    await pool.query(`INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`, [cle, JSON.stringify(valeur)]);
  }
  await pool.query(`UPDATE users SET echecs_connexion = 0, bloque_jusqu_a = NULL`);
  invalidateParametres();
  invalidateTarifs();
}

const compte = async (table: string) => (await getPool().query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;

beforeAll(async () => {
  await app();
  await getPool().query(
    `TRUNCATE notifications, journal, paiements, factures, dossier_events, fichiers, devis, dossiers, clients, compteurs RESTART IDENTITY CASCADE`,
  );
  await remettreParDefaut();
  A.admin = await agent(comptes.admin);
  A.prep = await agent(comptes.prep);
  A.livreur = await agent(comptes.livreur);
});

afterAll(async () => {
  await getPool().query(`DELETE FROM parametres WHERE cle = 'apparence'`);
  await getPool().query(`DELETE FROM preferences_utilisateur`);
  await getPool().query(`UPDATE ia_config SET modele = DEFAULT WHERE id = 1`);
  await remettreParDefaut();
  delete process.env.ALLOW_SYSTEM_RESET;
});

// ---------------------------------------------------------------------------

describe('lecture et validation des paramètres', () => {
  it("l'administrateur voit toutes les sections, les autres rôles seulement les sections publiques", async () => {
    const admin = await A.admin.get('/api/parametres');
    expect(Object.keys(admin.body).sort()).toEqual(
      ['documents', 'entreprise', 'fichiers', 'fuseau', 'livreur_jours_historique', 'notifications', 'prix', 'securite'].sort(),
    );
    expect(admin.body.securite).toEqual({ session_heures: 12, echecs_avant_blocage: 5, blocage_minutes: 15, mdp_longueur_min: 8 });
    expect(admin.body.fichiers).toEqual({ taille_max_mo: 4096, extensions: [] });
    expect(admin.body.documents.devis_validite_jours).toBe(15);
    expect(Object.keys(admin.body.notifications).sort()).toEqual([...TYPES_NOTIFICATION].sort());

    const prep = await A.prep.get('/api/parametres');
    expect(Object.keys(prep.body).sort()).toEqual(['entreprise', 'fuseau', 'livreur_jours_historique', 'prix']);

    const regles = await A.livreur.get('/api/parametres/regles');
    expect(regles.status).toBe(200);
    expect(regles.body).toEqual({
      fichiers: { taille_max_mo: 4096, extensions: [], plafond_serveur_mo: 4096 },
      securite: { mdp_longueur_min: 8 },
      documents: { devis_validite_jours: 15 },
    });
    expect((await A.prep.put('/api/parametres').send({ securite: { session_heures: 2 } })).status).toBe(403);
  });

  it('refuse les valeurs hors bornes, les champs inconnus et un plancher de mot de passe sous 8', async () => {
    const r = await A.admin.put('/api/parametres').send({
      securite: { session_heures: 0, echecs_avant_blocage: 100, blocage_minutes: 2.5, mdp_longueur_min: 6 },
      fichiers: { taille_max_mo: 5000, extensions: ['p d f'] },
      documents: { devis_validite_jours: 0, mentions_devis: 'x'.repeat(1001) },
      notifications: { inconnu: true },
    });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.champs)).toEqual(
      expect.arrayContaining([
        'securite.session_heures',
        'securite.echecs_avant_blocage',
        'securite.blocage_minutes',
        'securite.mdp_longueur_min',
        'fichiers.taille_max_mo',
        'fichiers.extensions.0',
        'documents.devis_validite_jours',
        'documents.mentions_devis',
        'notifications',
      ]),
    );
    expect(r.body.champs['fichiers.taille_max_mo']).toContain('4096 Mo');
    expect((await A.admin.get('/api/parametres')).body.securite.mdp_longueur_min).toBe(8);
  });

  it('chaque enregistrement est visible immédiatement (cache invalidé) et journalisé', async () => {
    await A.admin.get('/api/parametres/regles'); // remplit le cache
    const r = await A.admin.put('/api/parametres').send({ fichiers: { extensions: ['.PDF', 'tiff', 'pdf'] } });
    expect(r.status).toBe(200);
    expect(r.body.fichiers.extensions).toEqual(['pdf', 'tiff']);
    expect((await A.prep.get('/api/parametres/regles')).body.fichiers.extensions).toEqual(['pdf', 'tiff']);
    const j = await A.admin.get('/api/journal?action=parametres_modifies');
    expect(j.body.items[0].data.fichiers).toEqual({ avant: { taille_max_mo: 4096, extensions: [] }, apres: { taille_max_mo: 4096, extensions: ['pdf', 'tiff'] } });
    await A.admin.put('/api/parametres').send({ fichiers: { extensions: [] } }).expect(200);
  });
});

describe('sécurité', () => {
  it('la durée de session règle le jeton et le cookie des connexions suivantes', async () => {
    await A.admin.put('/api/parametres').send({ securite: { session_heures: 2 } }).expect(200);
    const a = supertest.agent(await app());
    const r = await a.post('/api/auth/login').send({ email: comptes.prep, password: PASSWORD });
    expect(r.status).toBe(200);
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/Max-Age=7200/);
    const jeton = /evocom_session=([^;]+)/.exec(cookie)![1]!;
    const charge = JSON.parse(Buffer.from(jeton.split('.')[1]!, 'base64url').toString());
    expect(charge.exp - charge.iat).toBe(7200);
    await A.admin.put('/api/parametres').send({ securite: { session_heures: 12 } }).expect(200);
  });

  it('bloque le compte après le nombre d’échecs réglé, pour la durée réglée', async () => {
    await A.admin.put('/api/parametres').send({ securite: { echecs_avant_blocage: 3, blocage_minutes: 2 } }).expect(200);
    const a = supertest.agent(await app());
    for (let i = 0; i < 3; i++) expect((await a.post('/api/auth/login').send({ email: comptes.livreur, password: 'faux' })).status).toBe(401);
    const r = await a.post('/api/auth/login').send({ email: comptes.livreur, password: PASSWORD });
    expect(r.status).toBe(429);
    expect(r.body.error).toContain('3 essais');
    expect(r.body.error).toContain('2 minutes');
    const u = await getPool().query(`SELECT extract(epoch FROM bloque_jusqu_a - now())::int AS s FROM users WHERE email = $1`, [comptes.livreur]);
    expect(u.rows[0].s).toBeGreaterThan(100);
    expect(u.rows[0].s).toBeLessThanOrEqual(120);
    await remettreParDefaut();
  });

  it('impose la longueur minimale à la création, au changement et au mot de passe provisoire', async () => {
    await A.admin.put('/api/parametres').send({ securite: { mdp_longueur_min: 12 } }).expect(200);
    const court = await A.admin.post('/api/users').send({ nom: 'Test Longueur', email: 'longueur@evocom.test', role: 'livreur', password: 'Court2026!' });
    expect(court.status).toBe(400);
    expect(court.body.champs.password).toContain('12');
    const ok = await A.admin.post('/api/users').send({ nom: 'Test Longueur', email: 'longueur@evocom.test', role: 'livreur', password: 'AssezLong2026!' });
    expect(ok.status).toBe(201);

    const u = supertest.agent(await app());
    await u.post('/api/auth/login').send({ email: 'longueur@evocom.test', password: 'AssezLong2026!' }).expect(200);
    const change = await u.post('/api/auth/mot-de-passe').send({ actuel: 'AssezLong2026!', nouveau: 'Court2026!' });
    expect(change.status).toBe(400);
    expect(change.body.champs.nouveau).toContain('12');
    await u.post('/api/auth/mot-de-passe').send({ actuel: 'AssezLong2026!', nouveau: 'EncorePlusLong2026!' }).expect(204);

    await A.admin.put('/api/parametres').send({ securite: { mdp_longueur_min: 20 } }).expect(200);
    const prov = await A.admin.post(`/api/users/${ok.body.id}/reinitialiser-mot-de-passe`);
    expect(prov.body.mot_de_passe_provisoire.length).toBeGreaterThanOrEqual(20);
    await A.admin.put('/api/parametres').send({ securite: { mdp_longueur_min: 8 } }).expect(200);
  });
});

describe('fichiers', () => {
  it('applique la taille maximale et les extensions acceptées à l’envoi tus', async () => {
    const d = await A.prep.post('/api/dossiers').send(bache);
    expect(d.status).toBe(201);
    await A.admin.put('/api/parametres').send({ fichiers: { taille_max_mo: 1 } }).expect(200);
    const gros = await envoyerFichier(A.prep, d.body.id, 'gros.pdf', Buffer.alloc(1024 * 1024 + 10, 1));
    expect(gros.status).toBe(413);
    expect(gros.body).toContain('1 Mo au maximum');
    expect((await envoyerFichier(A.prep, d.body.id, 'petit.pdf', Buffer.from('%PDF-1.4\n'))).status).toBe(204);

    await A.admin.put('/api/parametres').send({ fichiers: { extensions: ['pdf', 'tiff'] } }).expect(200);
    const exe = await envoyerFichier(A.prep, d.body.id, 'logo.exe', Buffer.from('MZ'), 'application/octet-stream');
    expect(exe.status).toBe(415);
    expect(exe.body).toContain('.exe');
    expect(exe.body).toContain('.pdf, .tiff');
    const sansExt = await envoyerFichier(A.prep, d.body.id, 'logo', Buffer.from('x'));
    expect(sansExt.status).toBe(415);
    expect((await envoyerFichier(A.prep, d.body.id, 'Photo.TIFF', Buffer.from('II*\0'), 'image/tiff')).status).toBe(204);
    await remettreParDefaut();
  });
});

describe('documents', () => {
  it('la validité par défaut des devis vient des paramètres', async () => {
    await A.admin.put('/api/parametres').send({ documents: { devis_validite_jours: 30 } }).expect(200);
    const d = await A.prep.post('/api/devis').send(bache);
    expect(d.status).toBe(201);
    expect(d.body.validite_jours).toBe(30);
    const explicite = await A.prep.post('/api/devis').send({ ...bache, validite_jours: 10 });
    expect(explicite.body.validite_jours).toBe(10);
  });

  it('imprime les mentions en bas des devis et les conditions de paiement en bas des factures', async () => {
    await A.admin
      .put('/api/parametres')
      .send({ documents: { mentions_devis: 'Acompte de 50 % a la commande.', conditions_paiement: 'Paiement sous 30 jours par Wave.' } })
      .expect(200);
    const devis = await A.prep.post('/api/devis').send(bache);
    const pdfDevis = await A.prep.get(`/api/devis/${devis.body.id}/pdf`).buffer(true).parse(binaire);
    expect(pdfDevis.status).toBe(200);
    const texteDevis = textePdf(pdfDevis.body as Buffer);
    expect(texteDevis).toContain('Acompte de 50 % a la commande.');
    expect(texteDevis).not.toContain('Paiement sous 30 jours');

    const dossier = await A.prep.post('/api/dossiers').send(bache);
    const f = await A.prep.post(`/api/dossiers/${dossier.body.id}/facture`);
    expect(f.status).toBe(201);
    const pdfFacture = await A.prep.get(`/api/factures/${f.body.id}/pdf`).buffer(true).parse(binaire);
    const texteFacture = textePdf(pdfFacture.body as Buffer);
    expect(texteFacture).toContain('Paiement sous 30 jours par Wave.');
    expect(texteFacture).not.toContain('Acompte de 50 %');

    await A.admin.put('/api/parametres').send({ documents: { mentions_devis: '', conditions_paiement: '' } }).expect(200);
    const sans = await A.prep.get(`/api/devis/${devis.body.id}/pdf`).buffer(true).parse(binaire);
    expect(textePdf(sans.body as Buffer)).not.toContain('Acompte de 50 %');
    await remettreParDefaut();
  });
});

describe('notifications', () => {
  it('un type désactivé n’est plus envoyé, les autres continuent', async () => {
    const livreurId = (await getPool().query(`SELECT id FROM users WHERE email = $1`, [comptes.livreur])).rows[0].id;
    const nb = async () => (await A.livreur.get('/api/notifications')).body.items.filter((n: any) => n.type === 'affectation').length;
    const d1 = await A.prep.post('/api/dossiers').send(bache);
    const d2 = await A.prep.post('/api/dossiers').send(bache);
    const avant = await nb();

    await A.admin.put('/api/parametres').send({ notifications: { affectation: false } }).expect(200);
    await A.admin.post(`/api/dossiers/${d1.body.id}/affecter`).send({ livreur_id: livreurId }).expect(200);
    expect(await nb()).toBe(avant);

    await A.admin.put('/api/parametres').send({ notifications: { affectation: true } }).expect(200);
    await A.admin.post(`/api/dossiers/${d2.body.id}/affecter`).send({ livreur_id: livreurId }).expect(200);
    expect(await nb()).toBe(avant + 1);
  });
});

describe('numérotation', () => {
  it('avance le prochain numéro, jamais en dessous du dernier attribué + 1, et journalise', async () => {
    expect((await A.prep.get('/api/systeme/numerotation')).status).toBe(403);
    const etat = await A.admin.get('/api/systeme/numerotation');
    expect(etat.status).toBe(200);
    expect(etat.body.annee).toBe(ANNEE);
    const cmd = etat.body.series.find((s: any) => s.serie === 'CMD');
    expect(cmd.dernier).toBeGreaterThan(0);
    expect(cmd.prochain).toBe(cmd.dernier + 1);

    const arriere = await A.admin.put('/api/systeme/numerotation').send({ CMD: cmd.dernier });
    expect(arriere.status).toBe(400);
    expect(arriere.body.champs.CMD).toContain(`CMD-${ANNEE}-${String(cmd.dernier).padStart(4, '0')}`);
    expect((await A.admin.put('/api/systeme/numerotation').send({ XYZ: 4 })).status).toBe(400);

    const r = await A.admin.put('/api/systeme/numerotation').send({ CMD: 50, FAC: 120 });
    expect(r.status).toBe(200);
    expect(r.body.series.find((s: any) => s.serie === 'CMD').prochain_numero).toBe(`CMD-${ANNEE}-0050`);
    const d = await A.prep.post('/api/dossiers').send(bache);
    expect(d.body.numero).toBe(`CMD-${ANNEE}-0050`);
    expect((await A.admin.put('/api/systeme/numerotation').send({ CMD: 49 })).status).toBe(400);

    // Un numéro déjà présent en base au-delà du compteur (import) compte comme attribué.
    await getPool().query(`UPDATE dossiers SET numero = $1 WHERE id = $2`, [`CMD-${ANNEE}-0075`, d.body.id]);
    expect((await A.admin.put('/api/systeme/numerotation').send({ CMD: 70 })).body.champs.CMD).toContain('0075');

    const j = await A.admin.get('/api/journal?action=numerotation_modifiee');
    expect(j.body.total).toBe(1);
    expect(j.body.items[0].data.CMD.apres).toBe(`CMD-${ANNEE}-0050`);
    expect(j.body.items[0].data.FAC.apres).toBe(`FAC-${ANNEE}-0120`);
  });
});

describe('export et import de la configuration', () => {
  it('exporte les paramètres et les tarifs, sans secret, pour l’administrateur seulement', async () => {
    expect((await A.prep.get('/api/systeme/configuration')).status).toBe(403);
    const r = await A.admin.get('/api/systeme/configuration');
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toContain('attachment');
    expect(r.body.format).toBe('evocom-print-configuration');
    expect(Object.keys(r.body.parametres).sort()).toEqual(Object.keys(PARAMETRES_DEFAUT).sort());
    expect(r.body.apparence).toEqual({ palette_defaut: 'evocom', couleurs_perso: null });
    expect(r.body.tarifs.length).toBe(await compte('tarifs'));
    expect(Object.keys(r.body.tarifs[0]).sort()).toEqual(['actif', 'categorie', 'code', 'description', 'libelle', 'machine', 'ordre', 'prix', 'unite']);
    expect(JSON.stringify(r.body)).not.toMatch(/password|hash|secret|jwt|api_key|cle_api|cle_chiffree|ia_config|openai/i);
  });

  it('refuse un fichier invalide avec des messages précis', async () => {
    const base = (await A.admin.get('/api/systeme/configuration')).body;
    const cas = [
      { ...base, format: 'autre' },
      { ...base, inconnu: 1 },
      { ...base, parametres: { ...base.parametres, securite: { ...base.parametres.securite, mdp_longueur_min: 4 } } },
      { ...base, parametres: { ...base.parametres, ia: { cle: 'x' } } },
      { ...base, tarifs: [{ ...base.tarifs[0], prix: -5 }] },
      { ...base, tarifs: [base.tarifs[0], base.tarifs[0]] },
      { ...base, apparence: { palette_defaut: 'rose', couleurs_perso: null } },
      { ...base, apparence: { palette_defaut: 'perso', couleurs_perso: null } },
      { ...base, apparence: { palette_defaut: 'perso', couleurs_perso: { debut: 'rouge', fin: '#00ff00' } } },
    ];
    const attendus = [
      'format',
      '_',
      'parametres.securite.mdp_longueur_min',
      'parametres',
      'tarifs.0.prix',
      'tarifs.1.code',
      'apparence.palette_defaut',
      'apparence.couleurs_perso',
      'apparence.couleurs_perso.debut',
    ];
    for (const [i, c] of cas.entries()) {
      const r = await A.admin.post('/api/systeme/configuration/apercu').send(c);
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      expect(Object.keys(r.body.champs)).toContain(attendus[i]);
    }
  });

  it('montre les différences sans rien changer, puis applique tout dans une transaction journalisée', async () => {
    const base = (await A.admin.get('/api/systeme/configuration')).body;
    const tarifsAvant = await compte('tarifs');
    const fichier = structuredClone(base);
    fichier.parametres.entreprise.nom = 'Evocom Print Thiès';
    fichier.parametres.documents.devis_validite_jours = 21;
    fichier.tarifs[0].prix = (fichier.tarifs[0].prix ?? 0) + 500;
    fichier.tarifs.push({ machine: 'xerox', categorie: 'option', code: 'pelliculage_test', libelle: 'Pelliculage test', unite: 'feuille', prix: 150, actif: true, ordre: 99, description: null });
    fichier.tarifs.splice(1, 1); // un tarif absent du fichier est conservé
    fichier.apparence = { palette_defaut: 'perso', couleurs_perso: { debut: '#0A5C36', fin: '#1fa463' } };

    const apercu = await A.admin.post('/api/systeme/configuration/apercu').send(fichier);
    expect(apercu.status).toBe(200);
    expect(apercu.body.parametres).toEqual(
      expect.arrayContaining([
        { section: 'entreprise', champ: 'nom', avant: 'Evocom Print', apres: 'Evocom Print Thiès' },
        { section: 'documents', champ: 'devis_validite_jours', avant: 15, apres: 21 },
        { section: 'apparence', champ: 'palette_defaut', avant: 'evocom', apres: 'perso' },
      ]),
    );
    expect(apercu.body.tarifs.ajoutes.map((t: any) => t.code)).toEqual(['pelliculage_test']);
    expect(apercu.body.tarifs.modifies).toHaveLength(1);
    expect(apercu.body.tarifs.modifies[0].champs.prix.apres).toBe(fichier.tarifs[0].prix);
    expect(apercu.body.tarifs.absents_conserves).toHaveLength(1);
    expect(apercu.body.nb_changements).toBe(6);
    expect((await A.admin.get('/api/parametres')).body.entreprise.nom).toBe('Evocom Print');
    expect(await compte('tarifs')).toBe(tarifsAvant);
    expect((await A.prep.post('/api/systeme/configuration/importer').send(fichier)).status).toBe(403);

    const r = await A.admin.post('/api/systeme/configuration/importer').send(fichier);
    expect(r.status).toBe(200);
    expect((await A.admin.get('/api/parametres')).body.entreprise.nom).toBe('Evocom Print Thiès');
    expect((await A.prep.get('/api/parametres/regles')).body.documents.devis_validite_jours).toBe(21);
    expect((await A.livreur.get('/api/apparence')).body).toEqual({ palette_defaut: 'perso', couleurs_perso: { debut: '#0a5c36', fin: '#1fa463' } });
    expect(await compte('tarifs')).toBe(tarifsAvant + 1);
    const t0 = await getPool().query(`SELECT prix FROM tarifs WHERE machine = $1 AND code = $2`, [fichier.tarifs[0].machine, fichier.tarifs[0].code]);
    expect(t0.rows[0].prix).toBe(fichier.tarifs[0].prix);
    const j = await A.admin.get('/api/journal?action=configuration_importee');
    expect(j.body.total).toBe(1);
    expect(j.body.items[0].data.tarifs.ajoutes).toEqual(['xerox/pelliculage_test']);

    expect((await A.admin.post('/api/systeme/configuration/importer').send(fichier)).body.nb_changements).toBe(0);
    expect((await A.admin.post('/api/systeme/configuration/importer').send(base)).status).toBe(200);
    expect((await A.livreur.get('/api/apparence')).body.palette_defaut).toBe('evocom');
    await getPool().query(`DELETE FROM tarifs WHERE code = 'pelliculage_test'`);
    await remettreParDefaut();
  });
});

describe('réinitialisation de la plateforme', () => {
  const corps = { mot_de_passe: PASSWORD, phrase: 'REINITIALISER EVOCOM' };
  const ACTIONS = ['reinitialisation_refusee', 'reinitialisation_echouee', 'plateforme_reinitialisee'];
  let dossierId: number;
  let cheminFichier: string;

  beforeAll(async () => {
    const d = await A.prep.post('/api/dossiers').send({ ...bache, client_nom: 'Client à effacer' });
    dossierId = d.body.id;
    const up = await envoyerFichier(A.prep, dossierId, 'affiche.pdf', Buffer.from('%PDF-1.4\n%reinitialisation\n'));
    expect(up.status).toBe(204);
    cheminFichier = (await getPool().query(`SELECT chemin FROM fichiers WHERE id = $1`, [up.fichierId])).rows[0].chemin;
    expect(fs.existsSync(path.join(STOCKAGE, cheminFichier))).toBe(true);
    await A.admin.post(`/api/dossiers/${dossierId}/paiements`).send({ montant: 5000, mode: 'especes' }).expect(201);
    await A.prep.post(`/api/dossiers/${dossierId}/facture`).expect(201);
    const pool = getPool();
    await pool.query(`INSERT INTO ia_usage (type, statut, duree_ms, extrait) VALUES ('suggestion', 'ok', 120, 'Bâche pour Client à effacer')`);
    await pool.query(`INSERT INTO preferences_utilisateur (user_id, theme) SELECT id, 'dark' FROM users WHERE email = $1 ON CONFLICT (user_id) DO UPDATE SET theme = 'dark'`, [comptes.prep]);
    await pool.query(`UPDATE ia_config SET modele = 'modele-conserve' WHERE id = 1`);
    await pool.query(
      `INSERT INTO parametres (cle, valeur) VALUES ('apparence', $1) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`,
      [JSON.stringify({ palette_defaut: 'sobre', couleurs_perso: null })],
    );
  });

  it('est refusée tant que ALLOW_SYSTEM_RESET n’est pas activée, et réservée à l’administrateur', async () => {
    const etat = await A.admin.get('/api/systeme/reinitialisation');
    expect(etat.status).toBe(200);
    expect(etat.body).toMatchObject({ autorisee: false, phrase_attendue: 'REINITIALISER EVOCOM', variable: 'ALLOW_SYSTEM_RESET' });
    expect(etat.body.ce_qui_est_efface.map((x: any) => x.table)).toEqual(
      expect.arrayContaining(['dossiers', 'fichiers', 'paiements', 'devis', 'factures', 'notifications', 'dossier_events', 'clients', 'compteurs', 'ia_usage']),
    );
    expect(etat.body.ce_qui_est_conserve.map((x: any) => x.table)).toEqual(
      expect.arrayContaining(['users', 'preferences_utilisateur', 'tarifs', 'parametres', 'ia_config', 'journal']),
    );
    const r = await A.admin.post('/api/systeme/reinitialiser').send(corps);
    expect(r.status).toBe(403);
    expect(r.body.error).toContain('ALLOW_SYSTEM_RESET=true');

    process.env.ALLOW_SYSTEM_RESET = 'true';
    expect((await A.prep.get('/api/systeme/reinitialisation')).status).toBe(403);
    expect((await A.prep.post('/api/systeme/reinitialiser').send({ ...corps, mot_de_passe: PASSWORD })).status).toBe(403);
    expect((await A.livreur.post('/api/systeme/reinitialiser').send(corps)).status).toBe(403);
    expect(await compte('dossiers')).toBeGreaterThan(0);
  });

  it('exige le mot de passe et la phrase exacte, puis limite à 3 tentatives par heure', async () => {
    process.env.ALLOW_SYSTEM_RESET = 'true';
    expect((await A.admin.get('/api/systeme/reinitialisation')).body).toMatchObject({ autorisee: true, tentatives_restantes: 3 });
    const mdp = await A.admin.post('/api/systeme/reinitialiser').send({ ...corps, mot_de_passe: 'faux' });
    expect(mdp.status).toBe(400);
    expect(mdp.body.champs.mot_de_passe).toBeTruthy();
    const phrase = await A.admin.post('/api/systeme/reinitialiser').send({ ...corps, phrase: 'reinitialiser evocom' });
    expect(phrase.status).toBe(400);
    expect(phrase.body.champs.phrase).toContain('REINITIALISER EVOCOM');
    expect((await A.admin.post('/api/systeme/reinitialiser').send({})).status).toBe(400);
    const limite = await A.admin.post('/api/systeme/reinitialiser').send(corps);
    expect(limite.status).toBe(429);
    expect(await compte('dossiers')).toBeGreaterThan(0);
    expect(JSON.stringify((await A.admin.get('/api/journal?action=reinitialisation_refusee')).body)).not.toContain('faux');
    // Une heure passe.
    await getPool().query(`UPDATE journal SET created_at = created_at - interval '2 hours' WHERE action = ANY($1)`, [ACTIONS]);
  });

  it("n'efface rien si la sauvegarde échoue", async () => {
    process.env.ALLOW_SYSTEM_RESET = 'true';
    const url = process.env.DATABASE_URL!;
    process.env.DATABASE_URL = url.replace(/\/[^/?]+(\?|$)/, '/base_inexistante_evocom$1');
    try {
      const r = await A.admin.post('/api/systeme/reinitialiser').send(corps);
      expect(r.status).toBe(500);
      expect(r.body.code).toBe('sauvegarde_echouee');
      expect(r.body.error).toContain("rien n'a été effacé");
    } finally {
      process.env.DATABASE_URL = url;
    }
    expect(await compte('dossiers')).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(STOCKAGE, cheminFichier))).toBe(true);
    expect(fs.readdirSync(path.join(STOCKAGE, 'sauvegardes')).filter((f) => f.endsWith('.partiel'))).toEqual([]);
    await getPool().query(`UPDATE journal SET created_at = created_at - interval '2 hours' WHERE action = ANY($1)`, [ACTIONS]);
  });

  it('sauvegarde, efface les données métier, conserve comptes, tarifs, paramètres et journal, déplace les fichiers', async () => {
    process.env.ALLOW_SYSTEM_RESET = 'true';
    await A.admin.put('/api/parametres').send({ entreprise: { nom: 'Evocom Conservé' } }).expect(200);
    const avant = { users: await compte('users'), tarifs: await compte('tarifs'), journal: await compte('journal'), fichiers: await compte('fichiers') };
    expect(avant.fichiers).toBeGreaterThan(0);
    expect(await compte('paiements')).toBeGreaterThan(0);
    expect(await compte('factures')).toBeGreaterThan(0);
    expect(await compte('notifications')).toBeGreaterThan(0);

    const r = await A.admin.post('/api/systeme/reinitialiser').send({ ...corps, phrase: ' REINITIALISER EVOCOM ' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.efface.dossiers).toBeGreaterThan(0);
    expect(r.body.fichiers.deplaces).toBe(avant.fichiers - r.body.fichiers.absents);
    expect(r.body.sessions_fermees).toBe(avant.users - 1);

    for (const t of ['dossiers', 'fichiers', 'paiements', 'devis', 'factures', 'notifications', 'dossier_events', 'clients', 'compteurs', 'ia_usage']) {
      expect(await compte(t), t).toBe(0);
    }
    expect(await compte('preferences_utilisateur')).toBeGreaterThan(0);
    expect((await getPool().query(`SELECT modele FROM ia_config WHERE id = 1`)).rows[0].modele).toBe('modele-conserve');
    expect((await A.admin.get('/api/apparence')).body.palette_defaut).toBe('sobre');
    expect(await compte('users')).toBe(avant.users);
    expect(await compte('tarifs')).toBe(avant.tarifs);
    expect(await compte('journal')).toBeGreaterThan(avant.journal);
    expect((await A.admin.get('/api/parametres')).body.entreprise.nom).toBe('Evocom Conservé');
    const j = await A.admin.get('/api/journal?action=plateforme_reinitialisee');
    expect(j.body.total).toBe(1);

    // Sauvegarde complète, compressée et non vide.
    const sauvegarde = path.join(STOCKAGE, r.body.sauvegarde.fichier);
    expect(r.body.sauvegarde.fichier).toMatch(/^sauvegardes\/avant-reinitialisation-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql\.gz$/);
    expect(fs.statSync(sauvegarde).size).toBeGreaterThan(1000);
    const sql = zlib.gunzipSync(fs.readFileSync(sauvegarde)).toString();
    expect(sql).toContain('PostgreSQL database dump');
    expect(sql).toContain('Client à effacer');
    expect(sql).not.toContain('evocom_dev@');

    // Fichiers déplacés, jamais supprimés.
    expect(fs.existsSync(path.join(STOCKAGE, cheminFichier))).toBe(false);
    const deplace = path.join(STOCKAGE, r.body.fichiers.dossier, cheminFichier);
    expect(fs.readFileSync(deplace, 'utf8')).toContain('%reinitialisation');

    // Les autres sessions sont fermées, celle de l'administrateur reste ouverte ; la numérotation repart de 1.
    expect((await A.prep.get('/api/auth/me')).status).toBe(401);
    expect((await A.admin.get('/api/auth/me')).status).toBe(200);
    const prep = await agent(comptes.prep);
    const d = await prep.post('/api/dossiers').send(bache);
    expect(d.body.numero).toBe(`CMD-${ANNEE}-0001`);
    A.prep = prep;
  });

  it('compte la réussite parmi les tentatives de l’heure', async () => {
    process.env.ALLOW_SYSTEM_RESET = 'true';
    expect((await A.admin.get('/api/systeme/reinitialisation')).body.tentatives_restantes).toBe(2);
  });
});
