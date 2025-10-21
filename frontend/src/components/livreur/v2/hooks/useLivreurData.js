/**
 * 🎣 Hook useLivreurData
 * Gestion centralisée des données de livraison
 */

import { useState, useEffect, useCallback } from 'react';
import { dossiersService } from '../../../../services/apiAdapter';
import { 
  enrichDossierData,
  calculateDeliveryStats,
  filterDossiers,
  sortDossiers 
} from '../utils/livreurUtils';
import { DELIVERY_STATUS } from '../utils/livreurConstants';

const useLivreurData = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    zone: 'all',
    search: '',
    priority: 'all'
  });
  const [sortBy, setSortBy] = useState('date_desc');

  // Chargement initial
  const loadDossiers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await dossiersService.getDossiers();
      
      // Filtrer les dossiers de livraison
      const livraison = response.filter(d => 
        [
          DELIVERY_STATUS.PRET_LIVRAISON,
          DELIVERY_STATUS.EN_LIVRAISON,
          DELIVERY_STATUS.LIVRE,
          'pret_livraison',
          'en_livraison',
          'livre'
        ].includes(d.statut || d.status)
      );
      
      setDossiers(livraison);
    } catch (err) {
      console.error('Erreur chargement dossiers:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement au montage
  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  // Rafraîchir les données
  const refresh = useCallback(() => {
    return loadDossiers();
  }, [loadDossiers]);

  // Dossiers filtrés et triés
  const filteredDossiers = sortDossiers(
    filterDossiers(dossiers, filters),
    sortBy
  );

  // Statistiques
  const stats = calculateDeliveryStats(dossiers);

  // Dossiers par section
  const dossiersALivrer = dossiers
    .filter(d => d.statut === DELIVERY_STATUS.PRET_LIVRAISON)
    .map(enrichDossierData);

  const dossiersProgrammees = dossiers
    .filter(d => d.statut === DELIVERY_STATUS.EN_LIVRAISON)
    .map(enrichDossierData);

  const dossiersTerminees = dossiers
    .filter(d => d.statut === DELIVERY_STATUS.LIVRE)
    .map(enrichDossierData);

  return {
    dossiers: filteredDossiers,
    dossiersALivrer,
    dossiersProgrammees,
    dossiersTerminees,
    loading,
    error,
    stats,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    refresh
  };
};

export default useLivreurData;
