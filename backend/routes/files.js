const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { getDossierByIdentifier, checkDossierPermission } = require('../middleware/permissions');
const { isValidUUID, isValidId, validateIdParam } = require('../utils/validators');
const router = express.Router();

const rateLimit = require('express-rate-limit');
const filesLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 requêtes par IP
  message: {
    error: 'Trop de requêtes sur les fichiers, veuillez patienter.',
  },
});

// Middleware d'authentification et de rate limiting pour toutes les routes
router.use(authenticateToken);
router.use(filesLimiter);

// ================================
// ROUTES GESTIONNAIRE DE FICHIERS ADMIN
// ================================

// GET /api/files/manager - API pour le gestionnaire de fichiers admin
router.get('/manager', authorizeRoles('admin'), async (req, res) => {
  try {
    const { path: requestPath = '', search = '', machine = '', type = '' } = req.query;
    const uploadsDir = path.join(path.dirname(process.cwd()), 'uploads');
    
    // Fonction récursive pour scanner les dossiers
    async function scanDirectory(dirPath, relativePath = '') {
      const items = [];
      
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const itemPath = path.join(relativePath, entry.name);
          
          if (entry.isDirectory()) {
            const children = await scanDirectory(fullPath, itemPath);
            items.push({
              type: 'folder',
              name: entry.name,
              path: itemPath,
              children,
              fileCount: children.filter(c => c.type === 'file').length
            });
          } else {
            const stats = await fs.stat(fullPath);
            items.push({
              type: 'file',
              name: entry.name,
              path: itemPath,
              size: stats.size,
              modified: stats.mtime,
              extension: path.extname(entry.name).toLowerCase(),
              dossier: path.dirname(itemPath)
            });
          }
        }
      } catch (error) {
        console.error(`Erreur lecture dossier ${dirPath}:`, error);
      }
      
      return items;
    }
    
    const targetDir = requestPath ? path.join(uploadsDir, requestPath) : uploadsDir;
    
    // Vérifier la sécurité du chemin
    const normalizedPath = path.normalize(targetDir);
    if (!normalizedPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Chemin non autorisé' });
    }
    
    let items = await scanDirectory(targetDir, requestPath);
    
    // Filtres
    if (search) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (machine) {
      items = items.filter(item => 
        item.path.toLowerCase().includes(machine.toLowerCase())
      );
    }
    
    if (type) {
      items = items.filter(item => 
        item.type === type || 
        (type === 'image' && item.extension && ['.jpg', '.jpeg', '.png', '.gif'].includes(item.extension)) ||
        (type === 'pdf' && item.extension === '.pdf') ||
        (type === 'document' && item.extension && ['.doc', '.docx', '.txt'].includes(item.extension))
      );
    }
    
    // Calculer l'espace de stockage utilisé
    const totalSize = items
      .filter(item => item.type === 'file')
      .reduce((sum, file) => sum + file.size, 0);
    
    res.json({
      success: true,
      data: {
        items,
        currentPath: requestPath,
        totalItems: items.length,
        totalSize
      }
    });
    
  } catch (error) {
    console.error('Erreur listing fichiers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des fichiers' 
    });
  }
});

// GET /api/files/storage-info - Informations sur l'espace de stockage
router.get('/storage-info', authorizeRoles('admin'), async (req, res) => {
  try {
    const uploadsDir = path.join(path.dirname(process.cwd()), 'uploads');
    
    // Calculer récursivement la taille de tous les fichiers
    async function calculateDirSize(dirPath) {
      let totalSize = 0;
      let fileCount = 0;
      
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            const { size, count } = await calculateDirSize(fullPath);
            totalSize += size;
            fileCount += count;
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
            fileCount++;
          }
        }
      } catch (error) {
        console.error(`Erreur calcul taille ${dirPath}:`, error);
      }
      
      return { size: totalSize, count: fileCount };
    }
    
    const { size: usedSpace, count: totalFiles } = await calculateDirSize(uploadsDir);
    const totalSpace = 50 * 1024 * 1024 * 1024; // 50GB simulé
    
    res.json({
      success: true,
      data: {
        usedSpace,
        totalSpace,
        freeSpace: totalSpace - usedSpace,
        usagePercentage: (usedSpace / totalSpace) * 100,
        totalFiles
      }
    });
    
  } catch (error) {
    console.error('Erreur calcul stockage:', error);
    res.status(500).json({ error: 'Erreur lors du calcul de l\'espace de stockage' });
  }
});

