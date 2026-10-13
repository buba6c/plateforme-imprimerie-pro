// Pictogrammes des options d'imposition : chaque choix a son dessin, pour comprendre d'un coup d'œil.
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = { viewBox: '0 0 48 36', width: 48, height: 36, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

/** Feuille portrait / paysage / automatique. */
export function PictoOrientation({ sens }: { sens: 'portrait' | 'paysage' | 'auto' }) {
  if (sens === 'portrait') return <svg {...base}><rect x="16" y="3" width="16" height="30" rx="2" fill="currentColor" fillOpacity="0.12" /><path d="M20 8h8M20 12h8M20 16h5" /></svg>;
  if (sens === 'paysage') return <svg {...base}><rect x="6" y="8" width="36" height="20" rx="2" fill="currentColor" fillOpacity="0.12" /><path d="M11 14h14M11 18h14M11 22h9" /></svg>;
  return <svg {...base}><rect x="4" y="9" width="22" height="16" rx="2" fill="currentColor" fillOpacity="0.12" /><rect x="30" y="3" width="14" height="30" rx="2" fill="currentColor" fillOpacity="0.12" /><path d="M26 17h4" strokeDasharray="2 2" /></svg>;
}

/** Méthodes de fonds perdus. */
export function PictoFondsPerdus({ methode }: { methode: 'source' | 'intelligent' | 'prolonger' | 'miroir' | 'etirer' | 'blanc' }) {
  if (methode === 'intelligent') return <svg {...base}><rect x="13" y="9" width="22" height="18" fill="currentColor" fillOpacity="0.3" /><rect x="8" y="4" width="32" height="5" fill="currentColor" fillOpacity="0.15" /><rect x="8" y="27" width="32" height="5" fill="currentColor" fillOpacity="0.15" /><path d="M8 12l5 4-5 4M40 12l-5 4 5 4" fill="currentColor" fillOpacity="0.15" /><path d="M42 3l1.2 2.6L46 6.8l-2.8 1.2L42 11l-1.2-3L38 6.8l2.8-1.2z" fill="currentColor" stroke="none" /></svg>;
  if (methode === 'prolonger') return <svg {...base}><rect x="13" y="9" width="22" height="18" fill="currentColor" fillOpacity="0.3" /><rect x="8" y="4" width="32" height="28" fill="currentColor" fillOpacity="0.12" /><path d="M13 13H8M13 18H8M13 23H8M35 13h5M35 18h5M35 23h5M18 9V4M24 9V4M30 9V4M18 27v5M24 27v5M30 27v5" strokeWidth="1.2" /></svg>;
  if (methode === 'source') return <svg {...base}><rect x="8" y="4" width="32" height="28" rx="1" fill="currentColor" fillOpacity="0.08" strokeDasharray="3 2" /><rect x="13" y="9" width="22" height="18" fill="currentColor" fillOpacity="0.25" /><path d="M8 9h5M8 27h5M40 9h-5M40 27h-5" /></svg>;
  if (methode === 'miroir') return <svg {...base}><rect x="13" y="9" width="22" height="18" fill="currentColor" fillOpacity="0.3" /><path d="M8 9v18M40 9v18M13 4h22M13 32h22" strokeDasharray="3 2" /><path d="M8 12l5 4-5 4M40 12l-5 4 5 4" fill="currentColor" fillOpacity="0.15" /><path d="M16 4l4 5h8l4-5M16 32l4-5h8l4 5" fill="currentColor" fillOpacity="0.15" /></svg>;
  if (methode === 'etirer') return <svg {...base}><rect x="13" y="9" width="22" height="18" fill="currentColor" fillOpacity="0.15" strokeDasharray="3 2" /><rect x="8" y="4" width="32" height="28" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M24 4v-1M24 32v1M8 18h-1M40 18h1" /><path d="M13 9l-5-5M35 9l5-5M13 27l-5 5M35 27l5 5" /></svg>;
  return <svg {...base}><rect x="8" y="4" width="32" height="28" rx="1" fill="#fff" /><rect x="13" y="9" width="22" height="18" fill="currentColor" fillOpacity="0.3" /><path d="M8 4h32v28H8z" strokeDasharray="3 2" /></svg>;
}

/** Répartition des pages sur les poses. */
export function PictoMode({ mode }: { mode: 'repetition' | 'sequence' | 'coupe_empile' }) {
  const cases = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 6 + (i % 3) * 13, y: 5 + Math.floor(i / 3) * 14 }));
  if (mode === 'repetition') {
    return <svg {...base}>{cases.map((c, i) => <g key={i}><rect x={c.x} y={c.y} width="11" height="11" rx="1" fill="currentColor" fillOpacity="0.2" /><text x={c.x + 5.5} y={c.y + 8} fontSize="7" textAnchor="middle" fill="currentColor" stroke="none">A</text></g>)}</svg>;
  }
  if (mode === 'sequence') {
    return <svg {...base}>{cases.map((c, i) => <g key={i}><rect x={c.x} y={c.y} width="11" height="11" rx="1" fill="currentColor" fillOpacity="0.2" /><text x={c.x + 5.5} y={c.y + 8} fontSize="7" textAnchor="middle" fill="currentColor" stroke="none">{i + 1}</text></g>)}</svg>;
  }
  return <svg {...base}>{[0, 1, 2].map((i) => <g key={i}><rect x={5 + i * 14} y={6 + i * 2} width="11" height="22" rx="1" fill="currentColor" fillOpacity={0.12 + i * 0.1} /><text x={10.5 + i * 14} y={13 + i * 2} fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">{1 + i}</text><text x={10.5 + i * 14} y={24 + i * 2} fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">{4 + i}</text></g>)}<path d="M44 8v20" /><path d="M41 25l3 3 3-3" /></svg>;
}

