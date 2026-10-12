// Types de l'imposition (miroir de api/src/modules/imposition).
export type Operation = 'poses' | 'livret' | 'fonds_perdus' | 'assembler';
export type ModePoses = 'repetition' | 'sequence' | 'coupe_empile';
export type MethodeFondsPerdus = 'source' | 'intelligent' | 'prolonger' | 'miroir' | 'etirer' | 'blanc';
export type ModeAjustement = 'auto' | 'centrer' | 'adapter' | 'remplir' | 'etirer';
export type ModeBlanches = 'fin' | 'avant_derniere' | 'apres_couverture' | 'reparties' | 'positions';
export type ModePlanches = 'non' | 'simple' | 'couverture';
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
  ajustement: ModeAjustement;
  /** Modèle d'imposition : son format fini s'applique même si le fichier a une autre taille. */
  fini_impose?: boolean;
  chasse_mm?: number;
  blanches: ModeBlanches;
  blanches_apres?: number[];
  planches?: ModePlanches;
  reliure?: 'piqure' | 'dos_carre';
  cahier_feuilles?: number;
  couverture_separee?: boolean;
  lecture?: 'gauche_droite' | 'droite_gauche';
}

export interface Pose {
  page: number | null;
  numero: string | null;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  decalage_x?: number;
  pli?: 'gauche' | 'droite';
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
  libelle?: string;
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
  /** Livret : ordre de lecture (pages du document, null = page blanche ajoutée). */
  ordre?: (number | null)[];
  /** Livret : positions (dans `ordre`) des blanches placées à la main. */
  blanches_manuelles?: number[];
  /** Mise au format quand le fichier n'a pas la taille du format fini ; null si rien à adapter. */
  adaptation?: Adaptation | null;
  feuilles: FeuillePlan[];
  avertissements: string[];
}

/** Mise au format (miroir de api/src/modules/imposition/ajuster.ts). */
export interface Adaptation {
  mode: Exclude<ModeAjustement, 'auto'>;
  auto: boolean;
  source: Dimension;
  pivote: boolean;
  echelle_x: number;
  echelle_y: number;
  marges: { x: number; y: number };
  rognage: { x: number; y: number };
  identique: boolean;
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
  bords_unis: { haut: boolean; bas: boolean; gauche: boolean; droite: boolean } | null;
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
  /** Rôle déduit automatiquement (nom du fichier, paire de deux fichiers) : remplacé dès qu'on le change. */
  roleAuto?: boolean;
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
  /** Moitié d'une planche séparée en deux pages. */
  demi?: 'gauche' | 'droite';
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
  planches?: { separees: number; detection: DetectionPlanches | null };
  /** Format non reconnu : format standard le plus proche (pour mettre le fichier au format). */
  format_proche?: (FormatDetecte & { ecart: number }) | null;
}

export interface DetectionPlanches {
  confiance: 'forte' | 'possible';
  pages_doubles: number;
  format_page: string | null;
  couverture_seule: boolean;
}

export const BLANCHES_LABELS: Record<ModeBlanches, { label: string; aide: string }> = {
  avant_derniere: { label: 'Avant la 4e de couverture', aide: 'Recommandé : les couvertures restent dehors et les pages gardent leur côté (paires à gauche, impaires à droite).' },
  fin: { label: 'À la fin', aide: 'Après la dernière page : la 4e de couverture n’est plus au dos.' },
  apres_couverture: { label: 'Après la couverture', aide: 'Le contenu commence plus loin : les pages changent de côté.' },
  reparties: { label: '2e et 3e de couverture', aide: 'Une blanche au revers de la couverture, les autres avant la 4e de couverture.' },
  positions: { label: 'Placées à la main', aide: 'Cliquez « + » entre deux pages dans la vue des pages ; le complément va avant la 4e de couverture.' },
};

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
  depuis_cache?: boolean;
  jetons?: number;
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
  intelligent: { label: 'Intelligent', aide: 'Chaque bord est analysé : un aplat ou un dégradé est prolongé, un motif ou une photo est retourné en miroir. Recommandé.' },
  prolonger: { label: 'Prolonger', aide: 'Le dernier demi-millimètre du visuel est étiré jusqu’au bord : parfait pour les aplats et les dégradés.' },
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

export const AJUSTEMENT_LABELS: Record<ModeAjustement, { label: string; aide: string }> = {
  auto: { label: 'Auto', aide: 'Même taille : rien. Proportions proches : rempli. Sinon adapté sans rien perdre, et le rapport explique.' },
  adapter: { label: 'Adapter', aide: 'Le visuel entier tient dans le format : des bandes blanches peuvent apparaître sur deux côtés.' },
  remplir: { label: 'Remplir', aide: 'Le visuel couvre tout le format : il est rogné sur deux côtés.' },
  etirer: { label: 'Étirer', aide: 'Le visuel prend exactement le format, en se déformant un peu.' },
  centrer: { label: 'Centrer', aide: 'Taille d’origine, format fini pris au centre : rogné ou entouré de blanc.' },
};

export const PLANCHES_LABELS: Record<ModePlanches, { label: string; aide: string }> = {
  non: { label: 'Telles quelles', aide: 'Chaque page du PDF reste une page.' },
  simple: { label: 'Séparer en pages', aide: 'Chaque page double devient deux pages (gauche, puis droite).' },
  couverture: { label: 'Couverture à plat', aide: 'La première planche est la couverture ouverte (4e à gauche, 1re à droite) : la 4e passe à la fin.' },
};
