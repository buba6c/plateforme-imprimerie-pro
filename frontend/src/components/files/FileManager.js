import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  DocumentIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  XMarkIcon,
  ClockIcon,
  UserIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import PDFViewer from './PDFViewer';

const FileManager = ({
  dossierId,
  files = [],
  onFileDelete,
  onFileDownload,
  onMarkForReprint,
  currentUser,
  canDelete = false,
  canDownload = true,
  canMarkReprint = false,
  showDetails = true,
  loading = false,
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'name', 'size', 'type'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [filterType, setFilterType] = useState('all'); // 'all', 'image', 'pdf', 'document', 'archive'

  // Fonction pour obtenir l'icône selon le type de fichier
  const getFileIcon = (mimeType, size = 'h-6 w-6') => {
    const iconClasses = `${size} text-neutral-500`;

    // Protection contre les valeurs undefined/null
    const safeMimeType = mimeType || 'application/octet-stream';

    if (safeMimeType.startsWith('image/')) {
      return <PhotoIcon className={iconClasses} />;
    } else if (safeMimeType === 'application/pdf') {
      return <DocumentTextIcon className={iconClasses} />;
    } else if (safeMimeType.includes('zip') || safeMimeType.includes('rar')) {
      return <ArchiveBoxIcon className={iconClasses} />;
    } else {
      return <DocumentIcon className={iconClasses} />;
    }
  };

  // Fonction pour formater la taille des fichiers
  const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Fonction pour formater la date
  const formatDate = dateString => {
    // Vérifier si la date est valide
    if (!dateString || dateString === '' || dateString === null || dateString === undefined) {
      return 'Date inconnue';
    }

    const date = new Date(dateString);
    // Vérifier si la date créée est valide
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }

    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Obtenir la catégorie d'un fichier
  const getFileCategory = mimeType => {
    if (mimeType?.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    return 'document';
  };

  // Filtrer les fichiers
  const filteredFiles = files.filter(file => {
    if (filterType === 'all') return true;
    return getFileCategory(file.mimetype) === filterType;
  });

  // Trier les fichiers
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.original_filename.localeCompare(b.original_filename);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'type':
        comparison = a.mimetype.localeCompare(b.mimetype);
        break;
      case 'date':
      default:
        comparison = new Date(a.created_at) - new Date(b.created_at);
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Gérer la prévisualisation
  const handlePreview = file => {
    setSelectedFile(file);
    if (file.mimetype === 'application/pdf') {
      setPdfViewerOpen(true);
    } else {
      setPreviewOpen(true);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPdfViewerOpen(false);
    setSelectedFile(null);
  };

  // Gérer le téléchargement
  const handleDownload = file => {
    if (onFileDownload) {
      onFileDownload(file);
    }
  };

  // Gérer la suppression
  const handleDelete = file => {
    if (
      window.confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${file.original_filename}" ?`)
    ) {
      if (onFileDelete) {
        onFileDelete(file.id);
      }
    }
  };

  // Gérer le marquage pour réimpression
  const handleMarkForReprint = file => {
    if (
      window.confirm(
        `Marquer ce dossier comme "à réimprimer" à partir du fichier "${file.original_filename}" ?`
      )
    ) {
      if (onMarkForReprint) {
        onMarkForReprint(file);
      }
    }
  };

  // Modifier le tri
  const handleSort = field => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
        <span className="ml-3 text-neutral-600 dark:text-neutral-300">Chargement des fichiers...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-neutral-300" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900 dark:text-white">Aucun fichier</h3>
        <p className="mt-2 text-neutral-500">
          Aucun fichier n&apos;a été attaché à ce dossier pour le moment.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header avec filtres et tri */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Fichiers ({sortedFiles.length})
            </h3>

            {/* Filtre par type */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-sm border border-neutral-300 rounded-md px-3 py-1 bg-white dark:bg-neutral-800"
            >
              <option value="all">Tous les types</option>
              <option value="image">Images</option>
              <option value="pdf">PDF</option>
              <option value="document">Documents</option>
              <option value="archive">Archives</option>
            </select>
          </div>

          {/* Options de tri */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">Trier par :</span>
            {['date', 'name', 'size', 'type'].map(field => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`text-sm px-2 py-1 rounded ${
                  sortBy === field
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-white'
                }`}
              >
                {field === 'date' && 'Date'}
                {field === 'name' && 'Nom'}
                {field === 'size' && 'Taille'}
                {field === 'type' && 'Type'}
                {sortBy === field && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des fichiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFiles.map(file => (
            <div
              key={file.id}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow"
            >
              {/* En-tête du fichier */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getFileIcon(file.mimetype, 'h-8 w-8')}
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {file.original_filename}
                    </h4>
                    <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              </div>

              {/* Détails du fichier */}
              {showDetails && (
                <div className="mb-3 space-y-1 text-xs text-neutral-500">
                  <div className="flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    {formatDate(file.created_at)}
                  </div>
                  {file.prenom && file.nom && (
                    <div className="flex items-center">
                      <UserIcon className="h-3 w-3 mr-1" />
                      {file.prenom} {file.nom}
                    </div>
                  )}
                  <div className="text-xs text-neutral-400">{file.mimetype}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  {/* Preview */}
                  {canDownload &&
                    (file.mimetype?.startsWith('image/') ||
                      file.mimetype === 'application/pdf') && (
                      <button
                        onClick={() => handlePreview(file)}
                        className="p-1 text-neutral-400 hover:text-blue-600 transition-colors"
                        title="Prévisualiser"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    )}

                  {/* Download */}
                  {canDownload && (
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-1 text-neutral-400 hover:text-blue-600 transition-colors"
                      title="Télécharger"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  )}

                  {/* Mark for reprint */}
                  {canMarkReprint &&
                    (currentUser?.role === 'admin' || currentUser?.role === 'preparateur') && (
                      <button
                        onClick={() => handleMarkForReprint(file)}
                        className="p-1 text-neutral-400 hover:text-warning-600 transition-colors"
                        title="Marquer à réimprimer"
                      >
                        <PrinterIcon className="h-4 w-4" />
                      </button>
                    )}
                </div>

                {/* Delete */}
                {canDelete &&
                  (currentUser?.role === 'admin' || currentUser?.id === file.uploaded_by) && (
                    <button
                      onClick={() => handleDelete(file)}
                      className="p-1 text-neutral-400 hover:text-danger-600 transition-colors"
                      title="Supprimer"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de prévisualisation */}
      {previewOpen && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-4xl max-h-screen overflow-auto">
            {/* Header de la modal */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {selectedFile.original_filename}
                </h3>
                <p className="text-sm text-neutral-500">
                  {formatFileSize(selectedFile.size)} • {selectedFile.mimetype}
                </p>
              </div>
              <button
                onClick={closePreview}
                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Contenu de la prévisualisation */}
            <div className="p-4">
              {selectedFile.mimetype?.startsWith('image/') ? (
                <img
                  src={`/api/files/download/${selectedFile.id}`}
                  alt={selectedFile.original_filename}
                  className="max-w-full max-h-96 mx-auto"
                  onError={e => {
                    e.target.src = '/placeholder-image.png'; // Image de fallback
                  }}
                />
              ) : (
                <div className="text-center py-12">
                  {getFileIcon(selectedFile.mimetype, 'h-16 w-16')}
                  <p className="mt-4 text-neutral-600 dark:text-neutral-300">
                    Prévisualisation non disponible pour ce type de fichier
                  </p>
                  <button onClick={() => handleDownload(selectedFile)} className="mt-4 btn-primary">
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Télécharger
                  </button>
                </div>
              )}
            </div>

            {/* Footer avec actions */}
            <div className="flex justify-end space-x-3 p-4 border-t border-neutral-200 dark:border-neutral-700">
              <button onClick={closePreview} className="btn-secondary">
                Fermer
              </button>
              <button onClick={() => handleDownload(selectedFile)} className="btn-primary">
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer PDF */}
      <PDFViewer
        file={selectedFile}
        isOpen={pdfViewerOpen}
        onClose={closePreview}
        onDownload={onFileDownload}
      />
    </>
  );
};

FileManager.propTypes = {
  dossierId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  files: PropTypes.arrayOf(PropTypes.object),
  onFileDelete: PropTypes.func,
  onFileDownload: PropTypes.func,
  onMarkForReprint: PropTypes.func,
  currentUser: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    role: PropTypes.string
  }),
  canDelete: PropTypes.bool,
  canDownload: PropTypes.bool,
  canMarkReprint: PropTypes.bool,
  showDetails: PropTypes.bool,
  loading: PropTypes.bool
};

export default FileManager;
