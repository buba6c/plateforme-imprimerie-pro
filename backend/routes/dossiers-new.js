// 🏗️ NOUVELLES ROUTES DOSSIERS - Architecture propre
// ==================================================

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
    // Nom de fichier unique : timestamp_original
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    // Types acceptés pour imprimerie
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
      // Préparateur ne voit que ses propres dossiers
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} created_by = $1`;

    case 'imprimeur_roland':
      // Imprimeur Roland ne voit que les dossiers Roland
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} machine = 'Roland'`;

    case 'imprimeur_xerox':
      // Imprimeur Xerox ne voit que les dossiers Xerox
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} machine = 'Xerox'`;

    case 'livreur':
      // Livreur ne voit que les dossiers terminés
      return `${baseQuery} ${baseQuery.includes('WHERE') ? 'AND' : 'WHERE'} statut IN ('Terminé', 'Livré')`;

    case 'admin':
      // Admin voit tout
      return baseQuery;

    default:
      // Sécurité : aucun accès par défaut
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

    // Ajout des filtres optionnels
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

    // Filtrage par rôle utilisateur
    const queryWithRole = filterDossiersByRole(req.user, baseQuery);

    // Ajout du paramètre user_id si nécessaire pour préparateur
    if (req.user.role === 'preparateur') {
      params.unshift(req.user.id); // Ajouter au début pour le paramètre $1
    }

    // Ajout de l'ordre et pagination
    const finalQuery = `
      ${queryWithRole}
      ORDER BY d.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await db.query(finalQuery, params);

    // Compter le total pour la pagination
    let countQuery = `SELECT COUNT(*) FROM dossiers d`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countQueryWithRole = filterDossiersByRole(req.user, countQuery);
    let countParams = params.slice(0, -2); // Enlever limit et offset

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

    // Requête de base pour récupérer le dossier
    let query = `
      SELECT d.*, u.nom as created_by_name, u.email as created_by_email
      FROM dossiers d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = $1
    `;

    // Vérification des droits d'accès selon le rôle
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

    // Récupérer les fichiers associés
    const filesQuery = `
      SELECT f.*, u.nom as uploaded_by_name 
      FROM fichiers f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.dossier_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const filesResult = await db.query(filesQuery, [id]);

    // Récupérer l'historique des statuts
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

module.exports = router;
