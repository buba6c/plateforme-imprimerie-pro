// Aperçu d'un fichier choisi sur l'ordinateur, avant son envoi : image affichée telle quelle,
// première page d'un PDF rendue par pdf.js (chargé à la demande), sinon l'extension.
// Un indicateur de chargement est montré pendant la préparation. Avec cinquante ou cent fichiers, seuls
// les aperçus visibles sont préparés, deux à la fois : chaque PDF est lu en entier en mémoire.
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { extension } from './ListeFichiers';
import './fichiers.css';

type Etat = { statut: 'chargement' } | { statut: 'image'; url: string } | { statut: 'icone' } | { statut: 'erreur' };

const LARGEUR = 160;
/** Au-delà, pas d'aperçu PDF (l'extension suffit) : le fichier entier passerait en mémoire. */
const PDF_MAX = 40 * 1024 * 1024;
const RENDUS_SIMULTANES = 2;

// File des rendus PDF, partagée par toutes les miniatures de la page.
let rendusActifs = 0;
const rendusEnAttente: (() => void)[] = [];
async function avecPlace<T>(tache: () => Promise<T>): Promise<T> {
  if (rendusActifs >= RENDUS_SIMULTANES) await new Promise<void>((ok) => rendusEnAttente.push(ok));
  rendusActifs++;
  try {
    return await tache();
  } finally {
    rendusActifs--;
    rendusEnAttente.shift()?.();
  }
}

async function rendrePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, disableAutoFetch: true }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const echelle = (LARGEUR * (window.devicePixelRatio || 1)) / base.width;
    const viewport = page.getViewport({ scale: echelle });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png');
  } finally {
    await doc.destroy().catch(() => {});
  }
}

export function MiniatureLocale({ file }: { file: File }) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  // Préparer l'aperçu seulement quand la miniature approche de l'écran.
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) {
        setVisible(true);
        obs.disconnect();
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let actif = true;
    let url: string | null = null;
    const ext = extension(file.name).toLowerCase();
    const estImage = file.type.startsWith('image/') && !['tif', 'tiff', 'psd', 'ai', 'eps'].includes(ext);
    const estPdf = file.type === 'application/pdf' || ext === 'pdf';
    if (estImage) {
      url = URL.createObjectURL(file);
      setEtat({ statut: 'image', url });
    } else if (estPdf && file.size <= PDF_MAX) {
      avecPlace(() => (actif ? rendrePdf(file) : Promise.reject(new Error('abandon')))).then(
        (u) => actif && setEtat({ statut: 'image', url: u }),
        () => actif && setEtat({ statut: 'erreur' }),
      );
    } else {
      setEtat({ statut: 'icone' });
    }
    return () => {
      actif = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, visible]);

  return (
    <span ref={ref} className="fi-mini" data-etat={etat.statut} aria-hidden="true">
      {etat.statut === 'chargement' ? (
        <span className="fi-mini__chargement">
          <LoaderCircle />
          <small>Aperçu…</small>
        </span>
      ) : etat.statut === 'image' ? (
        <img src={etat.url} alt="" />
      ) : (
        <span className="ev-file__type">{extension(file.name)}</span>
      )}
    </span>
  );
}