/** Traits de coupe. */
export function PictoTraits({ actifs }: { actifs: boolean }) {
  return <svg {...base}><rect x="14" y="8" width="20" height="20" fill="currentColor" fillOpacity="0.18" />{actifs && <path d="M14 3v3M34 3v3M14 33v-3M34 33v-3M9 8h3M9 28h3M39 8h-3M39 28h-3" strokeWidth="1.4" />}</svg>;
}

/** Rôle d'une pièce. */
export function PictoRole({ role }: { role: 'recto' | 'verso' | 'pages' }) {
  if (role === 'recto') return <svg {...base} viewBox="0 0 48 36"><rect x="12" y="5" width="24" height="26" rx="2" fill="currentColor" fillOpacity="0.25" /><text x="24" y="22" fontSize="11" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">R</text></svg>;
  if (role === 'verso') return <svg {...base}><rect x="12" y="5" width="24" height="26" rx="2" fill="currentColor" fillOpacity="0.1" strokeDasharray="3 2" /><text x="24" y="22" fontSize="11" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">V</text></svg>;
  return <svg {...base}><rect x="6" y="7" width="18" height="24" rx="2" fill="currentColor" fillOpacity="0.2" /><rect x="24" y="5" width="18" height="24" rx="2" fill="currentColor" fillOpacity="0.2" /><path d="M10 13h10M10 17h10M28 11h10M28 15h10" /></svg>;
}

