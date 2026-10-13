// Calcul des plans d'imposition, sans toucher au PDF : où va chaque page sur chaque feuille.
//  - « poses » : N exemplaires par feuille (cartes de visite, flyers, tickets), en répétition
//    (même visuel partout), en séquence (les pages se suivent) ou en coupe & empile (après la
//    coupe, chaque pile est dans l'ordre : tickets numérotés, exemplaires personnalisés) ;
//  - « livret » : piqûre à cheval, 2 pages par face, ordre des pages recalculé, pages blanches ajoutées
//    pour atteindre un multiple de 4 ;
//  - « fonds_perdus » : une page par page source, avec des fonds perdus ajoutés.
// Les positions sont en mm, origine en bas à gauche de la feuille (comme le PDF).
//
// Le plan est la source de vérité de tout ce qui est dessiné : le moteur (generer.ts) et l'aperçu
// (SchemaFeuille.tsx) ne font que tracer ce qu'il dit. Il porte :
//  - la décision de coupe (avec ou sans fonds perdus, et quel système : coupe franche, double coupe,
//    cadre blanc, sans coupe), prise ici d'après les mesures de l'analyse (resoudreCoupe) ;
//  - le calepinage (optimiser) : pour les poses, l'orientation, les fonds perdus, le partage des fonds
//    entre poses jointives et la rotation des poses sont choisis pour loger le plus d'exemplaires sans
//    perdre les repères ; le plan explique son choix et liste les alternatives ;
//  - la règle du verso : miroir des positions selon l'axe de retournement de la feuille, et rotation
//    du contenu quand la pièce se retourne comme une page (consigne pour le pilote de la Xerox) ;
//  - les repères (reperes.ts) : traits de coupe, plis, cotes, calculés une fois pour le PDF et l'écran.

import { calculerAdaptation, calculerAdaptationCadre, type Adaptation, type MargesBlanches, type ModeAjustement } from './ajuster';
import { FEUILLES, FONDS_PERDUS_STANDARD, type Dimension, type Feuille } from './formats';
import { decorerPlan, type Ligne, type Segment, type Texte } from './reperes';
import { completerBlanches, planLivret } from './livret';
import { planDepliant, type InfoDepliant, type Pliage } from './depliant';

export { completerBlanches, planLivret, planDepliant };
export type { InfoDepliant, Pliage };

export type Operation = 'poses' | 'livret' | 'fonds_perdus' | 'assembler' | 'depliant';
export type ModePoses = 'repetition' | 'sequence' | 'coupe_empile';
export type MethodeFondsPerdus = 'source' | 'intelligent' | 'prolonger' | 'miroir' | 'etirer' | 'blanc';
/** Bord de la feuille sur lequel la Xerox la retourne ; « auto » = le bord qui évite de tourner le verso. */
export type Retournement = 'auto' | 'bord_long' | 'bord_court';
/** Contenu du verso : « auto » = la pièce se retourne comme une page ; « aucune » = comme un calendrier. */
export type RotationVerso = 'auto' | 'aucune' | '180';
export type Orientation = 'auto' | 'portrait' | 'paysage';
export type Ajustement = ModeAjustement;
export type ModeBlanches = 'fin' | 'avant_derniere' | 'apres_couverture' | 'reparties' | 'positions';
/** Planches (deux pages côte à côte sur une page du PDF) : laissées telles quelles ou séparées. */
export type ModePlanches = 'non' | 'simple' | 'couverture';
/**
 * Coupe demandée : « auto » (fonds perdus si le fichier en a ou si le visuel va au bord, sinon sans),
 * « fonds_perdus » (forcés), « sans_auto » (sans fonds perdus, système choisi d'après les mesures),
 * ou un système précis.
 */
export type Coupe = 'auto' | 'fonds_perdus' | 'sans_auto' | 'franche' | 'double' | 'cadre' | 'aucune';
export type SystemeCoupe = 'fonds_perdus' | 'franche' | 'double' | 'cadre' | 'aucune';
export type StyleTraits = 'auto' | 'angles' | 'bloc' | 'bord_feuille' | 'traversants' | 'aucun';
/** auto : droites ou toutes tournées (un seul sens de coupe) ; mixte : bande tournée dans l'espace restant, sur demande seulement. */
export type RotationPoses = 'aucune' | '90' | 'auto' | 'mixte';
export type TeteBeche = 'aucune' | 'colonnes' | 'rangs' | 'damier';
export type Calage = 'centre' | 'coin';
export type Rotation = 0 | 90 | 180 | 270;
export type Cote = 'gauche' | 'droite' | 'haut' | 'bas';

export interface Numerotation {
  debut: number;
  chiffres: number;
  prefixe: string;
  position: 'bas_droite' | 'bas_gauche' | 'haut_droite' | 'haut_gauche' | 'bas_centre';
  taille_pt: number;
  /** Sur le verso aussi (même numéro). */
  verso: boolean;
}

export interface ParamsImposition {
  operation: Operation;
  feuille: Feuille;
  feuille_personnalisee?: Dimension;
  orientation: Orientation;
  /** Format fini (mm). */
  fini: Dimension;
  fonds_perdus_mm: number;
  methode_fonds_perdus: MethodeFondsPerdus;
  /** Espace entre deux poses (mm), en plus des fonds perdus. */
  gouttiere_mm: number;
  /** Gouttière en hauteur si différente (null ou absent = gouttiere_mm). */
  gouttiere_y_mm?: number | null;
  /** Marge minimale entre les poses et le bord de la feuille (mm) ; jamais moins que la marge technique de l'atelier. */
  marge_mm: number;
  traits_de_coupe: boolean;
  /** Style des traits de coupe : auto (angles si la gouttière le permet, sinon autour du bloc), ou forcé. */
  traits_style?: StyleTraits;
  /** Le fichier contient recto et verso en alternance (poses) ou l'imposition est recto-verso (livret). */
  recto_verso: boolean;
  retournement: Retournement;
  rotation_verso?: RotationVerso;
  mode: ModePoses;
  /** Répétition avec plusieurs visuels dans le fichier : chacun répété sur sa propre feuille (défaut) ou seulement le premier. */
  repetition_visuels?: 'chacun' | 'premier';
  /** Nombre d'exemplaires à produire (répétition : exemplaires de chaque visuel ; coupe & empile sans numérotation : nb de pages). */
  quantite?: number;
  numerotation?: Numerotation | null;
  /** Si le visuel n'a pas la taille du format fini : auto (recommandé), centrer, adapter, remplir ou étirer (voir ajuster.ts). */
  ajustement: Ajustement;
  /** Modèle d'imposition : son format fini s'applique même si le fichier a une autre taille. */
  fini_impose?: boolean;
  /** Coupe : avec ou sans fonds perdus, et quel système (voir Coupe). */
  coupe?: Coupe;
  /** Cadre blanc (passe-partout) laissé autour du visuel, mm ; 3 si « cadre » sans valeur. */
  cadre_blanc_mm?: number;
  /** Cadre blanc obtenu en réduisant le visuel (rien de perdu) ou en rognant ses bords (échelle gardée). */
  cadre_methode?: 'reduire' | 'rogner';
  /** Calepinage : « auto » choisit fonds perdus, orientation, partage et rotation des poses pour loger le plus d'exemplaires. */
  calepinage?: 'auto' | 'manuel';
  /** Rotation des poses : aucune, toutes d'un quart de tour, ou automatique (bande tournée dans l'espace restant). */
  rotation_poses?: RotationPoses;
  /** Tête-bêche : une colonne (ou un rang) sur deux tournée de 180°. */
  tete_beche?: TeteBeche;
  /** Grille centrée sur la feuille ou calée sur le coin de pince (bas-gauche). */
  calage?: Calage;
  /** Marge de pince (mm) quand la grille est calée sur le coin ; sinon marge_mm. */
  marge_pince_mm?: number;
  /** Fonds perdus partagés : poses jointives (un seul trait par ligne de coupe), fonds perdus sur le pourtour seulement. 'auto' = quand les bords sont unis en répétition. */
  fonds_partages?: boolean | 'auto';
  /** Livret : décalage de chasse total (mm) réparti du cahier extérieur vers l'intérieur. */
  chasse_mm?: number;
  /**
   * Livret : où mettre les pages blanches qui complètent le multiple de 4 :
   *  - « avant_derniere » : avant la 4e de couverture (la pagination gauche/droite est gardée) ;
   *  - « fin » : après la dernière page ;
   *  - « apres_couverture » : juste après la 1re de couverture (le contenu commence page 3) ;
   *  - « reparties » : 2e et 3e de couverture blanches (une au début, le reste à la fin) ;
   *  - « positions » : là où le préparateur les a placées (`blanches_apres`), le reste avant la 4e de couverture.
   */
  blanches: ModeBlanches;
  /**
   * Livret, mode « positions » : une page blanche après la k-ième page du document, dans l'ordre de
   * lecture (0 = avant la première). Une valeur répétée place plusieurs blanches à la suite.
   */
  blanches_apres?: number[];
  /** Appariement recto/verso des pages du document assemblé (posé par le serveur), sinon pages alternées. */
  paires?: { recto: number; verso: number | null }[] | null;
  /** Livret : piqûre à cheval (un seul cahier) ou dos carré collé (cahiers empilés). */
  reliure?: 'piqure' | 'dos_carre' | 'feuilles_volantes';
  /** Livret dos carré : feuilles par cahier (4 feuilles = 16 pages). */
  cahier_feuilles?: number;
  /** Livret : couverture (pages 1, 2, avant-dernière, dernière) sur une feuille à part (autre papier). */
  couverture_separee?: boolean;
  /** Livret : sens de lecture (droite à gauche pour l'arabe). */
  lecture?: 'gauche_droite' | 'droite_gauche';
  /** Livret : planches (doubles pages) par feuille : 1, 2 ou 4. */
  poses_livret?: 1 | 2 | 4;
  /** Livret à plusieurs planches : la même planche partout (k livrets par jeu) ou les planches empilées (une pile par position, à empiler après la coupe). */
  mode_planches?: 'repetition' | 'empile';
  /** Livret : relié sur le bord gauche (pli vertical) ou en haut (pli horizontal : calendriers, blocs). */
  reliure_bord?: 'gauche' | 'haut';
  /** Dos carré : épaisseur du dos (mm), calculée d'après l'épaisseur d'une feuille si absente. */
  dos_mm?: number | null;
  /** Épaisseur d'une feuille (mm) : 80 g 0,10 ; 135 g 0,12 ; 170 g 0,16 ; 250 g 0,25 ; 300 g 0,30. */
  epaisseur_feuille_mm?: number;
  /** Couverture dos carré : rainages de mors à 7 mm de part et d'autre du dos. */
  mors?: boolean;
  /** Livret sans fonds perdus : rognage après pliage (auto : trois côtés si la feuille le permet, sinon aucun). */
  rognage?: 'auto' | 'aucun' | 'face' | 'trois_cotes';
  /** Folios (numéros de page) imprimés sur chaque page du livret. */
  folios?: { actif: boolean; debut?: number; position?: 'bas_exterieur' | 'bas_centre' | 'haut_exterieur'; taille_pt?: number; exclure_couverture?: boolean } | null;
  /** Pages de garde : une feuille blanche pliée en plus (0 ou 4 pages). */
  gardes?: 0 | 4;
  /** Chasse calculée d'après l'épaisseur des feuilles quand chasse_mm est absent (piqûre à cheval). */
  chasse_auto?: boolean;
  /** Dépliant : type de pli. */
  pliage?: Pliage;
  /** Dépliant : fichier reçu développé (une page par face) ou un volet par page. */
  entree?: 'developpe' | 'volets';
  /** Pli roulé : réduction du rabat rentrant (mm). */
  reduction_volet_mm?: number;
  /** Pli fenêtre : jeu central entre les deux volets rabattus (mm). */
  jeu_central_mm?: number;
  /** Plis marqués comme rainages (papier épais). */
  rainage?: boolean;
  /** Chevalet : hauteur de la base (mm). */
  base_mm?: number;
  /**
   * Planches : chaque page double est coupée en deux pages (« simple ») ; avec « couverture », la
   * première planche est la couverture à plat (4e à gauche, 1re à droite) : la 4e passe à la fin.
   */
  planches?: ModePlanches;
}

