// Réglages automatiques : quand on choisit une opération, les réglages se calculent d'après le fichier
// (format reconnu, fonds perdus présents ou non, visuel au bord, nombre de pages, recto/verso séparés).
// La personne n'a plus qu'à vérifier la feuille ; tout reste modifiable.
import type { AnalysePdf, Feuille, Operation, ParamsImposition, ReponseAnalyse } from './types';

const FEUILLES: { code: Feuille; largeur: number; hauteur: number }[] = [
  { code: 'a4', largeur: 210, hauteur: 297 },
  { code: 'sra4', largeur: 225, hauteur: 320 },
  { code: 'a3', largeur: 297, hauteur: 420 },
  { code: 'sra3', largeur: 320, hauteur: 450 },
  { code: 'a3_plus', largeur: 329, hauteur: 483 },
  { code: 'banniere_330', largeur: 330, hauteur: 660 },
];

const tient = (fw: number, fh: number, w: number, h: number) => (fw >= w && fh >= h) || (fw >= h && fh >= w);

/** Fonds perdus : ceux du fichier s'il en a, sinon miroir si le visuel touche le bord, sinon blanc. */
export function fondsAuto(a: AnalysePdf): Pick<ParamsImposition, 'fonds_perdus_mm' | 'methode_fonds_perdus'> {
  if (a.fonds_perdus !== 'absents') return { fonds_perdus_mm: a.fonds_perdus_mm || 3, methode_fonds_perdus: 'source' };
  const touche = a.pages.some((p) => p.jusqu_au_bord === true);
  const inconnu = a.pages.every((p) => p.jusqu_au_bord === null);
  return touche || inconnu ? { fonds_perdus_mm: 3, methode_fonds_perdus: 'miroir' } : { fonds_perdus_mm: 3, methode_fonds_perdus: 'blanc' };
}

/** Livret : la plus petite feuille qui loge deux pages côte à côte avec fonds perdus et traits (A5 → SRA4, A4 → SRA3). */
export function feuilleLivret(fini: { largeur: number; hauteur: number }, fonds: number): Feuille {
  const w = 2 * fini.largeur + 2 * fonds + 16;
  const h = fini.hauteur + 2 * fonds + 16;
  return FEUILLES.find((f) => tient(f.largeur, f.hauteur, w, h))?.code ?? FEUILLES.find((f) => tient(f.largeur, f.hauteur, 2 * fini.largeur, fini.hauteur))?.code ?? 'sra3';
}

/** Poses : SRA3 (feuille de la Xerox) sauf si le format fini n'y tient pas. */
export function feuillePoses(fini: { largeur: number; hauteur: number }, fonds: number): Feuille {
  const w = fini.largeur + 2 * fonds + 20;
  const h = fini.hauteur + 2 * fonds + 20;
  if (tient(320, 450, w, h)) return 'sra3';
  return FEUILLES.find((f) => tient(f.largeur, f.hauteur, w, h))?.code ?? 'personnalisee';
}

/** Réglages complets pour une opération, d'après l'analyse et les réglages en cours. */
export function reglagesPour(op: Operation, r: ReponseAnalyse, courant: ParamsImposition): ParamsImposition {
  const a = r.analyse;
  const fini = courant.fini?.largeur ? courant.fini : a.fini;
  const fonds = fondsAuto(a);
  const paires = r.paires?.filter((x) => x.verso !== null).length ?? 0;
  const nbVisuels = r.paires ? r.paires.length : a.nb_pages;
  const famille = a.format?.famille;
  const base: ParamsImposition = { ...courant, operation: op, fini, ...fonds, orientation: 'auto', gouttiere_mm: 0, traits_de_coupe: true };
  if (op === 'livret') {
    return { ...base, feuille: feuilleLivret(fini, fonds.fonds_perdus_mm), recto_verso: true, mode: 'sequence', marge_mm: 5, blanches: a.nb_pages % 4 === 0 ? 'fin' : 'avant_derniere', chasse_mm: a.nb_pages > 40 ? Math.round((a.nb_pages / 4) * 0.1 * 10) / 10 : 0, numerotation: null };
  }
  if (op === 'fonds_perdus') {
    return { ...base, methode_fonds_perdus: fonds.methode_fonds_perdus === 'blanc' ? 'miroir' : fonds.methode_fonds_perdus, recto_verso: false, numerotation: null };
  }
  if (op === 'assembler') {
    return { ...base, recto_verso: false, numerotation: null };
  }
  // Poses
  const rv = paires > 0 || (r.paires === null && a.nb_pages === 2);
  const ticket = famille === 'ticket';
  const mode = ticket ? 'coupe_empile' : nbVisuels > (rv ? 1 : 1) && !(r.paires === null && a.nb_pages === 2) ? 'sequence' : 'repetition';
  return {
    ...base,
    feuille: feuillePoses(fini, fonds.fonds_perdus_mm),
    marge_mm: 10,
    recto_verso: rv,
    retournement: 'bord_long',
    mode,
    numerotation: ticket ? (courant.numerotation ?? { debut: 1, chiffres: 4, prefixe: 'N° ', position: 'bas_droite', taille_pt: 11, verso: false }) : null,
  };
}

/** Explication courte de ce que le réglage automatique a choisi. */
export function resumeAuto(p: ParamsImposition): string {
  const feuille = p.feuille === 'personnalisee' ? 'feuille personnalisée' : p.feuille.toUpperCase().replace('_PLUS', '+').replace('BANNIERE_330', 'bannière 330 × 660');
  const fonds = p.methode_fonds_perdus === 'source' ? `fonds perdus du fichier (${p.fonds_perdus_mm} mm)` : p.methode_fonds_perdus === 'miroir' ? `fonds perdus générés en miroir (${p.fonds_perdus_mm} mm)` : p.methode_fonds_perdus === 'etirer' ? 'fonds perdus par étirement' : 'sans fonds perdus (marge blanche)';
  if (p.operation === 'livret') return `Livret sur ${feuille}, recto-verso, ${fonds}.`;
  if (p.operation === 'fonds_perdus') return `Une page par page, ${fonds}, traits de coupe.`;
  if (p.operation === 'assembler') return 'Pièces réunies dans l’ordre, pages inchangées.';
  const mode = p.mode === 'repetition' ? 'même visuel sur toutes les poses' : p.mode === 'sequence' ? 'visuels à la suite' : 'coupe & empile';
  return `${feuille}, ${mode}${p.recto_verso ? ', recto-verso' : ''}, ${fonds}${p.numerotation ? ', numérotation' : ''}.`;
}
