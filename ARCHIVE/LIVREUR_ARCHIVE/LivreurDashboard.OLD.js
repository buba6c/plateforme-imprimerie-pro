/**
 * 🚚 Interface Livreur - Complètement Redesignée
 * Interface moderne pour les livreurs avec UX optimisée
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  StopIcon,
  DocumentIcon,
  DocumentCheckIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  PhoneIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  Cog6ToothIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetailsFixed';
import notificationService from '../services/notificationService';
import { Button, Tooltip, EmptyState, LoadingSpinner, ConfirmationModal } from './ui';
import { useToast } from './ui/Toast';

const LivreurDashboard = ({ user, activeSection = 'dashboard', onNavigate }) => {
  // États principaux
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Navigation et interface
  const [currentSection, setCurrentSection] = useState('a_livrer');
  const [viewMode, setViewMode] = useState('cards'); // cards, list
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  
  // Fonctionnalités livreur
  const [currentPosition, setCurrentPosition] = useState(null);
  const [tourneeActive, setTourneeActive] = useState(false);
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false);
  const [dossierToDeliver, setDossierToDeliver] = useState(null);
  const [showProgrammerModal, setShowProgrammerModal] = useState(false);
  const [dossierToProgrammer, setDossierToProgrammer] = useState(null);
  
  const toast = useToast();

  // Statistiques calculées
  const [stats, setStats] = useState({
    aLivrer: 0,
    programmees: 0,
    livreesAujourdhui: 0,
    urgent: 0,
    encaisseAujourdhui: 0,
    tauxReussite: 100,
    estimatedKmTotal: 0,
    estimatedTimeTotal: 0
  });

  // 📊 Fonctions utilitaires optimisées
  const normalizeDeliveryStatus = useCallback((statut) => {
    if (!statut) return 'imprime';
    const val = String(statut).toLowerCase().trim();
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('livraison') && !val.includes('pret')) return 'en_livraison';
    if (val.includes('livre') || val.includes('delivered')) return 'livre';
    if (val.includes('retour') || val.includes('return')) return 'retour';
    if (val.includes('echec') || val.includes('failed')) return 'echec_livraison';
    if (val.includes('reporte') || val.includes('postponed')) return 'reporte';
    if (val.includes('termine') || val.includes('finished')) return 'termine';
    if (val === 'imprimé' || val === 'imprime') return 'imprime';
    return val.replace(/\s/g, '_');
  }, []);

  const calculateDeliveryPriority = useCallback((dossier) => {
    const now = new Date();
    const created = new Date(dossier.created_at);
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    
    // Priorité basée sur la date de livraison prévue
    if (dossier.date_livraison_prevue) {
      const datePrevu = new Date(dossier.date_livraison_prevue);
      const diffPrevu = (datePrevu - now) / (1000 * 60 * 60 * 24);
      
      if (diffPrevu < 0) return 'urgent'; // En retard
      if (diffPrevu < 1) return 'high';    // Livraison aujourd'hui
      if (diffPrevu < 2) return 'medium';  // Livraison demain
    }
    
    // Priorité basée sur l'âge du dossier
    if (daysDiff > 7) return 'high';
    if (daysDiff > 3) return 'medium';
    return 'low';
  }, []);

  const getDeliveryZone = useCallback((dossier) => {
    const codePostal = String(dossier.code_postal_livraison || dossier.code_postal || '').trim();
    
    if (codePostal.startsWith('75')) return 'paris';
    if (['92', '93', '94'].some(prefix => codePostal.startsWith(prefix))) return 'banlieue';
    if (['77', '78', '91', '95'].some(prefix => codePostal.startsWith(prefix))) return 'idf';
    return 'autre';
  }, []);

  // 📈 Calcul optimisé des statistiques
  const calculateDeliveryStats = useCallback((dossiersList) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const aLivrer = dossiersList.filter(d => 
      ['imprime', 'pret_livraison'].includes(d.deliveryStatus)
    ).length;
    
    const programmees = dossiersList.filter(d => 
      d.deliveryStatus === 'en_livraison'
    ).length;
    
    const livreesAujourdhui = dossiersList.filter(d => {
      const updated = new Date(d.updated_at || d.date_livraison || d.created_at);
      return d.deliveryStatus === 'livre' && updated >= today;
    }).length;
    
    const urgent = dossiersList.filter(d => d.isUrgentDelivery).length;
    
    // Montant encaissé aujourd'hui
    const encaisseAujourdhui = dossiersList
      .filter(d => {
        const updated = new Date(d.updated_at || d.date_livraison || d.created_at);
        return d.deliveryStatus === 'livre' && updated >= today;
      })
      .reduce((sum, d) => sum + (parseFloat(d.displayMontantEncaisse || d.montant) || 0), 0);
    
    // Taux de réussite
    const totalLivraisons = dossiersList.filter(d => 
      ['livre', 'retour', 'echec_livraison'].includes(d.deliveryStatus)
    ).length;
    const livraissonsReussies = dossiersList.filter(d => 
      d.deliveryStatus === 'livre'
    ).length;
    const tauxReussite = totalLivraisons > 0 ? Math.round((livraissonsReussies / totalLivraisons) * 100) : 100;
    
    // Estimations distance et temps
    const estimatedKmTotal = dossiersList
      .filter(d => ['pret_livraison', 'en_livraison'].includes(d.deliveryStatus))
      .reduce((sum, d) => sum + (d.distanceEstimee || 0), 0);
      
    const estimatedTimeTotal = dossiersList
      .filter(d => ['pret_livraison', 'en_livraison'].includes(d.deliveryStatus))
      .reduce((sum, d) => sum + (d.estimatedDeliveryTime || 0), 0);
    
    setStats({
      aLivrer,
      programmees,
      livreesAujourdhui,
      urgent,
      encaisseAujourdhui: Math.round(encaisseAujourdhui),
      tauxReussite,
      estimatedKmTotal: Math.round(estimatedKmTotal),
      estimatedTimeTotal: Math.round(estimatedTimeTotal)
    });
  }, []);

  // 🚚 Récupération et enrichissement des dossiers
  const fetchDossiers = useCallback(async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const data = await dossiersService.getDossiers({});
      let dossiersList = Array.isArray(data?.dossiers) ? data.dossiers : [];
      
      // 🔄 Enrichissement complet des données
      dossiersList = dossiersList.map(d => {
        const deliveryStatus = normalizeDeliveryStatus(d.statut || d.status);
        const deliveryPriority = calculateDeliveryPriority(d);
        const deliveryZone = getDeliveryZone(d);
        const isUrgentDelivery = deliveryPriority === 'urgent' || deliveryPriority === 'high';
        
        // Configuration des zones pour estimations
        const zoneConfigs = {
          paris: { time: 45, distance: 12 },
          banlieue: { time: 60, distance: 18 },
          idf: { time: 90, distance: 35 },
          autre: { time: 120, distance: 50 }
        };
        
        const zoneConfig = zoneConfigs[deliveryZone] || zoneConfigs.autre;
        
        return {
          ...d,
          deliveryStatus,
          deliveryPriority,
          deliveryZone,
          isUrgentDelivery,
          isHighPriority: ['urgent', 'high'].includes(deliveryPriority),
          
          // 🏷️ Données d'affichage optimisées
          displayNumber: d.numero_commande || d.numero_dossier || d.numero || `CMD-${d.id?.toString()?.slice(-6) || 'N/A'}`,
          displayClient: d.client_nom || d.client || d.nom_client || d.client_name || 'Client inconnu',
          displayAdresse: d.adresse_livraison || d.adresse_client || 'Adresse non renseignée',
          displayTelephone: d.telephone_livraison || d.telephone_client || d.telephone || '',
          
          // 📈 Estimations de livraison
          estimatedDeliveryTime: zoneConfig.time,
          distanceEstimee: zoneConfig.distance,
          
          // 💰 Montants
          displayMontant: d.montant_prevu || d.montant || 0,
          displayMontantEncaisse: d.montant_encaisse || 0,
          
          // 📅 Dates formatées
          displayDateCreation: new Date(d.created_at).toLocaleDateString('fr-FR'),
          displayDateLivraisonPrevue: d.date_livraison_prevue ? new Date(d.date_livraison_prevue).toLocaleDateString('fr-FR') : null,
        };
      });
      
      // 🎯 Filtrer les dossiers pertinents pour le livreur
      dossiersList = dossiersList.filter(d => {
        const status = d.deliveryStatus;
        // Inclure tous les statuts pertinents pour les livreurs
        return ['imprime', 'pret_livraison', 'en_livraison', 'livre', 'retour', 'echec_livraison', 'reporte'].includes(status);
      });
      
      setDossiers(dossiersList);
      calculateDeliveryStats(dossiersList);
      
    } catch (error) {
      try {
        const notificationService = require('../services/notificationService').default;
        if (notificationService && typeof notificationService.error === 'function') {
          notificationService.error('Erreur lors de la récupération des dossiers', error);
        }
      } catch (e) {
        // fallback silencieux
      }
      setDossiers([]);
      toast.error('🚚 Erreur lors du chargement des livraisons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizeDeliveryStatus, calculateDeliveryPriority, getDeliveryZone, calculateDeliveryStats, toast]);

  // 🔄 Gestionnaires d'actions modernes
  const handleRefresh = useCallback(async () => {
    await fetchDossiers(true);
    toast.success('🚚 Livraisons actualisées');
  }, [fetchDossiers, toast]);
  
  const handleSectionChange = useCallback((section) => {
    setCurrentSection(section);
    if (onNavigate) {
      onNavigate(section);
    }
  }, [onNavigate]);
  
  const handleProgrammerDossier = useCallback((dossier) => {
    setDossierToProgrammer(dossier);
    setShowProgrammerModal(true);
  }, []);

  const handleConfirmDelivery = useCallback((dossier) => {
    setDossierToDeliver(dossier);
    setShowDeliveryConfirm(true);
  }, []);

  const confirmDelivery = useCallback(async () => {
    try {
      // TODO: Implémenter l'appel API réel
      // await dossiersService.updateStatus(dossierToDeliver.id, 'livre');
      toast.success(`✅ Livraison confirmée pour ${dossierToDeliver.displayClient}`);
      await fetchDossiers();
    } catch (error) {
      try { notificationService.error('Erreur confirmation livraison', error); } catch (e) {}
      toast.error('Erreur lors de la confirmation');
    } finally {
      setShowDeliveryConfirm(false);
      setDossierToDeliver(null);
    }
  }, [dossierToDeliver, fetchDossiers, toast]);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          toast.info('📍 Position mise à jour');
        },
        (error) => {
          try { notificationService.error('Erreur géolocalisation', error); } catch (e) {}
          toast.error('Impossible de récupérer votre position');
        }
      );
    }
  }, [toast]);

  const toggleTournee = useCallback(() => {
    setTourneeActive(prev => {
      const newState = !prev;
      if (newState) {
        getCurrentLocation();
        toast.success('🚀 Tournée démarrée');
      } else {
        toast.info('🏁 Tournée terminée');
      }
      return newState;
    });
  }, [getCurrentLocation, toast]);
  
  const handleNavigateToAddress = useCallback((dossier) => {
    const address = encodeURIComponent(dossier.displayAdresse);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    window.open(mapsUrl, '_blank');
    toast.info(`🗺️ Navigation vers ${dossier.displayClient}`);
  }, [toast]);
  
  const handleCallClient = useCallback((dossier) => {
    if (dossier.displayTelephone) {
      window.location.href = `tel:${dossier.displayTelephone}`;
      toast.info(`📞 Appel vers ${dossier.displayClient}`);
    } else {
      toast.warning('Numéro de téléphone non disponible');
    }
  }, [toast]);

  // 🔍 Filtrage optimisé avec useMemo
  const filteredDossiers = useMemo(() => {
    return dossiers.filter(dossier => {
      // Recherche textuelle
      const matchesSearch = searchTerm === '' || 
        dossier.displayNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dossier.displayClient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dossier.displayAdresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dossier.displayTelephone.includes(searchTerm);
      
      // Filtres par statut et zone
      const matchesStatus = filterStatus === 'all' || dossier.deliveryStatus === filterStatus;
      const matchesZone = filterZone === 'all' || dossier.deliveryZone === filterZone;
      
      return matchesSearch && matchesStatus && matchesZone;
    });
  }, [dossiers, searchTerm, filterStatus, filterZone]);

  // 📋 Catégorisation optimisée des dossiers
  const categorizedDossiers = useMemo(() => {
    return {
      aLivrer: filteredDossiers.filter(d => ['imprime', 'pret_livraison'].includes(d.deliveryStatus)),
      programmees: filteredDossiers.filter(d => d.deliveryStatus === 'en_livraison'),
      livrees: filteredDossiers.filter(d => d.deliveryStatus === 'livre'),
      retours: filteredDossiers.filter(d => ['retour', 'echec_livraison', 'reporte'].includes(d.deliveryStatus)),
      urgent: filteredDossiers.filter(d => d.isUrgentDelivery),
      total: filteredDossiers.length
    };
  }, [filteredDossiers]);

  // 🚀 Initialisation et écoute des événements
  useEffect(() => {
    fetchDossiers();
    getCurrentLocation();

    // Écoute temps réel des notifications
    const unsubscribeRefresh = notificationService.on('refresh_dossiers_list', () => fetchDossiers(true));
    const unsubscribeDossierUpdate = notificationService.on('dossier_updated', () => fetchDossiers(true));

    return () => {
      if (typeof unsubscribeRefresh === 'function') unsubscribeRefresh();
      if (typeof unsubscribeDossierUpdate === 'function') unsubscribeDossierUpdate();
    };
  }, [fetchDossiers, getCurrentLocation]);

  // Composant Badge de statut de livraison
  const DeliveryStatusBadge = ({ status, size = 'sm' }) => {
    const configs = {
      pret_livraison: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Prêt à livrer', icon: '📦' },
      en_livraison: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'En livraison', icon: '🚚' },
      livre: { bg: 'bg-success-100', text: 'text-success-700', label: 'Livré', icon: '✅' },
      retour: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Retour', icon: '↩️' },
      echec_livraison: { bg: 'bg-error-100', text: 'text-error-700', label: 'Échec', icon: '❌' },
      reporte: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', label: 'Reporté', icon: '⏰' },
    };

    const config = configs[status] || { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', label: status, icon: '📄' };
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

    return (
      <span className={`${config.bg} ${config.text} ${sizeClass} rounded-full font-medium inline-flex items-center gap-1`}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Composant Priority Badge pour livraison
  const DeliveryPriorityBadge = ({ priority, estimatedTime, distance }) => {
    const configs = {
      urgent: { bg: 'bg-error-100', text: 'text-error-700', label: 'URGENT', icon: '🔥' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Priorité', icon: '⚡' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Normal', icon: '⏰' },
      low: { bg: 'bg-success-100', text: 'text-success-700', label: 'Différé', icon: '🟢' },
    };

    const config = configs[priority] || configs.low;

    return (
      <div className="flex flex-col gap-1">
        <span className={`${config.bg} ${config.text} text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1`}>
          <span>{config.icon}</span>
          {config.label}
        </span>
        {(estimatedTime || distance) && (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
            {distance && <div>{distance}km</div>}
            {estimatedTime && <div>~{estimatedTime}min</div>}
          </div>
        )}
      </div>
    );
  };

  // Composant Zone Badge
  const ZoneBadge = ({ zone }) => {
    const configs = {
      paris: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Paris', icon: '🏙️' },
      banlieue: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Banlieue', icon: '🏘️' },
      idf: { bg: 'bg-success-100', text: 'text-success-700', label: 'IDF', icon: '🌳' },
      autre: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', label: 'Autre', icon: '🗺️' },
    };

    const config = configs[zone] || configs.autre;

    return (
      <span className={`${config.bg} ${config.text} text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1`}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Composant Card de dossier de livraison - Simplifié pour livreurs
  const DeliveryDossierCard = ({ dossier, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow ${
        dossier.isUrgentDelivery ? 'border-l-4 border-l-red-500' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-lg font-bold text-neutral-900 dark:text-white">
              {dossier.displayNumber}
            </span>
            {dossier.isUrgentDelivery && (
              <ExclamationTriangleIcon className="h-5 w-5 text-error-500" />
            )}
            <DeliveryStatusBadge status={dossier.deliveryStatus} />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
              <UserIcon className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              <span className="truncate">{dossier.displayClient}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <MapPinIcon className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              <span className="truncate">{dossier.displayAdresse}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <ZoneBadge zone={dossier.deliveryZone} />
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {dossier.deliveryStatus === 'pret_livraison' && (
            <button
                onClick={() => {
                    try {
                      const notificationService = require('../services/notificationService').default;
                      if (notificationService && typeof notificationService.info === 'function') {
                        notificationService.info('Démarrer livraison', dossier.displayNumber);
                      }
                    } catch (e) {}
                  }}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-bold text-white bg-success-600 rounded-lg hover:bg-success-700 transition-colors"
            >
              <PlayIcon className="h-4 w-4" />
              DÉMARRER
            </button>
          )}
          <button
            onClick={() => {
              setSelectedDossier(dossier);
              setShowDetailsModal(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded hover:bg-orange-100 transition-colors"
          >
            <EyeIcon className="h-3 w-3" />
            Détails
          </button>
        </div>
      </div>
    </motion.div>
  );

  // Rendu conditionnel basé sur la section active
  const renderContent = () => {
    switch (activeSection) {
      case 'planning':
        return renderPlanning();
      case 'tournees':
        return renderTournees();
      case 'historique':
        return renderHistorique();
      case 'performances':
        return renderPerformances();
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      {/* Header simplifié livreur */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="professional-card"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="dashboard-title flex items-center gap-3">
              <TruckIcon className="h-7 w-7 text-theme-primary" />
              Mes Livraisons
            </h1>
            <p className="dashboard-subtitle">
              Bonjour {user.prenom || user.nom}
            </p>
          </div>
          
          <div className="flex gap-3">
            <Tooltip content={tourneeActive ? "Arrêter la tournée en cours" : "Démarrer une nouvelle tournée"}>
              <Button
                onClick={toggleTournee}
                variant={tourneeActive ? "danger" : "success"}
                icon={tourneeActive ? <StopIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                size="md"
              >
                {tourneeActive ? 'ARRÊTER' : 'DÉMARRER'}
              </Button>
            </Tooltip>
            <Tooltip content="Actualiser les livraisons">
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="secondary"
                icon={<ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
              >
                Actualiser
              </Button>
            </Tooltip>
          </div>
        </div>
      </motion.div>

      {/* Statistiques Professionnelles pour Livreurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="professional-card group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">À Livrer</p>
              <p className="stat-number text-theme-primary">{stats.aLivrer}</p>
              <p className="stat-description">Dossiers prêts</p>
            </div>
            <div className="stat-icon-wrapper bg-theme-primary/10">
              <TruckIcon className="h-6 w-6 text-theme-primary" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="professional-card group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">En Cours</p>
              <p className="stat-number text-orange-600">{stats.enLivraison}</p>
              <p className="stat-description">En livraison</p>
            </div>
            <div className="stat-icon-wrapper bg-orange-100 dark:bg-orange-900/30">
              <ClockIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="professional-card group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Livrés</p>
              <p className="stat-number text-green-600">{stats.livreAujourdhui}</p>
              <p className="stat-description">Aujourd'hui</p>
            </div>
            <div className="stat-icon-wrapper bg-green-100 dark:bg-green-900/30">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="professional-card group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Réussite</p>
              <p className="stat-number text-theme-secondary">{stats.satisfaction}%</p>
              <p className="stat-description">Taux de satisfaction</p>
            </div>
            <div className="stat-icon-wrapper bg-theme-secondary/10">
              <CheckCircleIcon className="h-6 w-6 text-theme-secondary" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filtres et recherche pour livraison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="professional-card"
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par numéro, client ou adresse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="relative">
              <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-9 pr-8 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tous statuts</option>
                <option value="pret_livraison">Prêt à livrer</option>
                <option value="en_livraison">En livraison</option>
                <option value="livre">Livré</option>
                <option value="retour">Retour</option>
                <option value="echec_livraison">Échec</option>
                <option value="reporte">Reporté</option>
              </select>
            </div>
            
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">Toutes zones</option>
              <option value="paris">Paris</option>
              <option value="banlieue">Banlieue</option>
              <option value="idf">Île-de-France</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>
        
        {(searchTerm || filterStatus !== 'all' || filterZone !== 'all') && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              {filteredDossiers.length} livraison(s) trouvée(s)
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
                setFilterZone('all');
              }}
              className="text-sm text-orange-600 hover:text-orange-700 underline"
            >
              Effacer filtres
            </button>
          </div>
        )}
      </motion.div>

      {/* Livraisons urgentes */}
      {categorizedDossiers.urgent.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-error-50 rounded-xl border border-red-200 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-error-600" />
            <h2 className="text-xl font-bold text-red-900">
              Livraisons Urgentes ({categorizedDossiers.urgent.length})
            </h2>
          </div>
          <div className="grid gap-4">
            {categorizedDossiers.urgent.map((dossier, index) => (
              <DeliveryDossierCard key={dossier.id} dossier={dossier} index={index} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Sections des dossiers de livraison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* À livrer */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
        >
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <DocumentIcon className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">À Livrer</h2>
              <span className="bg-blue-100 text-blue-700 text-sm font-medium px-2 py-1 rounded-full">
                {categorizedDossiers.aLivrer.length}
              </span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
              Prêts pour livraison
            </p>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {categorizedDossiers.aLivrer.length === 0 ? (
              <EmptyState
                icon={DocumentIcon}
                title="Aucune livraison prête"
                description="Les nouveaux colis apparaîtront ici"
              />
            ) : (
              categorizedDossiers.aLivrer.map((dossier, index) => (
                <DeliveryDossierCard key={dossier.id} dossier={dossier} index={index} />
              ))
            )}
          </div>
        </motion.div>

        {/* En livraison */}
        <motion.div
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
        >
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <TruckIcon className="h-6 w-6 text-orange-600" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">En Livraison</h2>
              <span className="bg-orange-100 text-orange-700 text-sm font-medium px-2 py-1 rounded-full">
                {categorizedDossiers.enLivraison.length}
              </span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
              Livraisons en cours
            </p>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {categorizedDossiers.enLivraison.length === 0 ? (
              <EmptyState
                icon={TruckIcon}
                title="Aucune livraison en cours"
                description="Démarrez une tournée pour voir vos livraisons"
              />
            ) : (
              categorizedDossiers.enLivraison.map((dossier, index) => (
                <DeliveryDossierCard key={dossier.id} dossier={dossier} index={index} />
              ))
            )}
          </div>
        </motion.div>

        {/* Livrés */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
        >
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-6 w-6 text-success-600" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Livrés</h2>
              <span className="bg-success-100 text-success-700 text-sm font-medium px-2 py-1 rounded-full">
                {categorizedDossiers.livres.length}
              </span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
              Livraisons réussies
            </p>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {categorizedDossiers.livres.length === 0 ? (
              <EmptyState
                icon={CheckCircleIcon}
                title="Aucune livraison terminée"
                description="Vos livraisons réussies apparaîtront ici"
              />
            ) : (
              categorizedDossiers.livres.map((dossier, index) => (
                <DeliveryDossierCard key={dossier.id} dossier={dossier} index={index} />
              ))
            )}
          </div>
        </motion.div>

        {/* Retours */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
        >
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Retours</h2>
              <span className="bg-yellow-100 text-yellow-700 text-sm font-medium px-2 py-1 rounded-full">
                {categorizedDossiers.retours.length}
              </span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
              Échecs et reports
            </p>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {categorizedDossiers.retours.length === 0 ? (
              <EmptyState
                icon={ExclamationTriangleIcon}
                title="Aucun retour"
                description="Les échecs et reports apparaîtront ici"
                action={{
                  label: "Voir l'aide",
                  onClick: () => toast.info("📞 Contactez le support en cas de problème")
                }}
              />
            ) : (
              categorizedDossiers.retours.map((dossier, index) => (
                <DeliveryDossierCard key={dossier.id} dossier={dossier} index={index} />
              ))
            )}
          </div>
        </motion.div>
      </div>
    </>
  );

  // Placeholder pour les autres sections
  const renderPlanning = () => (
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8">
      <LoadingSpinner size="md" text="Chargement du planning..." />
    </div>
  );

  const renderTournees = () => (
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8">
      <LoadingSpinner size="md" text="Chargement des tournées..." />
    </div>
  );

  const renderHistorique = () => (
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Historique des livraisons</h2>
      <p className="text-neutral-600 dark:text-neutral-300">Fonctionnalité d&apos;historique en développement...</p>
    </div>
  );

  const renderPerformances = () => (
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Performances de livraison</h2>
      <p className="text-neutral-600 dark:text-neutral-300">Fonctionnalité de performances en développement...</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-300">Chargement des livraisons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {renderContent()}
      </div>

      {/* Modal détails dossier */}
      <AnimatePresence>
        {showDetailsModal && selectedDossier && (
          <DossierDetails
            dossierId={selectedDossier.folder_id || selectedDossier.id}
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedDossier(null);
            }}
            user={user}
            onUpdate={fetchDossiers}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// PropTypes
const PropTypes = require('prop-types');

LivreurDashboard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nom: PropTypes.string,
    prenom: PropTypes.string,
    role: PropTypes.string,
  }),
  activeSection: PropTypes.string,
  onNavigate: PropTypes.func,
};

export default LivreurDashboard;