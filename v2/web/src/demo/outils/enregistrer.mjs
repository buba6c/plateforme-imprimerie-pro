// Enregistre les réponses de l'API réelle pour la démonstration hors ligne.
//
// Parcourt tous les écrans avec chaque compte de démonstration (Playwright) et garde chaque réponse
// GET /api/... ; récupère aussi, avec le compte administrateur, les données qui alimentent le
// domaine simulé (dossiers, paiements, clients, tarifs…). Aucun secret n'est conservé.
//
// Prérequis : une API avec les données de démonstration et l'interface de développement qui la
// relaie (vite), puis :
//   BASE=http://localhost:5173 node src/demo/outils/enregistrer.mjs
// Résultat : src/demo/donnees/domaine.json et src/demo/donnees/enregistrements.json.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
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

const BASE = (process.env.BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? 'Evocom2026!';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.resolve(ICI, '../donnees');

const COMPTES = [
  { role: 'admin', email: 'admin@evocom.test' },
  { role: 'preparateur', email: 'prep@evocom.test' },
  { role: 'imprimeur_roland', email: 'roland@evocom.test' },
  { role: 'imprimeur_xerox', email: 'xerox@evocom.test' },
  { role: 'livreur', email: 'livreur@evocom.test' },
];

/** Écrans ouverts en plus du menu (s'ils ne sont pas accessibles au rôle, l'application redirige). */
const ECRANS_EN_PLUS = ['/profil', '/dossiers/nouveau', '/devis/nouveau'];

/**
 * Chemins servis par le domaine simulé (calculés en mémoire) : inutile de les enregistrer.
 * Les autres réponses GET sont gardées telles quelles, par rôle.
 */
const DOMAINE = [
  /^\/auth\//,
  /^\/dossiers(\/|$)/,
  /^\/fichiers\//,
  /^\/notifications$/,
  /^\/paiements$/,
  /^\/caisse$/,
  /^\/stats\/(apercu|evolution|production|top-clients)$/,
  /^\/clients(\/|$)/,
  /^\/tarifs(\/libelles)?$/,
  /^\/parametres(\/regles)?$/,
  /^\/users(\/annuaire)?$/,
  /^\/apparence$/,
  /^\/preferences$/,
  /^\/livraisons\/(planning|historique)$/,
  /^\/corbeille$/,
  /^\/ia\/statut$/,
];

// ---------------------------------------------------------------------------
// Aucun secret dans les données enregistrées

const CLES_INTERDITES = /(hash|token|secret|password|mot_de_passe|motdepasse|cle_chiffree|api_?key|jwt|cookie|session_id|sha256|chemin_disque|^ip$|user_agent)/i;
const VALEURS_INTERDITES = [/^sk-[\w-]{6,}/, /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, /^\$2[aby]\$\d\d\$/, /^[a-f0-9]{64}$/i];

function nettoyer(v, cle = '') {
  if (Array.isArray(v)) return v.map((x) => nettoyer(x));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (CLES_INTERDITES.test(k) && k !== 'doit_changer_mdp') continue;
      if (k === 'cle_fin') {
        out[k] = x ? 'demo' : null;
        continue;
      }
      out[k] = nettoyer(x, k);
    }
    // Chemins du serveur d'essai : remplacés par un chemin neutre.
    if (cle === 'stockage' && typeof out.chemin === 'string') out.chemin = '/srv/evocom/stockage';
    return out;
  }
  if (typeof v === 'string' && VALEURS_INTERDITES.some((r) => r.test(v))) return '[masqué]';
  return v;
}

function cle(u) {
  const url = new URL(u);
  const p = url.pathname.replace(/^\/api/, '');
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const s = new URLSearchParams(params).toString();
  return s ? `${p}?${s}` : p;
}

function servieParLeDomaine(k) {
  const p = k.split('?')[0];
  return DOMAINE.some((r) => r.test(p));
}

// ---------------------------------------------------------------------------

async function connecter(page, email) {
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: { email, password: MOT_DE_PASSE } });
  if (!r.ok()) throw new Error(`Connexion impossible pour ${email} : ${r.status()}`);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ev-sidebar a.ev-nav-item', { state: 'attached', timeout: 15000 });
}

async function visiter(page, chemin) {
  try {
    await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(300);
  } catch (e) {
    console.warn(`  ${chemin} : ${e.message.split('\n')[0]}`);
  }
}

