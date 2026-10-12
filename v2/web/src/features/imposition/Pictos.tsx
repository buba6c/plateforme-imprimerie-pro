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
export function PictoFondsPerdus({ methode }: { methode: 'source' | 'miroir' | 'etirer' | 'blanc' }) {
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
export function PictoOperation({ op }: { op: 'poses' | 'livret' | 'fonds_perdus' | 'assembler' }) {
  if (op === 'assembler') return <svg {...base}><rect x="4" y="8" width="12" height="16" rx="1" fill="currentColor" fillOpacity="0.3" /><rect x="18" y="8" width="12" height="16" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M32 16h5" /><path d="M35 13l3 3-3 3" /><rect x="39" y="6" width="6" height="20" rx="1" fill="currentColor" fillOpacity="0.35" /><path d="M39 11h6M39 16h6M39 21h6" strokeWidth="1" /></svg>;
  if (op === 'poses') return <svg {...base}><rect x="4" y="3" width="40" height="30" rx="2" fill="currentColor" fillOpacity="0.06" />{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={7 + (i % 4) * 9.5} y={6 + Math.floor(i / 4) * 12.5} width="7.5" height="10" rx="1" fill="currentColor" fillOpacity="0.3" />)}</svg>;
  if (op === 'livret') return <svg {...base}><path d="M24 5v26" strokeDasharray="3 2" /><rect x="5" y="5" width="19" height="26" rx="1" fill="currentColor" fillOpacity="0.25" /><rect x="24" y="5" width="19" height="26" rx="1" fill="currentColor" fillOpacity="0.15" /><text x="14" y="21" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">8</text><text x="33" y="21" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">1</text></svg>;
  return <svg {...base}><rect x="8" y="4" width="32" height="28" rx="1" strokeDasharray="3 2" /><rect x="14" y="9" width="20" height="18" fill="currentColor" fillOpacity="0.3" /><path d="M14 3v3M34 3v3M14 33v-3M34 33v-3M5 9h3M5 27h3M43 9h-3M43 27h-3" strokeWidth="1.2" /></svg>;
}
