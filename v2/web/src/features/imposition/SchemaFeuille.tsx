// La feuille imposée, à l'échelle, avec le vrai visuel de chaque page dans sa pose (aperçu rendu par le
// serveur). Les fonds perdus sont dessinés en temps réel selon la méthode choisie : ceux du fichier,
// miroir des bords (bandes retournées), étirement, ou blanc. Les traits de coupe, lignes de pli et
// textes sont ceux que le plan a calculés (reperes.ts côté serveur) : l'écran montre exactement le PDF.
// Une pose tournée est dessinée droite dans un repère tourné autour de son emprise.
import { useId, useState } from 'react';
import { useApercuPage, type Cadre } from './rendu';
import type { Adaptation, Dimension, Face, MethodeFondsPerdus, PageVirtuelle, Plan } from './types';

/**
 * Cadre de la page rendue (fractions, origine haut-gauche) qui correspond au format fini, d'après la
 * mise au format : le visuel est centré dans la page ; le format fini (plus les fonds perdus pris dans
 * le fichier) est divisé par l'échelle. Même calcul que le moteur (ajuster.ts, cadreSource).
 */
export function cadrePage(dims: Dimension, fini: Dimension, a: Adaptation | null | undefined, fondsMm: number): Cadre {
  const pivote = !!a?.pivote;
  const PW = pivote ? dims.hauteur : dims.largeur;
  const PH = pivote ? dims.largeur : dims.hauteur;
  const ex = a?.echelle_x || 1;
  const ey = a?.echelle_y || 1;
  const w = (fini.largeur + 2 * fondsMm) / ex;
  const h = (fini.hauteur + 2 * fondsMm) / ey;
  return { rotation: pivote ? 90 : 0, x: (PW - w) / 2 / PW, y: (PH - h) / 2 / PH, w: w / PW, h: h / PH };
}

