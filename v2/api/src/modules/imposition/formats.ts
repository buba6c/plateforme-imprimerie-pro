// Formats de l'imposition : feuilles d'impression, formats finis courants, conversions mm ↔ points.
// Tout le moteur travaille en millimètres ; pdf-lib en points (1 mm = 72/25,4 pt).

export const MM_PAR_PT = 25.4 / 72;
export const PT_PAR_MM = 72 / 25.4;
export const mm = (pt: number) => pt * MM_PAR_PT;
export const pt = (v: number) => v * PT_PAR_MM;

export interface Dimension {
  largeur: number;
  hauteur: number;
}

/** Feuilles d'impression (mm, en portrait ; l'orientation se choisit ensuite). */
export const FEUILLES = {
  sra3: { libelle: 'SRA3 (320 × 450 mm)', largeur: 320, hauteur: 450 },
  a3: { libelle: 'A3 (297 × 420 mm)', largeur: 297, hauteur: 420 },
  a3_plus: { libelle: 'A3+ (329 × 483 mm)', largeur: 329, hauteur: 483 },
  sra4: { libelle: 'SRA4 (225 × 320 mm)', largeur: 225, hauteur: 320 },
  a4: { libelle: 'A4 (210 × 297 mm)', largeur: 210, hauteur: 297 },
  a5: { libelle: 'A5 (148 × 210 mm)', largeur: 148, hauteur: 210 },
  banniere_330: { libelle: 'Bannière 330 × 660 mm', largeur: 330, hauteur: 660 },
  personnalisee: { libelle: 'Personnalisée', largeur: 0, hauteur: 0 },
} as const;
export type Feuille = keyof typeof FEUILLES;
export const CODES_FEUILLE = Object.keys(FEUILLES) as Feuille[];

/** Formats finis reconnus à l'analyse (mm). Tolérance : 1,5 mm par côté, avec ou sans 3 mm de fonds perdus. */
export const FORMATS_FINIS: { code: string; libelle: string; largeur: number; hauteur: number; famille: 'carte' | 'page' | 'flyer' | 'ticket' | 'enveloppe' }[] = [
  { code: 'carte_visite_85x55', libelle: 'Carte de visite 85 × 55 mm', largeur: 85, hauteur: 55, famille: 'carte' },
  { code: 'carte_visite_90x50', libelle: 'Carte de visite 90 × 50 mm', largeur: 90, hauteur: 50, famille: 'carte' },
  { code: 'carte_visite_90x55', libelle: 'Carte de visite 90 × 55 mm', largeur: 90, hauteur: 55, famille: 'carte' },
  { code: 'carte_visite_85x54', libelle: 'Carte de visite 85 × 54 mm (format carte bancaire)', largeur: 85.6, hauteur: 54, famille: 'carte' },
  { code: 'ticket_70x150', libelle: 'Ticket 70 × 150 mm', largeur: 70, hauteur: 150, famille: 'ticket' },
  { code: 'ticket_50x100', libelle: 'Ticket 50 × 100 mm', largeur: 50, hauteur: 100, famille: 'ticket' },
  { code: 'dl', libelle: 'DL 99 × 210 mm (flyer tiers d’A4)', largeur: 99, hauteur: 210, famille: 'flyer' },
  { code: 'a7', libelle: 'A7 74 × 105 mm', largeur: 74, hauteur: 105, famille: 'flyer' },
  { code: 'a6', libelle: 'A6 105 × 148 mm', largeur: 105, hauteur: 148, famille: 'flyer' },
  { code: 'a5', libelle: 'A5 148 × 210 mm', largeur: 148, hauteur: 210, famille: 'page' },
  { code: 'a4', libelle: 'A4 210 × 297 mm', largeur: 210, hauteur: 297, famille: 'page' },
  { code: 'a3', libelle: 'A3 297 × 420 mm', largeur: 297, hauteur: 420, famille: 'page' },
  { code: 'carre_148', libelle: 'Carré 148 × 148 mm', largeur: 148, hauteur: 148, famille: 'flyer' },
  { code: 'carre_105', libelle: 'Carré 105 × 105 mm', largeur: 105, hauteur: 105, famille: 'flyer' },
  { code: 'enveloppe_dl', libelle: 'Enveloppe DL 110 × 220 mm', largeur: 110, hauteur: 220, famille: 'enveloppe' },
];

export const FONDS_PERDUS_STANDARD = 3;
const TOLERANCE = 1.5;

export interface FormatDetecte {
  code: string;
  libelle: string;
  largeur: number;
  hauteur: number;
  famille: string;
  /** La page mesure le format fini plus 2 × fonds perdus. */
  avec_fonds_perdus: boolean;
  fonds_perdus_mm: number;
  /** La page est en paysage par rapport au format de référence. */
  paysage: boolean;
}

const proche = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;

/** Reconnaît un format fini à partir des dimensions d'une page (mm), avec ou sans fonds perdus. */
export function detecterFormat(largeur: number, hauteur: number): FormatDetecte | null {
  for (const fp of [0, 3, 2, 5]) {
    for (const f of FORMATS_FINIS) {
      const w = f.largeur + 2 * fp;
      const h = f.hauteur + 2 * fp;
      if (proche(largeur, w) && proche(hauteur, h)) return { ...f, avec_fonds_perdus: fp > 0, fonds_perdus_mm: fp, paysage: false };
      if (proche(largeur, h) && proche(hauteur, w)) return { ...f, avec_fonds_perdus: fp > 0, fonds_perdus_mm: fp, paysage: true };
    }
  }
  return null;
}

export const arrondi = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Format standard le plus proche d'une taille non reconnue (mm), dans les deux orientations, si l'écart
 * reste raisonnable (15 % par côté au plus) : proposé comme format fini pour mettre le fichier au format.
 */
export function formatProche(largeur: number, hauteur: number): (FormatDetecte & { ecart: number }) | null {
  let meilleur: (FormatDetecte & { ecart: number }) | null = null;
  let meilleurEcart = Infinity;
  for (const f of FORMATS_FINIS) {
    for (const paysage of [false, true]) {
      const w = paysage ? f.hauteur : f.largeur;
      const h = paysage ? f.largeur : f.hauteur;
      // Écart sur le côté le plus éloigné, départagé par l'écart total (le premier format du catalogue l'emporte à égalité).
      const ecart = Math.max(Math.abs(largeur - w) / w, Math.abs(hauteur - h) / h) + (Math.abs(largeur - w) / w + Math.abs(hauteur - h) / h) / 100;
      if (ecart <= 0.15 && ecart < meilleurEcart - 1e-9) {
        meilleurEcart = ecart;
        meilleur = { ...f, avec_fonds_perdus: false, fonds_perdus_mm: 0, paysage, ecart: arrondi(ecart, 3) };
      }
    }
  }
  return meilleur;
}
