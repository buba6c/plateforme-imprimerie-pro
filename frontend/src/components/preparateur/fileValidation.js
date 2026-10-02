/**
 * Utilitaire pour valider les fichiers et leurs IDs
 */

/**
 * Vérifie si un ID de fichier est valide
 * @param {any} fileId - L'ID à vérifier
 * @returns {boolean} - true si l'ID est valide, false sinon
 */
export function isValidFileId(fileId) {
  if (fileId === null || fileId === undefined) {
    return false;
  }
  
  const stringId = String(fileId).trim().toLowerCase();
  
  if (stringId === '' || stringId === 'null' || stringId === 'undefined') {
    return false;
  }
  
  return true;
}

/**
 * Vérifie si un objet fichier est valide
 * @param {object} file - Le fichier à vérifier
 * @returns {boolean} - true si le fichier est valide, false sinon
 */
export function isValidFile(file) {
  if (!file || typeof file !== 'object') {
    return false;
  }
  
  return isValidFileId(file.id);
}

/**
 * Filtre un tableau de fichiers pour ne garder que ceux avec des IDs valides
 * @param {Array} files - Le tableau de fichiers à filtrer
 * @param {boolean} logWarnings - Si true, logge les fichiers invalides (défaut: true)
 * @returns {Array} - Le tableau filtré
 */
export function filterValidFiles(files, logWarnings = true) {
  if (!Array.isArray(files)) {
    return [];
  }
  
  return files.filter(file => {
    if (!isValidFile(file)) {
      if (logWarnings) {
        console.warn('[FileValidation] Fichier avec ID invalide ignoré:', file);
      }
      return false;
    }
    return true;
  });
}

/**
 * Valide et nettoie un tableau de fichiers
 * Retourne aussi le nombre de fichiers invalides trouvés
 * @param {Array} files - Le tableau de fichiers à valider
 * @returns {object} - { validFiles: Array, invalidCount: number }
 */
export function validateAndCleanFiles(files) {
  if (!Array.isArray(files)) {
    return { validFiles: [], invalidCount: 0 };
  }
  
  let invalidCount = 0;
  const validFiles = files.filter(file => {
    if (!isValidFile(file)) {
      invalidCount++;
      console.warn('[FileValidation] Fichier avec ID invalide ignoré:', file);
      return false;
    }
    return true;
  });
  
  return { validFiles, invalidCount };
}

export default {
  isValidFileId,
  isValidFile,
  filterValidFiles,
  validateAndCleanFiles,
};