// POST /api/files/manager/folder - Créer un nouveau dossier
router.post('/manager/folder', authorizeRoles('admin'), async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nom du dossier requis' });
    }
    
    const uploadsDir = path.join(path.dirname(process.cwd()), 'uploads');
    const targetPath = folderPath 
      ? path.join(uploadsDir, folderPath, name.trim())
      : path.join(uploadsDir, name.trim());
    
    // Vérifications de sécurité
    const normalizedPath = path.normalize(targetPath);
    if (!normalizedPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Chemin non autorisé' });
    }
    
    // Vérifier que le dossier n'existe pas déjà
    try {
      await fs.access(targetPath);
      return res.status(409).json({ error: 'Le dossier existe déjà' });
    } catch {
      // Le dossier n'existe pas, on peut le créer
    }
    
    await fs.mkdir(targetPath, { recursive: true });
    
    res.json({
      success: true,
      message: 'Dossier créé avec succès',
      data: {
        name: name.trim(),
        path: path.relative(uploadsDir, targetPath)
      }
    });
    
  } catch (error) {
    console.error('Erreur création dossier:', error);
    res.status(500).json({ error: 'Erreur lors de la création du dossier' });
  }
});

// ================================
// CONFIGURATION MULTER
// ================================

// Configuration du stockage multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const providedId = req.params.dossierId || req.body.dossierId;
      if (!providedId) return cb(new Error('Dossier ID requis pour upload'));
      // Résoudre l'identifiant et normaliser sur folder_id
      const dossier = await getDossierByIdentifier(providedId);
      if (!dossier) return cb(new Error('Dossier non trouvé'));
      const folderName = dossier.folder_id || String(dossier.id);
      // Standardiser le chemin: uploads/dossiers/<folder_id>
      const dossierDir = path.join(path.dirname(process.cwd()), 'uploads', 'dossiers', folderName);
      await fs.mkdir(dossierDir, { recursive: true });
      cb(null, dossierDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Générer un nom unique avec timestamp
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
    cb(null, `${timestamp}_${safeName}${ext}`);
  },
});

// Filtre pour les types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  // Types de fichiers autorisés pour l'imprimerie
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/postscript', // .ai files
    'application/illustrator',
    'image/svg+xml',
    'application/zip',
    'application/x-rar-compressed',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Type de fichier non autorisé. Types acceptés: PDF, Images (JPG, PNG, GIF), AI, SVG, ZIP, RAR, TXT, DOC, DOCX'
      ),
      false
    );
  }
};

// Configuration multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
    files: 10, // 10 fichiers max par upload
  },
  fileFilter: fileFilter,
});

// ✅ AJOUT: Fonction de vérification des permissions d'upload
const checkUploadPermissions = (userRole, dossier) => {
  // Admin peut toujours uploader
  if (userRole === 'admin') return true;
  
  // Préparateur peut uploader sur ses dossiers non validés
  if (userRole === 'preparateur') {
    // Vérifier que le dossier n'est pas validé
    const isValidated = dossier.valide_preparateur || dossier['valide_preparateur'];
    return !isValidated;
  }
  
  // Autres rôles ne peuvent pas uploader
  return false;
};

// ✅ AJOUT: Fonction de vérification des permissions de visualisation
// Fonction supprimée - utilise maintenant le middleware unifié checkDossierPermission

// ================================
// ROUTES FICHIERS
// ================================

// Middleware de gestion d'erreurs multer
const handleMulterError = (error, req, res, next) => {
  console.error('❌ Erreur multer détectée:', {
    code: error.code,
    message: error.message,
    field: error.field,
    dossierId: req.params?.dossierId,
    userId: req.user?.id,
  });

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          error: 'Fichier trop volumineux. Taille maximale: 500MB',
          code: 'FILE_TOO_LARGE',
          maxSize: '500MB',
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(413).json({
          error: 'Trop de fichiers. Maximum: 10 fichiers par upload',
          code: 'TOO_MANY_FILES',
          maxFiles: 10,
        });
      case 'LIMIT_FIELD_COUNT':
        return res.status(413).json({
          error: 'Trop de champs dans la requête',
          code: 'TOO_MANY_FIELDS',
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Champ de fichier inattendu: ' + error.field,
          code: 'UNEXPECTED_FILE_FIELD',
        });
      default:
        return res.status(400).json({
          error: "Erreur lors de l'upload: " + error.message,
          code: 'MULTER_ERROR',
        });
    }
  }

  // Erreurs de filtrage de fichiers
  if (error.message && error.message.includes('Type de fichier non autorisé')) {
    return res.status(415).json({
      error: error.message,
      code: 'INVALID_FILE_TYPE',
    });
  }

  // Autres erreurs
  return res.status(500).json({
    error: "Erreur interne lors de l'upload",
    code: 'UPLOAD_INTERNAL_ERROR',
  });
};

