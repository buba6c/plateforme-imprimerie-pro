import React, { useState, useRef, useCallback } from 'react';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

const FileUpload = ({
  onFileSelect,
  onUpload,
  multiple = true,
  maxFiles = 10,
  maxFileSize = 500 * 1024 * 1024, // 500MB
  acceptedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/postscript',
    'image/svg+xml',
    'application/zip',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  disabled = false,
  uploading = false,
  uploadProgress = 0,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [previews, setPreviews] = useState({});
  const inputRef = useRef(null);

  // Fonction pour obtenir l'icône selon le type de fichier
  const getFileIcon = (mimeType, size = 'h-8 w-8') => {
    const iconClasses = `${size} text-neutral-400`;

    if (mimeType.startsWith('image/')) {
      return <PhotoIcon className={iconClasses} />;
    } else if (mimeType === 'application/pdf') {
      return <DocumentTextIcon className={iconClasses} />;
    } else if (mimeType.includes('zip') || mimeType.includes('rar')) {
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

  // Valider un fichier
  const validateFile = useCallback(
    file => {
      const errors = [];

      // Vérifier le type
      if (!acceptedTypes.includes(file.type)) {
        errors.push(`Type de fichier non autorisé: ${file.type}`);
      }

      // Vérifier la taille
      if (file.size > maxFileSize) {
        errors.push(
          `Fichier trop volumineux: ${formatFileSize(file.size)} (max: ${formatFileSize(maxFileSize)})`
        );
      }

      return errors;
    },
    [acceptedTypes, maxFileSize]
  );

  // Créer une preview pour les images
  const createPreview = useCallback(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        setPreviews(prev => ({
          ...prev,
          [file.name + file.size]: e.target.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Traiter les fichiers sélectionnés
  const processFiles = useCallback(
    files => {
      const fileArray = Array.from(files);
      const newErrors = [];
      const validFiles = [];

      // Vérifier le nombre total de fichiers
      if (selectedFiles.length + fileArray.length > maxFiles) {
        newErrors.push(`Trop de fichiers sélectionnés. Maximum: ${maxFiles}`);
        setErrors(newErrors);
        return;
      }

      // Valider chaque fichier
      fileArray.forEach(file => {
        const fileErrors = validateFile(file);
        if (fileErrors.length > 0) {
          newErrors.push(`${file.name}: ${fileErrors.join(', ')}`);
        } else {
          validFiles.push(file);
          createPreview(file);
        }
      });

      if (newErrors.length > 0) {
        setErrors(newErrors);
      } else {
        setErrors([]);
      }

      // Ajouter les fichiers valides à la sélection
      const updatedFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(updatedFiles);

      if (onFileSelect) {
        onFileSelect(updatedFiles);
      }
    },
    [selectedFiles, maxFiles, onFileSelect, validateFile, createPreview]
  );

  // Gérer le drag & drop
  const handleDrag = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled || uploading) return;

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, uploading, processFiles]
  );

  // Gérer la sélection de fichiers via l'input
  const handleFileSelect = e => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  // Supprimer un fichier de la sélection
  const removeFile = index => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);

    if (onFileSelect) {
      onFileSelect(updatedFiles);
    }
  };

  // Ouvrir le sélecteur de fichiers
  const openFileDialog = () => {
    if (!disabled && !uploading && inputRef.current) {
      inputRef.current.click();
    }
  };

  // Gérer l'upload
  const handleUpload = () => {
    if (selectedFiles.length > 0 && onUpload) {
      onUpload(selectedFiles);
    }
  };

  // Effacer toute la sélection
  const clearSelection = () => {
    setSelectedFiles([]);
    setErrors([]);
    setPreviews({});
    if (onFileSelect) {
      onFileSelect([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Zone de drop avec style moderne */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all duration-300 transform ${
          dragActive
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 scale-105 shadow-lg'
            : disabled || uploading
              ? 'border-neutral-200 bg-neutral-50 dark:bg-neutral-900'
              : 'border-neutral-300 bg-gradient-to-br from-white to-blue-50 dark:from-neutral-800 dark:to-neutral-700 hover:border-blue-400 hover:shadow-md hover:scale-[1.02]'
        } ${disabled || uploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />

        <div className="p-8 text-center">
          <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 ${
            dragActive ? 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg' : uploading ? 'bg-gradient-to-r from-blue-400 to-cyan-400' : 'bg-gradient-to-r from-blue-100 to-cyan-100'
          }`}>
            <CloudArrowUpIcon
              className={`h-8 w-8 transition-colors duration-300 ${
                dragActive || uploading ? 'text-white' : 'text-blue-600'
              }`}
            />
          </div>

          <div className="mt-6">
            <p className="text-xl font-bold text-neutral-900 dark:text-white bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {dragActive
                ? '✨ Déposez les fichiers ici'
                : disabled
                  ? '❌ Upload désactivé'
                  : uploading
                    ? `📤 Upload en cours... ${uploadProgress}%`
                    : '📎 Ajoutez vos fichiers'}
            </p>

            {!disabled && !uploading && (
              <p className="mt-3 text-base text-neutral-600 dark:text-neutral-300">
                Glissez-déposez ou <span className="text-blue-600 font-semibold cursor-pointer hover:text-blue-700">cliquez pour sélectionner</span>
              </p>
            )}
            
            {uploading && uploadProgress > 0 && (
              <div className="mt-4 max-w-xs mx-auto">
                <div className="flex justify-between text-sm text-neutral-600 mb-1">
                  <span>Progression</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">📄 Types acceptés</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">PDF, Images (JPG, PNG, GIF), AI, SVG, ZIP, DOC</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              📊 Taille max: {formatFileSize(maxFileSize)} • 🗂️ Max: {maxFiles} fichiers
            </p>
          </div>
        </div>
      </div>

      {/* Messages d'erreur */}
      {errors.length > 0 && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-danger-400 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-danger-800">Erreurs de validation</h3>
              <ul className="mt-2 text-sm text-danger-700 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Grille moderne des fichiers sélectionnés */}
      {selectedFiles.length > 0 && (
        <div className="bg-gradient-to-br from-white to-blue-50 dark:from-neutral-900 dark:to-neutral-800 rounded-xl p-6 border border-blue-200 dark:border-neutral-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <DocumentIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Fichiers sélectionnés
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {selectedFiles.length} fichier{selectedFiles.length > 1 ? 's' : ''} prêt{selectedFiles.length > 1 ? 's' : ''} à être uploadé{selectedFiles.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={clearSelection}
              className="text-sm font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              disabled={uploading}
            >
              🗑️ Tout effacer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedFiles.map((file, index) => {
              const previewKey = file.name + file.size;
              const hasPreview = previews[previewKey];

              return (
                <div
                  key={index}
                  className="group relative bg-white dark:bg-neutral-800 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                >
                  {/* Bouton de suppression */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg"
                    disabled={uploading}
                    title="Supprimer ce fichier"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>

                  {/* Preview ou icône */}
                  <div className="flex justify-center mb-3">
                    {hasPreview ? (
                      <img
                        src={previews[previewKey]}
                        alt={file.name}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-blue-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-lg flex items-center justify-center border-2 border-blue-200 dark:border-blue-700">
                        {getFileIcon(file.type, 'h-8 w-8 text-blue-600 dark:text-blue-400')}
                      </div>
                    )}
                  </div>

                  {/* Infos fichier */}
                  <div className="text-center">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate" title={file.name}>
                      {file.name.length > 20 ? `${file.name.substring(0, 17)}...` : file.name}
                    </p>
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {formatFileSize(file.size)}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                        {file.type.split('/')[1] || 'Fichier'}
                      </p>
                    </div>
                  </div>

                  {/* Indicateur de progression lors de l'upload */}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/90 dark:bg-neutral-800/90 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Upload...</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Boutons d'action modernes */}
          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-blue-200 dark:border-neutral-600">
            <button 
              onClick={clearSelection} 
              className="px-6 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all duration-200 shadow-sm hover:shadow-md" 
              disabled={uploading}
            >
              ❌ Annuler
            </button>

            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading || !onUpload}
              className="px-8 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-neutral-400 disabled:to-neutral-500 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Upload en cours... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-5 w-5" />
                  <span>📤 Uploader ({selectedFiles.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
