// La feuille imposée, à l'échelle, avec le vrai visuel de chaque page dans sa pose (aperçu rendu par le
// serveur). Les fonds perdus sont dessinés en temps réel selon la méthode choisie : ceux du fichier,
// miroir des bords (bandes retournées), étirement, ou blanc. Traits de coupe, zone finie, pli du livret
// et numéros s'affichent ou se masquent à la demande.
import { useState } from 'react';
import { useApercuPage } from './rendu';
import type { Face, MethodeFondsPerdus, PageVirtuelle, Plan } from './types';

export interface AffichageSchema {
  fonds: boolean;
  traits: boolean;
  zone_finie: boolean;
  numeros: boolean;
}

function Image({ href, x, y, w, h, clip, sx = 1, sy = 1, onError, t: tForce }: { href: string; x: number; y: number; w: number; h: number; clip: string; sx?: 1 | -1; sy?: 1 | -1; onError: () => void; t?: string }) {
  // Miroir : on retourne l'image autour de son propre centre. Prolonger : transformée fournie.
  const t = tForce ?? (sx === 1 && sy === 1 ? undefined : `translate(${x + w / 2} ${y + h / 2}) scale(${sx} ${sy}) translate(${-(x + w / 2)} ${-(y + h / 2)})`);
  return (
    <g clipPath={`url(#${clip})`}>
      <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="none" transform={t} onError={onError} />
    </g>
  );
}

