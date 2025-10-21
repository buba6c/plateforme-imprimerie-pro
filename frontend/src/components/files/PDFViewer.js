import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Configuration de PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({
  file,
  isOpen,
  onClose,
  onDownload,
  maxWidth = '100%',
  maxHeight = '80vh',
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback(error => {
    console.error('Erreur chargement PDF:', error);
    setError('Erreur lors du chargement du PDF');
    setLoading(false);
  }, []);

  const changePage = useCallback(
    offset => {
      setPageNumber(prevPageNumber => {
        const newPageNumber = prevPageNumber + offset;
        return Math.min(Math.max(newPageNumber, 1), numPages || 1);
      });
    },
    [numPages]
  );

  const previousPage = useCallback(() => changePage(-1), [changePage]);
  const nextPage = useCallback(() => changePage(1), [changePage]);

  const zoomIn = useCallback(() => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3.0));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  }, []);

  const rotate = useCallback(() => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  }, []);

  const resetView = useCallback(() => {
    setScale(1.0);
    setRotation(0);
    setPageNumber(1);
  }, []);

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-white dark:bg-neutral-800 shadow-lg border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Info fichier */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white truncate max-w-md">
              {file.original_filename}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {file.size && `${(file.size / 1024 / 1024).toFixed(2)} MB`}
            </p>
          </div>
        </div>

        {/* Contrôles */}
        <div className="flex items-center space-x-3">
          {/* Navigation pages */}
          {numPages && (
            <div className="flex items-center space-x-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-1">
              <button
                onClick={previousPage}
                disabled={pageNumber <= 1}
                className="p-1 text-neutral-600 hover:text-neutral-900 dark:text-white disabled:text-gray-300"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>

              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 min-w-[60px] text-center">
                {pageNumber} / {numPages}
              </span>

              <button
                onClick={nextPage}
                disabled={pageNumber >= numPages}
                className="p-1 text-neutral-600 hover:text-neutral-900 dark:text-white disabled:text-gray-300"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Contrôles zoom */}
          <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-2 py-1">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="p-1 text-neutral-600 hover:text-neutral-900 dark:text-white disabled:text-gray-300"
              title="Zoom arrière"
            >
              <MagnifyingGlassMinusIcon className="h-4 w-4" />
            </button>

            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="p-1 text-neutral-600 hover:text-neutral-900 dark:text-white disabled:text-gray-300"
              title="Zoom avant"
            >
              <MagnifyingGlassPlusIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Rotation */}
          <button
            onClick={rotate}
            className="p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 dark:bg-neutral-800 rounded-lg"
            title="Rotation 90°"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>

          {/* Reset */}
          <button
            onClick={resetView}
            className="px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 dark:bg-neutral-800 rounded-lg"
            title="Remettre à zéro"
          >
            Reset
          </button>

          {/* Télécharger */}
          {onDownload && (
            <button
              onClick={() => onDownload(file)}
              className="p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 dark:bg-neutral-800 rounded-lg"
              title="Télécharger"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          )}

          {/* Fermer */}
          <button
            onClick={onClose}
            className="p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 dark:bg-neutral-800 rounded-lg"
            title="Fermer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Contenu PDF */}
      <div className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center p-4">
        {loading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-300">Chargement du PDF...</p>
          </div>
        )}

        {error && (
          <div className="text-center">
            <div className="bg-error-100 border border-red-400 text-error-700 px-4 py-3 rounded">
              <p>{error}</p>
              <button
                onClick={onClose}
                className="mt-2 bg-error-500 hover:bg-error-700 text-white font-bold py-2 px-4 rounded"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white dark:bg-neutral-800 shadow-lg dark:shadow-secondary-900/25" style={{ maxWidth, maxHeight }}>
            <Document
              file={`/api/files/download/${file.id}`}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              }
              error={
                <div className="p-8 text-center text-error-600">
                  <p>Erreur de chargement du PDF</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div className="flex items-center justify-center h-96 w-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                }
              />
            </Document>
          </div>
        )}
      </div>

      {/* Footer avec info */}
      <div className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-300">
          <div className="flex items-center space-x-4">
            <span>Format: PDF</span>
            {file.created_at && (
              <span>Créé le: {new Date(file.created_at).toLocaleDateString('fr-FR')}</span>
            )}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Utilisez la molette de votre souris pour zoomer
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
