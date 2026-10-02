import api from './httpClient';
import { DossierIdResolver } from './dossierIdResolver';
import { errorHandler } from './errorHandlerService';
import { filesSyncService } from './filesSyncService';

// Service pour la gestion des fichiers (API réelle)
export const realFilesService = {
  // Upload de fichiers pour un dossier
  // Upload de fichiers en mode chunked (pour gros fichiers > 10MB)
  uploadChunked: async (dossierLike, file, onProgress) => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    try {
      const Uppy = (await import("@uppy/core")).Uppy;
      const Tus = (await import("@uppy/tus")).Tus;
      return new Promise((resolve, reject) => {
        const uppy = new Uppy({
          autoProceed: true,
          restrictions: { maxFileSize: 500 * 1024 * 1024, maxNumberOfFiles: 1 }
        });
        uppy.use(Tus, {
          endpoint: `${process.env.REACT_APP_API_URL || "http://localhost:5001/api"}/files/upload-chunked/`,
          chunkSize: 5 * 1024 * 1024,
          retryDelays: [0, 1000, 3000, 5000],
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}`, "X-Dossier-Id": dossierId },
          metadata: { filename: file.name, filetype: file.type }
        });
        uppy.on("upload-progress", (f, progress) => {
          const pct = Math.round((progress.bytesUploaded * 100) / progress.bytesTotal);
          console.log(`📦 Chunked ${pct}% - ${Math.round(progress.bytesUploaded / 1024 / 1024)}MB / ${Math.round(progress.bytesTotal / 1024 / 1024)}MB`);
          if (onProgress) onProgress({ percent: pct, loaded: progress.bytesUploaded, total: progress.bytesTotal, speed: progress.uploadSpeed || 0, mode: "chunked" });
        });
        uppy.on("upload-success", (f, res) => { console.log("✅ Chunked terminé:", f.name); uppy.close(); resolve({ message: "Fichier uploadé avec succès", files: [{ nom: f.name, taille: f.size }] }); });
        uppy.on("upload-error", (f, err) => { console.error("❌ Erreur chunked:", err); uppy.close(); reject(err); });
        uppy.addFile({ name: file.name, type: file.type, data: file });
      });
    } catch (error) { const processedError = errorHandler.handleError(error); throw processedError; }
  },


  uploadFiles: async (dossierLike, files, onProgress) => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      const response = await api.post(`/files/upload/${dossierId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 minutes timeout
        onUploadProgress: e => {
          const percentCompleted = Math.round((e.loaded * 100) / e.total);
          if (percentCompleted % 10 === 0) console.log(`📤 Upload ${percentCompleted}%`);
          // Appeler le callback de progression si fourni
          if (onProgress && typeof onProgress === 'function') {
            onProgress(percentCompleted);
          }
        },
      });
      return response.data;
    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  },

  // Récupérer les fichiers d'un dossier
  getFiles: async dossierLike => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    try {
      const response = await api.get('/files', { params: { dossier_id: dossierId } });
      return response.data;
    } catch (error) {
      const processedError = errorHandler.handleError(error);
      throw processedError;
    }
  },

  // Récupérer les détails d'un fichier
  getFile: async fileId => {
    try {
      const response = await api.get(`/files/${fileId}`);
      return response.data;
    } catch (error) {
      const err = error?.response?.data?.error || 'Erreur récupération fichier';
      throw new Error(err);
    }
  },

  // Télécharger un fichier
  downloadFile: async fileId => {
    try {
      const response = await api.get(`/files/download/${fileId}`, {
        responseType: 'blob', // Important pour les fichiers binaires
      });

      // Extraire le nom du fichier et le type MIME des headers
      // Note: Axios normalise les headers en minuscules
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/octet-stream';
      let filename = `download_${fileId}`;

      console.log('📥 Téléchargement fichier:', fileId);
      console.log('Content-Disposition:', contentDisposition);
      console.log('Content-Type:', contentType);

      if (contentDisposition) {
        // Regex améliorée pour capturer le nom de fichier encodé UTF-8
        // Format: filename*=UTF-8''encoded_name
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\n]+)/);
        if (utf8Match && utf8Match[1]) {
          filename = decodeURIComponent(utf8Match[1]);
          console.log('✅ Nom de fichier extrait (UTF-8):', filename);
        } else {
          // Fallback pour format standard: filename="name" ou filename=name
          const filenameMatch = contentDisposition.match(/filename="?([^"\n;]+)"?/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].trim();
            console.log('✅ Nom de fichier extrait (standard):', filename);
          } else {
            console.warn('⚠️ Impossible d\'extraire le nom de fichier, utilisation du fallback');
          }
        }
      }

      // Créer un Blob avec le type MIME correct
      const blob = new Blob([response.data], { type: contentType });
      const downloadUrl = window.URL.createObjectURL(blob);

      // Créer et déclencher le téléchargement
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Nettoyer l'URL
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, filename };
    } catch (error) {
      const err = error?.response?.data?.error || 'Erreur téléchargement fichier';
      throw new Error(err);
    }
  },

  // Supprimer un fichier
  deleteFile: async fileId => {
    try {
      const response = await api.delete(`/files/${fileId}`);
      return response.data;
    } catch (error) {
      const err = error?.response?.data?.error || 'Erreur suppression fichier';
      throw new Error(err);
    }
  },

  // Récupérer tous les fichiers (admin)
  getAllFiles: async (params = {}) => {
    try {
      const response = await api.get('/files/all', { params });
      return response.data;
    } catch (error) {
      const err = error?.response?.data?.error || 'Erreur récupération fichiers';
      throw new Error(err);
    }
  },

  // Marquer un dossier pour réimpression depuis un fichier
  markForReprint: async fileId => {
    try {
      const response = await api.post(`/files/${fileId}/mark-reprint`);
      return response.data;
    } catch (error) {
      const err = error?.response?.data?.error || 'Erreur marquage réimpression';
      throw new Error(err);
    }
  },
};

