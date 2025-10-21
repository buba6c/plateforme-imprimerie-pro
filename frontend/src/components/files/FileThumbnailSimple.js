import React from 'react';

const FileThumbnail = ({ 
  file, 
  size = 64, 
  className = "", 
  showLabel = true
}) => {
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

  // Dimensions du conteneur
  const containerStyle = {
    width: size,
    height: size,
  };

  // Pour les images, essayer d'afficher la vraie image
  if (file?.mimetype?.includes('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(file?.nom?.split('.').pop()?.toLowerCase())) {
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    
    if (file.id) {
      return (
        <div className={`${className} relative group`} style={containerStyle}>
          <img
            src={`${API_BASE}/files/download/${file.id}`}
            alt={file?.nom || 'Miniature'}
            className="w-full h-full object-cover rounded-lg shadow-sm group-hover:shadow-md dark:shadow-secondary-900/20 transition-shadow"
            loading="lazy"
            onError={(e) => {
              // En cas d'erreur, afficher l'icône par défaut
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback icône */}
          <div 
            className={`${fileIcon.bg} flex flex-col items-center justify-center rounded-lg shadow-sm hover:shadow-md dark:shadow-secondary-900/20 transition-shadow absolute inset-0`}
            style={{ display: 'none' }}
          >
            <span className="text-2xl mb-1">{fileIcon.icon}</span>
            {showLabel && size >= 64 && (
              <span className={`text-xs font-medium ${fileIcon.color} truncate px-1`}>
                {file?.nom?.split('.').pop()?.toUpperCase() || 'IMG'}
              </span>
            )}
          </div>
          {showLabel && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
              {file?.nom?.split('.').pop()?.toUpperCase() || 'IMAGE'}
            </div>
          )}
        </div>
      );
    }
  }

  // Icône par défaut pour tous les autres types
  return (
    <div 
      className={`${className} ${fileIcon.bg} flex flex-col items-center justify-center rounded-lg shadow-sm hover:shadow-md dark:shadow-secondary-900/20 transition-shadow cursor-pointer`}
      style={containerStyle}
    >
      <span className="text-2xl mb-1">{fileIcon.icon}</span>
      {showLabel && size >= 64 && (
        <span className={`text-xs font-medium ${fileIcon.color} truncate px-1 max-w-full`}>
          {file?.nom?.split('.').pop()?.toUpperCase() || 'FILE'}
        </span>
      )}
    </div>
  );
};

export default FileThumbnail;