import React, { useState, useEffect, useCallback } from 'react';
import {
  DocumentIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FolderOpenIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import filesService from '../../services/filesService';
import PDFViewer from '../files/PDFViewer';

const FilesManagement = ({ user }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // État des filtres et recherche
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    dossier_id: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  // Prévisualisation
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: filters.search || undefined,
        type: filters.type || undefined,
        dossier_id: filters.dossier_id || undefined,
      };

      const response = await filesService.getAllFiles(params);
      setFiles(response.files || []);
      setTotalPages(response.pagination?.total_pages || 1);
      setTotalItems(response.pagination?.total_items || 0);
    } catch (err) {
      console.error('Erreur chargement fichiers:', err);
      setError('Erreur lors du chargement des fichiers');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters.search, filters.type, filters.dossier_id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset à la première page lors du filtrage
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      type: '',
      dossier_id: '',
    });
    setCurrentPage(1);
  };

  const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = mimeType => {
    if (mimeType.startsWith('image/')) {
      return <DocumentIcon className="h-8 w-8 text-success-500" />;
    } else if (mimeType === 'application/pdf') {
      return <DocumentIcon className="h-8 w-8 text-error-500" />;
    } else if (mimeType.includes('zip') || mimeType.includes('rar')) {
      return <DocumentIcon className="h-8 w-8 text-purple-500" />;
    } else {
      return <DocumentIcon className="h-8 w-8 text-blue-500" />;
    }
  };

  const handlePreview = file => {
    setSelectedFile(file);
    if (file.mimetype === 'application/pdf') {
      setPdfViewerOpen(true);
    } else if (file.mimetype.startsWith('image/')) {
      setPreviewOpen(true);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPdfViewerOpen(false);
    setSelectedFile(null);
  };

  const handleDownload = async file => {
    try {
      await filesService.downloadFile(file.id);
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      setError('Erreur lors du téléchargement du fichier');
    }
  };

  const handleDelete = async fileId => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) return;

    try {
      await filesService.deleteFile(fileId);
      setSuccess('Fichier supprimé avec succès');
      loadFiles(); // Recharger la liste
    } catch (err) {
      console.error('Erreur suppression:', err);
      setError(err.error || 'Erreur lors de la suppression du fichier');
    }
  };

  const handleMarkForReprint = async file => {
    if (!window.confirm(`Marquer le dossier associé comme "à réimprimer" ?`)) return;

    try {
      const response = await filesService.markForReprint(file.id);
      setSuccess(`Dossier ${response.dossier_id} marqué à réimprimer`);
    } catch (err) {
      console.error('Erreur marquage réimpression:', err);
      setError(err.error || 'Erreur lors du marquage à réimprimer');
    }
  };

  const navigateToPage = page => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-neutral-600">Chargement...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Gestion des fichiers</h1>
          <p className="text-neutral-600 mt-1">
            Gérez tous les fichiers de la plateforme ({totalItems} fichiers)
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-md p-4 mb-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-400" />
              <div className="ml-3">
                <p className="text-sm text-danger-800">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="ml-auto text-danger-400 hover:text-danger-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-success-50 border border-success-200 rounded-md p-4 mb-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-success-400" />
              <div className="ml-3">
                <p className="text-sm text-success-800">{success}</p>
              </div>
              <button
                onClick={() => setSuccess('')}
                className="ml-auto text-success-400 hover:text-success-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Filtres et recherche */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un fichier ou un utilisateur..."
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className="form-input pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={filters.type}
                  onChange={e => handleFilterChange('type', e.target.value)}
                  className="form-input min-w-[120px]"
                >
                  <option value="">Tous les types</option>
                  <option value="image">Images</option>
                  <option value="application">Documents</option>
                  <option value="application/pdf">PDF</option>
                </select>

                <input
                  type="text"
                  placeholder="ID Dossier"
                  value={filters.dossier_id}
                  onChange={e => handleFilterChange('dossier_id', e.target.value)}
                  className="form-input min-w-[100px]"
                />

                <button onClick={clearFilters} className="btn-secondary flex items-center">
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Effacer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des fichiers */}
        <div className="card">
          <div className="card-body p-0">
            {files.length === 0 ? (
              <div className="text-center py-12">
                <DocumentIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-500">Aucun fichier trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-secondary-200">
                  <thead className="bg-neutral-50 dark:bg-neutral-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Fichier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Dossier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Taille
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Uploadé par
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-800 divide-y divide-secondary-200 dark:divide-secondary-700">
                    {files.map(file => (
                      <tr key={file.id} className="hover:bg-neutral-50 dark:bg-neutral-900">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getFileIcon(file.mimetype)}
                            <div className="ml-3">
                              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                                {file.original_filename}
                              </div>
                              <div className="text-sm text-neutral-500">{file.mimetype}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FolderOpenIcon className="h-4 w-4 text-neutral-400 mr-2" />
                            <span className="text-sm text-neutral-900 dark:text-neutral-100">
                              Dossier #{file.dossier_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-neutral-100">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-neutral-900 dark:text-neutral-100">
                            {file.prenom} {file.nom}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                          {formatDate(file.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {/* Prévisualiser */}
                            {(file.mimetype.startsWith('image/') ||
                              file.mimetype === 'application/pdf') && (
                              <button
                                onClick={() => handlePreview(file)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Prévisualiser"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                            )}

                            {/* Télécharger */}
                            <button
                              onClick={() => handleDownload(file)}
                              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                              title="Télécharger"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </button>

                            {/* Marquer à réimprimer */}
                            <button
                              onClick={() => handleMarkForReprint(file)}
                              className="text-warning-600 hover:text-warning-900"
                              title="Marquer à réimprimer"
                            >
                              <PrinterIcon className="h-4 w-4" />
                            </button>

                            {/* Supprimer */}
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="text-danger-600 hover:text-danger-900"
                              title="Supprimer"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-4 py-3 sm:px-6 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => navigateToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => navigateToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Affichage de{' '}
                  <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, totalItems)}
                  </span>{' '}
                  sur <span className="font-medium">{totalItems}</span> résultats
                </p>
              </div>
              <div>
                <nav
                  className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => navigateToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-neutral-400 dark:text-neutral-300 ring-1 ring-inset ring-secondary-300 dark:ring-secondary-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => navigateToPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        page === currentPage
                          ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
                          : 'text-neutral-900 dark:text-neutral-100 ring-1 ring-inset ring-secondary-300 dark:ring-secondary-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:z-20 focus:outline-offset-0'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => navigateToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-neutral-400 dark:text-neutral-300 ring-1 ring-inset ring-secondary-300 dark:ring-secondary-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de prévisualisation d'image */}
      {previewOpen && selectedFile && selectedFile.mimetype.startsWith('image/') && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-4xl max-h-screen overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {selectedFile.original_filename}
              </h3>
              <button
                onClick={closePreview}
                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 dark:hover:text-neutral-100 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 bg-white dark:bg-neutral-800">
              <img
                src={`/api/files/download/${selectedFile.id}`}
                alt={selectedFile.original_filename}
                className="max-w-full max-h-96 mx-auto"
                onError={e => {
                  e.target.src = '/placeholder-image.png';
                }}
              />
            </div>
            <div className="flex justify-end space-x-3 p-4 border-t border-neutral-200 dark:border-neutral-700">
              <button onClick={closePreview} className="btn-secondary">
                Fermer
              </button>
              <button
                onClick={() => handleDownload(selectedFile)}
                className="btn-primary flex items-center"
              >
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
        onDownload={handleDownload}
      />
    </>
  );
};

export default FilesManagement;
