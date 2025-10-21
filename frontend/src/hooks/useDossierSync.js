import { useState, useEffect, useCallback, useRef } from 'react';
import { dossierSync } from '../services/dossierSyncService';
import { DossierIdResolver } from '../services/dossierIdResolver';

// Hook principal pour la gestion synchronisée des dossiers
export function useDossierSync() {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const unsubscribeRef = useRef(null);

  // ===================================
  // GESTION DES ÉVÉNEMENTS SYNC
  // ===================================

  const handleSyncEvent = useCallback((eventType, data) => {
    console.log('🔄 Événement sync:', eventType, data);
    
    switch (eventType) {
      case 'sync_connected':
        setConnected(true);
        break;
        
      case 'sync_disconnected':
        setConnected(false);
        break;
        
      case 'dossiers_loaded':
        setLastUpdate(Date.now());
        break;
        
      case 'dossier_created':
        setDossiers(prev => {
          const normalized = DossierIdResolver.normalize(data);
          return [normalized, ...prev];
        });
        setLastUpdate(Date.now());
        break;
        
      case 'dossier_updated':
      case 'status_changed':
        setDossiers(prev => prev.map(d => {
          const dId = DossierIdResolver.resolve(d);
          const targetId = DossierIdResolver.resolve(data.dossier || data);
          return dId === targetId ? DossierIdResolver.normalize(data.dossier || data) : d;
        }));
        setLastUpdate(Date.now());
        break;
        
      case 'dossier_deleted':
        setDossiers(prev => prev.filter(d => {
          const dId = DossierIdResolver.resolve(d);
          return dId !== data.dossierId;
        }));
        setLastUpdate(Date.now());
        break;
        
      case 'delivery_scheduled':
      case 'delivery_confirmed':
        setDossiers(prev => prev.map(d => {
          const dId = DossierIdResolver.resolve(d);
          return dId === data.dossierId ? DossierIdResolver.normalize(data.dossier) : d;
        }));
        setLastUpdate(Date.now());
        break;
      default:
        // Ignore unknown event types
        break;
    }
  }, []);

  // ===================================
  // EFFET D'ABONNEMENT
  // ===================================

  useEffect(() => {
    unsubscribeRef.current = dossierSync.subscribe(handleSyncEvent);
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [handleSyncEvent]);

  // ===================================
  // ACTIONS DOSSIERS
  // ===================================

  const loadDossiers = useCallback(async (params = {}, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dossierSync.getDossiers(params, forceRefresh);
      setDossiers(result.dossiers || []);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur chargement dossiers');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createDossier = useCallback(async (dossierData) => {
    setError(null);
    try {
      const result = await dossierSync.createDossier(dossierData);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur création dossier');
      throw err;
    }
  }, []);

  const updateDossier = useCallback(async (idLike, dossierData) => {
    setError(null);
    try {
      const result = await dossierSync.updateDossier(idLike, dossierData);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur mise à jour dossier');
      throw err;
    }
  }, []);

  const changeStatus = useCallback(async (idLike, newStatus, comment = null) => {
    setError(null);
    try {
      const result = await dossierSync.changeStatus(idLike, newStatus, comment);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur changement statut');
      throw err;
    }
  }, []);

  const validateDossier = useCallback(async (idLike, comment = null) => {
    return changeStatus(idLike, 'en_impression', comment);
  }, [changeStatus]);

  const deleteDossier = useCallback(async (idLike) => {
    setError(null);
    try {
      const result = await dossierSync.deleteDossier(idLike);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur suppression dossier');
      throw err;
    }
  }, []);

  const scheduleDelivery = useCallback(async (idLike, payload) => {
    setError(null);
    try {
      const result = await dossierSync.scheduleDelivery(idLike, payload);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur programmation livraison');
      throw err;
    }
  }, []);

  const confirmDelivery = useCallback(async (idLike, payload) => {
    setError(null);
    try {
      const result = await dossierSync.confirmDelivery(idLike, payload);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur confirmation livraison');
      throw err;
    }
  }, []);

  const refreshCache = useCallback(() => {
    dossierSync.clearCache();
  }, []);

  // ===================================
  // RETOUR DU HOOK
  // ===================================

  return {
    // État
    dossiers,
    loading,
    error,
    connected,
    lastUpdate,
    
    // Actions
    loadDossiers,
    createDossier,
    updateDossier,
    changeStatus,
    validateDossier,
    deleteDossier,
    scheduleDelivery,
    confirmDelivery,
    refreshCache,
    
    // Utilitaires
    clearError: () => setError(null),
    stats: dossierSync.getCacheStats()
  };
}

// Hook pour un dossier spécifique
export function useDossier(idLike) {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const dossierId = DossierIdResolver.resolve(idLike);
  const unsubscribeRef = useRef(null);

  const handleSyncEvent = useCallback((eventType, data) => {
    if (!dossierId) return;
    
    switch (eventType) {
      case 'dossier_updated':
      case 'status_changed': {
        const targetId = DossierIdResolver.resolve(data.dossier || data);
        if (targetId === dossierId) {
          setDossier(DossierIdResolver.normalize(data.dossier || data));
        }
        break;
      }
        
      case 'dossier_deleted':
        if (data.dossierId === dossierId) {
          setDossier(null);
        }
        break;
      default:
        // Ignore unknown event types
        break;
    }
  }, [dossierId]);

  useEffect(() => {
    unsubscribeRef.current = dossierSync.subscribe(handleSyncEvent);
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [handleSyncEvent]);

  const loadDossier = useCallback(async (forceRefresh = false) => {
    if (!dossierId) {
      setError('ID dossier invalide');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dossierSync.getDossier(dossierId, forceRefresh);
      setDossier(result);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur chargement dossier');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  // Auto-chargement au montage si on a un ID
  useEffect(() => {
    if (dossierId && !dossier) {
      loadDossier();
    }
  }, [dossierId, dossier, loadDossier]);

  return {
    dossier,
    loading,
    error,
    loadDossier,
    clearError: () => setError(null)
  };
}

// Hook pour filtrer les dossiers par rôle
export function useDossiersByRole(role, machineType = null) {
  const { dossiers, ...rest } = useDossierSync();
  const [filteredDossiers, setFilteredDossiers] = useState([]);

  useEffect(() => {
    if (!dossiers.length) {
      setFilteredDossiers([]);
      return;
    }

    let filtered = [...dossiers];

    // Filtrage par rôle
    switch (role) {
      case 'preparateur':
        // Le préparateur voit ses propres dossiers
        filtered = filtered.filter(d => 
          !d.statut || 
          ['en_cours', 'a_revoir'].includes(d.statut)
        );
        break;

      case 'imprimeur':
        // L'imprimeur voit les dossiers en impression, imprimés et prêts à livrer (toutes variantes)
        filtered = filtered.filter(d => 
          [
            'en_impression', 'imprime', 'imprimé', 'imprimee', 'pret_livraison', 'pret livraison', 'imprimé', 'imprimee', 'imprimeur', 'imprimée'
          ].includes(d.statut)
        );
        if (machineType) {
          filtered = filtered.filter(d => 
            d.type_fichier === machineType || 
            (machineType === 'Roland' && d.type_fichier?.toLowerCase().includes('roland')) ||
            (machineType === 'Xerox' && d.type_fichier?.toLowerCase().includes('xerox'))
          );
        }
        break;

      case 'livreur':
        // Le livreur voit les dossiers terminés et en livraison
        filtered = filtered.filter(d => 
          ['termine', 'pret_livraison', 'en_livraison', 'livre'].includes(d.statut)
        );
        break;

      case 'admin':
        // L'admin voit tout
        break;

      default:
        filtered = [];
    }

    setFilteredDossiers(filtered);
  }, [dossiers, role, machineType]);

  return {
    dossiers: filteredDossiers,
    ...rest
  };
}