/** Opérations. */
export function PictoOperation({ op }: { op: 'poses' | 'livret' | 'fonds_perdus' | 'assembler' | 'depliant' }) {
  if (op === 'depliant') return <svg {...base}><path d="M6 6l12 3v22L6 28z" fill="currentColor" fillOpacity="0.3" /><path d="M18 9l12-3v22l-12 3z" fill="currentColor" fillOpacity="0.18" /><path d="M30 6l12 3v22l-12-3z" fill="currentColor" fillOpacity="0.3" /><path d="M18 9v22M30 6v22" strokeDasharray="2 2" /></svg>;
  if (op === 'assembler') return <svg {...base}><rect x="4" y="8" width="12" height="16" rx="1" fill="currentColor" fillOpacity="0.3" /><rect x="18" y="8" width="12" height="16" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M32 16h5" /><path d="M35 13l3 3-3 3" /><rect x="39" y="6" width="6" height="20" rx="1" fill="currentColor" fillOpacity="0.35" /><path d="M39 11h6M39 16h6M39 21h6" strokeWidth="1" /></svg>;
  if (op === 'poses') return <svg {...base}><rect x="4" y="3" width="40" height="30" rx="2" fill="currentColor" fillOpacity="0.06" />{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={7 + (i % 4) * 9.5} y={6 + Math.floor(i / 4) * 12.5} width="7.5" height="10" rx="1" fill="currentColor" fillOpacity="0.3" />)}</svg>;
  if (op === 'livret') return <svg {...base}><path d="M24 5v26" strokeDasharray="3 2" /><rect x="5" y="5" width="19" height="26" rx="1" fill="currentColor" fillOpacity="0.25" /><rect x="24" y="5" width="19" height="26" rx="1" fill="currentColor" fillOpacity="0.15" /><text x="14" y="21" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">8</text><text x="33" y="21" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">1</text></svg>;
  return <svg {...base}><rect x="8" y="4" width="32" height="28" rx="1" strokeDasharray="3 2" /><rect x="14" y="9" width="20" height="18" fill="currentColor" fillOpacity="0.3" /><path d="M14 3v3M34 3v3M14 33v-3M34 33v-3M5 9h3M5 27h3M43 9h-3M43 27h-3" strokeWidth="1.2" /></svg>;
}

/** Mise au format : visuel (trait plein) et format fini (pointillé). */
export function PictoAjustement({ mode }: { mode: 'auto' | 'centrer' | 'adapter' | 'remplir' | 'etirer' }) {
  const fini = <rect x="14" y="6" width="20" height="24" rx="1" strokeDasharray="3 2" />;
  if (mode === 'adapter') return <svg {...base}>{fini}<rect x="14" y="10" width="20" height="16" fill="currentColor" fillOpacity="0.3" /><path d="M14 6v4M34 6v4M14 26v4M34 26v4" strokeWidth="1" strokeOpacity="0.5" /></svg>;
  if (mode === 'remplir') return <svg {...base}>{fini}<rect x="9" y="6" width="30" height="24" fill="currentColor" fillOpacity="0.14" strokeOpacity="0.4" /><rect x="14" y="6" width="20" height="24" fill="currentColor" fillOpacity="0.25" stroke="none" /></svg>;
  if (mode === 'etirer') return <svg {...base}>{fini}<rect x="14" y="6" width="20" height="24" fill="currentColor" fillOpacity="0.3" stroke="none" /><path d="M8 18h3M37 18h3M24 2v2M24 32v2" /><path d="M9 15l-2 3 2 3M39 15l2 3-2 3" /></svg>;
  if (mode === 'centrer') return <svg {...base}>{fini}<rect x="10" y="9" width="28" height="18" fill="currentColor" fillOpacity="0.3" stroke="none" /><path d="M24 4v28M8 18h32" strokeWidth="0.8" strokeDasharray="2 2" /></svg>;
  return <svg {...base}>{fini}<rect x="14" y="9" width="20" height="18" fill="currentColor" fillOpacity="0.3" stroke="none" /><path d="M42 3l1.2 2.6L46 6.8l-2.8 1.2L42 11l-1.2-3L38 6.8l2.8-1.2z" fill="currentColor" stroke="none" /></svg>;
}

/** Planches : page double laissée telle quelle, séparée en deux, ou couverture à plat. */
export function PictoPlanches({ mode }: { mode: 'non' | 'simple' | 'couverture' }) {
  if (mode === 'non') return <svg {...base}><rect x="6" y="7" width="36" height="22" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M11 13h26M11 17h26M11 21h18" /></svg>;
  if (mode === 'simple') return <svg {...base}><rect x="6" y="7" width="17" height="22" rx="1" fill="currentColor" fillOpacity="0.25" /><rect x="25" y="7" width="17" height="22" rx="1" fill="currentColor" fillOpacity="0.25" /><path d="M24 4v28" strokeDasharray="3 2" /><text x="14.5" y="21" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">2</text><text x="33.5" y="21" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">3</text></svg>;
  return <svg {...base}><rect x="6" y="7" width="17" height="22" rx="1" fill="currentColor" fillOpacity="0.15" /><rect x="25" y="7" width="17" height="22" rx="1" fill="currentColor" fillOpacity="0.35" /><path d="M24 4v28" strokeDasharray="3 2" /><text x="14.5" y="21" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none">4e</text><text x="33.5" y="21" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none">1re</text></svg>;
}

