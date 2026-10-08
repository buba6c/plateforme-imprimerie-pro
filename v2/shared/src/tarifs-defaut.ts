// Grille tarifaire de départ d'une installation neuve. Elle reprend les tarifs de l'ancienne
// plateforme (mêmes codes et mêmes prix) et ajoute, sans prix, les supports, formats, papiers,
// finitions et services du formulaire de commande : l'administrateur les renseigne dans l'écran
// Tarifs ; tant qu'un prix manque, le calcul s'arrête avec « Prix de … à renseigner dans Tarifs ».
// En production, l'import reprend la grille réelle et complète avec cette liste.
//
// Une base déjà installée reçoit les mêmes ajouts par la migration 008_tarifs_enrichis.sql
// (à tenir alignée avec cette liste).

import { verifierCombinaisonTarif, type CategorieTarif, type Tarif, type UniteTarif } from './pricing';

const roland = (categorie: CategorieTarif, code: string, libelle: string, unite: UniteTarif, prix: number | null): Tarif => ({ machine: 'roland', categorie, code, libelle, unite, prix, actif: true });
const xerox = (categorie: CategorieTarif, code: string, libelle: string, unite: UniteTarif, prix: number | null): Tarif => ({ machine: 'xerox', categorie, code, libelle, unite, prix, actif: true });
const global = (categorie: CategorieTarif, code: string, libelle: string, unite: UniteTarif, prix: number | null): Tarif => ({ machine: 'global', categorie, code, libelle, unite, prix, actif: true });

export const TARIFS_DEFAUT: Tarif[] = [
  // Roland : supports au m² (le kakémono se vend à l'exemplaire, structure comprise)
  roland('support', 'bache_m2', 'Bâche standard', 'm2', 7000),
  roland('support', 'vinyle_m2', 'Vinyle adhésif', 'm2', 9500),
  roland('support', 'papier_photo_m2', 'Papier photo', 'm2', 8500),
  roland('support', 'toile_canvas_m2', 'Toile canvas', 'm2', 12000),
  roland('support', 'vinyle_transparent_m2', 'Vinyle transparent', 'm2', null),
  roland('support', 'micro_perfore_m2', 'Vinyle micro-perforé', 'm2', null),
  roland('support', 'backlit_m2', 'Backlit', 'm2', null),
  roland('support', 'mesh_m2', 'Bâche mesh', 'm2', null),
  roland('support', 'tissu_m2', 'Tissu', 'm2', null),
  roland('support', 'kakemono', 'Kakémono (structure comprise)', 'exemplaire', null),
  // Roland : finitions et options
  roland('finition', 'pelliculage', 'Pelliculage', 'm2', 1500),
  roland('finition', 'vernis', 'Vernis sélectif', 'm2', 2000),
  // Découpe à la forme : par exemplaire (A5 : même quantité en saisie manuelle et avec l'assistant).
  roland('finition', 'coupage_decoupe', 'Découpe à la forme', 'exemplaire', 3000),
  roland('finition', 'contrecollage_m2', 'Contrecollage PVC ou forex', 'm2', null),
  roland('finition', 'oeillets', 'Œillets', 'unite', null),
  roland('finition', 'ourlet', 'Ourlet', 'ml', null),
  roland('finition', 'collage', 'Collage des bords', 'ml', null),
  roland('option', 'montage', 'Pose sur site', 'forfait', 10000),
  // Xerox : formats à la face imprimée
  xerox('support', 'papier_a4_couleur', 'A4 couleur', 'page', 100),
  xerox('support', 'papier_a4_nb', 'A4 noir et blanc', 'page', 50),
  xerox('support', 'papier_a3_couleur', 'A3 couleur', 'page', 200),
  xerox('support', 'papier_a3_nb', 'A3 noir et blanc', 'page', 100),
  xerox('support', 'papier_a5_couleur', 'A5 couleur', 'page', null),
  xerox('support', 'papier_a5_nb', 'A5 noir et blanc', 'page', null),
  xerox('support', 'papier_a6_couleur', 'A6 couleur', 'page', null),
  xerox('support', 'papier_a6_nb', 'A6 noir et blanc', 'page', null),
  xerox('support', 'papier_sra3_couleur', 'SRA3 couleur', 'page', null),
  xerox('support', 'papier_sra3_nb', 'SRA3 noir et blanc', 'page', null),
  xerox('support', 'papier_10x15_couleur', 'Photo 10 × 15', 'page', null),
  xerox('support', 'papier_13x18_couleur', 'Photo 13 × 18', 'page', null),
  xerox('support', 'papier_20x30_couleur', 'Photo 20 × 30', 'page', null),
  xerox('support', 'carte_visite', 'Carte de visite', 'exemplaire', null),
  // Xerox : papiers (supplément par feuille ; l'ordinaire 80 g est compris dans le format)
  xerox('option', 'papier_couche_135', 'Papier couché 135 g', 'feuille', null),
  xerox('option', 'papier_couche_170', 'Papier couché 170 g', 'feuille', null),
  xerox('option', 'papier_carte_250_350', 'Papier carte 250 à 350 g', 'feuille', null),
  xerox('option', 'autocollant', 'Papier autocollant', 'feuille', null),
  xerox('option', 'papier_offset', 'Papier offset', 'feuille', null),
  xerox('option', 'papier_grimat', 'Papier grimat', 'feuille', null),
  // Xerox : finitions et façonnage
  xerox('finition', 'pelliculage_mat', 'Pelliculage mat', 'feuille', null),
  xerox('finition', 'pelliculage_brillant', 'Pelliculage brillant', 'feuille', null),
  xerox('finition', 'vernis_uv', 'Vernis UV', 'feuille', null),
  xerox('finition', 'coupe', 'Coupe au format', 'forfait', null),
  xerox('finition', 'agrafage', 'Agrafage (piqûre)', 'exemplaire', null),
  xerox('finition', 'dos_carre_colle', 'Dos carré collé', 'exemplaire', null),
  xerox('finition', 'rainage_pliage', 'Rainage et pliage', 'exemplaire', null),
  // Reliures : par exemplaire, comme l'ancienne plateforme les comptait (A5).
  xerox('finition', 'reliure_spirale', 'Reliure spirale', 'exemplaire', 500),
  xerox('finition', 'reliure_thermique', 'Reliure thermique', 'exemplaire', 800),
  xerox('finition', 'plastification', 'Plastification', 'page', 300),
  xerox('finition', 'perforation', 'Perforation', 'page', 50),
  xerox('finition', 'decoupe_forme', 'Découpe à la forme', 'exemplaire', null),
  xerox('finition', 'numerotation', 'Numérotation', 'exemplaire', null),
  xerox('option', 'papier_premium', 'Papier premium', 'page', 50),
  xerox('option', 'impression_recto_verso', 'Recto-verso', 'feuille', 20),
  // Commun aux deux machines. La livraison est commune (elle était rangée en Roland, donc
  // introuvable pour un dossier Xerox).
  global('option', 'livraison', 'Livraison', 'forfait', 5000),
  global('divers', 'conception_graphique', 'Conception graphique', 'forfait', 15000),
  global('divers', 'correction_fichiers', 'Correction des fichiers', 'forfait', null),
  global('divers', 'epreuve_numerique', 'Épreuve numérique (BAT)', 'forfait', 2000),
  global('divers', 'urgence_24h', 'Urgence 24 h', 'forfait', 10000),
  global('divers', 'urgence_48h', 'Urgence 48 h', 'forfait', 5000),
];

