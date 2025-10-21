import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  PhotoIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  FolderIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useFileUpload, useFileValidation, useFileStats } from '../../hooks/useFiles';
import { DossierIdResolver } from '../../services/dossierIdResolver';
import { errorHandler } from '../../services/errorHandlerService';

const FileUploadImproved = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  dossier, // Objet dossier complet au lieu de currentPath
  autoClose = true // Fermeture automatique après upload
}) => {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Hooks pour la gestion des fichiers
  const { uploadFiles, uploading, progress, error: uploadError, uploadedFiles, resetUpload } = useFileUpload();
  const { validateFiles, getAcceptedTypes } = useFileValidation();
  const { formatFileSize, getTypeIcon } = useFileStats();

  // Informations sur le dossier
  const dossierId = DossierIdResolver.resolve(dossier);
  const dossierDisplay = dossier?.numero_commande || dossier?.nom || dossierId;

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = useCallback((newFiles) => {
    // Validation des fichiers
    const { valid, errors } = validateFiles(newFiles);
    
    if (!valid) {
      const errorMessage = errors.join('\n');
      alert(`Erreurs de validation:\n${errorMessage}`);
      return;
    }

    // Créer des objets fichiers avec métadonnées
    const filesWithMetadata = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      progress: 0,
      error: null,
      icon: getTypeIcon(file.type)
    }));
    
    setFiles(prev => [...prev, ...filesWithMetadata]);
  }, [validateFiles, getTypeIcon]);

  const removeFile = useCallback((fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    resetUpload();
  }, [resetUpload]);

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    if (!dossier) {
      alert('Dossier non spécifié pour l\'upload');
      return;
    }

    try {
      // Validation des permissions
      const userRole = localStorage.getItem('user_role');
      if (userRole) {
        errorHandler.validateDossierAccess(dossier, 'upload', userRole);
      }

      // Préparer les fichiers pour l'upload
      const filesToUpload = files
        .filter(f => f.status === 'pending')
        .map(f => f.file);
      
      if (filesToUpload.length === 0) {
        alert('Aucun fichier en attente d\'upload');
        return;
      }

      // Mettre à jour le statut des fichiers
      setFiles(prev => prev.map(f => 
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      ));

      // Upload avec progression
      const result = await uploadFiles(dossier, filesToUpload, {
        onProgress: (percent) => {
          // Mettre à jour la progression de tous les fichiers en cours
          setFiles(prev => prev.map(f => 
            f.status === 'uploading' ? { ...f, progress: percent } : f
          ));
        }
      });

      // Marquer les fichiers comme réussis
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { 
          ...f, 
          status: 'success', 
          progress: 100,
          uploadedData: result.find(uploaded => 
            uploaded.original_filename === f.name
          )
        } : f
      ));

      // Callback parent
      if (onUpload) {
        onUpload(result);
      }

      // Fermeture automatique après un délai
      if (autoClose) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }

    } catch (error) {
      console.error('Erreur upload:', error);
      
      // Marquer les fichiers en erreur
      const errorMessage = errorHandler.formatErrorMessage(error);
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { 
          ...f, 
          status: 'error',
          error: errorMessage 
        } : f
      ));
    }
  };

  const handleClose = () => {
    if (!uploading) {
      clearAllFiles();
      onClose();
    }
  };

  // Statistiques des fichiers
  const totalFiles = files.length;
  const successFiles = files.filter(f => f.status === 'success').length;
  const errorFiles = files.filter(f => f.status === 'error').length;
  const pendingFiles = files.filter(f => f.status === 'pending').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        
        {/* En-tête avec informations du dossier */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
              <CloudArrowUpIcon className="h-5 w-5 mr-2 text-blue-600" />
              Upload de fichiers
            </h3>
            <div className="flex items-center mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              <FolderIcon className="h-4 w-4 mr-1" />
              <span>Dossier: {dossierDisplay}</span>
              {dossier?.statut && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                  {dossier.statut}
                </span>
              )}
            </div>
            
            {/* Informations de progression globale */}
            {uploading && (
              <div className="mt-2 flex items-center text-sm">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-blue-600 font-medium">
                    Upload en cours... {progress}%
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {!uploading && (
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Erreur globale d'upload */}
        {uploadError && (
          <div className="mx-6 mt-4 p-3 bg-error-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <ExclamationCircleIcon className="h-5 w-5 text-error-500 mr-2" />
              <span className="text-sm text-error-700">{uploadError}</span>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <div className="p-6">
          {files.length === 0 ? (
            
            /* Zone de drop initiale */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                ${dragOver 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 dark:bg-neutral-900'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudArrowUpIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                Glissez-déposez vos fichiers ici
              </h4>
              <p className="text-neutral-600 dark:text-neutral-300 mb-4">
                ou cliquez pour sélectionner des fichiers
              </p>
              <div className="text-sm text-neutral-500 dark:text-neutral-400 space-y-1">
                <p>Formats supportés: PDF, Images, AI, SVG, ZIP, DOC</p>
                <p>Taille maximale: 10MB par fichier</p>
                
                {/* Info sur les permissions */}
                {dossier && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs">
                    <InformationCircleIcon className="h-4 w-4 inline mr-1" />
                    Les fichiers seront associés au dossier <strong>{dossierDisplay}</strong>
                  </div>
                )}
              </div>
            </div>
            
          ) : (
            
            /* Liste des fichiers avec statistiques */
            <>
              {/* Statistiques */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalFiles}</div>
                  <div className="text-xs text-blue-800">Total</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600">{pendingFiles + uploadingFiles}</div>
                  <div className="text-xs text-yellow-800">En cours</div>
                </div>
                <div className="bg-success-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-success-600">{successFiles}</div>
                  <div className="text-xs text-green-800">Réussi</div>
                </div>
                <div className="bg-error-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-error-600">{errorFiles}</div>
                  <div className="text-xs text-red-800">Erreur</div>
                </div>
              </div>

              {/* Liste des fichiers */}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {files.map((fileObj) => {
                  const IconComponent = fileObj.type?.startsWith('image/') ? PhotoIcon : DocumentIcon;
                  
                  return (
                    <div key={fileObj.id} className="flex items-center p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                      <div className="flex-shrink-0 mr-3">
                        <IconComponent className="h-8 w-8 text-neutral-500 dark:text-neutral-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {fileObj.name}
                          </p>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                            {formatFileSize(fileObj.size)}
                          </span>
                        </div>
                        
                        {/* États du fichier */}
                        {fileObj.status === 'pending' && (
                          <div className="text-xs text-neutral-600 dark:text-neutral-300">En attente...</div>
                        )}
                        
                        {fileObj.status === 'uploading' && (
                          <div>
                            <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                              <span>Upload en cours...</span>
                              <span>{fileObj.progress}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${fileObj.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        {fileObj.status === 'success' && (
                          <div className="flex items-center text-xs text-success-600">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Upload réussi
                            {fileObj.uploadedData && (
                              <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                                ID: {fileObj.uploadedData.id}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {fileObj.status === 'error' && (
                          <div className="flex items-center text-xs text-error-600">
                            <ExclamationCircleIcon className="h-3 w-3 mr-1" />
                            {fileObj.error}
                          </div>
                        )}
                      </div>
                      
                      {/* Action de suppression */}
                      {!uploading && fileObj.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(fileObj.id)}
                          className="p-1 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded ml-2"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Zone d'ajout de fichiers supplémentaires */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  mt-4 border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
                  ${dragOver 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 dark:bg-neutral-900'
                  }
                `}
              >
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  + Ajouter d&apos;autres fichiers
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center space-x-4">
            {files.length > 0 && !uploading && (
              <button
                onClick={clearAllFiles}
                className="text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-100"
              >
                Tout effacer
              </button>
            )}
            
            {/* Informations de progression */}
            {uploading && (
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                {uploadingFiles} fichier(s) en cours...
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {!uploading && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-neutral-700 bg-white dark:bg-neutral-800 border border-neutral-300 rounded-lg hover:bg-neutral-50 dark:bg-neutral-900 transition-colors"
              >
                {successFiles > 0 && pendingFiles === 0 ? 'Fermer' : 'Annuler'}
              </button>
            )}
            
            <button
              onClick={handleUpload}
              disabled={pendingFiles === 0 || uploading || !dossierId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Upload...
                </span>
              ) : (
                `Uploader ${pendingFiles} fichier(s)`
              )}
            </button>
          </div>
        </div>

        {/* Input file caché */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept={getAcceptedTypes()}
        />
      </div>
    </div>
  );
};

FileUploadImproved.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpload: PropTypes.func.isRequired,
  dossier: PropTypes.object, // Objet dossier complet
  autoClose: PropTypes.bool
};

export default FileUploadImproved;