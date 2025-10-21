import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  DocumentIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const FileViewerModern = ({ file, isOpen, onClose, onDownload }) => {
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const isImage = file?.type?.startsWith('image/') || file?.mimetype?.startsWith('image/');
  const isPDF = file?.type?.includes('pdf') || file?.mimetype?.includes('pdf');
  const canPreview = isImage || isPDF;

  useEffect(() => {
    if (!isOpen || !file || !canPreview) {
      setPreviewUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Construction de l'URL de prévisualisation
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const url = `${baseUrl}/dossiers/fichiers/${file.id}/preview`;

    // Pour les images, on peut directement utiliser l'URL
    if (isImage) {
      setPreviewUrl(url);
      setIsLoading(false);
    } else if (isPDF) {
      // Pour les PDF, on utilise aussi l'URL directe - le navigateur gère la prévisualisation
      setPreviewUrl(url);
      setIsLoading(false);
    }
  }, [isOpen, file, canPreview, isImage, isPDF]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleResetZoom = () => setZoom(100);

  const handleDownload = () => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Fallback: ouvrir l'URL de téléchargement
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const downloadUrl = `${baseUrl}/dossiers/fichiers/${file.id}/download`;
      window.open(downloadUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  const fileName = file?.original_filename || file?.nom || file?.filename || 'Fichier';
  const fileSize = file?.size || file?.taille || 0;
  const fileType = file?.type || file?.mimetype || 'unknown';

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Taille inconnue';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* En-tête avec contrôles */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              {isImage ? (
                <PhotoIcon className="h-6 w-6 text-white" />
              ) : (
                <DocumentIcon className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {fileName}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {formatFileSize(fileSize)} • {fileType.split('/').pop()?.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {canPreview && (
              <>
                {/* Contrôles de zoom pour les images */}
                {isImage && (
                  <>
                    <button
                      onClick={handleZoomOut}
                      className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Zoom arrière"
                    >
                      <MagnifyingGlassMinusIcon className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300 min-w-[3rem] text-center">
                      {zoom}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Zoom avant"
                    >
                      <MagnifyingGlassPlusIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Taille réelle"
                    >
                      <ArrowsPointingOutIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
              </>
            )}

            {/* Bouton télécharger */}
            <button
              onClick={handleDownload}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>Télécharger</span>
            </button>

            {/* Bouton fermer */}
            <button
              onClick={onClose}
              className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Zone de contenu */}
        <div className="flex-1 overflow-hidden bg-neutral-50 dark:bg-neutral-800">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-neutral-600 dark:text-neutral-300">Chargement de la prévisualisation...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <EyeIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                  Impossible d'afficher le fichier
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">{error}</p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Télécharger le fichier
                </button>
              </div>
            </div>
          ) : !canPreview ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="h-16 w-16 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DocumentIcon className="h-8 w-8 text-neutral-600 dark:text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                  Prévisualisation non disponible
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  Ce type de fichier ne peut pas être prévisualisé dans le navigateur.
                </p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Télécharger pour ouvrir</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto p-4">
              {isImage ? (
                <div className="flex justify-center items-start min-h-full">
                  <img
                    src={previewUrl}
                    alt={fileName}
                    style={{ transform: `scale(${zoom / 100})` }}
                    className="max-w-none shadow-lg rounded-lg transition-transform duration-200"
                    onError={() => setError('Impossible de charger l\'image')}
                  />
                </div>
              ) : isPDF ? (
                <div className="h-full w-full">
                  <iframe
                    src={previewUrl}
                    title={fileName}
                    className="w-full h-full border-0 rounded-lg shadow-lg"
                    onError={() => setError('Impossible de charger le PDF')}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Pied de page avec informations */}
        <div className="p-4 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
            <span>📎 {fileName}</span>
            <span>{formatFileSize(fileSize)} • {fileType}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileViewerModern;