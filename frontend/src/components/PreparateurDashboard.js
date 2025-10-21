import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  PrinterIcon,
  TruckIcon,
  PlusCircleIcon,
  FolderIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  UserIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import CreateDossier from './dossiers/CreateDossier';
import notificationService from '../services/notificationService';
import { Button, Tooltip, EmptyState, LoadingSpinner, Badge } from './ui';
import { useToast } from './ui/Toast';

const PreparateurDashboard = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Statistiques calculées
  const [stats, setStats] = useState({
    total: 0,
    enCours: 0,
    termine: 0,
    enRetard: 0,
    pourcentageCompletion: 0,
  });

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase();
    if (val.includes('cours') || val.includes('preparation')) return 'en_cours';
    if (val.includes('revoir') || val.includes('revision')) return 'a_revoir';
    if (val.includes('impression') && !val.includes('prêt')) return 'en_impression';
    if (val.includes('pret') && val.includes('impression')) return 'pret_impression';
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('livraison')) return 'en_livraison';
    if (val.includes('livre') || val.includes('delivered')) return 'livre';
    if (val.includes('termine') || val.includes('finished')) return 'termine';
    if (val.includes('brouillon') || val.includes('draft')) return 'brouillon';
    return val.replace(/\s/g, '_');
  };

  // Calcul de priorité
  const calculatePriority = (dossier) => {
    const created = new Date(dossier.created_at);
    const now = new Date();
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 7) return 'high';
    if (daysDiff > 3) return 'medium';
    return 'low';
  };

  // Calcul d'urgence
  const calculateUrgency = (dossier) => {
    const status = normalizeStatus(dossier.statut || dossier.status);
    const priority = calculatePriority(dossier);
    
    return (status === 'a_revoir' && priority === 'high') || 
           (status === 'en_cours' && priority === 'high');
  };

  // Calcul des statistiques
  const calculateStats = (dossiersList) => {
    const total = dossiersList.length;
    const enCours = dossiersList.filter(d => 
      ['en_cours', 'a_revoir', 'brouillon'].includes(d.status)
    ).length;
    const termine = dossiersList.filter(d => 
      ['termine', 'livre'].includes(d.status)
    ).length;
    const enRetard = dossiersList.filter(d => d.isUrgent).length;
    const pourcentageCompletion = total > 0 ? Math.round((termine / total) * 100) : 0;
    
    setStats({ total, enCours, termine, enRetard, pourcentageCompletion });
  };

  // Récupération des dossiers avec enrichissement
  const toast = useToast();

  const fetchDossiers = useCallback(async () => {
    console.log('🔄 fetchDossiers: Début du chargement...');
    setLoading(true);
    try {
      console.log('🔌 fetchDossiers: Appel dossiersService.getDossiers...');
      const data = await dossiersService.getDossiers({});
      console.log('✅ fetchDossiers: Données reçues:', data);
      
      let dossiersList = Array.isArray(data?.dossiers) ? data.dossiers : [];
      console.log(`📋 fetchDossiers: ${dossiersList.length} dossiers trouvés`);
      
      // Enrichir les dossiers avec données calculées
      dossiersList = dossiersList.map(d => {
        const status = normalizeStatus(d.statut || d.status);
        const priority = calculatePriority(d);
        const isUrgent = calculateUrgency(d);
        
        return {
          ...d,
          status,
          priority,
          isUrgent,
          // Formats d'affichage
          displayNumber: d.numero_commande || d.numero_dossier || d.numero || `Dossier ${d.id?.toString()?.slice(-8) || 'N/A'}`,
          displayClient: d.client_nom || d.client || d.nom_client || d.client_name || 'Client inconnu',
          displayType: (d.type_formulaire || d.type || d.machine || 'autre').toLowerCase(),
        };
      });
      
      console.log('📊 fetchDossiers: Dossiers enrichis:', dossiersList.map(d => `${d.displayNumber} - ${d.displayClient} - ${d.status}`));
      setDossiers(dossiersList);
      calculateStats(dossiersList);
      console.log('✅ fetchDossiers: Terminé avec succès');
      
    } catch (error) {
      console.error('❌ fetchDossiers: Erreur lors de la récupération des dossiers:', error);
      console.error('❌ fetchDossiers: Stack trace:', error.stack);
      console.error('❌ fetchDossiers: Response:', error.response);
      setDossiers([]);
      toast.error('Erreur lors du chargement des dossiers');
    } finally {
      setLoading(false);
      console.log('🔄 fetchDossiers: Loading terminé');
    }
  }, [toast]);

  // Rafraîchissement avec animation
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDossiers();
    toast.success('Dossiers actualisés');
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Filtrage des dossiers
  const filteredDossiers = dossiers.filter(dossier => {
    const matchesSearch = searchTerm === '' || 
      dossier.displayNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dossier.displayClient.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || dossier.status === filterStatus;
    const matchesType = filterType === 'all' || dossier.displayType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Catégorisation des dossiers filtrés
  const categorizedDossiers = {
    enCours: filteredDossiers.filter(d => ['en_cours', 'a_revoir', 'brouillon'].includes(d.status)),
    enImpression: filteredDossiers.filter(d => ['en_impression', 'pret_impression'].includes(d.status)),
    enLivraison: filteredDossiers.filter(d => ['en_livraison', 'pret_livraison', 'termine', 'livre'].includes(d.status)),
    urgent: filteredDossiers.filter(d => d.isUrgent),
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
  }, [user?.id, fetchDossiers]);

  // Composant Badge de statut amélioré
  const StatusBadge = ({ status, size = 'sm' }) => {
    const configs = {
      brouillon: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', label: 'Brouillon' },
      en_cours: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En cours' },
      a_revoir: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'À revoir' },
      en_impression: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En impression' },
      pret_impression: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Prêt impression' },
      en_livraison: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'En livraison' },
      pret_livraison: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Prêt livraison' },
      termine: { bg: 'bg-success-100', text: 'text-success-700', label: 'Terminé' },
      livre: { bg: 'bg-green-200', text: 'text-green-800', label: 'Livré' },
    };

    const config = configs[status] || { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-200', label: status };
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

    return (
      <span className={`${config.bg} ${config.text} ${sizeClass} rounded-full font-medium`}>
        {config.label}
      </span>
    );
  };

  // Composant Priority Badge
  const PriorityBadge = ({ priority }) => {
    const configs = {
      high: { bg: 'bg-error-100', text: 'text-error-700', label: 'Urgent', icon: '🔴' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Normal', icon: '🟡' },
      low: { bg: 'bg-success-100', text: 'text-success-700', label: 'Faible', icon: '🟢' },
    };

    const config = configs[priority] || configs.low;

    return (
      <span className={`${config.bg} ${config.text} text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1`}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Composant Card de dossier
  const DossierCard = ({ dossier, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow ${
        dossier.isUrgent ? 'border-l-4 border-l-red-500' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-bold text-neutral-900 dark:text-white">
              {dossier.displayNumber}
            </span>
            {dossier.isUrgent && (
              <ExclamationTriangleIcon className="h-5 w-5 text-error-500" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 mb-2">
            <UserIcon className="h-4 w-4" />
            <span className="truncate">{dossier.displayClient}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={dossier.status} />
            <PriorityBadge priority={dossier.priority} />
          </div>
          {dossier.displayType && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <TagIcon className="h-3 w-3" />
              <span className="uppercase font-medium">{dossier.displayType}</span>
            </div>
          )}
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
        <LoadingSpinner size="lg" text="Chargement des dossiers..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header amélioré */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                Tableau de Bord Préparateur
              </h1>
              <p className="text-neutral-600 dark:text-neutral-300 mt-1">
                Bonjour {user.prenom || user.nom}, gérez vos dossiers en préparation
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
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Tooltip content="Actualiser la liste des dossiers">
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  variant="secondary"
                  icon={<ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
                >
                  Actualiser
                </Button>
              </Tooltip>
              <Tooltip content="Créer un nouveau dossier">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                  icon={<PlusCircleIcon className="h-4 w-4" />}
                >
                  Nouveau Dossier
                </Button>
              </Tooltip>
            </div>
          </div>
        </motion.div>

        {/* Statistiques Professionnelles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="professional-card group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Dossiers</p>
                <p className="stat-number text-theme-primary">{stats.total}</p>
                <p className="stat-description">Tous statuts confondus</p>
              </div>
              <div className="stat-icon-wrapper bg-theme-primary/10">
                <FolderIcon className="h-6 w-6 text-theme-primary" />
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
                <p className="stat-number text-orange-600">{stats.enCours}</p>
                <p className="stat-description">Nécessitent une action</p>
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
                <p className="stat-label">Terminés</p>
                <p className="stat-number text-green-600">{stats.termine}</p>
                <p className="stat-description">{stats.pourcentageCompletion}% complétés</p>
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
                <p className="stat-label">Urgents</p>
                <p className="stat-number text-red-600">{stats.enRetard}</p>
                <p className="stat-description">Nécessitent attention</p>
              </div>
              <div className="stat-icon-wrapper bg-red-100 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filtres et recherche */}
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
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="brouillon">Brouillon</option>
                  <option value="en_cours">En cours</option>
                  <option value="a_revoir">À revoir</option>
                  <option value="en_impression">En impression</option>
                  <option value="pret_impression">Prêt impression</option>
                  <option value="en_livraison">En livraison</option>
                  <option value="termine">Terminé</option>
                  <option value="livre">Livré</option>
                </select>
              </div>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les types</option>
                <option value="roland">Roland</option>
                <option value="xerox">Xerox</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
          
          {(searchTerm || filterStatus !== 'all' || filterType !== 'all') && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {filteredDossiers.length} dossier(s) trouvé(s)
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterType('all');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Effacer filtres
              </button>
            </div>
          )}
        </motion.div>

        {/* Dossiers urgents */}
        {categorizedDossiers.urgent.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-error-50 rounded-xl border border-red-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-error-600" />
              <h2 className="text-xl font-bold text-red-900">
                Dossiers Urgents ({categorizedDossiers.urgent.length})
              </h2>
            </div>
            <div className="grid gap-4">
              {categorizedDossiers.urgent.map((dossier, index) => (
                <DossierCard key={dossier.id} dossier={dossier} index={index} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Sections des dossiers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* En cours */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
          >
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <ClockIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">En Préparation</h2>
                <span className="bg-blue-100 text-blue-700 text-sm font-medium px-2 py-1 rounded-full">
                  {categorizedDossiers.enCours.length}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
                Dossiers nécessitant votre attention
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {categorizedDossiers.enCours.length === 0 ? (
                <EmptyState
                  icon={ClockIcon}
                  title="Aucun dossier en cours"
                  description="Les nouveaux dossiers apparaîtront ici"
                />
              ) : (
                categorizedDossiers.enCours.map((dossier, index) => (
                  <DossierCard key={dossier.id} dossier={dossier} index={index} />
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
                Dossiers en cours d'impression
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {categorizedDossiers.enImpression.length === 0 ? (
                <EmptyState
                  icon={PrinterIcon}
                  title="Aucun dossier en impression"
                  description="Les dossiers prêts à imprimer apparaîtront ici"
                />
              ) : (
                categorizedDossiers.enImpression.map((dossier, index) => (
                  <DossierCard key={dossier.id} dossier={dossier} index={index} />
                ))
              )}
            </div>
          </motion.div>

          {/* En livraison */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
          >
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <TruckIcon className="h-6 w-6 text-success-600" />
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Livraison</h2>
                <span className="bg-success-100 text-success-700 text-sm font-medium px-2 py-1 rounded-full">
                  {categorizedDossiers.enLivraison.length}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">
                Dossiers prêts ou en livraison
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {categorizedDossiers.enLivraison.length === 0 ? (
                <EmptyState
                  icon={TruckIcon}
                  title="Aucun dossier en livraison"
                  description="Les dossiers terminés apparaîtront ici"
                />
              ) : (
                categorizedDossiers.enLivraison.map((dossier, index) => (
                  <DossierCard key={dossier.id} dossier={dossier} index={index} />
                ))
              )}
            </div>
          </motion.div>
        </div>

      </div>

      {/* Modal création dossier */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl dark:shadow-secondary-900/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Nouveau Dossier</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-neutral-600 dark:text-neutral-300 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <CreateDossier
                  isOpen={showCreateModal}
                  onClose={() => setShowCreateModal(false)}
                  onSuccess={() => {
                    setShowCreateModal(false);
                    fetchDossiers();
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

export default PreparateurDashboard;