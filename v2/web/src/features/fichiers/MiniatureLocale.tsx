// Aperçu d'un fichier choisi sur l'ordinateur, avant son envoi : image affichée telle quelle,
// première page d'un PDF rendue par pdf.js (chargé à la demande), sinon l'extension.
// Un indicateur de chargement est montré pendant la préparation.
import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { extension } from './ListeFichiers';
import './fichiers.css';

type Etat = { statut: 'chargement' } | { statut: 'image'; url: string } | { statut: 'icone' } | { statut: 'erreur' };

const LARGEUR = 160;

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
  useEffect(() => {
    let actif = true;
    let url: string | null = null;
    const ext = extension(file.name).toLowerCase();
    const estImage = file.type.startsWith('image/') && !['tif', 'tiff', 'psd', 'ai', 'eps'].includes(ext);
    const estPdf = file.type === 'application/pdf' || ext === 'pdf';
    if (estImage) {
      url = URL.createObjectURL(file);
      setEtat({ statut: 'image', url });
    } else if (estPdf && file.size <= 80 * 1024 * 1024) {
      rendrePdf(file).then(
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
  }, [file]);

  return (
    <span className="fi-mini" data-etat={etat.statut} aria-hidden="true">
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
