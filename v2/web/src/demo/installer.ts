// Mise en place de la démonstration hors ligne, avant le premier rendu :
// - interception de fetch pour /api/… (API simulée) et pour les adresses blob: de la démo ;
// - liens vers /api/… (PDF, exports, fichiers) ouverts dans la page au lieu d'une navigation ;
// - routeur par hachage : la partie « ?… » de l'adresse interne est recopiée dans la vraie adresse,
//   pour les écrans qui lisent window.location.search ;
// - état gardé dans l'onglet (sessionStorage) à chaque modification.

import { bonDeTravail, devis, exportCsv, facture, type DocumentDemo } from './documents';
import { connecte, initialiser, sauvegarder } from './etat';
import { ajouterFichier, adresseBlob, contenu, contenusBlob, fichierUrl } from './fichiers';
import { ErreurDemo, idDe, reponseErreur, unauthorized, type Reponse, type Requete } from './http';
import { traiter } from './serveur';

export const EVT_DOCUMENT = 'evocom-demo-document';
export const EVT_MESSAGE = 'evocom-demo-message';

export function afficherMessage(titre: string, message?: string, ton: 'info' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent(EVT_MESSAGE, { detail: { titre, message, ton } }));
}

function afficherDocument(doc: DocumentDemo) {
  window.dispatchEvent(new CustomEvent(EVT_DOCUMENT, { detail: doc }));
}