/** Avec ou sans fonds perdus. */
export function PictoCoupe({ mode }: { mode: 'avec' | 'sans' }) {
  if (mode === 'avec') return <svg {...base}><rect x="9" y="5" width="30" height="26" fill="currentColor" fillOpacity="0.12" strokeDasharray="3 2" /><rect x="14" y="10" width="20" height="16" fill="currentColor" fillOpacity="0.35" stroke="none" /><rect x="14" y="10" width="20" height="16" /></svg>;
  return <svg {...base}><rect x="14" y="10" width="20" height="16" fill="currentColor" fillOpacity="0.35" /><path d="M14 4v3M34 4v3M14 32v-3M34 32v-3M8 10h3M8 26h3M40 10h-3M40 26h-3" strokeWidth="1.2" /></svg>;
}

/** Systèmes de coupe sans fonds perdus. */
export function PictoSystemeCoupe({ systeme }: { systeme: 'sans_auto' | 'franche' | 'double' | 'cadre' | 'aucune' }) {
  const poses = (gap: number, inset = 0) => [0, 1].map((i) => <rect key={i} x={8 + inset + i * (16 + gap)} y={8 + inset} width={16 - 2 * inset} height={20 - 2 * inset} fill="currentColor" fillOpacity="0.3" stroke="none" />);
  if (systeme === 'sans_auto') return <svg {...base}>{poses(0)}<path d="M24 5v26" strokeWidth="1.2" /><path d="M42 3l1.2 2.6L46 6.8l-2.8 1.2L42 11l-1.2-3L38 6.8l2.8-1.2z" fill="currentColor" stroke="none" /></svg>;
  if (systeme === 'franche') return <svg {...base}>{poses(0)}<path d="M24 4v4M24 28v4M4 8h4M4 28h4M44 8h-4M44 28h-4" strokeWidth="1.2" /></svg>;
  if (systeme === 'double') return <svg {...base}>{poses(6)}<path d="M8 8h16v20H8zM30 8h16v20H30z" fill="none" strokeWidth="0.8" strokeOpacity="0.5" /><path d="M24 4v4M30 4v4M24 28v4M30 28v4" strokeWidth="1.2" /><path d="M25 9l4 4M25 15l4 4M25 21l4 4" strokeWidth="0.8" strokeOpacity="0.6" /></svg>;
  if (systeme === 'cadre') return <svg {...base}><rect x="8" y="6" width="32" height="24" fill="#fff" /><rect x="12" y="10" width="24" height="16" fill="currentColor" fillOpacity="0.35" stroke="none" /><rect x="8" y="6" width="32" height="24" /></svg>;
  return <svg {...base}><rect x="10" y="4" width="28" height="28" fill="currentColor" fillOpacity="0.3" /><path d="M16 12h16M16 17h16M16 22h10" strokeOpacity="0.6" /></svg>;
}

