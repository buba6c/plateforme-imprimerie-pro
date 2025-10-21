import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useHotkeys } from 'react-hotkeys-hook';
import { saveAs } from 'file-saver';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configuration de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const FileViewer = ({ file, isOpen, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileBlob, setFileBlob] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);

  // Déterminer le type de fichier
  const getFileType = (mimeType, filename) => {
    if (mimeType?.includes('pdf')) return 'pdf';
    if (mimeType?.includes('image/')) return 'image';
    if (mimeType?.includes('text/')) return 'text';
    if (mimeType?.includes('video/')) return 'video';
    if (mimeType?.includes('audio/')) return 'audio';

    // Détection par extension
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
    if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return 'text';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio';

    return 'unknown';
  };

  const fileType = getFileType(file?.mimetype || file?.type, file?.nom || file?.filename);

  // Charger le fichier
  useEffect(() => {
    if (!isOpen || !file) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Récupérer le fichier depuis l'API
        const token = localStorage.getItem('auth_token') || localStorage.getItem('auth_token');

        const response = await fetch(`http://localhost:5001/api/files/preview/${file.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${await response.text()}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        setFileBlob(blob);
        setFileUrl(url);
      } catch (err) {
        console.error('Erreur chargement fichier:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFile();

    // Cleanup
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [isOpen, file]);

  // Raccourcis clavier
  useHotkeys('escape', onClose, { enabled: isOpen });
  useHotkeys('left', () => setPageNumber(p => Math.max(1, p - 1)), {
    enabled: isOpen && fileType === 'pdf',
  });
  useHotkeys('right', () => setPageNumber(p => Math.min(numPages || 1, p + 1)), {
    enabled: isOpen && fileType === 'pdf',
  });
  useHotkeys('plus', () => setScale(s => Math.min(3, s + 0.2)), { enabled: isOpen });
  useHotkeys('minus', () => setScale(s => Math.max(0.3, s - 0.2)), { enabled: isOpen });
  useHotkeys('r', () => setRotation(r => (r + 90) % 360), { enabled: isOpen });

  // Gestionnaire PDF
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = error => {
    console.error('Erreur chargement PDF:', error);
    setError('Impossible de charger le PDF');
  };

  // Navigation PDF
  const goToPrevPage = () => setPageNumber(p => Math.max(1, p - 1));
  const goToNextPage = () => setPageNumber(p => Math.min(numPages || 1, p + 1));

  // Contrôles zoom
  const zoomIn = () => setScale(s => Math.min(3, s + 0.2));
  const zoomOut = () => setScale(s => Math.max(0.3, s - 0.2));
  const resetZoom = () => setScale(1.0);

  // Rotation
  const rotateRight = () => setRotation(r => (r + 90) % 360);
  const rotateLeft = () => setRotation(r => (r - 90 + 360) % 360);

  // Téléchargement
  const downloadFile = () => {
    if (fileBlob) {
      saveAs(fileBlob, file.nom || file.filename || 'fichier');
    }
  };

  // Mode plein écran
  const toggleFullscreen = () => {
    const element = document.querySelector('.file-viewer-content');
    if (element) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        element.requestFullscreen();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Barre d'outils supérieure */}
      <div className="bg-neutral-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold truncate max-w-md">
            {file?.nom || file?.filename || 'Fichier'}
          </h3>
          <span className="text-sm text-neutral-400">
            {fileType.toUpperCase()} • {Math.round((fileBlob?.size || 0) / 1024)} KB
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Contrôles PDF */}
          {fileType === 'pdf' && (
            <>
              <button
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded disabled:opacity-50"
                title="Page précédente (←)"
              >
                ←
              </button>
              <span className="px-3 py-2 text-sm">
                {pageNumber} / {numPages || 1}
              </span>
              <button
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded disabled:opacity-50"
                title="Page suivante (→)"
              >
                →
              </button>
              <div className="w-px h-6 bg-neutral-600"></div>
            </>
          )}

          {/* Contrôles zoom */}
          <button
            onClick={zoomOut}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Zoom arrière (-)"
          >
            -
          </button>
          <span className="px-3 py-2 text-sm min-w-16 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Zoom avant (+)"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Réinitialiser zoom"
          >
            100%
          </button>

          <div className="w-px h-6 bg-neutral-600"></div>

          {/* Rotation */}
          <button
            onClick={rotateLeft}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Rotation gauche"
          >
            ↺
          </button>
          <button
            onClick={rotateRight}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Rotation droite (R)"
          >
            ↻
          </button>

          <div className="w-px h-6 bg-neutral-600"></div>

          {/* Actions */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Plein écran"
          >
            ⛶
          </button>
          <button
            onClick={downloadFile}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded"
            title="Télécharger"
          >
            ↓
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-error-600 hover:bg-error-500 rounded"
            title="Fermer (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Zone de contenu */}
      <div className="flex-1 overflow-hidden bg-gray-800">
        <div className="file-viewer-content h-full flex items-center justify-center">
          {loading && (
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Chargement du fichier...</p>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-lg">Erreur de chargement</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          )}

          {!loading && !error && fileUrl && (
            <TransformWrapper initialScale={scale} minScale={0.3} maxScale={3} centerOnInit>
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              >
                {fileType === 'pdf' && (
                  <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    className="flex justify-center"
                  >
                    <Page pageNumber={pageNumber} scale={scale} className="shadow-2xl" />
                  </Document>
                )}

                {fileType === 'image' && (
                  <img
                    src={fileUrl}
                    alt={file?.nom || 'Image'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease',
                    }}
                    className="shadow-2xl"
                  />
                )}

                {fileType === 'text' && (
                  <div
                    className="bg-white dark:bg-neutral-800 text-black p-8 rounded shadow-2xl max-w-4xl max-h-full overflow-auto"
                    style={{
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <iframe
                      src={fileUrl}
                      className="w-full h-96 border-0"
                      title="Contenu du fichier"
                    />
                  </div>
                )}

                {fileType === 'video' && (
                  <video
                    controls
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease',
                    }}
                    className="shadow-2xl"
                  >
                    <source src={fileUrl} type={file?.mimetype || file?.type} />
                    Votre navigateur ne supporte pas la lecture vidéo.
                  </video>
                )}

                {fileType === 'audio' && (
                  <div className="bg-white dark:bg-neutral-800 p-8 rounded shadow-2xl">
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">🎵</div>
                      <h4 className="text-lg font-semibold">{file?.nom || 'Audio'}</h4>
                    </div>
                    <audio
                      controls
                      className="w-full"
                      style={{
                        transform: `scale(${scale})`,
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <source src={fileUrl} type={file?.mimetype || file?.type} />
                      Votre navigateur ne supporte pas la lecture audio.
                    </audio>
                  </div>
                )}

                {fileType === 'unknown' && (
                  <div className="text-white text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg">Type de fichier non supporté</p>
                    <p className="text-sm text-neutral-400 mt-2">
                      {file?.mimetype || 'Type MIME inconnu'}
                    </p>
                    <button
                      onClick={downloadFile}
                      className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded"
                    >
                      Télécharger le fichier
                    </button>
                  </div>
                )}
              </TransformComponent>
            </TransformWrapper>
          )}
        </div>
      </div>

      {/* Barre d'informations inférieure */}
      <div className="bg-neutral-900 text-white p-2 text-xs flex justify-between">
        <div>Raccourcis: Esc (fermer) • ← → (navigation) • + - (zoom) • R (rotation)</div>
        <div>{fileType === 'pdf' && numPages && `${numPages} page${numPages > 1 ? 's' : ''}`}</div>
      </div>
    </div>
  );
};

export default FileViewer;
