/**
 * SERVICE DE GESTION DES FICHIERS - VERSION PRODUCTION
 * =====================================================
 * 
 * Service optimisé pour la gestion des fichiers en production
 * - API calls avec gestion d'erreurs robuste
 * - Cache intelligent
 * - Support multi-format
 * - Upload avec progress tracking
 */

import { getAuthHeaders, apiCallWithAuth } from '../utils/authUtils';

class FilesServiceProduction {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Récupérer les fichiers d'un dossier
   */
  async getFiles(dossierId) {
    if (!dossierId) {
      throw new Error('ID du dossier requis');
    }

    const cacheKey = `files_${dossierId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('🔄 Fichiers depuis cache:', dossierId);
      return cached.data;
    }

    try {
      console.log('🌐 API call files pour dossier:', dossierId);
      
      const response = await apiCallWithAuth(`${this.baseURL}/dossiers/${dossierId}/fichiers`, {
        method: 'GET'
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('📭 Aucun fichier trouvé pour le dossier:', dossierId);
          return { files: [] };
        }
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const files = this.normalizeFilesData(result);

      // Mise en cache
      this.cache.set(cacheKey, {
        data: files,
        timestamp: Date.now()
      });

      console.log('✅ Fichiers API récupérés:', files.files?.length || 0);
      return files;

    } catch (error) {
      console.error('❌ Erreur getFiles:', error);
      
      // Fallback - retourner cache expiré si disponible
      if (cached) {
        console.log('🔄 Utilisation cache expiré comme fallback');
        return cached.data;
      }
      
      throw error;
    }
  }

  /**
   * Normaliser les données de fichiers
   */
  normalizeFilesData(data) {
    const files = data.files || data.data || data || [];
    
    return {
      files: files.map(file => ({
        id: file.id || file.file_id,
        nom: file.nom || file.name || file.filename,
        taille: file.taille || file.size || 0,
        mimetype: file.mimetype || file.type || 'unknown',
        uploaded_at: file.uploaded_at || file.created_at || new Date().toISOString(),
        url: file.url || `/api/files/${file.id}/download`,
        preview_url: file.preview_url || `/api/files/${file.id}/preview`,
        // Métadonnées enrichies
        extension: this.getFileExtension(file.nom || file.name),
        isImage: this.isImageFile(file.mimetype || file.type),
        isPDF: (file.mimetype || file.type) === 'application/pdf',
        isText: this.isTextFile(file.mimetype || file.type),
        sizeFormatted: this.formatFileSize(file.taille || file.size || 0)
      }))
    };
  }

  /**
   * Upload de fichiers avec suivi de progression
   */
  async uploadFiles(dossierId, files) {
    if (!dossierId || !files || files.length === 0) {
      throw new Error('Paramètres d\'upload invalides');
    }

    const formData = new FormData();
    
    // Ajouter les fichiers
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    formData.append('dossier_id', dossierId);

    try {
      console.log('📤 Upload en cours:', files.length, 'fichier(s)');

      const response = await apiCallWithAuth(`${this.baseURL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur upload: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Invalider le cache
      this.invalidateCache(`files_${dossierId}`);
      
      console.log('✅ Upload réussi:', result);
      return result;

    } catch (error) {
      console.error('❌ Erreur upload:', error);
      throw error;
    }
  }