function Visuel({ pg, x, y, w, h, fp, methode, sourceAvecFonds, i, afficherFonds, unis }: { pg: PageVirtuelle; x: number; y: number; w: number; h: number; fp: number; methode: MethodeFondsPerdus; sourceAvecFonds: boolean; i: number; afficherFonds: boolean; unis?: { haut: boolean; bas: boolean; gauche: boolean; droite: boolean } | null }) {
  const [ko, setKo] = useState(false);
  const rendu = useApercuPage({ fichier_id: pg.libre ? undefined : pg.fichier_id, libre: pg.libre, page: pg.page_source, genre: pg.genre }, 360);
  const id = `p${i}-${pg.numero}`;
  if (rendu.etat === 'chargement') {
    return (
      <g className="imp-schema__charge">
        <rect x={x} y={y} width={w} height={h} />
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8, Math.min(13, w / 8))}>Chargement…</text>
      </g>
    );
  }
  if (ko || rendu.etat === 'erreur' || !rendu.url) {
    return (
      <g className="imp-schema__charge" data-erreur>
        <rect x={x} y={y} width={w} height={h} />
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8, Math.min(12, w / 9))}>Aperçu indisponible</text>
      </g>
    );
  }
  const href = rendu.url;
  const bx = x - fp, by = y - fp, bw = w + 2 * fp, bh = h + 2 * fp;
  const fonds = afficherFonds && fp > 0;
  const zones = (
    <defs>
      <clipPath id={`${id}-fini`}><rect x={x} y={y} width={w} height={h} /></clipPath>
      <clipPath id={`${id}-tout`}><rect x={fonds ? bx : x} y={fonds ? by : y} width={fonds ? bw : w} height={fonds ? bh : h} /></clipPath>
      <clipPath id={`${id}-g`}><rect x={bx} y={y} width={fp} height={h} /></clipPath>
      <clipPath id={`${id}-d`}><rect x={x + w} y={y} width={fp} height={h} /></clipPath>
      <clipPath id={`${id}-h`}><rect x={x} y={by} width={w} height={fp} /></clipPath>
      <clipPath id={`${id}-b`}><rect x={x} y={y + h} width={w} height={fp} /></clipPath>
      <clipPath id={`${id}-c1`}><rect x={bx} y={by} width={fp} height={fp} /></clipPath>
      <clipPath id={`${id}-c2`}><rect x={x + w} y={by} width={fp} height={fp} /></clipPath>
      <clipPath id={`${id}-c3`}><rect x={bx} y={y + h} width={fp} height={fp} /></clipPath>
      <clipPath id={`${id}-c4`}><rect x={x + w} y={y + h} width={fp} height={fp} /></clipPath>
    </defs>
  );
  const err = () => setKo(true);
  // Le fichier a ses fonds perdus : la page rendue couvre fini + fonds perdus.
  if (methode === 'source' && sourceAvecFonds) return <g>{zones}<Image href={href} x={bx} y={by} w={bw} h={bh} clip={`${id}-tout`} onError={err} /></g>;
  // Fichier sans fonds perdus en mode « du fichier » : le serveur les fabrique bord par bord (intelligent).
  if (!fonds || methode === 'blanc') return <g>{zones}<Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-fini`} onError={err} /></g>;
  if (methode === 'etirer') return <g>{zones}<Image href={href} x={bx} y={by} w={bw} h={bh} clip={`${id}-tout`} onError={err} /></g>;
  if (methode === 'prolonger' || methode === 'intelligent' || methode === 'source') {
    // Chaque bord : prolongé (bande de 0,5 mm étirée) ou miroir, comme dans le PDF généré.
    const m = (u: boolean | undefined) => (methode === 'prolonger' || u !== false ? 'p' : 'm');
    const g = m(unis?.gauche), d = m(unis?.droite), hh = m(unis?.haut), bb = m(unis?.bas);
    const sw = Math.max(0.6, Math.min(w, h) * 0.006);
    const f = fp / sw;
    // Prolonger : transformée « étire la bande du bord sur fp » ; miroir : image retournée de l'autre côté.
    const bandeG = g === 'p' ? <Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-g`} onError={err} t={`translate(${x - fp} 0) scale(${f} 1) translate(${-x} 0)`} /> : <Image href={href} x={x - w} y={y} w={w} h={h} sx={-1} clip={`${id}-g`} onError={err} />;
    const bandeD = d === 'p' ? <Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-d`} onError={err} t={`translate(${x + w} 0) scale(${f} 1) translate(${-(x + w - sw)} 0)`} /> : <Image href={href} x={x + w} y={y} w={w} h={h} sx={-1} clip={`${id}-d`} onError={err} />;
    const bandeH = hh === 'p' ? <Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-h`} onError={err} t={`translate(0 ${y - fp}) scale(1 ${f}) translate(0 ${-y})`} /> : <Image href={href} x={x} y={y - h} w={w} h={h} sy={-1} clip={`${id}-h`} onError={err} />;
    const bandeB = bb === 'p' ? <Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-b`} onError={err} t={`translate(0 ${y + h}) scale(1 ${f}) translate(0 ${-(y + h - sw)})`} /> : <Image href={href} x={x} y={y + h} w={w} h={h} sy={-1} clip={`${id}-b`} onError={err} />;
    const coin = (cx: 'g' | 'd', cy: 'h' | 'b', clip: string) => {
      const mx = cx === 'g' ? g : d;
      const my = cy === 'h' ? hh : bb;
      if (mx === 'm' || my === 'm') return <Image href={href} x={cx === 'g' ? x - w : x + w} y={cy === 'h' ? y - h : y + h} w={w} h={h} sx={-1} sy={-1} clip={clip} onError={err} />;
      const tx = cx === 'g' ? `translate(${x - fp} 0) scale(${f} 1) translate(${-x} 0)` : `translate(${x + w} 0) scale(${f} 1) translate(${-(x + w - sw)} 0)`;
      const ty = cy === 'h' ? `translate(0 ${y - fp}) scale(1 ${f}) translate(0 ${-y})` : `translate(0 ${y + h}) scale(1 ${f}) translate(0 ${-(y + h - sw)})`;
      return <Image href={href} x={x} y={y} w={w} h={h} clip={clip} onError={err} t={`${ty} ${tx}`} />;
    };
    return (
      <g>
        {zones}
        <Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-fini`} onError={err} />
        {bandeG}{bandeD}{bandeH}{bandeB}
        {coin('g', 'h', `${id}-c1`)}{coin('d', 'h', `${id}-c2`)}{coin('g', 'b', `${id}-c3`)}{coin('d', 'b', `${id}-c4`)}
      </g>
    );
  }
  // Miroir : le visuel au centre, puis les bandes retournées sur chaque bord et dans les coins.
  return (
    <g>
      {zones}
      <Image href={href} x={x} y={y} w={w} h={h} clip={`${id}-fini`} onError={err} />
      <Image href={href} x={x - w} y={y} w={w} h={h} sx={-1} clip={`${id}-g`} onError={err} />
      <Image href={href} x={x + w} y={y} w={w} h={h} sx={-1} clip={`${id}-d`} onError={err} />
      <Image href={href} x={x} y={y - h} w={w} h={h} sy={-1} clip={`${id}-h`} onError={err} />
      <Image href={href} x={x} y={y + h} w={w} h={h} sy={-1} clip={`${id}-b`} onError={err} />
      <Image href={href} x={x - w} y={y - h} w={w} h={h} sx={-1} sy={-1} clip={`${id}-c1`} onError={err} />
      <Image href={href} x={x + w} y={y - h} w={w} h={h} sx={-1} sy={-1} clip={`${id}-c2`} onError={err} />
      <Image href={href} x={x - w} y={y + h} w={w} h={h} sx={-1} sy={-1} clip={`${id}-c3`} onError={err} />
      <Image href={href} x={x + w} y={y + h} w={w} h={h} sx={-1} sy={-1} clip={`${id}-c4`} onError={err} />
    </g>
  );
}

