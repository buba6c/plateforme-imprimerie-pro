/**
 * Module de validation pour l'API backend
 * Contient des fonctions de validation réutilisables
 */

/**
 * Valide si une chaîne est un UUID valide (v4)
 * @param {string} value - La valeur à valider
 * @returns {boolean} - true si UUID valide, false sinon
 */
const isValidUUID = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  // Pattern UUID v4: 8-4-4-4-12 caractères hexadécimaux
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim());
};

/**
 * Valide si une chaîne est un entier positif valide
 * @param {string|number} value - La valeur à valider
 * @returns {boolean} - true si entier positif valide, false sinon
 */
const isValidPositiveInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0 && num.toString() === value.toString();
};

/**
 * Valide si une chaîne est un ID valide (UUID ou entier positif)
 * Utile pour supporter les deux types de clés primaires
 * @param {string|number} value - La valeur à valider
 * @returns {boolean} - true si ID valide, false sinon
 */
const isValidId = (value) => {
  return isValidUUID(value) || isValidPositiveInteger(value);
};

/**
 * Middleware Express pour valider un paramètre UUID
 * @param {string} paramName - Le nom du paramètre à valider (ex: 'id', 'dossierId')
 * @returns {Function} - Middleware Express
 */
const validateUUIDParam = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    
    if (!value) {
      return res.status(400).json({
        error: `Paramètre ${paramName} requis`,
        code: 'MISSING_PARAMETER',
        parameter: paramName
      });
    }
    
    if (!isValidUUID(value)) {
      return res.status(400).json({
        error: `Format UUID invalide pour le paramètre ${paramName}`,
        code: 'INVALID_UUID_FORMAT',
        parameter: paramName,
        value: value.substring(0, 50) // Limiter la taille pour éviter les logs trop longs
      });
    }
    
    next();
  };
};

/**
 * Middleware Express pour valider un paramètre ID (UUID ou entier)
 * @param {string} paramName - Le nom du paramètre à valider
 * @returns {Function} - Middleware Express
 */
const validateIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    
    if (!value) {
      return res.status(400).json({
        error: `Paramètre ${paramName} requis`,
        code: 'MISSING_PARAMETER',
        parameter: paramName
      });
    }
    
    if (!isValidId(value)) {
      return res.status(400).json({
        error: `Format ID invalide pour le paramètre ${paramName}`,
        code: 'INVALID_ID_FORMAT',
        parameter: paramName,
        value: value.substring(0, 50)
      });
    }
    
    next();
  };
};

/**
 * Valide une adresse email
 * @param {string} email - L'email à valider
 * @returns {boolean} - true si email valide, false sinon
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Valide un numéro de téléphone sénégalais
 * @param {string} phone - Le numéro à valider
 * @returns {boolean} - true si valide, false sinon
 */
const isValidSenegalPhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Format: +221 XX XXX XX XX ou 77/78/70/76/75 XXX XX XX
  const phoneRegex = /^(\+221|00221)?[7][0-8][0-9]{7}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

/**
 * Nettoie et valide les données de pagination
 * @param {object} query - Objet query de la requête Express
 * @returns {object} - Objet avec page, limit et offset validés
 */
const validatePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

module.exports = {
  isValidUUID,
  isValidPositiveInteger,
  isValidId,
  validateUUIDParam,
  validateIdParam,
  isValidEmail,
  isValidSenegalPhone,
  validatePagination
};