  /**
   * Télécharger un fichier
   */
  async downloadFile(fileId, filename = 'fichier') {
    if (!fileId) {
      throw new Error('ID du fichier requis');
    }

    try {
      console.log('📥 Téléchargement fichier:', fileId);

      const response = await apiCallWithAuth(`${this.baseURL}/files/${fileId}/download`, {
        method: 'GET'
      });

      if (!response.ok) {
        // Tenter de récupérer le message d'erreur du serveur
        let errorMessage = `Erreur téléchargement: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Si on ne peut pas parser l'erreur, garder le message par défaut
        }
        
        if (response.status === 404) {
          throw new Error('Fichier non trouvé ou plus disponible sur le serveur');
        } else if (response.status === 403) {
          throw new Error('Permission insuffisante pour télécharger ce fichier');
        } else {
          throw new Error(errorMessage);
        }
      }

      const blob = await response.blob();
      
      // Créer URL de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Téléchargement terminé:', filename);
      return { success: true, filename };

    } catch (error) {
      console.error('❌ Erreur téléchargement:', error);
      throw error;
    }
  }

  /**
   * Prévisualiser un fichier
   */
  async previewFile(fileId) {
    if (!fileId) {
      throw new Error('ID du fichier requis');
    }

    const cacheKey = `preview_${fileId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('🔄 Prévisualisation depuis cache:', fileId);
      return cached.data;
    }

    try {
      console.log('👁️ Prévisualisation fichier:', fileId);

      const response = await apiCallWithAuth(`${this.baseURL}/files/${fileId}/preview`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Erreur prévisualisation: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const result = {
        url,
        type: response.headers.get('content-type') || 'application/octet-stream',
        size: blob.size
      };

      // Mise en cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log('✅ Prévisualisation prête');
      return result;

    } catch (error) {
      console.error('❌ Erreur prévisualisation:', error);
      throw error;
    }
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(fileId, dossierId) {
    if (!fileId) {
      throw new Error('ID du fichier requis');
    }

    try {
      console.log('🗑️ Suppression fichier:', fileId);

      const response = await apiCallWithAuth(`${this.baseURL}/files/${fileId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Erreur suppression: ${response.status}`);
      }

      // Invalider les caches
      this.invalidateCache(`files_${dossierId}`);
      this.invalidateCache(`preview_${fileId}`);

      console.log('✅ Fichier supprimé');
      return { success: true };

    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      throw error;
    }
  }

  /**
   * Obtenir les informations détaillées d'un fichier
   */
  async getFileInfo(fileId) {
    if (!fileId) {
      throw new Error('ID du fichier requis');
    }

    try {
      const response = await apiCallWithAuth(`${this.baseURL}/files/${fileId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Erreur info fichier: ${response.status}`);
      }

      const fileInfo = await response.json();
      return this.normalizeFileInfo(fileInfo);

    } catch (error) {
      console.error('❌ Erreur info fichier:', error);
      throw error;
    }
  }

  /**
   * Normaliser les informations de fichier
   */
  normalizeFileInfo(data) {
    return {
      id: data.id,
      nom: data.nom || data.name,
      taille: data.taille || data.size,
      mimetype: data.mimetype || data.type,
      uploaded_at: data.uploaded_at || data.created_at,
      dossier_id: data.dossier_id,
      extension: this.getFileExtension(data.nom || data.name),
      isImage: this.isImageFile(data.mimetype || data.type),
      isPDF: (data.mimetype || data.type) === 'application/pdf',
      isText: this.isTextFile(data.mimetype || data.type),
      sizeFormatted: this.formatFileSize(data.taille || data.size)
    };
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Obtenir l'en-tête d'autorisation
   */
  getAuthHeader() {
    const token = localStorage.getItem('auth_token') || 
                  localStorage.getItem('token') || 
                  sessionStorage.getItem('token') ||
                  sessionStorage.getItem('auth_token');
    return token ? `Bearer ${token}` : '';
  }

  /**
   * Invalider le cache
   */
  invalidateCache(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Obtenir l'extension d'un fichier
   */
  getFileExtension(filename) {
    if (!filename) return '';
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Vérifier si c'est un fichier image
   */
  isImageFile(mimetype) {
    return mimetype ? mimetype.startsWith('image/') : false;
  }

  /**
   * Vérifier si c'est un fichier texte
   */
  isTextFile(mimetype) {
    if (!mimetype) return false;
    return mimetype.startsWith('text/') || 
           mimetype === 'application/json' ||
           mimetype === 'application/javascript';
  }

  /**
   * Formater la taille de fichier
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Nettoyer le cache périodiquement
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton
const filesServiceProduction = new FilesServiceProduction();

// Nettoyage automatique du cache toutes les 10 minutes
setInterval(() => {
  filesServiceProduction.cleanCache();
}, 10 * 60 * 1000);

export default filesServiceProduction;