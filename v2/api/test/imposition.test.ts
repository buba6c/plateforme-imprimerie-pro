// Imposition : analyse d'un PDF, plans (poses, coupe & empile, livret, fonds perdus) et génération.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { PDFDocument, rgb } from 'pdf-lib';
import { getPool } from '../src/db/pool';
import { calculerPlan, paramsParDefaut, type ParamsImposition } from '../src/modules/imposition/plan';
import { detecterFormat, formatProche } from '../src/modules/imposition/formats';
import { cadreSource, calculerAdaptation } from '../src/modules/imposition/ajuster';
import { paramsSchema } from '../src/modules/imposition/routes';
import type { SourcePlan } from '../src/modules/imposition/plan';
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

  it('livret de 13 pages (impair) : blanches placées selon le choix, ordre de lecture rendu', () => {
    const livret = { ...base, operation: 'livret' as const, feuille: 'a4' as const, fini: { largeur: 148, hauteur: 210 }, fonds_perdus_mm: 0, mode: 'sequence' as const };
    const n = (o: (number | null)[] | undefined) => (o ?? []).map((x) => (x === null ? 'B' : x));
    // Avant la 4e de couverture : la pagination gauche/droite des pages 2 à 12 est gardée.
    const a = calculerPlan({ ...livret, blanches: 'avant_derniere' }, 13);
    expect(a.pages_blanches).toBe(3);
    expect(n(a.ordre)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'B', 'B', 'B', 13]);
    expect(a.avertissements[0]).toMatch(/impair.*3 pages blanches ajoutées avant la 4e de couverture/);
    expect(n(calculerPlan({ ...livret, blanches: 'fin' }, 13).ordre).slice(-4)).toEqual([13, 'B', 'B', 'B']);
    expect(n(calculerPlan({ ...livret, blanches: 'apres_couverture' }, 13).ordre).slice(0, 5)).toEqual([1, 'B', 'B', 'B', 2]);
    expect(n(calculerPlan({ ...livret, blanches: 'reparties' }, 13).ordre)).toEqual([1, 'B', 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'B', 'B', 13]);
    // Placées à la main : après la page 1 et après la page 7 ; la troisième complète avant la 4e de couverture.
    const m = calculerPlan({ ...livret, blanches: 'positions', blanches_apres: [1, 7] }, 13);
    expect(n(m.ordre)).toEqual([1, 'B', 2, 3, 4, 5, 6, 7, 'B', 8, 9, 10, 11, 12, 'B', 13]);
    expect(m.pages_blanches).toBe(3);
    // L'ordre de lecture correspond aux faces : feuille 1 recto = dernière | première.
    expect(m.feuilles[0]!.recto.poses.map((q) => q.page)).toEqual([13, 1]);
  });

  it('livret : chasse vers le pli pour les feuilles intérieures, côté du pli marqué', () => {
    const plan = calculerPlan({ ...base, operation: 'livret', feuille: 'sra3', fini: { largeur: 148, hauteur: 210 }, fonds_perdus_mm: 3, mode: 'sequence', chasse_mm: 1 }, 16);
    const ext = plan.feuilles[0]!.recto.poses;
    const int = plan.feuilles[3]!.recto.poses;
    expect(ext.map((q) => q.pli)).toEqual(['droite', 'gauche']);
    expect(ext[0]!.decalage_x).toBe(0);
    // Feuille intérieure : page de gauche poussée à droite (vers le pli), page de droite à gauche.
    expect(int[0]!.x - ext[0]!.x).toBeCloseTo(1, 5);
    expect(int[1]!.x - ext[1]!.x).toBeCloseTo(-1, 5);
  });

  it('mise au format : même taille, fonds perdus non déclarés, pivot, proportions proches, bandes blanches', () => {
    const fini = { largeur: 85, hauteur: 55 };
    expect(calculerAdaptation({ largeur: 85.5, hauteur: 54.8 }, fini)).toMatchObject({ mode: 'centrer', identique: true, pivote: false });
    expect(calculerAdaptation({ largeur: 91, hauteur: 61 }, fini)).toMatchObject({ mode: 'centrer', identique: true, rognage: { x: 3, y: 3 } });
    expect(calculerAdaptation({ largeur: 88, hauteur: 58 }, fini, 'auto').identique).toBe(false);
    expect(calculerAdaptation({ largeur: 55, hauteur: 85 }, fini)).toMatchObject({ mode: 'centrer', identique: true, pivote: true });
    // 88 × 58 : proportions à 2 % près → remplir, rognage d'un demi-millimètre en haut et en bas.
    const r = calculerAdaptation({ largeur: 88, hauteur: 58 }, fini);
    expect(r).toMatchObject({ mode: 'remplir', auto: true, identique: false, rognage: { x: 0, y: 0.5 }, marges: { x: 0, y: 0 } });
    expect(r.echelle_x).toBeCloseTo(85 / 88, 3);
    // 90 × 50 : proportions trop différentes → adapter (réduit à 94 %), bandes blanches de 3,9 mm en haut et en bas.
    const a = calculerAdaptation({ largeur: 90, hauteur: 50 }, fini);
    expect(a).toMatchObject({ mode: 'adapter', marges: { x: 0, y: 3.9 }, rognage: { x: 0, y: 0 } });
    expect(a.echelle_x).toBeCloseTo(85 / 90, 3);
    expect(calculerAdaptation({ largeur: 90, hauteur: 50 }, fini, 'remplir')).toMatchObject({ mode: 'remplir', rognage: { x: 7, y: 0 }, echelle_x: 1.1 });
    expect(calculerAdaptation({ largeur: 90, hauteur: 50 }, fini, 'etirer')).toMatchObject({ mode: 'etirer', echelle_y: 1.1, marges: { x: 0, y: 0 }, rognage: { x: 0, y: 0 } });
    expect(calculerAdaptation({ largeur: 90, hauteur: 50 }, fini, 'centrer')).toMatchObject({ mode: 'centrer', rognage: { x: 2.5, y: 0 }, marges: { x: 0, y: 2.5 } });
    // Letter → A4 : avec 12 mm de marge blanche, « remplir » ne rogne que du blanc ; sans marge connue, adapter.
    const a4 = { largeur: 210, hauteur: 297 };
    const letter = { largeur: 215.9, hauteur: 279.4 };
    expect(calculerAdaptation(letter, a4, 'auto', { haut: 12, bas: 12, gauche: 12, droite: 12 }).mode).toBe('remplir');
    expect(calculerAdaptation(letter, a4).mode).toBe('adapter');
    // Cadre à dessiner : 90 × 50 adapté en 85 × 55 → 90 × 58,2 mm centré sur le visuel (4,1 mm de blanc en haut et en bas).
    const c = cadreSource(a, fini);
    expect(c.largeur).toBeCloseTo(90, 1);
    expect(c.hauteur).toBeCloseTo(58.2, 1);
    expect(c.y).toBeCloseTo(-4.1, 1);
    // Format standard le plus proche d'une taille non reconnue.
    expect(formatProche(88, 58)).toMatchObject({ code: 'carte_visite_90x55', paysage: false });
    expect(formatProche(58, 88)).toMatchObject({ code: 'carte_visite_90x55', paysage: true });
    expect(formatProche(300, 100)).toBeNull();
  });

  const sourceMarge = (m: number, extra: Partial<SourcePlan> = {}): SourcePlan => ({ fini: { largeur: 85, hauteur: 55 }, marge_blanche: { haut: m, bas: m, gauche: m, droite: m }, fonds: 'absents', fonds_mm: 0, marge_blanche_min: m, jusqu_au_bord: m < 0.5, bord_clair: false, bords_unis_partout: false, nb_pages_rendues: 2, nb_pages: 2, ...extra });

  it('coupe automatique : fonds perdus si le visuel va au bord, coupe franche si la marge est large, double coupe entre les deux', () => {
    const p = { ...base, coupe: 'auto' as const, methode_fonds_perdus: 'intelligent' as const };
    // Visuel au bord : fonds perdus fabriqués.
    const bord = calculerPlan(p, 2, undefined, sourceMarge(0));
    expect(bord.coupe).toMatchObject({ systeme: 'fonds_perdus', auto: true, fonds_perdus_mm: 3, methode: 'intelligent' });
    expect(bord.coupe.raison).toMatch(/jusqu’au bord/);
    // Marge blanche de 8 mm : coupe franche, poses jointives, fonds perdus 0.
    const franche = calculerPlan(p, 2, undefined, sourceMarge(8));
    expect(franche.coupe).toMatchObject({ systeme: 'franche', auto: true, fonds_perdus_mm: 0, gouttiere_mm: 0, marge_encre_mm: 8 });
    expect(franche.params_effectifs.fonds_perdus_mm).toBe(0);
    expect(franche.fonds_perdus_mm).toBe(0);
    const r = franche.feuilles[0]!.recto.poses;
    const voisines = r.filter((q) => Math.abs(q.y - r[0]!.y) < 0.01).sort((a, b) => a.x - b.x);
    expect(voisines[1]!.x - (voisines[0]!.x + voisines[0]!.largeur)).toBeCloseTo(0, 5);
    expect(franche.poses_par_face).toBeGreaterThan(bord.poses_par_face);
    // Marge de 2 mm : double coupe de 4 mm.
    const double = calculerPlan(p, 2, undefined, sourceMarge(2));
    expect(double.coupe).toMatchObject({ systeme: 'double', gouttiere_mm: 4, fonds_perdus_mm: 0 });
    // Fond clair non blanc : traité comme au bord.
    expect(calculerPlan(p, 2, undefined, sourceMarge(8, { bord_clair: true })).coupe.systeme).toBe('fonds_perdus');
    // Bords non contrôlés (Poppler absent) : fonds perdus par sécurité ; « sans fonds perdus » demandé → double coupe.
    expect(calculerPlan(p, 2, undefined, sourceMarge(0, { marge_blanche: null, marge_blanche_min: null, jusqu_au_bord: null, nb_pages_rendues: 0 })).coupe.systeme).toBe('fonds_perdus');
    const sans = calculerPlan({ ...p, coupe: 'sans_auto' }, 2, undefined, sourceMarge(0, { marge_blanche: null, marge_blanche_min: null, jusqu_au_bord: null, nb_pages_rendues: 0 }));
    expect(sans.coupe).toMatchObject({ systeme: 'double', gouttiere_mm: 6 });
    // Répétition avec bords unis : le voisin sert de fond perdu.
    expect(calculerPlan({ ...p, coupe: 'sans_auto' }, 2, undefined, sourceMarge(0, { bords_unis_partout: true })).coupe.systeme).toBe('franche');
    // Zéro millimètre demandé = sans fonds perdus.
    expect(calculerPlan({ ...p, fonds_perdus_mm: 0 }, 2, undefined, sourceMarge(0)).coupe.fonds_perdus_mm).toBe(0);
    // Cadre blanc de 3 mm : visuel réduit à 89 %, marges du cadre comprises.
    const cadre = calculerPlan({ ...p, coupe: 'cadre' }, 2, undefined, sourceMarge(0));
    expect(cadre.coupe).toMatchObject({ systeme: 'cadre', cadre_mm: 3, fonds_perdus_mm: 0 });
    expect(cadre.adaptation).toMatchObject({ mode: 'adapter', cadre_mm: 3, marges: { y: 3 } });
    expect(cadre.adaptation!.echelle_x).toBeCloseTo(49 / 55, 3);
    // Sans coupe : la feuille est exactement le format fini, aucun trait.
    const aucune = calculerPlan({ ...p, coupe: 'aucune' }, 2, undefined, sourceMarge(8));
    expect(aucune.feuille).toEqual({ largeur: 85, hauteur: 55 });
    expect(aucune.feuilles[0]!.recto.traits).toEqual([]);
    // Ancien réglage « blanc » avec 3 mm : espace devenu gouttière de 6 mm, grille inchangée.
    const ancien = calculerPlan({ ...base, methode_fonds_perdus: 'blanc', fonds_perdus_mm: 3 }, 2, undefined, sourceMarge(8));
    expect(ancien.coupe).toMatchObject({ systeme: 'double', gouttiere_mm: 6, fonds_perdus_mm: 0 });
  });

  it('calepinage automatique : A5 sur SRA3 loge 4 poses, les fonds perdus s’ajustent pour garder les repères', () => {
    const p = { ...base, fini: { largeur: 148, hauteur: 210 }, methode_fonds_perdus: 'intelligent' as const, marge_mm: 5 };
    const src: SourcePlan = { ...sourceMarge(0), fini: { largeur: 148, hauteur: 210 } };
    const plan = calculerPlan(p, 2, undefined, src);
    expect(plan.poses_par_face).toBe(4);
    expect(plan.calepinage).toMatchObject({ auto: true, poses: 4, fonds_perdus_mm: 2, reperes_ok: true });
    expect(plan.calepinage!.raison).toMatch(/réduits à 2 mm/);
    expect(plan.calepinage!.alternatives.some((a) => a.fonds_perdus_mm === 3 && a.poses === 4)).toBe(true);
    // Avec la marge de 10 mm d'autrefois, 4 poses exigeraient moins de 1 mm de fonds perdus : l'optimiseur
    // garde 3 mm (2 poses) plutôt que de descendre sous le plancher de l'atelier (1,5 mm).
    const etroit = calculerPlan({ ...p, marge_mm: 10 }, 2, undefined, src);
    expect(etroit.poses_par_face).toBe(2);
    expect(etroit.calepinage!.fonds_perdus_mm).toBe(3);
    // Réglage manuel : rien n'est touché.
    const manuel = calculerPlan({ ...p, marge_mm: 10, calepinage: 'manuel' }, 2, undefined, src);
    expect(manuel.calepinage).toMatchObject({ auto: false, fonds_perdus_mm: 3 });
    expect(manuel.poses_par_face).toBe(2);
    // Fonds perdus partagés quand les bords sont unis en répétition : 4 poses jointives avec 3 mm sur le pourtour.
    const partage = calculerPlan(p, 2, undefined, { ...src, bords_unis_partout: true });
    expect(partage.calepinage).toMatchObject({ partages: true, fonds_perdus_mm: 3, poses: 4 });
    const poses = partage.feuilles[0]!.recto.poses;
    expect(poses.every((q) => (q.joints?.length ?? 0) >= 2)).toBe(true);
  });

  it('rotation automatique des poses : tickets 70 × 150 → 9 poses dont une bande tournée ; tête-bêche', () => {
    const p = { ...base, fini: { largeur: 70, hauteur: 150 }, fonds_perdus_mm: 3, methode_fonds_perdus: 'intelligent' as const, marge_mm: 5, rotation_poses: 'auto' as const, recto_verso: false, calepinage: 'manuel' as const };
    const plan = calculerPlan(p, 1, undefined, sourceMarge(0));
    expect(plan.poses_par_face).toBe(9);
    const poses = plan.feuilles[0]!.recto.poses;
    // Portrait (8 droites + 1 tournée) ou paysage (5 + 4) : les deux logent 9 ; le plan garde celle dont les repères restent lisibles.
    expect(poses.filter((q) => q.rotation === 90).length).toBeGreaterThanOrEqual(1);
    expect(poses.filter((q) => q.rotation === 90).length + poses.filter((q) => !q.rotation).length).toBe(9);
    expect(plan.calepinage!.rotation).toBe('mixte');
    // Aucune pose ne chevauche une autre (emprises).
    const boites = poses.map((q) => ({ x: q.x, y: q.y, w: q.rotation === 90 ? q.hauteur : q.largeur, h: q.rotation === 90 ? q.largeur : q.hauteur }));
    for (const a of boites) for (const b of boites) if (a !== b) expect(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 || a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01).toBe(true);
    expect(calculerPlan({ ...p, rotation_poses: 'aucune' }, 1, undefined, sourceMarge(0)).poses_par_face).toBe(8);
    // En automatique, descendre les fonds perdus à 1,5 mm loge 12 tickets droits : l'optimiseur le dit.
    const opt = calculerPlan({ ...p, calepinage: 'auto' }, 1, undefined, sourceMarge(0));
    expect(opt.poses_par_face).toBe(12);
    expect(opt.calepinage).toMatchObject({ fonds_perdus_mm: 1.5, poses: 12 });
    expect(opt.calepinage!.raison).toMatch(/12 poses au lieu de 8/);
    // Tête-bêche par colonne : une colonne sur deux tournée de 180°.
    const tb = calculerPlan({ ...base, tete_beche: 'colonnes', rotation_poses: 'aucune', recto_verso: false }, 1, undefined, sourceMarge(0));
    const r0 = tb.feuilles[0]!.recto.poses;
    expect(r0.filter((q) => q.colonne % 2 === 1).every((q) => q.rotation === 180)).toBe(true);
    expect(r0.filter((q) => q.colonne % 2 === 0).every((q) => !q.rotation)).toBe(true);
  });

  it('verso : retournement automatique sans rotation, bord forcé sur l’autre axe → verso tourné d’un demi-tour', () => {
    const p = { ...base, orientation: 'paysage' as const, rotation_poses: 'aucune' as const, methode_fonds_perdus: 'intelligent' as const };
    const auto = calculerPlan({ ...p, retournement: 'auto' }, 2, undefined, sourceMarge(0));
    expect(auto.retournement_effectif).toBe('bord_court');
    expect(auto.axe_verso).toBe('vertical');
    const r = auto.feuilles[0]!.recto.poses[0]!;
    const v = auto.feuilles[0]!.verso!.poses[0]!;
    expect(v.x + v.largeur + r.x).toBeCloseTo(auto.feuille.largeur, 2);
    expect(v.rotation).toBeUndefined();
    expect(auto.consignes.some((c) => /bord court/.test(c))).toBe(true);
    // Bord long sur une feuille paysage : axe horizontal, verso tourné de 180°.
    const force = calculerPlan({ ...p, retournement: 'bord_long' }, 2, undefined, sourceMarge(0));
    expect(force.axe_verso).toBe('horizontal');
    const v2 = force.feuilles[0]!.verso!.poses[0]!;
    expect(v2.y + v2.hauteur + force.feuilles[0]!.recto.poses[0]!.y).toBeCloseTo(force.feuille.hauteur, 2);
    expect(v2.rotation).toBe(180);
    // Calendrier : contenu gardé droit.
    expect(calculerPlan({ ...p, retournement: 'bord_long', rotation_verso: 'aucune' }, 2, undefined, sourceMarge(0)).feuilles[0]!.verso!.poses[0]!.rotation).toBeUndefined();
  });

  it('repères : le plan porte les traits, jamais sur une pose ; styles forcés ; cotes de coupe', () => {
    const plan = calculerPlan({ ...base, methode_fonds_perdus: 'intelligent', rotation_poses: 'aucune' }, 2, undefined, sourceMarge(0));
    const face = plan.feuilles[0]!.recto;
    expect(face.traits!.length).toBeGreaterThan(8);
    const fp = plan.fonds_perdus_mm;
    for (const t of face.traits!) {
      for (const q of face.poses) {
        const dedans = (x: number, y: number) => x > q.x - fp + 0.01 && x < q.x + q.largeur + fp - 0.01 && y > q.y - fp + 0.01 && y < q.y + q.hauteur + fp - 0.01;
        expect(dedans(t.x1, t.y1) || dedans(t.x2, t.y2)).toBe(false);
      }
      // Dans la zone imprimable (marge technique 5 mm).
      for (const [x, y] of [[t.x1, t.y1], [t.x2, t.y2]] as const) {
        expect(x).toBeGreaterThanOrEqual(5 - 0.01);
        expect(x).toBeLessThanOrEqual(plan.feuille.largeur - 5 + 0.01);
        expect(y).toBeGreaterThanOrEqual(5 - 0.01);
        expect(y).toBeLessThanOrEqual(plan.feuille.hauteur - 5 + 0.01);
      }
    }
    expect(plan.cotes!.x.length).toBeGreaterThanOrEqual(2);
    expect(calculerPlan({ ...base, traits_style: 'aucun' }, 2, undefined, sourceMarge(0)).feuilles[0]!.recto.traits).toEqual([]);
    const trav = calculerPlan({ ...base, traits_style: 'traversants', rotation_poses: 'aucune' }, 2, undefined, sourceMarge(0)).feuilles[0]!.recto;
    // Lignes traversantes : du bord imprimable jusqu'au bloc (jamais sur une pose) ; avec une gouttière nulle il ne reste que les marges.
    expect(trav.traits!.some((t) => Math.abs(t.x1 - t.x2) < 0.01 && Math.min(t.y1, t.y2) <= 5.01 && Math.abs(t.y2 - t.y1) >= 5)).toBe(true);
    expect(calculerPlan({ ...base, traits_style: 'bord_feuille', rotation_poses: 'aucune' }, 2, undefined, sourceMarge(0)).feuilles[0]!.recto.traits!.every((t) => t.x1 <= 10.01 || t.x1 >= plan.feuille.largeur - 10.01 || t.y1 <= 10.01 || t.y1 >= plan.feuille.hauteur - 10.01)).toBe(true);
    // Calage sur le coin de pince : première pose à marge + fonds perdus du coin bas-gauche.
    const coin = calculerPlan({ ...base, calage: 'coin', marge_pince_mm: 12, rotation_poses: 'aucune', calepinage: 'manuel' }, 2, undefined, sourceMarge(0));
    const basGauche = [...coin.feuilles[0]!.recto.poses].sort((a, b) => a.x - b.x || a.y - b.y)[0]!;
    expect(basGauche.x).toBeCloseTo(12 + coin.fonds_perdus_mm, 2);
    expect(basGauche.y).toBeCloseTo(12 + coin.fonds_perdus_mm, 2);
  });

  it('le schéma zod garde tous les réglages (aucune perte silencieuse)', () => {
    const complet = { ...base, coupe: 'sans_auto', cadre_blanc_mm: 2, cadre_methode: 'rogner', traits_style: 'bloc', calepinage: 'manuel', rotation_poses: 'auto', tete_beche: 'damier', calage: 'coin', marge_pince_mm: 8, gouttiere_y_mm: 6, fonds_partages: true, rotation_verso: '180', retournement: 'bord_court', ajustement: 'remplir', fini_impose: true, blanches: 'reparties', planches: 'simple', reliure: 'dos_carre', cahier_feuilles: 3, couverture_separee: true, lecture: 'droite_gauche', chasse_mm: 1 };
    const r = paramsSchema.safeParse(complet);
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true);
    if (r.success) for (const [k, v] of Object.entries(complet)) expect((r.data as Record<string, unknown>)[k], k).toEqual(v);
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

  it('planches : repérées, puis séparées en pages (couverture seule, ou couverture à plat)', async () => {
    // Export « planches » : couverture A5 seule, deux planches de deux A5, 4e de couverture seule.
    const doc = await PDFDocument.create();
    const couleurs = [rgb(0.9, 0.2, 0.2), rgb(0.2, 0.7, 0.3), rgb(0.2, 0.3, 0.9), rgb(0.9, 0.8, 0.1)];
    [148, 296, 296, 148].forEach((l, i) => doc.addPage([l * PT, 210 * PT]).drawRectangle({ x: 0, y: 0, width: l * PT, height: 210 * PT, color: couleurs[i]! }));
    const mixte = (await envoyerFichier(A.prep, dossierId, 'planches.pdf', Buffer.from(await doc.save()))).fichierId!;
    const brut = await A.prep.post('/api/imposition/analyser').send({ fichier_id: mixte });
    expect(brut.status, JSON.stringify(brut.body)).toBe(200);
    expect(brut.body.planches).toMatchObject({ separees: 0, detection: { confiance: 'forte', pages_doubles: 2, couverture_seule: true } });
    const sep = await A.prep.post('/api/imposition/analyser').send({ fichier_id: mixte, planches: 'simple' });
    expect(sep.body.analyse.nb_pages).toBe(6);
    expect(sep.body.analyse).toMatchObject({ uniforme: true, format: { code: 'a5' } });
    expect(sep.body.planches).toEqual({ separees: 2, detection: null });
    expect(sep.body.pages.map((p: { page_source: number; demi?: string }) => `${p.page_source}${p.demi?.[0] ?? ''}`)).toEqual(['1', '2g', '2d', '3g', '3d', '4']);
    const params = { ...sep.body.params_defaut, operation: 'livret', feuille: 'a4', fonds_perdus_mm: 0, planches: 'simple' };
    const g = await A.prep.post('/api/imposition/generer').send({ fichier_id: mixte, params });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    expect(g.body.plan).toMatchObject({ nb_feuilles: 2, pages_blanches: 2 });

    // Couverture à plat : 4e | 1re, puis 2-3, 4-5 ; la 4e de couverture passe à la fin.
    const plat = await PDFDocument.create();
    for (let i = 0; i < 3; i++) plat.addPage([296 * PT, 210 * PT]).drawRectangle({ x: 0, y: 0, width: 148 * PT, height: 210 * PT, color: couleurs[i]! });
    const couv = (await envoyerFichier(A.prep, dossierId, 'couverture-a-plat.pdf', Buffer.from(await plat.save()))).fichierId!;
    const c = await A.prep.post('/api/imposition/analyser').send({ fichier_id: couv, planches: 'couverture' });
    expect(c.body.pages.map((p: { page_source: number; demi?: string }) => `${p.page_source}${p.demi?.[0] ?? ''}`)).toEqual(['1d', '2g', '2d', '3g', '3d', '1g']);
    // Arabe (droite à gauche) : la moitié droite se lit d'abord.
    const ar = await A.prep.post('/api/imposition/analyser').send({ fichier_id: couv, planches: 'simple', lecture: 'droite_gauche' });
    expect(ar.body.pages.slice(0, 2).map((p: { demi?: string }) => p.demi)).toEqual(['droite', 'gauche']);
  });

  it('fichier à la mauvaise taille : format proche proposé, mise au format dans le plan, génération', async () => {
    const f = (await envoyerFichier(A.prep, dossierId, 'carte-80x54.pdf', await pdfTest(80, 54, 2))).fichierId!;
    const a = await A.prep.post('/api/imposition/analyser').send({ fichier_id: f });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.analyse.format).toBeNull();
    expect(a.body.format_proche).toMatchObject({ code: 'carte_visite_85x55', largeur: 85, hauteur: 55 });
    expect(a.body.params_defaut.ajustement).toBe('auto');
    // Format fini mis à 85 × 55 : le plan explique la mise au format.
    const params = { ...a.body.params_defaut, fini: { largeur: 85, hauteur: 55 } };
    const plan = await A.prep.post('/api/imposition/plan').send({ fichier_id: f, params });
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    // Proportions différentes et visuel jusqu'au bord : adapté (agrandi à 102 %), bandes blanches de 1,8 mm à gauche et à droite.
    expect(plan.body.plan.adaptation).toMatchObject({ mode: 'adapter', auto: true, source: { largeur: 80, hauteur: 54 }, marges: { x: 1.8, y: 0 }, rognage: { x: 0, y: 0 } });
    // Taille du fichier gardée : rien à adapter.
    const meme = await A.prep.post('/api/imposition/plan').send({ fichier_id: f, params: a.body.params_defaut });
    expect(meme.body.plan.adaptation).toBeNull();
    const g = await A.prep.post('/api/imposition/generer').send({ fichier_id: f, params: { ...params, ajustement: 'remplir' } });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    expect(g.body.plan.adaptation).toMatchObject({ mode: 'remplir', auto: false, rognage: { x: 0, y: 1.2 } });
    const contenu = await A.prep.get(`/api/fichiers/${g.body.fichier.id}/contenu`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    const doc = await PDFDocument.load(contenu.body as Buffer);
    expect(doc.getPageCount()).toBe(2);
  });

  it('refuse les dossiers Roland (grand format, pas d’imposition)', async () => {
    const roland = await A.prep.post('/api/dossiers').send({ machine: 'roland', client_nom: 'Client Bâche', specs: { lignes: [{ support: 'bache_m2', largeur: 100, hauteur: 100, unite: 'cm', quantite: 1, finitions: [], options: [] }], forfaits: [] } });
    expect(roland.status).toBe(201);
    const f = await envoyerFichier(A.prep, roland.body.id, 'bache.pdf', await pdfTest(100, 100, 1));
    const r = await A.prep.post('/api/imposition/analyser').send({ fichier_id: f.fichierId });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('Xerox');
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
    expect(l.body.items[0].params).toMatchObject({ operation: 'poses', feuille: 'sra3', marge_mm: 5, traits_de_coupe: true, coupe: 'auto', calepinage: 'auto' });
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
