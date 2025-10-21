import React, { useEffect, useState, useCallback } from 'react';
import {
  PrinterIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderIcon,
  UserIcon,
  CalendarIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import notificationService from '../services/notificationService';

const ImprimeurDashboardUltraModern = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMachine, setFilterMachine] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [refreshing, setRefreshing] = useState(false);

  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase().trim();
    if (val === 'prêt pour impression' || val === 'pret_impression' || val === 'prêt impression') return 'pret_impression';
    if (val === 'en impression' || val === 'en_impression') return 'en_impression';
    if (val === 'terminé' || val === 'termine' || val === 'fini' || val === 'imprimé' || val === 'imprime') return 'termine';
    return val;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pret_impression: 'Prêt à imprimer',
      en_impression: 'En impression',
      termine: 'Terminé',
    };
    return labels[status] || status;
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
      
      const imprimeurDossiers = allDossiers.filter(d => {
        const status = normalizeStatus(d.statut || d.status);
        return ['pret_impression', 'en_impression', 'termine'].includes(status);
      });

      const enrichedDossiers = imprimeurDossiers.map(d => ({
        ...d,
        status: normalizeStatus(d.statut || d.status),
        displayType: (d.type_formulaire || d.machine || '').toLowerCase(),
        files_count: d.files_count || 0,
      }));

      setDossiers(enrichedDossiers);
      notificationService.success(\`\${enrichedDossiers.length} dossier(s) chargé(s)\`);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
      notificationService.error('Erreur lors du chargement des dossiers');
      setDossiers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDossiers();
  };

  const stats = {
    total: dossiers.length,
    fileAttente: dossiers.filter(d => d.status === 'pret_impression').length,
    enImpression: dossiers.filter(d => d.status === 'en_impression').length,
    termines: dossiers.filter(d => d.status === 'termine').length,
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
      if (filterMachine === 'all') return true;
      return d.displayType === filterMachine;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'numero') return (a.numero_commande || '').localeCompare(b.numero_commande || '');
      return 0;
    });

  const dossiersFileAttente = filteredDossiers.filter(d => d.status === 'pret_impression');
  const dossiersEnImpression = filteredDossiers.filter(d => d.status === 'en_impression');

  const handleViewDetails = (dossier) => {
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

  const getStatusColor = (status) => {
    const colors = {
      pret_impression: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-700',
        light: 'bg-blue-100 dark:bg-blue-800',
      },
      en_impression: {
        bg: 'bg-purple-50 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-200 dark:border-purple-700',
        light: 'bg-purple-100 dark:bg-purple-800',
      },
      termine: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-700',
        light: 'bg-emerald-100 dark:bg-emerald-800',
      },
    };
    return colors[status] || colors.pret_impression;
  };

  const StatCard = ({ title, value, icon: Icon, gradient, iconBg }) => (
    <div className="relative bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden group hover:shadow-2xl hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300 h-full">
      <div className={\`absolute inset-0 \${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300\`}></div>
      
      <div className="relative flex items-center justify-between h-full">
        <div className="flex-1 min-w-0 pr-2 sm:pr-3">
          <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
            <span className="w-6 sm:w-8 h-0.5 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex-shrink-0"></span>
            <span className="truncate">{title}</span>
          </p>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent from-purple-600 via-violet-600 to-indigo-600 dark:from-purple-400 dark:via-violet-400 dark:to-indigo-400 leading-tight">
            {value}
          </p>
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 mt-1.5 sm:mt-2 truncate">
            {title === 'Total' && 'dossiers'}
            {title === "File d'Attente" && 'à imprimer'}
            {title === 'En Impression' && 'en cours'}
            {title === 'Terminés' && 'imprimés'}
          </p>
        </div>
        <div className={\`p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl \${iconBg} shadow-xl group-hover:scale-110 transition-transform duration-300 flex-shrink-0\`}>
          <Icon className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-white" />
        </div>
      </div>
      
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      </div>
    </div>
  );

  const DossierCard = ({ dossier }) => {
    const statusColors = getStatusColor(dossier.status);
    const normalizedType = dossier.displayType;
    const typeConfig = {
      roland: {
        bg: 'bg-gradient-to-br from-rose-500 via-pink-500 to-red-500',
        text: 'text-white',
        icon: '🖨️',
        label: 'Roland',
        shadow: 'shadow-rose-500/30',
        ring: 'ring-2 ring-rose-500/20',
      },
      xerox: {
        bg: 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500',
        text: 'text-white',
        icon: '📄',
        label: 'Xerox',
        shadow: 'shadow-emerald-500/30',
        ring: 'ring-2 ring-emerald-500/20',
      },
    };

    const machineConfig = typeConfig[normalizedType];

    return (
      <div className="group relative bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400/50 dark:hover:border-purple-500/50 flex flex-col h-full">
        <div className={\`h-1.5 sm:h-2 \${statusColors.light} bg-gradient-to-r shadow-inner\`}></div>

        <div className="p-4 sm:p-5 lg:p-6 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <div className="w-1 sm:w-1.5 h-5 sm:h-6 bg-gradient-to-b from-purple-500 to-violet-600 rounded-full flex-shrink-0"></div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {dossier.numero_commande || 'Sans N°'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3.5">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-purple-50 dark:bg-purple-900/30 flex-shrink-0">
                  <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
                  {dossier.client_nom || 'Client non spécifié'}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0">
              <span className={\`inline-flex items-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border-2 \${statusColors.bg} \${statusColors.text} \${statusColors.border} shadow-md backdrop-blur-sm\`}>
                {getStatusLabel(dossier.status)}
              </span>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-1">
            {machineConfig && (
              <div className="flex items-center">
                <div className={\`inline-flex items-center gap-1.5 sm:gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold \${machineConfig.bg} \${machineConfig.text} shadow-lg \${machineConfig.shadow} \${machineConfig.ring}\`}>
                  <span className="text-base sm:text-lg">{machineConfig.icon}</span>
                  <span className="tracking-wide">{machineConfig.label}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800">
              <div className="p-0.5 sm:p-1 rounded bg-indigo-100 dark:bg-indigo-800 flex-shrink-0">
                <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                {formatDate(dossier.created_at)}
              </span>
            </div>

            {dossier.files_count > 0 && (
              <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-100 dark:border-emerald-800">
                <div className="p-0.5 sm:p-1 rounded bg-emerald-100 dark:bg-emerald-800 flex-shrink-0">
                  <DocumentIcon className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                  {dossier.files_count} fichier{dossier.files_count > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto">
            <button
              onClick={() => handleViewDetails(dossier)}
              className="group/btn w-full relative flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:px-5 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600 hover:from-purple-700 hover:via-violet-700 hover:to-purple-700 text-white transition-all duration-300 shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/60 hover:-translate-y-0.5 sm:hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] min-h-[44px] sm:min-h-0"
            >
              <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
              <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5 relative z-10 flex-shrink-0" />
              <span className="relative z-10 truncate">Voir détails</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-violet-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 sm:w-20 h-16 sm:h-20 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold text-base sm:text-lg">Chargement des dossiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-violet-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 lg:space-y-6">
        
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 lg:p-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-violet-600/5 to-indigo-600/5 dark:from-purple-400/5 dark:via-violet-400/5 dark:to-indigo-400/5"></div>
          
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 dark:from-purple-400 dark:via-violet-400 dark:to-indigo-400 bg-clip-text text-transparent mb-1.5 sm:mb-2">
                🖨️ Dashboard Imprimeur
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base lg:text-lg">
                Bonjour <span className="font-bold text-purple-600 dark:text-purple-400">{user.prenom || user.nom}</span> ! 
                • <span className="font-medium hidden xs:inline">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="font-medium xs:hidden">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg hover:-translate-y-0.5 min-h-[44px] sm:min-h-0"
              >
                <ArrowPathIcon className={\`h-4 w-4 sm:h-5 sm:w-5 \${refreshing ? 'animate-spin' : ''}\`} />
                <span className="hidden xs:inline">Actualiser</span>
                <span className="xs:hidden">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          <StatCard
            title="Total"
            value={stats.total}
            icon={FolderIcon}
            gradient="bg-gradient-to-br from-purple-500 to-violet-600"
            iconBg="bg-gradient-to-br from-purple-600 to-violet-700"
          />
          <StatCard
            title="File d'Attente"
            value={stats.fileAttente}
            icon={ClockIcon}
            gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            iconBg="bg-gradient-to-br from-blue-600 to-cyan-700"
          />
          <StatCard
            title="En Impression"
            value={stats.enImpression}
            icon={PrinterIcon}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            iconBg="bg-gradient-to-br from-violet-600 to-purple-700"
          />
          <StatCard
            title="Terminés"
            value={stats.termines}
            icon={CheckCircleIcon}
            gradient="bg-gradient-to-br from-emerald-500 to-green-600"
            iconBg="bg-gradient-to-br from-emerald-600 to-green-700"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium min-h-[44px] sm:min-h-0"
              />
            </div>

            <select
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium min-h-[44px] sm:min-h-0"
            >
              <option value="all">Toutes les machines</option>
              <option value="roland">Roland</option>
              <option value="xerox">Xerox</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium min-h-[44px] sm:min-h-0"
            >
              <option value="date_desc">Plus récents</option>
              <option value="date_asc">Plus anciens</option>
              <option value="numero">Par numéro</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-blue-200 dark:border-blue-900/50 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg flex-shrink-0">
                <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  📋 Prêt à Imprimer
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium truncate">Dossiers en file d'attente</p>
              </div>
            </div>
            <span className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs sm:text-sm font-bold shadow-lg flex-shrink-0">
              {dossiersFileAttente.length}
            </span>
          </div>

          {dossiersFileAttente.length === 0 ? (
            <div className="text-center py-8 sm:py-12 px-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-xl sm:rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800">
              <ClockIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-blue-300 dark:text-blue-700 mb-3 sm:mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-base sm:text-lg">
                Aucun dossier en attente
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
                Tous les dossiers sont imprimés !
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {dossiersFileAttente.map((dossier) => (
                <DossierCard key={dossier.id} dossier={dossier} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-purple-200 dark:border-purple-900/50 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg flex-shrink-0">
                <PrinterIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  ⚡ En Impression
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium truncate">Impression en cours</p>
              </div>
            </div>
            <span className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs sm:text-sm font-bold shadow-lg flex-shrink-0">
              {dossiersEnImpression.length}
            </span>
          </div>

          {dossiersEnImpression.length === 0 ? (
            <div className="text-center py-8 sm:py-12 px-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 rounded-xl sm:rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800">
              <PrinterIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-purple-300 dark:text-purple-700 mb-3 sm:mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-base sm:text-lg">
                Aucune impression en cours
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
                Commencez une nouvelle impression
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
              {dossiersEnImpression.map((dossier) => (
                <DossierCard key={dossier.id} dossier={dossier} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showDetailsModal && selectedDossier && (
        <DossierDetails
          dossier={selectedDossier}
          isOpen={showDetailsModal}
          onClose={handleCloseDetails}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default ImprimeurDashboardUltraModern;
