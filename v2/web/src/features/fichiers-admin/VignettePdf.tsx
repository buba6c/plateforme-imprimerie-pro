// Vignette d'un PDF : seulement la première page, dessinée en petit par PDF.js quand la carte devient
// visible (IntersectionObserver). Garde-fous : PDF de plus de 25 Mo jamais chargés (icône de type à la
// place), 3 chargements à la fois au plus, vignettes déjà dessinées gardées en mémoire (images JPEG).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fichierUrl } from '../../lib/api';

// Même configuration que l'aperçu complet (features/fichiers/ApercuPdf.tsx).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const VIGNETTE_PDF_MAX = 25 * 1024 * 1024;
const SIMULTANES = 3;
const CACHE_MAX = 300;

const cache = new Map<number, string>();
const echecs = new Set<number>();
let actifs = 0;
const attente: (() => void)[] = [];

function garder(id: number, url: string) {
  cache.set(id, url);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

async function creneau(signal: AbortSignal): Promise<() => void> {
  if (actifs >= SIMULTANES) {
    await new Promise<void>((ok) => attente.push(ok));
  }
  actifs++;
  let libre = false;
  const liberer = () => {
    if (libre) return;
    libre = true;
    actifs--;
    attente.shift()?.();
  };
  if (signal.aborted) liberer();
  return liberer;
}

async function dessiner(id: number, largeur: number, signal: AbortSignal): Promise<string> {
  const r = await fetch(fichierUrl(id), { credentials: 'same-origin', signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = new Uint8Array(await r.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: (largeur * dpr) / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // fond papier : un PDF transparent reste lisible en mode sombre
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    void doc.destroy();
  }
}

export function VignettePdf({ id, taille, nom, repli }: { id: number; taille: number; nom: string; repli: ReactNode }) {
  const boite = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(() => cache.get(id) ?? null);
  const [ko, setKo] = useState(() => echecs.has(id) || taille > VIGNETTE_PDF_MAX);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setUrl(cache.get(id) ?? null);
    setKo(echecs.has(id) || taille > VIGNETTE_PDF_MAX);
  }, [id, taille]);

  useEffect(() => {
    if (visible || url || ko || !boite.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    obs.observe(boite.current);
    return () => obs.disconnect();
  }, [visible, url, ko]);

  useEffect(() => {
    if (!visible || url || ko) return;
    const ctrl = new AbortController();
    let liberer: (() => void) | null = null;
    (async () => {
      liberer = await creneau(ctrl.signal);
      if (ctrl.signal.aborted) return;
      const largeur = boite.current?.clientWidth || 240;
      const image = await dessiner(id, largeur, ctrl.signal);
      garder(id, image);
      if (!ctrl.signal.aborted) setUrl(image);
    })()
      .catch((e: Error) => {
        if (e.name === 'AbortError' || ctrl.signal.aborted) return;
        echecs.add(id);
        setKo(true);
      })
      .finally(() => liberer?.());
    return () => {
      ctrl.abort();
      liberer?.();
    };
  }, [visible, url, ko, id]);

  if (ko) return <>{repli}</>;
  return (
    <div ref={boite} className="fa-vignette-pdf" data-charge={!!url}>
      {url ? <img src={url} alt={`Première page de ${nom}`} /> : repli}
    </div>
  );
}