export interface Pose {
  /** Page source (1-based), null = pose vide. */
  page: number | null;
  /** Numéro imprimé (numérotation), sinon null. */
  numero: string | null;
  /** Position de l'emprise de la pose sur la feuille (mm, bas-gauche). */
  x: number;
  y: number;
  /** Taille du contenu (format fini, mm), avant rotation : pour 90 et 270, l'emprise est hauteur × largeur. */
  largeur: number;
  hauteur: number;
  /** Rotation du contenu dans son emprise (sens trigonométrique, repère PDF). Absent = 0. */
  rotation?: Rotation;
  /** Décalage de chasse appliqué (mm, positif vers la droite) : les pages intérieures vont vers le pli. */
  decalage_x?: number;
  /** Chasse verticale (livret relié en haut), mm, positif vers le haut. */
  decalage_y?: number;
  /** Livret : côté de la pose qui touche le pli ; aucun fond perdu ne déborde de ce côté sur la page voisine. */
  pli?: 'gauche' | 'droite' | 'haut' | 'bas';
  /** Côtés sans fonds perdus (pose jointive à une voisine) : fonds perdus partagés, coupe franche. */
  joints?: Cote[];
  /** Repère : rangée et colonne (0-based), et pour le livret, le côté. */
  rang: number;
  colonne: number;
  /** Grille mixte : 0 = bloc principal, 1 = bande tournée. */
  bande?: number;
}

export interface Face {
  cote: 'recto' | 'verso';
  poses: Pose[];
  /** Traits de pli (livret), en x (mm). */
  plis: number[];
  /** Plis horizontaux (livret relié en haut), en y (mm). */
  plis_h?: number[];
  /** Repères de dos (dos carré) : petits rectangles pleins sur le pli, décalés d'un cahier à l'autre. */
  marques?: { x: number; y: number; largeur: number; hauteur: number }[];
  /** Traits de coupe (segments, mm) calculés par reperes.ts : le PDF et l'écran tracent exactement ceux-là. */
  traits?: Segment[];
  /** Lignes de pli, rainage, perforation (pointillés). */
  lignes?: Ligne[];
  /** Textes de marge (étiquette, cotes). */
  textes?: Texte[];
}

export interface FeuillePlan {
  numero: number;
  recto: Face;
  verso: Face | null;
  /** Livret : « Couverture », « Cahier 2 · feuille 1 »… */
  libelle?: string;
}

/** Décision de coupe, valeurs effectives et explication. */
export interface InfoCoupe {
  systeme: SystemeCoupe;
  /** Décision prise automatiquement (coupe « auto » ou « sans_auto »). */
  auto: boolean;
  fonds_perdus_mm: number;
  gouttiere_mm: number;
  gouttiere_y_mm: number;
  cadre_mm: number;
  cadre_methode: 'reduire' | 'rogner';
  methode: MethodeFondsPerdus;
  /** Marge blanche la plus étroite mesurée (mm), null si rien n'a été rendu. */
  marge_encre_mm: number | null;
  pages_controlees: number;
  sur: number;
  raison: string;
  alternatives: SystemeCoupe[];
}

/** Choix du calepinage (poses) et alternatives chiffrées. */
export interface InfoCalepinage {
  auto: boolean;
  fonds_perdus_mm: number;
  demande_mm: number;
  poses: number;
  orientation: 'portrait' | 'paysage';
  partages: boolean;
  rotation: 'aucune' | '90' | 'mixte';
  /** Les repères de coupe tiennent dans la zone imprimable sur tous les côtés. */
  reperes_ok: boolean;
  raison: string;
  alternatives: { fonds_perdus_mm: number; poses: number; partages: boolean; rotation: 'aucune' | '90' | 'mixte'; reperes_ok: boolean }[];
}

export interface Plan {
  operation: Operation;
  feuille: Dimension;
  paysage: boolean;
  fini: Dimension;
  /** Fonds perdus effectivement dessinés (mm). */
  fonds_perdus_mm: number;
  /** Gouttière effective (mm). */
  gouttiere_mm: number;
  /** Marge effective entre le bloc et le bord de la feuille (mm). */
  marge_mm: number;
  colonnes: number;
  rangs: number;
  poses_par_face: number;
  nb_feuilles: number;
  nb_pages_sortie: number;
  /** Feuilles à imprimer pour la quantité demandée (répétition). */
  feuilles_a_imprimer: number | null;
  /** Pages blanches ajoutées (livret). */
  pages_blanches: number;
  /** Livret : ordre de lecture du livret fini (pages du document, null = page blanche ajoutée). */
  ordre?: (number | null)[];
  /** Livret : positions (dans `ordre`) des blanches placées à la main. */
  blanches_manuelles?: number[];
  /** Mise au format du visuel quand le fichier n'a pas la taille du format fini (null : rien à adapter ou inconnu). */
  adaptation?: Adaptation | null;
  /** Réglages effectivement appliqués (coupe résolue, calepinage, marges) : seule entrée du moteur. */
  params_effectifs: ParamsImposition;
  coupe: InfoCoupe;
  calepinage: InfoCalepinage | null;
  /** Bord de retournement à régler sur la Xerox pour que le verso tombe juste. */
  retournement_effectif: 'bord_long' | 'bord_court';
  axe_verso: 'vertical' | 'horizontal';
  /** Positions de coupe (mm depuis le coin bas-gauche), pour programmer le massicot. */
  cotes?: { x: number[]; y: number[] };
  /** Consignes pour l'imprimeur (pilote, massicot), à distinguer des avertissements. */
  consignes: string[];
  /** Livret : ce qui a été retenu (planches, reliure, dos, rognage, chasse). */
  livret?: InfoLivret;
  /** Dépliant : volets, plis, pages attendues. */
  depliant?: InfoDepliant;
  feuilles: FeuillePlan[];
  avertissements: string[];
}

