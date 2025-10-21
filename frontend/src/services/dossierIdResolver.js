// Service centralisé pour la gestion cohérente des identifiants de dossiers
// Résout les conflits entre folder_id, id, numero_dossier

export class DossierIdResolver {
  static resolve(dossierLike) {
    if (!dossierLike) return null;
    
    // Si c'est déjà une string, on assume que c'est un ID valide
    if (typeof dossierLike === 'string') {
      return dossierLike;
    }
    
    // Si c'est un objet dossier
    if (typeof dossierLike === 'object') {
      // Priorité 1: folder_id (UUID moderne)
      if (dossierLike.folder_id) {
        return dossierLike.folder_id;
      }
      
      // Priorité 2: id (legacy numérique)
      if (dossierLike.id) {
        return String(dossierLike.id);
      }
      
      // Priorité 3: numero_dossier (backup)
      if (dossierLike.numero_dossier) {
        return String(dossierLike.numero_dossier);
      }
    }
    
    return null;
  }

  static isValidId(id) {
    if (!id) return false;
    
    // UUID format
    if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return true;
    }
    
    // Numérique (legacy)
    if (!isNaN(parseInt(id))) {
      return true;
    }
    
    return false;
  }

  static normalize(dossier) {
    if (!dossier) return null;
    
    const id = this.resolve(dossier);
    if (!id) return null;
    
    return {
      ...dossier,
      // Uniformiser l'identifiant principal
      id: id,
      folder_id: dossier.folder_id || id,
    };
  }

  static buildApiUrl(basePath, dossierLike) {
    const id = this.resolve(dossierLike);
    if (!id) {
      throw new Error('Impossible de résoudre l\'identifiant du dossier');
    }
    return `${basePath}/${encodeURIComponent(id)}`;
  }
}

// Fonction utilitaire pour l'interopérabilité avec l'ancien système
export const getDossierId = (dossierLike) => {
  return DossierIdResolver.resolve(dossierLike);
};

export const isValidDossierId = (id) => {
  return DossierIdResolver.isValidId(id);
};

export const normalizeDossier = (dossier) => {
  return DossierIdResolver.normalize(dossier);
};