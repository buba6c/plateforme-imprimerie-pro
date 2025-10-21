/**
 * MAPPING DES SUPPORTS ET DOCUMENTS VERS LES TARIFS
 * Convertit les labels UI en clés de tarifs database
 */

// ============================================
// MAPS ROLAND - Support du matériau
// ============================================
const ROLAND_SUPPORT_MAP = {
  'Bâche': 'bache_m2',
  'Vinyle': 'vinyle_m2',
  'Vinyle Transparent': 'vinyle_m2',  // Même tarif que vinyle standard
  'Micro-perforé': 'vinyle_m2',       // À adapter si tarif spécifique
  'Tissu': 'toile_canvas_m2',
  'Backlit': 'papier_photo_m2',       // À adapter
  'Mesh': 'vinyle_m2',                // À adapter
  'Pré-découpe': 'bache_m2',          // À adapter
  'Kakemono': 'toile_canvas_m2',
};

// ============================================
// MAPS XEROX - Type de document & Format
// ============================================
const XEROX_DOCUMENT_MAP = {
  'Carte de visite': 'papier_a4_couleur',
  'Flyer': 'papier_a4_couleur',
  'Brochure': 'papier_a4_couleur',
  'Dépliant': 'papier_a4_couleur',
  'Affiche': 'papier_a3_couleur',
  'Catalogue': 'papier_a4_couleur',
};

const XEROX_FORMAT_MAP = {
  // Formats standards
  'A3': 'papier_a3_couleur',
  'A4': 'papier_a4_couleur',
  'A5': 'papier_a4_couleur',  // Même tarif A4
  'A6': 'papier_a4_couleur',  // Même tarif A4
  
  // Formats spécialisés
  'Carte de visite (85x55mm)': 'papier_a4_couleur',
  'Carte de visite (90x50mm)': 'papier_a4_couleur',
  '10x15cm': 'papier_a4_couleur',
  '13x18cm': 'papier_a4_couleur',
  '20x30cm': 'papier_a3_couleur',
  '21x29.7cm (A4)': 'papier_a4_couleur',
  '30x40cm': 'papier_a3_couleur',
  'Personnalisé': 'papier_a4_couleur',
};

const XEROX_GRAMMAGE_MAP = {
  '80g': 'papier_a4_couleur',
  '135g': 'papier_a4_couleur',
  '170g': 'papier_a4_couleur',
  '250g': 'papier_premium',
  '300g': 'papier_premium',
  '350g': 'papier_premium',
  'Offset': 'papier_a4_couleur',
  'Autocollant': 'papier_a4_couleur',
  'Grimat': 'papier_a4_couleur',
};

const XEROX_COULEUR_MAP = {
  'noir_et_blanc': 'papier_a4_nb',
  'couleur': 'papier_a4_couleur',
  'nb': 'papier_a4_nb',
  'bw': 'papier_a4_nb',
  'color': 'papier_a4_couleur',
  'color_recto_verso': 'papier_a4_couleur',
  'recto_simple': 'papier_a4_nb',
  'recto_verso': 'papier_a4_nb',
};

// ============================================
// OPTIONS COMMUNES
// ============================================
const FINITION_MAP = {
  'Pelliculage': 'pelliculage',
  'Vernis': 'vernis',
  'Vernis sélectif': 'vernis',
  'Découpe': 'coupage_decoupe',
  'Découpe à la forme': 'coupage_decoupe',
  'Montage': 'montage',
  'Installation': 'montage',
  'Livraison': 'livraison',
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Normalise un string pour comparaison (minuscules + sans accents)
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');  // Enlever accents
}

/**
 * Trouve une clé de tarif pour un label Roland support
 * @param {string} supportLabel - Label du support (ex: "Bâche")
 * @returns {string} - Clé de tarif (ex: "bache_m2")
 */
function mapRolandSupport(supportLabel) {
  if (!supportLabel) return null;
  
  // Cherche dans la map
  if (ROLAND_SUPPORT_MAP[supportLabel]) {
    return ROLAND_SUPPORT_MAP[supportLabel];
  }
  
  // Cherche avec normalisation (case-insensitive + sans accents)
  const normalized = normalizeString(supportLabel);
  for (const [label, tariffKey] of Object.entries(ROLAND_SUPPORT_MAP)) {
    if (normalizeString(label) === normalized) {
      return tariffKey;
    }
  }
  
  console.warn(`⚠️ Support "${supportLabel}" non mapé`);
  return null;
}

/**
 * Trouve une clé de tarif pour un type de document Xerox
 * @param {string} documentLabel - Label du document (ex: "Carte de visite")
 * @returns {string} - Clé de tarif
 */
