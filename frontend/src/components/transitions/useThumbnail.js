import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY_PREFIX = 'file_thumbnail_';
const CACHE_VERSION = '1.0';
const MAX_CACHE_SIZE = 50; // Maximum de miniatures en cache

class ThumbnailCache {
  constructor() {
    this.cache = new Map();
    this.loadFromStorage();
  }

  generateKey(file, size) {
    const fileId = file?.id || file?.name || 'unknown';
    const fileSize = file?.size || 0;
    const lastModified = file?.lastModified || file?.updated_at || 0;
    return `${CACHE_KEY_PREFIX}${fileId}_${size}_${fileSize}_${lastModified}_v${CACHE_VERSION}`;
  }

  get(file, size) {
    const key = this.generateKey(file, size);
    return this.cache.get(key);
  }

  set(file, size, thumbnailUrl) {
    const key = this.generateKey(file, size);
    
    // Limite de taille du cache
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      url: thumbnailUrl,
      timestamp: Date.now()
    });
    
    this.saveToStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('thumbnailCache');
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(data.entries || []);
        
        // Nettoyer les entrées expirées (plus de 7 jours)
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
        
        for (const [key, value] of this.cache.entries()) {
          if (now - value.timestamp > maxAge) {
            this.cache.delete(key);
          }
        }
      }
    } catch (error) {
      console.warn('Erreur chargement cache miniatures:', error);
      this.cache.clear();
    }
  }

  saveToStorage() {
    try {
      const data = {
        version: CACHE_VERSION,
        entries: Array.from(this.cache.entries())
      };
      localStorage.setItem('thumbnailCache', JSON.stringify(data));
    } catch (error) {
      console.warn('Erreur sauvegarde cache miniatures:', error);
    }
  }

  clear() {
    this.cache.clear();
    localStorage.removeItem('thumbnailCache');
  }

  getSize() {
    return this.cache.size;
  }
}

// Instance globale du cache
const thumbnailCache = new ThumbnailCache();

// Hook personnalisé pour gérer les miniatures
const useThumbnail = (file, options = {}) => {
  const {
    size = 64,
    quality = 0.8,
    format = 'jpeg',
    enabled = true
  } = options;

  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateThumbnail = useCallback(async () => {
    if (!file || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Vérifier le cache d'abord
      const cached = thumbnailCache.get(file, size);
      if (cached) {
        setThumbnail(cached.url);
        setLoading(false);
        return;
      }

      const mimeType = file?.mimetype || file?.type || '';
      const filename = file?.nom || file?.filename || file?.name || '';
      const ext = filename.split('.').pop()?.toLowerCase() || '';

      let thumbnailUrl = null;

      // Générer selon le type de fichier
      if (mimeType.includes('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
        thumbnailUrl = await generateImageThumbnail(file, size, quality, format);
      } else if (mimeType.includes('pdf') || ext === 'pdf') {
        thumbnailUrl = await generatePdfThumbnail(file, size, quality);
      }

      if (thumbnailUrl) {
        setThumbnail(thumbnailUrl);
        thumbnailCache.set(file, size, thumbnailUrl);
      } else {
        setError('Type de fichier non supporté pour la miniature');
      }

    } catch (err) {
      console.error('Erreur génération miniature:', err);
      setError(err.message || 'Erreur génération miniature');
    } finally {
      setLoading(false);
    }
  }, [file, size, quality, format, enabled]);

  useEffect(() => {
    generateThumbnail();
  }, [generateThumbnail]);

  const retry = useCallback(() => {
    generateThumbnail();
  }, [generateThumbnail]);

  const clearCache = useCallback(() => {
    thumbnailCache.clear();
  }, []);

  return {
    thumbnail,
    loading,
    error,
    retry,
    clearCache,
    cacheSize: thumbnailCache.getSize()
  };
};

// Fonction utilitaire pour générer une miniature d'image
const generateImageThumbnail = (file, size, quality, format) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculer les dimensions
        const aspectRatio = img.width / img.height;
        let width = size;
        let height = size;

        if (aspectRatio > 1) {
          height = size / aspectRatio;
        } else {
          width = size * aspectRatio;
        }

        canvas.width = width;
        canvas.height = height;

        // Dessiner l'image
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir selon le format
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Erreur chargement image'));

    // Charger l'image
    if (file.id) {
      // Fichier depuis l'API
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      fetch(`${API_BASE}/files/download/${file.id}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      })
      .then(response => response.blob())
      .then(blob => {
        img.src = URL.createObjectURL(blob);
      })
      .catch(reject);
    } else if (file instanceof File) {
      // Fichier local
      img.src = URL.createObjectURL(file);
    } else {
      reject(new Error('Format de fichier non supporté'));
    }
  });
};

// Fonction utilitaire pour générer une miniature de PDF
const generatePdfThumbnail = async (file, size, quality) => {
  const { pdfjs } = await import('react-pdf');
  
  return new Promise(async (resolve, reject) => {
    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      let pdfData;

      if (file.id) {
        // Fichier depuis l'API
        const response = await fetch(`${API_BASE}/files/download/${file.id}`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        pdfData = await response.arrayBuffer();
      } else if (file instanceof File) {
        // Fichier local
        pdfData = await file.arrayBuffer();
      } else {
        throw new Error('Format PDF non supporté');
      }

      // Charger le PDF
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
      const page = await pdf.getPage(1);

      // Configuration du canvas
      const viewport = page.getViewport({ scale: 1 });
      const scale = size / Math.max(viewport.width, viewport.height);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Rendu
      await page.render({
        canvasContext: context,
        viewport: scaledViewport
      }).promise;

      // Convertir
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);

    } catch (error) {
      reject(error);
    }
  });
};

export { useThumbnail, thumbnailCache };
export default useThumbnail;