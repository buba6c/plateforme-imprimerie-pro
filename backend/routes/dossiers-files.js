// 📄 ROUTES FICHIERS - Gestion complète des uploads
// ==================================================

// Cette partie s'ajoute au fichier dossiers-new.js après les routes CRUD

// 📤 POST /dossiers/:id/fichiers - Upload de fichiers
router.post('/:id/fichiers', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { id: dossierId } = req.params;

    // Vérifier que le dossier existe et que l'utilisateur y a accès
    const dossierQuery = filterDossiersByRole(
      req.user,
      `
      SELECT * FROM dossiers WHERE id = $1
    `
    );

    const dossierParams = [dossierId];
    if (req.user.role === 'preparateur') {
      dossierParams.push(req.user.id);
    }

    const dossierResult = await db.query(dossierQuery, dossierParams);

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    const dossier = dossierResult.rows[0];

    // Vérifier les droits d'upload
    const canUpload =
      req.user.role === 'admin' ||
      (req.user.role === 'preparateur' &&
        dossier.created_by === req.user.id &&
        !dossier.valide_preparateur);

    if (!canUpload) {
      return res.status(403).json({
        success: false,
        message: "Upload non autorisé. Le dossier est validé ou vous n'en êtes pas le créateur.",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni',
      });
    }

    const uploadedFiles = [];

    // Traiter chaque fichier
    for (const file of req.files) {
      try {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const relativePath = `uploads/${dossierId}/${file.filename}`;

        // Calculer le checksum pour éviter les doublons
        const fileBuffer = await fs.readFile(file.path);
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Vérifier si le fichier existe déjà (même checksum)
        const existingFileCheck = await db.query(
          'SELECT id FROM fichiers WHERE dossier_id = $1 AND checksum = $2',
          [dossierId, checksum]
        );

        if (existingFileCheck.rows.length > 0) {
          // Supprimer le fichier dupliqué
          await fs.unlink(file.path);
          continue; // Ignorer ce fichier
        }

        // Enregistrer en base de données
        const insertQuery = `
          INSERT INTO fichiers (
            dossier_id, nom, chemin, type, taille, uploaded_by, 
            mime_type, extension, checksum
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;

        const values = [
          dossierId,
          file.originalname,
          relativePath,
          file.mimetype.startsWith('image/') ? 'image' : 'document',
          file.size,
          req.user.id,
          file.mimetype,
          fileExtension,
          checksum,
        ];

        const result = await db.query(insertQuery, values);
        uploadedFiles.push(result.rows[0]);
      } catch (fileError) {
        console.error(`Erreur traitement fichier ${file.originalname}:`, fileError);
        // Continuer avec les autres fichiers
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier n'a pu être uploadé (doublons ou erreurs)",
      });
    }

    // Notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('files_uploaded', {
        dossier_id: dossierId,
        files: uploadedFiles,
        uploaded_by: req.user.nom,
        message: `${uploadedFiles.length} fichier(s) ajouté(s) au dossier ${dossier.numero_commande}`,
      });
    }

    res.json({
      success: true,
      message: `${uploadedFiles.length} fichier(s) uploadé(s) avec succès`,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Erreur POST /dossiers/:id/fichiers:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'upload des fichiers",
      error: error.message,
    });
  }
});

// 📥 GET /dossiers/:id/fichiers - Liste des fichiers d'un dossier
router.get('/:id/fichiers', auth, async (req, res) => {
  try {
    const { id: dossierId } = req.params;

    // Vérifier l'accès au dossier
    const dossierQuery = filterDossiersByRole(
      req.user,
      `
      SELECT * FROM dossiers WHERE id = $1
    `
    );

    const dossierParams = [dossierId];
    if (req.user.role === 'preparateur') {
      dossierParams.push(req.user.id);
    }

    const dossierResult = await db.query(dossierQuery, dossierParams);

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    // Récupérer les fichiers
    const filesQuery = `
      SELECT f.*, u.nom as uploaded_by_name 
      FROM fichiers f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.dossier_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const filesResult = await db.query(filesQuery, [dossierId]);

    res.json({
      success: true,
      files: filesResult.rows,
    });
  } catch (error) {
    console.error('Erreur GET /dossiers/:id/fichiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers',
      error: error.message,
    });
  }
});

