import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  PhotoIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  FolderIcon
} from '@heroicons/react/24/outline';

const FileUpload = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  currentPath = '',
  demoMode = true // Mode démonstration par défaut
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

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

  const addFiles = (newFiles) => {
    const filesWithId = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending', // pending, uploading, success, error
      progress: 0,
      error: null
    }));
    
    setFiles(prev => [...prev, ...filesWithId]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };

  const clearAllFiles = () => {
    setFiles([]);
    setUploadProgress({});
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return PhotoIcon;
    return DocumentIcon;
  };

  // Mode démonstration : simulation d'upload
  const simulateUpload = async (fileObj) => {
    const { id } = fileObj;
    
    // Mise à jour du statut
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, status: 'uploading' } : f
    ));

    // Simulation de la progression
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setUploadProgress(prev => ({
        ...prev,
        [id]: progress
      }));
      
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, progress } : f
      ));
    }

    // En mode démo, tous les uploads réussissent
    setFiles(prev => prev.map(f => 
      f.id === id ? { 
        ...f, 
        status: 'success',
        error: null 
      } : f
    ));

    return true;
  };

  // TODO: Fonction pour l'upload réel vers l'API
  const realUpload = async (fileObj) => {
    const { id, file } = fileObj;
    
    try {
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'uploading' } : f
      ));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({
            ...prev,
            [id]: progress
          }));
          setFiles(prev => prev.map(f => 
            f.id === id ? { ...f, progress } : f
          ));
        }
      });

      if (response.ok) {
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, status: 'success' } : f
        ));
        return true;
      } else {
        throw new Error('Erreur serveur');
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === id ? { 
          ...f, 
          status: 'error',
          error: error.message 
        } : f
      ));
      return false;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    // Utilisation du mode selon la configuration
    const uploadFunction = demoMode ? simulateUpload : realUpload;
    const uploadPromises = pendingFiles.map(file => uploadFunction(file));
    
    await Promise.all(uploadPromises);
    
    setUploading(false);
    
    // Appel du callback parent avec les fichiers uploadés
    const successFiles = files.filter(f => f.status === 'success');
    if (successFiles.length > 0) {
      onUpload(successFiles.map(f => f.file));
    }
  };

  const handleClose = () => {
    if (!uploading) {
      clearAllFiles();
      onClose();
    }
  };

  const totalFiles = files.length;
  const successFiles = files.filter(f => f.status === 'success').length;
  const errorFiles = files.filter(f => f.status === 'error').length;
  const pendingFiles = files.filter(f => f.status === 'pending').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
              <CloudArrowUpIcon className="h-5 w-5 mr-2 text-blue-600" />
              Upload de fichiers
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 flex items-center">
              <FolderIcon className="h-4 w-4 mr-1" />
              Destination: {currentPath || 'Racine'}
            </p>
            {/* Mode démonstration */}
            {demoMode && (
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                <ExclamationCircleIcon className="h-3 w-3 mr-1" />
                Mode démonstration : Fichiers du dossier d&apos;exemple
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

        {/* Zone de drop */}
        <div className="p-6">
          {files.length === 0 ? (
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
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                <p>Formats supportés: PDF, Images (PNG, JPG, GIF), Documents (DOC, DOCX)</p>
                <p>Taille maximale: 10MB par fichier</p>
                {demoMode && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">
                    📋 <strong>Mode démonstration :</strong> Les vrais fichiers seront disponibles une fois l&apos;API configurée
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Statistiques */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalFiles}</div>
                  <div className="text-xs text-blue-800">Total</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600">{pendingFiles + uploadingFiles}</div>
                  <div className="text-xs text-yellow-800">En attente</div>
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
                  const IconComponent = getFileIcon(fileObj.type);
                  const progress = uploadProgress[fileObj.id] || 0;
                  
                  return (
                    <div key={fileObj.id} className="flex items-center p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                      <IconComponent className="h-8 w-8 text-neutral-500 dark:text-neutral-400 mr-3 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {fileObj.name}
                          </p>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                            {formatFileSize(fileObj.size)}
                          </span>
                        </div>
                        
                        {fileObj.status === 'pending' && (
                          <div className="text-xs text-neutral-600 dark:text-neutral-300">En attente...</div>
                        )}
                        
                        {fileObj.status === 'uploading' && (
                          <div>
                            <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                              <span>Upload en cours...</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        {fileObj.status === 'success' && (
                          <div className="flex items-center text-xs text-success-600">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Upload réussi
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
          </div>
          
          <div className="flex items-center space-x-3">
            {!uploading && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-neutral-700 bg-white dark:bg-neutral-800 border border-neutral-300 rounded-lg hover:bg-neutral-50 dark:bg-neutral-900 transition-colors"
              >
                Annuler
              </button>
            )}
            
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading || files.every(f => f.status !== 'pending')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Upload en cours...
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
          accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.txt"
        />
      </div>
    </div>
  );
};

FileUpload.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpload: PropTypes.func.isRequired,
  currentPath: PropTypes.string,
  demoMode: PropTypes.bool
};

export default FileUpload;