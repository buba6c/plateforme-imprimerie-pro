/**
 * GESTIONNAIRE DE FICHIERS - VERSION PRODUCTION
 * ============================================
 * 
 * Gestionnaire de fichiers utilisant uniquement l'API réelle
 * - Chargement de tous les dossiers existants
 * - Affichage des fichiers réels par dossier
 * - Prévisualisation complète des fichiers
 * - Interface moderne et performante
 */

import React, { useState, useEffect } from 'react';
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
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon as RefreshIcon
} from '@heroicons/react/24/outline';

const FileManager = () => {
  // États principaux
  const [dossiers, setDossiers] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedDossier, setSelectedDossier] = useState(null);
  
  // États d'interface
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedFiles, setSelectedFiles] = useState([]);
  
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

  // Fonctions utilitaires
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    // eslint-disable-next-line no-undef
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
        return 'bg-success-100 text-green-800';
      case 'en_cours':
      case 'en cours':
        return 'bg-blue-100 text-blue-800';
      case 'validation':
      case 'attente':
        return 'bg-yellow-100 text-yellow-800';
      case 'annule':
      case 'annulé':
        return 'bg-error-100 text-red-800';
      default:
        return 'bg-secondary-100 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-100';
    }
  };

  // Chargement des dossiers
  const loadDossiers = async () => {
    setLoadingDossiers(true);
    setError('');
    
    try {
      console.log('📁 Chargement des dossiers...');
      const response = await dossiersService.getDossiers({
        limit: 100,
        page: 1
      });
      
      const dossiersList = response.dossiers || response.data || response || [];
      console.log('✅ Dossiers chargés:', dossiersList.length);
      
      setDossiers(dossiersList);
      
      if (dossiersList.length === 0) {
        setError('Aucun dossier trouvé dans la base de données');
      }
    } catch (err) {
      console.error('❌ Erreur chargement dossiers:', err);
      
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        setError('Session expirée - Veuillez vous reconnecter');
      } else {
        setError('Erreur lors du chargement des dossiers: ' + (err.message || 'Erreur inconnue'));
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
      console.log('📄 Chargement fichiers pour dossier:', dossierId);
      
      // Essayer avec le nouveau service unifié
      try {
        const response = await filesService.getFiles(dossierId);
        const filesList = response.files || response.data || response || [];
        
        console.log('✅ Fichiers chargés:', filesList.length);
        setFiles(filesList);
        
      } catch (fallbackError) {
        console.log('⚠️ Service unifié indisponible, essai avec API classique...');
        
        // Obtenir le token d'auth
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        
        // Fallback vers API classique
        const response = await fetch(`/api/dossiers/${dossierId}/fichiers`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Session expirée - Veuillez vous reconnecter');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const filesList = data.files || data.fichiers || data.data || [];
        
        console.log('✅ Fichiers chargés (fallback):', filesList.length);
        setFiles(filesList);
      }
      
    } catch (err) {
      console.error('❌ Erreur chargement fichiers:', err);
      
      if (err.message.includes('401') || err.message.includes('Session expirée')) {
        setError('Session expirée - Veuillez vous reconnecter');
      } else {
        setError(`Erreur lors du chargement des fichiers: ${err.message}`);
      }
      
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Chargement de tous les fichiers (mode global)
  const loadAllFiles = async () => {
    setLoadingFiles(true);
    setError('');
    
    try {
      console.log('📄 Chargement de tous les fichiers...');
      let allFiles = [];
      
      // Charger les fichiers de chaque dossier
      for (const dossier of dossiers) {
        try {
          const response = await filesService.getFiles(dossier.id || dossier.folder_id);
          const dossierFiles = response.files || response.data || response || [];
          
          // Ajouter les métadonnées du dossier à chaque fichier
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
          console.warn(`⚠️ Impossible de charger les fichiers du dossier ${dossier.id}:`, err);
        }
      }
      
      console.log('✅ Total fichiers chargés:', allFiles.length);
      setFiles(allFiles);
      
    } catch (err) {
      console.error('❌ Erreur chargement tous fichiers:', err);
      setError('Erreur lors du chargement de tous les fichiers: ' + (err.message || 'Erreur inconnue'));
    } finally {
      setLoadingFiles(false);
    }
  };

  // Gestion de la sélection de dossiers
  const handleSelectDossier = (dossier) => {
    console.log('📁 Sélection dossier:', dossier?.client_nom || dossier?.id);
    
    if (!dossier) {
      // Sélection "Tous les dossiers"
      setSelectedDossier(null);
      setSelectedFiles([]);
      loadAllFiles();
    } else {
      // Sélection d'un dossier spécifique
      setSelectedDossier(dossier.id || dossier.folder_id);
      setSelectedFiles([]);
      loadFiles(dossier.id || dossier.folder_id);
    }
  };

  // Gestion de l'upload
  const handleUploadSuccess = async (uploadedFiles) => {
    console.log('✅ Upload terminé:', uploadedFiles.length, 'fichier(s)');
    setShowUpload(false);
    
    // Recharger les fichiers
    if (selectedDossier) {
      await loadFiles(selectedDossier);
    } else {
      await loadAllFiles();
    }
  };

  // Gestion du téléchargement
  const downloadFile = async (file) => {
    console.log('📥 Téléchargement:', file.original_filename || file.nom || file.name);
    
    try {
      // Utiliser l'API de téléchargement avec authentification
      const response = await apiCallWithAuth(`/api/files/${file.id}/download`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Récupérer le fichier en tant que blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Créer le lien de téléchargement
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename || file.nom || file.name || `fichier_${file.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Nettoyer l'URL
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('❌ Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement du fichier');
    }
  };

  // Gestion de la sélection de fichiers
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

  // Fonction de suppression de fichiers
  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    setDeletingFiles(true);
    
    try {
      console.log('🗑️ Suppression de', selectedFiles.length, 'fichier(s)');
      
      // Supprimer chaque fichier sélectionné
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
          console.error(`❌ Erreur suppression fichier ${fileId}:`, error);
          return { success: false, fileId, error: error.message };
        }
      });
      
      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ ${successful} fichier(s) supprimé(s), ${failed} échec(s)`);
      
      // Afficher un message de résultat
      if (failed === 0) {
        alert(`${successful} fichier(s) supprimé(s) avec succès`);
      } else {
        alert(`${successful} fichier(s) supprimé(s), ${failed} échec(s)`);
      }
      
      // Vider la sélection
      setSelectedFiles([]);
      setShowDeleteConfirm(false);
      
      // Recharger les fichiers
      if (selectedDossier) {
        await loadFiles(selectedDossier);
      } else {
        await loadAllFiles();
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression des fichiers');
    } finally {
      setDeletingFiles(false);
    }
  };

  // Filtrage et tri des fichiers
  const getFilteredFiles = () => {
    let filteredFiles = [...files];

    // Filtrage par recherche
    if (searchTerm) {
      filteredFiles = filteredFiles.filter(file => {
        const fileName = file.original_filename || file.nom || file.name || '';
        const uploaderName = file.uploaded_by_name || file.uploader_name || '';
        const clientName = file.dossier?.client_nom || '';
        
        return fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               uploaderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               clientName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    
    // Filtrage par type de fichier
    if (fileTypeFilter !== 'all') {
      filteredFiles = filteredFiles.filter(file => {
        const fileType = file.mimetype || file.type || '';
        switch (fileTypeFilter) {
          case 'images':
            return fileType.startsWith('image/');
          case 'pdf':
            return fileType === 'application/pdf';
          case 'videos':
            return fileType.startsWith('video/');
          case 'documents':
            return fileType.includes('document') || fileType.includes('text') || fileType.includes('word') || fileType.includes('excel') || fileType.includes('powerpoint');
          default:
            return true;
        }
      });
    }

    // Tri
    filteredFiles.sort((a, b) => {
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

    return filteredFiles;
  };

  const filteredFiles = getFilteredFiles();

  // Effets
  useEffect(() => {
    loadDossiers();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* En-tête */}
        <div className="bg-white dark:bg-secondary-800/90 backdrop-blur-xl rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-white/40 p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
                  📁 Gestionnaire de Fichiers
                </h1>
                <AuthStatus />
              </div>
              
              {/* Message de statut */}
              <div className="flex items-center p-3 rounded-lg bg-success-50 border border-green-200 mt-2">
                <CheckCircleIcon className="h-5 w-5 text-success-600 mr-2" />
                <span className="text-sm text-green-800">
                  {loadingDossiers ? 'Chargement des dossiers...' :
                   loadingFiles ? 'Chargement des fichiers...' :
                   error ? error :
                   `${dossiers.length} dossier(s) • ${filteredFiles.length} fichier(s) affiché(s)`}
                </span>
              </div>
            </div>
            
            {/* Actions principales */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpload(true)}
                disabled={uploading || !selectedDossier}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                {uploading ? 'Upload...' : 'Upload'}
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
                className="flex items-center px-4 py-2 bg-secondary-600 text-white rounded-xl hover:bg-secondary-700 disabled:opacity-50 transition-colors"
              >
                <RefreshIcon className="h-4 w-4 mr-2" />
                Actualiser
              </button>
            </div>
          </div>

          {/* Sélection de dossiers */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">
              Dossiers disponibles ({dossiers.length})
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-48 overflow-y-auto">
              {/* Option "Tous les dossiers" */}
              <div
                onClick={() => handleSelectDossier(null)}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md dark:shadow-secondary-900/20 ${
                  !selectedDossier
                    ? 'border-blue-500 bg-blue-50 shadow-lg dark:shadow-secondary-900/25'
                    : 'border-secondary-200 hover:border-blue-300 bg-white dark:bg-secondary-800'
                }`}
              >
                <div className="flex items-center">
                  <HomeIcon className="h-5 w-5 text-secondary-600 dark:text-secondary-300 mr-3" />
                  <div>
                    <div className="font-semibold text-secondary-900 dark:text-white">Tous les dossiers</div>
                    <div className="text-sm text-secondary-600 dark:text-secondary-300">{files.length} fichiers total</div>
                  </div>
                </div>
              </div>

              {/* Dossiers individuels */}
              {dossiers.map((dossier) => (
                <div
                  key={dossier.id || dossier.folder_id}
                  onClick={() => handleSelectDossier(dossier)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md dark:shadow-secondary-900/20 ${
                    selectedDossier === (dossier.id || dossier.folder_id)
                      ? 'border-blue-500 bg-blue-50 shadow-lg dark:shadow-secondary-900/25'
                      : 'border-secondary-200 hover:border-blue-300 bg-white dark:bg-secondary-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center min-w-0 flex-1">
                      <FolderIcon className="h-5 w-5 text-secondary-600 dark:text-secondary-300 mr-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-secondary-900 dark:text-white truncate">
                          {dossier.client_nom || dossier.client || `Dossier ${dossier.id}`}
                        </div>
                        <div className="text-xs text-secondary-600 dark:text-secondary-300 truncate">
                          {dossier.numero_commande || dossier.numero}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${
                      getStatusColor(dossier.statut)
                    }`}>
                      {dossier.statut}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-secondary-500 dark:text-secondary-400">
                    <span>🖨️ {dossier.machine}</span>
                    <span>{formatDate(dossier.created_at).split(' ')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Barre de recherche et contrôles */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher dans les fichiers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-secondary-800/80"
                />
              </div>
              
              {/* Filtre par type */}
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                className="border border-secondary-200 dark:border-secondary-700 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800"
              >
                <option value="all">Tous les types</option>
                <option value="images">Images</option>
                <option value="pdf">PDF</option>
                <option value="videos">Vidéos</option>
                <option value="documents">Documents</option>
              </select>
            </div>

            <div className="flex gap-2 items-center">
              {/* Contrôles de sélection */}
              {filteredFiles.length > 0 && (
                <div className="flex gap-2 items-center">
                  <button
                    onClick={selectedFiles.length === filteredFiles.length ? clearSelection : selectAllFiles}
                    className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded"
                  >
                    {selectedFiles.length === filteredFiles.length ? 'Désélectionner' : 'Sélectionner tout'}
                  </button>
                  
                  {selectedFiles.length > 0 && (
                    <>
                      <span className="text-sm text-secondary-600 dark:text-secondary-300 px-2 py-1 bg-blue-50 rounded">
                        {selectedFiles.length} sélectionné(s)
                      </span>
                      
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={deletingFiles}
                        className="flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <TrashIcon className="h-3 w-3 mr-1" />
                        {deletingFiles ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Tri */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
                className="text-sm border border-secondary-200 dark:border-secondary-700 rounded-lg px-3 py-2"
              >
                <option value="name-asc">Nom (A-Z)</option>
                <option value="name-desc">Nom (Z-A)</option>
                <option value="date-desc">Plus récent</option>
                <option value="date-asc">Plus ancien</option>
                <option value="size-desc">Plus volumineux</option>
                <option value="size-asc">Plus petit</option>
              </select>

              {/* Mode d'affichage */}
              <div className="flex border border-secondary-200 dark:border-secondary-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-secondary-800 text-secondary-600 hover:bg-secondary-50 dark:bg-secondary-900'}`}
                >
                  <Bars3Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-secondary-800 text-secondary-600 hover:bg-secondary-50 dark:bg-secondary-900'}`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Zone de contenu des fichiers */}
        <div className="bg-white dark:bg-secondary-800/90 backdrop-blur-xl rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-white/40 p-6">
          {loadingFiles || loadingDossiers ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-secondary-600 dark:text-secondary-300 font-medium">
                  {loadingDossiers ? 'Chargement des dossiers...' : 'Chargement des fichiers...'}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <ExclamationCircleIcon className="h-16 w-16 text-red-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                {error.includes('Session expirée') ? 'Session expirée' : 'Erreur de chargement'}
              </h3>
              <p className="text-error-600 mb-6">{error}</p>
              
              {error.includes('Session expirée') ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      // Rediriger vers la page de connexion
                      window.location.href = '/login';
                    }}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-3"
                  >
                    🔑 Se reconnecter
                  </button>
                  <button
                    onClick={() => {
                      setError('');
                      loadDossiers();
                    }}
                    className="inline-flex items-center px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                  >
                    <RefreshIcon className="h-4 w-4 mr-2" />
                    Réessayer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    loadDossiers();
                    if (selectedDossier) {
                      loadFiles(selectedDossier);
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
                >
                  <RefreshIcon className="h-4 w-4 mr-2" />
                  Réessayer
                </button>
              )}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Aucun fichier trouvé</h3>
              <p className="text-secondary-600 dark:text-secondary-300 mb-6">
                {selectedDossier 
                  ? 'Ce dossier ne contient aucun fichier.'
                  : dossiers.length === 0
                  ? 'Aucun dossier trouvé dans la base de données.'
                  : 'Aucun fichier trouvé dans les dossiers disponibles.'
                }
              </p>
              
              {selectedDossier && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                  Ajouter des fichiers
                </button>
              )}
            </div>
          ) : (
            <FileGrid 
              files={filteredFiles}
              selectedFiles={selectedFiles}
              onToggleSelection={toggleFileSelection}
              onDownload={downloadFile}
              onPreview={setPreviewFile}
              viewMode={viewMode}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          )}
        </div>

        {/* Statistiques en bas */}
        {filteredFiles.length > 0 && (
          <div className="mt-6 bg-white dark:bg-secondary-800/70 backdrop-blur-xl rounded-xl shadow-md dark:shadow-secondary-900/20 border border-white/40 p-4">
            <div className="flex items-center justify-between text-sm text-secondary-600 dark:text-secondary-300">
              <div className="flex items-center space-x-6">
                <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                  <span className="font-medium text-blue-700 dark:text-blue-300">📊 {filteredFiles.length} fichier(s) affiché(s)</span>
                </div>
                <div className="flex items-center bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">
                  <span className="font-medium text-green-700 dark:text-green-300">📦 {formatFileSize(filteredFiles.reduce((sum, f) => sum + (f.size || f.taille || 0), 0))} total</span>
                </div>
                <div className="flex items-center bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full">
                  <span className="font-medium text-purple-700 dark:text-purple-300">🏢 {dossiers.length} dossier(s)</span>
                </div>
                {selectedFiles.length > 0 && (
                  <div className="flex items-center bg-orange-50 dark:bg-orange-900/30 px-3 py-1 rounded-full">
                    <span className="font-medium text-orange-700 dark:text-orange-300">✅ {selectedFiles.length} sélectionné(s)</span>
                  </div>
                )}
              </div>
              
              <span className="text-xs bg-gray-50 dark:bg-gray-900/30 px-2 py-1 rounded">Dernière maj: {new Date().toLocaleTimeString('fr-FR')}</span>
            </div>
          </div>
        )}
      </div>

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
          <div className="bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Supprimer les fichiers ?
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Êtes-vous sûr de vouloir supprimer {selectedFiles.length} fichier(s) sélectionné(s) ? 
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

// Composant pour l'affichage des fichiers
const FileGrid = ({ 
  files, 
  selectedFiles, 
  onToggleSelection, 
  onDownload, 
  onPreview,
  viewMode,
  getFileIcon,
  formatFileSize,
  formatDate 
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            selected={selectedFiles.includes(file.id)}
            onSelect={() => onToggleSelection(file.id)}
            onDownload={() => onDownload(file)}
            onPreview={() => onPreview(file)}
            getFileIcon={getFileIcon}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          selected={selectedFiles.includes(file.id)}
          onSelect={() => onToggleSelection(file.id)}
          onDownload={() => onDownload(file)}
          onPreview={() => onPreview(file)}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
};

// Composant carte de fichier
const FileCard = ({ file, selected, onSelect, onDownload, onPreview, getFileIcon, formatFileSize, formatDate }) => {
  const IconComponent = getFileIcon(file.mimetype || file.type);
  const fileName = file.original_filename || file.nom || file.name || 'Fichier sans nom';
  const fileSize = file.size || file.taille || 0;
  const fileDate = file.uploaded_at || file.created_at || new Date().toISOString();
  const uploader = file.uploaded_by_name || file.uploader_name || 'Inconnu';
  
  return (
    <div className={`
      relative group bg-white dark:bg-secondary-800 rounded-xl border-2 p-4 transition-all cursor-pointer
      ${selected ? 'border-blue-500 bg-blue-50' : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300 dark:border-secondary-600 hover:shadow-md dark:shadow-secondary-900/20'}
    `}>
      <div className="absolute top-2 left-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-secondary-300 dark:border-secondary-600 text-blue-600 focus:ring-blue-500"
        />
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Prévisualiser"
        >
          <EyeIcon className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="p-1 bg-success-600 text-white rounded hover:bg-success-700"
          title="Télécharger"
        >
          <ArrowDownTrayIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="flex justify-center mb-3 mt-4">
        <IconComponent className="h-10 w-10 text-gray-400" />
      </div>

      <div className="text-center">
        <h4 className="text-sm font-semibold text-secondary-900 dark:text-white truncate mb-2" title={fileName}>
          {fileName}
        </h4>
        
        <div className="flex justify-between items-center text-xs text-secondary-500 dark:text-secondary-400 mb-2">
          <span>{formatFileSize(fileSize)}</span>
          <span>{formatDate(fileDate).split(' ')[0]}</span>
        </div>
        
        <div className="text-xs text-blue-600 truncate" title={uploader}>
          Par {uploader}
        </div>
        
        {file.dossier && (
          <div className="mt-2 text-xs text-secondary-500 dark:text-secondary-400 truncate" title={file.dossier.client_nom}>
            📁 {file.dossier.client_nom}
          </div>
        )}
      </div>
    </div>
  );
};

// Composant ligne de fichier pour la vue liste
const FileRow = ({ file, selected, onSelect, onDownload, onPreview, getFileIcon, formatFileSize, formatDate }) => {
  const IconComponent = getFileIcon(file.mimetype || file.type);
  const fileName = file.original_filename || file.nom || file.name || 'Fichier sans nom';
  const fileSize = file.size || file.taille || 0;
  const fileDate = file.uploaded_at || file.created_at || new Date().toISOString();
  const uploader = file.uploaded_by_name || file.uploader_name || 'Inconnu';
  
  return (
    <div className={`
      flex items-center p-3 rounded-lg border transition-all
      ${selected ? 'border-blue-500 bg-blue-50' : 'border-secondary-200 hover:bg-secondary-50 dark:bg-secondary-900'}
    `}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="rounded border-secondary-300 dark:border-secondary-600 text-blue-600 focus:ring-blue-500 mr-3"
      />
      
      <IconComponent className="h-6 w-6 text-gray-400 mr-3" />
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-secondary-900 dark:text-white truncate">{fileName}</div>
        <div className="text-sm text-secondary-500 dark:text-secondary-400 truncate">
          Par {uploader}
          {file.dossier && <span> • 📁 {file.dossier.client_nom}</span>}
        </div>
      </div>
      
      <div className="text-sm text-secondary-500 dark:text-secondary-400 mr-4">
        {formatFileSize(fileSize)}
      </div>
      
      <div className="text-sm text-secondary-500 dark:text-secondary-400 mr-4">
        {formatDate(fileDate)}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => onPreview()}
          className="p-2 text-blue-600 hover:text-blue-800"
          title="Prévisualiser"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDownload()}
          className="p-2 text-success-600 hover:text-green-800"
          title="Télécharger"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// PropTypes
FileManager.propTypes = {};

FileGrid.propTypes = {
  files: PropTypes.array.isRequired,
  selectedFiles: PropTypes.array.isRequired,
  onToggleSelection: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  viewMode: PropTypes.string.isRequired,
  getFileIcon: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired
};

FileCard.propTypes = {
  file: PropTypes.object.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
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
  getFileIcon: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired
};

export default FileManager;