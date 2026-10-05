// Vérifie la démonstration construite (dist-demo/) comme une page statique, sans API ni réseau :
// toute requête autre qu'un fichier de dist-demo est bloquée et signalée.
//   node src/demo/outils/verifier.mjs [dossier-captures]
// 1. Circuit complet : préparateur (création Roland avec bâche, fichier, validation), imprimeur
//    Roland (démarrer, imprimé), livreur (programmer, livrer, encaisser 10 000 FCFA en Wave),
//    administrateur (valider le paiement, tableau de bord).
// 2. Tous les écrans de chaque rôle, en clair et en sombre, à 1440 et 390 px de large.
// Code de sortie 1 en cas d'erreur de console, de requête bloquée ou d'étape manquée.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = playwright;

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ICI, '../../../dist-demo');
const CAPTURES = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'evocom-demo-captures'));
const PREFIXE = '/artefact/evocom/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const ROLES = [
  { role: 'admin', libelle: 'Administrateur' },
  { role: 'preparateur', libelle: 'Préparateur' },
  { role: 'imprimeur_roland', libelle: 'Imprimeur Roland' },
  { role: 'imprimeur_xerox', libelle: 'Imprimeur Xerox' },
  { role: 'livreur', libelle: 'Livreur' },
];

const problemes = [];
const bloquees = new Set();

function serveur() {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith(PREFIXE)) return res.writeHead(404).end();
    const rel = decodeURIComponent(u.pathname.slice(PREFIXE.length)) || 'index.html';
    const f = path.join(DIST, rel);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(s)));
}

async function nouvellePage(browser, base, { largeur, theme, nom }) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: largeur < 600 ? 860 : 900 }, colorScheme: theme, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
  const page = await ctx.newPage();
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const local = u.origin === new URL(base).origin && u.pathname.startsWith(PREFIXE) && fs.existsSync(path.join(DIST, u.pathname.slice(PREFIXE.length) || 'index.html'));
    if (local) return route.continue();
    bloquees.add(route.request().url());
    return route.abort();
  });
  page.on('pageerror', (e) => problemes.push(`[${nom}] erreur JS : ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problemes.push(`[${nom}] console : ${m.text()}`);
  });
  return { ctx, page };
}

async function capture(page, nom) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(CAPTURES, `${nom}.png`), fullPage: true });
}

async function aller(page, route) {
  await page.evaluate((r) => {
    window.location.hash = r;
  }, `#${route}`);
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !document.querySelector('.page-loading'), null, { timeout: 10000 }).catch(() => {});
}

