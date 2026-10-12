// Imposition : analyse d'un PDF, plans (poses, coupe & empile, livret, fonds perdus) et génération.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { PDFDocument, rgb } from 'pdf-lib';
import { getPool } from '../src/db/pool';
import { calculerPlan, paramsParDefaut, type ParamsImposition } from '../src/modules/imposition/plan';
import { detecterFormat } from '../src/modules/imposition/formats';
import { agent, app, comptes, envoyerFichier } from './helpers';

const STOCKAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-test-imposition-'));
process.env.STORAGE_DIR = STOCKAGE;

type Agent = supertest.Agent;
const A = {} as Record<'admin' | 'prep' | 'livreur', Agent>;
const PT = 72 / 25.4;

/** PDF de test : `pages` pages de largeur × hauteur mm, fond coloré jusqu'au bord, numéro au centre. */
async function pdfTest(largeur: number, hauteur: number, pages: number, opts: { fondsPerdus?: number; marge?: boolean } = {}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fp = opts.fondsPerdus ?? 0;
  for (let i = 0; i < pages; i++) {
    const w = (largeur + 2 * fp) * PT;
    const h = (hauteur + 2 * fp) * PT;
    const page = doc.addPage([w, h]);
    if (fp > 0) page.setTrimBox(fp * PT, fp * PT, largeur * PT, hauteur * PT);
    const m = opts.marge ? 8 * PT : 0;
    page.drawRectangle({ x: m, y: m, width: w - 2 * m, height: h - 2 * m, color: i % 2 === 0 ? rgb(0.2, 0.5, 0.9) : rgb(0.9, 0.3, 0.2) });
    page.drawRectangle({ x: w / 2 - 10, y: h / 2 - 10, width: 20, height: 20, color: rgb(1, 1, 1) });
  }
  return Buffer.from(await doc.save());
}

async function creerDossier(a: Agent, machine = 'xerox'): Promise<number> {
  const r = await a.post('/api/dossiers').send({
    machine,
    client_nom: 'Client Imposition',
    specs: { lignes: [{ support: 'papier_a4_couleur', pages: 1, recto_verso: false, quantite: 500, finitions: [], options: [] }], forfaits: [] },
  });
  expect(r.status).toBe(201);
  return r.body.id;
}

