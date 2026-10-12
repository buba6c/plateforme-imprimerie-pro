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
  return touche || inconnu ? { fonds_perdus_mm: 3, methode_fonds_perdus: 'intelligent' } : { fonds_perdus_mm: 3, methode_fonds_perdus: 'blanc' };
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
    // Brochure : piqûre jusqu'à 64 pages (au-delà, le dos ne ferme plus), sinon dos carré collé en
    // cahiers de 4 feuilles. Chasse seulement en piqûre (≈ 0,1 mm par feuille au-delà de 40 pages).
    const nb = r.paires ? r.paires.reduce((t, x) => t + (x.verso !== null ? 2 : 1), 0) : a.nb_pages;
    const dosCarre = nb > 64;
    return {
      ...base,
      feuille: feuilleLivret(fini, fonds.fonds_perdus_mm),
      recto_verso: true,
      mode: 'sequence',
      marge_mm: 5,
      reliure: dosCarre ? 'dos_carre' : 'piqure',
      cahier_feuilles: 4,
      couverture_separee: courant.couverture_separee ?? false,
      lecture: courant.lecture ?? 'gauche_droite',
      blanches: nb % 4 === 0 ? 'fin' : 'avant_derniere',
      chasse_mm: !dosCarre && nb > 40 ? Math.round((nb / 4) * 0.1 * 10) / 10 : 0,
      numerotation: null,
    };
  }
  if (op === 'fonds_perdus') {
    return { ...base, methode_fonds_perdus: fonds.methode_fonds_perdus === 'blanc' ? 'intelligent' : fonds.methode_fonds_perdus, recto_verso: false, numerotation: null };
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
  const fonds = p.methode_fonds_perdus === 'source' ? `fonds perdus du fichier (${p.fonds_perdus_mm} mm)` : p.methode_fonds_perdus === 'intelligent' ? `fonds perdus générés bord par bord (${p.fonds_perdus_mm} mm)` : p.methode_fonds_perdus === 'prolonger' ? `bords prolongés (${p.fonds_perdus_mm} mm)` : p.methode_fonds_perdus === 'miroir' ? `fonds perdus en miroir (${p.fonds_perdus_mm} mm)` : p.methode_fonds_perdus === 'etirer' ? 'fonds perdus par étirement' : 'sans fonds perdus (marge blanche)';
  if (p.operation === 'livret') return `Livret ${p.reliure === 'dos_carre' ? `dos carré collé (cahiers de ${p.cahier_feuilles ?? 4} feuilles)` : 'piqûre à cheval'} sur ${feuille}${p.couverture_separee ? ', couverture à part' : ''}${p.lecture === 'droite_gauche' ? ', lecture de droite à gauche' : ''}, ${fonds}.`;
  if (p.operation === 'fonds_perdus') return `Une page par page, ${fonds}, traits de coupe.`;
  if (p.operation === 'assembler') return 'Pièces réunies dans l’ordre, pages inchangées.';
  const mode = p.mode === 'repetition' ? 'même visuel sur toutes les poses' : p.mode === 'sequence' ? 'visuels à la suite' : 'coupe & empile';
  return `${feuille}, ${mode}${p.recto_verso ? ', recto-verso' : ''}, ${fonds}${p.numerotation ? ', numérotation' : ''}.`;
}

const RECTO_RE = /(^|[^a-z])(recto|face|avant|front|devant|r)([^a-z]|$)|(^|[^0-9])1([^0-9]|$)/i;
const VERSO_RE = /(^|[^a-z])(verso|dos|arriere|arrière|back|derriere|derrière|v)([^a-z]|$)|(^|[^0-9])2([^0-9]|$)/i;

/**
 * Rôles déduits des fichiers : deux fichiers d'une page de même format = un recto et un verso
 * (d'après leur nom s'il le dit, sinon dans l'ordre). Les rôles choisis à la main ne sont jamais touchés.
 */
export function rolesAuto<T extends { cle: string; nom: string; role: 'recto' | 'verso' | 'pages'; roleAuto?: boolean; genre: 'pdf' | 'image' }>(
  pieces: T[],
  pagesDe: (p: T) => { pages: number; largeur: number | null; hauteur: number | null } | undefined,
): T[] | null {
  const libres = pieces.filter((p) => p.role === 'pages' || p.roleAuto);
  if (libres.length !== pieces.length || pieces.length !== 2) {
    // Plus de deux fichiers : on n'appaire que si les noms le disent clairement.
    if (pieces.length > 2 && pieces.every((p) => p.role === 'pages' || p.roleAuto)) {
      const nom = (p: T) => p.nom.replace(/\.[a-z0-9]+$/i, '');
      const rectos = pieces.filter((p) => /recto|face|front|avant/i.test(nom(p)));
      const versos = pieces.filter((p) => /verso|dos|back|arri/i.test(nom(p)));
      if (rectos.length && rectos.length === versos.length && rectos.length + versos.length === pieces.length) {
        return pieces.map((p) => ({ ...p, role: rectos.includes(p) ? 'recto' : 'verso', roleAuto: true }));
      }
    }
    return null;
  }
  const [a, b] = pieces as [T, T];
  const ia = pagesDe(a);
  const ib = pagesDe(b);
  if (!ia || !ib || ia.pages !== 1 || ib.pages !== 1) return null;
  if (ia.largeur && ib.largeur && ia.hauteur && ib.hauteur) {
    const meme = (Math.abs(ia.largeur - ib.largeur) < 2 && Math.abs(ia.hauteur - ib.hauteur) < 2) || (Math.abs(ia.largeur - ib.hauteur) < 2 && Math.abs(ia.hauteur - ib.largeur) < 2);
    if (!meme) return null;
  }
  const na = a.nom.replace(/\.[a-z0-9]+$/i, '');
  const nb = b.nom.replace(/\.[a-z0-9]+$/i, '');
  const aVerso = VERSO_RE.test(na) && !RECTO_RE.test(na);
  const bRecto = RECTO_RE.test(nb) && !VERSO_RE.test(nb);
  const [recto, verso] = aVerso || bRecto ? [b, a] : [a, b];
  if (recto.role === 'recto' && verso.role === 'verso') return null;
  return pieces.map((p) => ({ ...p, role: p === recto ? 'recto' : 'verso', roleAuto: true }));
}