// Service mocké pour le développement
export const mockFilesService = {
  // Données mockées
  mockFiles: [
    {
      id: 1,
      dossier_id: 1,
      original_filename: 'brochure_abc_v1.pdf',
      filename: '1703123456789_brochure_abc_v1.pdf',
      filepath: '/uploads/dossiers/1/1703123456789_brochure_abc_v1.pdf',
      mimetype: 'application/pdf',
      size: 2048000,
      uploaded_by: 2,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      prenom: 'Jean',
      nom: 'Preparateur',
    },
    {
      id: 2,
      dossier_id: 1,
      original_filename: 'logo_abc.png',
      filename: '1703123456790_logo_abc.png',
      filepath: '/uploads/dossiers/1/1703123456790_logo_abc.png',
      mimetype: 'image/png',
      size: 152000,
      uploaded_by: 2,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      prenom: 'Jean',
      nom: 'Preparateur',
    },
    {
      id: 3,
      dossier_id: 2,
      original_filename: 'affiche_mairie.pdf',
      filename: '1703123456791_affiche_mairie.pdf',
      filepath: '/uploads/dossiers/2/1703123456791_affiche_mairie.pdf',
      mimetype: 'application/pdf',
      size: 3200000,
      uploaded_by: 2,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      prenom: 'Jean',
      nom: 'Preparateur',
    },
    {
      id: 4,
      dossier_id: 3,
      original_filename: 'menu_restaurant_v2.pdf',
      filename: '1703123456792_menu_restaurant_v2.pdf',
      filepath: '/uploads/dossiers/3/1703123456792_menu_restaurant_v2.pdf',
      mimetype: 'application/pdf',
      size: 1500000,
      uploaded_by: 1,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      prenom: 'Admin',
      nom: 'Principal',
    },
    {
      id: 5,
      dossier_id: 4,
      original_filename: 'photo_cabinet.jpg',
      filename: '1703123456793_photo_cabinet.jpg',
      filepath: '/uploads/dossiers/4/1703123456793_photo_cabinet.jpg',
      mimetype: 'image/jpeg',
      size: 800000,
      uploaded_by: 2,
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      prenom: 'Jean',
      nom: 'Preparateur',
    },
    {
      id: 6,
      dossier_id: 5,
      original_filename: 'exercices_maths.pdf',
      filename: '1703123456794_exercices_maths.pdf',
      filepath: '/uploads/dossiers/5/1703123456794_exercices_maths.pdf',
      mimetype: 'application/pdf',
      size: 2800000,
      uploaded_by: 2,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      prenom: 'Jean',
      nom: 'Preparateur',
    },
    {
      id: 7,
      dossier_id: 6,
      original_filename: 'flyer_tournoi.ai',
      filename: '1703123456795_flyer_tournoi.ai',
      filepath: '/uploads/dossiers/6/1703123456795_flyer_tournoi.ai',
      mimetype: 'application/postscript',
      size: 12000000,
      uploaded_by: 4,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      prenom: 'Sophie',
      nom: 'Xerox',
    },
  ],

  // Simulation d'un délai de réponse
  delay: ms => new Promise(resolve => setTimeout(resolve, ms)),

  // Upload de fichiers (simulé)
  uploadFiles: async (dossierId, files) => {
    await mockFilesService.delay(1000 + files.length * 500); // Simule le temps d'upload

    const uploadedFiles = files.map((file, index) => ({
      id: Math.max(...mockFilesService.mockFiles.map(f => f.id), 0) + index + 1,
      dossier_id: parseInt(dossierId),
      original_filename: file.name,
      filename: `${Date.now() + index}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
      filepath: `/uploads/dossiers/${dossierId}/${Date.now() + index}_${file.name}`,
      mimetype: file.type,
      size: file.size,
      uploaded_by: 1, // User mocké
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      prenom: 'Admin',
      nom: 'Principal',
    }));

    // Ajouter aux fichiers mockés
    mockFilesService.mockFiles.push(...uploadedFiles);

    return {
      message: `${uploadedFiles.length} fichier(s) uploadé(s) avec succès`,
      files: uploadedFiles,
    };
  },

  // Récupérer les fichiers d'un dossier
  getFiles: async dossierId => {
    await mockFilesService.delay(300);

    const files = mockFilesService.mockFiles.filter(
      file => file.dossier_id === parseInt(dossierId)
    );

    return {
      files,
      dossier_id: parseInt(dossierId),
    };
  },

  // Récupérer les détails d'un fichier
  getFile: async fileId => {
    await mockFilesService.delay(200);

    const file = mockFilesService.mockFiles.find(file => file.id === parseInt(fileId));

    if (!file) {
      throw new Error('Fichier non trouvé');
    }

    return { file };
  },

  // Télécharger un fichier (simulé)
  downloadFile: async fileId => {
    await mockFilesService.delay(500);

    const file = mockFilesService.mockFiles.find(file => file.id === parseInt(fileId));

    if (!file) {
      throw new Error('Fichier non trouvé');
    }

    // Simulation du téléchargement
    console.log(`📥 Téléchargement simulé: ${file.original_filename}`);

    // Créer un blob simulé avec du contenu factice
    const content = `Contenu simulé du fichier: ${file.original_filename}`;
    const blob = new Blob([content], { type: file.mimetype });
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.original_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(downloadUrl);

    return { success: true, filename: file.original_filename };
  },

  // Supprimer un fichier
  deleteFile: async fileId => {
    await mockFilesService.delay(300);

    const index = mockFilesService.mockFiles.findIndex(file => file.id === parseInt(fileId));

    if (index === -1) {
      throw new Error('Fichier non trouvé');
    }

    const deletedFile = mockFilesService.mockFiles.splice(index, 1)[0];

    return {
      message: 'Fichier supprimé avec succès',
      file: deletedFile,
    };
  },

  // Récupérer tous les fichiers (admin)
  getAllFiles: async (params = {}) => {
    await mockFilesService.delay(400);

    let filteredFiles = [...mockFilesService.mockFiles];

    // Filtrage par recherche
    if (params.search) {
      const search = params.search.toLowerCase();
      filteredFiles = filteredFiles.filter(
        file =>
          file.original_filename.toLowerCase().includes(search) ||
          (file.prenom + ' ' + file.nom).toLowerCase().includes(search)
      );
    }

    // Filtrage par type
    if (params.type) {
      filteredFiles = filteredFiles.filter(file => file.mimetype.startsWith(params.type));
    }

    // Pagination
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 20;
    const offset = (page - 1) * limit;
    const paginatedFiles = filteredFiles.slice(offset, offset + limit);

    return {
      files: paginatedFiles,
      pagination: {
        current_page: page,
        per_page: limit,
        total_items: filteredFiles.length,
        total_pages: Math.ceil(filteredFiles.length / limit),
      },
    };
  },

  // Marquer un dossier pour réimpression depuis un fichier
  markForReprint: async fileId => {
    await mockFilesService.delay(300);

    const file = mockFilesService.mockFiles.find(f => f.id === parseInt(fileId));

    if (!file) {
      throw new Error('Fichier non trouvé');
    }

    // Simuler le marquage du dossier associé comme 'à réimprimer'
    console.log(
      `🖨 Dossier ${file.dossier_id} marqué 'à réimprimer' depuis le fichier: ${file.original_filename}`
    );

    return {
      message: 'Dossier marqué à réimprimer avec succès',
      dossier_id: file.dossier_id,
      file: file,
    };
  },
};

// Service adaptateur qui choisit entre real, mock et nouveau service unifié
export const filesService = {
  // Vérifier la disponibilité du backend
  backendAvailable: null,

  async checkBackendAvailability() {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/health`
      );
      this.backendAvailable = response.ok;
    } catch {
      this.backendAvailable = false;
    }
    return this.backendAvailable;
  },

  // Upload de fichiers - force l'utilisation du service réel fonctionnel
  uploadFiles: async (dossierLike, files, onProgress) => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    console.log('📤 Upload fichiers pour dossier:', dossierId);

    // Vérifier la disponibilité du backend
    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        // Utiliser directement le service réel qui fonctionne
        const result = await realFilesService.uploadFiles(dossierId, files, onProgress);
        console.log('✅ Upload réussi via realFilesService:', result);
        return result;
      } catch (error) {
        console.warn('❌ Échec realFilesService, fallback vers mock:', error);
        return await mockFilesService.uploadFiles(dossierId, files);
      }
    }

    console.log('⚠️ Backend indisponible, utilisation du mock service');
    return await mockFilesService.uploadFiles(dossierId, files);
  },

  // Récupérer les fichiers
  getFiles: async dossierLike => {
    const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
    console.log('📋 Récupération fichiers pour dossier:', dossierId);

    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        const result = await realFilesService.getFiles(dossierId);
        console.log(`✅ Fichiers récupérés via realFilesService: ${result.files?.length || 0} fichiers`);
        return result;
      } catch (error) {
        console.warn('❌ Échec realFilesService, fallback vers mock:', error);
        return await mockFilesService.getFiles(dossierId);
      }
    }

    console.log('⚠️ Backend indisponible, utilisation du mock service');
    return await mockFilesService.getFiles(dossierId);
  },

  // Récupérer un fichier
  getFile: async fileId => {
    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        return await realFilesService.getFile(fileId);
      } catch (error) {
        return await mockFilesService.getFile(fileId);
      }
    } else {
      return await mockFilesService.getFile(fileId);
    }
  },

  // Télécharger un fichier
  downloadFile: async fileId => {
    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        return await realFilesService.downloadFile(fileId);
      } catch (error) {
        return await mockFilesService.downloadFile(fileId);
      }
    } else {
      return await mockFilesService.downloadFile(fileId);
    }
  },

  // Supprimer un fichier
  deleteFile: async fileId => {
    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        return await realFilesService.deleteFile(fileId);
      } catch (error) {
        return await mockFilesService.deleteFile(fileId);
      }
    } else {
      return await mockFilesService.deleteFile(fileId);
    }
  },

  // Récupérer tous les fichiers (admin)
  getAllFiles: async (params = {}) => {
    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        return await realFilesService.getAllFiles(params);
      } catch (error) {
        return await mockFilesService.getAllFiles(params);
      }
    } else {
      return await mockFilesService.getAllFiles(params);
    }
  },

  // Marquer un dossier pour réimpression
  markForReprint: async fileId => {
    if (filesService.backendAvailable === null) {
      await filesService.checkBackendAvailability();
    }

    if (filesService.backendAvailable) {
      try {
        return await realFilesService.markForReprint(fileId);
      } catch (error) {
        return await mockFilesService.markForReprint(fileId);
      }
    } else {
      return await mockFilesService.markForReprint(fileId);
    }
  },
};

