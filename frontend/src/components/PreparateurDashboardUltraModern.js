import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PlusCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  UserIcon,
  ClockIcon,
  DocumentIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import CreateDossier from './dossiers/CreateDossier';
import notificationService from '../services/notificationService';
import { getStatusColor } from '../utils/statusColors';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';
import { SkeletonGrid } from './transitions/SkeletonCard';
import LoadingButton from './transitions/LoadingButton';

const PreparateurDashboardUltraModern = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const normalizeStatus = (statut) => {
    if (!statut) return 'nouveau';
    const val = String(statut).toLowerCase();
    if (val.includes('cours')) return 'en_cours';
    if (val.includes('revoir')) return 'a_revoir';
    if (val.includes('pret') && val.includes('impression')) return 'pret_impression';
    if (val.includes('impression')) return 'en_impression';
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('livraison')) return 'en_livraison';
    if (val.includes('livre')) return 'livre';
    if (val.includes('termine')) return 'termine';
    return val.replace(/\s/g, '_');
  };

  // Mise à jour en temps réel
  useRealtimeUpdates({
    onDossierStatusChanged: (data) => {
      setDossiers(prevDossiers => {
        return prevDossiers.map(d => {
          if (d.id === data.dossierId) {
            return { 
              ...d, 
              statut: data.newStatus, 
              statut_dossier: data.newStatus,
              status: data.newStatus 
            };
          }
          return d;
        });
      });
      notificationService.info(`Dossier mis à jour: ${data.newStatus}`);
    },
    onDossierUpdated: (data) => {
      if (data.dossier) {
        setDossiers(prevDossiers => {
          const exists = prevDossiers.find(d => d.id === data.dossierId);
          if (exists) {
            return prevDossiers.map(d => d.id === data.dossierId ? data.dossier : d);
          } else {
            return [data.dossier, ...prevDossiers];
          }
        });
      }
    },
    onDossierCreated: (data) => {
      if (data.dossier) {
        setDossiers(prevDossiers => [data.dossier, ...prevDossiers]);
        notificationService.success('Nouveau dossier créé');
      }
    },
    onDossierDeleted: (data) => {
      setDossiers(prevDossiers => prevDossiers.filter(d => d.id !== data.dossierId));
      notificationService.info('Dossier supprimé');
    },
  });

  const getStatusLabel = (status) => {
    const normalized = normalizeStatus(status);
    const labels = {
      nouveau: 'Nouveau',
      en_cours: 'En cours',
      a_revoir: 'À revoir',
      pret_impression: 'Prêt impression',
      en_impression: 'En impression',
      pret_livraison: 'Prêt livraison',
      en_livraison: 'En livraison',
      livre: 'Livré',
      termine: 'Terminé',
    };
    return labels[normalized] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Date invalide';
    }
  };

  const loadDossiers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dossiersService.getDossiers();
      const allDossiers = response.dossiers || [];
      
      const mesDossiers = allDossiers.filter(d => 
        d.preparateur_id === user.id || d.created_by === user.id
      );

      const enrichedDossiers = mesDossiers.map(d => ({
        ...d,
        status: normalizeStatus(d.statut || d.status),
        displayType: (d.type_formulaire || d.machine || '').toLowerCase(),
        files_count: d.files_count || 0,
      }));

      setDossiers(enrichedDossiers);
      notificationService.success(`${enrichedDossiers.length} dossier(s) chargé(s)`);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
      notificationService.error('Erreur lors du chargement des dossiers');
      setDossiers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDossiers();
  };

  const stats = {
    total: dossiers.length,
    enCours: dossiers.filter(d => ['nouveau', 'en_cours', 'a_revoir'].includes(d.status)).length,
    termine: dossiers.filter(d => ['termine', 'livre'].includes(d.status)).length,
    urgent: dossiers.filter(d => d.status === 'a_revoir').length,
  };

  const filteredDossiers = dossiers
    .filter(d => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          (d.numero_commande || '').toLowerCase().includes(search) ||
          (d.client_nom || '').toLowerCase().includes(search) ||
          (d.machine || '').toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter(d => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'actif') return ['nouveau', 'en_cours', 'a_revoir'].includes(d.status);
      if (filterStatus === 'termine') return ['termine', 'livre'].includes(d.status);
      return d.status === filterStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'numero') return (a.numero_commande || '').localeCompare(b.numero_commande || '');
      return 0;
    });

  const dossiersEnPreparation = filteredDossiers.filter(d => 
    ['nouveau', 'en_cours', 'a_revoir'].includes(d.status)
  );
  
  const dossiersEnCours = filteredDossiers.filter(d => 
    !['nouveau', 'en_cours', 'a_revoir'].includes(d.status)
  );

  const handleViewDetails = (dossier) => {
    // Log temporaire pour debug
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Détails dossier - ID disponibles:', {
        'dossier.id': dossier.id,
        'dossier.folder_id': dossier.folder_id,
        'dossier.dossier_id': dossier.dossier_id,
        'ID choisi': dossier.id || dossier.folder_id || dossier.dossier_id
      });
    }
    setSelectedDossier(dossier);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedDossier(null);
  };

  const handleStatusChange = () => {
    loadDossiers();
  };

  const handleDelete = async (dossier) => {
    const canDelete = ['nouveau', 'en_cours', 'a_revoir'].includes(dossier.status);
    
    if (!canDelete) {
      notificationService.error('Impossible de supprimer un dossier validé');
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le dossier ${dossier.numero_commande} ?`)) {
      return;
    }

    try {
      await dossiersService.deleteDossier(dossier.id);
      setDossiers(prev => prev.filter(d => d.id !== dossier.id));
      notificationService.success('Dossier supprimé avec succès');
    } catch (error) {
      console.error('Erreur suppression:', error);
      notificationService.error('Erreur lors de la suppression du dossier');
    }
  };

  const StatCard = ({ title, value, icon: Icon, gradient, iconBg }) => (
    <div className="relative bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden group hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 h-full">
      {/* Gradient background subtil */}
      <div className={`absolute inset-0 ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
      
      <div className="relative flex items-center justify-between h-full">
        <div className="flex-1 min-w-0 pr-2 sm:pr-3">
          <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
            <span className="w-6 sm:w-8 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex-shrink-0"></span>
            <span className="truncate">{title}</span>
          </p>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 leading-tight">
            {value}
          </p>
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 mt-1.5 sm:mt-2 truncate">
            {title === 'Total' && 'dossiers'}
            {title === 'En Cours' && 'actifs'}
            {title === 'Terminés' && 'complétés'}
            {title === 'À Revoir' && 'urgents'}
          </p>
        </div>
        <div className={`p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl ${iconBg} shadow-xl group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
          <Icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
        </div>
      </div>
      
      {/* Effet de brillance au survol */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      </div>
    </div>
  );

  const DossierCard = ({ dossier }) => {
    const statusColors = getStatusColor(dossier.status);
    const canDelete = ['nouveau', 'en_cours', 'a_revoir'].includes(dossier.status);

    // Couleur harmonisée selon le type de machine
    const normalizedType = dossier.displayType;
    const typeConfig = {
      roland: {
        bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
        text: 'text-white',
        icon: '🖨️',
        label: 'Roland'
      },
      xerox: {
        bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
        text: 'text-white',
        icon: '📄',
        label: 'Xerox'
      },
      default: {
        bg: 'bg-gradient-to-br from-gray-500 to-gray-600',
        text: 'text-white',
        icon: '📋',
        label: 'Standard'
      }
    };
    
    const machineConfig = typeConfig[normalizedType] || typeConfig.default;

    return (
      <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Bande de statut colorée en haut */}
        <div className={`h-1.5 ${statusColors.bg}`}></div>
        
        <div className="p-4">
          {/* En-tête avec numéro de commande et statut */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {dossier.numero_commande || dossier.numero || `Dossier #${dossier.id}`}
              </h3>
              <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">{dossier.client_nom || 'Client non spécifié'}</span>
              </div>
            </div>
            
            {/* Badge de statut avec couleurs unifiées */}
            <span className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors.light} ${statusColors.text} ${statusColors.border}`}>
              {getStatusLabel(dossier.status)}
            </span>
          </div>

          {/* Informations détaillées */}
          <div className="space-y-2 mb-4">
            {/* Type de machine avec icône */}
            {normalizedType && (normalizedType === 'roland' || normalizedType === 'xerox') && (
              <div className="flex items-center">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${machineConfig.bg} ${machineConfig.text} shadow-sm`}>
                  <span>{machineConfig.icon}</span>
                  <span>{machineConfig.label}</span>
                </span>
              </div>
            )}
            
            {/* Machine */}
            {dossier.machine && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <FolderIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="font-medium capitalize">{dossier.machine}</span>
              </div>
            )}
            
            {/* Date de création */}
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              <span>{formatDate(dossier.created_at)}</span>
            </div>

            {/* Nombre de fichiers */}
            {dossier.files_count > 0 && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <DocumentIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{dossier.files_count} fichier{dossier.files_count > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={`grid ${canDelete ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <button
              onClick={() => handleViewDetails(dossier)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
            >
              <EyeIcon className="h-4 w-4" />
              <span>Détails</span>
            </button>

            {canDelete && (
              <button
                onClick={() => handleDelete(dossier)}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-red-600 hover:bg-red-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Supprimer</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Effet de hover */}
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 dark:group-hover:border-blue-400/20 rounded-xl transition-colors duration-300 pointer-events-none"></div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold text-lg">Chargement de vos dossiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 lg:space-y-6">
        
        <div className="relative bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-gray-200/50 dark:border-gray-700/50 p-6 sm:p-8 lg:p-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-indigo-600/8 to-purple-600/8 dark:from-blue-400/10 dark:via-indigo-400/10 dark:to-purple-400/10"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 dark:from-blue-500/10 dark:to-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-blue-400/20 dark:from-indigo-500/10 dark:to-blue-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-300 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent mb-2 sm:mb-3 drop-shadow-sm">
                📋 Dashboard Préparateur
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base lg:text-lg font-medium">
                Bonjour <span className="font-bold text-blue-600 dark:text-blue-400">{user.prenom || user.nom}</span> ! 
                • <span className="font-medium hidden xs:inline">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="font-medium xs:hidden">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-3.5 text-sm sm:text-base font-bold text-gray-700 dark:text-gray-100 bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm border-2 border-gray-300/50 dark:border-gray-600/50 rounded-2xl hover:bg-white dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-105 min-h-[44px] sm:min-h-0"
              >
                <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline">Actualiser</span>
                <span className="xs:hidden">Refresh</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-3.5 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-105 min-h-[44px] sm:min-h-0"
              >
                <PlusCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                Nouveau Dossier
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          <StatCard
            title="Total"
            value={stats.total}
            icon={FolderIcon}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            iconBg="bg-gradient-to-br from-blue-600 to-indigo-700"
          />
          <StatCard
            title="En Cours"
            value={stats.enCours}
            icon={ClockIcon}
            gradient="bg-gradient-to-br from-orange-500 to-amber-600"
            iconBg="bg-gradient-to-br from-orange-600 to-amber-700"
          />
          <StatCard
            title="Terminés"
            value={stats.termine}
            icon={CheckCircleIcon}
            gradient="bg-gradient-to-br from-emerald-500 to-green-600"
            iconBg="bg-gradient-to-br from-emerald-600 to-green-700"
          />
          <StatCard
            title="À Revoir"
            value={stats.urgent}
            icon={ExclamationTriangleIcon}
            gradient="bg-gradient-to-br from-red-500 to-rose-600"
            iconBg="bg-gradient-to-br from-red-600 to-rose-700"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium min-h-[44px] sm:min-h-0"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium min-h-[44px] sm:min-h-0"
            >
              <option value="all">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="termine">Terminés</option>
              <option value="nouveau">Nouveau</option>
              <option value="en_cours">En cours</option>
              <option value="a_revoir">À revoir</option>
              <option value="pret_impression">Prêt impression</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium min-h-[44px] sm:min-h-0"
            >
              <option value="date_desc">Plus récents</option>
              <option value="date_asc">Plus anciens</option>
              <option value="numero">Par numéro</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-orange-200 dark:border-orange-900/50 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg flex-shrink-0">
                <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  🔧 En Préparation
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium truncate">Dossiers non validés</p>
              </div>
            </div>
            <span className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs sm:text-sm font-bold shadow-lg flex-shrink-0">
              {dossiersEnPreparation.length}
            </span>
          </div>

          {dossiersEnPreparation.length === 0 ? (
            <div className="text-center py-8 sm:py-12 px-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-xl sm:rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-800">
              <ClockIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-orange-300 dark:text-orange-700 mb-3 sm:mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-base sm:text-lg">
                Aucun dossier en préparation
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
                Les nouveaux dossiers apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {dossiersEnPreparation.map((dossier) => (
                <DossierCard key={dossier.id} dossier={dossier} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-blue-200 dark:border-blue-900/50 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  ✅ En Cours
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium truncate">Dossiers validés</p>
              </div>
            </div>
            <span className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-lg flex-shrink-0">
              {dossiersEnCours.length}
            </span>
          </div>

          {dossiersEnCours.length === 0 ? (
            <div className="text-center py-8 sm:py-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl sm:rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800">
              <CheckCircleIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-blue-300 dark:text-blue-700 mb-3 sm:mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-base sm:text-lg">
                Aucun dossier en cours
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
                Les dossiers validés apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {dossiersEnCours.map((dossier) => (
                <DossierCard key={dossier.id} dossier={dossier} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showDetailsModal && selectedDossier && (
        <DossierDetails
          dossier={selectedDossier}
          dossierId={selectedDossier.id || selectedDossier.folder_id || selectedDossier.dossier_id}
          isOpen={showDetailsModal}
          onClose={handleCloseDetails}
          onStatusChange={handleStatusChange}
        />
      )}

      {showCreateModal && (
        <CreateDossier
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadDossiers}
        />
      )}
    </div>
  );
};

export default PreparateurDashboardUltraModern;