function json(r: Reponse): Response {
  if (r.status === 204 || r.body === undefined) return new Response(null, { status: r.status === 200 ? 204 : r.status });
  if (r.texte !== undefined) return new Response(r.texte, { status: r.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const attendre = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function utilisateurOu401() {
  const u = connecte();
  if (!u) throw unauthorized();
  return u;
}

/** Cas qui ne renvoient pas de JSON : contenu de fichier, envoi tus, bon de travail. */
function traiterSpecial(r: Requete): Response | null {
  let m = /^\/fichiers\/(\d+)\/contenu$/.exec(r.chemin);
  if (m && r.methode === 'GET') {
    try {
      const blob = contenu(utilisateurOu401(), idDe(m[1]));
      return new Response(blob, { status: 200, headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
    } catch (e) {
      return json(reponseErreur(e));
    }
  }
  if (r.chemin === '/uploads' && r.methode === 'POST') {
    try {
      const id = ajouterFichier(utilisateurOu401(), r.body ?? {});
      sauvegarder();
      return new Response(null, { status: 204, headers: { 'X-Fichier-Id': String(id) } });
    } catch (e) {
      const err = e instanceof ErreurDemo ? e : null;
      return new Response(err?.message ?? 'L’envoi a échoué.', { status: err?.status ?? 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  }
  m = /^\/dossiers\/(\d+)\/bon-de-travail\.pdf$/.exec(r.chemin);
  if (m && r.methode === 'GET') {
    try {
      const doc = bonDeTravail(utilisateurOu401(), idDe(m[1]));
      return new Response(doc.html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
      return json(reponseErreur(e));
    }
  }
  return null;
}

function lireCorps(init?: RequestInit): any {
  const b = init?.body;
  if (typeof b !== 'string' || !b) return undefined;
  try {
    return JSON.parse(b);
  } catch {
    return undefined;
  }
}

function installerFetch() {
  const fetchNavigateur = window.fetch.bind(window);
  window.fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url;
    const blob = contenusBlob.get(href);
    if (blob) return new Response(blob.blob, { status: 200, headers: { 'Content-Type': blob.blob.type } });
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return fetchNavigateur(entree, init);
    const methode = (init?.method ?? (entree instanceof Request ? entree.method : 'GET')).toUpperCase();
    const r: Requete = { methode, chemin: url.pathname.slice(4), query: url.searchParams, body: lireCorps(init) };
    // Petit délai : les états « chargement » et « envoi » restent visibles, comme en ligne.
    await attendre(methode === 'GET' || methode === 'HEAD' ? 40 : 160);
    const special = methode === 'HEAD' ? null : traiterSpecial(r);
    if (special) return special;
    const reponse = traiter(r);
    return methode === 'HEAD' ? new Response(null, { status: reponse.status }) : json(reponse);
  };
}

function telecharger(blob: Blob, nom: string) {
  const a = document.createElement('a');
  a.href = adresseBlob(blob, nom);
  a.download = nom;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Lien vers /api/… : aperçu imprimable, export CSV généré, ou réponse JSON téléchargée. */
function ouvrirLienApi(href: string) {
  const url = new URL(href, window.location.href);
  const chemin = url.pathname.slice(4);
  try {
    const u = utilisateurOu401();
    let m = /^\/dossiers\/(\d+)\/bon-de-travail\.pdf$/.exec(chemin);
    if (m) return afficherDocument(bonDeTravail(u, idDe(m[1])));
    m = /^\/devis\/(\d+)\/pdf$/.exec(chemin);
    if (m) return afficherDocument(devis(u, idDe(m[1])));
    m = /^\/factures\/(\d+)\/pdf$/.exec(chemin);
    if (m) return afficherDocument(facture(u, idDe(m[1])));
    m = /^\/fichiers\/(\d+)\/contenu$/.exec(chemin);
    if (m) {
      const id = idDe(m[1]);
      const nom = contenusBlob.get(fichierUrl(id))?.nom ?? `fichier-${id}`;
      return telecharger(contenu(u, id), nom);
    }
    m = /^\/exports\/([a-z]+\.csv)$/.exec(chemin);
    if (m) {
      const f = exportCsv(u, m[1]!, url.searchParams);
      return telecharger(new Blob([f.contenu], { type: 'text/csv;charset=utf-8' }), f.nom);
    }
    const r = traiter({ methode: 'GET', chemin, query: url.searchParams, body: undefined });
    if (r.status >= 400) throw new ErreurDemo(r.status, (r.body as { error?: string })?.error ?? 'Document indisponible.');
    const nom = `${chemin.split('/').filter(Boolean).join('-') || 'export'}.json`;
    telecharger(new Blob([JSON.stringify(r.body, null, 2)], { type: 'application/json' }), nom);
  } catch (e) {
    afficherMessage('Document indisponible', e instanceof Error ? e.message : undefined, 'error');
  }
}

function installerLiens() {
  document.addEventListener(
    'click',
    (ev) => {
      const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const blob = contenusBlob.get(a.href);
      if (blob) {
        // Nom lisible pour les téléchargements (une adresse blob: n'en a pas).
        if (a.hasAttribute('download') && !a.getAttribute('download')) a.setAttribute('download', blob.nom);
        return;
      }
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('/api/')) return;
      ev.preventDefault();
      ouvrirLienApi(href);
    },
    true,
  );
}

/** HashRouter : recopie la recherche de l'adresse interne (#/chemin?x=1) dans la vraie adresse (?x=1). */
function installerHistorique() {
  const recopier = (url: string | URL | null | undefined): string | URL | null | undefined => {
    if (typeof url !== 'string' || !url.startsWith('#')) return url;
    const i = url.indexOf('?');
    return `${window.location.pathname}${i >= 0 ? url.slice(i) : ''}${url}`;
  };
  for (const methode of ['pushState', 'replaceState'] as const) {
    const origine = history[methode].bind(history);
    history[methode] = (etat: unknown, titre: string, url?: string | URL | null) => origine(etat, titre, recopier(url));
  }
  // Adresse de départ : la recherche réelle doit refléter celle du hachage.
  const hash = window.location.hash;
  if (hash.startsWith('#/')) {
    try {
      history.replaceState(history.state, '', recopier(hash) as string);
    } catch {
      /* adresse non modifiable (aperçu) : sans conséquence */
    }
  }
}

export function installerDemo() {
  initialiser();
  installerFetch();
  installerLiens();
  installerHistorique();
  (globalThis as { __evocomDemo?: unknown }).__evocomDemo = { fichierUrl: (id: number) => fichierUrl(id) };
  window.addEventListener('pagehide', () => sauvegarder(true));
}