// Middleware pour vérifier l'accès au fichier via le dossier associé
const checkFileAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const fileResult = await query('SELECT * FROM fichiers WHERE id = $1', [id]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Fichier non trouvé',
        code: 'FILE_NOT_FOUND',
      });
    }
    
    const file = fileResult.rows[0];
    
    // Récupérer le dossier associé et vérifier les permissions
    const dossier = await getDossierByIdentifier(file.dossier_id);
    
    if (!dossier) {
      return res.status(404).json({
        error: 'Dossier associé non trouvé', 
        code: 'ASSOCIATED_DOSSIER_NOT_FOUND',
      });
    }
    
    // Vérifier les permissions avec canAccessDossier
    const { canAccessDossier } = require('../middleware/permissions');
    const hasAccess = canAccessDossier(req.user, dossier, 'access_files');
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Accès refusé à ce fichier',
        code: 'ACCESS_DENIED',
      });
    }
    
    // Passer le fichier et dossier au handler suivant
    req.file = file;
    req.dossier = dossier;
    next();
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification d\'accès au fichier:', error);
    res.status(500).json({
      error: 'Erreur interne lors de la vérification des permissions',
      code: 'PERMISSION_CHECK_ERROR',
    });
  }
};

// POST /api/files/upload/:dossierId - Upload de fichiers pour un dossier
router.post(
  '/upload/:dossierId',
  (req, res, next) => {
    // ✅ VALIDATION UUID PRÉCOCE avant Multer
    const dossierId = req.params.dossierId;
    if (!dossierId || typeof dossierId !== 'string' || dossierId.trim() === '') {
      console.error('❌ ID dossier manquant');
      return res.status(400).json({
        error: 'ID du dossier requis',
        code: 'MISSING_DOSSIER_ID',
      });
    }
    
    // Valider le format UUID ou ID entier
    if (!isValidId(dossierId)) {
      console.error('❌ Format ID dossier invalide:', dossierId.substring(0, 50));
      return res.status(400).json({
        error: 'Format ID du dossier invalide (UUID ou entier attendu)',
        code: 'INVALID_DOSSIER_ID_FORMAT',
        details: 'Le dossier ID doit être un UUID valide ou un entier positif',
      });
    }
    
    next();
  },
  upload.array('files', 10),
  handleMulterError,
  async (req, res) => {
    console.log(
      `📁 Début upload pour dossier ${req.params.dossierId} par utilisateur ${req.user?.id} (${req.user?.role})`
    );

    try {
      const dossierId = req.params.dossierId;

      if (!req.user) {
        console.error('❌ Utilisateur non authentifié pour upload');
        return res.status(401).json({
          error: 'Authentification requise',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const { role, id: userId } = req.user;

      // Vérifier que le dossier existe en utilisant notre fonction qui gère tous les formats d'ID
      const dossier = await getDossierByIdentifier(dossierId);
      
      if (!dossier) {
        return res.status(404).json({
          error: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
          code: 'DOSSIER_NOT_FOUND',
        });
      }
      
      console.log(`✅ Dossier trouvé: ${dossier.numero} (ID: ${dossier.id}, Folder: ${dossier.folder_id})`);

      // Normaliser les propriétés pour la fonction de permissions
      dossier.status = dossier.statut;
      dossier.type = dossier.type_formulaire;

      // Vérifier les permissions d'upload avec le système unifié
      const { canAccessDossier } = require('../middleware/permissions');
      const canUpload = canAccessDossier(req.user, dossier, 'upload_file');
      if (!canUpload) {
        return res.status(403).json({
          error: 'Permission refusée pour uploader des fichiers sur ce dossier',
          code: 'UPLOAD_PERMISSION_DENIED',
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'Aucun fichier fourni',
          code: 'NO_FILES_PROVIDED',
        });
      }

      const savedFiles = [];

// Enregistrer chaque fichier en base
      for (const file of req.files) {
        try {
          // ✅ Chemin unifié basé sur folder_id
          const relativePath = `uploads/dossiers/${dossier.folder_id}/${file.filename}`;
          
          const fileData = {
            dossier_id: dossier.id,
            original_filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
            filename: file.filename,
            filepath: relativePath,  // ✅ CHANGÉ: était file.path (absolu)
            mimetype: file.mimetype,
            size: file.size,
            uploaded_by: userId,
          };

          const insertResult = await query(
            `INSERT INTO fichiers 
           (dossier_id, nom, chemin, type, taille, uploaded_by, mime_type, extension, checksum) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           RETURNING *`,
            [
              fileData.dossier_id,
              fileData.original_filename,
              fileData.filepath,
              fileData.mimetype.startsWith('image/') ? 'image' : 'document',
              fileData.size,
              fileData.uploaded_by,
              fileData.mimetype,
              path.extname(fileData.original_filename).toLowerCase(),
              'temp-checksum', // Placeholder pour le checksum
            ]
          );

          savedFiles.push(insertResult.rows[0]);
        } catch (fileError) {
          console.error('Erreur insertion fichier:', fileError);
          // Supprimer le fichier physique en cas d'erreur DB
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error('Erreur suppression fichier:', unlinkError);
          }
          throw fileError;
        }
      }

      // Mettre à jour la date de modification du dossier (utiliser l'UUID principal)
      await query('UPDATE dossiers SET updated_at = NOW() WHERE id = $1', [dossier.id]);

      res.status(201).json({
        message: `${savedFiles.length} fichier(s) uploadé(s) avec succès`,
        files: savedFiles,
      });

      console.log(`✅ Upload réussi: ${savedFiles.length} fichiers pour dossier ${dossierId}`);

      // Notification temps réel pour les fichiers uploadés
      if (global.notificationService) {
        global.notificationService.notifyFileUploaded(dossier, savedFiles, {
          userId: req.user.id,
          role: req.user.role,
          prenom: req.user.prenom,
          nom: req.user.nom,
        });
      }
    } catch (error) {
      console.error('❌ Erreur upload fichiers:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        dossierId: req.params.dossierId,
        userId: req.user?.id,
        filesCount: req.files?.length || 0,
      });

      // Supprimer les fichiers uploadés en cas d'erreur
      if (req.files && Array.isArray(req.files)) {
        console.log(`🧹 Nettoyage de ${req.files.length} fichiers temporaires...`);
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
            console.log(`✅ Fichier temporaire supprimé: ${file.filename}`);
          } catch (unlinkError) {
            console.error('⚠️ Erreur suppression fichier temporaire:', unlinkError.message);
          }
        }
      }

      // Déterminer le type d'erreur et le statut approprié
      let statusCode = 500;
      let errorCode = 'UPLOAD_ERROR';
      let errorMessage = error.message || "Erreur lors de l'upload des fichiers";

      // Erreurs spécifiques de multer
      if (error.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        errorCode = 'FILE_TOO_LARGE';
        errorMessage = 'Fichier trop volumineux (max 500MB)';
      } else if (error.code === 'LIMIT_FILE_COUNT') {
        statusCode = 413;
        errorCode = 'TOO_MANY_FILES';
        errorMessage = 'Trop de fichiers (max 10 fichiers)';
      } else if (error.message && error.message.includes('Type de fichier non autorisé')) {
        statusCode = 415;
        errorCode = 'INVALID_FILE_TYPE';
        errorMessage = error.message;
      } else if (error.code === 'ENOENT') {
        statusCode = 500;
        errorCode = 'STORAGE_ERROR';
        errorMessage = 'Erreur de stockage des fichiers';
      }

      res.status(statusCode).json({
        error: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      });
    }
  }
);