export interface InfoLivret {
  planches: number;
  mode: 'repetition' | 'empile';
  reliure: 'piqure' | 'dos_carre' | 'feuilles_volantes';
  bord: 'gauche' | 'haut';
  dos_mm: number | null;
  /** Rognage retenu quand le livret est sans fonds perdus ; null avec fonds perdus. */
  rognage: 'aucun' | 'face' | 'trois_cotes' | null;
  chasse_mm: number;
  /** Rognage « face » : positions (mm) des seules lignes de coupe gardées, sur l'axe indiqué. */
  bords_face?: { axe: 'x' | 'y'; positions: number[] };
}

/** Ce que l'analyse sait du visuel reçu, pour décider la coupe et la mise au format. */
export interface SourcePlan {
  /** Zone finie du visuel reçu (mm) : format reconnu, sinon page moins fonds perdus déclarés. */
  fini: Dimension;
  marge_blanche: MargesBlanches | null;
  fonds?: 'declares' | 'incertains' | 'absents';
  fonds_mm?: number;
  /** Marge blanche la plus étroite sur toutes les pages rendues (mm). */
  marge_blanche_min?: number | null;
  jusqu_au_bord?: boolean | null;
  bord_clair?: boolean | null;
  bords_unis_partout?: boolean | null;
  nb_pages_rendues?: number;
  nb_pages?: number;
}

/** Réglages d'atelier (Paramètres > Imposition). */
export interface AtelierImposition {
  /** Bord que la machine n'imprime pas (mm) : aucune pose ni repère n'y est placé. */
  marge_technique_mm: number;
  /** Fonds perdus en dessous desquels le calepinage automatique ne descend pas (mm). */
  fonds_perdus_min_mm: number;
  /** Ne jamais sacrifier les repères de coupe pour gagner des poses (sinon, le plus de poses l'emporte). */
  reperes_obligatoires?: boolean;
}
export const ATELIER_DEFAUT: AtelierImposition = { marge_technique_mm: 5, fonds_perdus_min_mm: 1, reperes_obligatoires: true };

const arr = (v: number) => Math.round(v * 100) / 100;

export function dimensionFeuille(p: Pick<ParamsImposition, 'feuille' | 'feuille_personnalisee'>): Dimension {
  if (p.feuille === 'personnalisee') {
    const d = p.feuille_personnalisee;
    if (!d || !(d.largeur > 0) || !(d.hauteur > 0)) throw new Error('Feuille personnalisée : indiquez largeur et hauteur en mm.');
    return { largeur: d.largeur, hauteur: d.hauteur };
  }
  const f = FEUILLES[p.feuille];
  return { largeur: f.largeur, hauteur: f.hauteur };
}

/** Emprise d'une pose sur la feuille (mm) : largeur × hauteur échangées pour un quart de tour. */
export function emprise(q: Pick<Pose, 'largeur' | 'hauteur' | 'rotation'>): Dimension {
  return q.rotation === 90 || q.rotation === 270 ? { largeur: q.hauteur, hauteur: q.largeur } : { largeur: q.largeur, hauteur: q.hauteur };
}

// ---------------------------------------------------------------------------
// Grille des poses

interface GeoPose {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rotation: Rotation;
  rang: number;
  colonne: number;
  bande: number;
}

export interface Grille {
  feuille: Dimension;
  paysage: boolean;
  poses: GeoPose[];
  colonnes: number;
  rangs: number;
  /** Bandes : 1 (grille simple) ou 2 (bloc + bande tournée). */
  bandes: number;
  partages: boolean;
  rotation: 'aucune' | '90' | 'mixte';
  /** Espace entre le bloc (fonds perdus compris) et chaque bord de la feuille (mm). */
  marges: { gauche: number; droite: number; haut: number; bas: number };
}

interface OptionsGrille {
  fp: number;
  orientation: 'portrait' | 'paysage';
  partage: boolean;
  rotation: 'aucune' | '90' | 'mixte';
}

/**
 * Bloc de colonnes × rangs d'un format d'emprise (bw × bh) dans une zone L × H, marges m, gouttières
 * gx/gy, fonds perdus fp (partagés : fp seulement sur le pourtour, poses jointives).
 */
function bloc(L: number, H: number, bw: number, bh: number, fp: number, gx: number, gy: number, m: number, partage: boolean) {
  const pasX = bw + (partage ? 0 : 2 * fp) + gx;
  const pasY = bh + (partage ? 0 : 2 * fp) + gy;
  const utileW = L - 2 * m - (partage ? 2 * fp : 0);
  const utileH = H - 2 * m - (partage ? 2 * fp : 0);
  const colonnes = Math.max(0, Math.floor((utileW + gx + 1e-6) / pasX));
  const rangs = Math.max(0, Math.floor((utileH + gy + 1e-6) / pasY));
  const totalW = colonnes > 0 ? colonnes * pasX - gx + (partage ? 2 * fp : 0) : 0;
  const totalH = rangs > 0 ? rangs * pasY - gy + (partage ? 2 * fp : 0) : 0;
  return { pasX, pasY, colonnes, rangs, totalW, totalH };
}

/** Construit la grille demandée ; `poses` en ordre de lecture (rangs de haut en bas, colonnes de gauche à droite, puis la bande). */
export function construireGrille(p: ParamsImposition, o: OptionsGrille): Grille {
  const base = dimensionFeuille(p);
  const feuille = o.orientation === 'paysage' ? { largeur: base.hauteur, hauteur: base.largeur } : base;
  const L = feuille.largeur;
  const H = feuille.hauteur;
  const fp = Math.max(0, o.fp);
  const gx = Math.max(0, p.gouttiere_mm);
  const gy = Math.max(0, p.gouttiere_y_mm ?? p.gouttiere_mm);
  const m = Math.max(0, p.marge_mm);
  const w = p.fini.largeur;
  const h = p.fini.hauteur;
  const coin = p.calage === 'coin';
  const mp = Math.max(0, p.marge_pince_mm ?? m);
  const poses: GeoPose[] = [];
  const posesBloc = (b: ReturnType<typeof bloc>, bw: number, bh: number, rotation: Rotation, x0: number, y0: number, bande: number, rang0: number) => {
    // x0, y0 : coin bas-gauche du bloc, fonds perdus compris. y PDF part du bas : rangs de haut en bas.
    for (let r = 0; r < b.rangs; r++) {
      for (let c = 0; c < b.colonnes; c++) {
        const x = x0 + fp + c * b.pasX;
        const y = y0 + fp + (b.rangs - 1 - r) * b.pasY;
        poses.push({ x: arr(x), y: arr(y), largeur: w, hauteur: h, rotation, rang: rang0 + r, colonne: c, bande });
      }
    }
    void bw;
    void bh;
  };
  const droit = { bw: w, bh: h, rotation: 0 as Rotation };
  const tourne = { bw: h, bh: w, rotation: 90 as Rotation };
  const principal = o.rotation === '90' ? tourne : droit;
  const b1 = bloc(L, H, principal.bw, principal.bh, fp, gx, gy, m, o.partage);
  let bandes = 1;
  let rotation: Grille['rotation'] = o.rotation === '90' ? '90' : 'aucune';
  let totalW = b1.totalW;
  let totalH = b1.totalH;
  // Grille mixte : bande de poses tournées sous le bloc ou à sa droite, dans l'espace restant.
  let b2: (ReturnType<typeof bloc> & { ou: 'bas' | 'droite' }) | null = null;
  if (o.rotation === 'mixte' && b1.colonnes * b1.rangs > 0) {
    const resteH = H - 2 * m - b1.totalH - gy;
    const resteW = L - 2 * m - b1.totalW - gx;
    const bas = resteH > 0 ? { ...bloc(L, resteH + 2 * m, tourne.bw, tourne.bh, fp, gx, gy, m, o.partage), ou: 'bas' as const } : null;
    const droite = resteW > 0 ? { ...bloc(resteW + 2 * m, H, tourne.bw, tourne.bh, fp, gx, gy, m, o.partage), ou: 'droite' as const } : null;
    const nBas = bas ? bas.colonnes * bas.rangs : 0;
    const nDroite = droite ? droite.colonnes * droite.rangs : 0;
    if (nBas > 0 || nDroite > 0) {
      b2 = nBas >= nDroite ? bas! : droite!;
      bandes = 2;
      rotation = 'mixte';
      if (b2.ou === 'bas') {
        totalW = Math.max(b1.totalW, b2.totalW);
        totalH = b1.totalH + gy + b2.totalH;
      } else {
        totalW = b1.totalW + gx + b2.totalW;
        totalH = Math.max(b1.totalH, b2.totalH);
      }
    }
  }
  const x0 = coin ? mp : (L - totalW) / 2;
  const y0 = coin ? mp : (H - totalH) / 2;
  if (!b2) {
    posesBloc(b1, principal.bw, principal.bh, principal.rotation, x0, y0, 0, 0);
  } else if (b2.ou === 'bas') {
    posesBloc(b1, principal.bw, principal.bh, principal.rotation, x0 + (totalW - b1.totalW) / 2, y0 + b2.totalH + gy, 0, 0);
    posesBloc(b2, tourne.bw, tourne.bh, 90, x0 + (totalW - b2.totalW) / 2, y0, 1, b1.rangs);
  } else {
    posesBloc(b1, principal.bw, principal.bh, principal.rotation, x0, y0 + (totalH - b1.totalH) / 2, 0, 0);
    posesBloc(b2, tourne.bw, tourne.bh, 90, x0 + b1.totalW + gx, y0 + (totalH - b2.totalH) / 2, 1, 0);
  }
  return {
    feuille,
    paysage: o.orientation === 'paysage',
    poses,
    colonnes: b1.colonnes,
    rangs: b1.rangs,
    bandes,
    partages: o.partage,
    rotation,
    marges: { gauche: arr(x0), droite: arr(L - x0 - totalW), bas: arr(y0), haut: arr(H - y0 - totalH) },
  };
}