/** Styles de traits de coupe. */
export function PictoTraitsStyle({ style }: { style: 'auto' | 'angles' | 'bloc' | 'bord_feuille' | 'traversants' | 'aucun' }) {
  const grille = [0, 1].flatMap((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={12 + c * 12} y={8 + r * 10} width="12" height="10" fill="currentColor" fillOpacity="0.25" stroke="none" />));
  const cadre = <rect x="4" y="3" width="40" height="30" rx="1" strokeOpacity="0.35" strokeWidth="0.8" />;
  if (style === 'aucun') return <svg {...base}>{cadre}{grille}</svg>;
  if (style === 'angles') return <svg {...base}>{cadre}{grille}<path d="M12 5v2M24 5v2M36 5v2M12 31v-2M24 31v-2M36 31v-2M7 8h2M7 18h2M7 28h2M41 8h-2M41 18h-2M41 28h-2M24 10v-1M24 26v1" strokeWidth="1.2" /></svg>;
  if (style === 'bloc') return <svg {...base}>{cadre}{grille}<path d="M12 4v3M24 4v3M36 4v3M12 32v-3M24 32v-3M36 32v-3M5 8h4M5 18h4M5 28h4M43 8h-4M43 18h-4M43 28h-4" strokeWidth="1.2" /></svg>;
  if (style === 'bord_feuille') return <svg {...base}>{cadre}{grille}<path d="M12 3v2M24 3v2M36 3v2M12 33v-2M24 33v-2M36 33v-2M4 8h2M4 18h2M4 28h2M44 8h-2M44 18h-2M44 28h-2" strokeWidth="1.4" /></svg>;
  if (style === 'traversants') return <svg {...base}>{cadre}{grille}<path d="M12 3v5M24 3v5M36 3v5M12 33v-5M24 33v-5M36 33v-5M4 8h8M4 18h8M4 28h8M44 8h-8M44 18h-8M44 28h-8" strokeWidth="1" /></svg>;
  return <svg {...base}>{cadre}{grille}<path d="M12 4v3M24 4v3M36 4v3M12 32v-3M24 32v-3M36 32v-3" strokeWidth="1.2" /><path d="M42 3l1.2 2.6L46 6.8l-2.8 1.2L42 11l-1.2-3L38 6.8l2.8-1.2z" fill="currentColor" stroke="none" /></svg>;
}

/** Rotation des poses : droites, tournées, auto (bande tournée). */
export function PictoRotationPoses({ mode }: { mode: 'aucune' | '90' | 'auto' | 'mixte' }) {
  // Auto : droites ou toutes tournées, un seul sens (deux poses droites, une tournée à part).
  if (mode === 'auto') return <svg {...base}>{[0, 1].map((i) => <rect key={i} x={6 + i * 12} y="6" width="10" height="24" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />)}<rect x="31" y="12" width="13" height="10" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" /></svg>;
  if (mode === 'aucune') return <svg {...base}>{[0, 1, 2].map((i) => <rect key={i} x={7 + i * 12} y="6" width="10" height="24" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />)}</svg>;
  if (mode === '90') return <svg {...base}>{[0, 1].map((i) => <rect key={i} x="7" y={6 + i * 13} width="34" height="11" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />)}</svg>;
  return <svg {...base}>{[0, 1, 2].map((i) => <rect key={i} x={5 + i * 11} y="4" width="9" height="16" rx="1" fill="currentColor" fillOpacity="0.3" stroke="none" />)}<rect x="5" y="22" width="31" height="9" rx="1" fill="currentColor" fillOpacity="0.5" stroke="none" /><path d="M42 3l1.2 2.6L46 6.8l-2.8 1.2L42 11l-1.2-3L38 6.8l2.8-1.2z" fill="currentColor" stroke="none" /></svg>;
}

/** Tête-bêche. */
export function PictoTeteBeche({ mode }: { mode: 'aucune' | 'colonnes' | 'rangs' | 'damier' }) {
  const tourne = (r: number, c: number) => (mode === 'colonnes' ? c % 2 === 1 : mode === 'rangs' ? r % 2 === 1 : mode === 'damier' ? (r + c) % 2 === 1 : false);
  return (
    <svg {...base}>
      {[0, 1].flatMap((r) => [0, 1, 2].map((c) => (
        <g key={`${r}${c}`}>
          <rect x={6 + c * 13} y={5 + r * 14} width="11" height="12" rx="1" fill="currentColor" fillOpacity="0.25" stroke="none" />
          <path d={tourne(r, c) ? `M${11.5 + c * 13} ${15 + r * 14}l-2.5-4h5z` : `M${11.5 + c * 13} ${7 + r * 14}l-2.5 4h5z`} fill="currentColor" stroke="none" />
        </g>
      )))}
    </svg>
  );
}

