import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlusIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FolderIcon,
  UserIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import CreateDossier from './CreateDossier';
import DossierDetails from './DossierDetails';
import { dossiersService } from '../../services/apiAdapter';
import { useAuth } from '../../context/AuthContext';
import { normalizeDossierList } from '../../services/dossierNormalizer';
import PropTypes from 'prop-types';

const DossierManagement = () => {
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // État des filtres
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: '',
    urgence: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statsKPI, setStatsKPI] = useState({ prepa: 0, impr: 0, liv: 0 });
  const itemsPerPage = 12;

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const initializedRef = useRef(false);
  // Verrouillage du type pour les rôles imprimeurs
  const getDefaultMachineType = () => {
    if (user?.role === 'imprimeur_roland') {
      return 'roland';
    }
    if (user?.role === 'imprimeur_xerox') {
      return 'xerox';
    }
    return null;
  };
  const defaultMachineType = getDefaultMachineType();
  // Statuts disponibles selon le rôle (aligné sur le workflow adapter)
  const getAvailableStatuses = () => {
    const allStatuses = [
      { value: 'en_cours', label: 'En cours', color: 'primary' },
      { value: 'pret_impression', label: 'Prêt à imprimer', color: 'blue' },
      { value: 'a_revoir', label: 'À revoir', color: 'warning' },
      { value: 'en_impression', label: 'En impression', color: 'purple' },
      { value: 'termine', label: 'Terminé', color: 'success' },
      { value: 'en_livraison', label: 'En livraison', color: 'yellow' },
      { value: 'livre', label: 'Livré', color: 'success' },
    ];

    // Filtrer selon le rôle (règles d'accès)
    switch (user.role) {
      case 'preparateur':
        // Préparateur se concentre sur la préparation et les révisions
        return allStatuses.filter(s =>
          ['en_cours', 'pret_impression', 'a_revoir'].includes(s.value)
        );
      case 'imprimeur_roland':
      case 'imprimeur_xerox':
        // Imprimeurs se focalisent sur le flux d'impression - maintenant ils voient les dossiers prêts !
        return allStatuses.filter(s =>
          ['pret_impression', 'en_impression', 'termine'].includes(s.value)
        );
      case 'livreur':
        // Livreur gère livraison et livré
        return allStatuses.filter(s => ['termine', 'en_livraison', 'livre'].includes(s.value));
      default: // admin
        return allStatuses;
    }
  };

  const loadDossiers = useCallback(async () => {
    try {
      console.log('🔄 DossierManagement: Début du chargement des dossiers...');
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: filters.search || undefined,
        status: filters.status || undefined,
        type: defaultMachineType || filters.type || undefined,
        urgent: filters.urgence || undefined, // Ajout du filtre urgent
      };
      console.log('🔌 DossierManagement: Paramètres de requête:', params);
      const response = await dossiersService.getDossiers(params);
      console.log('✅ DossierManagement: Réponse API:', response);
      let dossiersList = normalizeDossierList(response.dossiers || []);
      console.log(`📋 DossierManagement: ${dossiersList.length} dossiers normalisés pour rôle ${user?.role}`);

      if (user?.role === 'preparateur') {
        dossiersList = dossiersList.filter(d => String(d.created_by) === String(user.id));
      } else if (user?.role === 'imprimeur_roland') {
        dossiersList = dossiersList.filter(
          d => d.type === 'roland' && ['pret_impression', 'en_impression', 'imprime', 'termine'].includes(d.status)
        );
      } else if (user?.role === 'imprimeur_xerox') {
        dossiersList = dossiersList.filter(
          d => d.type === 'xerox' && ['pret_impression', 'en_impression', 'imprime', 'termine'].includes(d.status)
        );
      } else if (user?.role === 'livreur') {
        dossiersList = dossiersList.filter(d =>
          ['pret_livraison', 'en_livraison', 'livre', 'termine'].includes(d.status)
        );
      }
      setDossiers(dossiersList);
      console.log(`📊 DossierManagement: ${dossiersList.length} dossiers finaux après filtrage rôle`);
      setDossiers(dossiersList);
      setTotalPages(response.pagination?.total_pages || 1);
      setTotalItems(response.pagination?.total_items || 0);
      if (response.pagination) {
        setStatsKPI({
          prepa: response.pagination.prepa_count || 0,
          impr: response.pagination.impr_count || 0,
          liv: response.pagination.liv_count || 0
        });
      }
      console.log('✅ DossierManagement: Chargement terminé avec succès');
    } catch (err) {
      console.error('❌ DossierManagement: Erreur chargement dossiers:', err);
      console.error('❌ DossierManagement: Stack trace:', err.stack);
      console.error('❌ DossierManagement: Response:', err.response);
      setError('Erreur lors du chargement des dossiers');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters.search, filters.status, filters.type, filters.urgence, defaultMachineType, user]);

  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  // Écouter l'événement editDossier pour ouvrir le modal automatiquement
  useEffect(() => {
    const handleEditDossier = (event) => {
      console.log('🎯 DossierManagement: Événement editDossier reçu, ouverture du modal...', event.detail);
      setShowCreateModal(true);
    };

    window.addEventListener('editDossier', handleEditDossier);
    return () => window.removeEventListener('editDossier', handleEditDossier);
  }, []);

  // Initialiser des filtres par défaut selon le rôle + filtres rapides depuis Dashboard
  useEffect(() => {
    if (!user || initializedRef.current) return;

    // Vérifier si le Dashboard a posé des filtres init
    try {
      const preset = localStorage.getItem('dossiersInitFilters');
      if (preset) {
        const parsed = JSON.parse(preset);
        setFilters(prev => ({ ...prev, ...parsed }));
        setCurrentPage(1);
        localStorage.removeItem('dossiersInitFilters');
        initializedRef.current = true;
        return;
      }
    } catch (e) {
      // Ignore potential storage errors
    }

    // Sinon, définir des filtres par défaut selon le rôle
    const defaults = { search: '', status: '', type: '', urgence: '' };
    switch (user.role) {
      case 'preparateur':
        // Pas de statut par défaut pour préparateur: montrer En cours et À revoir selon filtres
        break;
      case 'imprimeur_roland':
        defaults.type = 'roland';
        defaults.status = 'en_cours';
        break;
      case 'imprimeur_xerox':
        defaults.type = 'xerox';
        defaults.status = 'en_cours';
        break;
      case 'livreur':
        // Pour livreur, on n'applique pas de statut par défaut afin d'afficher les 3 sections
        break;
      default:
        break;
    }
    // Appliquer uniquement si l'utilisateur n'a pas déjà filtré
    if (!filters.status && !filters.type && !filters.search && !filters.urgence) {
      setFilters(prev => ({ ...prev, ...defaults }));
      setCurrentPage(1);
    }
    initializedRef.current = true;
  }, [user, filters.search, filters.status, filters.type, filters.urgence]);

  // Synchroniser/forcer le type si rôle imprimeur
  useEffect(() => {
    if (defaultMachineType && filters.type !== defaultMachineType) {
      setFilters(prev => ({ ...prev, type: defaultMachineType }));
    }
  }, [defaultMachineType, filters.type]);

  const handleFilterChange = (key, value) => {
    if (key === 'type' && defaultMachineType) {
      // Ignorer les changements de type pour les rôles imprimeurs
      return;
    }
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset à la première page lors du filtrage
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      type: '',
      urgence: '',
    });
    setCurrentPage(1);
  };

  // Utiliser le système de couleurs unifié
  const { getStatusColor, getStatusLabel } = require('../../utils/statusColors');

  const canCreateDossier = () => {
    return user && ['admin', 'preparateur'].includes(user.role);
  };

  const formatDate = dateString => {
    // Vérifier si la date est valide
    if (!dateString || dateString === '' || dateString === null || dateString === undefined) {
      return 'Date inconnue';
    }

    try {
      const date = new Date(dateString);
      // Vérifier si la date créée est valide
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }

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

  const handleCreateSuccess = () => {
    setSuccess('Dossier créé avec succès');
    setShowCreateModal(false);
    loadDossiers(); // Recharger la liste
  };

  const handleViewDetails = dossier => {
    setSelectedDossier(dossier);
  };

  const handleCloseDetails = () => {
    setSelectedDossier(null);
  };

  const handleStatusChange = (dossierId, oldStatus, newStatus) => {
    // Mettre à jour la liste des dossiers
    setDossiers(
      dossiers.map(dossier =>
        dossier.id === dossierId
          ? { ...dossier, status: newStatus, updated_at: new Date().toISOString() }
          : dossier
      )
    );

    // Optionnel: afficher une notification
    setSuccess(`Dossier passé de "${getStatusLabel(oldStatus)}" à "${getStatusLabel(newStatus)}"`);
  };

  // const theme = getRoleTheme(user.role); // Theme available if needed for future styling

  const DossierCard = ({ dossier, handleViewDetails }) => {
    // Système de couleurs unifié pour le statut
    const statusColors = getStatusColor(dossier.status);
    
    // Logique de suppression CORRIGÉE selon les spécifications :
    // - Admin : peut tout supprimer
    // - Préparateur : peut supprimer UNIQUEMENT si :
    //   1. NON validé (valide_preparateur = false)
    //   2. ET statut != 'a_revoir' (un dossier renvoyé "à revoir" ne peut plus être supprimé)
    const canDelete = user?.role === 'admin' || 
      (user?.role === 'preparateur' && 
       !dossier.valide_preparateur &&
       dossier.status !== 'a_revoir');
    
    // Couleur harmonisée selon le type de machine
    const normalizedType = (dossier.type || '').toString().trim().toLowerCase();
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
    
    const handleDelete = async () => {
      if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le dossier ${dossier.numero_commande} ?`)) return;
      try {
        await dossiersService.deleteDossier(dossier.id);
        setDossiers(prev => prev.filter(d => d.id !== dossier.id));
        setSuccess('Dossier supprimé avec succès');
      } catch (err) {
        setError('Erreur lors de la suppression du dossier');
      }
    };

    return (
      <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Bande de statut colorée en haut */}
        <div className={`h-1.5 ${statusColors.bg}`}></div>
        
        <div className="p-4">
          {/* En-tête avec numéro de commande et statut */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {dossier.numero_commande}
                </h3>
                {/* Badge URGENT */}
                {dossier.urgent && (dossier.statut || dossier.status) !== 'livre' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-md font-bold text-xs shadow-md animate-pulse flex-shrink-0">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    URGENT
                  </span>
                )}
              </div>
              {/* Préparateur avec badge */}
              <div className="flex items-center mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md text-xs">
                  <UserIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-indigo-700 dark:text-indigo-300 font-medium truncate max-w-[150px]">
                    {dossier.preparateur_name || 'Non assigné'}
                  </span>
                </span>
              </div>
              {/* Client avec badge différent */}
              {dossier.client && (
                <div className="flex items-center mt-2">
                  <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold truncate max-w-[150px]">
                      {dossier.client}
                    </span>
                  </span>
                </div>
              )}
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
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleViewDetails(dossier)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
            >
              <EyeIcon className="h-4 w-4" />
              <span>Détails</span>
            </button>
            
            {canDelete && (
              <button
                onClick={handleDelete}
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

  DossierCard.propTypes = {
    dossier: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      numero_commande: PropTypes.string,
      preparateur_name: PropTypes.string,
      type: PropTypes.string,
      status: PropTypes.string,
      machine: PropTypes.string,
      created_at: PropTypes.string,
      created_by: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    handleViewDetails: PropTypes.func.isRequired,
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (loading && dossiers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-300">Chargement des dossiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
          <div className="flex justify-between">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-400" />
              <div className="ml-3">
                <p className="text-sm text-danger-800">{error}</p>
              </div>
            </div>
            <button onClick={clearMessages} className="text-danger-400 hover:text-danger-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-success-50 border border-success-200 rounded-md p-4">
          <div className="flex justify-between">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-success-400" />
              <div className="ml-3">
                <p className="text-sm text-success-800">{success}</p>
              </div>
            </div>
            <button onClick={clearMessages} className="text-success-400 hover:text-success-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Gestion des dossiers</h2>
          <p className="text-neutral-600 dark:text-neutral-300 mt-1">
            {totalItems} dossier{totalItems > 1 ? 's' : ''} • Page {currentPage} sur {totalPages}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadDossiers()}
            disabled={loading}
            className="btn-secondary"
            title="Actualiser"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>

          {canCreateDossier() && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              Nouveau dossier
            </button>
          )}
        </div>
      </div>

      
      {/* KPIs et Filtres de Machine (Ajoutés pour uniformiser l'UI) */}
      {(!user?.role?.includes('imprimeur') && user?.role !== 'livreur') && (() => {
          const getAppStatus = d => {
            if (d.status) return d.status;
            const s = (d.statut || '').toLowerCase();
            if (s.includes('cours')) return 'en_cours';
            if (s.includes('revoir')) return 'a_revoir';
            if (s.includes('impression')) return 'en_impression';
            if (s.includes('imprim')) return 'termine';
            if (s.includes('prêt') && s.includes('livraison')) return 'pret_livraison';
            if (s.includes('livraison')) return 'en_livraison';
            if (s.includes('livré')) return 'livre';
            if (s.includes('termin')) return 'termine';
            return d.status || '';
          };
          const totalCount = totalItems;
          const prepaCount = statsKPI.prepa;
          const imprCount = statsKPI.impr;
          const livCount = statsKPI.liv;

          return (
            <div className="mt-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Total Affichés</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
                 </div>
                 <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm">
                    <p className="text-blue-500 text-xs font-bold uppercase mb-1">Préparation</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{prepaCount}</p>
                 </div>
                 <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                    <p className="text-indigo-500 text-xs font-bold uppercase mb-1">En Impression</p>
                    <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{imprCount}</p>
                 </div>
                 <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl border border-green-100 dark:border-green-800 shadow-sm">
                    <p className="text-green-500 text-xs font-bold uppercase mb-1">À livrer</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{livCount}</p>
                 </div>
              </div>
              
              <div className="flex items-center justify-center p-1 bg-white dark:bg-gray-800 rounded-lg p-2 h-fit border border-gray-200 dark:border-gray-700 shadow-sm">
                 <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-md">
                    <button 
                      onClick={() => handleFilterChange('type', '')} 
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${!filters.type ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >Toutes</button>
                    <button 
                      onClick={() => handleFilterChange('type', 'roland')} 
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filters.type === 'roland' ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >Roland</button>
                    <button 
                      onClick={() => handleFilterChange('type', 'xerox')} 
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filters.type === 'xerox' ? 'bg-orange-50 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >Xerox</button>
                 </div>
              </div>
            </div>
          );
      })()}

      {/* Filtres originaux */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Recherche - Masquée pour les imprimeurs */}
            {!user?.role?.includes('imprimeur') && (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="form-input pl-10"
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                />
              </div>
            )}

            {/* Filtre par statut */}
            <select
              className="form-input"
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
            >
              <option value="">Tous les statuts</option>
              {getAvailableStatuses().map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            

            {/* Filtre urgence */}
            <select
              className="form-input"
              value={filters.urgence}
              onChange={e => handleFilterChange('urgence', e.target.value)}
            >
              <option value="">Toutes les priorités</option>
              <option value="true">Urgent uniquement</option>
              <option value="false">Non urgent</option>
            </select>

            {/* Reset filtres */}
            <button onClick={clearFilters} className="btn-secondary">
              <XMarkIcon className="h-5 w-5 mr-2" />
              Effacer
            </button>
          </div>

          {/* Filtres rapides (chips) */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Urgent chip */}
            <button
              onClick={() =>
                handleFilterChange('urgence', filters.urgence === 'true' ? '' : 'true')
              }
              className={`px-3 py-1 rounded-full text-sm border ${filters.urgence === 'true' ? 'bg-danger-100 text-danger-800 border-danger-200 dark:bg-danger-900 dark:text-danger-100 dark:border-danger-700' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-700'}`}
              title="Filtrer urgent"
            >
              Urgent
            </button>
            {/* Statuts rapides (selon rôle) */}
            {getAvailableStatuses().map(s => (
              <button
                key={`chip-${s.value}`}
                onClick={() =>
                  handleFilterChange('status', filters.status === s.value ? '' : s.value)
                }
                className={`px-3 py-1 rounded-full text-sm border ${filters.status === s.value ? 'bg-primary-100 text-primary-800 border-blue-200 dark:bg-primary-900 dark:text-primary-100 dark:border-primary-700' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-700'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des dossiers - vue spécifique selon rôle */}
      {(() => {
        if (dossiers.length === 0) {
          return (
            <div className="text-center py-12">
              <FolderIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 mb-4">
                {Object.values(filters).some(f => f)
                  ? 'Aucun dossier ne correspond aux filtres'
                  : 'Aucun dossier trouvé'}
              </p>
              {canCreateDossier() && !Object.values(filters).some(f => f) && (
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                  <PlusIcon className="h-5 w-5 mr-2" /> Créer le premier dossier
                </button>
              )}
            </div>
          );
        }

        // Helper pour normaliser le statut applicatif
        const getAppStatus = d => {
          if (d.status) return d.status;
          const s = (d.statut || '').toLowerCase();
          if (s.includes('cours')) return 'en_cours';
          if (s.includes('revoir')) return 'a_revoir';
          if (s.includes('impression')) return 'en_impression';
          if (s.includes('imprim')) return 'termine'; // "Imprimé" → à livrer
          if (s.includes('prêt') && s.includes('livraison')) return 'pret_livraison';
          if (s.includes('livraison')) return 'en_livraison';
          if (s.includes('livré')) return 'livre';
          if (s.includes('termin')) return 'termine';
          return d.status || '';
        };

        if (user?.role === 'preparateur') {
          // Normalisation du champ type pour l'affichage et la logique de filtrage
          const groups = dossiers.reduce((acc, d) => {
            // Utilise type_formulaire si présent, sinon type, sinon machine
            const key =
              d.type_formulaire ||
              d.type ||
              (d.machine ? String(d.machine).toLowerCase() : 'autres');
            acc[key] = acc[key] || [];
            acc[key].push(d);
            return acc;
          }, {});
          return (
            <div className="space-y-6">
              {Object.entries(groups).map(([groupKey, groupItems]) => (
                <div key={groupKey}>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                    {groupKey === 'roland' ? 'Roland' : groupKey === 'xerox' ? 'Xerox' : 'Autres'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupItems.map(d => (
                      <DossierCard key={d.id} dossier={d} handleViewDetails={handleViewDetails} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (user?.role === 'livreur') {
          const toDeliver = dossiers.filter(d =>
            ['pret_livraison', 'termine'].includes(getAppStatus(d))
          );
          const inDelivery = dossiers.filter(d => getAppStatus(d) === 'en_livraison');
          const delivered = dossiers.filter(d => getAppStatus(d) === 'livre');
          const Section = ({ title, items }) => (
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                {title} ({items.length})
              </h3>
              {items.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(d => (
                    <DossierCard key={d.id} dossier={d} handleViewDetails={handleViewDetails} />
                  ))}
                </div>
              ) : (
                <div className="text-neutral-500 text-sm">Aucun dossier</div>
              )}
            </div>
          );

          Section.propTypes = {
            title: PropTypes.string.isRequired,
            items: PropTypes.array.isRequired,
          };

          return (
            <div className="space-y-8">
              <Section title="À livrer" items={toDeliver} />
              <Section title="En livraison" items={inDelivery} />
              <Section title="Terminé" items={delivered} />
            </div>
          );
        }

        // Par défaut (admin, imprimeurs)
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dossiers.map(dossier => (
              <DossierCard
                key={dossier.id}
                dossier={dossier}
                handleViewDetails={handleViewDetails}
              />
            ))}
          </div>
        );
      })()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-700 dark:text-neutral-200">
            Affichage de {(currentPage - 1) * itemsPerPage + 1} à{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} sur {totalItems} dossiers
          </p>

          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || loading}
              className="btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + Math.max(1, Math.min(currentPage - 2, totalPages - 4));
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`btn-sm ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={loading}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || loading}
              className="btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Modal de création - Toujours monté pour écouter l'événement editDossier */}
      <CreateDossier
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Modal de détails du dossier */}
      <DossierDetails
        dossierId={selectedDossier?.folder_id || selectedDossier?.id}
        isOpen={!!selectedDossier}
        onClose={handleCloseDetails}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default DossierManagement;