// 📂 GET /fichiers/:id/download - Télécharger un fichier
router.get('/fichiers/:id/download', auth, async (req, res) => {
  try {
    const { id: fileId } = req.params;

    // Récupérer les informations du fichier
    const fileQuery = `
      SELECT f.*, d.* FROM fichiers f
      JOIN dossiers d ON f.dossier_id = d.id
      WHERE f.id = $1
    `;

    const fileResult = await db.query(fileQuery, [fileId]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé',
      });
    }

    const file = fileResult.rows[0];

    // Vérifier l'accès au dossier parent
    const dossierQuery = filterDossiersByRole(
      req.user,
      `
      SELECT id FROM dossiers WHERE id = $1
    `
    );

    const dossierParams = [file.dossier_id];
    if (req.user.role === 'preparateur') {
      dossierParams.push(req.user.id);
    }

    const accessResult = await db.query(dossierQuery, dossierParams);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce fichier',
      });
    }

    // Construire le chemin complet du fichier
    const fullPath = path.join(__dirname, '../..', file.chemin);

    // Vérifier que le fichier existe sur le disque
    try {
      await fs.access(fullPath);
    } catch (accessError) {
      return res.status(404).json({
        success: false,
        message: 'Fichier physique non trouvé sur le serveur',
      });
    }

    // Définir les headers pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${file.nom}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');

    // Envoyer le fichier
    res.sendFile(fullPath);
  } catch (error) {
    console.error('Erreur GET /fichiers/:id/download:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message,
    });
  }
});

// 🗑️ DELETE /fichiers/:id - Supprimer un fichier
router.delete('/fichiers/:id', auth, async (req, res) => {
  try {
    const { id: fileId } = req.params;

    // Récupérer les informations du fichier et du dossier
    const fileQuery = `
      SELECT f.*, d.created_by, d.valide_preparateur, d.numero_commande
      FROM fichiers f
      JOIN dossiers d ON f.dossier_id = d.id
      WHERE f.id = $1
    `;

    const fileResult = await db.query(fileQuery, [fileId]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé',
      });
    }

    const file = fileResult.rows[0];

    // Vérifier les droits de suppression
    const canDelete =
      req.user.role === 'admin' ||
      (req.user.role === 'preparateur' &&
        file.created_by === req.user.id &&
        !file.valide_preparateur);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message:
          "Suppression non autorisée. Le dossier est validé ou vous n'en êtes pas le créateur.",
      });
    }

    // Supprimer de la base de données
    await db.query('DELETE FROM fichiers WHERE id = $1', [fileId]);

    // Supprimer le fichier physique
    const fullPath = path.join(__dirname, '../..', file.chemin);
    try {
      await fs.unlink(fullPath);
    } catch (unlinkError) {
      console.warn('Impossible de supprimer le fichier physique:', unlinkError);
      // Continue car la suppression en base est plus importante
    }

    // Notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('file_deleted', {
        dossier_id: file.dossier_id,
        file_id: fileId,
        file_name: file.nom,
        deleted_by: req.user.nom,
        message: `Fichier ${file.nom} supprimé du dossier ${file.numero_commande}`,
      });
    }

    res.json({
      success: true,
      message: `Fichier ${file.nom} supprimé avec succès`,
    });
  } catch (error) {
    console.error('Erreur DELETE /fichiers/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fichier',
      error: error.message,
    });
  }
});

