/**
 * Validations pour les nouvelles structures sections et supports
 * Date: 2025-10-30
 */

/**
 * Valide la structure d'une section Xerox
 * @param {Object} section - Section à valider
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateXeroxSection(section) {
  const errors = [];

  if (!section || typeof section !== 'object') {
    return { valid: false, errors: ['Section doit être un objet'] };
  }

  // Vérifications obligatoires
  if (!section.type || typeof section.type !== 'string') {
    errors.push('type est requis et doit être une chaîne');
  }

  if (!section.mode_impression || typeof section.mode_impression !== 'string') {
    errors.push('mode_impression est requis');
  } else if (!['recto_simple', 'recto_verso'].includes(section.mode_impression)) {
    errors.push('mode_impression doit être recto_simple ou recto_verso');
  }

  if (!section.copies || typeof section.copies !== 'number' || section.copies < 1) {
    errors.push('copies doit être un nombre positif');
  }

  // paper_types doit être un tableau non vide
  if (!Array.isArray(section.paper_types) || section.paper_types.length === 0) {
    errors.push('paper_types doit être un tableau non vide');
  } else {
    // Valider chaque paper_type
    section.paper_types.forEach((pt, index) => {
      if (!pt.grammage) {
        errors.push(`paper_types[${index}]: grammage est requis`);
      }
      if (!pt.type) {
        errors.push(`paper_types[${index}]: type est requis`);
      }
    });
  }

  // finitions et faconnage doivent être des tableaux (peuvent être vides)
  if (section.finitions !== undefined && !Array.isArray(section.finitions)) {
    errors.push('finitions doit être un tableau');
  }

  if (section.faconnage !== undefined && !Array.isArray(section.faconnage)) {
    errors.push('faconnage doit être un tableau');
  }

  // Règle spéciale: si type == 'Brochure', on devrait avoir au moins 2 paper_types (couverture + intérieur)
  if (section.type === 'Brochure' && section.paper_types && section.paper_types.length < 2) {
    errors.push('Une brochure nécessite au moins 2 types de papier (couverture + intérieur)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide la structure d'un support Roland
 * @param {Object} support - Support à valider
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateRolandSupport(support) {
  const errors = [];

  if (!support || typeof support !== 'object') {
    return { valid: false, errors: ['Support doit être un objet'] };
  }

  // Vérifications obligatoires
  if (!support.type_support || typeof support.type_support !== 'string') {
    errors.push('type_support est requis et doit être une chaîne');
  }

  if (!support.largeur || typeof support.largeur !== 'number' || support.largeur <= 0) {
    errors.push('largeur doit être un nombre positif');
  }

  if (!support.hauteur || typeof support.hauteur !== 'number' || support.hauteur <= 0) {
    errors.push('hauteur doit être un nombre positif');
  }

  if (!support.unite || typeof support.unite !== 'string') {
    errors.push('unite est requise (cm, m, etc.)');
  }

  if (!support.exemplaires || typeof support.exemplaires !== 'number' || support.exemplaires < 1) {
    errors.push('exemplaires doit être un nombre positif');
  }

  // finitions doit être un tableau (peut être vide)
  if (support.finitions !== undefined && !Array.isArray(support.finitions)) {
    errors.push('finitions doit être un tableau');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide un tableau de sections Xerox
 * @param {Array} sections - Tableau de sections
 * @returns {{valid: boolean, errors: string[], details: Object[]}}
 */
function validateSections(sections) {
  if (!Array.isArray(sections)) {
    return {
      valid: false,
      errors: ['sections doit être un tableau'],
      details: [],
    };
  }

  const allErrors = [];
  const details = [];

  sections.forEach((section, index) => {
    const validation = validateXeroxSection(section);
    details.push({
      index,
      valid: validation.valid,
      errors: validation.errors,
    });

    if (!validation.valid) {
      allErrors.push(`Section ${index + 1}: ${validation.errors.join(', ')}`);
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    details,
  };
}

/**
 * Valide un tableau de supports Roland
 * @param {Array} supports - Tableau de supports
 * @returns {{valid: boolean, errors: string[], details: Object[]}}
 */
function validateSupports(supports) {
  if (!Array.isArray(supports)) {
    return {
      valid: false,
      errors: ['supports doit être un tableau'],
      details: [],
    };
  }

  const allErrors = [];
  const details = [];

  supports.forEach((support, index) => {
    const validation = validateRolandSupport(support);
    details.push({
      index,
      valid: validation.valid,
      errors: validation.errors,
    });

    if (!validation.valid) {
      allErrors.push(`Support ${index + 1}: ${validation.errors.join(', ')}`);
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    details,
  };
}

/**
 * Valide le champ amount
 * @param {number} amount - Montant à valider
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateAmount(amount) {
  const errors = [];

  if (amount === null || amount === undefined) {
    // amount est facultatif, donc valide si non fourni
    return { valid: true, errors: [] };
  }

  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('amount doit être un nombre');
  } else if (amount < 0) {
    errors.push('amount ne peut pas être négatif');
  } else if (amount > 999999999.99) {
    errors.push('amount trop élevé (max: 999,999,999.99)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Middleware Express pour valider les sections/supports dans req.body
 */
function validateDossierData(req, res, next) {
  const errors = [];

  // Valider amount si présent
  if (req.body.amount !== undefined) {
    const amountValidation = validateAmount(req.body.amount);
    if (!amountValidation.valid) {
      errors.push(...amountValidation.errors);
    }
  }

  // Valider sections si présentes
  if (req.body.sections !== undefined) {
    const sectionsValidation = validateSections(req.body.sections);
    if (!sectionsValidation.valid) {
      errors.push(...sectionsValidation.errors);
    }
  }

  // Valider supports si présents
  if (req.body.supports !== undefined) {
    const supportsValidation = validateSupports(req.body.supports);
    if (!supportsValidation.valid) {
      errors.push(...supportsValidation.errors);
    }
  }

  // Si erreurs, retourner 400
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors,
    });
  }

  next();
}

module.exports = {
  validateXeroxSection,
  validateRolandSupport,
  validateSections,
  validateSupports,
  validateAmount,
  validateDossierData, // Middleware Express
};
