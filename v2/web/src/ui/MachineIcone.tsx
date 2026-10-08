// Petites illustrations des deux machines de l'atelier, dessinées au trait (couleur du texte courant).
// Roland : traceur grand format sur pieds, rouleau en haut, bâche qui sort devant.
// Xerox : presse numérique, scanner en haut, tiroirs à papier, bac de sortie sur le côté.
import type { Machine } from '@evocom/shared';

export function MachineIcone({ machine, taille = 18, className }: { machine: Machine; taille?: number; className?: string }) {
  const commun = {
    width: taille * (32 / 24),
    height: taille,
    viewBox: '0 0 32 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  };
  if (machine === 'roland') {
    return (
      <svg {...commun}>
        <rect x="2.5" y="5" width="27" height="7.5" rx="2" />
        <path d="M6 5V3.5h20V5" />
        <path d="M24.5 8.2h2.5" />
        <path d="M9 12.5v4.5l2.5 1.5h9l2.5-1.5v-4.5" fill="currentColor" fillOpacity="0.18" />
        <path d="M6 12.5 4.5 21.5M26 12.5l1.5 9M3 21.5h3.5M25.5 21.5H29" />
      </svg>
    );
  }
  return (
    <svg {...commun}>
      <rect x="7" y="3" width="18" height="3.5" rx="1" />
      <rect x="6" y="6.5" width="20" height="15" rx="2" />
      <path d="M6 13.5h20M6 17.5h20" />
      <path d="M14 15.5h4M14 19.5h4" />
      <rect x="20" y="8.5" width="3.5" height="2.5" rx="0.6" fill="currentColor" fillOpacity="0.25" />
      <path d="M6 9.5H2.5l1.5 3H6" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}