/** Les repères de coupe autour du bloc tiennent-ils dans la zone imprimable (au moins 2 mm visibles de chaque côté) ? */
function reperesTiennent(g: Grille, fp: number, mt: number): boolean {
  const besoin = mt + 1 + 2; // zone non imprimable + écart (1 mm) + 2 mm de trait visibles, mesurés depuis le bord des fonds perdus
  void fp;
  return Math.min(g.marges.gauche, g.marges.droite, g.marges.haut, g.marges.bas) >= besoin - 1e-6;
}

/** Meilleure grille pour des réglages donnés : orientation (si auto) et rotation des poses (si auto). */
export function meilleureGrille(p: ParamsImposition, fp = p.fonds_perdus_mm, partage = p.fonds_partages === true, mt = ATELIER_DEFAUT.marge_technique_mm): Grille {
  const orientations: ('portrait' | 'paysage')[] = p.orientation === 'portrait' ? ['portrait'] : p.orientation === 'paysage' ? ['paysage'] : ['portrait', 'paysage'];
  // En automatique, jamais de bande tournée : des poses de deux sens sur la même feuille compliquent la coupe.
  // Orientation de feuille imposée + rotation « auto » : poses droites (le sens du fichier est respecté) ;
  // tourner toutes les poses reste proposé en alternative quand cela en loge plus.
  const orientationForcee = p.orientation === 'portrait' || p.orientation === 'paysage';
  const rotations: OptionsGrille['rotation'][] = p.rotation_poses === '90' ? ['90'] : p.rotation_poses === 'mixte' ? ['aucune', '90', 'mixte'] : p.rotation_poses === 'auto' && !orientationForcee ? ['aucune', '90'] : ['aucune'];
  let meilleure: Grille | null = null;
  const rang = (r: Grille['rotation']) => (r === 'aucune' ? 0 : r === '90' ? 1 : 2);
  for (const orientation of orientations) {
    for (const rotation of rotations) {
      const g = construireGrille(p, { fp, orientation, partage, rotation });
      if (!meilleure) {
        meilleure = g;
        continue;
      }
      const n = g.poses.length;
      const nm = meilleure.poses.length;
      if (n > nm) meilleure = g;
      else if (n === nm) {
        // À égalité : repères visibles, puis grille droite avant tournée avant mixte, puis portrait.
        const rOk = reperesTiennent(g, fp, mt);
        const mOk = reperesTiennent(meilleure, fp, mt);
        if (rOk && !mOk) meilleure = g;
        else if (rOk === mOk && rang(g.rotation) < rang(meilleure.rotation)) meilleure = g;
      }
    }
  }
  return meilleure!;
}

/** Compatibilité : grille simple (orientation choisie, sans rotation ni partage). */
export function grillePoses(p: ParamsImposition): Grille {
  return meilleureGrille({ ...p, rotation_poses: 'aucune' }, p.fonds_perdus_mm, false);
}

function posesDeGrille(g: Grille, teteBeche: TeteBeche = 'aucune'): Pose[] {
  return g.poses.map((q) => {
    let rotation = q.rotation;
    const impair = teteBeche === 'colonnes' ? q.colonne % 2 === 1 : teteBeche === 'rangs' ? q.rang % 2 === 1 : teteBeche === 'damier' ? (q.rang + q.colonne) % 2 === 1 : false;
    if (impair) rotation = ((rotation + 180) % 360) as Rotation;
    const pose: Pose = { page: null, numero: null, x: q.x, y: q.y, largeur: q.largeur, hauteur: q.hauteur, rang: q.rang, colonne: q.colonne };
    if (rotation) pose.rotation = rotation;
    if (q.bande) pose.bande = q.bande;
    return pose;
  });
}

/** Fonds perdus partagés : les côtés jointifs à une voisine n'ont pas de fonds perdus. */
function marquerJoints(poses: Pose[], gx: number, gy: number): void {
  const eps = 0.05;
  for (const q of poses) {
    const e = emprise(q);
    const joints: Cote[] = [];
    for (const v of poses) {
      if (v === q) continue;
      const ev = emprise(v);
      const memeRang = Math.abs(v.y - q.y) < eps && Math.abs(ev.hauteur - e.hauteur) < eps;
      const memeCol = Math.abs(v.x - q.x) < eps && Math.abs(ev.largeur - e.largeur) < eps;
      if (memeRang && Math.abs(v.x + ev.largeur + gx - q.x) < eps) joints.push('gauche');
      if (memeRang && Math.abs(q.x + e.largeur + gx - v.x) < eps) joints.push('droite');
      if (memeCol && Math.abs(v.y + ev.hauteur + gy - q.y) < eps) joints.push('bas');
      if (memeCol && Math.abs(q.y + e.hauteur + gy - v.y) < eps) joints.push('haut');
    }
    if (joints.length) q.joints = joints;
  }
}

// ---------------------------------------------------------------------------
// Verso

/** Axe de retournement de la feuille : vertical (miroir gauche-droite) ou horizontal (miroir haut-bas). */
export function axeRetournement(retournement: 'bord_long' | 'bord_court', paysage: boolean): 'vertical' | 'horizontal' {
  // Bord long d'une feuille portrait = ses côtés : l'axe de rotation est vertical. En paysage, le bord long
  // est horizontal → miroir haut-bas. Bord court : l'inverse.
  return retournement === 'bord_long' ? (paysage ? 'horizontal' : 'vertical') : paysage ? 'vertical' : 'horizontal';
}

/** Bord de retournement effectif : celui demandé, ou (auto) celui qui donne l'axe naturel du plan. */
export function retournementEffectif(p: Pick<ParamsImposition, 'retournement'>, paysage: boolean, axeNaturel: 'vertical' | 'horizontal'): 'bord_long' | 'bord_court' {
  if (p.retournement === 'bord_long' || p.retournement === 'bord_court') return p.retournement;
  return axeRetournement('bord_long', paysage) === axeNaturel ? 'bord_long' : 'bord_court';
}

/**
 * Verso : positions en miroir pour que recto et verso se superposent après retournement, et rotation du
 * contenu pour que la pièce se lise à l'endroit quand on la retourne comme une page (axe horizontal :
 * un demi-tour ; « aucune » garde le contenu droit, comme un calendrier que l'on feuillette par le haut).
 */
export function faceVerso(poses: Pose[], feuille: Dimension, axe: 'vertical' | 'horizontal', rotationVerso: RotationVerso = 'auto'): Pose[] {
  return poses.map((q) => {
    const e = emprise(q);
    const t = q.rotation ?? 0;
    let rotation: Rotation;
    let x = q.x;
    let y = q.y;
    if (axe === 'vertical') {
      x = arr(feuille.largeur - q.x - e.largeur);
      rotation = ((360 - t) % 360) as Rotation;
      if (rotationVerso === '180') rotation = ((rotation + 180) % 360) as Rotation;
    } else {
      y = arr(feuille.hauteur - q.y - e.hauteur);
      rotation = rotationVerso === 'aucune' ? (((360 - t) % 360) as Rotation) : (((180 - t + 360) % 360) as Rotation);
    }
    const v: Pose = { ...q, x, y };
    if (rotation) v.rotation = rotation;
    else delete v.rotation;
    if (q.joints) v.joints = q.joints.map((c) => (axe === 'vertical' ? (c === 'gauche' ? 'droite' : c === 'droite' ? 'gauche' : c) : c === 'haut' ? 'bas' : c === 'bas' ? 'haut' : c));
    return v;
  });
}

function formaterNumero(n: Numerotation, i: number): string {
  return `${n.prefixe}${String(n.debut + i).padStart(n.chiffres, '0')}`;
}

// ---------------------------------------------------------------------------
// Décision de coupe

const METHODES_FABRIQUEES: MethodeFondsPerdus[] = ['intelligent', 'prolonger', 'miroir', 'etirer'];

