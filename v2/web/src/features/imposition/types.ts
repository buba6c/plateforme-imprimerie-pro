// Types de l'imposition (miroir de api/src/modules/imposition).
export type Operation = 'poses' | 'livret' | 'fonds_perdus' | 'assembler';
export type ModePoses = 'repetition' | 'sequence' | 'coupe_empile';
export type MethodeFondsPerdus = 'source' | 'miroir' | 'etirer' | 'blanc';
export type Feuille = 'sra3' | 'a3' | 'a3_plus' | 'sra4' | 'a4' | 'a5' | 'banniere_330' | 'personnalisee';

export interface Dimension {
  largeur: number;
  hauteur: number;
}

export interface Numerotation {
  debut: number;
  chiffres: number;
  prefixe: string;
  position: 'bas_droite' | 'bas_gauche' | 'haut_droite' | 'haut_gauche' | 'bas_centre';
  taille_pt: number;
  verso: boolean;
}

export interface ParamsImposition {
  operation: Operation;
  feuille: Feuille;
  feuille_personnalisee?: Dimension;
  orientation: 'auto' | 'portrait' | 'paysage';
  fini: Dimension;
  fonds_perdus_mm: number;
  methode_fonds_perdus: MethodeFondsPerdus;
  gouttiere_mm: number;
  marge_mm: number;
  traits_de_coupe: boolean;
  recto_verso: boolean;
  retournement: 'bord_long' | 'bord_court';
  mode: ModePoses;
  quantite?: number;
  numerotation?: Numerotation | null;
  ajustement: 'centrer' | 'adapter' | 'remplir';
  chasse_mm?: number;
  blanches: 'fin' | 'avant_derniere';
}

export interface Pose {
  page: number | null;
  numero: string | null;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rang: number;
  colonne: number;
}
export interface Face {
  cote: 'recto' | 'verso';
  poses: Pose[];
  plis: number[];
}
export interface FeuillePlan {
  numero: number;
  recto: Face;
  verso: Face | null;
}
export interface Plan {
  operation: Operation;
  feuille: Dimension;
  paysage: boolean;
  fini: Dimension;
  fonds_perdus_mm: number;
  colonnes: number;
  rangs: number;
  poses_par_face: number;
  nb_feuilles: number;
  nb_pages_sortie: number;
  feuilles_a_imprimer: number | null;
  pages_blanches: number;
  feuilles: FeuillePlan[];
  avertissements: string[];
}

export interface Bords {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
}
export interface FormatDetecte {
  code: string;
  libelle: string;
  largeur: number;
  hauteur: number;
  famille: string;
  avec_fonds_perdus: boolean;
  fonds_perdus_mm: number;
  paysage: boolean;
}
export interface PageAnalysee {
  numero: number;
  largeur: number;
  hauteur: number;
  rotation: number;
  trim: (Dimension & { x: number; y: number }) | null;
  fonds_perdus_declares: number;
  format: FormatDetecte | null;
  bords: Bords | null;
  marge_blanche: Bords | null;
  jusqu_au_bord: boolean | null;
}
export interface AnalysePdf {
  nb_pages: number;
  pages: PageAnalysee[];
  uniforme: boolean;
  largeur: number;
  hauteur: number;
  format: FormatDetecte | null;
  fonds_perdus: 'declares' | 'absents' | 'incertains';
  fonds_perdus_mm: number;
  rendu: boolean;
  avertissements: string[];
  fini: Dimension;
}

export type RolePiece = 'recto' | 'verso' | 'pages';

/** Une pièce du travail : fichier du dossier (fichier_id) ou fichier libre (jeton). */
export interface Piece {
  cle: string;
  fichier_id?: number;
  libre?: string;
  role: RolePiece;
  nom: string;
  taille: number;
  mime: string | null;
  genre: 'pdf' | 'image';
}

export interface PageVirtuelle {
  numero: number;
  fichier_id: number;
  libre?: string;
  nom: string;
  page_source: number;
  role: RolePiece;
  genre: 'pdf' | 'image';
}

export interface PieceAnalysee {
  fichier_id: number;
  libre?: string;
  nom: string;
  genre: 'pdf' | 'image';
  taille: number;
  pages: number;
  largeur: number | null;
  hauteur: number | null;
  format: FormatDetecte | null;
  fonds_perdus: AnalysePdf['fonds_perdus'] | null;
  avertissements: string[];
}

