// Aperçu d'une page pour le schéma d'imposition et les miniatures : d'abord l'image rendue par le
// serveur (Poppler) ; si le serveur ne sait pas rendre les PDF (501, Poppler absent) ou échoue, la page
// est rendue dans le navigateur avec PDF.js à partir du PDF lui-même. Résultats gardés en mémoire.
import { useEffect, useState } from 'react';

export interface SourcePage {
  fichier_id?: number;
  libre?: string;
  page: number;
  genre: 'pdf' | 'image';
}

const urlApercu = (s: SourcePage, largeur: number) =>
  s.libre ? `/api/imposition/libre/${s.libre}/apercu?page=${s.page}&largeur=${largeur}` : `/api/fichiers/${s.fichier_id}/apercu?page=${s.page}&largeur=${largeur}`;
const urlContenu = (s: SourcePage) => (s.libre ? `/api/imposition/libre/${s.libre}/contenu` : `/api/fichiers/${s.fichier_id}/contenu`);
const cleSource = (s: SourcePage) => (s.libre ? `l:${s.libre}` : `f:${s.fichier_id}`);

/** Le serveur sait-il rendre les PDF ? Demandé une fois (/imposition/capacites), puis mémorisé. */
let serveurSansPoppler = false;
let capacites: Promise<void> | null = null;
function verifierCapacites(): Promise<void> {
  if (!capacites) {
    capacites = fetch('/api/imposition/capacites', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { apercus_pdf?: boolean } | null) => {
        if (c && c.apercus_pdf === false) serveurSansPoppler = true;
      })
      .catch(() => {});
  }
  return capacites;
}

const images = new Map<string, Promise<string>>();
const documents = new Map<string, Promise<any>>();

async function pdfjs() {
  const lib = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = worker;
  return lib;
}

function documentPdf(s: SourcePage): Promise<any> {
  const cle = cleSource(s);
  let p = documents.get(cle);
  if (!p) {
    p = (async () => {
      const res = await fetch(urlContenu(s), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`contenu ${res.status}`);
      const data = new Uint8Array(await res.arrayBuffer());
      const lib = await pdfjs();
      return lib.getDocument({ data, disableAutoFetch: true }).promise;
    })();
    p.catch(() => documents.delete(cle));
    documents.set(cle, p);
  }
  return p;
}

async function rendreNavigateur(s: SourcePage, largeur: number): Promise<string> {
  const doc = await documentPdf(s);
  const page = await doc.getPage(Math.min(Math.max(1, s.page), doc.numPages));
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (largeur * (window.devicePixelRatio || 1)) / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.86);
}

async function rendreServeur(s: SourcePage, largeur: number): Promise<string> {
  const res = await fetch(urlApercu(s, largeur), { credentials: 'same-origin' });
  if (res.status === 501) {
    serveurSansPoppler = true;
    throw new Error('501');
  }
  if (!res.ok) throw new Error(`apercu ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Image (URL) de la page demandée ; jamais rejetée deux fois pour la même clé après un échec. */
export function apercuPage(s: SourcePage, largeur: number): Promise<string> {
  const cle = `${cleSource(s)}|${s.page}|${largeur}`;
  let p = images.get(cle);
  if (!p) {
    p = (async () => {
      if (s.genre === 'image') {
        try {
          return await rendreServeur(s, largeur);
        } catch {
          return urlContenu(s); // l'image d'origine, affichée telle quelle
        }
      }
      await verifierCapacites();
      if (!serveurSansPoppler) {
        try {
          return await rendreServeur(s, largeur);
        } catch {
          /* rendu dans le navigateur */
        }
      }
      return rendreNavigateur(s, largeur);
    })();
    p.catch(() => images.delete(cle));
    images.set(cle, p);
  }
  return p;
}

export function useApercuPage(s: SourcePage | null, largeur: number): { url: string | null; etat: 'chargement' | 'pret' | 'erreur' } {
  const [etat, setEtat] = useState<{ url: string | null; etat: 'chargement' | 'pret' | 'erreur' }>({ url: null, etat: 'chargement' });
  const cle = s ? `${cleSource(s)}|${s.page}|${s.genre}` : '';
  useEffect(() => {
    if (!s) return;
    let actif = true;
    setEtat({ url: null, etat: 'chargement' });
    apercuPage(s, largeur).then(
      (url) => actif && setEtat({ url, etat: 'pret' }),
      () => actif && setEtat({ url: null, etat: 'erreur' }),
    );
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, largeur]);
  return etat;
}
