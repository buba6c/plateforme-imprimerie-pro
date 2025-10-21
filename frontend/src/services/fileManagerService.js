import api from './api';

class FilePermissionService {
  // Définition des permissions par rôle
  static getPermissions() {
    return {
    admin: {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDelete: true,
      canRename: true,
      canCreateFolder: true,
      canViewAll: true, // Voir tous les fichiers de tous les utilisateurs
      canManagePermissions: true
    },
    preparateur: {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDelete: false, // Seuls ses propres fichiers
      canRename: false,
      canCreateFolder: false,
      canViewAll: false, // Voir seulement ses propres fichiers
      canManagePermissions: false
    },
    imprimeur: {
      canView: true,
      canUpload: false,
      canDownload: true,
      canDelete: false,
      canRename: false,
      canCreateFolder: false,
      canViewAll: true, // Voir tous les fichiers pour impression
      canManagePermissions: false
    },
      livreur: {
        canView: false,
        canUpload: false,
        canDownload: false,
        canDelete: false,
        canRename: false,
        canCreateFolder: false,
        canViewAll: false,
        canManagePermissions: false
      }
    };
  }  /**
   * Obtenir les permissions d'un utilisateur
   */
  static getUserPermissions(user) {
    const permissions = this.getPermissions();
    if (!user || !user.role) {
      return permissions.livreur; // Permissions minimales par défaut
    }
    
    return permissions[user.role.toLowerCase()] || permissions.livreur;
  }

  /**
   * Vérifier si un utilisateur peut effectuer une action
   */
  static canPerformAction(user, action) {
    const permissions = this.getUserPermissions(user);
    return permissions[action] || false;
  }

  /**
   * Filtrer les fichiers selon les permissions de l'utilisateur
   */
  static filterFilesByPermissions(files, user) {
    const permissions = this.getUserPermissions(user);
    
    // Si l'utilisateur peut voir tous les fichiers
    if (permissions.canViewAll) {
      return files;
    }
    
    // Sinon, filtrer selon l'utilisateur propriétaire
    return files.filter(file => {
      // Logique de filtrage par propriétaire
      // Dans un vrai système, on vérifierait file.uploadedBy === user.id
      return file.uploadedBy === user.id || file.uploadedBy === user.nom;
    });
  }

  /**
   * Vérifier si un utilisateur peut accéder à un fichier spécifique
   */
  static canAccessFile(file, user, action = 'canView') {
    const permissions = this.getUserPermissions(user);
    
    // Vérifier d'abord la permission générale
    if (!permissions[action]) {
      return false;
    }
    
    // Si l'utilisateur peut voir tous les fichiers
    if (permissions.canViewAll) {
      return true;
    }
    
    // Sinon, vérifier la propriété du fichier
    return file.uploadedBy === user.id || file.uploadedBy === user.nom;
  }

  /**
   * Obtenir les actions disponibles pour un utilisateur sur un fichier
   */
  static getAvailableActions(file, user) {
    const permissions = this.getUserPermissions(user);
    const actions = [];

    if (this.canAccessFile(file, user, 'canView')) {
      actions.push('view', 'preview');
    }

    if (this.canAccessFile(file, user, 'canDownload')) {
      actions.push('download');
    }

    if (this.canAccessFile(file, user, 'canDelete')) {
      actions.push('delete');
    }

    if (this.canAccessFile(file, user, 'canRename')) {
      actions.push('rename');
    }

    return actions;
  }

  /**
   * Valider une action avant son exécution
   */
  static validateAction(action, file, user) {
    const availableActions = this.getAvailableActions(file, user);
    
    if (!availableActions.includes(action)) {
      throw new Error(`Action '${action}' non autorisée pour ce fichier`);
    }
    
    return true;
  }

  /**
   * Obtenir le message d'erreur approprié pour une action non autorisée
   */
  static getPermissionErrorMessage(action, user) {
    const role = user.role?.toLowerCase() || 'invité';
    
    const messages = {
      canUpload: `Les utilisateurs ${role} ne peuvent pas uploader de fichiers.`,
      canDelete: `Les utilisateurs ${role} ne peuvent pas supprimer de fichiers.`,
      canRename: `Les utilisateurs ${role} ne peuvent pas renommer de fichiers.`,
      canCreateFolder: `Les utilisateurs ${role} ne peuvent pas créer de dossiers.`,
      canView: `Vous n'avez pas accès à ce fichier.`,
      canDownload: `Vous ne pouvez pas télécharger ce fichier.`
    };
    
    return messages[action] || 'Action non autorisée.';
  }

