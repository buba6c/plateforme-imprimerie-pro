// 🚀 ROUTES DOSSIERS COMPLÈTES - Version finale
// ===============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const auth = require('../middleware/auth');

// Configuration upload Multer avec structure par dossier
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dossierId = req.params.id || req.body.dossier_id;
    if (!dossierId) {
      return cb(new Error('Dossier ID requis pour upload'));
    }

    const uploadPath = path.join(__dirname, '../../uploads', dossierId);

    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`));
    }
  },
});

// 🔐 Middleware de vérification des rôles
const checkRole = allowedRoles => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôles autorisés: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};

// 📊 Filtrage des dossiers selon le rôle utilisateur
const filterDossiersByRole = (user, baseQuery = '') => {
  switch (user.role) {
    case 'preparateur':
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} created_by = $1`;
    case 'imprimeur_roland':
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} machine = 'Roland'`;
    case 'imprimeur_xerox':
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} machine = 'Xerox'`;
    case 'livreur':
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} statut IN ('Terminé', 'Livré')`;
    case 'admin':
      return baseQuery;
    default:
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} 1=0`;
  }
};

// 🎯 Génération automatique du numéro de commande
const generateNumeroCommande = async () => {
  const result = await db.query("SELECT nextval('numero_commande_seq') as next_num");
  const num = result.rows[0].next_num;
  const year = new Date().getFullYear();
  return `CMD-${year}-${String(num).padStart(4, '0')}`;
};

// ==========================================
// 📂 ROUTES PRINCIPALES
// ==========================================

// 📋 GET /dossiers - Liste des dossiers (filtrée par rôle)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, statut, machine, search } = req.query;
    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT d.*, u.nom as created_by_name, u.email as created_by_email,
             (SELECT COUNT(*) FROM fichiers WHERE dossier_id = d.id) as nb_fichiers
      FROM dossiers d
      LEFT JOIN users u ON d.created_by = u.id
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (statut) {
      conditions.push(`d.statut = $${paramIndex++}`);
      params.push(statut);
    }

    if (machine) {
      conditions.push(`d.machine = $${paramIndex++}`);
      params.push(machine);
    }

    if (search) {
      conditions.push(
        `(d.client ILIKE $${paramIndex++} OR d.numero_commande ILIKE $${paramIndex++} OR d.description ILIKE $${paramIndex++})`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const queryWithRole = filterDossiersByRole(req.user, baseQuery);

    if (req.user.role === 'preparateur') {
      params.unshift(req.user.id);
    }

    const finalQuery = `
      ${queryWithRole}
      ORDER BY d.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await db.query(finalQuery, params);

    let countQuery = `SELECT COUNT(*) FROM dossiers d`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countQueryWithRole = filterDossiersByRole(req.user, countQuery);
    let countParams = params.slice(0, -2);

    if (req.user.role === 'preparateur' && !countParams.includes(req.user.id)) {
      countParams.unshift(req.user.id);
    }

    const countResult = await db.query(countQueryWithRole, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      dossiers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      user_role: req.user.role,
    });
  } catch (error) {
    console.error('Erreur GET /dossiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des dossiers',
      error: error.message,
    });
  }
});

// 📄 GET /dossiers/:id - Détail d'un dossier
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    let query = `
      SELECT d.*, u.nom as created_by_name, u.email as created_by_email
      FROM dossiers d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = $1
    `;

    const queryWithRole = filterDossiersByRole(req.user, query);
    const params = [id];

    if (req.user.role === 'preparateur') {
      params.push(req.user.id);
    }

    const result = await db.query(queryWithRole, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    const dossier = result.rows[0];

    const filesQuery = `
      SELECT f.*, u.nom as uploaded_by_name 
      FROM fichiers f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.dossier_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const filesResult = await db.query(filesQuery, [id]);

    const historyQuery = `
      SELECT h.*, u.nom as changed_by_name
      FROM dossier_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.dossier_id = $1
      ORDER BY h.changed_at DESC
    `;

    const historyResult = await db.query(historyQuery, [id]);

    res.json({
      success: true,
      dossier: {
        ...dossier,
        fichiers: filesResult.rows,
        historique: historyResult.rows,
      },
    });
  } catch (error) {
    console.error('Erreur GET /dossiers/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du dossier',
      error: error.message,
    });
  }
});

