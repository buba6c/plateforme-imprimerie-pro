/**
 * Utilitaire de normalisation de chaînes pour le matching de tarifs
 * Gère les accents, la casse, les espaces et les variantes
 */

/**
 * Supprime les accents d'une chaîne
 * @param {string} str - Chaîne à normaliser
 * @returns {string} - Chaîne sans accents
 */
function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalise une chaîne pour le matching
 * @param {string} str - Chaîne à normaliser
 * @returns {string} - Chaîne normalisée
 */
function normalizeString(str) {
  if (!str) return '';
  return removeAccents(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_') // Remplace les espaces par des underscores
    .replace(/[^a-z0-9_]/g, ''); // Supprime les caractères spéciaux
}

/**
 * Trouve un tarif en utilisant une normalisation intelligente
 * @param {string} searchTerm - Terme de recherche (ex: "Bâche", "Vinyle")
 * @param {Array} tarifs - Liste des tarifs disponibles
 * @param {string} suffix - Suffixe optionnel (ex: "_m2")
 * @returns {Object|null} - Tarif trouvé ou null
 */
function findTarifByNormalizedMatch(searchTerm, tarifs, suffix = '') {
  if (!searchTerm || !tarifs || !Array.isArray(tarifs)) {
    return null;
  }

  const normalizedSearch = normalizeString(searchTerm);
  const searchWithSuffix = suffix ? `${normalizedSearch}${suffix}` : normalizedSearch;

  console.log(`🔍 Recherche tarif pour "${searchTerm}" (normalisé: "${normalizedSearch}")`);

  // Stratégie 1: Match exact avec suffixe
  let found = tarifs.find(t => {
    const normalizedCle = normalizeString(t.cle);
    return normalizedCle === searchWithSuffix;
  });

  if (found) {
    console.log(`   ✅ Match exact avec suffixe: ${found.cle}`);
    return found;
  }

  // Stratégie 2: Match exact sans suffixe
  found = tarifs.find(t => {
    const normalizedCle = normalizeString(t.cle).replace(suffix, '');
    return normalizedCle === normalizedSearch;
  });

  if (found) {
    console.log(`   ✅ Match exact sans suffixe: ${found.cle}`);
    return found;
  }

  // Stratégie 3: Match partiel (contient)
  found = tarifs.find(t => {
    const normalizedCle = normalizeString(t.cle);
    const normalizedLabel = normalizeString(t.label || '');
    return normalizedCle.includes(normalizedSearch) || 
           normalizedSearch.includes(normalizedCle.replace(suffix, '')) ||
           normalizedLabel.includes(normalizedSearch);
  });

  if (found) {
    console.log(`   ✅ Match partiel: ${found.cle}`);
    return found;
  }

  // Stratégie 4: Match avec variantes communes
  const variants = generateVariants(normalizedSearch);
  for (const variant of variants) {
    found = tarifs.find(t => {
      const normalizedCle = normalizeString(t.cle).replace(suffix, '');
      return normalizedCle === variant || normalizedCle.includes(variant);
    });
    if (found) {
      console.log(`   ✅ Match variante "${variant}": ${found.cle}`);
      return found;
    }
  }

  console.log(`   ❌ Aucun tarif trouvé pour "${searchTerm}"`);
  return null;
}

/**
 * Génère des variantes possibles d'un terme
 * @param {string} term - Terme normalisé
 * @returns {Array<string>} - Liste de variantes
 */
function generateVariants(term) {
  const variants = [term];
  
  // Variantes avec/sans underscore
  if (term.includes('_')) {
    variants.push(term.replace(/_/g, ''));
  }
  
  // Variantes courantes
  const commonVariants = {
    'bache': ['bache', 'baches'],
    'vinyle': ['vinyle', 'vinyl', 'vinyles'],
    'papier': ['papier', 'papiers'],
    'toile': ['toile', 'toiles'],
    'canvas': ['canvas', 'canevas'],
    'affiche': ['affiche', 'affiches', 'poster', 'posters'],
    'flyer': ['flyer', 'flyers', 'tract', 'tracts'],
    'brochure': ['brochure', 'brochures', 'livret', 'livrets'],
  };
  
  for (const [key, values] of Object.entries(commonVariants)) {
    if (term.includes(key)) {
      variants.push(...values);
    }
  }
  
  return [...new Set(variants)]; // Dédupliquer
}

/**
 * Compare deux chaînes de manière normalisée
 * @param {string} str1 - Première chaîne
 * @param {string} str2 - Deuxième chaîne
 * @returns {boolean} - true si les chaînes sont équivalentes
 */
function normalizedEquals(str1, str2) {
  return normalizeString(str1) === normalizeString(str2);
}

module.exports = {
  removeAccents,
  normalizeString,
  findTarifByNormalizedMatch,
  generateVariants,
  normalizedEquals
};