describe('imposition : formats et plans (sans serveur)', () => {
  it('reconnaît les formats finis avec et sans fonds perdus', () => {
    expect(detecterFormat(85, 55)).toMatchObject({ code: 'carte_visite_85x55', avec_fonds_perdus: false, paysage: false });
    expect(detecterFormat(91, 61)).toMatchObject({ code: 'carte_visite_85x55', avec_fonds_perdus: true, fonds_perdus_mm: 3 });
    expect(detecterFormat(297, 210)).toMatchObject({ code: 'a4', paysage: true });
    expect(detecterFormat(123, 456)).toBeNull();
  });

  const base: ParamsImposition = {
    operation: 'poses', feuille: 'sra3', orientation: 'auto', fini: { largeur: 85, hauteur: 55 }, fonds_perdus_mm: 3, methode_fonds_perdus: 'miroir',
    gouttiere_mm: 0, marge_mm: 10, traits_de_coupe: true, recto_verso: true, retournement: 'bord_long', mode: 'repetition', ajustement: 'centrer', blanches: 'fin',
  };

  it('cartes de visite 85 × 55 sur SRA3 : grille pleine, verso en miroir', () => {
    const plan = calculerPlan(base, 2);
    expect(plan.poses_par_face).toBeGreaterThanOrEqual(16);
    expect(plan.nb_feuilles).toBe(1);
    expect(plan.feuilles[0]!.recto.poses.every((p) => p.page === 1)).toBe(true);
    expect(plan.feuilles[0]!.verso!.poses.every((p) => p.page === 2)).toBe(true);
    // Toutes les poses tiennent dans la feuille, fonds perdus compris.
    for (const q of plan.feuilles[0]!.recto.poses) {
      expect(q.x - 3).toBeGreaterThanOrEqual(0);
      expect(q.x + q.largeur + 3).toBeLessThanOrEqual(plan.feuille.largeur + 0.01);
    }
    // Verso : la pose en haut à gauche du recto se retrouve en haut à droite (miroir gauche-droite en portrait).
    const r0 = plan.feuilles[0]!.recto.poses[0]!;
    const v0 = plan.feuilles[0]!.verso!.poses[0]!;
    expect(Math.abs(r0.x + r0.largeur + v0.x - plan.feuille.largeur) < 0.05 || Math.abs(r0.y + r0.hauteur + v0.y - plan.feuille.hauteur) < 0.05).toBe(true);
  });

  it('coupe & empile : après la coupe, chaque pile est dans l’ordre', () => {
    const plan = calculerPlan({ ...base, mode: 'coupe_empile', recto_verso: false, numerotation: { debut: 1, chiffres: 3, prefixe: 'T', position: 'bas_droite', taille_pt: 12, verso: false }, quantite: 50 }, 1);
    const n = plan.poses_par_face;
    const nbFeuilles = Math.ceil(50 / n);
    expect(plan.nb_feuilles).toBe(nbFeuilles);
    // Pile de la pose 0 : feuilles 1..nbFeuilles → T001, T002, …
    const pile0 = plan.feuilles.map((f) => f.recto.poses[0]!.numero);
    expect(pile0).toEqual(Array.from({ length: nbFeuilles }, (_, i) => `T${String(i + 1).padStart(3, '0')}`));
    // Pile de la pose 1 commence à nbFeuilles + 1
    expect(plan.feuilles[0]!.recto.poses[1]!.numero).toBe(`T${String(nbFeuilles + 1).padStart(3, '0')}`);
  });

  it('livret A5 de 6 pages sur A4 : 8 pages avec 2 blanches, ordre piqûre à cheval', () => {
    const plan = calculerPlan({ ...base, operation: 'livret', feuille: 'a4', fini: { largeur: 148, hauteur: 210 }, fonds_perdus_mm: 0, mode: 'sequence' }, 6);
    expect(plan.pages_blanches).toBe(2);
    expect(plan.nb_feuilles).toBe(2);
    expect(plan.paysage).toBe(true);
    const pages = (f: number, cote: 'recto' | 'verso') => plan.feuilles[f]![cote]!.poses.map((p) => p.page);
    expect(pages(0, 'recto')).toEqual([null, 1]); // page 8 (blanche) | page 1
    expect(pages(0, 'verso')).toEqual([2, null]); // page 2 | page 7 (blanche)
    expect(pages(1, 'recto')).toEqual([6, 3]);
    expect(pages(1, 'verso')).toEqual([4, 5]);
  });

  it('livret : couverture séparée, dos carré en cahiers avec repères, lecture de droite à gauche', () => {
    const livret = { ...base, operation: 'livret' as const, feuille: 'sra3' as const, fini: { largeur: 210, hauteur: 297 }, fonds_perdus_mm: 3, mode: 'sequence' as const };
    // 40 pages, couverture séparée : 36 pages intérieures (9 feuilles) + 1 feuille de couverture.
    const c = calculerPlan({ ...livret, couverture_separee: true }, 40);
    expect(c.feuilles[0]!.libelle).toBe('Couverture');
    expect(c.feuilles[0]!.recto.poses.map((q) => q.page)).toEqual([40, 1]);
    expect(c.feuilles[0]!.verso!.poses.map((q) => q.page)).toEqual([2, 39]);
    expect(c.feuilles[1]!.recto.poses.map((q) => q.page)).toEqual([38, 3]);
    expect(c.nb_feuilles).toBe(10);
    // 48 pages, dos carré par cahiers de 4 feuilles : 3 cahiers de 16 pages, repère sur la 1re feuille de chacun.
    const d = calculerPlan({ ...livret, reliure: 'dos_carre', cahier_feuilles: 4 }, 48);
    expect(d.nb_feuilles).toBe(12);
    expect(d.feuilles[0]!.recto.poses.map((q) => q.page)).toEqual([16, 1]);
    expect(d.feuilles[4]!.recto.poses.map((q) => q.page)).toEqual([32, 17]);
    expect(d.feuilles[4]!.libelle).toBe('Cahier 2 · feuille 1/4');
    const reperes = d.feuilles.filter((f) => f.recto.marques?.length).map((f) => f.recto.marques![0]!.y);
    expect(reperes).toHaveLength(3);
    expect(reperes[0]! > reperes[1]! && reperes[1]! > reperes[2]!).toBe(true);
    // Droite à gauche : chaque face inversée.
    const r = calculerPlan({ ...livret, lecture: 'droite_gauche' }, 8);
    expect(r.feuilles[0]!.recto.poses.map((q) => q.page)).toEqual([1, 8]);
  });

  it('refuse une pose qui ne tient pas sur la feuille', () => {
    expect(() => calculerPlan({ ...base, feuille: 'a4', fini: { largeur: 300, hauteur: 300 } }, 1)).toThrow(/Aucune pose/);
  });
});

