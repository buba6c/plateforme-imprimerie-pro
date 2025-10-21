import React, { useEffect, useState, useCallback } from 'react';
import {
  PrinterIcon,
  QueueListIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  DocumentTextIcon,
  UserIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import notificationService from '../services/notificationService';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';
import PropTypes from 'prop-types';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

const ImprimeurDashboardUltraModern = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase().trim().replace(/\s+/g, '_');
    if (val.includes('pret') && val.includes('impression')) return 'pret_impression';
    if (val.includes('en_impression')) return 'en_impression';
    if (val.includes('imprime')) return 'imprime';
    if (val === 'termine' || val === 'terminé' || val === 'fini') return 'imprime'; // Terminé = Imprimé pour les imprimeurs
    return val;
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
        }).filter(d => {
          const status = normalizeStatus(d.statut || d.statut_dossier);
          return ['pret_impression', 'en_impression', 'imprime'].includes(status);
        });
      });
      
      // Notification visuelle
      notificationService.info(`Statut du dossier mis à jour: ${data.newStatus}`);
    },
    onDossierUpdated: (data) => {
      if (data.dossier) {
        setDossiers(prevDossiers => {
          const status = normalizeStatus(data.dossier.statut || data.dossier.statut_dossier);
          const isRelevant = ['pret_impression', 'en_impression', 'imprime'].includes(status);
          
          const exists = prevDossiers.find(d => d.id === data.dossierId);
          if (isRelevant) {
            if (exists) {
              return prevDossiers.map(d => d.id === data.dossierId ? data.dossier : d);
            } else {
              return [...prevDossiers, data.dossier];
            }
          } else {
            return prevDossiers.filter(d => d.id !== data.dossierId);
          }
        });
      }
    },
  });

  // Chargement des dossiers
  const loadDossiers = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);
      const response = await dossiersService.getDossiers();
      
      if (response?.success && Array.isArray(response.dossiers)) {
        const imprimeurDossiers = response.dossiers.filter(d => {
          const status = normalizeStatus(d.statut || d.statut_dossier);
          return ['pret_impression', 'en_impression', 'imprime'].includes(status);
        });
        setDossiers(imprimeurDossiers);
      } else {
        setDossiers([]);
      }
    } catch (error) {
      notificationService.error('Erreur lors du chargement des dossiers');
      setDossiers([]);
    } finally {
      setLoading(false);
      if (showLoader) setRefreshing(false);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    loadDossiers();
    const interval = setInterval(() => loadDossiers(false), 30000);
    return () => clearInterval(interval);
  }, [loadDossiers]);

  // Calcul des statistiques
  const stats = {
    total: dossiers.length,
    fileAttente: dossiers.filter(d => normalizeStatus(d.statut || d.statut_dossier) === 'pret_impression').length,
    enImpression: dossiers.filter(d => normalizeStatus(d.statut || d.statut_dossier) === 'en_impression').length,
    termines: dossiers.filter(d => normalizeStatus(d.statut || d.statut_dossier) === 'imprime').length,
  };

  // Formatage de date
  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return 'Erreur de date';
    }
  };

  // Filtrage et tri
  const getFilteredDossiers = useCallback((statusFilter) => {
    let filtered = dossiers.filter(d => normalizeStatus(d.statut || d.statut_dossier) === statusFilter);

    if (selectedMachine !== 'all') {
      filtered = filtered.filter(d => 
        d.machine_impression?.toLowerCase() === selectedMachine
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.numero?.toString().includes(searchTerm)
      );
    }

    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));
    } else if (sortBy === 'client') {
      filtered.sort((a, b) => (a.nom_client || '').localeCompare(b.nom_client || ''));
    }

    return filtered;
  }, [dossiers, searchTerm, selectedMachine, sortBy]);

  // Actions
  const handleDemarrerImpression = async (dossier) => {
    try {
      setActionLoading(prev => ({ ...prev, [`start-${dossier.id}`]: true }));
      await dossiersService.updateDossierStatus(dossier.id, 'en_impression');
      notificationService.success('Impression démarrée');
      // Pas besoin de loadDossiers(), Socket.IO mettra à jour
    } catch (error) {
      notificationService.error('Erreur lors du démarrage de l\'impression');
    } finally {
      setActionLoading(prev => ({ ...prev, [`start-${dossier.id}`]: false }));
    }
  };

  const handleMarquerImprime = async (dossier) => {
    try {
      setActionLoading(prev => ({ ...prev, [`finish-${dossier.id}`]: true }));
      await dossiersService.updateDossierStatus(dossier.id, 'imprime');
      notificationService.success('Marqué comme imprimé');
      // Pas besoin de loadDossiers(), Socket.IO mettra à jour
    } catch (error) {
      notificationService.error('Erreur lors de la mise à jour');
    } finally {
      setActionLoading(prev => ({ ...prev, [`finish-${dossier.id}`]: false }));
    }
  };

  const handleViewDetails = (dossier) => {
    setSelectedDossier(dossier);
    setShowDetailsModal(true);
  };

  // Composant StatCard responsive
  const StatCard = ({ icon: Icon, label, value, gradient, textColor }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-2xl dark:shadow-2xl dark:shadow-black/40 dark:hover:shadow-black/50 transition-all duration-300 border border-white/10 dark:border-white/5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm text-white/90 dark:text-white/95 font-medium mb-1 sm:mb-2 drop-shadow-sm">{label}</p>
          <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${textColor} drop-shadow-md`}>{value}</p>
        </div>
        <div className="bg-white/20 dark:bg-white/30 p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-lg">
          <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-lg" />
        </div>
      </div>
    </div>
  );

  // Composant DossierCard responsive
  const DossierCard = ({ dossier, actions }) => {
    // Système de couleurs unifié pour le statut
    const statusColors = getStatusColor(dossier.statut);
    
    // Couleur harmonisée selon le type de machine
    const normalizedType = (dossier.machine_impression || dossier.type || '').toString().trim().toLowerCase();
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
                {dossier.nom_client || dossier.numero || `Dossier #${dossier.id}`}
              </h3>
              <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">{dossier.preparateur_name || 'Non assigné'}</span>
              </div>
            </div>
            
            {/* Badge de statut avec couleurs unifiées */}
            <span className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors.light} ${statusColors.text} ${statusColors.border}`}>
              {getStatusLabel(dossier.statut)}
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
              <span>{formatDate(dossier.date_creation || dossier.created_at)}</span>
            </div>

            {/* Nombre de fichiers */}
            {dossier.nombre_fichiers > 0 && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <DocumentTextIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{dossier.nombre_fichiers} fichier{dossier.nombre_fichiers > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleViewDetails(dossier)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
            >
              <EyeIcon className="h-4 w-4" />
              <span>Détails</span>
            </button>
            
            {actions}
          </div>
        </div>
        
        {/* Effet de hover */}
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-500/20 dark:group-hover:border-purple-400/20 rounded-xl transition-colors duration-300 pointer-events-none"></div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-gray-900">
        <div className="text-center">
          <PrinterIcon className="h-12 w-12 sm:h-16 sm:w-16 text-purple-600 dark:text-purple-500 animate-pulse mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-gray-300 text-sm sm:text-base">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-gray-900 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Header moderne avec carte */}
        <div className="relative bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-gray-200/50 dark:border-gray-700/50 p-6 sm:p-8 lg:p-10 overflow-hidden mb-6 sm:mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/8 via-violet-600/8 to-purple-600/8 dark:from-purple-400/10 dark:via-violet-400/10 dark:to-purple-400/10"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-violet-400/20 dark:from-purple-500/10 dark:to-violet-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-violet-400/20 to-purple-400/20 dark:from-violet-500/10 dark:to-purple-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-5">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600 dark:from-purple-300 dark:via-violet-300 dark:to-purple-300 bg-clip-text text-transparent mb-2 sm:mb-3 drop-shadow-sm">
                🖨️ Dashboard Imprimeur
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base lg:text-lg font-medium">
                Bienvenue, <span className="font-bold text-purple-600 dark:text-purple-400">{user?.prenom} {user?.nom}</span>
              </p>
            </div>
            <button
              onClick={() => loadDossiers(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-3.5 text-sm sm:text-base font-bold text-gray-700 dark:text-gray-100 bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm border-2 border-gray-300/50 dark:border-gray-600/50 rounded-2xl hover:bg-white dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            icon={DocumentTextIcon}
            label="Total"
            value={stats.total}
            gradient="from-purple-500 to-violet-600"
            textColor="text-white"
          />
          <StatCard
            icon={QueueListIcon}
            label="File d'attente"
            value={stats.fileAttente}
            gradient="from-blue-500 to-cyan-600"
            textColor="text-white"
          />
          <StatCard
            icon={PrinterIcon}
            label="En impression"
            value={stats.enImpression}
            gradient="from-purple-500 to-violet-600"
            textColor="text-white"
          />
          <StatCard
            icon={CheckCircleIcon}
            label="Terminés"
            value={stats.termines}
            gradient="from-emerald-500 to-green-600"
            textColor="text-white"
          />
        </div>

        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 p-4 sm:p-6 mb-6 sm:mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400 dark:text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un dossier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-neutral-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
              >
                <option value="all">Toutes les machines</option>
                <option value="roland">Roland</option>
                <option value="xerox">Xerox</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              >
                <option value="date">Trier par date</option>
                <option value="client">Trier par client</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 1: Prêt à Imprimer - Masquée si vide */}
        {getFilteredDossiers('pret_impression').length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 overflow-hidden border-t-4 border-blue-500 dark:border-blue-600">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 px-4 sm:px-6 py-4 sm:py-5 border-b border-blue-200 dark:border-blue-700">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 sm:gap-3">
                  <QueueListIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  📋 Prêt à Imprimer
                  <span className="ml-auto text-base sm:text-lg bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100 px-3 py-1 rounded-full">
                    {getFilteredDossiers('pret_impression').length}
                  </span>
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {getFilteredDossiers('pret_impression').map((dossier) => (
                    <DossierCard
                      key={dossier.id}
                      dossier={dossier}
                      actions={
                        <button
                          onClick={() => handleDemarrerImpression(dossier)}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                        >
                          <PrinterIcon className="h-4 w-4" />
                          Démarrer
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: En Impression - Masquée si vide */}
        {getFilteredDossiers('en_impression').length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 overflow-hidden border-t-4 border-purple-500 dark:border-purple-600">
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 px-4 sm:px-6 py-4 sm:py-5 border-b border-purple-200 dark:border-purple-700">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2 sm:gap-3">
                  <PrinterIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  ⚡ En Impression
                  <span className="ml-auto text-base sm:text-lg bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-100 px-3 py-1 rounded-full">
                    {getFilteredDossiers('en_impression').length}
                  </span>
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {getFilteredDossiers('en_impression').map((dossier) => (
                    <DossierCard
                      key={dossier.id}
                      dossier={dossier}
                      actions={
                        <button
                          onClick={() => handleMarquerImprime(dossier)}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Terminé
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal détails */}
      {showDetailsModal && selectedDossier && (
        <DossierDetails
          dossier={selectedDossier}
          dossierId={selectedDossier.id || selectedDossier.folder_id || selectedDossier.dossier_id}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedDossier(null);
          }}
          onUpdate={loadDossiers}
        />
      )}
    </div>
  );
};

ImprimeurDashboardUltraModern.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    prenom: PropTypes.string,
    nom: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,
};

export default ImprimeurDashboardUltraModern;
