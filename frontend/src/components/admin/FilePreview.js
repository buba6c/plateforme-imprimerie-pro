/**
 * PRÉVISUALISATION DE FICHIERS AVANCÉE
 * ===================================
 * 
 * Composant pour prévisualiser différents types de fichiers
 * - PDF : Affichage avec PDF.js
 * - Images : Zoom et rotation
 * - Texte : Affichage formaté
 * - Autres : Informations détaillées
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { apiCallWithAuth } from '../../utils/authUtils';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  DocumentIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const FilePreview = ({ file, onClose, onDownload }) => {
  const [previewContent, setPreviewContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const fileName = file.original_filename || file.nom || file.name || 'Fichier';
  const fileType = file.mimetype || file.type || '';
  const fileSize = file.size || file.taille || 0;
  const uploadDate = file.uploaded_at || file.created_at || new Date().toISOString();
  const uploader = file.uploaded_by_name || file.uploader_name || 'Inconnu';

  // Fonction pour formater la taille
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Fonction pour formater la date
  const formatDate = (dateString) => {
    // eslint-disable-next-line no-undef
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  // Déterminer le type de prévisualisation
  const getPreviewType = () => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    const textTypes = ['text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml'];
    
    // Vérifier d'abord par extension si le mimetype n'est pas fiable
    const extension = fileName.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      return 'image';
    }
    
    if (imageTypes.some(type => fileType === type || fileType.startsWith('image/'))) return 'image';
    if (fileType === 'application/pdf') return 'pdf';
    if (textTypes.some(type => fileType === type) || fileType.startsWith('text/')) return 'text';
    if (fileType.includes('word') || fileType.includes('document')) return 'document';
    return 'unknown';
  };

  const previewType = getPreviewType();

  // Charger le contenu de prévisualisation
  const loadPreviewContent = async () => {
    setLoading(true);
    setError('');
    
    console.log('🔍 Chargement prévisualisation:', {
      fileId: file.id,
      fileName,
      fileType,
      previewType,
      fileSize
    });
    
    try {
      // Pour les images, essayons directement le téléchargement si c'est petit
      if (previewType === 'image' && fileSize < 10 * 1024 * 1024) { // 10MB max pour images
        console.log('📸 Tentative prévisualisation image directe...');
        const fullResponse = await apiCallWithAuth(`/api/files/${file.id}/download`);
        if (fullResponse.ok) {
          const blob = await fullResponse.blob();
          const imageUrl = URL.createObjectURL(blob);
          setPreviewContent({ type: 'image', url: imageUrl });
          console.log('✅ Image chargée avec succès');
          return;
        }
      }
      
      // Essayer l'endpoint de prévisualisation dédié
      console.log('🔍 Tentative endpoint /preview...');
      const response = await apiCallWithAuth(`/api/files/${file.id}/preview`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        console.log('⚠️ Endpoint /preview échoué, tentative fallback...');
        // Fallback : essayer de télécharger le fichier complet pour petits fichiers
        if (fileSize < 5 * 1024 * 1024) { // 5MB max pour prévisualisation
          const fullResponse = await apiCallWithAuth(`/api/files/${file.id}/download`);
          if (fullResponse.ok) {
            const blob = await fullResponse.blob();
            
            if (previewType === 'image') {
              const imageUrl = URL.createObjectURL(blob);
              setPreviewContent({ type: 'image', url: imageUrl });
            } else if (previewType === 'text') {
              const text = await blob.text();
              setPreviewContent({ type: 'text', content: text });
            } else if (previewType === 'pdf') {
              const pdfUrl = URL.createObjectURL(blob);
              setPreviewContent({ type: 'pdf', url: pdfUrl });
            }
            return;
          }
        }
        
        throw new Error('Prévisualisation non disponible');
      }
      
      // Traitement de la réponse de prévisualisation
      if (previewType === 'image') {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setPreviewContent({ type: 'image', url: imageUrl });
      } else if (previewType === 'text') {
        const text = await response.text();
        setPreviewContent({ type: 'text', content: text });
      } else if (previewType === 'pdf') {
        const blob = await response.blob();
        const pdfUrl = URL.createObjectURL(blob);
        setPreviewContent({ type: 'pdf', url: pdfUrl });
      }
      
    } catch (err) {
      console.error('Erreur prévisualisation:', err);
      setError('Impossible de charger la prévisualisation. Le fichier sera disponible au téléchargement.');
    } finally {
      setLoading(false);
    }
  };

  // Contrôles de zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleResetZoom = () => setZoom(1);
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // Charger la prévisualisation au montage
  useEffect(() => {
    if (previewType !== 'unknown') {
      loadPreviewContent();
    }
    
    return () => {
      // Nettoyer les URLs d'objets
      if (previewContent?.url) {
        URL.revokeObjectURL(previewContent.url);
      }
    };
  }, [file.id]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-6xl max-h-[90vh] w-full overflow-hidden flex flex-col">
        
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white truncate flex items-center">
              <EyeIcon className="h-5 w-5 mr-2 text-blue-600" />
              Prévisualisation
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 truncate mt-1" title={fileName}>
              {fileName}
            </p>
          </div>
          
          {/* Contrôles */}
          <div className="flex items-center gap-2 ml-4">
            {(previewType === 'image' || previewType === 'pdf') && previewContent && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
                  title="Zoom arrière"
                >
                  <MagnifyingGlassMinusIcon className="h-4 w-4" />
                </button>
                
                <span className="text-sm text-neutral-600 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded min-w-[60px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
                  title="Zoom avant"
                >
                  <MagnifyingGlassPlusIcon className="h-4 w-4" />
                </button>
                
                {previewType === 'image' && (
                  <button
                    onClick={handleRotate}
                    className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
                    title="Rotation"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                  </button>
                )}
                
                <div className="w-px h-6 bg-neutral-300 mx-2"></div>
              </>
            )}
            
            <button
              onClick={() => onDownload && onDownload()}
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
              title="Télécharger"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
              title="Fermer"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Zone de prévisualisation */}
          <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900 overflow-auto">
            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-neutral-600 dark:text-neutral-300">Chargement de la prévisualisation...</p>
              </div>
            ) : error ? (
              <div className="text-center max-w-md">
                <DocumentIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Prévisualisation indisponible</h4>
                <p className="text-neutral-600 dark:text-neutral-300 mb-6">{error}</p>
                
                <button
                  onClick={() => onDownload && onDownload()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Télécharger le fichier
                </button>
              </div>
            ) : previewContent ? (
              <div className="w-full h-full flex items-center justify-center">
                {/* Prévisualisation d'image */}
                {previewContent.type === 'image' && (
                  <img
                    src={previewContent.url}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`
                    }}
                    onLoad={() => console.log('Image chargée')}
                    onError={() => setError('Erreur lors du chargement de l\'image')}
                  />
                )}
                
                {/* Prévisualisation PDF */}
                {previewContent.type === 'pdf' && (
                  <iframe
                    src={previewContent.url}
                    className="w-full h-full border-0 rounded-lg"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                    title={`PDF: ${fileName}`}
                  />
                )}
                
                {/* Prévisualisation de texte */}
                {previewContent.type === 'text' && (
                  <div className="w-full h-full overflow-auto">
                    <pre 
                      className="text-sm text-neutral-800 whitespace-pre-wrap p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 font-mono"
                      style={{ fontSize: `${zoom}rem` }}
                    >
                      {previewContent.content}
                    </pre>
                  </div>
                )}
              </div>
            ) : previewType === 'unknown' ? (
              <div className="text-center max-w-md">
                <DocumentIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Type de fichier non supporté</h4>
                <p className="text-neutral-600 dark:text-neutral-300 mb-6">
                  La prévisualisation n&apos;est pas disponible pour ce type de fichier ({fileType}).
                </p>
                
                <button
                  onClick={() => onDownload && onDownload()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Télécharger le fichier
                </button>
              </div>
            ) : null}
          </div>

          {/* Panneau d'informations */}
          <div className="w-80 border-l border-neutral-200 bg-white dark:bg-neutral-800 p-6 overflow-y-auto">
            <h4 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Informations du fichier</h4>
            
            <div className="space-y-4">
              {/* Nom du fichier */}
              <div>
                <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Nom</label>
                <p className="text-sm text-neutral-900 dark:text-white break-words">{fileName}</p>
              </div>
              
              {/* Type de fichier */}
              <div>
                <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Type</label>
                <p className="text-sm text-neutral-900 dark:text-white">{fileType || 'Inconnu'}</p>
              </div>
              
              {/* Taille */}
              <div>
                <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Taille</label>
                <p className="text-sm text-neutral-900 dark:text-white">{formatFileSize(fileSize)}</p>
              </div>
              
              {/* Date d'upload */}
              <div>
                <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Uploadé le</label>
                <p className="text-sm text-neutral-900 dark:text-white">{formatDate(uploadDate)}</p>
              </div>
              
              {/* Utilisateur */}
              <div>
                <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Par</label>
                <p className="text-sm text-neutral-900 dark:text-white">{uploader}</p>
              </div>
              
              {/* Dossier associé */}
              {file.dossier && (
                <div>
                  <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Dossier</label>
                  <div className="text-sm text-neutral-900 dark:text-white">
                    <p className="font-medium">{file.dossier.client_nom}</p>
                    {file.dossier.numero_commande && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">{file.dossier.numero_commande}</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Chemin */}
              {(file.chemin || file.path) && (
                <div>
                  <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Chemin</label>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 break-all font-mono">
                    {file.chemin || file.path}
                  </p>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => onDownload && onDownload()}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Télécharger
              </button>
              
              {previewContent && (
                <button
                  onClick={handleResetZoom}
                  className="w-full mt-2 flex items-center justify-center px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 transition-colors"
                >
                  Réinitialiser la vue
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

FilePreview.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    original_filename: PropTypes.string,
    nom: PropTypes.string,
    name: PropTypes.string,
    mimetype: PropTypes.string,
    type: PropTypes.string,
    size: PropTypes.number,
    taille: PropTypes.number,
    uploaded_at: PropTypes.string,
    created_at: PropTypes.string,
    uploaded_by_name: PropTypes.string,
    uploader_name: PropTypes.string,
    chemin: PropTypes.string,
    path: PropTypes.string,
    dossier: PropTypes.shape({
      client_nom: PropTypes.string,
      numero_commande: PropTypes.string
    })
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onDownload: PropTypes.func
};

export default FilePreview;