export function SchemaFeuille({
  plan,
  face,
  pages,
  largeur = 420,
  titre,
  methode = 'source',
  sourceAvecFonds = false,
  unisDe,
  affichage = { fonds: true, traits: true, zone_finie: true, numeros: true },
}: {
  plan: Plan;
  face: Face;
  pages?: PageVirtuelle[];
  largeur?: number;
  titre?: string;
  methode?: MethodeFondsPerdus;
  sourceAvecFonds?: boolean;
  /** Bords unis de chaque page (analyse) : décide prolonger ou miroir en mode intelligent. */
  unisDe?: (numero: number) => { haut: boolean; bas: boolean; gauche: boolean; droite: boolean } | null;
  affichage?: AffichageSchema;
}) {
  const W = plan.feuille.largeur;
  const H = plan.feuille.hauteur;
  const k = largeur / W;
  const hauteur = Math.round(H * k);
  const fp = plan.fonds_perdus_mm * k;
  const yS = (yMm: number, hMm: number) => (H - yMm - hMm) * k;
  const pageDe = (n: number | null) => (n === null ? null : (pages ?? []).find((p) => p.numero === n) ?? null);
  const L = 4 * k; // longueur des traits de coupe (4 mm)
  const e = (plan.fonds_perdus_mm + 1) * k; // écart des traits (fonds perdus + 1 mm)
  return (
    <figure className="imp-schema" style={{ width: largeur }}>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} width={largeur} height={hauteur} role="img" aria-label={titre ?? `Feuille ${W} × ${H} mm, ${face.cote}`}>
        <rect x={0} y={0} width={largeur} height={hauteur} className="imp-schema__feuille" />
        {face.poses.map((q, i) => {
          const x = q.x * k;
          const y = yS(q.y, q.hauteur);
          const w = q.largeur * k;
          const h = q.hauteur * k;
          const vide = q.page === null;
          const pg = pageDe(q.page);
          const fontSize = Math.max(8, Math.min(16, Math.min(w, h) / 3));
          return (
            <g key={i} className="imp-schema__pose" data-vide={vide || undefined}>
              {affichage.fonds && fp > 0 && <rect x={x - fp} y={y - fp} width={w + 2 * fp} height={h + 2 * fp} className="imp-schema__fonds-fond" />}
              {pg ? <Visuel pg={pg} x={x} y={y} w={w} h={h} fp={fp} methode={methode} sourceAvecFonds={sourceAvecFonds} i={i} afficherFonds={affichage.fonds} unis={unisDe?.(pg.numero) ?? null} /> : <rect x={x} y={y} width={w} height={h} className="imp-schema__fini" />}
              {affichage.fonds && fp > 0 && <rect x={x - fp} y={y - fp} width={w + 2 * fp} height={h + 2 * fp} className="imp-schema__fonds" />}
              {affichage.zone_finie && <rect x={x} y={y} width={w} height={h} className="imp-schema__trait-fini" />}
              {affichage.numeros && (!pg || q.numero) && (
                <text x={x + w / 2} y={pg ? y + h - fontSize * 0.6 : y + h / 2} className="imp-schema__texte" fontSize={fontSize} textAnchor="middle" dominantBaseline="central" style={pg ? { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 } : undefined}>
                  {vide ? '—' : q.numero ?? `p.${q.page}`}
                </text>
              )}
              {affichage.traits && plan.operation !== 'assembler' && (
                <g className="imp-schema__traits">
                  {[x, x + w].map((cx) => (
                    <g key={`v${cx}`}>
                      <line x1={cx} y1={y - e} x2={cx} y2={y - e - L} />
                      <line x1={cx} y1={y + h + e} x2={cx} y2={y + h + e + L} />
                    </g>
                  ))}
                  {[y, y + h].map((cy) => (
                    <g key={`h${cy}`}>
                      <line x1={x - e} y1={cy} x2={x - e - L} y2={cy} />
                      <line x1={x + w + e} y1={cy} x2={x + w + e + L} y2={cy} />
                    </g>
                  ))}
                </g>
              )}
            </g>
          );
        })}
        {face.plis.map((p, i) => (
          <line key={i} x1={p * k} y1={0} x2={p * k} y2={hauteur} className="imp-schema__pli" />
        ))}
      </svg>
      <figcaption>
        {titre ?? (face.cote === 'recto' ? 'Recto' : 'Verso')} · {W} × {H} mm
      </figcaption>
    </figure>
  );
}