/** Décide avec ou sans fonds perdus, et le système de coupe, d'après la demande et les mesures de l'analyse. */
export function resoudreCoupe(p: ParamsImposition, source?: SourcePlan): InfoCoupe {
  const fpDemande = Math.max(0, p.fonds_perdus_mm);
  // Zéro millimètre demandé en automatique = sans fonds perdus, système choisi d'après les mesures.
  const demande: Coupe = (p.coupe ?? 'auto') === 'auto' && fpDemande === 0 ? 'sans_auto' : (p.coupe ?? 'auto');
  // Livret et « une page par page » : sans fonds perdus, il n'y a ni gouttière ni cadre, seulement la coupe franche.
  const simple = p.operation === 'livret' || p.operation === 'fonds_perdus';
  const gx = Math.max(0, p.gouttiere_mm);
  const gy = Math.max(0, p.gouttiere_y_mm ?? p.gouttiere_mm);
  const m = source?.marge_blanche_min ?? (source?.marge_blanche ? Math.min(...Object.values(source.marge_blanche)) : null);
  const touche = source?.jusqu_au_bord === true || source?.bord_clair === true;
  const fonds = source?.fonds ?? null;
  const rendues = source?.nb_pages_rendues ?? 0;
  const total = source?.nb_pages ?? 0;
  const controle = source && rendues > 0 ? `${rendues} page${rendues > 1 ? 's' : ''} contrôlée${rendues > 1 ? 's' : ''} sur ${total}` : 'bords non contrôlés';
  const fabriquee = METHODES_FABRIQUEES.includes(p.methode_fonds_perdus) ? p.methode_fonds_perdus : 'intelligent';
  const rv = p.recto_verso;
  const base = { gouttiere_mm: gx, gouttiere_y_mm: gy, cadre_mm: 0, cadre_methode: p.cadre_methode ?? 'reduire', methode: p.methode_fonds_perdus, marge_encre_mm: m, pages_controlees: rendues, sur: total } as const;
  const avecFonds = (methode: MethodeFondsPerdus, raison: string, auto: boolean): InfoCoupe => ({ ...base, systeme: 'fonds_perdus', auto, fonds_perdus_mm: fpDemande || FONDS_PERDUS_STANDARD, methode, raison, alternatives: ['franche', 'double', 'cadre'] });
  const franche = (raison: string, auto: boolean): InfoCoupe => ({ ...base, systeme: 'franche', auto, fonds_perdus_mm: 0, methode: 'blanc', raison, alternatives: ['double', 'cadre', 'fonds_perdus'] });
  const double = (raison: string, auto: boolean, gMin: number): InfoCoupe => ({ ...base, systeme: 'double', auto, fonds_perdus_mm: 0, methode: 'blanc', gouttiere_mm: gx >= 2 ? gx : gMin, gouttiere_y_mm: gy >= 2 ? gy : gMin, raison, alternatives: ['franche', 'cadre', 'fonds_perdus'] });
  const cadre = (raison: string, auto: boolean): InfoCoupe => ({ ...base, systeme: 'cadre', auto, fonds_perdus_mm: 0, methode: 'blanc', cadre_mm: p.cadre_blanc_mm && p.cadre_blanc_mm > 0 ? p.cadre_blanc_mm : 3, raison, alternatives: ['franche', 'double', 'fonds_perdus'] });
  const aucune = (raison: string): InfoCoupe => ({ ...base, systeme: 'aucune', auto: false, fonds_perdus_mm: 0, methode: 'blanc', gouttiere_mm: 0, gouttiere_y_mm: 0, raison, alternatives: ['franche', 'fonds_perdus'] });
  const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');

  switch (demande) {
    case 'fonds_perdus':
      return avecFonds(p.methode_fonds_perdus === 'blanc' ? 'intelligent' : p.methode_fonds_perdus, `Fonds perdus de ${mm(fpDemande || FONDS_PERDUS_STANDARD)} mm demandés.`, false);
    case 'franche':
      return franche('Coupe franche demandée : poses jointives, un trait par ligne de coupe.', false);
    case 'double':
      return double('Double coupe demandée : une chute entre les poses, chaque pose a ses propres traits.', false, 4);
    case 'cadre':
      return cadre('Cadre blanc demandé : la coupe ne touche jamais l’encre.', false);
    case 'aucune':
      return aucune('Sans coupe : la page est imprimée telle quelle au format fini, sans trait.');
    default:
      break;
  }
  // Compatibilité des anciens réglages « blanc » avec des fonds perdus : l'espace réservé devient une gouttière (grille inchangée).
  if (demande === 'auto' && p.methode_fonds_perdus === 'blanc' && fpDemande > 0) {
    const d = double(`Aucun fond perdu dessiné : les ${mm(fpDemande)} mm réservés autour de chaque pose deviennent une gouttière de ${mm(gx + 2 * fpDemande)} mm (double coupe).`, true, 4);
    return { ...d, gouttiere_mm: arr(gx + 2 * fpDemande), gouttiere_y_mm: arr(gy + 2 * fpDemande), alternatives: ['franche', 'fonds_perdus', 'cadre'] };
  }
  if (demande === 'auto') {
    if (fonds === 'declares' || fonds === 'incertains') return avecFonds(p.methode_fonds_perdus === 'blanc' ? 'source' : p.methode_fonds_perdus, `Fonds perdus présents dans le fichier (${mm(source?.fonds_mm ?? fpDemande)} mm) : utilisés.`, true);
    if (!source) return avecFonds(fabriquee, 'Bords du visuel non contrôlés : fonds perdus fabriqués par sécurité.', true);
    if (touche || (m !== null && m < 1)) return avecFonds(fabriquee, `Le visuel va jusqu’au bord (${controle}) : fonds perdus fabriqués bord par bord.`, true);
    if (m === null) return avecFonds(fabriquee, 'Bords non contrôlés (Poppler absent) : fonds perdus fabriqués par sécurité.', true);
    if (m >= 3) return franche(`Encre à ${mm(m)} mm du bord au plus près (${controle}) : coupe franche, la coupe tombe dans le blanc.`, true);
    return double(`Encre à ${mm(m)} mm du bord (${controle}) : double coupe de 4 mm pour garder une marge sûre.`, true, 4);
  }
  // sans_auto
  if (simple) return franche(m !== null && m >= 1 && !touche ? `Sans fonds perdus : encre à ${mm(m)} mm du bord au plus près (${controle}).` : `Sans fonds perdus${touche ? ' : le visuel va jusqu’au bord, la coupe peut laisser un filet blanc' : ''}.`, true);
  if (m !== null && m >= 3 && !touche) return franche(`Encre à ${mm(m)} mm du bord au plus près (${controle}) : coupe franche.`, true);
  if (m !== null && m >= 1 && !touche) return double(`Encre à ${mm(m)} mm du bord (${controle}) : double coupe de 4 mm.`, true, 4);
  if (p.mode === 'repetition' && source?.bords_unis_partout === true) return franche('Visuel au bord mais bords unis sur les quatre côtés : en répétition, le voisin sert de fond perdu (coupe franche).', true);
  return double(`Visuel au bord${m === null ? ' ou non contrôlé' : ''} : double coupe de ${rv ? 6 : 4} mm, chaque pose garde ses propres traits.`, true, rv ? 6 : 4);
}

// ---------------------------------------------------------------------------
// Calepinage automatique des poses

const VALEURS_FP = (voulu: number, min: number): number[] => {
  const l = [voulu];
  for (let v = Math.floor(voulu * 2) / 2 - 0.5; v >= min - 1e-6; v -= 0.5) l.push(arr(v));
  return [...new Set(l.filter((v) => v >= 0))];
};

/**
 * Choisit fonds perdus, orientation, partage et rotation des poses pour loger le plus d'exemplaires :
 * le plus de poses, puis des repères visibles, puis les fonds perdus les plus larges, puis la grille
 * la plus simple. Le plan en garde la raison et les alternatives chiffrées.
 */
type PropositionRotation = { texte: string; alternative: InfoCalepinage['alternatives'][number] };

/**
 * Avec « Rotation des poses : auto », l'automatique ne tourne les poses que si la feuille est en orientation
 * automatique, et ne mélange jamais deux sens. Les autres dispositions (toutes tournées sur une feuille
 * imposée, bande tournée) sont calculées et proposées quand elles logent plus de poses.
 */
function propositionsRotation(p: ParamsImposition, fp: number, partage: boolean, nActuel: number, mt: number): PropositionRotation[] {
  if (p.rotation_poses !== 'auto') return [];
  const out: PropositionRotation[] = [];
  const orientationForcee = p.orientation === 'portrait' || p.orientation === 'paysage';
  if (orientationForcee) {
    const g = meilleureGrille({ ...p, rotation_poses: '90' }, fp, partage, mt);
    if (g.rotation === '90' && g.poses.length > nActuel) {
      out.push({ texte: `${g.poses.length} poses en tournant toutes les poses d’un quart de tour : à choisir dans « Rotation des poses » (Tournées) si besoin`, alternative: { fonds_perdus_mm: fp, poses: g.poses.length, partages: partage, rotation: '90', reperes_ok: reperesTiennent(g, fp, mt) } });
    }
  }
  const gm = meilleureGrille({ ...p, rotation_poses: 'mixte' }, fp, partage, mt);
  const nRef = Math.max(nActuel, ...out.map((x) => x.alternative.poses));
  if (gm.rotation === 'mixte' && gm.poses.length > nRef) {
    out.push({ texte: `${gm.poses.length} poses avec une bande tournée sur le côté (deux sens de coupe) : à choisir dans « Rotation des poses » (Bande tournée) si besoin`, alternative: { fonds_perdus_mm: fp, poses: gm.poses.length, partages: partage, rotation: 'mixte', reperes_ok: reperesTiennent(gm, fp, mt) } });
  }
  return out;
}