/** Tarif importé de l'ancienne plateforme, avant correction. */
export interface TarifImporte {
  machine: Tarif['machine'];
  /** Catégorie telle qu'écrite dans l'ancienne base (« papier », « service »…). */
  categorie: string;
  code: string;
  unite: UniteTarif;
}

/**
 * Corrige un tarif de l'ancienne plateforme pour qu'il soit utilisable par le moteur de prix (A3) :
 * - catégorie « papier » : un format (papier_a4_…, carte_visite) devient un support Xerox, un papier
 *   devient une option par feuille ;
 * - carte de visite : support Xerox par exemplaire (importée en « divers à l'unité », 100 cartes
 *   valaient le prix d'une seule) ;
 * - livraison : commune aux deux machines ;
 * - catégorie « service » : forfaits et services.
 * Renvoie la correction et une note lisible pour le rapport d'import, ou null si rien ne change.
 */
export function corrigerTarifImporte(t: TarifImporte): { machine: Tarif['machine']; categorie: CategorieTarif; unite: UniteTarif; note: string } | null {
  const cat = t.categorie.trim().toLowerCase();
  let machine = t.machine;
  let categorie: CategorieTarif = (['support', 'finition', 'option', 'divers'] as const).find((c) => c === cat) ?? 'divers';
  let unite = t.unite;
  const notes: string[] = [];
  const estFormat = /^(papier_(a\d|sra3|\d+x\d+)_|carte_visite|cdv)/.test(t.code);
  if (t.code === 'carte_visite') {
    machine = 'xerox';
    categorie = 'support';
    if (!['exemplaire', 'page', 'feuille'].includes(unite)) unite = 'exemplaire';
    notes.push('carte de visite : support Xerox facturé par exemplaire');
  } else if (cat === 'papier') {
    if (estFormat) {
      categorie = 'support';
      if (machine === 'global') machine = 'xerox';
      notes.push('catégorie « papier » : format rangé dans les supports Xerox');
    } else {
      categorie = 'option';
      if (machine === 'global') machine = 'xerox';
      if (unite === 'unite' || unite === 'forfait' || unite === 'm2' || unite === 'ml') unite = 'feuille';
      notes.push('catégorie « papier » : supplément papier rangé dans les options Xerox, par feuille');
    }
  } else if (cat === 'service' || cat === 'services') {
    categorie = 'divers';
    notes.push('catégorie « service » : forfaits et services');
  }
  if (t.code === 'livraison' && machine !== 'global') {
    machine = 'global';
    notes.push('livraison : commune aux deux machines');
  }
  if (t.code.startsWith('reliure') && unite === 'forfait') {
    unite = 'exemplaire';
    notes.push('reliure : comptée par exemplaire, comme dans l’ancienne plateforme');
  }
  if (verifierCombinaisonTarif({ machine, categorie, unite }) && categorie !== 'divers') {
    // Combinaison encore impossible : on garde les valeurs d'origine, l'écran Tarifs signalera l'erreur.
    return null;
  }
  if (machine === t.machine && categorie === cat && unite === t.unite) return null;
  return { machine, categorie, unite, note: notes.join(' ; ') || 'catégorie corrigée' };
}