export interface AffichageSchema {
  fonds: boolean;
  traits: boolean;
  zone_finie: boolean;
  numeros: boolean;
  /** Hachures de la chute entre les poses (double coupe) et du bord non imprimable. */
  chute?: boolean;
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

function Visuel({ pg, x, y, w, h, fp, methode, sourceAvecFonds, id, afficherFonds, unis, cadre }: { pg: PageVirtuelle; x: number; y: number; w: number; h: number; fp: number; methode: MethodeFondsPerdus; sourceAvecFonds: boolean; id: string; afficherFonds: boolean; unis?: { haut: boolean; bas: boolean; gauche: boolean; droite: boolean } | null; cadre?: Cadre }) {
  const [ko, setKo] = useState(false);
  const rendu = useApercuPage({ fichier_id: pg.libre ? undefined : pg.fichier_id, libre: pg.libre, page: pg.page_source, genre: pg.genre, demi: pg.demi, cadre }, 360);
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
  dimsDe,
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
  /** Taille (mm) de chaque page du document (analyse) : l'aperçu est alors recadré au format fini, mise au format comprise. */
  dimsDe?: (numero: number) => Dimension | null;
  affichage?: AffichageSchema;
}) {
  const W = plan.feuille.largeur;
  const H = plan.feuille.hauteur;
  const k = largeur / W;
  const hauteur = Math.round(H * k);
  const fp = plan.fonds_perdus_mm * k;
  const yS = (yMm: number, hMm: number) => (H - yMm - hMm) * k;
  const yP = (yMm: number) => (H - yMm) * k;
  const gouttiere = Math.max(0, plan.gouttiere_mm ?? 0) * k;
  const marge = Math.max(0, plan.marge_mm ?? 0) * k;
  const pageDe = (n: number | null) => (n === null ? null : (pages ?? []).find((p) => p.numero === n) ?? null);
  const avecFondsSource = methode === 'source' && sourceAvecFonds;
  const cadreDe = (n: number): Cadre | undefined => {
    const d = dimsDe?.(n);
    return d && d.largeur > 0 && d.hauteur > 0 ? cadrePage(d, plan.fini, plan.adaptation, avecFondsSource ? plan.fonds_perdus_mm : 0) : undefined;
  };
  // Identifiants des découpes propres à ce schéma : plusieurs feuilles s'affichent sur la même page.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const chuteId = `${uid}-chute`;
  return (
    <figure className="imp-schema" style={{ width: largeur }}>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} width={largeur} height={hauteur} role="img" aria-label={titre ?? `Feuille ${W} × ${H} mm, ${face.cote}`}>
        <defs>
          <pattern id={chuteId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="imp-schema__hachure" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={largeur} height={hauteur} className="imp-schema__feuille" />
        {affichage.chute && marge > 0 && (
          <path d={`M0 0H${largeur}V${hauteur}H0Z M${marge} ${marge}H${largeur - marge}V${hauteur - marge}H${marge}Z`} fillRule="evenodd" fill={`url(#${chuteId})`} className="imp-schema__chute" />
        )}
        {face.poses.map((q, i) => {
          const theta = q.rotation ?? 0;
          const tourne = theta === 90 || theta === 270;
          // Emprise de la pose sur la feuille, puis contenu droit centré dans un repère tourné.
          const bw = (tourne ? q.hauteur : q.largeur) * k;
          const bh = (tourne ? q.largeur : q.hauteur) * k;
          const bx = q.x * k;
          const byS = yS(q.y, tourne ? q.largeur : q.hauteur);
          const cx = bx + bw / 2;
          const cy = byS + bh / 2;
          const w = q.largeur * k;
          const h = q.hauteur * k;
          const x = cx - w / 2;
          const y = cy - h / 2;
          const vide = q.page === null;
          const pg = pageDe(q.page);
          const fontSize = Math.max(8, Math.min(16, Math.min(w, h) / 3));
          // Côtés sans fonds perdus : pli d'un livret (coupé au pli, chasse comprise) ou côtés joints à une voisine.
          let cx1 = x - fp - 4, cx2 = x + w + fp + 4, cy1 = y - fp - 4, cy2 = y + h + fp + 4;
          let restreint = false;
          if (q.pli === 'droite' || q.pli === 'gauche') {
            const pli = (q.pli === 'droite' ? x + w : x) - (q.decalage_x ?? 0) * k;
            if (q.pli === 'droite') cx2 = pli;
            else cx1 = pli;
            restreint = true;
          } else if (q.pli === 'bas' || q.pli === 'haut') {
            // Pli horizontal (relié en haut) ; en SVG, y descend : le pli « bas » d'une pose est sous elle.
            if (q.pli === 'bas') cy2 = y + h + (q.decalage_y ?? 0) * k;
            else cy1 = y + (q.decalage_y ?? 0) * k;
            restreint = true;
          }
          for (const c of q.joints ?? []) {
            if (c === 'gauche' && q.pli !== 'gauche') cx1 = x;
            if (c === 'droite' && q.pli !== 'droite') cx2 = x + w;
            // En SVG, y descend : « haut » de la pose = petit y.
            if (c === 'haut' && q.pli !== 'haut') cy1 = y;
            if (c === 'bas' && q.pli !== 'bas') cy2 = y + h;
            restreint = true;
          }
          const clipJoints = restreint ? `${uid}-joints-${i}` : undefined;
          const transform = theta ? `rotate(${-theta} ${cx} ${cy})` : undefined;
          return (
            <g key={i} className="imp-schema__pose" data-vide={vide || undefined} transform={transform} clipPath={clipJoints ? `url(#${clipJoints})` : undefined}>
              {clipJoints && (
                <defs>
                  <clipPath id={clipJoints}>
                    <rect x={cx1} y={cy1} width={cx2 - cx1} height={cy2 - cy1} />
                  </clipPath>
                </defs>
              )}
              {affichage.fonds && fp > 0 && <rect x={x - fp} y={y - fp} width={w + 2 * fp} height={h + 2 * fp} className="imp-schema__fonds-fond" />}
              {pg ? <Visuel pg={pg} x={x} y={y} w={w} h={h} fp={fp} methode={methode} sourceAvecFonds={sourceAvecFonds} id={`${uid}-p${i}-${pg.numero}`} afficherFonds={affichage.fonds} unis={unisDe?.(pg.numero) ?? null} cadre={cadreDe(pg.numero)} /> : <rect x={x} y={y} width={w} height={h} className="imp-schema__fini" />}
              {vide && plan.operation === 'livret' && !affichage.numeros && (
                <text x={x + w / 2} y={y + h / 2} className="imp-schema__blanche" fontSize={Math.max(8, Math.min(14, w / 10))} textAnchor="middle" dominantBaseline="central">Page blanche</text>
              )}
              {affichage.fonds && fp > 0 && <rect x={x - fp} y={y - fp} width={w + 2 * fp} height={h + 2 * fp} className="imp-schema__fonds" />}
              {affichage.zone_finie && <rect x={x} y={y} width={w} height={h} className="imp-schema__trait-fini" />}
              {affichage.numeros && (!pg || q.numero) && (
                <text x={x + w / 2} y={pg ? y + h - fontSize * 0.6 : y + h / 2} className="imp-schema__texte" fontSize={fontSize} textAnchor="middle" dominantBaseline="central" style={pg ? { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 } : undefined}>
                  {vide ? '—' : q.numero ?? `p.${q.page}`}
                </text>
              )}
            </g>
          );
        })}
        {affichage.chute && gouttiere > 0 && face.poses.length > 1 && (() => {
          // Chute entre les poses : le bloc hachuré moins les poses (fonds perdus compris).
          const pleines = face.poses.filter((q) => q.page !== null || face.poses.length === 1);
          if (!pleines.length) return null;
          const boites = pleines.map((q) => { const t = q.rotation === 90 || q.rotation === 270; const bw = (t ? q.hauteur : q.largeur) * k; const bh = (t ? q.largeur : q.hauteur) * k; return { x: q.x * k - fp, y: yS(q.y, t ? q.largeur : q.hauteur) - fp, w: bw + 2 * fp, h: bh + 2 * fp }; });
          const minX = Math.min(...boites.map((b) => b.x)), minY = Math.min(...boites.map((b) => b.y)), maxX = Math.max(...boites.map((b) => b.x + b.w)), maxY = Math.max(...boites.map((b) => b.y + b.h));
          const d = `M${minX} ${minY}H${maxX}V${maxY}H${minX}Z ` + boites.map((b) => `M${b.x} ${b.y}H${b.x + b.w}V${b.y + b.h}H${b.x}Z`).join(' ');
          return <path d={d} fillRule="evenodd" fill={`url(#${chuteId})`} className="imp-schema__chute" />;
        })()}
        {affichage.traits && (
          <g className="imp-schema__traits">
            {(face.traits ?? []).map((t, i) => (
              <line key={`t${i}`} x1={t.x1 * k} y1={yP(t.y1)} x2={t.x2 * k} y2={yP(t.y2)} style={t.epaisseur ? { strokeWidth: t.epaisseur } : undefined} />
            ))}
            {(face.lignes ?? []).map((l, i) =>
              l.axe === 'x' ? (
                <line key={`l${i}`} x1={l.pos * k} y1={yP(l.de)} x2={l.pos * k} y2={yP(l.a)} className={`imp-schema__${l.genre}`} />
              ) : (
                <line key={`l${i}`} x1={l.de * k} y1={yP(l.pos)} x2={l.a * k} y2={yP(l.pos)} className={`imp-schema__${l.genre}`} />
              ),
            )}
            {(face.marques ?? []).map((m, i) => (
              <rect key={`m${i}`} x={m.x * k} y={yS(m.y, m.hauteur)} width={m.largeur * k} height={m.hauteur * k} className="imp-schema__marque" />
            ))}
            {(face.textes ?? []).map((t, i) => (
              <text key={`x${i}`} x={t.x * k} y={yP(t.y)} fontSize={(t.taille_pt * k * 25.4) / 72} className="imp-schema__texte-repere" textAnchor={t.ancre === 'centre' ? 'middle' : t.ancre === 'droite' ? 'end' : 'start'} fontWeight={t.gras ? 700 : 400} transform={t.rotation ? `rotate(${-t.rotation} ${t.x * k} ${yP(t.y)})` : undefined}>
                {t.texte}
              </text>
            ))}
          </g>
        )}
      </svg>
      <figcaption>
        {titre ?? (face.cote === 'recto' ? 'Recto' : 'Verso')} · {W} × {H} mm
      </figcaption>
    </figure>
  );
}
