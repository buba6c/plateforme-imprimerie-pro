/**
 * HOOKS POUR LA GESTION DES FICHIERS - VERSION PRODUCTION
 * =======================================================
 * 
 * Hooks React pour la gestion des fichiers utilisant uniquement l'API réelle
 * - Suppression complète du mode démo
 * - Gestion d'erreurs robuste
 * - Performance optimisée
 */

import { useState, useEffect, useCallback } from 'react';
import { filesService } from '../services/api';

/**
 * Hook pour récupérer les fichiers d'un dossier
 */
export const useFiles = (dossierId) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadFiles = useCallback(async (dossierIdToLoad = dossierId) => {
    if (!dossierIdToLoad) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Chargement fichiers pour dossier:', dossierIdToLoad);
      
      const response = await filesService.getFiles(dossierIdToLoad);
      const filesList = response.files || response.data || response || [];
      
      console.log('✅ Fichiers API chargés:', filesList.length);
      setFiles(filesList);
      
    } catch (err) {
      console.error('❌ Erreur API fichiers:', err);
      setError(err.message || 'Erreur lors du chargement des fichiers');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  const refreshFiles = useCallback((dossierIdToRefresh = dossierId) => {
    return loadFiles(dossierIdToRefresh);
  }, [loadFiles, dossierId]);

  useEffect(() => {
    if (dossierId) {
      loadFiles(dossierId);
    } else {
      setFiles([]);
    }
  }, [dossierId, loadFiles]);

  return {
    files,
    loading,
    error,
    refreshFiles,
    loadFiles
  };
};

/**
 * Hook pour l'upload de fichiers
 */
export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const uploadFiles = useCallback(async (dossierId, files) => {
    setUploading(true);
    setUploadProgress({});

    try {
      console.log('📤 Début upload:', files.length, 'fichier(s)');
      
      const response = await filesService.uploadFiles(dossierId, files);
      
      console.log('✅ Upload terminé');
      return { success: true, files: response.files || files };
      
    } catch (error) {
      console.error('❌ Erreur upload:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, []);

  return {
    uploadFiles,
    uploading,
    uploadProgress
  };
};

/**
 * Hook pour le téléchargement de fichiers
 */
export const useFileDownload = () => {
  const [downloading, setDownloading] = useState(false);

  const downloadFile = useCallback(async (fileId, fileName = 'fichier') => {
    setDownloading(true);

    try {
      console.log('📥 Téléchargement fichier:', fileName);
      
      const response = await filesService.downloadFile(fileId);
      console.log('✅ Téléchargement réussi');
      
      return response;
      
    } catch (error) {
      console.error('❌ Erreur téléchargement:', error);
      throw error;
    } finally {
      setDownloading(false);
    }
  }, []);

  return {
    downloadFile,
    downloading
  };
};

/**
 * Hook pour la validation de fichiers
 */
export const useFileValidation = () => {
  const validateFiles = useCallback((files) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/postscript' // Pour les fichiers .ai
    ];

    const errors = [];
    
    for (const file of files) {
      if (file.size > maxSize) {
        errors.push(`${file.name}: Fichier trop volumineux (max 50MB)`);
      }
      
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Type de fichier non supporté (${file.type})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  return { validateFiles };
};

/**
 * Hook pour les statistiques de fichiers
 */
export const useFileStats = (files = []) => {
  const stats = {
    totalFiles: files.length,
    totalSize: files.reduce((sum, file) => sum + (file.taille || file.size || 0), 0),
    typeDistribution: files.reduce((acc, file) => {
      const type = file.mimetype || file.type || 'unknown';
      const category = type.split('/')[0] || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {}),
    recentFiles: files
      .sort((a, b) => new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at))
      .slice(0, 5)
  };

  return stats;
};

/**
 * Hook pour charger tous les fichiers de tous les dossiers
 */
export const useAllFiles = (dossiers = []) => {
  const [allFiles, setAllFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAllFiles = useCallback(async () => {
    if (!dossiers.length) {
      setAllFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('📄 Chargement de tous les fichiers pour', dossiers.length, 'dossiers');

      // Charger les fichiers de chaque dossier en parallèle
      const promises = dossiers.map(async (dossier) => {
        try {
          const response = await filesService.getFiles(dossier.id || dossier.folder_id);
          const files = response.files || response.data || response || [];
          
          return files.map(file => ({
            ...file,
            dossier: {
              id: dossier.id || dossier.folder_id,
              client_nom: dossier.client_nom || dossier.client,
              numero_commande: dossier.numero_commande || dossier.numero,
              statut: dossier.statut,
              machine: dossier.machine
            }
          }));
        } catch (err) {
          console.warn(`⚠️ Impossible de charger les fichiers du dossier ${dossier.id}:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      const flatFiles = results.flat();
      
      console.log('✅ Total fichiers chargés:', flatFiles.length);
      setAllFiles(flatFiles);

    } catch (err) {
      console.error('❌ Erreur chargement tous fichiers:', err);
      setError(err.message || 'Erreur lors du chargement des fichiers');
      setAllFiles([]);
    } finally {
      setLoading(false);
    }
  }, [dossiers]);

  useEffect(() => {
    loadAllFiles();
  }, [loadAllFiles]);

  return {
    files: allFiles,
    loading,
    error,
    refresh: loadAllFiles
  };
};

export default {
  useFiles,
  useFileUpload,
  useFileDownload,
  useFileValidation,
  useFileStats,
  useAllFiles
};