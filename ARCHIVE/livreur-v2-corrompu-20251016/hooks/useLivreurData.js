/**
 * 🎣 Hook useLivreurData
 * Gestion centralisée des données de livraison avec cache et optimisations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dossiersService } from '../../../services/apiAdapter';
import notificationService from '../../../services/notificationService';
import { 
  enrichDossierData, 
  calculateDeliveryStats,
  filterDossiers,
  groupDossiersByCriteria 
} from '../utils/livreurUtils';
import { 
  DELIVERY_STATUS,
  DEFAULT_CONFIG,
  MESSAGES 
} from '../utils/livreurConstants';

const useLivreurData = (initialFilters = {}) => {
  // États principaux
  const [dossiers, setDossiers] = useState([]);
  const [enrichedDossiers, setEnrichedDossiers] = useState([]);
  const [filteredDossiers, setFilteredDossiers] = useState([]);
  const [groupedDossiers, setGroupedDossiers] = useState({});
  const [stats, setStats] = useState({});
  
  // États de chargement
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Configuration et cache
  const [filters, setFilters] = useState({
    searchTerm: '',
    filterStatus: DEFAULT_CONFIG.DEFAULT_FILTER_STATUS,
    filterZone: DEFAULT_CONFIG.DEFAULT_FILTER_ZONE,
    filterPriority: 'all',
    dateFrom: null,
    dateTo: null,
    sortBy: DEFAULT_CONFIG.DEFAULT_SORT,
    ...initialFilters
  });
  
  const [lastFetch, setLastFetch] = useState(null);
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  /**
   * 📥 Récupération des dossiers depuis l'API
   */
  const fetchDossiers = useCallback(async (showRefreshLoader = false) => {
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      setError(null);

      const response = await dossiersService.getDossiers({
        signal: abortControllerRef.current.signal
      });
      
      let dossiersList = Array.isArray(response?.dossiers) 
        ? response.dossiers 
        : Array.isArray(response?.data) 
        ? response.data 
        : [];

      // Filtrer les dossiers pertinents pour le livreur
      dossiersList = dossiersList.filter(d => {
        const status = d.statut || d.status;
        return status && ![
          'brouillon', 'nouveau', 'en_cours', 'valide', 
          'annule', 'archive'
        ].includes(String(status).toLowerCase());
      });

      // Enrichir les données
      const enrichedList = dossiersList.map(enrichDossierData);
      
      setDossiers(dossiersList);
      setEnrichedDossiers(enrichedList);
      setLastFetch(new Date());
      
      // Mise en cache des résultats
      cacheRef.current.set('enriched_dossiers', enrichedList);
      cacheRef.current.set('last_fetch', new Date());
      
      return enrichedList;
      
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('📨 Requête annulée');
        return;
      }
      
      console.error('❌ Erreur lors du chargement des dossiers:', err);
      setError(MESSAGES.ERROR.LOAD_FAILED);
      
      // Fallback sur le cache si disponible
      const cached = cacheRef.current.get('enriched_dossiers');
      if (cached) {
        setEnrichedDossiers(cached);
        return cached;
      } else {
        setEnrichedDossiers([]);
        return [];
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * 🔄 Rafraîchissement des données
   */
  const refreshData = useCallback(async () => {
    const data = await fetchDossiers(true);
    if (data) {
      notificationService.success(MESSAGES.SUCCESS.REFRESHED);
    }
    return data;
  }, [fetchDossiers]);

  /**
   * 🔍 Application des filtres
   */
  const applyFilters = useCallback((newFilters = {}) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    const filtered = filterDossiers(enrichedDossiers, updatedFilters);
    setFilteredDossiers(filtered);
    
    return filtered;
  }, [filters, enrichedDossiers]);

  /**
   * 🏗️ Regroupement des dossiers
   */
  const updateGroupedDossiers = useCallback((dossiersList = filteredDossiers) => {
    const grouped = groupDossiersByCriteria(dossiersList, 'status');
    setGroupedDossiers(grouped);
    return grouped;
  }, [filteredDossiers]);

  /**
   * 📊 Mise à jour des statistiques
   */
  const updateStats = useCallback((dossiersList = enrichedDossiers) => {
    const newStats = calculateDeliveryStats(dossiersList);
    setStats(newStats);
    return newStats;
  }, [enrichedDossiers]);

  /**
   * 🎯 Mise à jour d'un dossier spécifique
   */
  const updateDossier = useCallback((dossierId, updates) => {
    const updatedEnriched = enrichedDossiers.map(dossier => 
      dossier.id === dossierId 
        ? enrichDossierData({ ...dossier, ...updates })
        : dossier
    );
    
    setEnrichedDossiers(updatedEnriched);
    
    // Mettre à jour le cache
    cacheRef.current.set('enriched_dossiers', updatedEnriched);
    
    return updatedEnriched;
  }, [enrichedDossiers]);

  /**
   * ➕ Ajout d'un nouveau dossier
   */
  const addDossier = useCallback((newDossier) => {
    const enriched = enrichDossierData(newDossier);
    const updatedList = [enriched, ...enrichedDossiers];
    
    setEnrichedDossiers(updatedList);
    cacheRef.current.set('enriched_dossiers', updatedList);
    
    return updatedList;
  }, [enrichedDossiers]);

  /**
   * ❌ Suppression d'un dossier
   */
  const removeDossier = useCallback((dossierId) => {
    const updatedList = enrichedDossiers.filter(d => d.id !== dossierId);
    
    setEnrichedDossiers(updatedList);
    cacheRef.current.set('enriched_dossiers', updatedList);
    
    return updatedList;
  }, [enrichedDossiers]);

  /**
   * 🔍 Recherche d'un dossier par ID
   */
  const findDossierById = useCallback((dossierId) => {
    return enrichedDossiers.find(d => d.id === dossierId);
  }, [enrichedDossiers]);

  /**
   * 📋 Obtention des dossiers par statut
   */
  const getDossiersByStatus = useCallback((status) => {
    return enrichedDossiers.filter(d => d.deliveryStatus === status);
  }, [enrichedDossiers]);

  /**
   * ⚡ Obtention des dossiers urgents
   */
  const getUrgentDossiers = useCallback(() => {
    return enrichedDossiers.filter(d => d.isUrgentDelivery);
  }, [enrichedDossiers]);

  /**
   * 🚀 Chargement initial et écoute des événements
   */
  useEffect(() => {
    fetchDossiers();

    // Écoute des événements temps réel
    const unsubscribeUpdated = notificationService.on('dossier_updated', (dossier) => {
      updateDossier(dossier.id, dossier);
    });

    const unsubscribeNew = notificationService.on('new_dossier', (dossier) => {
      addDossier(dossier);
    });

    const unsubscribeDeleted = notificationService.on('dossier_deleted', (dossierId) => {
      removeDossier(dossierId);
    });

    const unsubscribeRefresh = notificationService.on('refresh_dossiers_list', () => {
      fetchDossiers(true);
    });

    // Nettoyage
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (typeof unsubscribeUpdated === 'function') unsubscribeUpdated();
      if (typeof unsubscribeNew === 'function') unsubscribeNew();
      if (typeof unsubscribeDeleted === 'function') unsubscribeDeleted();
      if (typeof unsubscribeRefresh === 'function') unsubscribeRefresh();
    };
  }, [fetchDossiers, updateDossier, addDossier, removeDossier]);

  /**
   * 🔄 Effet pour appliquer les filtres quand les données changent
   */
  useEffect(() => {
    if (enrichedDossiers.length > 0) {
      const filtered = filterDossiers(enrichedDossiers, filters);
      setFilteredDossiers(filtered);
    }
  }, [enrichedDossiers, filters]);

  /**
   * 📊 Effet pour mettre à jour les stats et groupements
   */
  useEffect(() => {
    if (enrichedDossiers.length > 0) {
      updateStats(enrichedDossiers);
    }
    
    if (filteredDossiers.length >= 0) {
      updateGroupedDossiers(filteredDossiers);
    }
  }, [enrichedDossiers, filteredDossiers, updateStats, updateGroupedDossiers]);

  /**
   * ♻️ Rafraîchissement automatique (optionnel)
   */
  useEffect(() => {
    if (!DEFAULT_CONFIG.ENABLE_AUTO_REFRESH) return;

    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        fetchDossiers(true);
      }
    }, DEFAULT_CONFIG.AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loading, refreshing, fetchDossiers]);

  // Interface publique du hook
  return {
    // Données
    dossiers: enrichedDossiers,
    filteredDossiers,
    groupedDossiers,
    stats,
    
    // États
    loading,
    refreshing,
    error,
    lastFetch,
    
    // Filtres
    filters,
    setFilters: applyFilters,
    
    // Actions
    refreshData,
    updateDossier,
    addDossier,
    removeDossier,
    
    // Utilitaires
    findDossierById,
    getDossiersByStatus,
    getUrgentDossiers,
    
    // Méthodes pour forcer les recalculs
    forceUpdateStats: () => updateStats(),
    forceUpdateGrouped: () => updateGroupedDossiers(),
    
    // Méthode pour vider le cache
    clearCache: () => {
      cacheRef.current.clear();
    }
  };
};

export default useLivreurData;