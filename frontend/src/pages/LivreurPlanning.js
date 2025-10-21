import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  MapPinIcon,
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PhoneIcon,
  EyeIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';
import DossierDetails from '../components/dossiers/DossierDetails';
import notificationService from '../services/notificationService';

const LivreurPlanning = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [tourneeActive, setTourneeActive] = useState(false);

  // Charger les dossiers
  useEffect(() => {
    const fetchDossiers = async () => {
      try {
        setLoading(true);
        const response = await api.getDossiers();
        if (response?.dossiers) {
          setDossiers(response.dossiers);
        }
      } catch (err) {
        console.error('Erreur chargement dossiers:', err);
        setError('Erreur lors du chargement des dossiers');
        notificationService.error('Erreur lors du chargement des dossiers');
      } finally {
        setLoading(false);
      }
    };

    fetchDossiers();
  }, []);

  // Normaliser les statuts pour la livraison
  const normalizeDeliveryStatus = (statut) => {
    if (!statut) return 'unknown';
    const status = statut.toLowerCase();
    
    if (status.includes('pret') && status.includes('livraison')) return 'pret_livraison';
    if (status.includes('livraison') && !status.includes('pret')) return 'en_livraison';
    if (status.includes('livre') || status.includes('delivered')) return 'livre';
    if (status.includes('retour') || status.includes('echec') || status.includes('reporte')) return 'retour';
    
    // Statuts par défaut
    if (status.includes('termine') || status.includes('valide')) return 'pret_livraison';
    if (status.includes('cours') || status.includes('progress')) return 'pret_livraison';
    
    return 'pret_livraison'; // Par défaut, considérer comme prêt à livrer
  };

  // Calculer la priorité de livraison
  const calculateDeliveryPriority = (dossier) => {
    let priority = 1;
    
    // Facteurs de priorité
    if (dossier.urgent || (dossier.priorite && dossier.priorite > 3)) priority += 3;
    if (dossier.date_limite) {
      const deadline = new Date(dossier.date_limite);
      const today = new Date();
      const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) priority += 2;
      else if (diffDays <= 3) priority += 1;
    }
    
    return Math.min(priority, 5);
  };

  // Obtenir la zone de livraison
  const getDeliveryZone = (dossier) => {
    const codePostal = dossier.code_postal_livraison || dossier.code_postal || '';
    
    if (codePostal.startsWith('75')) return 'paris';
    if (['92', '93', '94'].some(prefix => codePostal.startsWith(prefix))) return 'banlieue';
    if (['77', '78', '91', '95'].some(prefix => codePostal.startsWith(prefix))) return 'idf';
    
    return 'autre';
  };

  // Traitement et filtrage des dossiers
  const processedDossiers = useMemo(() => {
    return dossiers.map(dossier => ({
      ...dossier,
      normalized_status: normalizeDeliveryStatus(dossier.statut || dossier.status),
      priority: calculateDeliveryPriority(dossier),
      zone: getDeliveryZone(dossier)
    }));
  }, [dossiers]);

  // Dossiers filtrés
  const filteredDossiers = useMemo(() => {
    return processedDossiers.filter(dossier => {
      // Filtres de recherche
      const searchMatch = !searchTerm || 
        (dossier.numero_commande || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dossier.client_nom || dossier.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dossier.adresse_livraison || dossier.adresse_client || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Filtre de zone
      const zoneMatch = selectedZone === 'all' || dossier.zone === selectedZone;

      // Filtre de priorité
      const priorityMatch = selectedPriority === 'all' || dossier.priority.toString() === selectedPriority;

      // Filtre de statut
      const statusMatch = selectedStatus === 'all' || dossier.normalized_status === selectedStatus;

      return searchMatch && zoneMatch && priorityMatch && statusMatch;
    });
  }, [processedDossiers, searchTerm, selectedZone, selectedPriority, selectedStatus]);

  // Dossiers groupés par statut pour le planning
  const dossiersParStatut = useMemo(() => {
    const groupes = {
      pret_livraison: [],
      en_livraison: [],
      livre: [],
      retour: []
    };

    filteredDossiers.forEach(dossier => {
      if (groupes[dossier.normalized_status]) {
        groupes[dossier.normalized_status].push(dossier);
      }
    });

    // Trier par priorité
    Object.keys(groupes).forEach(statut => {
      groupes[statut].sort((a, b) => b.priority - a.priority);
    });

    return groupes;
  }, [filteredDossiers]);

  // Badges de statut
  const getStatusBadge = (status) => {
    const badges = {
      pret_livraison: { label: 'Prêt à livrer', color: 'bg-blue-100 text-blue-800' },
      en_livraison: { label: 'En livraison', color: 'bg-orange-100 text-orange-800' },
      livre: { label: 'Livré', color: 'bg-success-100 text-green-800' },
      retour: { label: 'Retour', color: 'bg-error-100 text-red-800' }
    };
    
    return badges[status] || { label: 'Inconnu', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100' };
  };

  // Badges de priorité
  const getPriorityBadge = (priority) => {
    if (priority >= 4) return { label: 'Urgent', color: 'bg-error-500 text-white' };
    if (priority >= 3) return { label: 'Élevée', color: 'bg-orange-500 text-white' };
    if (priority >= 2) return { label: 'Moyenne', color: 'bg-yellow-500 text-white' };
    return { label: 'Normale', color: 'bg-success-500 text-white' };
  };

  // Badges de zone
  const getZoneBadge = (zone) => {
    const zones = {
      paris: { label: 'Paris', color: 'bg-purple-100 text-purple-800', icon: '🏙️' },
      banlieue: { label: 'Banlieue', color: 'bg-blue-100 text-blue-800', icon: '🏘️' },
      idf: { label: 'IDF', color: 'bg-success-100 text-green-800', icon: '🌳' },
      autre: { label: 'Autre', color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100', icon: '📍' }
    };
    
    return zones[zone] || zones.autre;
  };

  // Actions de livraison
  const handleStartDelivery = (dossier) => {
    // Simulation de démarrage de livraison
    notificationService.info(`Livraison démarrée pour ${dossier.numero_commande || `#${dossier.id}`}`);
    
    // Mise à jour locale du statut
    setDossiers(prev => prev.map(d => 
      d.id === dossier.id 
        ? { ...d, statut: 'en_livraison', status: 'en_livraison' }
        : d
    ));
  };

  const handleCompleteDelivery = (dossier) => {
    // Simulation de livraison terminée
    notificationService.success(`Livraison terminée pour ${dossier.numero_commande || `#${dossier.id}`}`);
    
    // Mise à jour locale du statut
    setDossiers(prev => prev.map(d => 
      d.id === dossier.id 
        ? { ...d, statut: 'livre', status: 'livre' }
        : d
    ));
  };

  const handleReportProblem = (dossier) => {
    // Simulation de signalement de problème
    notificationService.warning(`Problème signalé pour ${dossier.numero_commande || `#${dossier.id}`}`);
    
    // Mise à jour locale du statut
    setDossiers(prev => prev.map(d => 
      d.id === dossier.id 
        ? { ...d, statut: 'retour', status: 'retour' }
        : d
    ));
  };

  // Composant carte de dossier
  const DossierCard = ({ dossier }) => {
    const statusBadge = getStatusBadge(dossier.normalized_status);
    const priorityBadge = getPriorityBadge(dossier.priority);
    const zoneBadge = getZoneBadge(dossier.zone);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow duration-200"
      >
        {/* En-tête de la carte */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              {dossier.numero_commande || `Dossier #${dossier.id}`}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
              {dossier.client_nom || dossier.client || 'Client non spécifié'}
            </p>
          </div>
          
          {/* Badges de statut */}
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityBadge.color}`}>
              {priorityBadge.label}
            </span>
          </div>
        </div>

        {/* Informations de livraison */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-300">
            <MapPinIcon className="h-4 w-4 mr-2 text-neutral-400" />
            <span className="truncate">
              {dossier.adresse_livraison || dossier.adresse_client || 'Adresse non renseignée'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-300">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${zoneBadge.color}`}>
                {zoneBadge.icon} {zoneBadge.label}
              </span>
            </div>
            
            {dossier.date_limite && (
              <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-300">
                <ClockIcon className="h-4 w-4 mr-1 text-neutral-400" />
                <span>{new Date(dossier.date_limite).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedDossier(dossier)}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:bg-neutral-700 transition-colors duration-200"
            >
              <EyeIcon className="h-3 w-3 mr-1" />
              Détails
            </button>
            
            <button
              onClick={() => {/* Ouvrir GPS */}}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors duration-200"
            >
              <MapPinIcon className="h-3 w-3 mr-1" />
              GPS
            </button>
          </div>

          {/* Actions selon le statut */}
          <div className="flex space-x-1">
            {dossier.normalized_status === 'pret_livraison' && (
              <button
                onClick={() => handleStartDelivery(dossier)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-success-600 rounded hover:bg-success-700 transition-colors duration-200"
              >
                <PlayIcon className="h-3 w-3 mr-1" />
                Démarrer
              </button>
            )}
            
            {dossier.normalized_status === 'en_livraison' && (
              <>
                <button
                  onClick={() => handleCompleteDelivery(dossier)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-success-600 rounded hover:bg-success-700 transition-colors duration-200"
                >
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Terminer
                </button>
                <button
                  onClick={() => handleReportProblem(dossier)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-error-600 rounded hover:bg-error-700 transition-colors duration-200"
                >
                  <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                  Problème
                </button>
              </>
            )}
            
            {(dossier.normalized_status === 'livre' || dossier.normalized_status === 'retour') && (
              <button
                onClick={() => {/* Contact client */}}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:bg-neutral-700 transition-colors duration-200"
              >
                <PhoneIcon className="h-3 w-3 mr-1" />
                Contact
              </button>
            )}
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
      {/* En-tête avec contrôles */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <CalendarDaysIcon className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Planning de Livraison</h2>
              <p className="text-neutral-600 dark:text-neutral-300">Organisez et gérez vos livraisons efficacement</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Contrôle de tournée */}
            <button
              onClick={() => setTourneeActive(!tourneeActive)}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                tourneeActive
                  ? 'text-white bg-error-600 hover:bg-error-700'
                  : 'text-white bg-success-600 hover:bg-success-700'
              }`}
            >
              {tourneeActive ? <PauseIcon className="h-4 w-4 mr-2" /> : <PlayIcon className="h-4 w-4 mr-2" />}
              {tourneeActive ? 'Arrêter Tournée' : 'Démarrer Tournée'}
            </button>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TruckIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">À Livrer</p>
                <p className="text-2xl font-bold text-blue-900">{dossiersParStatut.pret_livraison.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-orange-600">En Cours</p>
                <p className="text-2xl font-bold text-orange-900">{dossiersParStatut.en_livraison.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-success-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-success-600">Terminées</p>
                <p className="text-2xl font-bold text-green-900">{dossiersParStatut.livre.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-error-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-error-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-error-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-error-600">Retours</p>
                <p className="text-2xl font-bold text-red-900">{dossiersParStatut.retour.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro, client ou adresse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Bouton filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Filtres
          </button>
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

                {/* Filtre priorité */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Priorité</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="all">Toutes priorités</option>
                    <option value="4">Urgent</option>
                    <option value="3">Élevée</option>
                    <option value="2">Moyenne</option>
                    <option value="1">Normale</option>
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
                    <option value="pret_livraison">Prêt à livrer</option>
                    <option value="en_livraison">En livraison</option>
                    <option value="livre">Livré</option>
                    <option value="retour">Retour</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Liste des dossiers par statut */}
      <div className="space-y-6">
        {Object.entries(dossiersParStatut).map(([statut, dossiersList]) => {
          const statusBadge = getStatusBadge(statut);
          
          if (dossiersList.length === 0) return null;
          
          return (
            <div key={statut} className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mr-3 ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                  ({dossiersList.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {dossiersList.map((dossier) => (
                    <DossierCard key={dossier.id} dossier={dossier} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message si aucun dossier */}
      {filteredDossiers.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
          <CalendarDaysIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Aucun dossier trouvé</h3>
          <p className="text-neutral-600 dark:text-neutral-300">Aucun dossier ne correspond à vos critères de recherche.</p>
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

LivreurPlanning.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    role: PropTypes.string
  })
};

export default LivreurPlanning;