// GET /api/files - Liste des fichiers (selon les dossiers accessibles)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { dossier_id } = req.query;

    if (!dossier_id) {
      return res.status(400).json({
        error: 'ID du dossier requis',
        code: 'MISSING_DOSSIER_ID',
      });
    }

    // Vérifier l'accès au dossier avec support des différents formats d'ID
    const dossier = await getDossierByIdentifier(dossier_id);

    if (!dossier) {
      return res.status(404).json({
        error: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
        code: 'DOSSIER_NOT_FOUND',
      });
    }

    // Vérifier les permissions avec le middleware unifié
    const { canAccessDossier } = require('../middleware/permissions');
    const hasAccess = canAccessDossier(req.user, dossier, 'access_files');
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Accès refusé à ce dossier',
        code: 'ACCESS_DENIED',
      });
    }

    // Récupérer les fichiers en SELECT * puis normaliser côté JS pour compat des schémas
    const rawResult = await query('SELECT * FROM fichiers WHERE dossier_id = $1', [dossier.id]);

    // Normaliser les champs attendus par le frontend
    const normalize = r => ({
      id: r.id,
      dossier_id: r.dossier_id,
      original_filename: r.nom || r.original_filename || r.stored_filename || r.filename || null,
      filename: r.nom || r.filename || r.stored_filename || null,
      filepath: r.chemin || r.filepath || null,
      mimetype: r.mime_type || r.mimetype || 'application/octet-stream',
      size: r.taille || r.size || 0,
      uploaded_by: r.uploaded_by || r.uploadedBy || r.uploader_id || null,
      created_at: r.uploaded_at || r.created_at || r.createdAt || null,
      prenom: r.prenom || null,
      nom: r.nom_uploader || r.nom || null,
    });

    const files = rawResult.rows.map(normalize).sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    res.status(200).json({
      files,
      dossier_id: String(dossier_id),
    });
  } catch (error) {
    console.error('❌ Erreur récupération fichiers:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/files/:id - Détails d'un fichier
router.get('/:id', authenticateToken, validateIdParam('id'), checkFileAccess, async (req, res) => {
  try {
    // Le fichier et dossier ont été vérifiés par checkFileAccess
    const file = req.file;

    // Normaliser sortie fichier pour compatibilité
    const normalized = {
      id: file.id,
      dossier_id: file.dossier_id,
      original_filename:
        file.nom_original ||
        file.original_filename ||
        file.nom ||
        file.stored_filename ||
        file.filename ||
        null,
      filename: file.nom_fichier || file.filename || file.stored_filename || null,
      filepath: file.chemin_stockage || file.filepath || file.chemin || null,
      mimetype: file.type_mime || file.mimetype || file.type || null,
      size: file.taille_bytes || file.size || file.taille || 0,
      uploaded_by: file.uploaded_by || file.uploadedBy || file.uploader_id || null,
      created_at: file.created_at || file.uploaded_at || file.createdAt || null,
    };

    res.status(200).json({
      file: normalized,
    });
  } catch (error) {
    console.error('❌ Erreur récupération fichier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /api/files/:id - Supprimer un fichier (admin, preparateur)
router.delete('/:id', validateIdParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    // Seuls admin et preparateur peuvent supprimer des fichiers
    if (!['admin', 'preparateur'].includes(role)) {
      return res.status(403).json({
        error: 'Permission insuffisante pour supprimer des fichiers',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const fileResult = await query('SELECT * FROM fichiers WHERE id = $1', [id]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Fichier non trouvé',
        code: 'FILE_NOT_FOUND',
      });
    }

    const file = fileResult.rows[0];

    // Vérifier que le dossier est encore modifiable (pour le preparateur)
    if (role === 'preparateur') {
      const dossierResult = await query('SELECT statut FROM dossiers WHERE id = $1', [
        file.dossier_id,
      ]);

      if (dossierResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Dossier associé non trouvé',
          code: 'ASSOCIATED_DOSSIER_NOT_FOUND',
        });
      }

      const dossierStatut = dossierResult.rows[0].statut;
      // Vérifier avec les valeurs DB correctes
      const modifiableStatuts = ['En cours', 'À revoir', 'en_cours', 'a_revoir'];
      if (!modifiableStatuts.includes(dossierStatut)) {
        return res.status(403).json({
          error: "Le dossier n'est plus modifiable (statut: " + dossierStatut + ')',
          code: 'DOSSIER_NOT_MODIFIABLE',
        });
      }
    }

    // Supprimer le fichier de la base de données
    await query('DELETE FROM fichiers WHERE id = $1', [id]);

    // Supprimer physiquement si possible
    try {
      const filePath = file.chemin_stockage || file.filepath || file.chemin;
      if (filePath) {
        // ✅ CORRECTION: Convertir en absolu si relatif
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(path.dirname(process.cwd()), filePath);
        await fs.unlink(absolutePath);
        console.log(`✅ Fichier physique supprimé: ${filePath}`);
      }
    } catch (unlinkErr) {
      console.warn('⚠️ Impossible de supprimer le fichier physique:', unlinkErr.message);
    }

    res.status(200).json({
      message: 'Fichier supprimé avec succès',
    });

    console.log(`✅ Fichier supprimé: ${file.nom_fichier} (ID: ${id})`);
  } catch (error) {
    console.error('❌ Erreur suppression fichier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/files/all - Liste de tous les fichiers (Admin uniquement)
router.get('/all', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentification requise',
        code: 'AUTH_REQUIRED',
      });
    }
    const { role, id: userId } = req.user;
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;
    if (role !== 'admin') {
      // Préparateur : fichiers de ses dossiers
      if (role === 'preparateur') {
        whereClause += ` AND d.preparateur_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }
      // Imprimeur Roland : fichiers des dossiers Roland
      if (role === 'imprimeur_roland') {
        whereClause += ` AND d.machine = 'Roland'`;
      }
      // Imprimeur Xerox : fichiers des dossiers Xerox
      if (role === 'imprimeur_xerox') {
        whereClause += ` AND d.machine = 'Xerox'`;
      }
      // Livreur : fichiers des dossiers à livrer
      if (role === 'livreur') {
        whereClause += ` AND d.statut IN ('Prêt livraison', 'En livraison', 'Livré')`;
      }
    }

    const {
      search = '',
      type = '',
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construire la requête avec filtres
    // (variables déjà déclarées plus haut)

    // Filtrage par recherche (nom de fichier ou client) avec compat colonnes
    if (search) {
      whereClause += ` AND ((COALESCE(f.nom_original, f.original_filename, f.nom, f.stored_filename)) ILIKE $${paramIndex} OR d.client ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filtrage par type MIME (compat colonnes)
    if (type) {
      whereClause += ` AND COALESCE(f.type_mime, f.mimetype, f.type) LIKE $${paramIndex}`;
      queryParams.push(`${type}%`);
      paramIndex++;
    }

    // Valider les colonnes de tri
    const allowedSortColumns = [
      'created_at',
      'nom_original',
      'taille_bytes',
      'type_mime',
      'client',
    ];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : 'DESC';

    // Expressions de tri compatibles schéma
    const sortExprMap = {
      created_at: 'COALESCE(f.created_at, f.uploaded_at)',
      nom_original: 'COALESCE(f.nom_original, f.original_filename, f.nom)',
      taille_bytes: 'COALESCE(f.taille_bytes, f.size, f.taille)',
      type_mime: 'COALESCE(f.type_mime, f.mimetype, f.type)',
      client: 'd.client',
    };
    const orderByColumn = sortExprMap[validSortBy] || sortExprMap.created_at;

    // Requête principale avec jointure et projection normalisée
    const filesQuery = `
      SELECT 
        f.id,
        f.dossier_id,
        ${sortExprMap.nom_original} AS original_filename,
        COALESCE(f.nom_fichier, f.filename, f.stored_filename) AS filename,
        COALESCE(f.chemin_stockage, f.filepath, f.chemin) AS filepath,
        ${sortExprMap.type_mime} AS mimetype,
        ${sortExprMap.taille_bytes} AS size,
        ${sortExprMap.created_at} AS created_at,
        u.nom as uploader_nom,
        d.numero as dossier_numero,
        d.client as dossier_client,
        d.statut as dossier_statut
      FROM fichiers f
      LEFT JOIN dossiers d ON f.dossier_id = d.id
      LEFT JOIN users u ON f.uploaded_by = u.id
      ${whereClause}
      ORDER BY ${orderByColumn} ${validSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(parseInt(limit), offset);

    // Requête pour compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM fichiers f
      LEFT JOIN dossiers d ON f.dossier_id = d.id
      ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2); // Enlever limit et offset pour le count

    // Exécuter les requêtes
    const [filesResult, countResult] = await Promise.all([
      query(filesQuery, queryParams),
      query(countQuery, countParams),
    ]);

    const files = filesResult.rows;
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    // Vérifier l'existence physique des fichiers (optionnel, peut être coûteux)
    const filesWithStatus = await Promise.all(
      files.map(async file => {
        let physicalExists = true;
        try {
          const filePath = file.chemin_stockage || file.filepath || file.chemin;
          if (filePath) {
            // ✅ CORRECTION: Convertir en absolu si relatif pour vérification
            const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(path.dirname(process.cwd()), filePath);
            await fs.access(absolutePath);
          } else {
            physicalExists = false;
          }
        } catch (error) {
          physicalExists = false;
        }

        return {
          ...file,
          physical_exists: physicalExists,
        };
      })
    );

    res.status(200).json({
      files: filesWithStatus,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_items: totalItems,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1,
      },
      filters: {
        search,
        type,
        sortBy: validSortBy,
        sortOrder: validSortOrder,
      },
    });

    console.log(`📊 Admin récupération ${files.length} fichiers (page ${page}/${totalPages})`);
  } catch (error) {
    console.error('❌ Erreur récupération tous les fichiers:', {
      message: error.message,
      stack: error.stack,
      query: error.query,
      code: error.code,
    });
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
      message: error.message,
      details:
        process.env.NODE_ENV === 'development'
          ? {
              stack: error.stack,
              query: error.query,
            }
          : undefined,
    });
  }
});

// GET /api/files/download/:id - Télécharger un fichier
router.get('/download/:id', authenticateToken, validateIdParam('id'), checkFileAccess, async (req, res) => {
  try {
    // Le fichier et dossier ont été vérifiés par checkFileAccess
    const file = req.file;

    // Normaliser sortie fichier
    // La table fichiers utilise: nom, chemin, type (mime), taille, uploaded_at
    const raw = file;
    const fileObj = {
      id: raw.id,
      dossier_id: raw.dossier_id,
      original_filename: raw.nom || raw.nom_original || raw.original_filename || raw.filename || 'download',
      filename: raw.nom || raw.nom_fichier || raw.filename || raw.stored_filename || null,
      filepath: raw.chemin || raw.chemin_stockage || raw.filepath || null,
      mimetype: raw.mime_type || raw.type_mime || raw.mimetype || raw.type || 'application/octet-stream',
      size: raw.taille || raw.taille_bytes || raw.size || null,
      created_at: raw.uploaded_at || raw.created_at || null,
    };

    let physicalPath = fileObj.filepath;

    if (!physicalPath) {
      return res.status(404).json({
        error: 'Chemin du fichier non défini',
        code: 'FILE_PATH_MISSING',
      });
    }

    // ✅ CORRECTION: Convertir chemin relatif en absolu si nécessaire
    if (!path.isAbsolute(physicalPath)) {
      physicalPath = path.join(path.dirname(process.cwd()), physicalPath);
    }

    // Vérifier que le fichier existe physiquement
    try {
      await fs.access(physicalPath);
    } catch {
      console.error(`❌ Fichier physique introuvable: ${physicalPath}`);
      
      // Essayer des chemins alternatifs communs
      const filename = path.basename(fileObj.filepath);
      const alternativePaths = [
        path.join(process.cwd(), fileObj.filepath),
        path.join(process.cwd(), 'uploads', filename),
        path.join(process.cwd(), 'backend/uploads', filename)
      ];
      
      // Si le dossier a un folder_id, essayer aussi avec celui-ci
      if (req.dossier && req.dossier.folder_id) {
        const folderBasedPath = fileObj.filepath.replace(fileObj.dossier_id, req.dossier.folder_id);
        alternativePaths.push(
          path.join(path.dirname(process.cwd()), folderBasedPath),
          path.join(process.cwd(), folderBasedPath)
        );
      }
      
      let foundPath = null;
      for (const altPath of alternativePaths) {
        try {
          await fs.access(altPath);
          foundPath = altPath;
          console.log(`✅ Fichier trouvé via chemin alternatif: ${altPath}`);
          break;
        } catch {
          // Continue à chercher
        }
      }
      
      if (foundPath) {
        physicalPath = foundPath;
      } else {
        return res.status(404).json({
          error: 'Fichier physique non trouvé sur le serveur',
          code: 'PHYSICAL_FILE_NOT_FOUND',
          message: `Le fichier "${fileObj.original_filename}" n'est plus disponible pour téléchargement. Il a peut-être été déplacé ou supprimé.`,
          details: {
            searched_paths: [physicalPath, ...alternativePaths],
            dossier_id: fileObj.dossier_id,
            folder_id: req.dossier?.folder_id
          }
        });
      }
    }

    // Définir les headers pour le téléchargement
    const dlName = fileObj.original_filename || 'download';
    const dlType = fileObj.mimetype || 'application/octet-stream';
    const dlSize = fileObj.size || undefined;

    // Encoder le nom de fichier pour éviter les caractères invalides dans les headers HTTP
    const encodedFilename = encodeURIComponent(dlName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', dlType);
    if (dlSize) res.setHeader('Content-Length', dlSize);

    // Envoyer le fichier
    res.sendFile(physicalPath);

    console.log(`📥 Téléchargement fichier: ${fileObj.original_filename}`);
  } catch (error) {
    console.error('❌ Erreur téléchargement fichier:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
      details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined
    });
  }
});

// GET /api/files/preview/:id - Prévisualiser un fichier (images, PDF)
router.get('/preview/:id', authenticateToken, validateIdParam('id'), checkFileAccess, async (req, res) => {
  try {
    // Le fichier et dossier ont été vérifiés par checkFileAccess
    const file = req.file;

    // Normaliser les données du fichier
    // La table fichiers utilise: nom, chemin, mime_type, taille, uploaded_at
    const fileObj = {
      id: file.id,
      dossier_id: file.dossier_id,
      original_filename: file.nom || file.nom_original || file.filename || 'preview',
      filepath: file.chemin || file.chemin_stockage || file.filepath || null,
      mimetype: file.mime_type || file.type_mime || file.mimetype || file.type || 'application/octet-stream',
      size: file.taille || file.taille_bytes || file.size || null,
    };

    let physicalPath = fileObj.filepath;

    if (!physicalPath) {
      return res.status(404).json({
        error: 'Chemin du fichier non défini',
        code: 'FILE_PATH_MISSING',
      });
    }

    // Convertir chemin relatif en absolu si nécessaire
    if (!path.isAbsolute(physicalPath)) {
      physicalPath = path.join(path.dirname(process.cwd()), physicalPath);
    }

    // Vérifier que le fichier existe physiquement
    try {
      await fs.access(physicalPath);
    } catch {
      console.error(`❌ Fichier physique introuvable: ${physicalPath}`);
      
      // Essayer des chemins alternatifs communs
      const filename = path.basename(fileObj.filepath);
      const alternativePaths = [
        path.join(process.cwd(), fileObj.filepath),
        path.join(process.cwd(), 'uploads', filename),
        path.join(process.cwd(), 'backend/uploads', filename)
      ];
      
      // Si le dossier a un folder_id, essayer aussi avec celui-ci
      if (req.dossier && req.dossier.folder_id) {
        const folderBasedPath = fileObj.filepath.replace(fileObj.dossier_id, req.dossier.folder_id);
        alternativePaths.push(
          path.join(path.dirname(process.cwd()), folderBasedPath),
          path.join(process.cwd(), folderBasedPath)
        );
      }
      
      let foundPath = null;
      for (const altPath of alternativePaths) {
        try {
          await fs.access(altPath);
          foundPath = altPath;
          console.log(`✅ Fichier trouvé via chemin alternatif (preview): ${altPath}`);
          break;
        } catch {
          // Continue à chercher
        }
      }
      
      if (foundPath) {
        physicalPath = foundPath;
      } else {
        return res.status(404).json({
          error: 'Fichier physique non trouvé',
          code: 'PHYSICAL_FILE_NOT_FOUND',
          path: fileObj.filepath,
          details: {
            searched_paths: [physicalPath, ...alternativePaths],
            dossier_id: fileObj.dossier_id,
            folder_id: req.dossier?.folder_id
          }
        });
      }
    }

    // Définir le type de contenu pour la prévisualisation
    const contentType = fileObj.mimetype || 'application/octet-stream';
    
    // Pour la prévisualisation, on veut afficher inline, pas télécharger
    // Encoder le nom de fichier pour éviter les caractères invalides dans les headers HTTP
    const encodedFilename = encodeURIComponent(fileObj.original_filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
    
    if (fileObj.size) {
      res.setHeader('Content-Length', fileObj.size);
    }

    // Envoyer le fichier pour prévisualisation
    res.sendFile(physicalPath);

    console.log(`👁️ Prévisualisation fichier: ${fileObj.original_filename}`);
  } catch (error) {
    console.error('❌ Erreur prévisualisation fichier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// ================================
// FONCTIONS UTILITAIRES
// ================================

// Note: Permissions now handled by unified middleware

// Note: checkUploadPermissions is already defined at line 93

// POST /api/files/:id/mark-reprint - Marquer le dossier associé "à réimprimer" (admin ou préparateur propriétaire)
router.post('/:id/mark-reprint', validateIdParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise', code: 'AUTH_REQUIRED' });
    }

    // Récupérer le fichier pour obtenir le dossier associé
    const fileRes = await query('SELECT id, dossier_id FROM fichiers WHERE id = $1', [id]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé', code: 'FILE_NOT_FOUND' });
    }
    const dossierId = fileRes.rows[0].dossier_id;

    // Vérifier l'autorisation: admin OU préparateur propriétaire du dossier
    const { role, id: userId } = req.user;
    let allowed = false;

    if (role === 'admin') {
      allowed = true;
    } else if (role === 'preparateur') {
      const dRes = await query('SELECT preparateur_id FROM dossiers WHERE id = $1', [dossierId]);
      if (dRes.rows.length > 0 && String(dRes.rows[0].preparateur_id) === String(userId)) {
        allowed = true;
      }
    }

    if (!allowed) {
      return res
        .status(403)
        .json({ error: 'Permission insuffisante', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    // Mettre à jour le statut du dossier
    const upd = await query(
      "UPDATE dossiers SET statut = 'a_revoir', updated_at = NOW() WHERE id = $1 RETURNING id",
      [dossierId]
    );

    if (upd.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Dossier associé non trouvé', code: 'ASSOCIATED_DOSSIER_NOT_FOUND' });
    }

    // Notification temps réel (si disponible)
    try {
      if (global.notificationService) {
        global.notificationService.sendToAll('dossier_marked_for_reprint', {
          dossier_id: dossierId,
          file_id: parseInt(id, 10),
          marked_by: {
            id: req.user.id,
            role: req.user.role,
            nom: req.user.nom,
            prenom: req.user.prenom,
          },
          message: `Dossier ${dossierId} marqué à réimprimer`,
        });
      }
    } catch (error) {
      // Erreur de notification non critique
      console.warn('Erreur notification Socket.IO:', error.message);
    }

    return res.status(200).json({ success: true, dossier_id: dossierId, new_status: 'a_revoir' });
  } catch (error) {
    console.error('❌ Erreur mark-reprint:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
