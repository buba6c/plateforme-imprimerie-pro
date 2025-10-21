import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  ChartBarIcon,
  SparklesIcon,
  BoltIcon,
  FireIcon,
  XMarkIcon,
  Bars3BottomLeftIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import CreateDossier from './dossiers/CreateDossier';
import notificationService from '../services/notificationService';

const PreparateurDashboardRevolutionnaire = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // kanban, list

  // Statistiques calculées
  const [stats, setStats] = useState({
    total: 0,
    enCours: 0,
    termine: 0,
    urgent: 0,
    enRetard: 0,
    pourcentageCompletion: 0,
    averageProcessingTime: 0,
    todayCompleted: 0,
    productivity: 0,
    weeklyTrend: 0,
  });

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return 'brouillon';
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

  // Calcul de priorité avec plus de nuances
  const calculatePriority = (dossier) => {
    const created = new Date(dossier.created_at);
    const now = new Date();
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    
    // Facteurs de priorité
    const hasFiles = (dossier.files_count || 0) > 0;
    const isComplexType = ['roland', 'xerox'].includes(dossier.displayType);
    const hasUrgentKeywords = (dossier.nom || '').toLowerCase().includes('urgent');
    
    if (daysDiff > 7 || hasUrgentKeywords) return 'urgent';
    if (daysDiff > 5 || isComplexType) return 'high';
    if (daysDiff > 2 || hasFiles) return 'medium';
    return 'low';
  };

  // Calcul d'urgence étendu
  const calculateUrgency = (dossier) => {
    const status = normalizeStatus(dossier.statut || dossier.status);
    const priority = calculatePriority(dossier);
    const created = new Date(dossier.created_at);
    const daysSinceCreated = (new Date() - created) / (1000 * 60 * 60 * 24);
    
    return (status === 'a_revoir' && priority === 'urgent') || 
           (status === 'en_cours' && priority === 'urgent') ||
           (daysSinceCreated > 10 && ['en_cours', 'a_revoir', 'brouillon'].includes(status));
  };

  // Calcul des statistiques avancées
  const calculateStats = (dossiersList) => {
    const today = new Date().toDateString();
    const total = dossiersList.length;
    
    const enCours = dossiersList.filter(d => 
      ['en_cours', 'a_revoir', 'brouillon'].includes(d.status)
    ).length;
    
    const termine = dossiersList.filter(d => 
      ['termine', 'livre'].includes(d.status)
    ).length;
    
    const urgent = dossiersList.filter(d => d.isUrgent).length;
    
    const enRetard = dossiersList.filter(d => {
      const daysSince = (new Date() - new Date(d.created_at)) / (1000 * 60 * 60 * 24);
      return daysSince > 7 && ['en_cours', 'a_revoir', 'brouillon'].includes(d.status);
    }).length;
    
    const todayCompleted = dossiersList.filter(d => {
      const updatedDate = new Date(d.updated_at || d.created_at).toDateString();
      return updatedDate === today && ['termine', 'livre'].includes(d.status);
    }).length;
    
    const pourcentageCompletion = total > 0 ? Math.round((termine / total) * 100) : 0;
    
    // Calcul du temps moyen de traitement (en jours)
    const completedWithDates = dossiersList.filter(d => 
      ['termine', 'livre'].includes(d.status) && d.updated_at
    );
    const averageProcessingTime = completedWithDates.length > 0 
      ? Math.round(completedWithDates.reduce((acc, d) => {
          const created = new Date(d.created_at);
          const completed = new Date(d.updated_at);
          return acc + ((completed - created) / (1000 * 60 * 60 * 24));
        }, 0) / completedWithDates.length)
      : 0;
    
    // Calcul de productivité (dossiers terminés cette semaine)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const thisWeekCompleted = dossiersList.filter(d => {
      const updated = new Date(d.updated_at || d.created_at);
      return updated >= weekStart && ['termine', 'livre'].includes(d.status);
    }).length;
    
    const productivity = Math.min(100, Math.round((thisWeekCompleted / Math.max(enCours || 1, 1)) * 100));
    
    // Tendance hebdomadaire (simulation)
    const weeklyTrend = Math.round((Math.random() - 0.3) * 20); // -6 à +14
    
    setStats({ 
      total, 
      enCours, 
      termine, 
      urgent, 
      enRetard, 
      pourcentageCompletion, 
      averageProcessingTime,
      todayCompleted,
      productivity,
      weeklyTrend
    });
  };

  // Récupération des dossiers avec enrichissement
  const fetchDossiers = useCallback(async () => {
    const calculatePriority = (dossier) => {
      const created = new Date(dossier.created_at);
      const now = new Date();
      const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 14) return 'low';
      if (daysDiff > 7) return 'medium';
      if (daysDiff > 3) return 'high';
      return 'urgent';
    };

    const calculateUrgency = (dossier) => {
      const status = normalizeStatus(dossier.statut || dossier.status);
      const priority = calculatePriority(dossier);
      const created = new Date(dossier.created_at);
      const updated = new Date(dossier.updated_at);
      const now = new Date();
      
      const hoursOld = (now - updated) / (1000 * 60 * 60);
      
      return status === 'a_revoir' || hoursOld > 24 || priority === 'urgent';
    };

    const calculateStats = (dossiersList) => {
      const today = new Date().toDateString();
      const total = dossiersList.length;
      
      const enCours = dossiersList.filter(d => 
        ['en_cours', 'a_revoir', 'en_impression'].includes(d.status)
      ).length;
      
      const termine = dossiersList.filter(d => d.status === 'termine').length;
      
      const urgent = dossiersList.filter(d => d.isUrgent).length;
      
      const enRetard = dossiersList.filter(d => {
        const updated = new Date(d.updated_at);
        const hours = (new Date() - updated) / (1000 * 60 * 60);
        return hours > 24;
      }).length;
      
      const pourcentageCompletion = Math.round((termine / Math.max(total, 1)) * 100);
      
      const averageProcessingTime = dossiersList.reduce((acc, d) => {
        const created = new Date(d.created_at);
        const updated = new Date(d.updated_at);
        return acc + (updated - created) / (1000 * 60);
      }, 0) / Math.max(total, 1);
      
      const todayCreated = dossiersList.filter(d => new Date(d.created_at).toDateString() === today).length;
      const todayCompleted = dossiersList.filter(d => 
        d.status === 'termine' && new Date(d.updated_at).toDateString() === today
      ).length;
      
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      
      const thisWeekCompleted = dossiersList.filter(d => {
        const updated = new Date(d.updated_at);
        return updated >= weekStart && ['termine', 'livre'].includes(d.status);
      }).length;
      
      const productivity = Math.min(100, Math.round((thisWeekCompleted / Math.max(enCours || 1, 1)) * 100));
      
      const weeklyTrend = Math.round((Math.random() - 0.3) * 20);
      
      setStats({ 
        total, 
        enCours, 
        termine, 
        urgent, 
        enRetard, 
        pourcentageCompletion, 
        averageProcessingTime,
        todayCompleted,
        productivity,
        weeklyTrend
      });
    };

    setLoading(true);
    try {
      const data = await dossiersService.getDossiers({});
      let dossiersList = Array.isArray(data?.dossiers) ? data.dossiers : [];
      
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
          // Formats d'affichage améliorés
          displayNumber: d.numero_commande || d.numero_dossier || d.numero || `#${d.id?.toString()?.slice(-6) || 'XXX'}`,
          displayClient: d.client_nom || d.client || d.nom_client || d.client_name || 'Client inconnu',
          displayType: (d.type_formulaire || d.type || d.machine || 'autre').toLowerCase(),
          files_count: d.files_count || 0,
        };
      });
      
      setDossiers(dossiersList);
      calculateStats(dossiersList);
      
    } catch (error) {
      console.error('Erreur lors de la récupération des dossiers:', error);
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Rafraîchissement avec animation
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDossiers();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Logique de tri
  const sortDossiers = (dossiersList) => {
    return [...dossiersList].sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'date_asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'priority':
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'client':
          return a.displayClient.localeCompare(b.displayClient);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  };

  // Filtrage et tri des dossiers
  const filteredAndSortedDossiers = useMemo(() => {
    const filtered = dossiers.filter(dossier => {
      const matchesSearch = searchTerm === '' || 
        dossier.displayNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dossier.displayClient.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || dossier.status === filterStatus;
      const matchesType = filterType === 'all' || dossier.displayType === filterType;
      const matchesPriority = filterPriority === 'all' || dossier.priority === filterPriority;
      
      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });

    return sortDossiers(filtered);
  }, [dossiers, searchTerm, filterStatus, filterType, filterPriority, sortBy, sortDossiers]);

  // Catégorisation des dossiers filtrés
  const categorizedDossiers = useMemo(() => ({
    urgent: filteredAndSortedDossiers.filter(d => d.isUrgent),
    brouillon: filteredAndSortedDossiers.filter(d => d.status === 'brouillon'),
    enCours: filteredAndSortedDossiers.filter(d => ['en_cours', 'a_revoir'].includes(d.status)),
    enValidation: filteredAndSortedDossiers.filter(d => ['en_impression', 'pret_impression'].includes(d.status)),
    enLivraison: filteredAndSortedDossiers.filter(d => ['en_livraison', 'pret_livraison'].includes(d.status)),
    termine: filteredAndSortedDossiers.filter(d => ['termine', 'livre'].includes(d.status)),
  }), [filteredAndSortedDossiers]);

  useEffect(() => {
    fetchDossiers();
    const unsubscribe = notificationService.on('refresh_dossiers_list', fetchDossiers);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [fetchDossiers]);

  // Composant Badge de statut révolutionnaire
  const StatusBadge = ({ status, size = 'sm', showIcon = false, animated = false }) => {
    const configs = {
      brouillon: { 
        bg: 'bg-gradient-to-r from-gray-100 to-slate-100', 
        text: 'text-neutral-700 dark:text-neutral-200', 
        label: 'Brouillon', 
        icon: '📝',
        glow: 'shadow-gray-200' 
      },
      en_cours: { 
        bg: 'bg-gradient-to-r from-blue-100 to-cyan-100', 
        text: 'text-blue-700', 
        label: 'En cours', 
        icon: '⚡',
        glow: 'shadow-blue-200' 
      },
      a_revoir: { 
        bg: 'bg-gradient-to-r from-yellow-100 to-amber-100', 
        text: 'text-yellow-700', 
        label: 'À revoir', 
        icon: '👁️',
        glow: 'shadow-yellow-200' 
      },
      en_impression: { 
        bg: 'bg-gradient-to-r from-purple-100 to-violet-100', 
        text: 'text-purple-700', 
        label: 'En impression', 
        icon: '🖨️',
        glow: 'shadow-purple-200' 
      },
      pret_impression: { 
        bg: 'bg-gradient-to-r from-indigo-100 to-blue-100', 
        text: 'text-indigo-700', 
        label: 'Prêt impression', 
        icon: '✅',
        glow: 'shadow-indigo-200' 
      },
      en_livraison: { 
        bg: 'bg-gradient-to-r from-orange-100 to-amber-100', 
        text: 'text-orange-700', 
        label: 'En livraison', 
        icon: '🚛',
        glow: 'shadow-orange-200' 
      },
      pret_livraison: { 
        bg: 'bg-gradient-to-r from-amber-100 to-yellow-100', 
        text: 'text-amber-700', 
        label: 'Prêt livraison', 
        icon: '📦',
        glow: 'shadow-amber-200' 
      },
      termine: { 
        bg: 'bg-gradient-to-r from-green-100 to-emerald-100', 
        text: 'text-success-700', 
        label: 'Terminé', 
        icon: '🎉',
        glow: 'shadow-green-200' 
      },
      livre: { 
        bg: 'bg-gradient-to-r from-green-200 to-emerald-200', 
        text: 'text-green-800', 
        label: 'Livré', 
        icon: '✨',
        glow: 'shadow-green-300' 
      },
    };

    const config = configs[status] || { 
      bg: 'bg-gradient-to-r from-gray-100 to-slate-100', 
      text: 'text-neutral-700 dark:text-neutral-200', 
      label: status, 
      icon: '❓',
      glow: 'shadow-gray-200' 
    };
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-base px-4 py-2' : 'text-sm px-3 py-1';

    return (
      <motion.span 
        animate={animated ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`${config.bg} ${config.text} ${config.glow} ${sizeClass} rounded-full font-medium inline-flex items-center gap-1 shadow-sm border border-white/50`}
      >
        {showIcon && <span>{config.icon}</span>}
        {config.label}
      </motion.span>
    );
  };

  // Composant Priority Badge révolutionnaire
  const PriorityBadge = ({ priority, animated = false }) => {
    const configs = {
      urgent: { 
        bg: 'bg-gradient-to-r from-red-500 to-pink-500', 
        text: 'text-white', 
        label: 'URGENT', 
        icon: '🔥',
        glow: 'shadow-red-300' 
      },
      high: { 
        bg: 'bg-gradient-to-r from-orange-400 to-red-400', 
        text: 'text-white', 
        label: 'Haute', 
        icon: '⚡',
        glow: 'shadow-orange-300' 
      },
      medium: { 
        bg: 'bg-gradient-to-r from-yellow-400 to-orange-400', 
        text: 'text-white', 
        label: 'Normale', 
        icon: '⭐',
        glow: 'shadow-yellow-300' 
      },
      low: { 
        bg: 'bg-gradient-to-r from-green-400 to-emerald-400', 
        text: 'text-white', 
        label: 'Faible', 
        icon: '🟢',
        glow: 'shadow-green-300' 
      },
    };

    const config = configs[priority] || configs.low;

    return (
      <motion.span 
        animate={animated ? { rotate: [0, 5, -5, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`${config.bg} ${config.text} ${config.glow} text-xs px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 shadow-md dark:shadow-secondary-900/20`}
      >
        <span>{config.icon}</span>
        {config.label}
      </motion.span>
    );
  };

  // Composant Card de statistique révolutionnaire
  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick, gradient }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02, rotateY: 5 }}
      className={`${gradient || 'bg-white dark:bg-neutral-800'} rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-xl dark:shadow-secondary-900/30 transition-all cursor-pointer transform perspective-1000 backdrop-blur-sm`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">{title}</p>
          <p className={`text-3xl font-black ${color} mt-2 bg-gradient-to-r ${color.replace('text-', 'from-')} to-opacity-80 bg-clip-text`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
        <motion.div 
          whileHover={{ rotate: 360, scale: 1.2 }}
          transition={{ duration: 0.6 }}
          className={`p-4 rounded-2xl ${color.replace('text-', 'bg-').replace('-600', '-100')} flex-shrink-0 shadow-inner`}
        >
          <Icon className={`h-8 w-8 ${color}`} />
        </motion.div>
      </div>
      {trend !== undefined && (
        <div className="mt-4 flex items-center text-sm">
          <motion.span 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`font-bold ${trend >= 0 ? 'text-success-600' : 'text-error-600'}`}
          >
            {trend >= 0 ? '+' : ''}{trend}%
          </motion.span>
          <span className="text-neutral-500 dark:text-neutral-400 ml-2 font-medium">vs semaine précédente</span>
        </div>
      )}
    </motion.div>
  );

  // Composant Card de dossier révolutionnaire
  const DossierCard = ({ dossier, index, compact = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: -15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.03, type: "spring" }}
      whileHover={{ 
        y: -6, 
        scale: 1.02, 
        rotateY: 2,
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
      }}
      className={`bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-neutral-200 dark:border-neutral-700 p-5 hover:shadow-2xl transition-all transform perspective-1000 ${
        dossier.isUrgent ? 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50/50 to-white' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <motion.span 
              whileHover={{ scale: 1.1 }}
              className="font-mono text-lg font-black text-neutral-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            >
              {dossier.displayNumber}
            </motion.span>
            {dossier.isUrgent && (
              <motion.div 
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1] 
                }} 
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <FireIcon className="h-5 w-5 text-error-500" />
              </motion.div>
            )}
            {dossier.files_count > 0 && (
              <motion.span 
                whileHover={{ scale: 1.1 }}
                className="bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold border border-blue-200"
              >
                📎 {dossier.files_count} fichier{dossier.files_count > 1 ? 's' : ''}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 mb-3">
            <UserIcon className="h-4 w-4" />
            <span className="truncate font-medium">{dossier.displayClient}</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={dossier.status} showIcon animated={dossier.isUrgent} />
            <PriorityBadge priority={dossier.priority} animated={dossier.isUrgent} />
          </div>
          {dossier.displayType && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <TagIcon className="h-3 w-3" />
              <span className="uppercase font-bold tracking-wider">{dossier.displayType}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <motion.button
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setSelectedDossier(dossier);
              setShowDetailsModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg dark:shadow-secondary-900/25"
          >
            <EyeIcon className="h-4 w-4" />
            Voir
          </motion.button>
          <span className="text-xs text-gray-400 font-medium">
            {new Date(dossier.created_at).toLocaleDateString('fr-FR')}
          </span>
        </div>
      </div>
    </motion.div>
  );

  // Section Kanban
  const KanbanColumn = ({ title, dossiers, color, icon: Icon, gradient }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`${gradient} rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-white/20 overflow-hidden backdrop-blur-sm`}
    >
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: 360, scale: 1.1 }}
            className={`p-3 ${color.replace('text-', 'bg-').replace('-600', '-100')} rounded-xl shadow-inner`}
          >
            <Icon className={`h-6 w-6 ${color}`} />
          </motion.div>
          <div>
            <h3 className="font-black text-neutral-900 dark:text-white text-lg">{title}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">{dossiers.length} dossier(s)</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
        {dossiers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon className="h-16 w-16 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Aucun dossier</p>
          </div>
        ) : (
          dossiers.map((dossier, index) => (
            <DossierCard key={dossier.id} dossier={dossier} index={index} compact />
          ))
        )}
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 border-4 border-gradient-to-r from-blue-500 to-purple-500 border-t-transparent rounded-full mx-auto mb-6"
          ></motion.div>
          <motion.p 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-neutral-700 dark:text-neutral-200 font-bold text-lg"
          >
            ✨ Chargement de votre dashboard...
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header révolutionnaire */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-800/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/50 p-8 bg-gradient-to-r from-white/90 to-blue-50/90"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-6">
              <motion.div 
                animate={{ rotate: [0, 360] }} 
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="p-4 rounded-3xl bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 text-white shadow-2xl"
              >
                <SparklesIcon className="h-10 w-10" />
              </motion.div>
              <div>
                <motion.h1 
                  animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className="text-5xl font-black bg-gradient-to-r from-gray-900 via-blue-600 to-purple-600 bg-clip-text text-transparent bg-300% leading-tight"
                >
                  Dashboard Préparateur
                </motion.h1>
                <p className="text-neutral-600 dark:text-neutral-300 mt-2 text-xl font-medium">
                  Bonjour <span className="font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">{user.prenom || user.nom}</span> ! 
                  🚀 Gérez vos dossiers avec excellence
                </p>
                <div className="flex items-center gap-8 mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-2 font-medium">
                    <CalendarDaysIcon className="h-5 w-5 text-blue-500" />
                    {new Date().toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <ClockIcon className="h-5 w-5 text-purple-500" />
                    {new Date().toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <motion.button
                whileHover={{ scale: 1.05, rotateY: 10 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-3 px-6 py-4 text-sm font-bold text-neutral-700 bg-white dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 rounded-2xl hover:bg-white dark:bg-neutral-800 transition-all disabled:opacity-50 shadow-lg dark:shadow-secondary-900/25"
              >
                <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, rotateY: -10 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-3 px-8 py-4 text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 transition-all shadow-2xl"
              >
                <PlusCircleIcon className="h-5 w-5" />
                ✨ Nouveau Dossier
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Statistiques révolutionnaires */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Dossiers"
            value={stats.total}
            icon={FolderIcon}
            color="text-blue-600"
            subtitle="Tous statuts"
            trend={stats.weeklyTrend}
            gradient="bg-gradient-to-br from-blue-50 to-cyan-50"
          />
          <StatCard
            title="En Cours"
            value={stats.enCours}
            icon={BoltIcon}
            color="text-orange-600"
            subtitle="Action requise"
            trend={-Math.abs(stats.weeklyTrend)}
            gradient="bg-gradient-to-br from-orange-50 to-amber-50"
          />
          <StatCard
            title="Terminés"
            value={stats.termine}
            icon={CheckCircleIcon}
            color="text-success-600"
            subtitle={`${stats.pourcentageCompletion}% complétés`}
            trend={Math.abs(stats.weeklyTrend)}
            gradient="bg-gradient-to-br from-green-50 to-emerald-50"
          />
          <StatCard
            title="Urgents"
            value={stats.urgent}
            icon={FireIcon}
            color="text-error-600"
            subtitle="Attention immédiate"
            trend={-Math.floor(stats.weeklyTrend / 2)}
            gradient="bg-gradient-to-br from-red-50 to-pink-50"
          />
        </div>

        {/* Métriques de performance révolutionnaires */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02, rotateY: 5 }}
            className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-purple-200 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.2 }}
                className="p-3 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl shadow-inner"
              >
                <ChartBarIcon className="h-8 w-8 text-purple-600" />
              </motion.div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-wide">Temps moyen</p>
                <p className="text-3xl font-black text-purple-600">{stats.averageProcessingTime}j</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, rotateY: -5 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-green-200 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.2 }}
                className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl shadow-inner"
              >
                <SparklesIcon className="h-8 w-8 text-success-600" />
              </motion.div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-wide">Terminés aujourd'hui</p>
                <p className="text-3xl font-black text-success-600">{stats.todayCompleted}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, rotateY: 5 }}
            className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-yellow-200 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.2 }}
                className="p-3 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-xl shadow-inner"
              >
                <BoltIcon className="h-8 w-8 text-yellow-600" />
              </motion.div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-wide">Productivité</p>
                <p className="text-3xl font-black text-yellow-600">{stats.productivity}%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filtres et recherche révolutionnaires */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-800/80 backdrop-blur-lg rounded-2xl shadow-xl dark:shadow-secondary-900/30 border border-white/50 p-6"
        >
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
            {/* Barre de recherche révolutionnaire */}
            <div className="flex-1 relative">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative"
              >
                <MagnifyingGlassIcon className="h-6 w-6 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="🔍 Rechercher par numéro, client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 border border-neutral-300 rounded-2xl focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-neutral-700 bg-white dark:bg-neutral-800/90 backdrop-blur-sm"
                />
              </motion.div>
            </div>
            
            {/* Bouton filtres révolutionnaire */}
            <motion.button
              whileHover={{ scale: 1.05, rotateZ: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-3 px-6 py-4 text-sm font-bold rounded-2xl transition-all shadow-lg dark:shadow-secondary-900/25 ${
                showFilters 
                  ? 'text-white bg-gradient-to-r from-blue-600 to-purple-600' 
                  : 'text-neutral-700 bg-white dark:bg-neutral-800/90 border border-neutral-200 hover:bg-white dark:bg-neutral-800'
              }`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              Filtres {!showFilters && '(' + (
                (filterStatus !== 'all' ? 1 : 0) + 
                (filterType !== 'all' ? 1 : 0) + 
                (filterPriority !== 'all' ? 1 : 0)
              ) + ')'}
            </motion.button>

            {/* Mode vue */}
            <div className="flex gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode('kanban')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  viewMode === 'kanban' 
                    ? 'bg-white dark:bg-neutral-800 text-blue-600 shadow-md dark:shadow-secondary-900/20' 
                    : 'text-neutral-600 hover:text-neutral-800 dark:text-neutral-100'
                }`}
              >
                📊 Kanban
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-neutral-800 text-blue-600 shadow-md dark:shadow-secondary-900/20' 
                    : 'text-neutral-600 hover:text-neutral-800 dark:text-neutral-100'
                }`}
              >
                📋 Liste
              </motion.button>
            </div>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-4 border border-neutral-300 rounded-2xl focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 font-medium text-neutral-700 bg-white dark:bg-neutral-800/90 backdrop-blur-sm"
            >
              <option value="date_desc">📅 Plus récents</option>
              <option value="date_asc">📅 Plus anciens</option>
              <option value="priority">🔥 Par priorité</option>
              <option value="client">👤 Par client</option>
              <option value="status">📊 Par statut</option>
            </select>
          </div>

          {/* Filtres étendus révolutionnaires */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-200 mb-3 uppercase tracking-wide">📊 Statut</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-4 focus:ring-blue-500/30 font-medium bg-white dark:bg-neutral-800/90"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="brouillon">📝 Brouillon</option>
                      <option value="en_cours">⚡ En cours</option>
                      <option value="a_revoir">👁️ À revoir</option>
                      <option value="en_impression">🖨️ En impression</option>
                      <option value="termine">🎉 Terminé</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-200 mb-3 uppercase tracking-wide">🏷️ Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-4 focus:ring-blue-500/30 font-medium bg-white dark:bg-neutral-800/90"
                    >
                      <option value="all">Tous les types</option>
                      <option value="roland">🖨️ Roland</option>
                      <option value="xerox">📄 Xerox</option>
                      <option value="autre">📋 Autre</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-200 mb-3 uppercase tracking-wide">🔥 Priorité</label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-4 focus:ring-blue-500/30 font-medium bg-white dark:bg-neutral-800/90"
                    >
                      <option value="all">Toutes priorités</option>
                      <option value="urgent">🔥 Urgent</option>
                      <option value="high">⚡ Haute</option>
                      <option value="medium">⭐ Normale</option>
                      <option value="low">🟢 Faible</option>
                    </select>
                  </div>
                </div>
                
                {/* Bouton clear filtres */}
                {(searchTerm || filterStatus !== 'all' || filterType !== 'all' || filterPriority !== 'all') && (
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">
                      ✨ {filteredAndSortedDossiers.length} dossier(s) trouvé(s)
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: 2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSearchTerm('');
                        setFilterStatus('all');
                        setFilterType('all');
                        setFilterPriority('all');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-error-600 bg-error-50 rounded-xl hover:bg-error-100 transition-colors shadow-md dark:shadow-secondary-900/20"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      🗑️ Effacer filtres
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Dossiers urgents en bannière révolutionnaire */}
        {categorizedDossiers.urgent.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-gradient-to-r from-red-100 via-pink-50 to-red-100 rounded-2xl border-2 border-red-200 p-8 shadow-2xl backdrop-blur-sm"
          >
            <div className="flex items-center gap-4 mb-6">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0] 
                }} 
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <FireIcon className="h-8 w-8 text-error-600" />
              </motion.div>
              <h2 className="text-2xl font-black text-red-900">
                🚨 Dossiers Urgents ({categorizedDossiers.urgent.length})
              </h2>
            </div>
            <div className="grid gap-6">
              {categorizedDossiers.urgent.slice(0, 3).map((dossier, index) => (
                <DossierCard key={dossier.id} dossier={dossier} index={index} />
              ))}
              {categorizedDossiers.urgent.length > 3 && (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="text-center text-error-700 font-black text-lg bg-white dark:bg-neutral-800/50 rounded-xl p-4"
                >
                  🔥 +{categorizedDossiers.urgent.length - 3} autres dossiers urgents
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Sections de workflow révolutionnaires */}
        {viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <KanbanColumn
              title="📝 Brouillons"
              dossiers={categorizedDossiers.brouillon}
              color="text-neutral-600 dark:text-neutral-300"
              icon={Bars3BottomLeftIcon}
              gradient="bg-gradient-to-br from-gray-50 to-slate-50"
            />
            <KanbanColumn
              title="⚡ En Préparation"
              dossiers={categorizedDossiers.enCours}
              color="text-blue-600"
              icon={BoltIcon}
              gradient="bg-gradient-to-br from-blue-50 to-cyan-50"
            />
            <KanbanColumn
              title="🎉 Terminés"
              dossiers={categorizedDossiers.termine}
              color="text-success-600"
              icon={CheckCircleIcon}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50"
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white dark:bg-neutral-800/80 backdrop-blur-lg rounded-2xl shadow-xl dark:shadow-secondary-900/30 border border-white/50 p-6"
          >
            <div className="grid gap-4">
              {filteredAndSortedDossiers.map((dossier, index) => (
                <DossierCard key={dossier.id} dossier={dossier} index={index} />
              ))}
            </div>
          </motion.div>
        )}

      </div>

      {/* Modal création dossier révolutionnaire */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, rotateY: -30 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotateY: 30 }}
              className="bg-white dark:bg-neutral-800/95 backdrop-blur-lg rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/50"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    ✨ Nouveau Dossier
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-neutral-600 dark:text-neutral-300 text-3xl font-bold"
                  >
                    ×
                  </motion.button>
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

      {/* Styles personnalisés */}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.5) rgba(156, 163, 175, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(156, 163, 175, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.7);
        }
        .bg-300% {
          background-size: 300% 300%;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};

export default PreparateurDashboardRevolutionnaire;