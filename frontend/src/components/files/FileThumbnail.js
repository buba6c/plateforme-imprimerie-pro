import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

const FileThumbnail = ({ 
  file, 
  size = 64, 
  className = "", 
  showLabel = true,
  onError = null,
  cache = false
}) => {
  const [loading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  // Types de fichiers et leurs icônes
  const getFileIcon = (mimeType, filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    
    // Images
    if (mimeType?.includes('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
      return { icon: '🖼️', bg: 'bg-blue-100', color: 'text-blue-700' };
    }
    
    // PDFs
    if (mimeType?.includes('pdf') || ext === 'pdf') {
      return { icon: '📄', bg: 'bg-error-100', color: 'text-error-700' };
    }
    
    // Texte
    if (mimeType?.includes('text/') || ['txt', 'md', 'csv'].includes(ext)) {
      return { icon: '📝', bg: 'bg-success-100', color: 'text-success-700' };
    }
    
    // Code
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'xml'].includes(ext)) {
      return { icon: '💻', bg: 'bg-purple-100', color: 'text-purple-700' };
    }
    
    // Documents Office
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      return { icon: '📊', bg: 'bg-orange-100', color: 'text-orange-700' };
    }
    
    // Vidéos
    if (mimeType?.includes('video/') || ['mp4', 'avi', 'mov', 'wmv'].includes(ext)) {
      return { icon: '🎬', bg: 'bg-indigo-100', color: 'text-indigo-700' };
    }
    
    // Audio
    if (mimeType?.includes('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      return { icon: '🎵', bg: 'bg-pink-100', color: 'text-pink-700' };
    }
    
    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return { icon: '🗜️', bg: 'bg-neutral-100 dark:bg-neutral-800', color: 'text-neutral-700 dark:text-neutral-200' };
    }
    
    return { icon: '📁', bg: 'bg-neutral-100 dark:bg-neutral-800', color: 'text-neutral-700 dark:text-neutral-200' };
  };

  const fileIcon = getFileIcon(file?.mimetype || file?.type, file?.nom || file?.filename);

  // Génération de miniature pour les images
  const generateImageThumbnail = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculer les dimensions en gardant les proportions
          const aspectRatio = img.width / img.height;
          let thumbWidth = size;
          let thumbHeight = size;
          
          if (aspectRatio > 1) {
            thumbHeight = size / aspectRatio;
          } else {
            thumbWidth = size * aspectRatio;
          }
          
          canvas.width = thumbWidth;
          canvas.height = thumbHeight;
          
          // Dessiner l'image redimensionnée
          ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
          
          // Convertir en data URL
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnailUrl);
        } catch (error) {
          reject(new Error(error));
        }
      };
      
      img.onerror = () => reject(new Error('Erreur de chargement image'));
      
      // Créer l'URL de l'image
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      
      if (file.id) {
        // Fichier depuis l'API - Utiliser preview au lieu de download pour éviter le téléchargement forcé
        fetch(`${API_BASE}/files/preview/${file.id}`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          img.src = URL.createObjectURL(blob);
        })
        .catch(error => {
          console.error('Erreur chargement preview:', error);
          reject(error);
        });
      } else if (file instanceof File) {
        // Fichier local
        img.src = URL.createObjectURL(file);
      } else {
        reject(new Error('Type de fichier non supporté'));
      }
    });
  }, [size]);

  // Génération de miniature pour les PDFs
    const generatePdfThumbnail = useCallback(async (file) => {
    try {
      // Pour l'instant, retourner null - l'implémentation PDF.js sera ajoutée plus tard
      console.log('PDF thumbnail generation pas encore implémenté:', file);
      return null;
    } catch (error) {
      console.error('Erreur génération miniature PDF:', error);
      throw error;
    }
  }, []);

  // Génération de miniature selon le type de fichier
  const generateThumbnail = useCallback(async () => {
    if (!file) return;
    
    setLoading(true);
    
    try {
      const mimeType = file?.mimetype || file?.type;
      const filename = file?.nom || file?.filename || '';
      
      // Cache désactivé pour le moment
      
      let thumbnailUrl = null;
      
      // Générer selon le type
      if (mimeType?.includes('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(filename.split('.').pop()?.toLowerCase())) {
        thumbnailUrl = await generateImageThumbnail(file);
      } else if (mimeType?.includes('pdf') || filename.split('.').pop()?.toLowerCase() === 'pdf') {
        thumbnailUrl = await generatePdfThumbnail(file);
      }
      
      if (thumbnailUrl) {
        setThumbnail(thumbnailUrl);
        
        // Cache désactivé
      }
      
    } catch (error) {
      console.error('❌ Erreur génération miniature:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [file, size, generateImageThumbnail, generatePdfThumbnail]);

  // Charger la miniature quand nécessaire
  useEffect(() => {
    if (file && (file?.mimetype?.includes('image/') || file?.mimetype?.includes('pdf/') || 
                 ['jpg', 'jpeg', 'png', 'gif', 'pdf'].includes(file?.nom?.split('.').pop()?.toLowerCase()))) {
      generateThumbnail();
    }
  }, [file, generateThumbnail]);

  // Rendu du composant
  const containerStyle = {
    width: size,
    height: size,
  };

  if (loading) {
    return (
      <div 
        className={`${className} flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse`}
        style={containerStyle}
      >
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (thumbnail) {
    return (
      <div className={`${className} relative group`} style={containerStyle}>
        <img
          src={thumbnail}
          alt={file?.nom || 'Miniature'}
          className="w-full h-full object-cover rounded-lg shadow-sm group-hover:shadow-md dark:shadow-secondary-900/20 transition-shadow"
          onError={() => {
            setThumbnail(null);
            console.error('Erreur affichage miniature');
          }}
        />
        {showLabel && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
            {file?.nom?.split('.').pop()?.toUpperCase() || 'FICHIER'}
          </div>
        )}
      </div>
    );
  }

  // Icône par défaut
  return (
    <div 
      className={`${className} ${fileIcon.bg} flex flex-col items-center justify-center rounded-lg shadow-sm hover:shadow-md dark:shadow-secondary-900/20 transition-shadow`}
      style={containerStyle}
    >
      <span className="text-2xl mb-1">{fileIcon.icon}</span>
      {showLabel && size >= 64 && (
        <span className={`text-xs font-medium ${fileIcon.color} truncate px-1`}>
          {file?.nom?.split('.').pop()?.toUpperCase() || 'FILE'}
        </span>
      )}
    </div>
  );
};

FileThumbnail.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nom: PropTypes.string,
    filename: PropTypes.string,
    name: PropTypes.string,
    mimetype: PropTypes.string,
    type: PropTypes.string,
    arrayBuffer: PropTypes.func
  }),
  size: PropTypes.number,
  className: PropTypes.string,
  showLabel: PropTypes.bool,
  onError: PropTypes.func,
  cache: PropTypes.bool
};

FileThumbnail.defaultProps = {
  file: null,
  size: 64,
  className: "",
  showLabel: true,
  onError: null,
  cache: false
};

export default FileThumbnail;