describe('imposition : routes', () => {
  let dossierId: number;
  let carteId: number;
  let brochureId: number;

  beforeAll(async () => {
    await app();
    A.admin = await agent(comptes.admin);
    A.prep = await agent(comptes.prep);
    A.livreur = await agent(comptes.livreur);
    dossierId = await creerDossier(A.prep);
    const carte = await envoyerFichier(A.prep, dossierId, 'carte.pdf', await pdfTest(85, 55, 2));
    expect(carte.status).toBe(204);
    carteId = carte.fichierId!;
    const brochure = await envoyerFichier(A.prep, dossierId, 'brochure.pdf', await pdfTest(148, 210, 6, { fondsPerdus: 3 }));
    brochureId = brochure.fichierId!;
  });

  it('analyse : format reconnu, fonds perdus absents / déclarés, réglages par défaut', async () => {
    const r = await A.prep.post('/api/imposition/analyser').send({ fichier_id: carteId });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.analyse).toMatchObject({ nb_pages: 2, uniforme: true, fonds_perdus: 'absents', format: { code: 'carte_visite_85x55' }, fini: { largeur: 85, hauteur: 55 } });
    expect(r.body.params_defaut).toMatchObject({ operation: 'poses', recto_verso: true, methode_fonds_perdus: 'intelligent', fonds_perdus_mm: 3 });
    const b = await A.prep.post('/api/imposition/analyser').send({ fichier_id: brochureId });
    expect(b.body.analyse).toMatchObject({ nb_pages: 6, fonds_perdus: 'declares', fonds_perdus_mm: 3, format: { code: 'a5' } });
    expect(b.body.params_defaut.methode_fonds_perdus).toBe('source');
    // Le livreur n'a pas accès.
    expect((await A.livreur.post('/api/imposition/analyser').send({ fichier_id: carteId })).status).toBe(403);
    expect((await A.prep.get('/api/imposition/catalogue')).body.feuilles.some((f: { code: string }) => f.code === 'sra3')).toBe(true);
  });

  it('génère les cartes de visite imposées (recto-verso, fonds perdus miroir) et les ajoute au dossier', async () => {
    const d = await A.prep.post('/api/imposition/analyser').send({ fichier_id: carteId });
    const params = { ...d.body.params_defaut, feuille: 'sra3', quantite: 500 };
    const plan = await A.prep.post('/api/imposition/plan').send({ fichier_id: carteId, params });
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    expect(plan.body.plan.poses_par_face).toBeGreaterThanOrEqual(16);
    expect(plan.body.plan.feuilles_a_imprimer).toBe(Math.ceil(500 / plan.body.plan.poses_par_face));
    const r = await A.prep.post('/api/imposition/generer').send({ fichier_id: carteId, params });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.fichier.nom).toMatch(/^carte_IMPOSITION-\d+POSES\.pdf$/);
    const fiche = await A.prep.get(`/api/dossiers/${dossierId}`);
    const genere = fiche.body.fichiers.find((f: { id: number }) => f.id === r.body.fichier.id);
    expect(genere).toBeTruthy();
    expect(fiche.body.historique.some((e: { action: string | null }) => e.action === 'imposition')).toBe(true);
    // Le PDF produit : 2 pages (recto, verso) au format de la feuille.
    const contenu = await A.prep.get(`/api/fichiers/${r.body.fichier.id}/contenu`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(contenu.status).toBe(200);
    const doc = await PDFDocument.load(contenu.body as Buffer);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    const dims = [Math.round(width / PT), Math.round(height / PT)].sort((a, b) => a - b);
    expect(dims).toEqual([320, 450]);
    expect(contenu.body.length).toBeLessThan(200_000);
  });

  it('livret : 6 pages A5 → 4 faces A4 paysage avec traits de pli ; fonds perdus seuls : 1 page par page', async () => {
    const d = await A.prep.post('/api/imposition/analyser').send({ fichier_id: brochureId });
    const params = { ...d.body.params_defaut, operation: 'livret', feuille: 'a4', recto_verso: true };
    const r = await A.prep.post('/api/imposition/generer').send({ fichier_id: brochureId, params });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.plan).toMatchObject({ operation: 'livret', nb_feuilles: 2, nb_pages_sortie: 4, pages_blanches: 2 });
    expect(r.body.fichier.nom).toBe('brochure_LIVRET.pdf');
    const analyseCarte = await A.admin.post('/api/imposition/analyser').send({ fichier_id: carteId });
    const fp = await A.admin.post('/api/imposition/generer').send({ fichier_id: carteId, params: { ...analyseCarte.body.params_defaut, operation: 'fonds_perdus' } });
    expect(fp.status, JSON.stringify(fp.body)).toBe(201);
    expect(fp.body.plan).toMatchObject({ operation: 'fonds_perdus', nb_pages_sortie: 2 });
    expect(fp.body.fichier.nom).toBe('carte_FONDS-PERDUS.pdf');
    const j = (await getPool().query(`SELECT count(*)::int AS n FROM journal WHERE action = 'fichier_impose'`)).rows[0];
    expect(j.n).toBeGreaterThanOrEqual(3);
  });

  it('refuse des réglages invalides et un fichier non PDF', async () => {
    const r = await A.prep.post('/api/imposition/plan').send({ fichier_id: carteId, params: { operation: 'poses', feuille: 'zzz', fini: { largeur: 85, hauteur: 55 } } });
    expect(r.status).toBe(400);
    const img = await envoyerFichier(A.prep, dossierId, 'photo.png', Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png');
    expect((await A.prep.post('/api/imposition/analyser').send({ fichier_id: img.fichierId })).status).toBe(400);
  });
});

