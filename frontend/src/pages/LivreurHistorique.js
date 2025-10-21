import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  MapPinIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';
import DossierDetails from '../components/dossiers/DossierDetails';
import notificationService from '../services/notificationService';

const LivreurHistorique = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date_desc');

  // Charger les dossiers
  useEffect(() => {
    const fetchDossiers = async () => {
      try {
        setLoading(true);
        const response = await api.getDossiers();
        if (response?.dossiers) {
          // Filtrer pour ne garder que les dossiers avec historique de livraison
          const dossiersAvecHistorique = response.dossiers.filter(dossier => {
            const status = (dossier.statut || dossier.status || '').toLowerCase();
            return status.includes('livre') || 
                   status.includes('delivered') || 
                   status.includes('retour') || 
                   status.includes('echec') ||
                   status.includes('termine');
          });
          setDossiers(dossiersAvecHistorique);
        }
      } catch (err) {
        console.error('Erreur chargement historique:', err);
        setError('Erreur lors du chargement de l\'historique');
        notificationService.error('Erreur lors du chargement de l\'historique');
      } finally {
        setLoading(false);
      }
    };

    fetchDossiers();
  }, []);

  // Normaliser les statuts d'historique
  const normalizeHistoryStatus = (statut) => {
    if (!statut) return 'unknown';
    const status = statut.toLowerCase();
    
    if (status.includes('livre') || status.includes('delivered')) return 'livre';
    if (status.includes('retour') || status.includes('echec')) return 'echec';
    if (status.includes('reporte') || status.includes('annule')) return 'reporte';
    if (status.includes('termine')) return 'livre';
    
    return 'livre'; // Par défaut
  };

  // Obtenir la zone de livraison
  const getDeliveryZone = (dossier) => {
    const codePostal = dossier.code_postal_livraison || dossier.code_postal || '';
    
    if (codePostal.startsWith('75')) return 'paris';
    if (['92', '93', '94'].some(prefix => codePostal.startsWith(prefix))) return 'banlieue';
    if (['77', '78', '91', '95'].some(prefix => codePostal.startsWith(prefix))) return 'idf';
    
    return 'autre';
  };

  // Calculer la période
  const calculatePeriod = (date) => {
    if (!date) return 'unknown';
    
    const dossierDate = new Date(date);
    const now = new Date();
    const diffTime = now - dossierDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) return 'week';
    if (diffDays <= 30) return 'month';
    if (diffDays <= 90) return 'quarter';
    return 'older';
  };

  // Traitement des dossiers
  const processedDossiers = useMemo(() => {
    return dossiers.map(dossier => ({
      ...dossier,
      normalized_status: normalizeHistoryStatus(dossier.statut || dossier.status),
      zone: getDeliveryZone(dossier),
      period: calculatePeriod(dossier.date_creation || dossier.created_at),
      // Simulation d'une date de livraison
      date_livraison: dossier.date_livraison || dossier.date_modification || dossier.updated_at || dossier.date_creation
    }));
  }, [dossiers]);

  // Filtres appliqués
  const filteredDossiers = useMemo(() => {
    return processedDossiers.filter(dossier => {
      // Recherche
      const searchMatch = !searchTerm || 
        (dossier.numero_commande || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dossier.client_nom || dossier.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dossier.adresse_livraison || dossier.adresse_client || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Période
      const periodMatch = selectedPeriod === 'all' || dossier.period === selectedPeriod;

      // Statut
      const statusMatch = selectedStatus === 'all' || dossier.normalized_status === selectedStatus;

      // Zone
      const zoneMatch = selectedZone === 'all' || dossier.zone === selectedZone;

      return searchMatch && periodMatch && statusMatch && zoneMatch;
    });
  }, [processedDossiers, searchTerm, selectedPeriod, selectedStatus, selectedZone]);

  // Tri des dossiers
  const sortedDossiers = useMemo(() => {
    const sorted = [...filteredDossiers];
    
    switch (sortBy) {
      case 'date_desc':
        return sorted.sort((a, b) => new Date(b.date_livraison) - new Date(a.date_livraison));
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.date_livraison) - new Date(b.date_livraison));
      case 'client':
        return sorted.sort((a, b) => (a.client_nom || a.client || '').localeCompare(b.client_nom || b.client || ''));
      case 'zone':
        return sorted.sort((a, b) => a.zone.localeCompare(b.zone));
      default:
        return sorted;
    }
  }, [filteredDossiers, sortBy]);

  // Statistiques d'historique
  const statistics = useMemo(() => {
    const total = processedDossiers.length;
    const livres = processedDossiers.filter(d => d.normalized_status === 'livre').length;
    const echecs = processedDossiers.filter(d => d.normalized_status === 'echec').length;
    const reportes = processedDossiers.filter(d => d.normalized_status === 'reporte').length;
    
    const tauxReussite = total > 0 ? Math.round((livres / total) * 100) : 0;
    
    // Répartition par zone
    const zones = {
      paris: processedDossiers.filter(d => d.zone === 'paris').length,
      banlieue: processedDossiers.filter(d => d.zone === 'banlieue').length,
      idf: processedDossiers.filter(d => d.zone === 'idf').length,
      autre: processedDossiers.filter(d => d.zone === 'autre').length
    };
    
    // Répartition par période
    const periodes = {
      week: processedDossiers.filter(d => d.period === 'week').length,
      month: processedDossiers.filter(d => d.period === 'month').length,
      quarter: processedDossiers.filter(d => d.period === 'quarter').length,
      older: processedDossiers.filter(d => d.period === 'older').length
    };
    
    return {
      total,
      livres,
      echecs,
      reportes,
      tauxReussite,
      zones,
      periodes
    };
  }, [processedDossiers]);

  // Badges
  const getStatusBadge = (status) => {
    const badges = {
      livre: { label: 'Livré', color: 'bg-success-100 text-green-800', icon: CheckCircleIcon },
      echec: { label: 'Échec', color: 'bg-error-100 text-red-800', icon: XCircleIcon },
      reporte: { label: 'Reporté', color: 'bg-yellow-100 text-yellow-800', icon: ExclamationTriangleIcon }
    };
    
    return badges[status] || { label: 'Inconnu', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100', icon: ClockIcon };
  };

  const getZoneBadge = (zone) => {
    const zones = {
      paris: { label: 'Paris', color: 'bg-purple-100 text-purple-800', icon: '🏙️' },
      banlieue: { label: 'Banlieue', color: 'bg-blue-100 text-blue-800', icon: '🏘️' },
      idf: { label: 'IDF', color: 'bg-success-100 text-green-800', icon: '🌳' },
      autre: { label: 'Autre', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100', icon: '📍' }
    };
    
    return zones[zone] || zones.autre;
  };

  const getPeriodLabel = (period) => {
    const periods = {
      week: 'Cette semaine',
      month: 'Ce mois',
      quarter: 'Ce trimestre',
      older: 'Plus ancien'
    };
    
    return periods[period] || 'Inconnu';
  };

  // Composant ligne d'historique
  const HistoryRow = ({ dossier }) => {
    const statusBadge = getStatusBadge(dossier.normalized_status);
    const zoneBadge = getZoneBadge(dossier.zone);
    const StatusIcon = statusBadge.icon;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Informations principales */}
            <div className="flex items-center">
              <div className="mr-3">
                <StatusIcon className={`h-5 w-5 ${
                  dossier.normalized_status === 'livre' ? 'text-success-600' :
                  dossier.normalized_status === 'echec' ? 'text-error-600' : 'text-yellow-600'
                }`} />
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  {dossier.numero_commande || `#${dossier.id}`}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  {dossier.client_nom || dossier.client || 'Client non spécifié'}
                </p>
              </div>
            </div>

            {/* Date de livraison */}
            <div className="flex items-center">
              <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {new Date(dossier.date_livraison).toLocaleDateString()}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {getPeriodLabel(dossier.period)}
                </p>
              </div>
            </div>

            {/* Adresse et zone */}
            <div className="flex items-center">
              <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-900 dark:text-white truncate">
                  {dossier.adresse_livraison || dossier.adresse_client || 'Adresse non renseignée'}
                </p>
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${zoneBadge.color}`}>
                  {zoneBadge.icon} {zoneBadge.label}
                </span>
              </div>
            </div>

            {/* Statut et actions */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
              
              <button
                onClick={() => setSelectedDossier(dossier)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:bg-neutral-700 transition-colors duration-200"
              >
                <EyeIcon className="h-3 w-3 mr-1" />
                Détails
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 text-error-500 mx-auto mb-4" />
        <p className="text-neutral-600 dark:text-neutral-300">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Historique des Livraisons</h2>
              <p className="text-neutral-600 dark:text-neutral-300">Consultez l&apos;historique complet de vos livraisons</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold text-orange-600">{statistics.total}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Total livraisons</p>
          </div>
        </div>

        {/* Statistiques détaillées */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-success-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-success-600">Livrées</p>
                <p className="text-2xl font-bold text-green-900">{statistics.livres}</p>
              </div>
            </div>
          </div>

          <div className="bg-error-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-error-100 rounded-lg">
                <XCircleIcon className="h-6 w-6 text-error-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-error-600">Échecs</p>
                <p className="text-2xl font-bold text-red-900">{statistics.echecs}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600">Reportées</p>
                <p className="text-2xl font-bold text-yellow-900">{statistics.reportes}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Taux Réussite</p>
                <p className="text-2xl font-bold text-blue-900">{statistics.tauxReussite}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contrôles de recherche et filtrage */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher dans l'historique..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Tri */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="date_desc">Plus récent</option>
              <option value="date_asc">Plus ancien</option>
              <option value="client">Par client</option>
              <option value="zone">Par zone</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filtres
            </button>
          </div>
        </div>

        {/* Filtres avancés */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 border border-neutral-200 rounded-md bg-neutral-50 dark:bg-neutral-900"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filtre période */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Période</label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="all">Toutes les périodes</option>
                    <option value="week">Cette semaine</option>
                    <option value="month">Ce mois</option>
                    <option value="quarter">Ce trimestre</option>
                    <option value="older">Plus ancien</option>
                  </select>
                </div>

                {/* Filtre statut */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Statut</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="livre">Livrées</option>
                    <option value="echec">Échecs</option>
                    <option value="reporte">Reportées</option>
                  </select>
                </div>

                {/* Filtre zone */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Zone</label>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="all">Toutes les zones</option>
                    <option value="paris">Paris</option>
                    <option value="banlieue">Banlieue</option>
                    <option value="idf">Île-de-France</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Liste de l'historique */}
      <div className="space-y-4">
        <AnimatePresence>
          {sortedDossiers.map((dossier) => (
            <HistoryRow key={dossier.id} dossier={dossier} />
          ))}
        </AnimatePresence>
      </div>

      {/* Message si aucun résultat */}
      {sortedDossiers.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
          <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Aucun historique trouvé</h3>
          <p className="text-neutral-600 dark:text-neutral-300">Aucune livraison ne correspond à vos critères de recherche.</p>
        </div>
      )}

      {/* Modal détails dossier */}
      {selectedDossier && (
        <DossierDetails
          dossier={selectedDossier}
          isOpen={!!selectedDossier}
          onClose={() => setSelectedDossier(null)}
        />
      )}
    </div>
  );
};

LivreurHistorique.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    role: PropTypes.string
  })
};

export default LivreurHistorique;