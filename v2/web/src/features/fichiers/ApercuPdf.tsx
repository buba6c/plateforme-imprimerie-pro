// Aperçu PDF dessiné par PDF.js sur des <canvas> : fonctionne sur ordinateur et sur téléphone,
// sans le lecteur intégré du navigateur (bloqué par la politique de sécurité « object-src 'none' »
// et absent sur Android). Les pages sont dessinées au fur et à mesure qu'elles deviennent visibles.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fichierUrl } from '../../lib/api';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function ApercuPdf({ id, nom, hauteur = '70vh' }: { id: number; nom: string; hauteur?: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const [page, setPage] = useState(1);
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let annule = false;
    let charge: PDFDocumentProxy | null = null;
    setDoc(null);
    setErreur(null);
    setPage(1);
    const ctrl = new AbortController();
    fetch(fichierUrl(id), { credentials: 'same-origin', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(r.status === 404 ? 'Le fichier est introuvable sur le serveur : signale-le à l’administrateur.' : `Aperçu impossible (erreur ${r.status}).`);
        }
        const data = new Uint8Array(await r.arrayBuffer());
        const d = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        charge = d;
        if (annule) d.destroy();
        else setDoc(d);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError' && !annule) setErreur(e.name === 'PasswordException' ? 'Ce PDF est protégé par un mot de passe : télécharge-le pour l’ouvrir.' : e.message || 'Aperçu impossible.');
      });
    return () => {
      annule = true;
      ctrl.abort();
      charge?.destroy();
    };
  }, [id]);

  const aller = (p: number) => {
    if (!doc) return;
    const n = Math.min(Math.max(1, p), doc.numPages);
    setPage(n);
    zone.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="pdf">
      <div className="pdf__barre">
        <button type="button" className="ev-icon-btn" onClick={() => aller(page - 1)} disabled={!doc || page <= 1} aria-label="Page précédente">
          <ChevronLeft />
        </button>
        <span className="pdf__pages">{doc ? `Page ${page} sur ${doc.numPages}` : '…'}</span>
        <button type="button" className="ev-icon-btn" onClick={() => aller(page + 1)} disabled={!doc || page >= (doc?.numPages ?? 1)} aria-label="Page suivante">
          <ChevronRight />
        </button>
        <span className="grow" />
        <button type="button" className="ev-icon-btn" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Réduire">
          <ZoomOut />
        </button>
        <span className="pdf__zoom">{Math.round(ZOOMS[zoom]! * 100)} %</span>
        <button type="button" className="ev-icon-btn" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Agrandir">
          <ZoomIn />
        </button>
        <a className="ev-icon-btn" href={fichierUrl(id, true)} download={nom} aria-label={`Télécharger ${nom}`}>
          <Download />
        </a>
      </div>
      <div
        className="pdf__zone"
        ref={zone}
        style={{ height: hauteur }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const pages = el.querySelectorAll<HTMLElement>('[data-page]');
          for (const p of pages) {
            if (p.offsetTop + p.offsetHeight / 2 > el.scrollTop) {
              setPage(Number(p.dataset.page));
              break;
            }
          }
        }}
      >
        {erreur ? (
          <p className="ev-error pdf__message" role="alert">
            {erreur}
          </p>
        ) : !doc ? (
          <p className="ev-muted pdf__message">Ouverture du PDF…</p>
        ) : (
          Array.from({ length: doc.numPages }, (_, i) => <PagePdf key={`${i}-${zoom}`} doc={doc} numero={i + 1} echelle={ZOOMS[zoom]!} zone={zone} />)
        )}
      </div>
    </div>
  );
}

function PagePdf({ doc, numero, echelle, zone }: { doc: PDFDocumentProxy; numero: number; echelle: number; zone: React.RefObject<HTMLDivElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const boite = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(numero <= 2);

  useEffect(() => {
    let ok = true;
    doc.getPage(numero).then((p) => {
      if (!ok) return;
      const largeur = (zone.current?.clientWidth ?? 600) - 24;
      const base = p.getViewport({ scale: 1 });
      const s = (largeur / base.width) * echelle;
      setTaille({ w: base.width * s, h: base.height * s });
    });
    return () => {
      ok = false;
    };
  }, [doc, numero, echelle, zone]);

  useEffect(() => {
    if (visible || !boite.current) return;
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { root: zone.current, rootMargin: '600px' });
    obs.observe(boite.current);
    return () => obs.disconnect();
  }, [visible, zone]);

  useEffect(() => {
    if (!visible || !taille || !canvas.current) return;
    let tache: { cancel: () => void } | null = null;
    let ok = true;
    doc.getPage(numero).then((p) => {
      if (!ok || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: (taille.w / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const t = p.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      tache = t;
      t.promise.catch(() => {});
    });
    return () => {
      ok = false;
      tache?.cancel();
    };
  }, [doc, numero, visible, taille]);

  return (
    <div className="pdf__page" data-page={numero} ref={boite} style={taille ? { width: taille.w, height: taille.h } : { height: 400 }}>
      <canvas ref={canvas} style={{ width: '100%', height: '100%' }} aria-label={`Page ${numero}`} />
    </div>
  );
}
