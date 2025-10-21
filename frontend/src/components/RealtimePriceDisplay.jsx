import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './RealtimePriceDisplay.css';

/**
 * Composant d'affichage du prix estimé en temps réel
 * Avec animation fluide lors des changements de prix
 * 
 * @param {object} estimation - Résultat de l'estimation
 * @param {boolean} loading - État de chargement
 * @param {string} error - Message d'erreur éventuel
 * @param {string} className - Classes CSS additionnelles
 */
export function RealtimePriceDisplay({ estimation, loading, error, className = '' }) {
  
  // Formater le prix en FCFA
  const formatPrice = (price) => {
    if (!price || price === 0) return '0';
    return new Intl.NumberFormat('fr-FR').format(price);
  };
  
  // Obtenir le statut de l'estimation
  const getStatus = () => {
    if (error) return 'error';
    if (loading) return 'loading';
    if (!estimation) return 'empty';
    if (estimation.is_partial) return 'partial';
    return 'complete';
  };
  
  const status = getStatus();
  
  return (
    <div className={`realtime-price-display ${status} ${className}`}>
      
      {/* En-tête */}
      <div className="price-header">
        <h3 className="price-title">
          💰 Estimation en temps réel
        </h3>
        
        {/* Indicateur de chargement */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              className="loading-indicator"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="spinner"></div>
              <span>Calcul...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Prix principal */}
      <AnimatePresence mode="wait">
        {estimation && estimation.prix_estime > 0 ? (
          <motion.div 
            key={estimation.prix_estime}
            className="price-main"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="price-value">
              {formatPrice(estimation.prix_estime)}
              <span className="price-currency">FCFA</span>
            </div>
            
            {/* Message de statut */}
            {estimation.message && (
              <div className={`price-status ${estimation.is_partial ? 'partial' : 'complete'}`}>
                {estimation.is_partial ? '⚠️' : '✅'} {estimation.message}
              </div>
            )}
            
            {/* Temps de calcul */}
            {estimation.calculation_time_ms !== undefined && (
              <div className="calculation-time">
                ⚡ Calculé en {estimation.calculation_time_ms}ms
                {estimation.from_cache && ' (cache)'}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            className="price-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="empty-icon">📝</div>
            <p>Remplissez les champs pour obtenir une estimation</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Détails du prix */}
      {estimation && estimation.details && estimation.prix_estime > 0 && (
        <motion.div 
          className="price-details"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.2 }}
        >
          <div className="details-title">Détail du calcul:</div>
          
          <div className="details-grid">
            {estimation.details.base > 0 && (
              <div className="detail-item">
                <span className="detail-label">Prix de base:</span>
                <span className="detail-value">{formatPrice(estimation.details.base)} FCFA</span>
              </div>
            )}
            
            {estimation.details.finitions > 0 && (
              <div className="detail-item">
                <span className="detail-label">Finitions:</span>
                <span className="detail-value">{formatPrice(estimation.details.finitions)} FCFA</span>
              </div>
            )}
            
            {estimation.details.options > 0 && (
              <div className="detail-item">
                <span className="detail-label">Options:</span>
                <span className="detail-value">{formatPrice(estimation.details.options)} FCFA</span>
              </div>
            )}
            
            {estimation.prix_brut !== estimation.prix_estime && (
              <div className="detail-item total">
                <span className="detail-label">Prix brut:</span>
                <span className="detail-value">{formatPrice(estimation.prix_brut)} FCFA</span>
              </div>
            )}
          </div>
          
          {/* Détails techniques supplémentaires */}
          {estimation.details.breakdown && estimation.details.breakdown.base && (
            <div className="technical-details">
              {estimation.machine_type === 'roland' && estimation.details.breakdown.base.dimensions && (
                <div className="tech-info">
                  📐 Surface: {estimation.details.breakdown.base.dimensions.surface_m2} m²
                  ({estimation.details.breakdown.base.dimensions.largeur} × {estimation.details.breakdown.base.dimensions.hauteur} {estimation.details.breakdown.base.dimensions.unite})
                </div>
              )}
              
              {estimation.machine_type === 'xerox' && estimation.details.breakdown.base.pages && (
                <div className="tech-info">
                  📄 Total: {estimation.details.breakdown.base.pages.total_pages} pages
                  ({estimation.details.breakdown.base.pages.pages_par_document} pages × {estimation.details.breakdown.base.pages.nombre_exemplaires} ex.)
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
      
      {/* Avertissements */}
      {estimation && estimation.warnings && estimation.warnings.length > 0 && (
        <div className="price-warnings">
          {estimation.warnings.map((warning, index) => (
            <div key={index} className="warning-item">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}
      
      {/* Erreur */}
      {error && (
        <div className="price-error">
          <div className="error-icon">❌</div>
          <p>{error}</p>
        </div>
      )}
      
    </div>
  );
}

export default RealtimePriceDisplay;