// 🆕 POST /dossiers - Créer un nouveau dossier (Préparateur uniquement)
router.post('/', auth, checkRole(['preparateur']), async (req, res) => {
  try {
    const {
      client,
      machine,
      description = '',
      quantite = 1,
      client_email = '',
      client_telephone = '',
      date_livraison_prevue = null,
    } = req.body;

    if (!client || !machine) {
      return res.status(400).json({
        success: false,
        message: 'Client et machine sont obligatoires',
      });
    }

    if (!['Roland', 'Xerox'].includes(machine)) {
      return res.status(400).json({
        success: false,
        message: 'Machine doit être Roland ou Xerox',
      });
    }

    const numeroCommande = await generateNumeroCommande();

    const query = `
      INSERT INTO dossiers (
        numero_commande, client, machine, description, quantite,
        client_email, client_telephone, date_livraison_prevue, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      numeroCommande,
      client,
      machine,
      description,
      quantite,
      client_email,
      client_telephone,
      date_livraison_prevue,
      req.user.id,
    ];

    const result = await db.query(query, values);
    const dossier = result.rows[0];

    const uploadPath = path.join(__dirname, '../../uploads', dossier.id);
    await fs.mkdir(uploadPath, { recursive: true });

    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_created', {
        dossier: dossier,
        created_by: req.user.nom,
        message: `Nouveau dossier ${numeroCommande} créé par ${req.user.nom}`,
      });
    }

    res.status(201).json({
      success: true,
      message: `Dossier ${numeroCommande} créé avec succès`,
      dossier: dossier,
    });
  } catch (error) {
    console.error('Erreur POST /dossiers:', error);

    if (error.constraint === 'dossiers_numero_commande_key') {
      return res.status(400).json({
        success: false,
        message: 'Numéro de commande déjà existant',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du dossier',
      error: error.message,
    });
  }
});

// ✏️ PUT /dossiers/:id - Modifier un dossier
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      client,
      machine,
      description,
      quantite,
      client_email,
      client_telephone,
      date_livraison_prevue,
      commentaires,
    } = req.body;

    const checkQuery = filterDossiersByRole(
      req.user,
      `
      SELECT * FROM dossiers WHERE id = $1
    `
    );

    const checkParams = [id];
    if (req.user.role === 'preparateur') {
      checkParams.push(req.user.id);
    }

    const checkResult = await db.query(checkQuery, checkParams);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    const dossier = checkResult.rows[0];

    const canModify =
      req.user.role === 'admin' ||
      (req.user.role === 'preparateur' &&
        dossier.created_by === req.user.id &&
        !dossier.valide_preparateur) ||
      (req.user.role === 'preparateur' && dossier.statut === 'À revoir');

    if (!canModify) {
      return res.status(403).json({
        success: false,
        message:
          "Modification non autorisée. Le dossier est validé ou vous n'en êtes pas le créateur.",
      });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (client !== undefined) {
      updates.push(`client = $${paramIndex++}`);
      values.push(client);
    }

    if (machine !== undefined && ['Roland', 'Xerox'].includes(machine)) {
      updates.push(`machine = $${paramIndex++}`);
      values.push(machine);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (quantite !== undefined) {
      updates.push(`quantite = $${paramIndex++}`);
      values.push(parseInt(quantite));
    }

    if (client_email !== undefined) {
      updates.push(`client_email = $${paramIndex++}`);
      values.push(client_email);
    }

    if (client_telephone !== undefined) {
      updates.push(`client_telephone = $${paramIndex++}`);
      values.push(client_telephone);
    }

    if (date_livraison_prevue !== undefined) {
      updates.push(`date_livraison_prevue = $${paramIndex++}`);
      values.push(date_livraison_prevue);
    }

    if (commentaires !== undefined) {
      updates.push(`commentaires = $${paramIndex++}`);
      values.push(commentaires);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à modifier',
      });
    }

    values.push(id);

    const updateQuery = `
      UPDATE dossiers 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedDossier = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_updated', {
        dossier: updatedDossier,
        updated_by: req.user.nom,
        message: `Dossier ${updatedDossier.numero_commande} modifié`,
      });
    }

    res.json({
      success: true,
      message: 'Dossier modifié avec succès',
      dossier: updatedDossier,
    });
  } catch (error) {
    console.error('Erreur PUT /dossiers/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du dossier',
      error: error.message,
    });
  }
});

// 🔄 PUT /dossiers/:id/statut - Changer le statut d'un dossier
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nouveau_statut, commentaire = null } = req.body;

    const statusAllowed = ['En cours', 'À revoir', 'En impression', 'Terminé', 'Livré'];

    if (!statusAllowed.includes(nouveau_statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Autorisés: ${statusAllowed.join(', ')}`,
      });
    }

    const checkQuery = filterDossiersByRole(
      req.user,
      `
      SELECT * FROM dossiers WHERE id = $1
    `
    );

    const checkParams = [id];
    if (req.user.role === 'preparateur') {
      checkParams.push(req.user.id);
    }

    const checkResult = await db.query(checkQuery, checkParams);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    const dossier = checkResult.rows[0];

    const canChangeStatus = () => {
      switch (req.user.role) {
        case 'admin':
          return true;
        case 'preparateur':
          return (
            dossier.created_by === req.user.id &&
            dossier.statut === 'À revoir' &&
            nouveau_statut === 'En cours'
          );
        case 'imprimeur_roland':
        case 'imprimeur_xerox':
          const validTransitions = {
            'En cours': ['À revoir', 'En impression'],
            'En impression': ['Terminé', 'À revoir'],
          };
          return validTransitions[dossier.statut]?.includes(nouveau_statut);
        case 'livreur':
          return dossier.statut === 'Terminé' && nouveau_statut === 'Livré';
        default:
          return false;
      }
    };

    if (!canChangeStatus()) {
      return res.status(403).json({
        success: false,
        message: `Changement de statut non autorisé. Statut actuel: ${dossier.statut}, Votre rôle: ${req.user.role}`,
      });
    }

    const updateQuery = `
      UPDATE dossiers 
      SET statut = $1, commentaire_revision = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(updateQuery, [nouveau_statut, commentaire, id]);
    const updatedDossier = result.rows[0];

    if (commentaire) {
      await db.query(
        `
        UPDATE dossier_status_history 
        SET commentaire = $1 
        WHERE dossier_id = $2 AND nouveau_statut = $3 AND commentaire IS NULL
        ORDER BY changed_at DESC LIMIT 1
      `,
        [commentaire, id, nouveau_statut]
      );
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_status_changed', {
        dossier: updatedDossier,
        ancien_statut: dossier.statut,
        nouveau_statut: nouveau_statut,
        changed_by: req.user.nom,
        commentaire: commentaire,
        message: `Statut du dossier ${updatedDossier.numero_commande} changé: ${dossier.statut} → ${nouveau_statut}`,
      });
    }

    res.json({
      success: true,
      message: `Statut changé: ${dossier.statut} → ${nouveau_statut}`,
      dossier: updatedDossier,
    });
  } catch (error) {
    console.error('Erreur PUT /dossiers/:id/statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut',
      error: error.message,
    });
  }
});

