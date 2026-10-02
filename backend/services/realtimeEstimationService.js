/**
 * Service d'Estimation en Temps Réel
 * Calcul ultra-rapide du prix pendant la saisie du formulaire
 * Avec système de cache pour éviter les recalculs identiques
 */

const NodeCache = require('node-cache');
const dbHelper = require('../utils/dbHelper');

// Cache des estimations (durée: 5 minutes)
const estimationCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Cache des tarifs (durée: 10 minutes)
const tarifsCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

/**
 * Estime le prix en temps réel pendant la saisie
 * @param {object} formData - Données partielles du formulaire
 * @param {string} machineType - 'roland' ou 'xerox'
 * @returns {Promise<object>} - Estimation instantanée
 */
async function estimateRealtime(formData, machineType) {
  const startTime = Date.now();
  
  try {
    // 1. Générer une clé de cache basée sur les données
    const cacheKey = generateCacheKey(formData, machineType);
    
    // 2. Vérifier le cache
    const cachedResult = estimationCache.get(cacheKey);
    if (cachedResult) {
      console.log(`⚡ Estimation depuis cache (${Date.now() - startTime}ms)`);
      return {
        ...cachedResult,
        from_cache: true,
        calculation_time_ms: Date.now() - startTime
      };
    }
    
    // 3. Récupérer les tarifs (avec cache)
    const tarifs = await getTarifsWithCache(machineType);
    
    // 4. Calculer le prix
    const estimation = calculateQuickEstimate(formData, machineType, tarifs);
    
    // 5. Enrichir avec des infos utiles
    const result = {
      ...estimation,
      machine_type: machineType,
      calculated_at: new Date().toISOString(),
      from_cache: false,
      calculation_time_ms: Date.now() - startTime
    };
    
    // 6. Mettre en cache
    estimationCache.set(cacheKey, result);
    
    console.log(`💰 Estimation calculée: ${result.prix_estime} FCFA (${result.calculation_time_ms}ms)`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur estimation temps réel:', error);
    return {
      prix_estime: 0,
      error: true,
      message: 'Erreur de calcul',
      details: {},
      calculation_time_ms: Date.now() - startTime
    };
  }
}

/**
 * Convertit `valeur` (chaîne DECIMAL renvoyée par pg) en nombre pour chaque tarif.
 */
function normalizeTarifs(tarifs) {
  return (Array.isArray(tarifs) ? tarifs : []).map(t => {
    const n = parseFloat(t.valeur);
    return { ...t, valeur: Number.isFinite(n) ? n : 0 };
  });
}

/**
 * Calcul rapide sans validation stricte (pour temps réel)
 */
function calculateQuickEstimate(formData, machineType, tarifs) {
  // node-pg renvoie les DECIMAL/NUMERIC en chaînes ('3000.00') : sans conversion,
  // `prixFinitions += '3000.00'` CONCATÈNE au lieu d'additionner (ex. 4200003000 FCFA).
  tarifs = normalizeTarifs(tarifs);
  let prixBase = 0;
  let prixFinitions = 0;
  let prixOptions = 0;
  let details = {
    base: {},
    finitions: [],
    options: []
  };
  let warnings = [];
  
  if (machineType === 'roland') {
    // ============================================
    // CALCUL ROLAND - Basé sur SURFACE
    // ============================================
    
    const largeur = parseFloat(formData.largeur) || 0;
    const hauteur = parseFloat(formData.hauteur) || 0;
    const unite = formData.unite || 'cm';
    
    // Convertir en m² si nécessaire
    let surface = 0;
    if (unite === 'cm') {
      surface = (largeur * hauteur) / 10000; // cm² → m²
    } else if (unite === 'm') {
      surface = largeur * hauteur;
    } else {
      surface = (largeur * hauteur) / 1000000; // mm² → m²
    }
    
    details.base.dimensions = {
      largeur,
      hauteur,
      unite,
      surface_m2: surface.toFixed(4)
    };
    
    // Support / Matériau
    if (formData.support) {
      const tarifSupport = tarifs.find(t => 
        t.cle === `${formData.support}_m2` || 
        t.cle === formData.support ||
        t.cle.includes(formData.support)
      );
      
      if (tarifSupport) {
        prixBase = surface * tarifSupport.valeur;
        details.base.support = {
          type: formData.support,
          prix_unitaire: tarifSupport.valeur,
          prix_total: Math.round(prixBase)
        };
      } else {
        warnings.push(`Support "${formData.support}" non trouvé dans les tarifs`);
      }
    }
    
    // Quantité (nombre d'exemplaires)
    const quantite = parseInt(formData.quantite || formData.nombre_exemplaires) || 1;
    if (quantite > 1) {
      prixBase *= quantite;
      details.base.quantite = quantite;
    }
    
    // Finitions
    if (formData.finitions && Array.isArray(formData.finitions)) {
      formData.finitions.forEach(finition => {
        const tarifFinition = tarifs.find(t => 
          t.cle === finition || 
          t.cle.includes(finition)
        );
        
        if (tarifFinition) {
          let montant = 0;
          
          // Calculer selon l'unité
          if (tarifFinition.unite === 'm²' || tarifFinition.unite === 'm2') {
            montant = surface * tarifFinition.valeur * quantite;
          } else if (tarifFinition.unite === 'forfait') {
            montant = tarifFinition.valeur;
          } else {
            montant = tarifFinition.valeur * quantite;
          }
          
          prixFinitions += montant;
          details.finitions.push({
            nom: finition,
            prix_unitaire: tarifFinition.valeur,
            unite: tarifFinition.unite,
            prix_total: Math.round(montant)
          });
        }
      });
    }
    
    // Options supplémentaires
    if (formData.options && Array.isArray(formData.options)) {
      formData.options.forEach(option => {
        const tarifOption = tarifs.find(t => t.cle === option);
        if (tarifOption) {
          prixOptions += tarifOption.valeur;
          details.options.push({
            nom: option,
            prix: tarifOption.valeur
          });
        }
      });
    }
    
  } else if (machineType === 'xerox') {
    // ============================================
    // CALCUL XEROX - Basé sur PAGES
    // ============================================
    
    const nbPages = parseInt(formData.nombre_pages || formData.pages) || 0;
    const exemplaires = parseInt(formData.exemplaires || formData.nombre_exemplaires) || 1;
    const totalPages = nbPages * exemplaires;
    
    details.base.pages = {
      pages_par_document: nbPages,
      nombre_exemplaires: exemplaires,
      total_pages: totalPages
    };
    
    // Type de papier
    if (formData.papier) {
      const tarifPapier = tarifs.find(t => 
        t.cle === formData.papier || 
        t.cle.includes(formData.papier)
      );
      
      if (tarifPapier) {
        prixBase = totalPages * tarifPapier.valeur;
        details.base.papier = {
          type: formData.papier,
          prix_par_page: tarifPapier.valeur,
          prix_total: Math.round(prixBase)
        };
      } else {
        warnings.push(`Papier "${formData.papier}" non trouvé dans les tarifs`);
      }
    }
    
    // Couleur vs N&B
    const couleur = formData.couleur || formData.type_impression || 'noir_et_blanc';
    if (couleur === 'couleur') {
      const tarifCouleur = tarifs.find(t => t.cle === 'impression_couleur');
      if (tarifCouleur) {
        const supplementCouleur = totalPages * tarifCouleur.valeur;
        prixBase += supplementCouleur;
        details.base.couleur = {
          type: 'couleur',
          supplement: Math.round(supplementCouleur)
        };
      }
    }
    
    // Finitions
    if (formData.finitions && Array.isArray(formData.finitions)) {
      formData.finitions.forEach(finition => {
        const tarifFinition = tarifs.find(t => t.cle === finition);
        if (tarifFinition) {
          const montant = tarifFinition.valeur * exemplaires;
          prixFinitions += montant;
          details.finitions.push({
            nom: finition,
            prix_unitaire: tarifFinition.valeur,
            prix_total: Math.round(montant)
          });
        }
      });
    }
    
    // Reliure / Assemblage
    if (formData.reliure) {
      const tarifReliure = tarifs.find(t => t.cle === formData.reliure);
      if (tarifReliure) {
        const montant = tarifReliure.valeur * exemplaires;
        prixOptions += montant;
        details.options.push({
          nom: formData.reliure,
          prix: Math.round(montant)
        });
      }
    }
  }
  
  // ============================================
  // CALCUL FINAL
  // ============================================
  
  const prixTotal = prixBase + prixFinitions + prixOptions;
  
  // Arrondir au multiple de 100 supérieur (convention imprimerie)
  const prixEstime = Math.ceil(prixTotal / 100) * 100;
  
  return {
    prix_estime: prixEstime,
    prix_brut: Math.round(prixTotal),
    details: {
      base: Math.round(prixBase),
      finitions: Math.round(prixFinitions),
      options: Math.round(prixOptions),
      breakdown: details
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    is_partial: isPartialData(formData, machineType),
    message: getEstimationMessage(formData, machineType, prixEstime)
  };
}

/**
 * Récupère les tarifs avec cache
 */
async function getTarifsWithCache(machineType) {
  const cacheKey = `tarifs_${machineType}`;
  
  let tarifs = tarifsCache.get(cacheKey);
  
  if (!tarifs) {
    console.log(`📥 Chargement tarifs ${machineType}...`);
    const [rows] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE',
      [machineType]
    );
    tarifs = rows;
    tarifsCache.set(cacheKey, tarifs);
  }
  
  return tarifs;
}

/**
 * Génère une clé de cache unique basée sur les données
 */
function generateCacheKey(formData, machineType) {
  const relevantFields = machineType === 'roland' 
    ? ['largeur', 'hauteur', 'unite', 'support', 'quantite', 'finitions', 'options']
    : ['nombre_pages', 'exemplaires', 'papier', 'couleur', 'finitions', 'reliure'];
  
  const keyData = {};
  relevantFields.forEach(field => {
    if (formData[field] !== undefined) {
      keyData[field] = formData[field];
    }
  });
  
  return `${machineType}_${JSON.stringify(keyData)}`;
}

/**
 * Vérifie si les données sont partielles
 */
function isPartialData(formData, machineType) {
  if (machineType === 'roland') {
    return !formData.largeur || !formData.hauteur || !formData.support;
  } else {
    return !formData.nombre_pages || !formData.papier;
  }
}

/**
 * Génère un message contextuel
 */
function getEstimationMessage(formData, machineType, prix) {
  if (prix === 0) {
    return 'Remplissez les champs pour obtenir une estimation';
  }
  
  if (isPartialData(formData, machineType)) {
    return 'Estimation partielle - complétez les champs obligatoires';
  }
  
  return 'Estimation complète';
}

/**
 * Vide le cache des tarifs (utile après mise à jour)
 */
function clearTarifsCache() {
  tarifsCache.flushAll();
  console.log('🗑️  Cache tarifs vidé');
}

/**
 * Vide le cache des estimations
 */
function clearEstimationsCache() {
  estimationCache.flushAll();
  console.log('🗑️  Cache estimations vidé');
}

/**
 * Obtient les statistiques du cache
 */
function getCacheStats() {
  return {
    estimations: estimationCache.getStats(),
    tarifs: tarifsCache.getStats()
  };
}

module.exports = {
  estimateRealtime,
  clearTarifsCache,
  clearEstimationsCache,
  getCacheStats
};