// 🗑️ DELETE /dossiers/:id - Supprimer un dossier et tous ses fichiers (Admin uniquement)
router.delete('/:id', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { id: dossierId } = req.params;

    // Récupérer les informations du dossier
    const dossierQuery = 'SELECT * FROM dossiers WHERE id = $1';
    const dossierResult = await db.query(dossierQuery, [dossierId]);

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas',
      });
    }

    const dossier = dossierResult.rows[0];

    // Récupérer tous les fichiers pour les supprimer physiquement
    const filesQuery = 'SELECT * FROM fichiers WHERE dossier_id = $1';
    const filesResult = await db.query(filesQuery, [dossierId]);

    // Supprimer les fichiers physiques
    for (const file of filesResult.rows) {
      const fullPath = path.join(__dirname, '../..', file.chemin);
      try {
        await fs.unlink(fullPath);
      } catch (unlinkError) {
        console.warn(`Impossible de supprimer le fichier physique ${file.nom}:`, unlinkError);
      }
    }

    // Supprimer le répertoire du dossier
    const uploadPath = path.join(__dirname, '../../uploads', dossierId);
    try {
      await fs.rmdir(uploadPath);
    } catch (rmdirError) {
      console.warn('Impossible de supprimer le répertoire du dossier:', rmdirError);
    }

    // Supprimer le dossier (CASCADE supprimera automatiquement fichiers et historique)
    await db.query('DELETE FROM dossiers WHERE id = $1', [dossierId]);

    // Notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_deleted', {
        dossier_id: dossierId,
        numero_commande: dossier.numero_commande,
        deleted_by: req.user.nom,
        message: `Dossier ${dossier.numero_commande} supprimé définitivement`,
      });
    }

    res.json({
      success: true,
      message: `Dossier ${dossier.numero_commande} et tous ses fichiers supprimés avec succès`,
    });
  } catch (error) {
    console.error('Erreur DELETE /dossiers/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du dossier',
      error: error.message,
    });
  }
});

// 🔄 POST /dossiers/batch-delete - Suppression multiple (Admin uniquement)
router.post('/batch-delete', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Liste d'IDs requise",
      });
    }

    const deletedDossiers = [];

    for (const dossierId of ids) {
      try {
        // Récupérer les informations du dossier
        const dossierResult = await db.query('SELECT * FROM dossiers WHERE id = $1', [dossierId]);

        if (dossierResult.rows.length === 0) {
          continue; // Ignorer si non trouvé
        }

        const dossier = dossierResult.rows[0];

        // Supprimer les fichiers physiques
        const filesResult = await db.query('SELECT * FROM fichiers WHERE dossier_id = $1', [
          dossierId,
        ]);

        for (const file of filesResult.rows) {
          const fullPath = path.join(__dirname, '../..', file.chemin);
          try {
            await fs.unlink(fullPath);
          } catch (unlinkError) {
            console.warn(`Erreur suppression fichier ${file.nom}:`, unlinkError);
          }
        }

        // Supprimer le répertoire
        const uploadPath = path.join(__dirname, '../../uploads', dossierId);
        try {
          await fs.rmdir(uploadPath);
        } catch (rmdirError) {
          console.warn('Erreur suppression répertoire:', rmdirError);
        }

        // Supprimer de la base
        await db.query('DELETE FROM dossiers WHERE id = $1', [dossierId]);

        deletedDossiers.push(dossier);
      } catch (deleteError) {
        console.error(`Erreur suppression dossier ${dossierId}:`, deleteError);
      }
    }

    // Notification temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('dossiers_batch_deleted', {
        deleted_count: deletedDossiers.length,
        dossiers: deletedDossiers.map(d => d.numero_commande),
        deleted_by: req.user.nom,
        message: `${deletedDossiers.length} dossier(s) supprimé(s) en masse`,
      });
    }

    res.json({
      success: true,
      message: `${deletedDossiers.length} dossier(s) supprimé(s) avec succès`,
      deleted: deletedDossiers,
    });
  } catch (error) {
    console.error('Erreur POST /dossiers/batch-delete:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression en masse',
      error: error.message,
    });
  }
});

module.exports = router;
