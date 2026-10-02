/**
 * GESTIONNAIRE DE FICHIERS - STYLE FINDER macOS
 * ==============================================
 * 
 * Interface inspirée du Finder de macOS avec :
 * - Navigation latérale (sidebar)
 * - Vue en colonnes hiérarchique
 * - Panneau d'aperçu Quick Look
 * - Breadcrumb navigation
 * - Actions contextuelles
 * - Raccourcis clavier
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import FilePreview from './FilePreview';
import FileUpload from './FileUpload';
import AuthStatus from '../common/AuthStatus';
import { apiCallWithAuth } from '../../utils/authUtils';
import { dossiersService, filesService } from '../../services/api';
import {
  FolderIcon,
  DocumentIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  TrashIcon,
  HomeIcon,
  Bars3Icon,
  ListBulletIcon,
  ExclamationCircleIcon,
  ArrowPathIcon as RefreshIcon,
  ChevronRightIcon,
  StarIcon,
  ClockIcon,
  TagIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ChevronLeftIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid
} from '@heroicons/react/24/solid';

const FileManagerFinder = () => {
  // États principaux
  const [dossiers, setDossiers] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: 'Tous les dossiers' }]);
  const [favorites, setFavorites] = useState([]);
  const [recentDossiers, setRecentDossiers] = useState([]);
  
  // États d'interface
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid, list, columns
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickLookVisible, setQuickLookVisible] = useState(false);
  const [quickLookFile, setQuickLookFile] = useState(null);
  
  // États des modals
  const [showUpload, setShowUpload] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // États de chargement et erreurs
  const [loadingDossiers, setLoadingDossiers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState(false);
  const [error, setError] = useState('');
  const [uploading] = useState(false);

  // Refs
  const contextMenuRef = useRef(null);

  // Fonctions utilitaires
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return PhotoIcon;
    if (type === 'application/pdf') return DocumentTextIcon;
    if (type?.startsWith('video/')) return FilmIcon;
    if (type?.startsWith('audio/')) return MusicalNoteIcon;
    if (type?.includes('zip') || type?.includes('rar')) return ArchiveBoxIcon;
    return DocumentIcon;
  };

  const getStatusColor = (statut) => {
    switch (statut?.toLowerCase()) {
      case 'termine':
      case 'terminé':
        return 'bg-green-100 text-green-700';
      case 'en_cours':
      case 'en cours':
        return 'bg-blue-100 text-blue-700';
      case 'validation':
      case 'attente':
        return 'bg-yellow-100 text-yellow-700';
      case 'annule':
      case 'annulé':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Chargement des dossiers
  const loadDossiers = async () => {
    setLoadingDossiers(true);
    setError('');
    
    try {
      const response = await dossiersService.getDossiers({
        limit: 100,
        page: 1
      });
      
      const dossiersList = response.dossiers || response.data || response || [];
      setDossiers(dossiersList);
      
      if (dossiersList.length === 0) {
        setError('Aucun dossier trouvé');
      }
    } catch (err) {
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        setError('Session expirée - Veuillez vous reconnecter');
      } else {
        setError('Erreur lors du chargement des dossiers');
      }
    } finally {
      setLoadingDossiers(false);
    }
  };

  // Chargement des fichiers d'un dossier
  const loadFiles = async (dossierId) => {
    if (!dossierId) {
      setFiles([]);
      return;
    }

    setLoadingFiles(true);
    setError('');
    
    try {
      const response = await filesService.getFiles(dossierId);
      const filesList = response.files || response.data || response || [];
      setFiles(filesList);
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('Session expirée')) {
        setError('Session expirée - Veuillez vous reconnecter');
      } else {
        setError(`Erreur lors du chargement des fichiers`);
      }
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Chargement de tous les fichiers
  const loadAllFiles = async () => {
    setLoadingFiles(true);
    setError('');
    
    try {
      let allFiles = [];
      
      for (const dossier of dossiers) {
        try {
          const response = await filesService.getFiles(dossier.id || dossier.folder_id);
          const dossierFiles = response.files || response.data || response || [];
          
          const filesWithDossier = dossierFiles.map(file => ({
            ...file,
            dossier: {
              id: dossier.id || dossier.folder_id,
              client_nom: dossier.client_nom || dossier.client,
              numero_commande: dossier.numero_commande || dossier.numero,
              statut: dossier.statut,
              machine: dossier.machine
            }
          }));
          
          allFiles = allFiles.concat(filesWithDossier);
        } catch (err) {
          // Ignorer les erreurs individuelles
        }
      }
      
      setFiles(allFiles);
    } catch (err) {
      setError('Erreur lors du chargement de tous les fichiers');
    } finally {
      setLoadingFiles(false);
    }
  };

  // Navigation
  const navigateToDossier = (dossier) => {
    if (!dossier) {
      setSelectedDossier(null);
      setBreadcrumb([{ id: null, name: 'Tous les dossiers' }]);
      setSelectedFiles([]);
      loadAllFiles();
    } else {
      const dossierId = dossier.id || dossier.folder_id;
      setSelectedDossier(dossierId);
      setBreadcrumb([
        { id: null, name: 'Tous les dossiers' },
        { id: dossierId, name: dossier.client_nom || dossier.client || `Dossier ${dossierId}` }
      ]);
      setSelectedFiles([]);
      
      // Ajouter aux récents
      setRecentDossiers(prev => {
        const newRecents = [dossier, ...prev.filter(d => (d.id || d.folder_id) !== dossierId)];
        return newRecents.slice(0, 5);
      });
      
      loadFiles(dossierId);
    }
  };

  // Gestion favoris
  const toggleFavorite = (dossierId) => {
    setFavorites(prev => 
      prev.includes(dossierId) 
        ? prev.filter(id => id !== dossierId)
        : [...prev, dossierId]
    );
  };

  // Quick Look
  const showQuickLook = (file) => {
    setQuickLookFile(file);
    setQuickLookVisible(true);
  };

  // Gestion upload
  const handleUploadSuccess = async (uploadedFiles) => {
    setShowUpload(false);
    
    if (selectedDossier) {
      await loadFiles(selectedDossier);
    } else {
      await loadAllFiles();
    }
  };

  // Téléchargement
  const downloadFile = async (file) => {
    try {
      const response = await apiCallWithAuth(`/api/files/${file.id}/download`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename || file.nom || file.name || `fichier_${file.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erreur lors du téléchargement du fichier');
    }
  };

  // Sélection fichiers
  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    setSelectedFiles(filteredFiles.map(file => file.id));
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  // Suppression
  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    setDeletingFiles(true);
    
    try {
      const deletePromises = selectedFiles.map(async (fileId) => {
        try {
          const response = await apiCallWithAuth(`/api/files/${fileId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
          }
          
          return { success: true, fileId };
        } catch (error) {
          return { success: false, fileId, error: error.message };
        }
      });
      
      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (failed === 0) {
        alert(`${successful} fichier(s) supprimé(s) avec succès`);
      } else {
        alert(`${successful} fichier(s) supprimé(s), ${failed} échec(s)`);
      }
      
      setSelectedFiles([]);
      setShowDeleteConfirm(false);
      
      if (selectedDossier) {
        await loadFiles(selectedDossier);
      } else {
        await loadAllFiles();
      }
    } catch (error) {
      alert('Erreur lors de la suppression des fichiers');
    } finally {
      setDeletingFiles(false);
    }
  };

  // Filtrage et tri
  const getFilteredFiles = () => {
    let filtered = [...files];

    // Recherche
    if (searchTerm) {
      filtered = filtered.filter(file => {
        const fileName = file.original_filename || file.nom || file.name || '';
        const uploaderName = file.uploaded_by_name || file.uploader_name || '';
        const clientName = file.dossier?.client_nom || '';
        
        return fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               uploaderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               clientName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    
    // Type
    if (fileTypeFilter !== 'all') {
      filtered = filtered.filter(file => {
        const fileType = file.mimetype || file.type || '';
        switch (fileTypeFilter) {
          case 'images':
            return fileType.startsWith('image/');
          case 'pdf':
            return fileType === 'application/pdf';
          case 'videos':
            return fileType.startsWith('video/');
          case 'documents':
            return fileType.includes('document') || fileType.includes('text');
          default:
            return true;
        }
      });
    }

    // Tri
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name': {
          const nameA = a.original_filename || a.nom || a.name || '';
          const nameB = b.original_filename || b.nom || b.name || '';
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'date': {
          const dateA = new Date(a.uploaded_at || a.created_at || 0);
          const dateB = new Date(b.uploaded_at || b.created_at || 0);
          comparison = dateA - dateB;
          break;
        }
        case 'size':
          comparison = (a.size || a.taille || 0) - (b.size || b.taille || 0);
          break;
        case 'type': {
          const typeA = a.mimetype || a.type || '';
          const typeB = b.mimetype || b.type || '';
          comparison = typeA.localeCompare(typeB);
          break;
        }
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredFiles = getFilteredFiles();

  // Effets
  useEffect(() => {
    loadDossiers();
    
    const savedFavorites = localStorage.getItem('fileManager_favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('fileManager_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        // Fermer context menu si nécessaire
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Barre de titre style macOS */}
      <div className="flex-none bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            {/* Boutons macOS */}
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}></div>
              <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer"></div>
            </div>
            
            <div className="ml-4 flex items-center gap-3">
              <FolderIcon className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-gray-700 dark:text-gray-200">📁 Gestionnaire de Fichiers</span>
            </div>
          </div>
          
          <AuthStatus />
        </div>
      </div>

      {/* Barre d'outils style Finder */}
      <div className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <button
              onClick={() => navigateToDossier(null)}
              disabled={!selectedDossier}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Retour"
            >
              <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item.id || 'root'}>
                  {index > 0 && <ChevronRightIcon className="h-3 w-3" />}
                  <button
                    onClick={() => {
                      if (index === 0) {
                        navigateToDossier(null);
                      } else {
                        const dossier = dossiers.find(d => (d.id || d.folder_id) === item.id);
                        if (dossier) navigateToDossier(dossier);
                      }
                    }}
                    className="hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Vue modes */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                title="Grille"
              >
                <Squares2X2Icon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                title="Liste"
              >
                <ListBulletIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setViewMode('columns')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'columns' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                title="Colonnes"
              >
                <TableCellsIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={() => setShowUpload(true)}
              disabled={uploading || !selectedDossier}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              <span>Upload</span>
            </button>

            <button
              onClick={() => {
                loadDossiers();
                if (selectedDossier) {
                  loadFiles(selectedDossier);
                } else {
                  loadAllFiles();
                }
              }}
              disabled={loadingDossiers || loadingFiles}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              title="Actualiser"
            >
              <RefreshIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={() => setQuickLookVisible(!quickLookVisible)}
              className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${quickLookVisible ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              title="Quick Look"
            >
              <InformationCircleIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm"
          >
            <option value="all">Tous</option>
            <option value="images">Images</option>
            <option value="pdf">PDF</option>
            <option value="videos">Vidéos</option>
            <option value="documents">Documents</option>
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm"
          >
            <option value="name-asc">Nom ↑</option>
            <option value="name-desc">Nom ↓</option>
            <option value="date-desc">Plus récent</option>
            <option value="date-asc">Plus ancien</option>
            <option value="size-desc">Plus gros</option>
            <option value="size-asc">Plus petit</option>
          </select>

          {selectedFiles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                {selectedFiles.length} sélectionné(s)
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deletingFiles}
                className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                <TrashIcon className="h-3 w-3" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal avec Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar style Finder */}
        <div className={`flex-none bg-gray-50 dark:bg-gray-850 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all ${sidebarCollapsed ? 'w-0' : 'w-64'}`}>
          {!sidebarCollapsed && (
            <div className="p-3 space-y-4">
              {/* Favoris */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-2">Favoris</h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => navigateToDossier(null)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${!selectedDossier ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span>Tous les dossiers</span>
                  </button>
                  
                  {favorites.length > 0 && favorites.map(favId => {
                    const dossier = dossiers.find(d => (d.id || d.folder_id) === favId);
                    if (!dossier) return null;
                    return (
                      <button
                        key={favId}
                        onClick={() => navigateToDossier(dossier)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${selectedDossier === favId ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        <FolderIcon className="h-4 w-4 text-blue-500" />
                        <span className="flex-1 truncate text-left">{dossier.client_nom || dossier.client}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Récents */}
              {recentDossiers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-2">Récents</h3>
                  <div className="space-y-0.5">
                    {recentDossiers.map(dossier => (
                      <button
                        key={dossier.id || dossier.folder_id}
                        onClick={() => navigateToDossier(dossier)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${selectedDossier === (dossier.id || dossier.folder_id) ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        <ClockIcon className="h-4 w-4" />
                        <span className="flex-1 truncate text-left">{dossier.client_nom || dossier.client}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tous les dossiers */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-2">
                  Dossiers ({dossiers.length})
                </h3>
                <div className="space-y-0.5">
                  {loadingDossiers ? (
                    <div className="px-2 py-4 text-center text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto"></div>
                    </div>
                  ) : dossiers.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-gray-500">
                      Aucun dossier
                    </div>
                  ) : (
                    dossiers.map(dossier => (
                      <div
                        key={dossier.id || dossier.folder_id}
                        className="group flex items-center gap-1"
                      >
                        <button
                          onClick={() => navigateToDossier(dossier)}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${selectedDossier === (dossier.id || dossier.folder_id) ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                          <FolderIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="flex-1 truncate text-left">{dossier.client_nom || dossier.client}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(dossier.id || dossier.folder_id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-opacity"
                        >
                          {favorites.includes(dossier.id || dossier.folder_id) ? (
                            <StarIconSolid className="h-3 w-3 text-yellow-500" />
                          ) : (
                            <StarIcon className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-2">Tags</h3>
                <div className="space-y-0.5">
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <TagIcon className="h-4 w-4 text-red-500" />
                    <span>Important</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <TagIcon className="h-4 w-4 text-green-500" />
                    <span>Validé</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <TagIcon className="h-4 w-4 text-blue-500" />
                    <span>En cours</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Zone de contenu principale */}
        <div className="flex-1 flex overflow-hidden">
          {/* Liste des fichiers */}
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 p-4">
            {loadingFiles || loadingDossiers ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">
                    {loadingDossiers ? 'Chargement des dossiers...' : 'Chargement des fichiers...'}
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ExclamationCircleIcon className="h-16 w-16 text-red-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {error.includes('Session expirée') ? 'Session expirée' : 'Erreur'}
                  </h3>
                  <p className="text-red-600 mb-6">{error}</p>
                  
                  {error.includes('Session expirée') ? (
                    <button
                      onClick={() => window.location.href = '/login'}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      🔑 Se reconnecter
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        loadDossiers();
                        if (selectedDossier) {
                          loadFiles(selectedDossier);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Aucun fichier trouvé</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {selectedDossier 
                      ? 'Ce dossier ne contient aucun fichier.'
                      : 'Aucun fichier trouvé dans les dossiers disponibles.'
                    }
                  </p>
                  
                  {selectedDossier && (
                    <button
                      onClick={() => setShowUpload(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <CloudArrowUpIcon className="h-4 w-4 inline mr-2" />
                      Ajouter des fichiers
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    selected={selectedFiles.includes(file.id)}
                    onSelect={() => toggleFileSelection(file.id)}
                    onDownload={() => downloadFile(file)}
                    onPreview={() => setPreviewFile(file)}
                    onQuickLook={() => showQuickLook(file)}
                    getFileIcon={getFileIcon}
                    formatFileSize={formatFileSize}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-1">
                {filteredFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    selected={selectedFiles.includes(file.id)}
                    onSelect={() => toggleFileSelection(file.id)}
                    onDownload={() => downloadFile(file)}
                    onPreview={() => setPreviewFile(file)}
                    onQuickLook={() => showQuickLook(file)}
                    getFileIcon={getFileIcon}
                    formatFileSize={formatFileSize}
                    formatDate={formatDate}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Vue en colonnes - À implémenter
              </div>
            )}
          </div>

          {/* Quick Look Panel */}
          {quickLookVisible && quickLookFile && (
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Aperçu</h3>
                  <button
                    onClick={() => {
                      setQuickLookVisible(false);
                      setQuickLookFile(null);
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                <QuickLookPanel
                  file={quickLookFile}
                  getFileIcon={getFileIcon}
                  formatFileSize={formatFileSize}
                  formatDate={formatDate}
                  getStatusColor={getStatusColor}
                  onDownload={() => downloadFile(quickLookFile)}
                  onFullPreview={() => setPreviewFile(quickLookFile)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barre de statut en bas */}
      {filteredFiles.length > 0 && (
        <div className="flex-none bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 px-4 py-1.5">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span>{filteredFiles.length} élément{filteredFiles.length > 1 ? 's' : ''}</span>
              {selectedFiles.length > 0 && (
                <span className="text-blue-600 dark:text-blue-400">{selectedFiles.length} sélectionné{selectedFiles.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <span>{formatFileSize(filteredFiles.reduce((sum, f) => sum + (f.size || f.taille || 0), 0))} total</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <FileUpload
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUploadSuccess}
        demoMode={false}
      />

      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={() => downloadFile(previewFile)}
        />
      )}
      
      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Supprimer les fichiers ?
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Voulez-vous vraiment supprimer {selectedFiles.length} fichier(s) ? 
                Cette action est irréversible.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingFiles}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                
                <button
                  onClick={deleteSelectedFiles}
                  disabled={deletingFiles}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingFiles && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2"></div>
                  )}
                  {deletingFiles ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant carte de fichier (Grid)
const FileCard = ({ file, selected, onSelect, onDownload, onPreview, onQuickLook, getFileIcon, formatFileSize, formatDate }) => {
  const IconComponent = getFileIcon(file.mimetype || file.type);
  const fileName = file.original_filename || file.nom || file.name || 'Fichier sans nom';
  const fileSize = file.size || file.taille || 0;
  const fileDate = file.uploaded_at || file.created_at || new Date().toISOString();
  
  return (
    <div 
      className={`
        relative group bg-white dark:bg-gray-750 rounded-lg border-2 p-3 transition-all cursor-pointer
        ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'}
      `}
      onClick={onQuickLook}
    >
      <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Prévisualiser"
        >
          <EyeIcon className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
          title="Télécharger"
        >
          <ArrowDownTrayIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="flex justify-center mb-2 mt-4">
        <IconComponent className="h-10 w-10 text-gray-400" />
      </div>

      <div className="text-center">
        <h4 className="text-xs font-medium text-gray-900 dark:text-white truncate mb-1" title={fileName}>
          {fileName}
        </h4>
        
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>{formatFileSize(fileSize)}</span>
          <span>{formatDate(fileDate).split(',')[0]}</span>
        </div>
      </div>
    </div>
  );
};

// Composant ligne de fichier (List)
const FileRow = ({ file, selected, onSelect, onDownload, onPreview, onQuickLook, getFileIcon, formatFileSize, formatDate, getStatusColor }) => {
  const IconComponent = getFileIcon(file.mimetype || file.type);
  const fileName = file.original_filename || file.nom || file.name || 'Fichier sans nom';
  const fileSize = file.size || file.taille || 0;
  const fileDate = file.uploaded_at || file.created_at || new Date().toISOString();
  const uploader = file.uploaded_by_name || file.uploader_name || 'Inconnu';
  
  return (
    <div 
      className={`
        flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer
        ${selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}
      `}
      onClick={onQuickLook}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </div>
      
      <IconComponent className="h-5 w-5 text-gray-400 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{fileName}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {uploader}
          {file.dossier && (
            <>
              {' • '}
              <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(file.dossier.statut)}`}>
                {file.dossier.client_nom}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 w-20 text-right">
        {formatFileSize(fileSize)}
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 w-32 text-right">
        {formatDate(fileDate)}
      </div>
      
      <div className="flex gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onPreview}
          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
          title="Prévisualiser"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onDownload}
          className="p-1.5 text-green-600 hover:bg-green-100 rounded"
          title="Télécharger"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Composant Quick Look Panel
const QuickLookPanel = ({ file, getFileIcon, formatFileSize, formatDate, getStatusColor, onDownload, onFullPreview }) => {
  const IconComponent = getFileIcon(file.mimetype || file.type);
  const fileName = file.original_filename || file.nom || file.name || 'Fichier sans nom';
  const fileSize = file.size || file.taille || 0;
  const fileDate = file.uploaded_at || file.created_at || new Date().toISOString();
  const uploader = file.uploaded_by_name || file.uploader_name || 'Inconnu';
  const fileType = file.mimetype || file.type || 'Type inconnu';
  
  return (
    <div className="space-y-4">
      {/* Aperçu visuel */}
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        {fileType.startsWith('image/') ? (
          <img 
            src={`/api/files/${file.id}/preview`} 
            alt={fileName}
            className="w-full h-full object-contain rounded-lg"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <IconComponent className="h-20 w-20 text-gray-400" />
      </div>

      {/* Informations */}
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2 break-words">
            {fileName}
          </h4>
          
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Type:</span>
              <span className="text-gray-700 dark:text-gray-300">{fileType}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500">Taille:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatFileSize(fileSize)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500">Ajouté le:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatDate(fileDate)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500">Par:</span>
              <span className="text-gray-700 dark:text-gray-300">{uploader}</span>
            </div>

            {file.dossier && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Dossier:</span>
                  <span className="text-gray-700 dark:text-gray-300 truncate ml-2">{file.dossier.client_nom}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Statut:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(file.dossier.statut)}`}>
                    {file.dossier.statut}
                  </span>
                </div>

                {file.dossier.numero_commande && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">N° commande:</span>
                    <span className="text-gray-700 dark:text-gray-300">{file.dossier.numero_commande}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onFullPreview}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
            Aperçu complet
          </button>
          
          <button
            onClick={onDownload}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
};

// PropTypes
FileCard.propTypes = {
  file: PropTypes.object.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  onQuickLook: PropTypes.func.isRequired,
  getFileIcon: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired
};

FileRow.propTypes = {
  file: PropTypes.object.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  onQuickLook: PropTypes.func.isRequired,
  getFileIcon: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  getStatusColor: PropTypes.func.isRequired
};

QuickLookPanel.propTypes = {
  file: PropTypes.object.isRequired,
  getFileIcon: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  getStatusColor: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onFullPreview: PropTypes.func.isRequired
};

export default FileManagerFinder;
