import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

/**
 * Hook personnalisé pour l'estimation en temps réel du prix
 * Avec debouncing pour éviter trop de requêtes API
 * 
 * @param {object} formData - Données du formulaire
 * @param {string} machineType - 'roland' ou 'xerox'
 * @param {number} debounceDelay - Délai de debounce en ms (défaut: 300)
 * @returns {object} - { estimation, loading, error }
 */
export function useRealtimeEstimation(formData, machineType, debounceDelay = 300) {
  const [estimation, setEstimation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Référence pour le timeout du debounce
  const debounceTimerRef = useRef(null);
  
  // Référence pour l'annulation des requêtes précédentes
  const abortControllerRef = useRef(null);
  
  /**
   * Fonction de calcul de l'estimation
   */
  const calculateEstimation = useCallback(async (data, type) => {
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Créer un nouveau contrôleur d'annulation
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        '/api/devis/estimate-realtime',
        {
          formData: data,
          machineType: type
        },
        {
          signal: abortControllerRef.current.signal
        }
      );
      
      setEstimation(response.data);
      setLoading(false);
      
    } catch (err) {
      if (err.name === 'CanceledError') {
        // Requête annulée, c'est normal
        return;
      }
      
      console.error('Erreur estimation temps réel:', err);
      setError(err.message || 'Erreur de calcul');
      setLoading(false);
      
      // Mettre à zéro en cas d'erreur
      setEstimation({
        prix_estime: 0,
        error: true,
        message: err.message || 'Impossible de calculer'
      });
    }
  }, []);
  
  /**
   * Effet principal : recalculer quand les données changent
   */
  useEffect(() => {
    // Nettoyer le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Vérifier qu'on a les données minimales
    if (!formData || !machineType) {
      setEstimation(null);
      return;
    }
    
    // Lancer un nouveau timer de debounce
    debounceTimerRef.current = setTimeout(() => {
      calculateEstimation(formData, machineType);
    }, debounceDelay);
    
    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData, machineType, debounceDelay, calculateEstimation]);
  
  /**
   * Fonction pour forcer le recalcul immédiat
   */
  const recalculate = useCallback(() => {
    if (formData && machineType) {
      calculateEstimation(formData, machineType);
    }
  }, [formData, machineType, calculateEstimation]);
  
  return {
    estimation,
    loading,
    error,
    recalculate
  };
}

export default useRealtimeEstimation;