  /**
   * Service wrapper pour les appels API avec gestion des permissions
   */
  static async executeWithPermissionCheck(action, user, ...args) {
    const permissions = this.getUserPermissions(user);
    
    if (!permissions[action]) {
      throw new Error(this.getPermissionErrorMessage(action, user));
    }

    // Mapping des actions vers les méthodes API
    const actionMap = {
      canView: () => api.get('/api/files/manager', ...args),
      canUpload: () => api.post('/api/files/upload', ...args),
      canDownload: (filePath) => api.get(`/api/files/download/${filePath}`),
      canDelete: (filePath) => api.delete(`/api/files/${filePath}`),
      canCreateFolder: () => api.post('/api/files/manager/folder', ...args),
      canRename: (filePath, newName) => api.put(`/api/files/rename/${filePath}`, { newName })
    };

    const apiCall = actionMap[action];
    if (!apiCall) {
      throw new Error('Action API non définie');
    }

    return await apiCall(...args);
  }
}

// Service principal pour la gestion des fichiers avec permissions
class FileManagerService {
  constructor() {
    this.currentUser = null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }

  async getFiles(params = {}) {
    try {
      const response = await FilePermissionService.executeWithPermissionCheck(
        'canView', 
        this.currentUser, 
        { params }
      );
      
      // Filtrer les fichiers selon les permissions
      if (response.data && response.data.data && response.data.data.items) {
        response.data.data.items = FilePermissionService.filterFilesByPermissions(
          response.data.data.items, 
          this.currentUser
        );
      }
      
      return response.data;
    } catch (error) {
      console.error('Erreur récupération fichiers:', error);
      throw error;
    }
  }

  async uploadFiles(files, metadata = {}) {
    try {
      return await FilePermissionService.executeWithPermissionCheck(
        'canUpload', 
        this.currentUser, 
        files, 
        metadata
      );
    } catch (error) {
      console.error('Erreur upload:', error);
      throw error;
    }
  }

  async downloadFile(filePath, file) {
    try {
      // Vérifier les permissions sur le fichier spécifique
      FilePermissionService.validateAction('download', file, this.currentUser);
      
      return await FilePermissionService.executeWithPermissionCheck(
        'canDownload', 
        this.currentUser, 
        filePath
      );
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      throw error;
    }
  }

  async deleteFile(filePath, file) {
    try {
      // Vérifier les permissions sur le fichier spécifique
      FilePermissionService.validateAction('delete', file, this.currentUser);
      
      return await FilePermissionService.executeWithPermissionCheck(
        'canDelete', 
        this.currentUser, 
        filePath
      );
    } catch (error) {
      console.error('Erreur suppression:', error);
      throw error;
    }
  }

  async renameFile(filePath, newName, file) {
    try {
      // Vérifier les permissions sur le fichier spécifique
      FilePermissionService.validateAction('rename', file, this.currentUser);
      
      return await FilePermissionService.executeWithPermissionCheck(
        'canRename', 
        this.currentUser, 
        filePath, 
        newName
      );
    } catch (error) {
      console.error('Erreur renommage:', error);
      throw error;
    }
  }

  async createFolder(folderData) {
    try {
      return await FilePermissionService.executeWithPermissionCheck(
        'canCreateFolder', 
        this.currentUser, 
        folderData
      );
    } catch (error) {
      console.error('Erreur création dossier:', error);
      throw error;
    }
  }

  async getStorageInfo() {
    try {
      const response = await api.get('/api/files/storage-info');
      return response.data;
    } catch (error) {
      console.error('Erreur info stockage:', error);
      throw error;
    }
  }

  // Méthodes utilitaires
  getUserPermissions() {
    return FilePermissionService.getUserPermissions(this.currentUser);
  }

  canPerformAction(action) {
    return FilePermissionService.canPerformAction(this.currentUser, action);
  }

  getAvailableActionsForFile(file) {
    return FilePermissionService.getAvailableActions(file, this.currentUser);
  }
}

// Instance singleton
const fileManagerService = new FileManagerService();

export default fileManagerService;
export { FilePermissionService };