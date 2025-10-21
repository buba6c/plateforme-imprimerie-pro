import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  DocumentIcon,
  PhotoIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  FolderIcon,
  CalendarIcon,
  UserIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useFiles, useFileDownload, useFileStats } from '../../hooks/useFiles';
import { DossierIdResolver } from '../../services/dossierIdResolver';
import { errorHandler } from '../../services/errorHandlerService';

const FileManagerImproved = ({ 
  dossier, 
  onUpload, 
  onFileSelect,
  allowDelete = false,
  allowDownload = true,
  showStats = true 
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Hooks pour la gestion des fichiers
  const dossierId = DossierIdResolver.resolve(dossier);
  const { files, loading, error, lastUpdate, refresh } = useFiles(dossier);
  const { downloadFile, downloading } = useFileDownload();
  const { formatFileSize } = useFileStats(files);

  // Informations sur le dossier
  const dossierDisplay = dossier?.numero_commande || dossier?.nom || dossierId;

  // Filtrage et tri des fichiers
  const filteredAndSortedFiles = React.useMemo(() => {
    let filtered = files;

    // Filtrage par terme de recherche
    if (searchTerm) {
      filtered = files.filter(file =>
        file.original_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.uploader_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tri
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Gestion des dates
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }
      
      // Gestion des tailles
      if (sortBy === 'size') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      // Gestion des strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [files, searchTerm, sortBy, sortOrder]);

  // Statistiques
  const stats = useFileStats(files).stats;

  const handleDownload = async (file) => {
    if (!allowDownload) return;
    
    try {
      await downloadFile(file.id, file.original_filename);
    } catch (error) {
      alert(errorHandler.formatErrorMessage(error));
    }
  };

  const handleDelete = async (file) => {
    if (!allowDelete) return;
    
    if (!confirm(`Supprimer le fichier "${file.original_filename}" ?`)) {
      return;
    }

    try {
      // La suppression sera gérée par le service de fichiers
      // qui mettra à jour automatiquement la liste via WebSocket
      alert('Fonction de suppression à implémenter');
    } catch (error) {
      alert(errorHandler.formatErrorMessage(error));
    }
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileTypeDisplay = (mimetype) => {
    if (!mimetype) return 'Inconnu';
    
    const typeMap = {
      'application/pdf': 'PDF',
      'image/png': 'PNG',
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPG',
      'image/gif': 'GIF',
      'image/svg+xml': 'SVG',
      'application/postscript': 'AI',
      'application/zip': 'ZIP',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX'
    };
    
    return typeMap[mimetype] || mimetype.split('/')[1]?.toUpperCase() || 'Fichier';
  };

  if (!dossierId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 mr-2" />
          <span className="text-yellow-700">Dossier non spécifié pour la gestion des fichiers</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
      
      {/* En-tête avec informations du dossier */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
              <FolderIcon className="h-5 w-5 mr-2 text-blue-600" />
              Fichiers du dossier
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
              {dossierDisplay}
              {dossier?.statut && (
                <span className="ml-2 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded text-xs">
                  {dossier.statut}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {lastUpdate && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Mis à jour: {formatDate(lastUpdate)}
              </span>
            )}
            
            <button
              onClick={refresh}
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-800 rounded"
              title="Actualiser"
            >
              🔄
            </button>
            
            {onUpload && (
              <button
                onClick={() => onUpload(dossier)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                + Ajouter
              </button>
            )}
          </div>
        </div>

        {/* Statistiques */}
        {showStats && files.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="text-lg font-semibold text-blue-600">{stats.total}</div>
              <div className="text-xs text-blue-800">Fichiers</div>
            </div>
            <div className="text-center p-2 bg-success-50 rounded">
              <div className="text-lg font-semibold text-success-600">
                {formatFileSize(stats.totalSize)}
              </div>
              <div className="text-xs text-green-800">Taille</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded">
              <div className="text-lg font-semibold text-purple-600">{stats.recent}</div>
              <div className="text-xs text-purple-800">Récents</div>
            </div>
            <div className="text-center p-2 bg-neutral-50 dark:bg-neutral-900 rounded">
              <div className="text-lg font-semibold text-neutral-600 dark:text-neutral-300">
                {Object.keys(stats.byType).length}
              </div>
              <div className="text-xs text-neutral-800 dark:text-neutral-100">Types</div>
            </div>
          </div>
        )}

        {/* Barre de recherche et tri */}
        {files.length > 0 && (
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un fichier..."
                  className="w-full pl-9 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <select
              className="border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('_');
                setSortBy(field);
                setSortOrder(order);
              }}
            >
              <option value="created_at_desc">Plus récent</option>
              <option value="created_at_asc">Plus ancien</option>
              <option value="original_filename_asc">Nom A-Z</option>
              <option value="original_filename_desc">Nom Z-A</option>
              <option value="size_desc">Plus volumineux</option>
              <option value="size_asc">Plus petit</option>
            </select>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-neutral-600 dark:text-neutral-300">Chargement des fichiers...</span>
          </div>
        )}

        {error && (
          <div className="bg-error-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-error-500 mr-2" />
              <span className="text-error-700">{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="text-center py-8">
            <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Aucun fichier</h4>
            <p className="text-neutral-600 dark:text-neutral-300 mb-4">
              Ce dossier ne contient aucun fichier pour le moment.
            </p>
            {onUpload && (
              <button
                onClick={() => onUpload(dossier)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ajouter des fichiers
              </button>
            )}
          </div>
        )}

        {!loading && !error && filteredAndSortedFiles.length === 0 && files.length > 0 && (
          <div className="text-center py-8">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Aucun résultat</h4>
            <p className="text-neutral-600 dark:text-neutral-300">
              Aucun fichier ne correspond à votre recherche &quot;{searchTerm}&quot;
            </p>
          </div>
        )}

        {!loading && !error && filteredAndSortedFiles.length > 0 && (
          <div className="space-y-2">
            {filteredAndSortedFiles.map((file) => {
              const isImage = file.mimetype?.startsWith('image/');
              const IconComponent = isImage ? PhotoIcon : DocumentIcon;
              const isSelected = selectedFile?.id === file.id;
              
              return (
                <div
                  key={file.id}
                  className={`
                    flex items-center p-3 rounded-lg border transition-all cursor-pointer
                    ${isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-900'
                    }
                  `}
                  onClick={() => handleFileClick(file)}
                >
                  <div className="flex-shrink-0 mr-3">
                    <IconComponent className="h-8 w-8 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {file.original_filename}
                        </p>
                        <div className="flex items-center mt-1 text-xs text-neutral-500 dark:text-neutral-400 space-x-4">
                          <span className="flex items-center">
                            <span className="font-medium">{getFileTypeDisplay(file.mimetype)}</span>
                          </span>
                          <span>{formatFileSize(file.size)}</span>
                          {file.created_at && (
                            <span className="flex items-center">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {formatDate(file.created_at)}
                            </span>
                          )}
                          {file.uploader_name && (
                            <span className="flex items-center">
                              <UserIcon className="h-3 w-3 mr-1" />
                              {file.uploader_name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-1 ml-2">
                        {isImage && (
                          <button
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Prévisualiser"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        {allowDownload && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            disabled={downloading}
                            className="p-1 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded disabled:opacity-50"
                            title="Télécharger"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        {allowDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file);
                            }}
                            className="p-1 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded"
                            title="Supprimer"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Informations sur le fichier sélectionné */}
        {selectedFile && (
          <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
            <h4 className="font-medium text-neutral-900 dark:text-white mb-2 flex items-center">
              <InformationCircleIcon className="h-4 w-4 mr-2" />
              Détails du fichier
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Nom:</span>
                <div className="text-neutral-600 dark:text-neutral-300">{selectedFile.original_filename}</div>
              </div>
              <div>
                <span className="font-medium">Type:</span>
                <div className="text-neutral-600 dark:text-neutral-300">{getFileTypeDisplay(selectedFile.mimetype)}</div>
              </div>
              <div>
                <span className="font-medium">Taille:</span>
                <div className="text-neutral-600 dark:text-neutral-300">{formatFileSize(selectedFile.size)}</div>
              </div>
              <div>
                <span className="font-medium">Uploadé le:</span>
                <div className="text-neutral-600 dark:text-neutral-300">{formatDate(selectedFile.created_at)}</div>
              </div>
              {selectedFile.uploader_name && (
                <div>
                  <span className="font-medium">Par:</span>
                  <div className="text-neutral-600 dark:text-neutral-300">{selectedFile.uploader_name}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

FileManagerImproved.propTypes = {
  dossier: PropTypes.object.isRequired,
  onUpload: PropTypes.func,
  onFileSelect: PropTypes.func,
  allowDelete: PropTypes.bool,
  allowDownload: PropTypes.bool,
  showStats: PropTypes.bool
};

export default FileManagerImproved;