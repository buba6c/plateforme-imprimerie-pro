// Repérage des planches : des PDF de brochures arrivent souvent « en planches » (deux pages côte à
// côte sur chaque page du PDF : export InDesign en planches, maquettes Canva en double page). Il faut
// alors couper chaque page double en deux avant d'imposer. Le repérage ne fait que proposer ; la
// séparation se fait à l'assemblage (sources.ts), à la demande.
//  - « forte » : le document mélange pages simples et pages deux fois plus larges (couverture seule,
//    puis 2-3, 4-5…), ou la page n'est pas un format connu alors que sa moitié en est un ;
//  - « possible » : la page et sa moitié sont toutes deux des formats connus (un A4 paysage peut être
//    une page A4 à l'italienne ou deux A5) : seule la personne qui connaît le travail peut trancher.

import type { AnalysePdf } from './analyse';
import { detecterFormat, FORMATS_FINIS } from './formats';
import { pagesDoubles } from './sources';

export interface DetectionPlanches {
  confiance: 'forte' | 'possible';
  /** Pages doubles dans le document. */
  pages_doubles: number;
  /** Format d'une page une fois la planche coupée, s'il est reconnu. */
  format_page: string | null;
  /** Une page simple suivie de planches : couverture seule (export InDesign). */
  couverture_seule: boolean;
}

/** Format de page reconnu pour une moitié de planche, avec ou sans fonds perdus autour de la planche. */
function formatMoitie(largeur: number, hauteur: number): string | null {
  for (const fp of [0, 3, 2, 5]) {
    for (const f of FORMATS_FINIS) {
      if (f.famille !== 'page' && f.famille !== 'flyer') continue;
      if (Math.abs(largeur - (2 * f.largeur + 2 * fp)) <= 2 && Math.abs(hauteur - (f.hauteur + 2 * fp)) <= 2) return f.libelle;
    }
  }
  return null;
}

export function detecterPlanches(a: AnalysePdf): DetectionPlanches | null {
  if (a.nb_pages < 1) return null;
  const dims = a.pages.map((p) => ({ w: p.trim?.largeur ?? p.largeur, h: p.trim?.hauteur ?? p.hauteur, rotation: 0 }));
  const doubles = pagesDoubles(dims);
  const n = doubles.filter(Boolean).length;
  if (!n) return null;
  const premiere = dims[doubles.indexOf(true)]!;
  const formatPage = formatMoitie(premiere.w, premiere.h);
  const mixte = n < dims.length;
  const pleinConnu = !!detecterFormat(premiere.w, premiere.h);
  // Une page en paysage n'est une planche que si sa moitié est un format de page plausible : une carte
  // de visite ou un flyer en paysage ne sont pas des planches.
  let confiance: DetectionPlanches['confiance'] | null = null;
  if (mixte) confiance = 'forte';
  else if (formatPage && !pleinConnu) confiance = 'forte';
  else if (formatPage) confiance = 'possible';
  if (!confiance) return null;
  return { confiance, pages_doubles: n, format_page: formatPage, couverture_seule: mixte && !doubles[0] };
}