/** Ouvre chaque onglet visible d'un écran (onglets de liste, sections de paramètres…). */
async function parcourirOnglets(page) {
  const onglets = await page.$$eval('[role=tab]', (els) => els.map((e, i) => i));
  for (const i of onglets.slice(0, 12)) {
    try {
      await page.locator('[role=tab]').nth(i).click({ timeout: 2000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(150);
    } catch {
      /* onglet masqué ou désactivé */
    }
  }
}

async function json(page, chemin) {
  const r = await page.request.get(`${BASE}/api${chemin}`);
  if (!r.ok()) throw new Error(`GET ${chemin} : ${r.status()}`);
  return r.json();
}

async function main() {
  const browser = await chromium.launch();
  const enregistrements = {};
  const notifications = {};
  const preferences = {};
  let domaine = null;

  for (const compte of COMPTES) {
    console.log(`Rôle ${compte.role} (${compte.email})`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', timezoneId: 'Africa/Dakar' });
    const page = await ctx.newPage();
    const pourRole = (enregistrements[compte.role] = {});
    page.on('response', async (res) => {
      const req = res.request();
      if (req.method() !== 'GET' || !res.url().startsWith(`${BASE}/api/`) || res.status() !== 200) return;
      if (!(res.headers()['content-type'] ?? '').includes('application/json')) return;
      const k = cle(res.url());
      if (servieParLeDomaine(k)) return;
      try {
        pourRole[k] = nettoyer(await res.json());
      } catch {
        /* réponse interrompue par la navigation */
      }
    });

    await connecter(page, compte.email);
    const menu = await page.$$eval('.ev-sidebar a.ev-nav-item', (as) => as.map((a) => new URL(a.href).pathname));
    const ecrans = [...new Set([...menu, ...ECRANS_EN_PLUS])];
    for (const e of ecrans) {
      await visiter(page, e);
      await parcourirOnglets(page);
    }

    // Fiches de détail des écrans de consultation.
    const details = [];
    if (compte.role === 'admin' || compte.role === 'preparateur') {
      const devis = await json(page, '/devis?limit=200').catch(() => ({ items: [] }));
      details.push(...(devis.items ?? []).map((d) => `/devis/${d.id}`));
      const factures = await json(page, '/factures?limit=200').catch(() => ({ items: [] }));
      details.push(...(factures.items ?? []).map((f) => `/factures/${f.id}`));
      const clients = await json(page, '/clients?limit=10').catch(() => ({ items: [] }));
      details.push(...(clients.items ?? []).slice(0, 4).map((c) => `/clients/${c.id}`));
    }
    const dossiers = await json(page, '/dossiers?limit=5&tri=recent');
    details.push(...dossiers.items.slice(0, 2).map((d) => `/dossiers/${d.id}`));
    for (const d of details) await visiter(page, d);

    notifications[compte.email] = nettoyer((await json(page, '/notifications')).items);
    preferences[compte.email] = nettoyer(await json(page, '/preferences'));

    if (compte.role === 'admin') domaine = await donneesDuDomaine(page);
    await ctx.close();
  }
  await browser.close();

  domaine.notifications = notifications;
  domaine.preferences = preferences;
  const enregistre_le = new Date().toISOString();
  fs.mkdirSync(SORTIE, { recursive: true });
  fs.writeFileSync(path.join(SORTIE, 'domaine.json'), `${JSON.stringify({ enregistre_le, ...nettoyer(domaine) })}\n`);
  fs.writeFileSync(path.join(SORTIE, 'enregistrements.json'), `${JSON.stringify({ enregistre_le, roles: enregistrements })}\n`);
  const n = Object.values(enregistrements).reduce((s, r) => s + Object.keys(r).length, 0);
  console.log(`${domaine.dossiers.length} dossiers, ${domaine.paiements.length} paiements, ${domaine.clients.length} clients ; ${n} réponses enregistrées.`);
  for (const f of ['domaine.json', 'enregistrements.json']) {
    console.log(`  ${f} : ${Math.round(fs.statSync(path.join(SORTIE, f)).size / 1024)} Ko`);
  }
}

/** Données de départ du domaine simulé, vues par l'administrateur (qui voit tout). */
async function donneesDuDomaine(page) {
  const liste = await json(page, '/dossiers?limit=200&tri=ancien');
  const dossiers = [];
  for (const d of liste.items) dossiers.push(await json(page, `/dossiers/${d.id}`));
  const paiements = (await json(page, '/paiements?limit=200')).items;
  const clientsListe = (await json(page, '/clients?limit=200')).items;
  const clients = [];
  for (const c of clientsListe) {
    const { dossiers: _d, totaux: _t, ...fiche } = await json(page, `/clients/${c.id}`);
    clients.push(fiche);
  }
  return {
    dossiers,
    corbeille: await json(page, '/corbeille'),
    paiements,
    clients,
    users: await json(page, '/users'),
    tarifs: await json(page, '/tarifs'),
    parametres: await json(page, '/parametres'),
    regles: await json(page, '/parametres/regles').catch(() => null),
    apparence: await json(page, '/apparence'),
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