function mapXeroxDocument(documentLabel) {
  if (!documentLabel) return null;
  
  if (XEROX_DOCUMENT_MAP[documentLabel]) {
    return XEROX_DOCUMENT_MAP[documentLabel];
  }
  
  const normalized = normalizeString(documentLabel);
  for (const [label, tariffKey] of Object.entries(XEROX_DOCUMENT_MAP)) {
    if (normalizeString(label) === normalized) {
      return tariffKey;
    }
  }
  
  console.warn(`⚠️ Document "${documentLabel}" non mapé`);
  return null;
}

/**
 * Trouve une clé de tarif pour un format Xerox
 * @param {string} formatLabel - Label du format (ex: "A4")
 * @returns {string|null} - Clé de tarif
 */
function mapXeroxFormat(formatLabel) {
  if (!formatLabel) return null;
  
  if (XEROX_FORMAT_MAP[formatLabel]) {
    return XEROX_FORMAT_MAP[formatLabel];
  }
  
  const normalized = normalizeString(formatLabel);
  for (const [label, tariffKey] of Object.entries(XEROX_FORMAT_MAP)) {
    if (normalizeString(label) === normalized) {
      return tariffKey;
    }
  }
  
  console.warn(`⚠️ Format "${formatLabel}" non mapé`);
  return null;
}

/**
 * Trouve une clé de tarif pour un type de couleur/mode impression Xerox
 * @param {string} couleurLabel - Mode d'impression
 * @returns {string|null} - Clé de tarif
 */
function mapXeroxCouleur(couleurLabel) {
  if (!couleurLabel) return 'papier_a4_couleur'; // Défaut: couleur
  
  if (XEROX_COULEUR_MAP[couleurLabel]) {
    return XEROX_COULEUR_MAP[couleurLabel];
  }
  
  const normalized = normalizeString(couleurLabel);
  for (const [label, tariffKey] of Object.entries(XEROX_COULEUR_MAP)) {
    if (normalizeString(label) === normalized) {
      return tariffKey;
    }
  }
  
  return 'papier_a4_couleur'; // Défaut: couleur
}

/**
 * Trouve une clé de tarif pour un grammage Xerox
 * @param {string} grammageLabel - Label du grammage
 * @returns {string|null} - Clé de tarif
 */
function mapXeroxGrammage(grammageLabel) {
  if (!grammageLabel) return 'papier_a4_couleur';
  
  if (XEROX_GRAMMAGE_MAP[grammageLabel]) {
    return XEROX_GRAMMAGE_MAP[grammageLabel];
  }
  
  const normalized = normalizeString(grammageLabel);
  for (const [label, tariffKey] of Object.entries(XEROX_GRAMMAGE_MAP)) {
    if (normalizeString(label) === normalized) {
      return tariffKey;
    }
  }
  
  return 'papier_a4_couleur'; // Défaut
}

/**
 * Trouve une clé de tarif pour une finition Xerox
 * @param {string} finitionLabel - Label de la finition
 * @returns {string|null} - Clé de tarif ou null
 */
function mapFinition(finitionLabel) {
  if (!finitionLabel) return null;
  
  if (FINITION_MAP[finitionLabel]) {
    return FINITION_MAP[finitionLabel];
  }
  
  const normalized = normalizeString(finitionLabel);
  for (const [label, tariffKey] of Object.entries(FINITION_MAP)) {
    if (normalizeString(label) === normalized) {
      return tariffKey;
    }
  }
  
  return null;
}

/**
 * Normalise les données du formulaire Roland pour l'estimation
 * @param {object} formData - Données brutes du formulaire
 * @returns {object} - Données normalisées avec clés de tarif
 */
function normalizeRolandData(formData) {
  return {
    ...formData,
    type_support: mapRolandSupport(formData.type_support),
    support: mapRolandSupport(formData.support),
  };
}

/**
 * Normalise les données du formulaire Xerox pour l'estimation
 * @param {object} formData - Données brutes du formulaire
 * @returns {object} - Données normalisées avec clés de tarif
 */
function normalizeXeroxData(formData) {
  return {
    ...formData,
    type_document: mapXeroxDocument(formData.type_document),
    format: mapXeroxDocument(formData.format),  // À adapter
  };
}

module.exports = {
  // Maps
  ROLAND_SUPPORT_MAP,
  XEROX_DOCUMENT_MAP,
  XEROX_FORMAT_MAP,
  XEROX_GRAMMAGE_MAP,
  XEROX_COULEUR_MAP,
  FINITION_MAP,
  
  // Functions - Utilities
  normalizeString,
  
  // Functions - Roland
  mapRolandSupport,
  
  // Functions - Xerox
  mapXeroxDocument,
  mapXeroxFormat,
  mapXeroxGrammage,
  mapXeroxCouleur,
  mapFinition,
  
  // Functions - Normalization
  normalizeRolandData,
  normalizeXeroxData,
};
