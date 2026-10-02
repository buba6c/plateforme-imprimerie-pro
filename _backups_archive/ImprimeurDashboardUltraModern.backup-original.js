import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PrinterIcon,
  QueueListIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  ChartBarIcon,
  CogIcon,
  PlayIcon,
  SparklesIcon,
  BoltIcon,
  CalendarDaysIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import notificationService from '../services/notificationService';
import PropTypes from 'prop-types';

const ImprimeurDashboardUltraModern = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState('production'); // production, machines, analytics
  const [selectedMachine, setSelectedMachine] = useState('all'); // all, roland, xerox

  // États des machines (simulé)
  const [machineStatus, setMachineStatus] = useState({
    roland: {
      status: 'active',
      currentJob: null,
      queue: 0,
      efficiency: 85,
      maintenance: false,
      lastService: '2025-01-15',
      totalJobs: 42,
      avgTime: '2.5h'
    },
    xerox: {
      status: 'active',
      currentJob: null,
      queue: 0,
      efficiency: 92,
      maintenance: false,
      lastService: '2025-01-10',
      totalJobs: 38,
      avgTime: '1.8h'
    }
  });

  // Statistiques calculées
  const [stats, setStats] = useState({
    totalDossiers: 0,
    enImpression: 0,
    fileAttente: 0,
    termines: 0,
    productionJour: 0,
    tempsProduction: 0,
    efficacite: 0,
    maintenanceRequise: false,
  });

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase().trim();
    if (val === 'prêt pour impression' || val === 'pret_impression') return 'pret_impression';
    if (val === 'en impression' || val === 'en_impression') return 'en_impression';
    if (val === 'terminé' || val === 'termine' || val === 'fini') return 'termine';
    if (val === 'en livraison' || val === 'en_livraison') return 'en_livraison';
    if (val === 'livré' || val === 'livre') return 'livre';
    return val;
  };

  // Chargement des dossiers
  const loadDossiers = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);
      console.log('🔍 Chargement dossiers pour imprimeur:', user.role);
      const response = await dossiersService.getDossiers();
      console.log('📊 Réponse API complète:', response);
      
      // dossiersService.getDossiers() retourne déjà response.data du backend
      // Donc response = { success: true, dossiers: [...], count: x }
      if (response?.success && Array.isArray(response.dossiers)) {
        const imprimeurDossiers = response.dossiers;
        console.log(`✅ ${imprimeurDossiers.length} dossiers chargés pour ${user.role}`);
        if (imprimeurDossiers.length > 0) {
          console.log('Premier dossier:', imprimeurDossiers[0]);
        }
        setDossiers(imprimeurDossiers);
        calculateStats(imprimeurDossiers);
        updateMachineQueues(imprimeurDossiers);
      } else {
        console.warn('⚠️ Réponse API invalide ou vide:', response);
        setDossiers([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement dossiers:', error);
      notificationService.error('Erreur lors du chargement des dossiers');
      setDossiers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.role]);

  // Calcul des statistiques
  const calculateStats = (dossiersList) => {
    const totalDossiers = dossiersList.length;
    const enImpression = dossiersList.filter(d => normalizeStatus(d.statut) === 'en_impression').length;
    const fileAttente = dossiersList.filter(d => normalizeStatus(d.statut) === 'pret_impression').length;
    const termines = dossiersList.filter(d => normalizeStatus(d.statut) === 'termine').length;
    
    const today = new Date();
    const productionJour = dossiersList.filter(d => {
      const updated = new Date(d.updated_at || d.created_at);
      return updated.toDateString() === today.toDateString() && normalizeStatus(d.statut) === 'termine';
    }).length;

    setStats({
      totalDossiers,
      enImpression,
      fileAttente,
      termines,
      productionJour,
      tempsProduction: enImpression * 2.1, // estimation en heures
      efficacite: Math.min(100, Math.round((termines / Math.max(1, totalDossiers)) * 100)),
      maintenanceRequise: Math.random() > 0.8, // simulation maintenance
    });
  };

  // Mise à jour des files d'attente des machines
  const updateMachineQueues = (dossiersList) => {
    const rolandQueue = dossiersList.filter(d => 
      d.type_formulaire === 'roland' && normalizeStatus(d.statut) === 'pret_impression'
    ).length;
    const xeroxQueue = dossiersList.filter(d => 
      d.type_formulaire === 'xerox' && normalizeStatus(d.statut) === 'pret_impression'
    ).length;

    setMachineStatus(prev => ({
      ...prev,
      roland: { ...prev.roland, queue: rolandQueue },
      xerox: { ...prev.xerox, queue: xeroxQueue }
    }));
  };

  useEffect(() => {
    // Ne charger les dossiers que si l'utilisateur est connecté
    if (user && user.id) {
      loadDossiers(true);
    }
    
    // Simulation temps réel des machines
    const interval = setInterval(() => {
      setMachineStatus(prev => ({
        ...prev,
        roland: { 
          ...prev.roland, 
          efficiency: Math.min(100, prev.roland.efficiency + (Math.random() - 0.5) * 2) 
        },
        xerox: { 
          ...prev.xerox, 
          efficiency: Math.min(100, prev.xerox.efficiency + (Math.random() - 0.5) * 2) 
        }
      }));
    }, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [user?.id, loadDossiers]);

  // Filtrage des dossiers par machine
  const filteredDossiers = dossiers.filter(dossier => {
    if (selectedMachine === 'all') return true;
    return dossier.type_formulaire === selectedMachine;
  });

  // Composant Status Badge spécialisé imprimeur
  const PrintStatusBadge = ({ status, size = 'md' }) => {
    const configs = {
      pret_impression: { 
        bg: 'bg-gradient-to-r from-blue-100 to-cyan-100', 
        text: 'text-blue-800', 
        label: 'Prêt à imprimer',
        icon: '🟦',
        ring: 'ring-blue-200'
      },
      en_impression: { 
        bg: 'bg-gradient-to-r from-purple-100 to-violet-100', 
        text: 'text-purple-800', 
        label: 'En impression',
        icon: '🖨️',
        ring: 'ring-purple-200',
        pulse: true
      },
      termine: { 
        bg: 'bg-gradient-to-r from-emerald-100 to-green-100', 
        text: 'text-emerald-800', 
        label: 'Terminé',
        icon: '✅',
        ring: 'ring-emerald-200'
      },
    };

    const config = configs[status] || { 
      bg: 'bg-gradient-to-r from-gray-100 to-slate-100', 
      text: 'text-neutral-700 dark:text-neutral-200', 
      label: status || 'Inconnu',
      icon: '📄',
      ring: 'ring-gray-200'
    };
    
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : size === 'lg' ? 'text-base px-4 py-2' : 'text-sm px-3 py-1.5';

    return (
      <span className={`${config.bg} ${config.text} ${config.ring} ${sizeClass} rounded-full font-medium inline-flex items-center gap-2 ring-1 shadow-sm ${config.pulse ? 'animate-pulse' : ''}`}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Composant Machine Card
  const MachineCard = ({ machineType, status, data }) => {
    const isRoland = machineType === 'roland';
    const bgGradient = isRoland 
      ? 'from-purple-500 to-violet-600' 
      : 'from-emerald-500 to-green-600';
    const bgLight = isRoland 
      ? 'from-purple-50 to-violet-50' 
      : 'from-emerald-50 to-green-50';

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-gradient-to-br ${bgLight} rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border border-neutral-100 group hover:-translate-y-1`}
      >
        {/* Header avec icône */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 bg-gradient-to-r ${bgGradient} text-white rounded-xl`}>
              <PrinterIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white text-lg">
                {isRoland ? 'Roland VersaCamm' : 'Xerox PrimeLink'}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-300 text-sm">
                {isRoland ? 'Impression grand format' : 'Impression haute résolution'}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'active' 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-error-100 text-error-700'
          }`}>
            {status === 'active' ? '🟢 Actif' : '🔴 Arrêtée'}
          </div>
        </div>

        {/* Métriques */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-white dark:bg-neutral-800 rounded-xl">
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">{data.queue}</div>
            <div className="text-neutral-600 dark:text-neutral-300 text-sm">En file</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-neutral-800 rounded-xl">
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">{data.efficiency}%</div>
            <div className="text-neutral-600 dark:text-neutral-300 text-sm">Efficacité</div>
          </div>
        </div>

        {/* Barre de progression efficacité */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-300 mb-1">
            <span>Performance</span>
            <span>{data.efficiency}%</span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
            <div 
              className={`bg-gradient-to-r ${bgGradient} h-2 rounded-full transition-all duration-1000`}
              style={{ width: `${data.efficiency}%` }}
            ></div>
          </div>
        </div>

        {/* Informations supplémentaires */}
        <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
          <div className="flex justify-between">
            <span>Travaux aujourd&apos;hui:</span>
            <span className="font-medium">{data.totalJobs}</span>
          </div>
          <div className="flex justify-between">
            <span>Temps moyen:</span>
            <span className="font-medium">{data.avgTime}</span>
          </div>
          <div className="flex justify-between">
            <span>Dernière maintenance:</span>
            <span className="font-medium">{data.lastService}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button 
            onClick={() => setSelectedMachine(machineType)}
            className={`w-full p-2 bg-gradient-to-r ${bgGradient} text-white rounded-lg font-medium hover:shadow-lg dark:shadow-secondary-900/25 transition-all duration-300 flex items-center justify-center gap-2`}
          >
            <QueueListIcon className="h-4 w-4" />
            Voir la file
          </button>
        </div>
      </motion.div>
    );
  };

  // Actions sur les dossiers
  const handleViewDetails = (dossier) => {
    setSelectedDossier(dossier);
    setShowDetailsModal(true);
  };

  const handleStartPrinting = async (dossier) => {
    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossier.id, 'en_impression', {
        commentaire: `Impression démarrée par ${user?.nom || 'Imprimeur'}`
      });
      notificationService.success(`Impression démarrée pour "${dossier.nom}"`);
      loadDossiers();
    } catch (error) {
      console.error('❌ Erreur démarrage impression:', error);
      notificationService.error('Erreur lors du démarrage de l\'impression');
    } finally {
      setRefreshing(false);
    }
  };

  // Marquer comme imprimé (depuis "En impression")
  const handleMarkPrinted = async (dossier) => {
    try {
      setRefreshing(true);
      // 1. Marquer comme imprimé
      await dossiersService.updateDossierStatus(dossier.id, 'imprime', {
        commentaire: `Impression terminée (imprimé) par ${user?.nom || 'Imprimeur'}`
      });
      // 2. Enchaîner automatiquement vers prêt livraison
      await dossiersService.updateDossierStatus(dossier.id, 'pret_livraison', {
        commentaire: `Auto: passage en prêt livraison après impression par ${user?.nom || 'Imprimeur'}`
      });
      notificationService.success(`Dossier marqué comme imprimé et prêt pour livraison: "${dossier.nom}"`);
      loadDossiers();
    } catch (error) {
      console.error('❌ Erreur marquage imprimé:', error);
      notificationService.error('Erreur lors du marquage "imprimé"');
    } finally {
      setRefreshing(false);
    }
  };

  // Passer en "Prêt livraison" (depuis "Imprimé")
  const handleReadyForDelivery = async (dossier) => {
    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossier.id, 'pret_livraison', {
        commentaire: `Prêt pour livraison (imprimeur: ${user?.nom || 'Imprimeur'})`
      });
      notificationService.success(`Dossier prêt pour livraison: "${dossier.nom}"`);
      loadDossiers();
    } catch (error) {
      console.error('❌ Erreur prêt livraison:', error);
      notificationService.error('Erreur lors du passage en "Prêt livraison"');
    } finally {
      setRefreshing(false);
    }
  };

  // Repasser en "En cours" (arrêt/retour)
  const handleBackToPreparation = async (dossier) => {
    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossier.id, 'en_cours', {
        commentaire: `Retour en cours par ${user?.nom || 'Imprimeur'}`
      });
      notificationService.success(`Dossier remis "En cours": "${dossier.nom}"`);
      loadDossiers();
    } catch (error) {
      console.error('❌ Erreur retour en cours:', error);
      notificationService.error('Erreur lors du retour en "En cours"');
    } finally {
      setRefreshing(false);
    }
  };

  // Mettre à revoir (commentaire requis)
  const handleMarkToReview = async (dossier) => {
    try {
      const comment = window.prompt('Entrez un commentaire pour "À revoir":');
      if (!comment || !comment.trim()) {
        notificationService.error('Commentaire obligatoire pour "À revoir"');
        return;
      }
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossier.id, 'a_revoir', { commentaire: comment.trim() });
      notificationService.success(`Dossier marqué "À revoir": "${dossier.nom}"`);
      loadDossiers();
    } catch (error) {
      console.error('❌ Erreur mise à revoir:', error);
      notificationService.error('Erreur lors du passage en "À revoir"');
    } finally {
      setRefreshing(false);
    }
  };

  // Ancien bouton "Terminer" remplacé par séquence Imprimé -> Prêt livraison
  // Utiliser handleMarkPrinted puis handleReadyForDelivery

  // Navigation secondaire
  const viewTabs = [
    { id: 'production', label: 'Production', icon: PrinterIcon },
    { id: 'machines', label: 'Machines', icon: CogIcon },
    { id: 'analytics', label: 'Analytiques', icon: ChartBarIcon },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <PrinterIcon className="h-8 w-8 text-white" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-300 font-medium">Chargement du centre d&apos;impression...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50">
      {/* Header moderne avec gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-2xl"
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <div className="p-3 bg-white dark:bg-neutral-800/20 rounded-2xl backdrop-blur-sm">
                  <PrinterIcon className="h-8 w-8" />
                </div>
                Centre d&apos;Impression
              </h1>
              <p className="text-purple-100 mt-2 text-lg">
                Bienvenue, {user?.nom || 'Imprimeur'}! Gérez vos impressions en temps réel
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => loadDossiers(true)}
                disabled={refreshing}
                className="p-3 bg-white dark:bg-neutral-800/20 hover:bg-white dark:bg-neutral-800/30 rounded-xl backdrop-blur-sm transition-all duration-300 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-6 w-6 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-800/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Système actif</span>
              </div>
            </div>
          </div>

          {/* Navigation secondaire */}
          <div className="flex gap-2 mt-8">
            {viewTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeView === tab.id
                    ? 'bg-white dark:bg-neutral-800 text-purple-600 shadow-lg dark:shadow-secondary-900/25'
                    : 'text-purple-100 hover:bg-white dark:bg-neutral-800/20'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Vue Production */}
        {activeView === 'production' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Statistiques rapides */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border border-neutral-100 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">En file d&apos;attente</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{stats.fileAttente}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Prêts à imprimer</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 group-hover:scale-110 transition-transform duration-300">
                    <QueueListIcon className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border border-neutral-100 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">En cours</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{stats.enImpression}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Actuellement</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 group-hover:scale-110 transition-transform duration-300">
                    <PrinterIcon className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border border-neutral-100 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Terminés</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.termines}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Total</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border border-neutral-100 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Efficacité</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">{stats.efficacite}%</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Performance</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 group-hover:scale-110 transition-transform duration-300">
                    <SparklesIcon className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filtres */}
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Filtrer par machine:</h3>
                <div className="flex gap-2">
                  {['all', 'roland', 'xerox'].map(machine => (
                    <button
                      key={machine}
                      onClick={() => setSelectedMachine(machine)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                        selectedMachine === machine
                          ? 'bg-purple-500 text-white shadow-lg dark:shadow-secondary-900/25'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700'
                      }`}
                    >
                      {machine === 'all' ? 'Toutes' : machine === 'roland' ? '🖨️ Roland' : '🖨️ Xerox'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Liste des travaux d'impression */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredDossiers.map((dossier, index) => (
                  <motion.div
                    key={dossier.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border border-neutral-100 group hover:-translate-y-2"
                  >
                    {/* En-tête */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-neutral-900 dark:text-white mb-1 group-hover:text-purple-600 transition-colors duration-300">
                          {dossier.nom || 'Sans nom'}
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{dossier.client}</p>
                      </div>
                      <PrintStatusBadge status={normalizeStatus(dossier.statut)} size="sm" />
                    </div>

                    {/* Informations */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                        <CalendarDaysIcon className="h-4 w-4" />
                        {new Date(dossier.created_at).toLocaleDateString()}
                      </div>
                      {dossier.type_formulaire && (
                        <div className="flex items-center gap-2">
                          <TagIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            dossier.type_formulaire === 'roland' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {dossier.type_formulaire === 'roland' ? '🖨️ Roland' : '🖨️ Xerox'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(dossier)}
                        className="flex-1 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 rounded-lg font-medium hover:bg-neutral-100 dark:bg-neutral-800 transition-colors duration-300 flex items-center justify-center gap-2"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Voir
                      </button>
                      
                      {normalizeStatus(dossier.statut) === 'pret_impression' && (
                        <button
                          onClick={() => handleStartPrinting(dossier)}
                          disabled={refreshing}
                          className="flex-1 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg font-medium hover:bg-purple-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <PlayIcon className="h-4 w-4" />
                          Imprimer
                        </button>
                      )}

                      {normalizeStatus(dossier.statut) === 'en_impression' && (
                        <>
                          <button
                            onClick={() => handleMarkPrinted(dossier)}
                            disabled={refreshing}
                            className="flex-1 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-medium hover:bg-emerald-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Marquer imprimé
                          </button>
                          <button
                            onClick={() => handleMarkToReview(dossier)}
                            disabled={refreshing}
                            className="flex-1 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg font-medium hover:bg-yellow-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            🔄 À revoir
                          </button>
                        </>
                      )}

                      {normalizeStatus(dossier.statut) === 'imprime' && (
                        <>
                          <button
                            onClick={() => handleReadyForDelivery(dossier)}
                            disabled={refreshing}
                            className="flex-1 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg font-medium hover:bg-orange-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            📦 Prêt livraison
                          </button>
                          <button
                            onClick={() => handleStartPrinting(dossier)}
                            disabled={refreshing}
                            className="flex-1 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg font-medium hover:bg-purple-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            🖨️ Reprendre impression
                          </button>
                          <button
                            onClick={() => handleMarkToReview(dossier)}
                            disabled={refreshing}
                            className="flex-1 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg font-medium hover:bg-yellow-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            🔄 À revoir
                          </button>
                        </>
                      )}

                      {normalizeStatus(dossier.statut) === 'pret_impression' && (
                        <button
                          onClick={() => handleMarkToReview(dossier)}
                          disabled={refreshing}
                          className="flex-1 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg font-medium hover:bg-yellow-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          🔄 À revoir
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filteredDossiers.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg dark:shadow-secondary-900/25"
              >
                <PrinterIcon className="h-16 w-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-neutral-600 dark:text-neutral-300 mb-2">Aucun travail d&apos;impression</h3>
                <p className="text-neutral-500 dark:text-neutral-400">Toutes les impressions sont terminées</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Vue Machines */}
        {activeView === 'machines' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MachineCard 
                machineType="roland" 
                status={machineStatus.roland.status} 
                data={machineStatus.roland} 
              />
              <MachineCard 
                machineType="xerox" 
                status={machineStatus.xerox.status} 
                data={machineStatus.xerox} 
              />
            </div>
          </motion.div>
        )}

        {/* Vue Analytiques */}
        {activeView === 'analytics' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Production du jour */}
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                  <BoltIcon className="h-6 w-6 text-purple-600" />
                  Production Aujourd&apos;hui
                </h3>
                <div className="text-center p-6 bg-purple-50 rounded-xl">
                  <div className="text-4xl font-bold text-purple-600 mb-2">{stats.productionJour}</div>
                  <div className="text-purple-700 font-medium">Impressions terminées</div>
                  <div className="text-neutral-600 dark:text-neutral-300 text-sm mt-2">
                    Temps total: {stats.tempsProduction.toFixed(1)}h
                  </div>
                </div>
              </div>

              {/* État des machines */}
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                  <CogIcon className="h-6 w-6 text-emerald-600" />
                  Performance des Machines
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl">
                    <span className="font-medium text-purple-900">Roland - Efficacité</span>
                    <span className="text-2xl font-bold text-purple-600">{machineStatus.roland.efficiency}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
                    <span className="font-medium text-emerald-900">Xerox - Efficacité</span>
                    <span className="text-2xl font-bold text-emerald-600">{machineStatus.xerox.efficiency}%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal des détails */}
      <AnimatePresence>
        {showDetailsModal && selectedDossier && (
          <DossierDetails
            dossierId={
              selectedDossier.id || 
              selectedDossier.folder_id || 
              selectedDossier.dossier_id ||
              selectedDossier.numero_dossier
            }
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedDossier(null);
            }}
            user={user}
            onUpdate={loadDossiers}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// PropTypes validation
ImprimeurDashboardUltraModern.propTypes = {
  user: PropTypes.shape({
    nom: PropTypes.string
  })
};

ImprimeurDashboardUltraModern.defaultProps = {
  user: {
    nom: 'Imprimeur'
  }
};

export default ImprimeurDashboardUltraModern;