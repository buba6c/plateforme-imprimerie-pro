import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PrinterIcon,
  ClockIcon,
  CheckCircleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  UserIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CogIcon,
  ChartBarIcon,
  TruckIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import notificationService from '../services/notificationService';
import { Button, Tooltip, EmptyState, LoadingSpinner, ConfirmationModal } from './ui';
import { useToast } from './ui/Toast';

const ImprimeurDashboard = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [dossierToStart, setDossierToStart] = useState(null);
  
  const toast = useToast();

  // Déterminer le type de machine selon le rôle utilisateur
  const machineType = user?.role === 'imprimeur_roland' ? 'roland' : 
                     user?.role === 'imprimeur_xerox' ? 'xerox' : 'all';

  // Statistiques calculées
  const [stats, setStats] = useState({
    aImprimer: 0,
    enImpression: 0,
    termineAujourdhui: 0,
    totalTraite: 0,
    tempsImpression: 0,
    tauxProductivite: 0,
  });

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase();
    if (val.includes('pret') && val.includes('impression')) return 'pret_impression';
    if (val.includes('impression') && !val.includes('pret')) return 'en_impression';
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('termine') || val.includes('finished')) return 'termine';
    if (val.includes('livre') || val.includes('delivered')) return 'livre';
    if (val.includes('cours') || val.includes('preparation')) return 'en_cours';
    if (val.includes('revoir') || val.includes('revision')) return 'a_revoir';
    if (val.includes('brouillon') || val.includes('draft')) return 'brouillon';
    return val.replace(/\s/g, '_');
  };

  // Calcul de priorité d'impression
  const calculatePrintPriority = (dossier) => {
    const created = new Date(dossier.created_at);
    const now = new Date();
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    const status = normalizeStatus(dossier.statut || dossier.status);
    
    // Priorité urgente si prêt depuis plus de 2 jours ou si client attend
    if (status === 'pret_impression' && daysDiff > 2) return 'high';
    if (status === 'pret_impression' && daysDiff > 1) return 'medium';
    if (status === 'en_impression') return 'medium';
    return 'low';
  };

  // Calcul des statistiques d'impression
  const calculatePrintStats = (dossiersList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const aImprimer = dossiersList.filter(d => d.status === 'pret_impression').length;
    const enImpression = dossiersList.filter(d => d.status === 'en_impression').length;
    
    const termineAujourdhui = dossiersList.filter(d => {
      const updated = new Date(d.updated_at || d.created_at);
      return (d.status === 'termine' || d.status === 'pret_livraison') && 
             updated >= today;
    }).length;
    
    const totalTraite = dossiersList.filter(d => 
      ['termine', 'pret_livraison', 'livre'].includes(d.status)
    ).length;
    
    // Estimation temps moyen d'impression (exemple: 2h par dossier)
    const tempsImpression = enImpression * 2; 
    
    // Taux de productivité basé sur les dossiers traités aujourd'hui
    const tauxProductivite = Math.min(100, (termineAujourdhui / Math.max(1, aImprimer + enImpression)) * 100);
    
    setStats({ 
      aImprimer, 
      enImpression, 
      termineAujourdhui, 
      totalTraite, 
      tempsImpression, 
      tauxProductivite: Math.round(tauxProductivite) 
    });
  };

  // Récupération des dossiers avec filtre par machine
  const fetchDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      
      // Filtrer par type de machine selon le rôle
      if (machineType !== 'all') {
        params.type = machineType;
      }

      const data = await dossiersService.getDossiers(params);
      let dossiersList = Array.isArray(data?.dossiers) ? data.dossiers : [];
      
      // Enrichir les dossiers avec données d'impression
      dossiersList = dossiersList.map(d => {
        const status = normalizeStatus(d.statut || d.status);
        const printPriority = calculatePrintPriority(d);
        const isUrgentPrint = printPriority === 'high';
        
        return {
          ...d,
          status,
          printPriority,
          isUrgentPrint,
          // Formats d'affichage
          displayNumber: d.numero_commande || d.numero_dossier || d.numero || `Dossier ${d.id?.toString()?.slice(-8) || 'N/A'}`,
          displayClient: d.client_nom || d.client || d.nom_client || d.client_name || 'Client inconnu',
          displayType: (d.type_formulaire || d.type || d.machine || 'autre').toLowerCase(),
          // Estimation temps d'impression
          estimatedPrintTime: getEstimatedPrintTime(d),
        };
      });
      
      // Filtrer par dossiers pertinents pour l'imprimeur
      dossiersList = dossiersList.filter(d => 
        ['pret_impression', 'en_impression', 'termine', 'pret_livraison'].includes(d.status) ||
        (machineType !== 'all' && d.displayType === machineType)
      );
      
      setDossiers(dossiersList);
      calculatePrintStats(dossiersList);
      
    } catch (error) {
      console.error('Erreur lors de la récupération des dossiers:', error);
      setDossiers([]);
      toast.error('Erreur lors du chargement des tâches d\'impression');
    } finally {
      setLoading(false);
    }
  }, [machineType, toast]);

  // Estimation du temps d'impression
  const getEstimatedPrintTime = (dossier) => {
    // Logique simple d'estimation basée sur le type
    const baseTime = dossier.displayType === 'roland' ? 90 : 60; // minutes
    const pages = dossier.pages || dossier.nombre_pages || 1;
    const complexity = dossier.complexite || 1;
    
    return Math.round(baseTime * Math.sqrt(pages) * complexity);
  };

  // Rafraîchissement avec animation
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDossiers();
    toast.success('Tâches d\'impression actualisées');
    setTimeout(() => setRefreshing(false), 1000);
  };
  const confirmStartPrint = async () => {
    try {
      // TODO: API call pour démarrer l'impression
      // await dossiersService.updateStatus(dossierToStart.id, 'en_impression');
      toast.success(`✨ Impression démarrée pour ${dossierToStart.displayNumber}`);
      await fetchDossiers();
    } catch (error) {
      toast.error('Erreur lors du démarrage de l\'impression');
    } finally {
      setShowStartConfirm(false);
      setDossierToStart(null);
    }
  };

  // Filtrage des dossiers
  const filteredDossiers = dossiers.filter(dossier => {
    const matchesSearch = searchTerm === '' || 
      dossier.displayNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dossier.displayClient.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || dossier.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Catégorisation des dossiers pour imprimeurs
  const categorizedDossiers = {
    aImprimer: filteredDossiers.filter(d => d.status === 'pret_impression'),
    enImpression: filteredDossiers.filter(d => d.status === 'en_impression'),
    termines: filteredDossiers.filter(d => ['termine', 'pret_livraison'].includes(d.status)),
    urgent: filteredDossiers.filter(d => d.isUrgentPrint),
  };

  useEffect(() => {
    // Ne charger les dossiers que si l'utilisateur est connecté
    if (user && user.id) {
      fetchDossiers();
    }

    // Écouter les notifications
    const unsubscribe = notificationService.on('refresh_dossiers_list', fetchDossiers);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user, user?.id, fetchDossiers]);

  // Composant Badge de statut d'impression
  const PrintStatusBadge = ({ status, size = 'sm' }) => {
    const configs = {
      pret_impression: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Prêt à imprimer', icon: '🖨️' },
      en_impression: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En impression', icon: '⚡' },
      termine: { bg: 'bg-success-100', text: 'text-success-700', label: 'Terminé', icon: '✅' },
      pret_livraison: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Prêt livraison', icon: '📦' },
      livre: { bg: 'bg-green-200', text: 'text-green-800', label: 'Livré', icon: '🚚' },
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

  // Composant Priority Badge pour impression
  const PrintPriorityBadge = ({ priority, estimatedTime }) => {
    const configs = {
      high: { bg: 'bg-error-100', text: 'text-error-700', label: 'Urgent', icon: '🔥' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Normal', icon: '⏰' },
      low: { bg: 'bg-success-100', text: 'text-success-700', label: 'Faible', icon: '🟢' },
    };

    const config = configs[priority] || configs.low;

    return (
      <div className="flex flex-col gap-1">
        <span className={`${config.bg} ${config.text} text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1`}>
          <span>{config.icon}</span>
          {config.label}
        </span>
        {estimatedTime && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
            ~{estimatedTime}min
          </span>
        )}
      </div>
    );
  };

  // Composant Card de dossier d'impression
  const PrintDossierCard = ({ dossier, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow ${
        dossier.isUrgentPrint ? 'border-l-4 border-l-red-500' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-bold text-neutral-900 dark:text-white">
              {dossier.displayNumber}
            </span>
            {dossier.isUrgentPrint && (
              <ExclamationTriangleIcon className="h-5 w-5 text-error-500" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 mb-2">
            <UserIcon className="h-4 w-4" />
            <span className="truncate">{dossier.displayClient}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <PrintStatusBadge status={dossier.status} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <PrintPriorityBadge priority={dossier.printPriority} estimatedTime={dossier.estimatedPrintTime} />
          </div>
          <div className="flex items-center gap-2">
            <TagIcon className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">{dossier.displayType}</span>
            {dossier.displayType === machineType && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                MA MACHINE
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => {
              setSelectedDossier(dossier);
              setShowDetailsModal(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
            Voir
          </button>
          <span className="text-xs text-gray-400">
            {new Date(dossier.created_at).toLocaleDateString('fr-FR')}
          </span>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Chargement des tâches d'impression..." />
      </div>
    );
  }

  const machineLabel = machineType === 'roland' ? 'Roland' : 
                      machineType === 'xerox' ? 'Xerox' : 
                      'Toutes machines';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header spécifique imprimeur */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                <PrinterIcon className="h-8 w-8 text-purple-600" />
                Dashboard Imprimeur {machineLabel}
              </h1>
              <p className="text-neutral-600 dark:text-neutral-300 mt-1">
                Bonjour {user.prenom || user.nom}, gérez votre production d'impression
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center gap-1">
                  <CalendarDaysIcon className="h-4 w-4" />
                  {new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  {new Date().toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <CogIcon className="h-4 w-4" />
                  <span className="font-medium">{machineLabel}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Tooltip content="Actualiser les tâches d'impression">
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

        {/* Statistiques d'impression */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">À Imprimer</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.aImprimer}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Dossiers prêts</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100">
                <DocumentIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">En Impression</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{stats.enImpression}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">~{stats.tempsImpression}h restantes</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-100">
                <PrinterIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Terminés Aujourd'hui</p>
                <p className="text-3xl font-bold text-success-600 mt-2">{stats.termineAujourdhui}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Production du jour</p>
              </div>
              <div className="p-3 rounded-lg bg-success-100">
                <CheckCircleIcon className="h-6 w-6 text-success-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Productivité</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.tauxProductivite}%</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Performance du jour</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-100">
                <ChartBarIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filtres et recherche pour impression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro ou client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pret_impression">Prêt à imprimer</option>
                  <option value="en_impression">En impression</option>
                  <option value="termine">Terminé</option>
                  <option value="pret_livraison">Prêt livraison</option>
                </select>
              </div>
            </div>
          </div>
          
          {(searchTerm || filterStatus !== 'all') && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {filteredDossiers.length} dossier(s) trouvé(s)
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="text-sm text-purple-600 hover:text-purple-700 underline"
              >
                Effacer filtres
              </button>
            </div>
          )}
        </motion.div>

        {/* Dossiers urgents d'impression */}
        {categorizedDossiers.urgent.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-error-50 rounded-xl border border-red-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-error-600" />
              <h2 className="text-xl font-bold text-red-900">
                Impressions Urgentes ({categorizedDossiers.urgent.length})
              </h2>
            </div>
            <div className="grid gap-4">
              {categorizedDossiers.urgent.map((dossier, index) => (
                <PrintDossierCard key={dossier.id} dossier={dossier} index={index} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Sections des dossiers d'impression */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* À imprimer */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
          >
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <DocumentIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">À Imprimer</h2>
                <span className="bg-blue-100 text-blue-700 text-sm font-medium px-2 py-1 rounded-full">
                  {categorizedDossiers.aImprimer.length}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
                Dossiers prêts pour impression
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {categorizedDossiers.aImprimer.length === 0 ? (
                <EmptyState
                  icon={DocumentIcon}
                  title="Aucun dossier à imprimer"
                  description="Les nouveaux dossiers apparaîtront ici"
                />
              ) : (
                categorizedDossiers.aImprimer.map((dossier, index) => (
                  <PrintDossierCard key={dossier.id} dossier={dossier} index={index} />
                ))
              )}
            </div>
          </motion.div>

          {/* En impression */}
          <motion.div
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
          >
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <PrinterIcon className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">En Impression</h2>
                <span className="bg-purple-100 text-purple-700 text-sm font-medium px-2 py-1 rounded-full">
                  {categorizedDossiers.enImpression.length}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
                Impression en cours
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {categorizedDossiers.enImpression.length === 0 ? (
                <EmptyState
                  icon={PrinterIcon}
                  title="Aucune impression en cours"
                  description="Démarrez une impression depuis la file d'attente"
                />
              ) : (
                categorizedDossiers.enImpression.map((dossier, index) => (
                  <PrintDossierCard key={dossier.id} dossier={dossier} index={index} />
                ))
              )}
            </div>
          </motion.div>

          {/* Terminés */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
          >
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <TruckIcon className="h-6 w-6 text-success-600" />
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Terminés</h2>
                <span className="bg-success-100 text-success-700 text-sm font-medium px-2 py-1 rounded-full">
                  {categorizedDossiers.termines.length}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
                Prêts pour livraison
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {categorizedDossiers.termines.length === 0 ? (
                <EmptyState
                  icon={TruckIcon}
                  title="Aucun dossier terminé"
                  description="Les impressions terminées apparaîtront ici"
                />
              ) : (
                categorizedDossiers.termines.map((dossier, index) => (
                  <PrintDossierCard key={dossier.id} dossier={dossier} index={index} />
                ))
              )}
            </div>
          </motion.div>
        </div>

      </div>

      {/* Modal confirmation démarrage impression */}
      {showStartConfirm && dossierToStart && (
        <ConfirmationModal
          isOpen={showStartConfirm}
          onClose={() => setShowStartConfirm(false)}
          onConfirm={confirmStartPrint}
          title="Démarrer l'impression"
          message={`Voulez-vous démarrer l'impression de ${dossierToStart.displayNumber} ?`}
          confirmText="Démarrer"
          cancelText="Annuler"
          type="info"
        />
      )}

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

export default ImprimeurDashboard;