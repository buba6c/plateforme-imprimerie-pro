// Visionneuse PDF à deux moteurs :
//  1. PDF.js dans le navigateur (zoom fin, rapide) pour les fichiers de taille raisonnable ;
//  2. pages en image fabriquées par le serveur (Poppler) quand le fichier est énorme, quand PDF.js
//     n'arrive pas à l'ouvrir, ou quand le navigateur ne charge pas le moteur. Ainsi tout PDF s'ouvre.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api, apercuUrl, fichierUrl } from '../../lib/api';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
/** Au-delà, on ne télécharge pas tout le fichier dans le navigateur : pages servies par le serveur. */
const PDFJS_MAX = 40 * 1024 * 1024;

interface Infos {
  genre: 'pdf' | 'image' | null;
  pages: number | null;
  serveur: boolean;
}

export function ApercuPdf({ id, nom, taille, hauteur = '70vh' }: { id: number; nom: string; taille?: number; hauteur?: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [infos, setInfos] = useState<Infos | null>(null);
  const [mode, setMode] = useState<'pdfjs' | 'serveur' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const [page, setPage] = useState(1);
  const zone = useRef<HTMLDivElement>(null);
  const nbPages = mode === 'serveur' ? (infos?.pages ?? 0) : (doc?.numPages ?? 0);

  // 1. Ce que le serveur sait faire pour ce fichier.
  useEffect(() => {
    let annule = false;
    setInfos(null);
    setMode(null);
    setErreur(null);
    setPage(1);
    api
      .get<Infos>(`/fichiers/${id}/infos-apercu`)
      .then((i) => {
        if (annule) return;
        setInfos(i);
        const trop = (taille ?? 0) > PDFJS_MAX;
        setMode(trop && i.serveur && i.pages ? 'serveur' : 'pdfjs');
      })
      .catch(() => {
        if (!annule) {
          setInfos({ genre: 'pdf', pages: null, serveur: false });
          setMode('pdfjs');
        }
      });
    return () => {
      annule = true;
    };
  }, [id, taille]);

  // 2. Mode navigateur : ouverture par PDF.js ; en cas d'échec, bascule sur le serveur s'il le peut.
  useEffect(() => {
    if (mode !== 'pdfjs') return;
    let annule = false;
    let charge: PDFDocumentProxy | null = null;
    setDoc(null);
    const ctrl = new AbortController();
    fetch(fichierUrl(id), { credentials: 'same-origin', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Le fichier est introuvable sur le serveur : signale-le à l’administrateur.' : `Aperçu impossible (erreur ${r.status}).`);
        const data = new Uint8Array(await r.arrayBuffer());
        const d = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        charge = d;
        if (annule) d.destroy();
        else setDoc(d);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError' || annule) return;
        if (infos?.serveur && infos.pages) {
          setMode('serveur');
          return;
        }
        setErreur(e.name === 'PasswordException' ? 'Ce PDF est protégé par un mot de passe : télécharge-le pour l’ouvrir.' : e.message || 'Aperçu impossible.');
      });
    return () => {
      annule = true;
      ctrl.abort();
      charge?.destroy();
    };
  }, [id, mode, infos]);

  const aller = (p: number) => {
    const n = Math.min(Math.max(1, p), Math.max(1, nbPages));
    setPage(n);
    zone.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="pdf">
      <div className="pdf__barre">
        <button type="button" className="ev-icon-btn" onClick={() => aller(page - 1)} disabled={!nbPages || page <= 1} aria-label="Page précédente">
          <ChevronLeft />
        </button>
        <span className="pdf__pages">{nbPages ? `Page ${page} sur ${nbPages}` : '…'}</span>
        <button type="button" className="ev-icon-btn" onClick={() => aller(page + 1)} disabled={!nbPages || page >= nbPages} aria-label="Page suivante">
          <ChevronRight />
        </button>
        {mode === 'serveur' && <span className="pdf__mode">Pages en image</span>}
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
          for (const p of el.querySelectorAll<HTMLElement>('[data-page]')) {
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
        ) : mode === 'serveur' ? (
          Array.from({ length: nbPages }, (_, i) => <PageServeur key={`${i}-${zoom}`} id={id} numero={i + 1} echelle={ZOOMS[zoom]!} zone={zone} />)
        ) : !doc ? (
          <p className="ev-muted pdf__message">Ouverture du PDF…</p>
        ) : (
          Array.from({ length: doc.numPages }, (_, i) => <PagePdf key={`${i}-${zoom}`} doc={doc} numero={i + 1} echelle={ZOOMS[zoom]!} zone={zone} />)
        )}
      </div>
    </div>
  );
}

/** Page dessinée par le serveur : largeur demandée selon le zoom et l'écran, chargée quand elle approche. */
function PageServeur({ id, numero, echelle, zone }: { id: number; numero: number; echelle: number; zone: React.RefObject<HTMLDivElement | null> }) {
  const boite = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(numero <= 2);
  const largeurZone = (zone.current?.clientWidth ?? 600) - 24;
  const largeur = Math.min(2000, Math.round(largeurZone * echelle * Math.min(window.devicePixelRatio || 1, 2)));
  useEffect(() => {
    if (visible || !boite.current) return;
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { root: zone.current, rootMargin: '800px' });
    obs.observe(boite.current);
    return () => obs.disconnect();
  }, [visible, zone]);
  const url = apercuUrl(id, largeur, numero);
  return (
    <div className="pdf__page" data-page={numero} ref={boite} style={{ width: largeurZone * echelle, minHeight: largeurZone * echelle * 1.3 }}>
      {visible && url && <img src={url} alt={`Page ${numero}`} style={{ width: '100%', display: 'block' }} loading="lazy" decoding="async" />}
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
