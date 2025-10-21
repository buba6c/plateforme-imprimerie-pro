/**
 * SERVICE DE SYNCHRONISATION DES FICHIERS
 * ==========================================
 * 
 * Service unifié pour la gestion des fichiers avec :
 * - Intégration avec le système de dossiers synchronisé
 * - Gestion d'erreurs centralisée
 * - Cache intelligent avec invalidation
 * - WebSocket pour la synchronisation temps réel
 * - Support de l'upload avec progression
 * - Association automatique aux dossiers
 */

import { DossierIdResolver } from './dossierIdResolver';
import { errorHandler } from './errorHandlerService';
import { dossierSync } from './dossierSyncService';
import api from './httpClient';

class FilesSyncService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 secondes
    this.subscribers = new Map();
    this.uploadProgress = new Map();
    
    // Écouter les événements de fichiers via WebSocket
    this.setupFileEventListeners();
  }

  /**
   * Configuration des événements WebSocket pour les fichiers
   */
  setupFileEventListeners() {
    if (typeof window !== 'undefined' && window.io) {
      // Utiliser l'URL du backend, pas du frontend
      const wsUrl = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL?.replace('/api', '') || window.location.origin;
      const socket = window.io(wsUrl);
      
      socket.on('files_uploaded', (data) => {
        console.log('📁 Fichiers uploadés:', data);
        this.handleFileEvent('upload', data);
      });
      
      socket.on('file_deleted', (data) => {
        console.log('🗑️ Fichier supprimé:', data);
        this.handleFileEvent('delete', data);
      });
      
      socket.on('file_updated', (data) => {
        console.log('✏️ Fichier mis à jour:', data);
        this.handleFileEvent('update', data);
      });
    }
  }

  /**
   * Gestion des événements de fichiers
   */
  handleFileEvent(eventType, data) {
    const { dossier_id, files, file } = data;
    
    // Invalider le cache des fichiers du dossier
    const cacheKey = `files_${dossier_id}`;
    this.cache.delete(cacheKey);
    
    // Notifier les abonnés
    this.notifySubscribers(eventType, {
      dossier_id,
      files: files || [file].filter(Boolean),
      timestamp: Date.now()
    });
    
    // Déclencher un refresh du dossier si nécessaire
    if (dossierSync && typeof dossierSync.invalidateCache === 'function') {
      dossierSync.invalidateCache(`dossier_${dossier_id}`);
    }
  }

  /**
   * Abonnement aux événements de fichiers
   */
  subscribe(callback) {
    const id = Math.random().toString(36).substr(2, 9);
    this.subscribers.set(id, callback);
    
    return () => {
      this.subscribers.delete(id);
    };
  }

  /**
   * Notification des abonnés
   */
  notifySubscribers(eventType, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('Erreur callback fichier:', error);
      }
    });
  }

  /**
   * Vérification de la validité du cache
   */
  isCacheValid(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheTTL;
  }

  /**
   * Récupération des fichiers d'un dossier avec cache
   */
  async getFiles(dossierLike, forceRefresh = false) {
    try {
      const dossierId = DossierIdResolver.resolve(dossierLike);
      if (!dossierId) {
        throw { code: 'INVALID_DOSSIER_ID', message: 'Identifiant de dossier invalide' };
      }

      const cacheKey = `files_${dossierId}`;
      
      // Vérifier le cache sauf si refresh forcé
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        console.log('📁 Fichiers depuis le cache:', dossierId);
        return cached.data;
      }

      console.log('📁 Récupération fichiers pour dossier:', dossierId);
      
      const response = await api.get(`/dossiers/${dossierId}/fichiers`);
      
      if (!response.data.success) {
        throw { 
          code: 'FILES_FETCH_ERROR', 
          message: response.data.message || 'Erreur récupération fichiers'
        };
      }

      const files = response.data.files || response.data.fichiers || [];
      
      // Normaliser les fichiers
      const normalizedFiles = files.map(file => this.normalizeFile(file));
      
      // Mettre en cache
      this.cache.set(cacheKey, {
        data: normalizedFiles,
        timestamp: Date.now()
      });

      return normalizedFiles;

    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  }

  /**
   * Normalisation d'un objet fichier
   */
  normalizeFile(file) {
    return {
      id: file.id,
      dossier_id: file.dossier_id,
      original_filename: file.nom_original || file.original_filename || file.nom || file.filename,
      filename: file.nom_fichier || file.filename || file.stored_filename,
      filepath: file.chemin || file.filepath || file.path,
      mimetype: file.type_mime || file.mimetype || file.type,
      size: file.taille_bytes || file.size || file.taille || 0,
      uploaded_by: file.uploaded_by || file.uploader_id,
      created_at: file.created_at || file.uploaded_at,
      updated_at: file.updated_at,
      // Données utilisateur
      uploader_name: file.prenom && file.nom ? `${file.prenom} ${file.nom}` : null
    };
  }

  /**
   * Upload de fichiers avec progression et validation
   */
  async uploadFiles(dossierLike, files, options = {}) {
    try {
      const dossierId = DossierIdResolver.resolve(dossierLike);
      if (!dossierId) {
        throw { code: 'INVALID_DOSSIER_ID', message: 'Identifiant de dossier invalide' };
      }

      // Validation préventive des fichiers
      this.validateFilesForUpload(files);
      
      // Vérifier les permissions d'upload sur le dossier
      await this.validateUploadPermissions(dossierId);

      const uploadId = Math.random().toString(36).substr(2, 9);
      const { onProgress } = options;
      
      console.log('📤 Début upload de', files.length, 'fichier(s) pour dossier:', dossierId);
      
      // Préparer FormData
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      
      // Configuration de la requête avec progression
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          
          // Mettre à jour la progression
          this.uploadProgress.set(uploadId, {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percent: percentCompleted
          });
          
          // Callback de progression
          if (onProgress) {
            onProgress(percentCompleted, progressEvent);
          }
          
          console.log(`📤 Upload ${percentCompleted}%`);
        }
      };

      const response = await api.post(`/dossiers/${dossierId}/fichiers`, formData, config);
      
      // Nettoyer la progression
      this.uploadProgress.delete(uploadId);
      
      if (!response.data.success) {
        throw { 
          code: 'UPLOAD_ERROR', 
          message: response.data.message || 'Erreur upload fichiers'
        };
      }

      const uploadedFiles = response.data.files || response.data.fichiers || [];
      const normalizedFiles = uploadedFiles.map(file => this.normalizeFile(file));
      
      console.log('✅ Upload réussi:', normalizedFiles.length, 'fichier(s)');
      
      // Invalider le cache des fichiers
      const cacheKey = `files_${dossierId}`;
      this.cache.delete(cacheKey);
      
      // Émettre événement local
      this.notifySubscribers('upload', {
        dossier_id: dossierId,
        files: normalizedFiles,
        timestamp: Date.now()
      });
      
      return normalizedFiles;

    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  }

  /**
   * Validation des fichiers avant upload
   */
  validateFilesForUpload(files) {
    if (!files || files.length === 0) {
      throw { code: 'NO_FILES', message: 'Aucun fichier sélectionné' };
    }

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'image/png', 'image/jpg', 'image/jpeg', 'image/gif',
      'application/postscript', // .ai files
      'image/svg+xml',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    for (const file of files) {
      // Vérifier la taille
      if (file.size > maxFileSize) {
        throw { 
          code: 'FILE_TOO_LARGE', 
          message: `Le fichier "${file.name}" est trop volumineux (max 10MB)` 
        };
      }

      // Vérifier le type
      if (!allowedTypes.includes(file.type)) {
        throw { 
          code: 'INVALID_FILE_TYPE', 
          message: `Le type de fichier "${file.name}" n'est pas autorisé` 
        };
      }
    }
  }

  /**
   * Validation des permissions d'upload
   */
  async validateUploadPermissions(dossierId) {
    try {
      // Récupérer les informations du dossier via le service unifié
      const dossier = await dossierSync.getDossier(dossierId);
      
      if (!dossier) {
        throw { code: 'DOSSIER_NOT_FOUND', message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action' };
      }

      // Utiliser la validation centralisée des erreurs
      errorHandler.validateDossierAccess(dossier, 'upload', 
        localStorage.getItem('user_role') || 'user');
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Téléchargement sécurisé d'un fichier
   */
  async downloadFile(fileId, fileName) {
    try {
      console.log('📥 Téléchargement fichier:', fileId);
      
      const response = await api.get(`/files/download/${fileId}`, {
        responseType: 'blob'
      });

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || `fichier_${fileId}`);
      document.body.appendChild(link);
      link.click();
      
      // Nettoyer
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Téléchargement démarré');

    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  }

  /**
   * Suppression d'un fichier
   */
  async deleteFile(fileId) {
    try {
      console.log('🗑️ Suppression fichier:', fileId);
      
      const response = await api.delete(`/files/${fileId}`);
      
      if (!response.data.success) {
        throw { 
          code: 'DELETE_ERROR', 
          message: response.data.message || 'Erreur suppression fichier'
        };
      }

      console.log('✅ Fichier supprimé');
      
      // L'événement WebSocket mettra à jour le cache
      return true;

    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  }

  /**
   * Récupération des détails d'un fichier
   */
  async getFileDetails(fileId) {
    try {
      const response = await api.get(`/files/${fileId}`);
      
      if (!response.data.success) {
        throw { 
          code: 'FILE_NOT_FOUND', 
          message: 'Fichier non trouvé'
        };
      }

      return this.normalizeFile(response.data.file || response.data);

    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  }

  /**
   * Prévisualisation d'un fichier (pour images/PDF)
   */
  async getFilePreview(fileId) {
    try {
      const response = await api.get(`/files/preview/${fileId}`, {
        responseType: 'blob'
      });

      return window.URL.createObjectURL(new Blob([response.data]));

    } catch (error) {
      console.warn('Prévisualisation non disponible pour ce fichier');
      return null;
    }
  }

  /**
   * Statistiques du cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      subscribers: this.subscribers.size,
      uploads_in_progress: this.uploadProgress.size
    };
  }

  /**
   * Nettoyage du cache
   */
  clearCache() {
    this.cache.clear();
    this.uploadProgress.clear();
    console.log('🧹 Cache fichiers nettoyé');
  }

  /**
   * Invalidation sélective du cache
   */
  invalidateCache(pattern) {
    const keys = Array.from(this.cache.keys());
    const keysToDelete = keys.filter(key => 
      pattern instanceof RegExp ? pattern.test(key) : key.includes(pattern)
    );
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log('🧹 Cache invalidé:', keysToDelete);
    }
  }

  /**
   * Association d'un fichier à un dossier (migration/réparation)
   */
  async associateFileWithDossier(fileId, dossierId) {
    try {
      const response = await api.put(`/files/${fileId}/associate`, {
        dossier_id: dossierId
      });
      
      if (!response.data.success) {
        throw { 
          code: 'ASSOCIATION_ERROR', 
          message: 'Erreur association fichier-dossier'
        };
      }

      // Invalider les caches concernés
      this.invalidateCache(`files_${dossierId}`);
      
      return response.data;

    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  }
}

// Instance unique du service
export const filesSyncService = new FilesSyncService();

// Export par défaut
export default filesSyncService;