export function optimiser(p: ParamsImposition, source: SourcePlan | undefined, atelier: AtelierImposition, coupe: InfoCoupe): { params: ParamsImposition; info: InfoCalepinage | null } {
  if (p.operation !== 'poses' || coupe.systeme === 'aucune') return { params: p, info: null };
  const mt = atelier.marge_technique_mm;
  const auto = (p.calepinage ?? 'auto') === 'auto';
  if (!auto) {
    const g = meilleureGrille(p, p.fonds_perdus_mm, p.fonds_partages === true, mt);
    const propositions = propositionsRotation(p, p.fonds_perdus_mm, p.fonds_partages === true, g.poses.length, mt);
    const raison = ['Réglages manuels gardés', ...propositions.map((x) => x.texte)].join(' ; ') + '.';
    return { params: { ...p, orientation: g.paysage ? 'paysage' : 'portrait' }, info: { auto: false, fonds_perdus_mm: p.fonds_perdus_mm, demande_mm: p.fonds_perdus_mm, poses: g.poses.length, orientation: g.paysage ? 'paysage' : 'portrait', partages: g.partages, rotation: g.rotation, reperes_ok: reperesTiennent(g, p.fonds_perdus_mm, mt), raison, alternatives: propositions.map((x) => x.alternative) } };
  }
  const fpVoulu = coupe.systeme === 'fonds_perdus' ? Math.max(0, p.fonds_perdus_mm) : 0;
  const fps = fpVoulu > 0 ? VALEURS_FP(fpVoulu, Math.max(0.5, atelier.fonds_perdus_min_mm)) : [0];
  const partageable = coupe.systeme === 'fonds_perdus' && fpVoulu > 0 && p.mode === 'repetition' && p.methode_fonds_perdus !== 'miroir' && (p.fonds_partages === true || (p.fonds_partages !== false && source?.bords_unis_partout === true));
  const partages = p.fonds_partages === true ? [true] : partageable ? [false, true] : [false];
  type Cand = { fp: number; partage: boolean; g: Grille; n: number; ok: boolean };
  const candidats: Cand[] = [];
  for (const fp of fps) for (const partage of partages) {
    const g = meilleureGrille(p, fp, partage, mt);
    candidats.push({ fp, partage, g, n: g.poses.length, ok: reperesTiennent(g, fp, mt) });
  }
  const rang = (r: Grille['rotation']) => (r === 'aucune' ? 0 : r === '90' ? 1 : 2);
  // Repères obligatoires (défaut) : une grille sans repères lisibles n'est retenue que si aucune n'en a.
  const reperesDAbord = atelier.reperes_obligatoires !== false;
  candidats.sort((a, b) => (reperesDAbord ? Number(b.ok) - Number(a.ok) || b.n - a.n : b.n - a.n || Number(b.ok) - Number(a.ok)) || b.fp - a.fp || Number(a.partage) - Number(b.partage) || rang(a.g.rotation) - rang(b.g.rotation));
  const best = candidats[0]!;
  // Référence des comparaisons : fonds perdus demandés, poses droites, sans partage.
  const gRef = meilleureGrille({ ...p, rotation_poses: 'aucune' }, fps[0]!, false, mt);
  const reference = { fp: fps[0]!, partage: false, g: gRef, n: gRef.poses.length, ok: reperesTiennent(gRef, fps[0]!, mt) };
  const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
  const parties: string[] = [];
  if (best.n === 0) throw new Error('Aucune pose ne tient sur la feuille : réduisez les marges, les fonds perdus ou choisissez une feuille plus grande.');
  if (best.partage) parties.push(`fonds perdus de ${mm(best.fp)} mm partagés entre les poses (bords unis) : poses jointives, un seul trait par ligne de coupe`);
  else if (fpVoulu > 0 && best.fp < fpVoulu && best.n > reference.n) parties.push(`fonds perdus ${p.methode_fonds_perdus === 'source' ? 'du fichier rognés' : 'réduits'} à ${mm(best.fp)} mm : ${best.n} poses au lieu de ${reference.n} avec ${mm(fpVoulu)} mm`);
  else if (fpVoulu > 0 && best.fp < fpVoulu) parties.push(`fonds perdus réduits à ${mm(best.fp)} mm pour garder des repères de coupe lisibles (${best.n} poses, autant qu’avec ${mm(fpVoulu)} mm)`);
  else if (fpVoulu > 0) parties.push(`${mm(best.fp)} mm de fonds perdus ${p.methode_fonds_perdus === 'source' ? 'du fichier conservés' : 'gardés'}, ${best.n} poses`);
  if (best.g.rotation === 'mixte') parties.push(`une bande de poses tournées complète la feuille (${best.n} poses, ${reference.n} sans rotation)`);
  else if (best.g.rotation === '90') parties.push(`poses tournées d’un quart de tour (${best.n} au lieu de ${reference.n})`);
  // Poses tournées ou bande tournée : jamais choisies seules, mais proposées quand elles logeraient plus de poses.
  const propositions = propositionsRotation(p, best.fp, best.partage, best.n, mt);
  for (const x of propositions) parties.push(x.texte);
  if (!best.ok) parties.push('repères de coupe raccourcis ou omis : il manque de marge sur la feuille');
  const plusGrand = candidats.find((c) => c.n > best.n);
  if (reperesDAbord && plusGrand) parties.push(`${plusGrand.n} poses seraient possibles avec ${mm(plusGrand.fp)} mm de fonds perdus, mais sans repères de coupe lisibles (Paramètres > Imposition)`);
  const raison = parties.length ? `${parties[0]!.charAt(0).toUpperCase()}${parties[0]!.slice(1)}${parties.slice(1).map((x) => ` ; ${x}`).join('')}.` : `${best.n} poses par feuille.`;
  const vus = new Set<string>();
  const alternatives = [...propositions.map((x) => ({ fp: x.alternative.fonds_perdus_mm, partage: x.alternative.partages, g: { rotation: x.alternative.rotation } as Grille, n: x.alternative.poses, ok: x.alternative.reperes_ok })), ...candidats]
    .filter((c) => c !== best)
    .map((c) => ({ fonds_perdus_mm: c.fp, poses: c.n, partages: c.partage, rotation: c.g.rotation, reperes_ok: c.ok }))
    .filter((c) => {
      const cle = `${c.fonds_perdus_mm}|${c.partages}|${c.rotation}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    })
    .slice(0, 6);
  const params: ParamsImposition = { ...p, fonds_perdus_mm: best.fp, orientation: best.g.paysage ? 'paysage' : 'portrait', fonds_partages: best.partage, rotation_poses: best.g.rotation === 'mixte' ? 'mixte' : best.g.rotation === '90' ? '90' : 'aucune' };
  return { params, info: { auto: true, fonds_perdus_mm: best.fp, demande_mm: fpVoulu, poses: best.n, orientation: best.g.paysage ? 'paysage' : 'portrait', partages: best.partage, rotation: best.g.rotation, reperes_ok: best.ok, raison, alternatives } };
}

// ---------------------------------------------------------------------------
// Plans

export type PlanBrut = Omit<Plan, 'params_effectifs' | 'coupe' | 'calepinage' | 'retournement_effectif' | 'axe_verso' | 'consignes' | 'gouttiere_mm' | 'marge_mm'> & { retournement_effectif?: 'bord_long' | 'bord_court'; axe_verso?: 'vertical' | 'horizontal'; consignes?: string[] };
export const arrondiMm = arr;

/** Plan « poses ». `nbPages` : pages du PDF source. Les réglages sont ceux déjà résolus (coupe, calepinage). */
export function planPoses(p: ParamsImposition, nbPages: number, mt = ATELIER_DEFAUT.marge_technique_mm): PlanBrut {
  const avertissements: string[] = [];
  const g = meilleureGrille(p, p.fonds_perdus_mm, p.fonds_partages === true, mt);
  const n = g.poses.length;
  if (n === 0) throw new Error(`Aucune pose ne tient sur la feuille : réduisez les marges, les fonds perdus ou choisissez une feuille plus grande.`);
  const fini = p.fini;
  const paires = p.paires && p.paires.length ? p.paires : null;
  const rv = paires ? paires.some((x) => x.verso !== null) || p.recto_verso : p.recto_verso;
  const axe = axeRetournement(retournementEffectif(p, g.paysage, 'vertical'), g.paysage);
  const retournement = retournementEffectif(p, g.paysage, 'vertical');
  const gx = Math.max(0, p.gouttiere_mm);
  const gy = Math.max(0, p.gouttiere_y_mm ?? p.gouttiere_mm);
  const feuilles: FeuillePlan[] = [];
  const vides = () => {
    const poses = posesDeGrille(g, p.tete_beche ?? 'aucune');
    if (g.partages) marquerJoints(poses, gx, gy);
    return poses;
  };
  const versoDe = (recto: number | null): number | null => {
    if (recto === null) return null;
    if (paires) return paires.find((x) => x.recto === recto)?.verso ?? null;
    return rv ? recto + 1 : null;
  };

  if (p.mode === 'repetition') {
    // Un visuel = un recto (et son verso). Plusieurs visuels dans le fichier : chacun est répété sur toutes les
    // poses de sa propre feuille (un PDF de trois flyers donne trois feuilles), sauf si seul le premier est demandé.
    const visuels: { recto: number; verso: number | null }[] = paires
      ? paires
      : Array.from({ length: Math.max(1, rv ? Math.ceil(nbPages / 2) : nbPages) }, (_, i) => (rv ? { recto: 1 + 2 * i, verso: 2 + 2 * i <= nbPages ? 2 + 2 * i : null } : { recto: i + 1, verso: null }));
    const retenus = (p.repetition_visuels ?? 'chacun') === 'premier' ? visuels.slice(0, 1) : visuels;
    retenus.forEach((e, i) => {
      const recto = vides().map((q) => ({ ...q, page: e.recto }));
      const verso = rv ? faceVerso(vides(), g.feuille, axe, p.rotation_verso).map((q) => ({ ...q, page: e.verso })) : null;
      feuilles.push({ numero: i + 1, recto: { cote: 'recto', poses: recto, plis: [] }, verso: verso ? { cote: 'verso', poses: verso, plis: [] } : null });
    });
    if (rv && retenus.some((e) => e.verso === null)) avertissements.push(retenus.length === 1 ? 'Recto-verso demandé mais aucune page de verso : le verso sera vide.' : 'Recto-verso : le nombre de pages est impair, le dernier verso sera vide.');
  } else {
    // Éléments à placer : pages (séquence) ou exemplaires numérotés (coupe & empile avec numérotation).
    const num = p.mode === 'coupe_empile' ? (p.numerotation ?? null) : null;
    let elements: { page: number; numero: string | null }[];
    if (num) {
      const quantite = Math.max(1, Math.floor(p.quantite ?? 0));
      if (!(quantite > 0)) throw new Error('Indiquez la quantité de tickets à numéroter.');
      elements = Array.from({ length: quantite }, (_, i) => ({ page: 1, numero: formaterNumero(num, i) }));
    } else if (paires) {
      elements = paires.map((x) => ({ page: x.recto, numero: null }));
      if (rv && paires.some((x) => x.verso === null)) avertissements.push('Certaines pages recto n’ont pas de verso : leur verso sera vide.');
    } else {
      const pas = rv ? 2 : 1;
      const nb = Math.ceil(nbPages / pas);
      elements = Array.from({ length: nb }, (_, i) => ({ page: 1 + i * pas, numero: null }));
      if (rv && nbPages % 2 === 1) avertissements.push('Recto-verso : le nombre de pages est impair, le dernier verso sera vide.');
    }
    const nbFeuilles = Math.ceil(elements.length / n);
    for (let s = 0; s < nbFeuilles; s++) {
      const recto = vides();
      const verso = rv ? faceVerso(vides(), g.feuille, axe, p.rotation_verso) : null;
      for (let k = 0; k < n; k++) {
        // Séquence : la feuille s reçoit les éléments s·n … s·n+n-1. Coupe & empile : la pose k reçoit
        // l'élément k·nbFeuilles + s, pour que la pile k soit dans l'ordre après la coupe.
        const idx = p.mode === 'coupe_empile' ? k * nbFeuilles + s : s * n + k;
        const e = elements[idx];
        if (!e) continue;
        recto[k] = { ...recto[k]!, page: e.page, numero: e.numero };
        if (verso) {
          const v = num ? (paires ? paires[0]?.verso ?? null : nbPages >= 2 ? 2 : null) : versoDe(e.page);
          verso[k] = { ...verso[k]!, page: v !== null && v <= nbPages ? v : null, numero: num?.verso ? e.numero : null };
        }
      }
      feuilles.push({ numero: s + 1, recto: { cote: 'recto', poses: recto, plis: [] }, verso: verso ? { cote: 'verso', poses: verso, plis: [] } : null });
    }
    const posesVides = nbFeuilles * n - elements.length;
    if (p.mode === 'sequence' && posesVides > 0 && elements.length > 1) avertissements.push(`${posesVides} pose${posesVides > 1 ? 's' : ''} vide${posesVides > 1 ? 's' : ''} sur la dernière feuille : ${elements.length} visuels pour ${n} poses par feuille.`);
  }
  if (g.partages && p.mode !== 'repetition') avertissements.push('Fonds perdus partagés avec des visuels différents côte à côte : une dérive de coupe laisserait voir le voisin. Préférez des fonds perdus séparés.');
  const quantite = p.quantite && p.quantite > 0 ? p.quantite : null;
  const consignes: string[] = [];
  if (rv) consignes.push(`Pilote Xerox : recto-verso, retourner sur le ${retournement === 'bord_long' ? 'bord long' : 'bord court'} (feuille ${g.paysage ? 'paysage' : 'portrait'}).`);
  if (rv && axe === 'horizontal' && (p.rotation_verso ?? 'auto') !== 'aucune') consignes.push('Le verso est tourné d’un demi-tour pour que la pièce se lise à l’endroit quand on la retourne comme une page.');
  return {
    operation: 'poses',
    feuille: g.feuille,
    paysage: g.paysage,
    fini,
    fonds_perdus_mm: p.fonds_perdus_mm,
    colonnes: g.colonnes,
    rangs: g.rangs,
    poses_par_face: n,
    nb_feuilles: feuilles.length,
    nb_pages_sortie: feuilles.reduce((t, f) => t + 1 + (f.verso ? 1 : 0), 0),
    // Répétition : Q exemplaires de chaque visuel = Q / poses tirages de chaque feuille. Séquence : chaque feuille porte
    // une fois chaque visuel qu'elle contient ; Q exemplaires de chacun = Q tirages de chaque feuille.
    feuilles_a_imprimer: quantite ? (p.mode === 'repetition' ? feuilles.length * Math.ceil(quantite / n) : p.mode === 'sequence' || (p.mode === 'coupe_empile' && !p.numerotation) ? feuilles.length * quantite : feuilles.length) : null,
    pages_blanches: 0,
    feuilles,
    avertissements,
    retournement_effectif: retournement,
    axe_verso: axe,
    consignes,
  };
}

/**
 * Plan « fonds perdus » : une page de sortie par page source, format fini + fonds perdus (+ traits).
 * `sansMarge` (coupe « aucune ») : la feuille est exactement le format fini, sans trait.
 */
export function planFondsPerdus(p: ParamsImposition, nbPages: number, sansMarge = false): PlanBrut {
  const fp = sansMarge ? 0 : Math.max(0, p.fonds_perdus_mm);
  const marge = sansMarge ? 0 : p.traits_de_coupe ? Math.max(fp + 6, 8) : fp;
  const feuille = { largeur: arr(p.fini.largeur + 2 * marge), hauteur: arr(p.fini.hauteur + 2 * marge) };
  const feuilles: FeuillePlan[] = [];
  for (let i = 0; i < nbPages; i++) {
    feuilles.push({ numero: i + 1, recto: { cote: 'recto', poses: [{ page: i + 1, numero: null, x: marge, y: marge, largeur: p.fini.largeur, hauteur: p.fini.hauteur, rang: 0, colonne: 0 }], plis: [] }, verso: null });
  }
  const avertissements: string[] = [];
  if (sansMarge) avertissements.push('Sans coupe : la page fait exactement le format fini. Imprimer à 100 % (sans « ajuster à la page ») ; la machine laisse quelques millimètres blancs sur le bord.');
  return {
    operation: 'fonds_perdus',
    feuille,
    paysage: feuille.largeur > feuille.hauteur,
    fini: p.fini,
    fonds_perdus_mm: fp,
    colonnes: 1,
    rangs: 1,
    poses_par_face: 1,
    nb_feuilles: nbPages,
    nb_pages_sortie: nbPages,
    feuilles_a_imprimer: null,
    pages_blanches: 0,
    feuilles,
    avertissements,
  };
}

/** Plan « assembler » : les pages réunies dans l'ordre des pièces, sans imposition (une feuille par page). */
export function planAssembler(p: ParamsImposition, nbPages: number, pages?: { largeur: number; hauteur: number }[]): PlanBrut {
  const ordre = p.paires && p.paires.length ? p.paires.flatMap((x) => (x.verso !== null ? [x.recto, x.verso] : [x.recto])) : Array.from({ length: nbPages }, (_, i) => i + 1);
  const feuilles: FeuillePlan[] = ordre.map((n, i) => {
    const d = pages?.[n - 1] ?? pages?.[0] ?? { largeur: p.fini.largeur, hauteur: p.fini.hauteur };
    return { numero: i + 1, recto: { cote: 'recto', poses: [{ page: n, numero: null, x: 0, y: 0, largeur: d.largeur, hauteur: d.hauteur, rang: 0, colonne: 0 }], plis: [] }, verso: null };
  });
  const d0 = pages?.[0] ?? { largeur: p.fini.largeur, hauteur: p.fini.hauteur };
  return {
    operation: 'assembler',
    feuille: { largeur: d0.largeur, hauteur: d0.hauteur },
    paysage: d0.largeur > d0.hauteur,
    fini: d0,
    fonds_perdus_mm: 0,
    colonnes: 1,
    rangs: 1,
    poses_par_face: 1,
    nb_feuilles: feuilles.length,
    nb_pages_sortie: feuilles.length,
    feuilles_a_imprimer: null,
    pages_blanches: 0,
    feuilles,
    avertissements: [],
  };
}

/** Valeurs par défaut des réglages optionnels, pour les anciens modèles et les appels partiels. */
export function completerParams(p: ParamsImposition): ParamsImposition {
  return {
    ...p,
    coupe: p.coupe ?? 'auto',
    cadre_blanc_mm: p.cadre_blanc_mm ?? 0,
    cadre_methode: p.cadre_methode ?? 'reduire',
    traits_style: p.traits_de_coupe === false ? 'aucun' : (p.traits_style ?? 'auto'),
    calepinage: p.calepinage ?? 'auto',
    rotation_poses: p.rotation_poses ?? 'aucune',
    tete_beche: p.tete_beche ?? 'aucune',
    calage: p.calage ?? 'centre',
    retournement: p.retournement ?? 'auto',
    rotation_verso: p.rotation_verso ?? 'auto',
    ajustement: p.ajustement ?? 'auto',
    blanches: p.blanches ?? 'avant_derniere',
  };
}

export function calculerPlan(p0: ParamsImposition, nbPages: number, pages?: { largeur: number; hauteur: number }[], source?: SourcePlan, atelier: AtelierImposition = ATELIER_DEFAUT): Plan {
  if (nbPages < 1) throw new Error('Le fichier ne contient aucune page.');
  const p = completerParams(p0);
  const mt = Math.max(0, atelier.marge_technique_mm);
  const finaliser = (brut: PlanBrut, pEff: ParamsImposition, coupe: InfoCoupe, calepinage: InfoCalepinage | null): Plan => {
    const plan: Plan = {
      ...brut,
      params_effectifs: pEff,
      coupe,
      calepinage,
      gouttiere_mm: Math.max(0, pEff.gouttiere_mm),
      marge_mm: Math.max(0, pEff.marge_mm),
      retournement_effectif: brut.retournement_effectif ?? retournementEffectif(pEff, brut.paysage, 'vertical'),
      axe_verso: brut.axe_verso ?? 'vertical',
      consignes: brut.consignes ?? [],
    };
    decorerPlan(plan, pEff, mt);
    // Livret sans fonds perdus : rognage « aucun » (plié seulement) ou « face » (seule la tranche opposée au pli est coupée).
    const rognage = plan.livret?.rognage;
    if (rognage === 'aucun' || rognage === 'face') {
      const bords = plan.livret?.bords_face;
      for (const f of plan.feuilles) for (const face of [f.recto, f.verso]) {
        if (!face?.traits) continue;
        face.traits = rognage === 'aucun' || !bords ? [] : face.traits.filter((t) => (bords.axe === 'x' ? Math.abs(t.x1 - t.x2) < 0.01 && bords.positions.some((x) => Math.abs(x - t.x1) < 0.01) : Math.abs(t.y1 - t.y2) < 0.01 && bords.positions.some((y) => Math.abs(y - t.y1) < 0.01)));
      }
    }
    return plan;
  };
  if (p.operation === 'assembler') {
    const coupe: InfoCoupe = { systeme: 'aucune', auto: false, fonds_perdus_mm: 0, gouttiere_mm: 0, gouttiere_y_mm: 0, cadre_mm: 0, cadre_methode: 'reduire', methode: 'blanc', marge_encre_mm: null, pages_controlees: 0, sur: 0, raison: 'Pages réunies telles quelles.', alternatives: [] };
    const pEff = { ...p, fonds_perdus_mm: 0, gouttiere_mm: 0, traits_de_coupe: false, traits_style: 'aucun' as const };
    return finaliser(planAssembler(p, nbPages, pages), pEff, coupe, null);
  }
  // 1. Coupe : avec ou sans fonds perdus, et quel système.
  const coupe = resoudreCoupe(p, source);
  let pEff: ParamsImposition = {
    ...p,
    fonds_perdus_mm: coupe.fonds_perdus_mm,
    gouttiere_mm: coupe.gouttiere_mm,
    gouttiere_y_mm: coupe.gouttiere_y_mm,
    methode_fonds_perdus: coupe.methode,
    cadre_blanc_mm: coupe.cadre_mm,
    cadre_methode: coupe.cadre_methode,
    marge_mm: Math.max(Math.max(0, p.marge_mm), mt),
  };
  if (coupe.systeme === 'aucune') pEff = { ...pEff, traits_de_coupe: false, traits_style: 'aucun' };
  // 2. Calepinage des poses (le dépliant garde ses fonds perdus demandés : une pièce développée n'a pas de rotation).
  let calepinage: InfoCalepinage | null = null;
  if (pEff.operation === 'poses' && coupe.systeme !== 'aucune') {
    const r = optimiser(pEff, source, { ...atelier, marge_technique_mm: mt }, coupe);
    pEff = r.params;
    calepinage = r.info;
  }
  // 3. Plan.
  const brut = coupe.systeme === 'aucune' && pEff.operation !== 'livret' && pEff.operation !== 'depliant'
    ? planFondsPerdus(pEff, nbPages, true)
    : pEff.operation === 'depliant'
      ? planDepliant(pEff, nbPages)
    : pEff.operation === 'livret'
      ? planLivret(pEff, nbPages, coupe.systeme !== 'fonds_perdus')
      : pEff.operation === 'fonds_perdus'
        ? planFondsPerdus(pEff, nbPages)
        : planPoses(pEff, nbPages, mt);
  // 4. Mise au format (et cadre blanc).
  const cadre = coupe.cadre_mm > 0 && coupe.cadre_methode === 'reduire' ? coupe.cadre_mm : 0;
  if (source) {
    const a = cadre > 0 ? calculerAdaptationCadre(source.fini, pEff.fini, cadre, pEff.ajustement, source.marge_blanche) : calculerAdaptation(source.fini, pEff.fini, pEff.ajustement, source.marge_blanche);
    brut.adaptation = a.identique && !a.pivote ? null : a;
  } else if (cadre > 0) {
    // Images ou visuel non mesuré : le cadre réduit un visuel supposé au format.
    brut.adaptation = calculerAdaptationCadre(pEff.fini, pEff.fini, cadre, 'adapter', null);
  } else {
    brut.adaptation = null;
  }
  const plan = finaliser(brut, pEff, coupe, calepinage);
  if (coupe.systeme === 'franche' && pEff.operation === 'poses' && pEff.mode !== 'repetition') plan.avertissements.push('Coupe franche avec des visuels différents côte à côte : une dérive de coupe de 0,5 mm laisse un liseré du voisin. En cas de doute, choisissez la double coupe.');
  if (coupe.systeme !== 'fonds_perdus' && coupe.systeme !== 'aucune' && pEff.recto_verso && source?.jusqu_au_bord === true) plan.avertissements.push('Recto-verso sans fonds perdus avec un visuel au bord : couper sur les traits du recto ; le registre de la machine peut laisser un filet au verso.');
  if (coupe.systeme === 'franche' && source && source.nb_pages_rendues !== undefined && source.nb_pages !== undefined && source.nb_pages_rendues > 0 && source.nb_pages_rendues < source.nb_pages) plan.avertissements.push(`${source.nb_pages - source.nb_pages_rendues} page${source.nb_pages - source.nb_pages_rendues > 1 ? 's' : ''} intérieure${source.nb_pages - source.nb_pages_rendues > 1 ? 's' : ''} non contrôlée${source.nb_pages - source.nb_pages_rendues > 1 ? 's' : ''} : la coupe franche suppose que toutes ont la même marge blanche.`);
  if (coupe.systeme === 'double' && Math.min(coupe.gouttiere_mm, coupe.gouttiere_y_mm) < 2) plan.avertissements.push('Chute de moins de 2 mm entre les poses : bandelettes difficiles à manipuler au massicot.');
  return plan;
}

/** Paramètres de départ raisonnables pour un fichier analysé. */
export function paramsParDefaut(analyse: { fini: Dimension; fonds_perdus: string; fonds_perdus_mm: number; nb_pages: number; format: { famille: string } | null }, operation: Operation = 'poses'): ParamsImposition {
  const fpPresents = analyse.fonds_perdus !== 'absents';
  const famille = analyse.format?.famille;
  return {
    operation,
    feuille: 'sra3',
    orientation: 'auto',
    fini: { largeur: analyse.fini.largeur, hauteur: analyse.fini.hauteur },
    fonds_perdus_mm: fpPresents ? analyse.fonds_perdus_mm || FONDS_PERDUS_STANDARD : FONDS_PERDUS_STANDARD,
    methode_fonds_perdus: fpPresents ? 'source' : 'intelligent',
    gouttiere_mm: 0,
    marge_mm: 5,
    traits_de_coupe: true,
    traits_style: 'auto',
    recto_verso: analyse.nb_pages >= 2,
    retournement: 'auto',
    rotation_verso: 'auto',
    // Plusieurs visuels : répétition, chacun sur sa feuille (aucune pose vide) ; la séquence reste un choix explicite.
    mode: famille === 'ticket' ? 'coupe_empile' : 'repetition',
    quantite: undefined,
    numerotation: null,
    ajustement: 'auto',
    coupe: 'auto',
    cadre_blanc_mm: 0,
    cadre_methode: 'reduire',
    calepinage: 'auto',
    rotation_poses: 'auto',
    tete_beche: 'aucune',
    calage: 'centre',
    chasse_mm: 0,
    blanches: 'avant_derniere',
  };
}
