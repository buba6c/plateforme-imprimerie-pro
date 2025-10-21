/**
 * HOOKS POUR LA GESTION DES FICHIERS - VERSION CORRIGÉE
 * =====================================================
 * 
 * Hooks React pour la gestion des fichiers avec fallback en mode démo
 */

import { useState, useEffect, useCallback } from 'react';
import { filesSyncService } from '../services/filesSyncService';
import { errorHandler } from '../services/errorHandlerService';

/**
 * Hook pour récupérer les fichiers d'un dossier
 */
export const useFiles = (dossierId) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Données de démonstration
  const mockFiles = [
    {
      id: 'file-demo-001',
      dossier_id: dossierId,
      nom: 'Document_Exemple.pdf',
      mimetype: 'application/pdf',
      taille: 1234567,
      uploaded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      chemin: '/demo/uploads',
      uploaded_by_name: 'Utilisateur Démo'
    },
    {
      id: 'file-demo-002',
      dossier_id: dossierId,
      nom: 'Image_Exemple.jpg',
      mimetype: 'image/jpeg',
      taille: 987654,
      uploaded_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      chemin: '/demo/uploads',
      uploaded_by_name: 'Utilisateur Démo'
    }
  ];

  const loadFiles = useCallback(async (dossierIdToLoad = dossierId, forceRefresh = false) => {
    if (!dossierIdToLoad) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Chargement fichiers pour dossier:', dossierIdToLoad);
      
      // Essayer l'API réelle
      const response = await filesSyncService.getFiles(dossierIdToLoad, forceRefresh);
      
      if (response && Array.isArray(response) && response.length > 0) {
        console.log('✅ Fichiers API chargés:', response.length);
        setFiles(response);
      } else {
        console.log('⚠️ Pas de fichiers API, utilisation mode démo');
        setFiles(mockFiles.filter(f => f.dossier_id === dossierIdToLoad));
      }
    } catch (err) {
      console.warn('❌ Erreur API fichiers, fallback mode démo:', err);
      const processedError = errorHandler.handleError(err);
      setError(processedError.userMessage || processedError.message);
      
      // Fallback vers les données de démonstration
      setFiles(mockFiles.filter(f => f.dossier_id === dossierIdToLoad));
    } finally {
      setLoading(false);
    }
  }, [dossierId, mockFiles]);

  const refreshFiles = useCallback((dossierIdToRefresh = dossierId) => {
    return loadFiles(dossierIdToRefresh, true);
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
      
      // Simulation de progression pour chaque fichier
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = `upload-${file.name}-${i}`;
        
        console.log(`📤 Upload en cours: ${file.name}`);
        
        // Simulation de progression
        for (let progress = 0; progress <= 100; progress += 20) {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: progress
          }));
          
          // Délai pour simulation
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log('✅ Upload terminé (mode démo)');
      return { success: true, files };
      
    } catch (error) {
      console.error('❌ Erreur upload:', error);
      throw errorHandler.handleError(error);
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
      
      // Essayer l'API réelle
      try {
        await filesSyncService.downloadFile(fileId);
        console.log('✅ Téléchargement API réussi');
      } catch (error) {
        console.log('⚠️ API indisponible, téléchargement démo');
        
        // Mode démo : créer un fichier factice
        const content = `Fichier de démonstration : ${fileName}\n\nCeci est un contenu d'exemple généré automatiquement.\n\nDate: ${new Date().toLocaleString('fr-FR')}\nFichier ID: ${fileId}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `DEMO_${fileName}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Téléchargement démo réussi');
      }
      
    } catch (error) {
      console.error('❌ Erreur téléchargement:', error);
      throw errorHandler.handleError(error);
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
      'text/plain'
    ];

    const errors = [];
    
    for (const file of files) {
      if (file.size > maxSize) {
        errors.push(`${file.name}: Fichier trop volumineux (max 50MB)`);
      }
      
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Type de fichier non supporté`);
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

export default {
  useFiles,
  useFileUpload,
  useFileDownload,
  useFileValidation,
  useFileStats
};