export interface ReponseAnalyse {
  fichier: { id: number; nom: string; taille: number; dossier_id: number | null };
  sans_dossier: boolean;
  pieces: PieceAnalysee[];
  pages: PageVirtuelle[];
  paires: { recto: number; verso: number | null }[] | null;
  analyse: AnalysePdf;
  params_defaut: ParamsImposition;
}

export interface FichierLibre {
  libre: string;
  nom: string;
  taille: number;
  mime: string;
  genre: 'pdf' | 'image';
}

/** Corps envoyé au serveur pour désigner les pièces. */
export const corpsPieces = (pieces: Piece[]) => pieces.map((p) => (p.libre ? { libre: p.libre, role: p.role } : { fichier_id: p.fichier_id, role: p.role }));

/** Adresse de l'aperçu d'une page virtuelle. */
export function apercuPage(pg: PageVirtuelle, largeur = 320): string {
  return pg.libre ? `/api/imposition/libre/${pg.libre}/apercu?page=${pg.page_source}&largeur=${largeur}` : `/api/fichiers/${pg.fichier_id}/apercu?page=${pg.page_source}&largeur=${largeur}`;
}

export interface Catalogue {
  feuilles: { code: Feuille; libelle: string; largeur: number; hauteur: number }[];
  formats: { code: string; libelle: string; largeur: number; hauteur: number; famille: string }[];
}

export interface ModeleImposition {
  id: number;
  nom: string;
  description: string | null;
  params: ParamsImposition;
  ordre: number;
  created_by_nom: string | null;
  updated_at: string;
}

export interface PropositionImposition {
  params: ParamsImposition;
  plan: Plan | null;
  erreur_plan: string | null;
  type_document: string;
  confiance: 'haute' | 'moyenne' | 'basse';
  explication: string;
  points_de_vigilance: string[];
  fournisseur: string;
  modele: string;
  secours: boolean;
}

export interface ResultatGeneration {
  fichier: { id: number; nom: string; taille: number; dossier_id: number } | null;
  libre?: { jeton: string; nom: string; taille: number; telechargement: string };
  plan: Plan;
}

export const OPERATION_LABELS: Record<Operation, { titre: string; aide: string }> = {
  poses: { titre: 'Cartes, flyers, tickets', aide: 'Plusieurs exemplaires par feuille, traits de coupe, recto-verso aligné.' },
  livret: { titre: 'Livret, brochure', aide: 'Piqûre à cheval : deux pages par face, ordre des pages recalculé, pages blanches ajoutées.' },
  fonds_perdus: { titre: 'Fonds perdus seuls', aide: 'Une page par page du fichier, avec des fonds perdus ajoutés et des traits de coupe.' },
  assembler: { titre: 'Assembler seulement', aide: 'Réunir les pièces dans l’ordre en un seul PDF, pages inchangées (recto 1, verso 1, recto 2…).' },
};

export const METHODE_LABELS: Record<MethodeFondsPerdus, { label: string; aide: string }> = {
  source: { label: 'Du fichier', aide: 'Les fonds perdus déjà présents dans le fichier (au-delà de la zone finie) sont utilisés.' },
  miroir: { label: 'Miroir', aide: 'Les bords du visuel sont redessinés en miroir autour de la page : le raccord est invisible après la coupe.' },
  etirer: { label: 'Étirer', aide: 'Le visuel est légèrement agrandi pour couvrir les fonds perdus : on perd quelques millimètres sur les bords.' },
  blanc: { label: 'Blanc', aide: 'Aucun fond perdu : pour un visuel qui a déjà une marge blanche tout autour.' },
};

export const MODE_LABELS: Record<ModePoses, { label: string; aide: string }> = {
  repetition: { label: 'Répétition', aide: 'Le même visuel sur toutes les poses (page 1 au recto, page 2 au verso).' },
  sequence: { label: 'Séquence', aide: 'Les pages du fichier se suivent sur les poses, feuille après feuille.' },
  coupe_empile: { label: 'Coupe & empile', aide: 'Après la coupe, chaque pile est dans l’ordre : tickets numérotés, exemplaires différents.' },
};

export const FOURNISSEUR_LABELS_IA: Record<string, string> = { openai: 'OpenAI', gemini: 'Google Gemini', openrouter: 'OpenRouter' };
