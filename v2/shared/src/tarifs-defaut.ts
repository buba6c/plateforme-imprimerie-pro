// Grille tarifaire de départ d'une installation neuve. Elle reprend les 24 tarifs de
// l'ancienne plateforme (mêmes codes et mêmes prix) et ajoute, sans prix, les supports et
// formats que l'atelier propose mais qui n'avaient pas de tarif : l'administrateur les
// renseigne dans l'écran Tarifs. En production, l'import reprend la grille réelle.

import type { Tarif } from './pricing';

export const TARIFS_DEFAUT: Tarif[] = [
  // Roland : supports au m²
  { machine: 'roland', categorie: 'support', code: 'bache_m2', libelle: 'Bâche standard', unite: 'm2', prix: 7000, actif: true },
  { machine: 'roland', categorie: 'support', code: 'vinyle_m2', libelle: 'Vinyle adhésif', unite: 'm2', prix: 9500, actif: true },
  { machine: 'roland', categorie: 'support', code: 'papier_photo_m2', libelle: 'Papier photo', unite: 'm2', prix: 8500, actif: true },
  { machine: 'roland', categorie: 'support', code: 'toile_canvas_m2', libelle: 'Toile canvas', unite: 'm2', prix: 12000, actif: true },
  { machine: 'roland', categorie: 'support', code: 'vinyle_transparent_m2', libelle: 'Vinyle transparent', unite: 'm2', prix: null, actif: true },
  { machine: 'roland', categorie: 'support', code: 'micro_perfore_m2', libelle: 'Vinyle micro-perforé', unite: 'm2', prix: null, actif: true },
  { machine: 'roland', categorie: 'support', code: 'backlit_m2', libelle: 'Backlit', unite: 'm2', prix: null, actif: true },
  { machine: 'roland', categorie: 'support', code: 'mesh_m2', libelle: 'Bâche mesh', unite: 'm2', prix: null, actif: true },
  { machine: 'roland', categorie: 'support', code: 'tissu_m2', libelle: 'Tissu', unite: 'm2', prix: null, actif: true },
  // Roland : finitions et options
  { machine: 'roland', categorie: 'finition', code: 'pelliculage', libelle: 'Pelliculage', unite: 'm2', prix: 1500, actif: true },
  { machine: 'roland', categorie: 'finition', code: 'vernis', libelle: 'Vernis sélectif', unite: 'm2', prix: 2000, actif: true },
  { machine: 'roland', categorie: 'finition', code: 'coupage_decoupe', libelle: 'Découpe à la forme', unite: 'forfait', prix: 3000, actif: true },
  { machine: 'roland', categorie: 'finition', code: 'oeillets', libelle: 'Œillets', unite: 'unite', prix: null, actif: true },
  { machine: 'roland', categorie: 'finition', code: 'ourlet', libelle: 'Ourlet', unite: 'ml', prix: null, actif: true },
  { machine: 'roland', categorie: 'option', code: 'livraison', libelle: 'Livraison', unite: 'forfait', prix: 5000, actif: true },
  { machine: 'roland', categorie: 'option', code: 'montage', libelle: 'Montage et installation', unite: 'forfait', prix: 10000, actif: true },
  // Xerox : formats à la face imprimée
  { machine: 'xerox', categorie: 'support', code: 'papier_a4_couleur', libelle: 'A4 couleur', unite: 'page', prix: 100, actif: true },
  { machine: 'xerox', categorie: 'support', code: 'papier_a4_nb', libelle: 'A4 noir et blanc', unite: 'page', prix: 50, actif: true },
  { machine: 'xerox', categorie: 'support', code: 'papier_a3_couleur', libelle: 'A3 couleur', unite: 'page', prix: 200, actif: true },
  { machine: 'xerox', categorie: 'support', code: 'papier_a3_nb', libelle: 'A3 noir et blanc', unite: 'page', prix: 100, actif: true },
  { machine: 'xerox', categorie: 'support', code: 'papier_a5_couleur', libelle: 'A5 couleur', unite: 'page', prix: null, actif: true },
  { machine: 'xerox', categorie: 'support', code: 'carte_visite', libelle: 'Carte de visite', unite: 'exemplaire', prix: null, actif: true },
  // Xerox : finitions et options
  { machine: 'xerox', categorie: 'finition', code: 'reliure_spirale', libelle: 'Reliure spirale', unite: 'forfait', prix: 500, actif: true },
  { machine: 'xerox', categorie: 'finition', code: 'reliure_thermique', libelle: 'Reliure thermique', unite: 'forfait', prix: 800, actif: true },
  { machine: 'xerox', categorie: 'finition', code: 'plastification', libelle: 'Plastification', unite: 'page', prix: 300, actif: true },
  { machine: 'xerox', categorie: 'finition', code: 'perforation', libelle: 'Perforation', unite: 'page', prix: 50, actif: true },
  { machine: 'xerox', categorie: 'finition', code: 'agrafage', libelle: 'Agrafage', unite: 'exemplaire', prix: null, actif: true },
  { machine: 'xerox', categorie: 'option', code: 'papier_premium', libelle: 'Papier premium', unite: 'page', prix: 50, actif: true },
  { machine: 'xerox', categorie: 'option', code: 'impression_recto_verso', libelle: 'Recto-verso', unite: 'feuille', prix: 20, actif: true },
  // Global
  { machine: 'global', categorie: 'divers', code: 'conception_graphique', libelle: 'Conception graphique', unite: 'forfait', prix: 15000, actif: true },
  { machine: 'global', categorie: 'divers', code: 'epreuve_numerique', libelle: 'Épreuve numérique (BAT)', unite: 'forfait', prix: 2000, actif: true },
  { machine: 'global', categorie: 'divers', code: 'urgence_24h', libelle: 'Urgence 24 h', unite: 'forfait', prix: 10000, actif: true },
  { machine: 'global', categorie: 'divers', code: 'urgence_48h', libelle: 'Urgence 48 h', unite: 'forfait', prix: 5000, actif: true },
];