// ✅ PUT /dossiers/:id/valider - Valider un dossier (Préparateur)
router.put('/:id/valider', auth, checkRole(['preparateur']), async (req, res) => {
  try {
    const { id } = req.params;

    const checkQuery = `
      SELECT * FROM dossiers 
      WHERE id = $1 AND created_by = $2 AND valide_preparateur = false
    `;

    const checkResult = await db.query(checkQuery, [id, req.user.id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ce dossier ne peut pas être validé : il n'existe pas, est déjà validé, ou vous n'en êtes pas le créateur",
      });
    }

    const filesCheck = await db.query('SELECT COUNT(*) FROM fichiers WHERE dossier_id = $1', [id]);
    const nbFichiers = parseInt(filesCheck.rows[0].count);

    if (nbFichiers === 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de valider un dossier sans fichiers',
      });
    }

    const updateQuery = `
      UPDATE dossiers 
      SET valide_preparateur = true, date_validation_preparateur = NOW() 
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);
    const dossier = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_validated', {
        dossier: dossier,
        validated_by: req.user.nom,
        message: `Dossier ${dossier.numero_commande} validé et prêt pour impression`,
      });
    }

    res.json({
      success: true,
      message:
        'Dossier validé avec succès. Il est maintenant verrouillé et visible par les imprimeurs.',
      dossier: dossier,
    });
  } catch (error) {
    console.error('Erreur PUT /dossiers/:id/valider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation du dossier',
      error: error.message,
    });
  }
});

// 📤 POST /dossiers/:id/fichiers - Upload de fichiers
router.post('/:id/fichiers', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { id: dossierId } = req.params;

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

    for (const file of req.files) {
      try {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const relativePath = `uploads/${dossierId}/${file.filename}`;

        const fileBuffer = await fs.readFile(file.path);
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const existingFileCheck = await db.query(
          'SELECT id FROM fichiers WHERE dossier_id = $1 AND checksum = $2',
          [dossierId, checksum]
        );

        if (existingFileCheck.rows.length > 0) {
          await fs.unlink(file.path);
          continue;
        }

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
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier n'a pu être uploadé (doublons ou erreurs)",
      });
    }

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

    const fullPath = path.join(__dirname, '../..', file.chemin);

    try {
      await fs.access(fullPath);
    } catch (accessError) {
      return res.status(404).json({
        success: false,
        message: 'Fichier physique non trouvé sur le serveur',
      });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.nom}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');

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

    await db.query('DELETE FROM fichiers WHERE id = $1', [fileId]);

    const fullPath = path.join(__dirname, '../..', file.chemin);
    try {
      await fs.unlink(fullPath);
    } catch (unlinkError) {
      console.warn('Impossible de supprimer le fichier physique:', unlinkError);
    }

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

    const dossierQuery = 'SELECT * FROM dossiers WHERE id = $1';
    const dossierResult = await db.query(dossierQuery, [dossierId]);

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas',
      });
    }

    const dossier = dossierResult.rows[0];

    const filesQuery = 'SELECT * FROM fichiers WHERE dossier_id = $1';
    const filesResult = await db.query(filesQuery, [dossierId]);

    for (const file of filesResult.rows) {
      const fullPath = path.join(__dirname, '../..', file.chemin);
      try {
        await fs.unlink(fullPath);
      } catch (unlinkError) {
        console.warn(`Impossible de supprimer le fichier physique ${file.nom}:`, unlinkError);
      }
    }

    const uploadPath = path.join(__dirname, '../../uploads', dossierId);
    try {
      await fs.rmdir(uploadPath);
    } catch (rmdirError) {
      console.warn('Impossible de supprimer le répertoire du dossier:', rmdirError);
    }

    await db.query('DELETE FROM dossiers WHERE id = $1', [dossierId]);

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

module.exports = router;