describe('imposition : modèles', () => {
  it('l’administrateur enregistre un modèle, le préparateur le lit, le livreur non', async () => {
    const admin = await agent(comptes.admin);
    const prep = await agent(comptes.prep);
    const params = { operation: 'poses', feuille: 'sra3', fini: { largeur: 85, hauteur: 55 }, fonds_perdus_mm: 3, methode_fonds_perdus: 'miroir', recto_verso: true, mode: 'repetition' };
    expect((await prep.post('/api/imposition/modeles').send({ nom: 'Cartes SRA3', params })).status).toBe(403);
    const r = await admin.post('/api/imposition/modeles').send({ nom: 'Cartes de visite SRA3', description: '16 poses, fonds perdus miroir', params });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await admin.post('/api/imposition/modeles').send({ nom: 'cartes de visite sra3', params })).status).toBe(409);
    const l = await prep.get('/api/imposition/modeles');
    expect(l.body.items.map((m: { nom: string }) => m.nom)).toContain('Cartes de visite SRA3');
    expect(l.body.items[0].params).toMatchObject({ operation: 'poses', feuille: 'sra3', marge_mm: 10, traits_de_coupe: true });
    const maj = await admin.put(`/api/imposition/modeles/${r.body.id}`).send({ nom: 'Cartes de visite SRA3 (16)', params: { ...params, marge_mm: 8 } });
    expect(maj.status).toBe(200);
    expect(maj.body.items[0]).toMatchObject({ nom: 'Cartes de visite SRA3 (16)', params: { marge_mm: 8 } });
    expect((await admin.delete(`/api/imposition/modeles/${r.body.id}`)).status).toBe(200);
    expect((await (await agent(comptes.livreur)).get('/api/imposition/modeles')).status).toBe(403);
  });
});

