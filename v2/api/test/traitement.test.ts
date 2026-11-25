// Traitement des fichiers : réparation et optimisation (exécuté seulement si qpdf / Ghostscript sont là).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { gsPresent, qpdfPresent } from '../src/modules/traitement/outils';
import { lisible, traiterPdf } from '../src/modules/traitement/pdf';
import { nettoyerTemporaires } from '../src/modules/traitement/file';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evocom-test-traitement-'));

async function pdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([240, 156]);
  p.drawRectangle({ x: 0, y: 0, width: 240, height: 156, color: rgb(0.1, 0.3, 0.6) });
  const f = path.join(dir, `carte-${Date.now()}.pdf`);
  fs.writeFileSync(f, await doc.save({ useObjectStreams: false }));
  return f;
}

describe('traitement des PDF', () => {
  it('ignore proprement quand les outils manquent, sinon contrôle et garde un PDF lisible', async () => {
    const src = await pdf();
    const { rapport, chemin } = await traiterPdf(src, path.join(dir, 'sortie.pdf'));
    if (!(await qpdfPresent()) && !(await gsPresent())) {
      expect(rapport.statut).toBe('ignore');
      expect(chemin).toBeNull();
      return;
    }
    expect(['optimise', 'inchange']).toContain(rapport.statut);
    expect(rapport.pages).toBe(1);
    if (chemin) expect((await lisible(chemin)).ok).toBe(true);
    expect((await lisible(src)).ok).toBe(true); // l'original n'est jamais modifié
  });

  it('répare un PDF dont la table des références est cassée', async () => {
    if (!(await qpdfPresent()) && !(await gsPresent())) return;
    const src = await pdf();
    const casse = path.join(dir, 'casse.pdf');
    // Table « xref » et décalages faux : pdf-lib refuse ou lit mal ; qpdf reconstruit.
    const octets = fs.readFileSync(src, 'latin1').replace(/startxref\s+\d+/, 'startxref\n999999');
    fs.writeFileSync(casse, octets, 'latin1');
    const { rapport } = await traiterPdf(casse, path.join(dir, 'repare.pdf'));
    expect(['repare', 'optimise', 'inchange']).toContain(rapport.statut);
  });
});

describe('fichiers de travail abandonnés', () => {
  it('supprime au démarrage les dossiers evocom-traitement-* anciens, garde les récents et les autres', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'essai-nettoyage-'));
    const vieux = path.join(tmp, 'evocom-traitement-123-abcd');
    const recent = path.join(tmp, 'evocom-traitement-456-ef01');
    const autre = path.join(tmp, 'autre-dossier');
    for (const d of [vieux, recent, autre]) {
      fs.mkdirSync(d);
      fs.writeFileSync(path.join(d, 'optimise.pdf'), 'x');
    }
    const ilYaUneHeure = new Date(Date.now() - 3600 * 1000);
    fs.utimesSync(vieux, ilYaUneHeure, ilYaUneHeure);
    fs.utimesSync(autre, ilYaUneHeure, ilYaUneHeure);
    expect(await nettoyerTemporaires(tmp)).toBe(1);
    expect(fs.existsSync(vieux)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
    expect(fs.existsSync(autre)).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