/** Calage de la grille. */
export function PictoCalage({ mode }: { mode: 'centre' | 'coin' }) {
  if (mode === 'centre') return <svg {...base}><rect x="4" y="3" width="40" height="30" rx="1" strokeOpacity="0.35" strokeWidth="0.8" /><rect x="14" y="10" width="20" height="16" fill="currentColor" fillOpacity="0.3" stroke="none" /><path d="M24 5v3M24 31v-3M6 18h3M42 18h-3" strokeWidth="0.8" strokeDasharray="1 1" /></svg>;
  return <svg {...base}><rect x="4" y="3" width="40" height="30" rx="1" strokeOpacity="0.35" strokeWidth="0.8" /><rect x="9" y="12" width="20" height="16" fill="currentColor" fillOpacity="0.3" stroke="none" /><path d="M4 33l5-5M9 28v5M9 28H4" strokeWidth="1" /><path d="M6 30.5l2-2" /></svg>;
}

/** Bord de retournement. */
export function PictoRetournement({ mode }: { mode: 'auto' | 'bord_long' | 'bord_court' }) {
  if (mode === 'bord_long') return <svg {...base}><rect x="12" y="4" width="20" height="28" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M34 10c6 2 6 14 0 16" /><path d="M35 23l-1 4-4-1" /></svg>;
  if (mode === 'bord_court') return <svg {...base}><rect x="12" y="4" width="20" height="28" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M16 2c4-4 12-4 16 0" transform="translate(0 2)" /><path d="M31 1l2 3-3 2" transform="translate(0 2)" /></svg>;
  return <svg {...base}><rect x="12" y="4" width="20" height="28" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M42 3l1.2 2.6L46 6.8l-2.8 1.2L42 11l-1.2-3L38 6.8l2.8-1.2z" fill="currentColor" stroke="none" /></svg>;
}

/** Types de pli, vus de dessus (volets en coupe). */
export function PictoPliage({ pliage }: { pliage: 'simple' | 'roule_3' | 'accordeon_3' | 'accordeon_4' | 'fenetre' | 'portefeuille' | 'parallele_double' | 'roule_4' | 'croise_8' | 'italienne' | 'chevalet' }) {
  const p = { ...base, strokeWidth: 2 };
  switch (pliage) {
    case 'simple':
      return <svg {...p}><path d="M8 28L24 8l16 20" /></svg>;
    case 'roule_3':
      return <svg {...p}><path d="M6 10h24c3 0 3 6 0 6H12c-3 0-3 6 0 6h22" /><path d="M6 10l-1 1" /></svg>;
    case 'accordeon_3':
      return <svg {...p}><path d="M5 26l12-16 12 16 12-16" /></svg>;
    case 'accordeon_4':
      return <svg {...p}><path d="M4 26l9-16 9 16 9-16 9 16" /></svg>;
    case 'fenetre':
      return <svg {...p}><path d="M6 24V14h10v10M42 24V14H32v10" /><path d="M16 14h16" /></svg>;
    case 'portefeuille':
      return <svg {...p}><path d="M8 24V14h8v10M40 24V14h-8v10" /><path d="M16 14h16" /><path d="M24 10v8" strokeDasharray="2 2" /></svg>;
    case 'parallele_double':
      return <svg {...p}><path d="M6 24h8V12h8v12h8V12h8v12" /></svg>;
    case 'roule_4':
      return <svg {...p}><path d="M6 8h28c3 0 3 6 0 6H14c-3 0-3 6 0 6h16c3 0 3 6 0 6H10" /></svg>;
    case 'croise_8':
      return <svg {...p}><rect x="10" y="4" width="28" height="28" fill="currentColor" fillOpacity="0.15" strokeWidth="1.4" /><path d="M24 4v28M10 18h28" strokeDasharray="3 2" strokeWidth="1.4" /></svg>;
    case 'italienne':
      return <svg {...p}><path d="M8 30h32" /><path d="M12 30l12-20 12 20" /></svg>;
    case 'chevalet':
      return <svg {...p}><path d="M10 30L24 8l14 22" /><path d="M14 30h20" strokeOpacity="0.5" /></svg>;
  }
}