describe('imposition : plusieurs pièces (recto et verso séparés, images)', () => {
  it('assemble deux PDF recto/verso et une image, apparie les faces, génère', async () => {
    const prep = await agent(comptes.prep);
    const dossierId = await creerDossier(prep);
    const recto = (await envoyerFichier(prep, dossierId, 'recto.pdf', await pdfTest(85, 55, 1))).fichierId!;
    const verso = (await envoyerFichier(prep, dossierId, 'verso.pdf', await pdfTest(85, 55, 1))).fichierId!;
    // Image PNG 300 dpi de 91 × 61 mm (carte + 3 mm de fonds perdus)
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: Math.round((91 / 25.4) * 300), height: Math.round((61 / 25.4) * 300), channels: 3, background: '#2255aa' } }).png().withMetadata({ density: 300 }).toBuffer();
    const image = (await envoyerFichier(prep, dossierId, 'visuel.png', png, 'image/png')).fichierId!;

    const a = await prep.post('/api/imposition/analyser').send({ pieces: [{ fichier_id: recto, role: 'recto' }, { fichier_id: verso, role: 'verso' }] });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.pages).toHaveLength(2);
    expect(a.body.paires).toEqual([{ recto: 1, verso: 2 }]);
    expect(a.body.pieces.map((p: { genre: string }) => p.genre)).toEqual(['pdf', 'pdf']);
    expect(a.body.params_defaut).toMatchObject({ recto_verso: true, mode: 'repetition' });
    const plan = await prep.post('/api/imposition/plan').send({ pieces: [{ fichier_id: recto, role: 'recto' }, { fichier_id: verso, role: 'verso' }], params: a.body.params_defaut });
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    expect(plan.body.plan.feuilles[0].recto.poses[0].page).toBe(1);
    expect(plan.body.plan.feuilles[0].verso.poses[0].page).toBe(2);
    const g = await prep.post('/api/imposition/generer').send({ pieces: [{ fichier_id: recto, role: 'recto' }, { fichier_id: verso, role: 'verso' }], params: a.body.params_defaut });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    expect(g.body.plan.nb_pages_sortie).toBe(2);

    // Image seule : page de 91 × 61 mm d'après la résolution, format carte + fonds perdus reconnu.
    const ai = await prep.post('/api/imposition/analyser').send({ pieces: [{ fichier_id: image, role: 'pages' }] });
    expect(ai.status, JSON.stringify(ai.body)).toBe(200);
    expect(ai.body.pieces[0]).toMatchObject({ genre: 'image', pages: 1 });
    expect(Math.round(ai.body.analyse.largeur)).toBe(91);
    expect(ai.body.analyse.format).toMatchObject({ code: 'carte_visite_85x55', avec_fonds_perdus: true });
    expect(ai.body.params_defaut.methode_fonds_perdus).toBe('source');
    const gi = await prep.post('/api/imposition/generer').send({ pieces: [{ fichier_id: image, role: 'pages' }], params: { ...ai.body.params_defaut, recto_verso: false } });
    expect(gi.status, JSON.stringify(gi.body)).toBe(201);
    expect(gi.body.fichier.nom).toMatch(/^visuel_IMPOSITION-\d+POSES\.pdf$/);
    // Fichier non imposable
    const txt = (await envoyerFichier(prep, dossierId, 'notes.txt', Buffer.from('bonjour'), 'text/plain')).fichierId!;
    expect((await prep.post('/api/imposition/analyser').send({ pieces: [{ fichier_id: txt, role: 'pages' }] })).status).toBe(400);
  });
});

describe('imposition : sans dossier puis rattachement', () => {
  it('dépose un fichier libre, génère, télécharge, puis rattache le résultat à un dossier', async () => {
    const prep = await agent(comptes.prep);
    const pdf = await pdfTest(85, 55, 2);
    const dep = await prep.post('/api/imposition/libre?nom=carte-libre.pdf').set('Content-Type', 'application/pdf').send(pdf);
    expect(dep.status, JSON.stringify(dep.body)).toBe(201);
    const jeton = dep.body.libre as string;
    const a = await prep.post('/api/imposition/analyser').send({ pieces: [{ libre: jeton, role: 'pages' }] });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.sans_dossier).toBe(true);
    const g = await prep.post('/api/imposition/generer').send({ pieces: [{ libre: jeton, role: 'pages' }], params: a.body.params_defaut });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    expect(g.body.fichier).toBeNull();
    expect(g.body.libre.nom).toMatch(/^carte-libre_IMPOSITION-\d+POSES\.pdf$/);
    const dl = await prep.get(g.body.libre.telechargement);
    expect(dl.status).toBe(200);
    // Un autre préparateur n'y a pas accès.
    expect((await (await agent(comptes.prep2)).get(`/api/imposition/libre/${g.body.libre.jeton}/contenu`)).status).toBe(403);
    const dossierId = await creerDossier(prep);
    const r = await prep.post(`/api/imposition/libre/${g.body.libre.jeton}/rattacher`).send({ dossier_id: dossierId });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const fiche = await prep.get(`/api/dossiers/${dossierId}`);
    expect(fiche.body.fichiers.map((f: { nom_original: string }) => f.nom_original)).toContain(g.body.libre.nom);
    // Fichier non accepté
    expect((await prep.post('/api/imposition/libre?nom=notes.txt').set('Content-Type', 'text/plain').send('x')).status).toBe(400);
  });
});