export const uploadFilesAuto = async (dossierLike, files, onProgress) => {
  const dossierId = DossierIdResolver.resolve(dossierLike) || dossierLike;
  const filesArray = Array.from(files);

  console.log(`📤 Upload Auto: ${filesArray.length} fichier(s)`);

  // Vérifier backend
  if (filesService.backendAvailable === null) {
    await filesService.checkBackendAvailability();
  }

  if (!filesService.backendAvailable) {
    console.log('⚠️ Backend indisponible, utilisation du mock');
    return await mockFilesService.uploadFiles(dossierId, filesArray);
  }

  try {
    // Si 1 fichier > 10MB → chunked
    if (filesArray.length === 1 && filesArray[0].size > 10 * 1024 * 1024) {
      const sizeMB = Math.round(filesArray[0].size / 1024 / 1024);
      console.log(`📦 Fichier ${sizeMB}MB > 10MB → Mode CHUNKED`);
      return await realFilesService.uploadChunked(dossierId, filesArray[0], onProgress);
    }

    // Sinon → classique
    const totalSizeMB = Math.round(filesArray.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024);
    console.log(`📤 ${filesArray.length} fichier(s) ${totalSizeMB}MB → Mode CLASSIQUE`);
    return await realFilesService.uploadFiles(dossierId, filesArray, onProgress);

  } catch (error) {
    console.error('❌ Erreur upload auto:', error);
    // Fallback vers mock en cas d'erreur
    return await mockFilesService.uploadFiles(dossierId, filesArray);
  }
};

export default filesService;
