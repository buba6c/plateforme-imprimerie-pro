/**
 * Service d'Estimation en Temps Réel
 * Calcul ultra-rapide du prix pendant la saisie du formulaire
 * Avec système de cache pour éviter les recalculs identiques
 */

const NodeCache = require('node-cache');
const dbHelper = require('../utils/dbHelper');
const { 
  mapRolandSupport, 
  mapXeroxDocument,
  mapXeroxFormat,
  mapXeroxGrammage,
  mapXeroxCouleur,
  mapFinition,
  normalizeRolandData,
  normalizeXeroxData
} = require('../utils/tariffMapping');

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
    // DEBUG: Log les données reçues
    console.log(`📥 REÇU - machineType: ${machineType}`);
    console.log(`📥 formData keys:`, Object.keys(formData));
    console.log(`📥 formData.nombre_exemplaires:`, formData.nombre_exemplaires, typeof formData.nombre_exemplaires);
    console.log(`📥 formData.exemplaires:`, formData.exemplaires, typeof formData.exemplaires);
    
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
 * Calcul rapide sans validation stricte (pour temps réel)
 */
function calculateQuickEstimate(formData, machineType, tarifs) {
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
    const supportField = formData.type_support || formData.support;
    if (supportField) {
      // Mapper le label du support vers la clé de tarif
      const tarifClue = mapRolandSupport(supportField);
      
      console.log(`🔍 Roland Support: "${supportField}" → Clé tarif: "${tarifClue}"`);
      
      const tarifSupport = tarifClue 
        ? tarifs.find(t => t.cle === tarifClue)
        : null;
      
      if (tarifSupport) {
        prixBase = surface * tarifSupport.valeur;
        details.base.support = {
          type: supportField,
          tarif_cle: tarifClue,
          prix_unitaire: parseFloat(tarifSupport.valeur),
          surface_m2: parseFloat(surface.toFixed(4)),
          prix_total: Math.round(prixBase)
        };
        console.log(`✅ Tarif trouvé: ${tarifSupport.valeur} FCFA/m² × ${surface.toFixed(2)}m² = ${Math.round(prixBase)} FCFA`);
      } else {
        console.warn(`⚠️ Support "${supportField}" (clé: "${tarifClue}") non trouvé dans les tarifs`);
        warnings.push(`Support "${supportField}" non trouvé dans les tarifs`);
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
    
    // Si nombre_pages n'est pas fourni, par défaut 1 page par document
    const nbPages = parseInt(formData.nombre_pages || formData.pages || 1) || 1;
    const exemplaires = parseInt(formData.exemplaires || formData.nombre_exemplaires) || 1;
    const totalPages = nbPages * exemplaires;
    
    details.base.pages = {
      pages_par_document: nbPages,
      nombre_exemplaires: exemplaires,
      total_pages: totalPages
    };
    
    // Déterminer le tarif papier basé sur format et couleur
    let tarifPapierCle = null;
    
    // Option 1: Format explicite
    if (formData.format) {
      tarifPapierCle = mapXeroxFormat(formData.format);
      console.log(`🔍 Xerox Format: "${formData.format}" → Clé tarif: "${tarifPapierCle}"`);
    }
    
    // Option 2: Type de document
    if (!tarifPapierCle && formData.type_document) {
      tarifPapierCle = mapXeroxDocument(formData.type_document);
      console.log(`🔍 Xerox Document: "${formData.type_document}" → Clé tarif: "${tarifPapierCle}"`);
    }
    
    // Option 3: Grammage
    if (!tarifPapierCle && formData.grammage) {
      tarifPapierCle = mapXeroxGrammage(formData.grammage);
      console.log(`🔍 Xerox Grammage: "${formData.grammage}" → Clé tarif: "${tarifPapierCle}"`);
    }
    
    // Option 4: Couleur/Mode impression
    if (!tarifPapierCle && formData.couleur_impression) {
      tarifPapierCle = mapXeroxCouleur(formData.couleur_impression);
      console.log(`🔍 Xerox Couleur: "${formData.couleur_impression}" → Clé tarif: "${tarifPapierCle}"`);
    }
    
    // Défaut: A4 Couleur
    if (!tarifPapierCle) {
      tarifPapierCle = 'papier_a4_couleur';
      console.log(`🔍 Xerox: Défaut → Clé tarif: "papier_a4_couleur"`);
    }
    
    // Chercher le tarif en base
    const tarifPapier = tarifPapierCle ? tarifs.find(t => t.cle === tarifPapierCle) : null;
    
    if (tarifPapier) {
      prixBase = totalPages * parseFloat(tarifPapier.valeur);
      details.base.papier = {
        type: formData.format || formData.type_document || 'Papier standard',
        tarif_cle: tarifPapierCle,
        prix_par_page: parseFloat(tarifPapier.valeur),
        total_pages: totalPages,
        prix_total: Math.round(prixBase)
      };
      console.log(`✅ Tarif papier trouvé: ${tarifPapier.valeur} FCFA/page × ${totalPages} pages = ${Math.round(prixBase)} FCFA`);
    } else {
      console.warn(`⚠️ Papier "${tarifPapierCle}" non trouvé dans les tarifs`);
      warnings.push(`Papier non trouvé dans les tarifs`);
    }
    
    // Finitions (Plastification, Reliure, etc.)
    if (formData.finition && Array.isArray(formData.finition)) {
      for (const finitionLabel of formData.finition) {
        const finitionCle = mapFinition(finitionLabel);
        if (finitionCle) {
          const tarifFinition = tarifs.find(t => t.cle === finitionCle);
          if (tarifFinition) {
            let montant = parseFloat(tarifFinition.valeur);
            // Si c'est un prix forfaitaire par exemplaire, multiplier
            if (tarifFinition.unite === 'forfait' || tarifFinition.unite === 'exemplaire') {
              montant = montant * exemplaires;
            }
            prixFinitions += montant;
            details.finitions.push({
              nom: finitionLabel,
              tarif_cle: finitionCle,
              prix_unitaire: parseFloat(tarifFinition.valeur),
              prix_total: Math.round(montant)
            });
          }
        }
      }
    }
    
    // Façonnage (Découpe, Reliure, etc.)
    if (formData.faconnage && Array.isArray(formData.faconnage)) {
      for (const faconnageLabel of formData.faconnage) {
        const facconnageCle = mapFinition(faconnageLabel); // Réutilise le mapping finitions
        if (facconnageCle) {
          const tarifFaconnage = tarifs.find(t => t.cle === facconnageCle);
          if (tarifFaconnage) {
            let montant = parseFloat(tarifFaconnage.valeur);
            if (tarifFaconnage.unite === 'forfait' || tarifFaconnage.unite === 'exemplaire') {
              montant = montant * exemplaires;
            }
            prixOptions += montant;
            details.options.push({
              nom: faconnageLabel,
              tarif_cle: facconnageCle,
              prix: Math.round(montant)
            });
          }
        }
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
    ? ['largeur', 'hauteur', 'unite', 'type_support', 'support', 'quantite', 'nombre_exemplaires', 'finitions', 'options']
    // Xerox: inclure tous les champs utilisés dans le calcul
    : ['nombre_pages', 'pages', 'exemplaires', 'nombre_exemplaires', 'format', 'type_document', 'couleur_impression', 'grammage', 'mode_impression', 'finition', 'faconnage', 'conditionnement'];
  
  const keyData = {};
  relevantFields.forEach(field => {
    if (formData[field] !== undefined && formData[field] !== null && formData[field] !== '') {
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
    const hasSupport = formData.type_support || formData.support;
    return !formData.largeur || !formData.hauteur || !hasSupport;
  } else {
    // Xerox: au moins format OU type_document ET nombre_exemplaires
    const hasFormat = formData.format || formData.type_document;
    return !hasFormat || !formData.nombre_exemplaires;
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