async function entrer(page, libelle) {
  const bouton = page.getByRole('button', { name: new RegExp(`^Entrer comme ${libelle}`) });
  if (!(await bouton.first().isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Changer de rôle' }).click();
  }
  await page.getByRole('button', { name: new RegExp(`^Entrer comme ${libelle}`) }).first().click();
  await page.waitForSelector('.ev-sidebar a.ev-nav-item', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(300);
}

let pageCircuit = null;
let numeroEchec = 0;

async function etape(nom, f) {
  try {
    await f();
    console.log(`✓ ${nom}`);
  } catch (e) {
    if (pageCircuit) await pageCircuit.screenshot({ path: path.join(CAPTURES, `echec-${++numeroEchec}.png`), fullPage: true }).catch(() => {});
    problemes.push(`Étape « ${nom} » : ${e.message.split('\n')[0]}`);
    console.log(`✗ ${nom} : ${e.message.split('\n')[0]}`);
  }
}

/** Petite image PNG valide (1 × 1 pixel), comme fichier d'impression envoyé. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function circuit(browser, base) {
  const { ctx, page } = await nouvellePage(browser, base, { largeur: 1440, theme: 'light', nom: 'circuit' });
  pageCircuit = page;
  let id = null;
  let encaisseAvant = null;
  await page.goto(`${base}index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.demo-accueil');
  await capture(page, 'circuit-01-connexion');

  await etape('Préparateur : création d’un dossier Roland (bâche, prix calculé)', async () => {
    await entrer(page, 'Préparateur');
    await aller(page, '/dossiers/nouveau');
    await page.locator('input[name=machine][value=roland]').check();
    await page.getByPlaceholder('Entreprise ou particulier').fill('Restaurant Le Lagon');
    await page.keyboard.press('Escape');
    await page.getByLabel('Description du travail').fill('Bâche promotion Tabaski');
    await page.getByLabel('Support').first().selectOption('bache_m2');
    await page.getByLabel('Largeur').first().fill('400');
    await page.getByLabel('Hauteur').first().fill('150');
    await page.getByLabel('Quantité').first().fill('2');
    await page.waitForTimeout(300);
    const barre = await page.locator('.du-barre__info').innerText();
    if (!/84\s000/.test(barre.replace(/\u202f|\u00a0/g, ' '))) throw new Error(`prix attendu 84 000 FCFA, affiché : ${barre}`);
    await capture(page, 'circuit-02-nouveau-dossier');
    await page.getByRole('button', { name: 'Créer le dossier' }).click();
    await page.waitForFunction(() => /#\/dossiers\/\d+(\?|$)/.test(window.location.hash), null, { timeout: 10000 });
    id = Number(/#\/dossiers\/(\d+)/.exec(await page.evaluate(() => window.location.hash))[1]);
    // La recherche de l'adresse interne est recopiée dans la vraie adresse (écrans qui lisent location.search).
    const vraie = await page.evaluate(() => window.location.search);
    if (vraie !== '?nouveau=1') throw new Error(`recherche réelle attendue « ?nouveau=1 », obtenue « ${vraie} »`);
  });

  await etape('Préparateur : ajout d’un fichier puis validation', async () => {
    await page.locator('input[type=file]').setInputFiles({ name: 'bache-tabaski.png', mimeType: 'image/png', buffer: PNG });
    await page.getByText('bache-tabaski.png').first().waitFor({ timeout: 10000 });
    await page.waitForFunction(() => !!document.querySelector('.ev-files .ev-file'), null, { timeout: 10000 });
    await capture(page, 'circuit-03-fichier');
    await page.getByRole('button', { name: 'Valider le dossier' }).first().click();
    await page.getByText('Prêt à imprimer').first().waitFor({ timeout: 10000 });
    await capture(page, 'circuit-04-valide');
  });

  await etape('Imprimeur Roland : le dossier est dans sa file, démarrer puis marquer imprimé', async () => {
    await entrer(page, 'Imprimeur Roland');
    await page.getByText('Restaurant Le Lagon').first().waitFor({ timeout: 10000 });
    await capture(page, 'circuit-05-atelier');
    await aller(page, `/dossiers/${id}`);
    await page.getByRole('button', { name: 'Démarrer l’impression' }).or(page.getByRole('button', { name: "Démarrer l'impression" })).first().click();
    await page.getByText('En impression').first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Marquer comme imprimé' }).first().click();
    await page.getByText('Prêt à livrer').first().waitFor({ timeout: 10000 });
    await capture(page, 'circuit-06-imprime');
  });

  await etape('Imprimeur Xerox : ne voit pas le dossier Roland', async () => {
    await entrer(page, 'Imprimeur Xerox');
    await aller(page, `/dossiers/${id}`);
    await page.getByText(/n'existe pas|introuvable|pas accessible/i).first().waitFor({ timeout: 10000 });
  });

  await etape('Livreur : programmer, livrer et encaisser 10 000 FCFA en Wave', async () => {
    await entrer(page, 'Livreur');
    await page.getByRole('tab', { name: /À programmer/ }).click();
    await page.getByText('Restaurant Le Lagon').first().waitFor({ timeout: 10000 });
    await capture(page, 'circuit-07-a-livrer');
    await aller(page, `/dossiers/${id}`);
    await page.getByRole('button', { name: 'Programmer la livraison' }).first().click();
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Date et heure prévues').fill(`${demain}T10:00`);
    await page.getByLabel('Adresse de livraison').fill('Almadies, route de Ngor');
    await page.locator('.ev-dialog').getByRole('button', { name: 'Programmer', exact: true }).click();
    await page.getByText('En livraison').first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Confirmer la livraison' }).first().click();
    const dialogue = page.locator('.ev-dialog');
    const caseEncaisse = dialogue.getByLabel("J'ai encaissé un paiement à la livraison");
    if (!(await caseEncaisse.isChecked())) await caseEncaisse.check();
    await dialogue.getByLabel('Montant encaissé').fill('10000');
    await dialogue.getByLabel('Mode de paiement').selectOption('wave');
    await dialogue.getByLabel('Référence de la transaction').fill('WV-DEMO-0001');
    await capture(page, 'circuit-08-encaissement');
    await dialogue.getByRole('button', { name: /^Livrer et encaisser 10/ }).click();
    await page.locator('.ev-status', { hasText: 'Livré' }).first().waitFor({ timeout: 10000 });
    await capture(page, 'circuit-09-livre');
  });

  await etape('Administrateur : valider le paiement, le tableau de bord change', async () => {
    await entrer(page, 'Administrateur');
    await page.waitForTimeout(500);
    encaisseAvant = await page.locator('main').innerText();
    await capture(page, 'circuit-10-tableau-avant');
    await aller(page, '/paiements');
    await page.getByRole('button', { name: /Valider le paiement CMD-/ }).first().waitFor({ timeout: 10000 });
    await capture(page, 'circuit-11-paiements');
    const boutons = page.getByRole('button', { name: /Valider le paiement CMD-/ });
    const n = await boutons.count();
    let trouve = false;
    for (let i = 0; i < n; i++) {
      const ligne = boutons.nth(i).locator('xpath=ancestor::*[self::tr or self::li or contains(@class,"ev-card")][1]');
      if (/10\s000/.test((await ligne.innerText()).replace(/\u202f|\u00a0/g, ' '))) {
        await boutons.nth(i).click();
        trouve = true;
        break;
      }
    }
    if (!trouve) throw new Error('paiement de 10 000 FCFA introuvable dans la liste à valider');
    await page.waitForTimeout(600);
    await aller(page, '/tableau-de-bord');
    await page.waitForTimeout(800);
    const apres = await page.locator('main').innerText();
    if (apres === encaisseAvant) throw new Error('le tableau de bord n’a pas changé');
    await capture(page, 'circuit-12-tableau-apres');
  });

  await etape('Aperçus : bon de travail, fichier PDF, devis imprimable, export CSV', async () => {
    await aller(page, '/dossiers/1');
    await page.getByRole('link', { name: 'Bon de travail' }).first().click();
    const titre = await page.frameLocator('iframe.demo-document').locator('h1').innerText({ timeout: 10000 });
    if (!/^Bon de travail CMD-/.test(titre)) throw new Error(`titre inattendu : ${titre}`);
    await capture(page, 'apercu-01-bon-de-travail');
    await page.keyboard.press('Escape');
    await page.locator('button.fi-file__nom').first().click();
    await page.waitForFunction(() => document.querySelector('.fi-apercu iframe, .fi-apercu img')?.getAttribute('src')?.startsWith('blob:'), null, { timeout: 10000 });
    await capture(page, 'apercu-02-fichier-pdf');
    await page.keyboard.press('Escape');
    await aller(page, '/devis/1');
    await page.getByRole('link', { name: 'Imprimer' }).first().click();
    await page.frameLocator('iframe.demo-document').locator('h1').waitFor({ timeout: 10000 });
    await capture(page, 'apercu-03-devis');
    await page.keyboard.press('Escape');
    await aller(page, '/statistiques');
    const [telechargement] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('link', { name: 'Exporter les dossiers' }).click()]);
    const csv = fs.readFileSync(await telechargement.path(), 'utf8');
    if (!telechargement.suggestedFilename().endsWith('.csv') || !csv.includes('CMD-')) throw new Error(`export inattendu : ${telechargement.suggestedFilename()}`);
  });

  await etape('Assistant IA : proposition chiffrée avec la grille', async () => {
    await entrer(page, 'Préparateur');
    await aller(page, '/dossiers/nouveau');
    await page.getByRole('button', { name: /Assistant de saisie/ }).click();
    await page.getByLabel('Décrivez la demande du client').fill('2 bâches de 3 x 1 m avec œillets pour une façade, urgent');
    await page.getByRole('button', { name: 'Proposer' }).click();
    await page.getByText('Proposition à vérifier').waitFor({ timeout: 10000 });
    await page.getByText('Prix selon la grille').waitFor({ timeout: 10000 });
    await capture(page, 'ia-01-proposition');
  });

  await etape('Droits : refus 403 pour un rôle non autorisé, dossier d’une autre machine introuvable', async () => {
    const statut = (u) => page.evaluate(async (x) => (await fetch(x)).status, u);
    for (const u of ['/api/stats/apercu', '/api/users', '/api/caisse']) {
      if ((await statut(u)) !== 403) throw new Error(`préparateur : ${u} devrait être refusé`);
    }
    await entrer(page, 'Imprimeur Roland');
    for (const u of ['/api/paiements', '/api/clients', '/api/tarifs']) {
      if ((await statut(u)) !== 403) throw new Error(`imprimeur : ${u} devrait être refusé`);
    }
    const xerox = await page.evaluate(async () => (await (await fetch('/api/dossiers?machine=xerox')).json()).total);
    if (xerox !== 0) throw new Error('l’imprimeur Roland voit des dossiers Xerox');
  });

  await etape('Thème : le choix est enregistré en mémoire (PUT /preferences)', async () => {
    await page.getByRole('button', { name: /^Thème :/ }).click();
    await page.waitForTimeout(300);
    const pref = await page.evaluate(async () => (await (await fetch('/api/preferences')).json()).theme);
    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (pref !== 'light' || attr !== 'light') throw new Error(`thème attendu « light », obtenu ${pref} / ${attr}`);
    await page.getByRole('button', { name: /^Thème :/ }).click();
    await page.getByRole('button', { name: /^Thème :/ }).click();
  });

  await etape('Actions non simulées : message de démonstration clair', async () => {
    await entrer(page, 'Administrateur');
    const r = await page.evaluate(async () => {
      const a = await fetch('/api/devis/1/statut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"statut":"envoye"}' });
      const b = await fetch('/api/systeme/reinitialiser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      return [a.status, (await a.json()).error, b.status, (await b.json()).error];
    });
    if (r[0] !== 403 || !/^Démonstration/.test(r[1]) || r[2] !== 403 || !/^Démonstration/.test(r[3])) throw new Error(JSON.stringify(r));
  });

  await etape('Rechargement : l’état de la démonstration est conservé', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.ev-sidebar a.ev-nav-item', { state: 'attached', timeout: 10000 });
    await aller(page, `/dossiers/${id}`);
    await page.locator('.ev-status', { hasText: 'Livré' }).first().waitFor({ timeout: 10000 });
  });

  await etape('Réinitialiser la démo : retour aux données de départ', async () => {
    await page.getByRole('button', { name: /Réinitialiser/ }).first().click();
    await page.locator('.ev-dialog').getByRole('button', { name: 'Réinitialiser' }).click();
    await page.waitForTimeout(500);
    const statut = await page.evaluate(async (n) => (await fetch(`/api/dossiers/${n}`)).status, id);
    if (statut !== 404) throw new Error(`le dossier créé existe encore (${statut})`);
    await page.waitForSelector('.ev-sidebar a.ev-nav-item', { state: 'attached' });
  });
  await ctx.close();
}

async function ecrans(browser, base) {
  for (const largeur of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      for (const r of ROLES) {
        const nom = `${r.role}-${largeur}-${theme}`;
        const { ctx, page } = await nouvellePage(browser, base, { largeur, theme, nom });
        await page.goto(`${base}index.html`, { waitUntil: 'load' });
        await page.waitForSelector('.demo-accueil');
        if (r.role === 'admin') await capture(page, `connexion-${largeur}-${theme}`);
        await entrer(page, r.libelle);
        const liens = await page.$$eval('.ev-sidebar a.ev-nav-item', (as) => as.map((a) => a.getAttribute('href')));
        for (const l of liens) {
          const route = l.replace(/^#/, '');
          await aller(page, route);
          await capture(page, `${nom}${route.replace(/\//g, '_')}`);
        }
        // Une fiche dossier par rôle.
        const premier = await page.evaluate(async () => {
          const r = await fetch('/api/dossiers?limit=1&tri=recent');
          const j = await r.json();
          return j.items?.[0]?.id ?? null;
        });
        if (premier) {
          await aller(page, `/dossiers/${premier}`);
          await capture(page, `${nom}_fiche-dossier`);
        }
        await ctx.close();
      }
    }
  }
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist-demo/index.html absent : lancez d’abord npm run build:demo');
  fs.mkdirSync(CAPTURES, { recursive: true });
  const s = await serveur();
  const base = `http://127.0.0.1:${s.address().port}${PREFIXE}`;
  const browser = await chromium.launch();
  try {
    await circuit(browser, base);
    await ecrans(browser, base);
  } finally {
    await browser.close();
    s.close();
  }
  for (const u of bloquees) problemes.push(`Requête réseau bloquée : ${u}`);
  const taille = fs.readdirSync(DIST, { recursive: true }).reduce((t, f) => {
    const p = path.join(DIST, f);
    return fs.statSync(p).isFile() ? t + fs.statSync(p).size : t;
  }, 0);
  console.log(`dist-demo : ${(taille / 1024 / 1024).toFixed(2)} Mo ; captures dans ${CAPTURES}`);
  if (problemes.length) {
    console.log(`\n${problemes.length} problème(s) :\n- ${[...new Set(problemes)].join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('Aucune erreur de console, aucune requête réseau hors fichiers statiques.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
