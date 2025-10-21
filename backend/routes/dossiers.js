// ===============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');
const { isValidId, validateIdParam } = require('../utils/validators');
const { checkDossierPermission, getDossierByIdentifier, logDossierActivity, canAccessDossier } = require('../middleware/permissions');
const socketService = require('../services/socketService');
const { getAvailableActions } = require('../services/workflow-adapter');

// 🆕 Import du système centralisé de mapping des statuts
const {
  normalizeToDb,
  normalizeFromDb,
  isValidDbStatus,
  isValidApiStatus,
  getDisplayLabel,
  DB_STATUTS,
  API_STATUTS
} = require('../constants/status-mapping');

// Fonction de normalisation des statuts de la base de données vers les codes frontend
const normalizeStatusForFrontend = (dbStatus) => {
  return normalizeFromDb(dbStatus);
};

// Fonction inverse: convertit snake_case -> français pour les règles de workflow
const normalizeStatusForWorkflow = (status) => {
  return normalizeToDb(status);
};

// Fonction unifiée pour vérifier l'accès d'un utilisateur à un dossier
const checkUserAccess = (dossier, user) => {
  if (!dossier || !user) return { allowed: false, reason: 'Données manquantes' };
  
  // Admin a accès à tout
  if (user.role === 'admin') {
    return { allowed: true, reason: 'Admin - accès complet' };
  }
  
  // Préparateur: accès à ses propres dossiers
  if (user.role === 'preparateur') {
    const isOwner = dossier.created_by === user.id || 
                   dossier.preparateur_id === user.id ||
                   dossier.createdBy === user.id;
    return {
      allowed: isOwner,
      reason: isOwner ? 'Propriétaire du dossier' : 'Vous n\'êtes pas le créateur de ce dossier'
    };
  }
  
  // Imprimeurs: accès selon la machine et le statut
  if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
    const machineType = (dossier.type_formulaire || dossier.machine || dossier.type || '').toLowerCase();
    const requiredMachine = user.role === 'imprimeur_roland' ? 'roland' : 'xerox';
    
    if (!machineType.includes(requiredMachine)) {
      return { 
        allowed: false, 
        reason: `Ce dossier est pour machine ${machineType}, vous gérez les ${requiredMachine}` 
      };
    }
    
    // Vérifier le statut (doit être prêt pour impression ou en cours d'impression)
    const status = dossier.statut || dossier.status || '';
    const allowedStatuses = [
      'Prêt impression', 'En impression', 'Imprimé',
      'pret_impression', 'en_impression', 'imprime', 'termine',
      'En cours', 'en_cours' // Parfois les imprimeurs voient les dossiers en cours
    ];
    
    const hasAccess = allowedStatuses.some(s => status.includes(s) || s.includes(status));
    return {
      allowed: hasAccess,
      reason: hasAccess ? 'Dossier accessible pour impression' : `Statut "${status}" non accessible aux imprimeurs`
    };
  }
  
  // Livreur: accès aux dossiers terminés et en livraison
  if (user.role === 'livreur') {
    const status = dossier.statut || dossier.status || '';
    const allowedStatuses = [
      // Le livreur doit recevoir les dossiers terminés d'impression (Imprimé)
      'Imprimé', 'imprime',
      'Prêt livraison', 'pret_livraison',
      'En livraison', 'en_livraison',
      'Livré', 'livre',
      'Terminé', 'termine'
    ];
    
    const hasAccess = allowedStatuses.some(s => status.includes(s) || s.includes(status));
    return {
      allowed: hasAccess,
      reason: hasAccess ? 'Dossier accessible pour livraison' : `Statut \"${status}\" non accessible aux livreurs`
    };
  }
  
  return { allowed: false, reason: `Rôle "${user.role}" non reconnu` };
};

// Configuration upload Multer avec structure par dossier (utilise folder_id)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dossierId = req.params.id || req.body.dossier_id;
    if (!dossierId) {
      return cb(new Error('Dossier ID requis pour upload'));
    }

    // Utiliser folder_id si disponible dans req.dossier (posé par checkDossierPermission)
    const folderName = req.dossier?.folder_id || dossierId;
    const uploadPath = path.join(__dirname, '../../uploads/dossiers', folderName);

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
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
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

// PUT /dossiers/:id/autoriser-modification - Admin déverrouille un dossier validé
router.put('/:id/autoriser-modification', auth, checkRole(['admin']), validateIdParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    // Charger le dossier en utilisant getDossierByIdentifier qui gère folder_id et id
    const dossier = await getDossierByIdentifier(id);
    if (!dossier) {
      return res.status(404).json({ success: false, message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action' });
    }
    // Vérifier qu'il est bien validé (colonne sans accent)
    if (!dossier.valide_preparateur) {
      return res.status(400).json({
        success: false,
        message: "Le dossier n'est pas validé, aucune action nécessaire.",
      });
    }
    // Déverrouiller le dossier et remettre le statut à "En cours"
    // Utiliser le vrai ID du dossier (pas le folder_id)
    const updateQuery = `
      UPDATE dossiers SET valide_preparateur = false, statut = $1, date_validation_preparateur = NULL WHERE id = $2 RETURNING *
    `;
    const result = await db.query(updateQuery, [DB_STATUTS.EN_COURS, dossier.id]);
    const updated = result.rows[0];
    // Socket.IO (optionnel)
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_unlocked', {
        dossier: updated,
        unlocked_by: req.user.nom,
        message: `Dossier ${updated.numero_commande || updated.numero} déverrouillé par admin`,
      });
    }
    return res.json({
      success: true,
      message: 'Dossier déverrouillé, le préparateur peut à nouveau le modifier.',
      dossier: updated,
    });
  } catch (error) {
    console.error('Erreur autoriser modification:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du déverrouillage du dossier',
      error: error.message,
    });
  }
});

// 📊 Filtrage des dossiers selon le rôle utilisateur - Version robuste (compat schémas)
const filterDossiersByRole = (user, baseQuery = '', paramOffset = 0) => {
  // Helper: expression SQL pour type/machine normalisée
  const machineExpr = 'LOWER(COALESCE(d.type_formulaire, d.machine))';
  switch (user.role) {
    case 'preparateur': {
      const idx = paramOffset + 1;
      // Préparateur: voit tous ses dossiers (quel que soit le statut)
      const condition = `(d.preparateur_id = $${idx} OR d.created_by = $${idx})`;
      return baseQuery.toUpperCase().includes('WHERE')
        ? `${baseQuery} AND (${condition})`
        : `${baseQuery} WHERE ${condition}`;
    }
    case 'imprimeur_roland': {
      // Imprimeur Roland: voit dossiers Roland aux statuts de production
      const condition = `${machineExpr} LIKE 'roland%' AND d.statut IN ('Prêt impression','En impression','Imprimé','pret_impression','en_impression','imprime','termine')`;
      return baseQuery.toUpperCase().includes('WHERE')
        ? `${baseQuery} AND (${condition})`
        : `${baseQuery} WHERE ${condition}`;
    }
    case 'imprimeur_xerox': {
      const condition = `${machineExpr} LIKE 'xerox%' AND d.statut IN ('Prêt impression','En impression','Imprimé','pret_impression','en_impression','imprime','termine')`;
      return baseQuery.toUpperCase().includes('WHERE')
        ? `${baseQuery} AND (${condition})`
        : `${baseQuery} WHERE ${condition}`;
    }
    case 'livreur': {
      const condition = `d.statut IN ('Imprimé','Prêt livraison','En livraison','Livré','Terminé','imprime','pret_livraison','en_livraison','livre','termine')`;
      return baseQuery.toUpperCase().includes('WHERE')
        ? `${baseQuery} AND (${condition})`
        : `${baseQuery} WHERE ${condition}`;
    }
    case 'admin':
      return baseQuery;
    default:
      return baseQuery.toUpperCase().includes('WHERE')
        ? `${baseQuery} AND 1=0`
        : `${baseQuery} WHERE 1=0`;
  }
};

// 🎯 Génération automatique du numéro de commande
const generateNumeroCommande = async () => {
  const year = new Date().getFullYear();
  try {
    const result = await db.query("SELECT nextval('numero_commande_seq') as next_num");
    const num = result.rows?.[0]?.next_num ?? Math.floor(Math.random() * 10000);
    return `CMD-${year}-${String(num).padStart(4, '0')}`;
  } catch (e) {
    // Fallback if sequence doesn't exist: timestamp-based unique number
    const ts = Date.now().toString().slice(-6);
    return `CMD-${year}-${ts}`;
  }
};

// ==========================================
// 📂 ROUTES PRINCIPALES
// ==========================================

// 📋 GET /dossiers - Liste des dossiers (filtrée par rôle)
router.get('/', auth, async (req, res) => {
  try {
    // Accept both backend-native params and frontend aliases
    const {
      page = 1,
      limit = 50,
      statut: statutParam,
      machine: machineRaw,
      type: typeRaw,
      search,
    } = req.query;

    // Map app status codes to backend French labels if needed
    const statutMap = {
      en_cours: 'en_cours',
      a_revoir: 'a_revoir',
      en_impression: 'en_impression',
      termine: 'termine',
      en_livraison: 'en_livraison',
      livre: 'livre',
    };

    const statut = statutParam || undefined;
    const machine =
      machineRaw ||
      (typeRaw
        ? String(typeRaw).toLowerCase().startsWith('roland')
          ? 'Roland'
          : String(typeRaw).toLowerCase().startsWith('xerox')
            ? 'Xerox'
            : typeRaw
        : undefined);
    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT d.*, d.valide_preparateur, u.nom as preparateur_name, u.email as preparateur_email,
        (SELECT COUNT(*) FROM fichiers WHERE dossier_id = d.id) as nb_fichiers
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // N'appliquer un filtre statut que si ce n'est pas un imprimeur (les rôles imprimeurs imposent déjà leurs statuts)
    if (statut && !['imprimeur_roland', 'imprimeur_xerox'].includes(req.user.role)) {
      conditions.push(`d.statut = $${paramIndex++}`);
      params.push(statut);
    }

    // Filtrer par machine de manière robuste (type_formulaire OU machine)
    if (machine) {
      conditions.push(`LOWER(COALESCE(d.type_formulaire, d.machine)) LIKE $${paramIndex++}`);
      const m = String(machine).toLowerCase();
      params.push(m.startsWith('roland') ? 'roland%' : m.startsWith('xerox') ? 'xerox%' : `%${m}%`);
    }

    if (search) {
      conditions.push(
        `(d.client ILIKE $${paramIndex++} OR d.numero_commande ILIKE $${paramIndex++} OR d.description ILIKE $${paramIndex++})`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Ajout des conditions de rôle AVANT la construction finale de la requête
    const listParams = [...params];

    // Ajouter les conditions de rôle selon le type d'utilisateur
    switch (req.user.role) {
      case 'preparateur':
        conditions.push(`(d.preparateur_id = $${paramIndex++} OR d.created_by = $${paramIndex++})`);
        listParams.push(req.user.id, req.user.id);
        break;
      case 'imprimeur_roland':
        conditions.push(
          `LOWER(COALESCE(d.type_formulaire, d.machine)) LIKE 'roland%' AND d.statut IN ('Prêt impression','En impression','Imprimé','pret_impression','en_impression','imprime','termine')`
        );
        break;
      case 'imprimeur_xerox':
        conditions.push(
          `LOWER(COALESCE(d.type_formulaire, d.machine)) LIKE 'xerox%' AND d.statut IN ('Prêt impression','En impression','Imprimé','pret_impression','en_impression','imprime','termine')`
        );
        break;
      case 'livreur':
        conditions.push(
          `d.statut IN ('Imprimé','Prêt livraison','En livraison','Livré','Terminé','imprime','pret_livraison','en_livraison','livre','termine')`
        );
        break;
      case 'admin':
        // Admin voit tout, pas de condition
        break;
      default:
        conditions.push('1=0'); // Aucun accès
        break;
    }

    // Construction de la clause WHERE finale
    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const finalQuery = `
      ${baseQuery}
      ORDER BY d.created_at DESC
      LIMIT $${listParams.length + 1} OFFSET $${listParams.length + 2}
    `;

    // Debug: afficher la requête et les paramètres
    console.log(`🔍 DEBUG - Rôle: ${req.user.role}, ID: ${req.user.id}`);
    console.log(`🔍 DEBUG - Requête SQL: ${finalQuery}`);
    console.log(`🔍 DEBUG - Paramètres: ${JSON.stringify([...listParams, limit, offset])}`);

    // Vérification requête SQL
    let sqlError = null;
    if (!finalQuery || !finalQuery.trim().toLowerCase().startsWith('select')) {
      sqlError = 'Requête SQL non générée ou mal formée.';
    }
    // Vérifier le nombre de paramètres ($) dans la requête
    const paramCount = (finalQuery.match(/\$[0-9]+/g) || []).length;
    const providedCount = [...listParams, limit, offset].length;
    if (paramCount !== providedCount) {
      sqlError = `Nombre de paramètres attendu (${paramCount}) différent du nombre fourni (${providedCount}).`;
    }
    // Vérifier qu'il n'y a pas deux WHERE consécutifs
    if (/where\s+where/i.test(finalQuery)) {
      sqlError = 'Erreur de syntaxe SQL : double WHERE.';
    }
    if (sqlError) {
      console.error('❌ Erreur requête SQL:', sqlError);
      return res.status(500).json({
        success: false,
        message: 'Erreur interne: requête SQL incorrecte',
        error: sqlError,
        debug: { query: finalQuery, params: [...listParams, limit, offset] },
      });
    }

    const result = await db.query(finalQuery, [...listParams, limit, offset]);

    // Ajout du champ type normalisé, statut normalisé et actions disponibles pour chaque dossier
    const dossiers = result.rows.map(d => {
      const normalizedDossier = {
        ...d,
        type: d.type_formulaire || d.machine || null,
        statut: normalizeStatusForFrontend(d.statut), // Normaliser le statut
      };
      
      // Calculer les actions disponibles pour ce dossier
      const availableActions = getAvailableActions(req.user, {
        ...normalizedDossier,
        status: normalizedDossier.statut,
      });
      
      return {
        ...normalizedDossier,
        available_actions: availableActions,
      };
    });

    // Requête de count avec les mêmes conditions que la requête principale
    let countQuery = `SELECT COUNT(*) FROM dossiers d`;
    const countParams = [...listParams];
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);
    const pages = Math.ceil(total / limit);
    res.json({
      success: true,
      dossiers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages,
        // Champs additionnels pour compatibilité frontend
        total_pages: pages,
        total_items: total,
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

// 📄 GET /dossiers/:id - Détail d'un dossier (supporte folder_id UUID)
router.get('/:id', auth, checkDossierPermission('view'), async (req, res) => {
  try {
    const { id } = req.params;

    // Le dossier a déjà été chargé et vérifié par le middleware checkDossierPermission
    const dossier = req.dossier;

    // Essayer de récupérer un formulaire structuré si présent
    let formDetails = null;
    try {
      const fr = await db.query(
        `SELECT type_formulaire, details, date_saisie FROM dossier_formulaires WHERE dossier_id = $1 ORDER BY date_saisie DESC LIMIT 1`,
        [dossier.id]
      );
      if (fr.rows.length > 0) formDetails = fr.rows[0];
    } catch (e) {
      // table possiblement absente, ignorer
    }
    // Fallback: si aucun formulaire structuré en base, tenter de déduire un minimum
    if (!formDetails) {
      const machine = dossier.machine;
      const desc = dossier.description || '';
      const qty = dossier.quantite || null;
      const commentaires = dossier.commentaires || dossier.commentaire || '';
      let inferred = null;
      if ((machine || '').toLowerCase().includes('xerox')) {
        inferred = {};
        if (desc) inferred.format = desc;
        if (qty) inferred.nombre_exemplaires = qty;
      } else if ((machine || '').toLowerCase().includes('roland')) {
        inferred = {};
        if (desc) inferred.dimension = desc;
      }
      // Essayer d'extraire quelques paires clé:valeur depuis commentaires
      try {
        const txt = String(commentaires || '');
        if (txt) {
          const addKV = (key, val) => {
            if (val && !inferred[key]) inferred[key] = val;
          };
          for (const rawLine of txt.split('\n')) {
            const line = rawLine.trim();
            if (!line) continue;
            const [k, ...rest] = line.split(':');
            if (!k || rest.length === 0) continue;
            const v = rest.join(':').trim();
            const kl = k
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();
            if (kl.startsWith('format')) addKV('format', v);
            if (kl.startsWith('dimension')) addKV('dimension', v);
            if (kl.startsWith('exemplaire')) addKV('nombre_exemplaires', v);
            if (kl.includes('type') && kl.includes('document') && !kl.includes('autre'))
              addKV('type_document', v);
            if (kl.includes('type') && kl.includes('document') && kl.includes('autre'))
              addKV('type_document_autre', v);
            if (kl.includes('papier') && !kl.includes('autre')) addKV('type_papier', v);
            if (kl.includes('papier') && kl.includes('autre')) addKV('type_papier_autre', v);
          }
        }
      } catch (_) {}
      if (inferred && Object.keys(inferred).length > 0) {
        formDetails = { type_formulaire: machine, details: inferred, date_saisie: new Date() };
      }
    }

    const filesQuery = `
      SELECT f.*, u.nom as uploaded_by_name 
      FROM fichiers f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.dossier_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const filesResult = await db.query(filesQuery, [dossier.id]);

    const historyQuery = `
      SELECT h.*, u.nom as changed_by_name
      FROM dossier_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.dossier_id = $1
      ORDER BY h.changed_at DESC
    `;

    const historyResult = await db.query(historyQuery, [dossier.id]);

    // Déduire un commentaire de révision si manquant, à partir de l'historique (dernier passage "À revoir")
    let derivedRevisionComment = dossier.commentaire_revision ?? null;
    if (!derivedRevisionComment && Array.isArray(historyResult.rows)) {
      const lastRev = historyResult.rows.find(h => {
        const ns = String(h.nouveau_statut || '').toLowerCase().replace(/\s+/g, '_');
        return (ns === 'a_revoir' || ns === 'à_revoir') && h.commentaire && String(h.commentaire).trim() !== '';
      });
      if (lastRev) derivedRevisionComment = lastRev.commentaire;
    }

    // Calculer les actions disponibles pour cet utilisateur sur ce dossier
    const availableActions = getAvailableActions(req.user, {
      ...dossier,
      status: normalizeStatusForFrontend(dossier.statut),
      statut: normalizeStatusForFrontend(dossier.statut),
      type: dossier.type_formulaire || dossier.machine || dossier.type,
    });

    res.json({
      success: true,
      dossier: {
        ...dossier,
        id: dossier.folder_id, // Utiliser folder_id comme ID principal pour le frontend
        legacy_id: dossier.id, // Garder l'ID integer pour référence
        statut: normalizeStatusForFrontend(dossier.statut), // Normaliser le statut pour le frontend
        ...(formDetails
          ? { data_formulaire: formDetails.details, type_formulaire: formDetails.type_formulaire }
          : {}),
        // Rendre le commentaire de révision facilement accessible aux consommateurs
        commentaire_revision: derivedRevisionComment,
        revision_comment: derivedRevisionComment,
        // Alias large compat: si pas de commentaire(s) fournis ailleurs, renvoyer le commentaire de révision
        commentaire: dossier.commentaire ?? dossier.commentaires ?? derivedRevisionComment ?? null,
        fichiers: filesResult.rows,
        historique: historyResult.rows,
        available_actions: availableActions, // 🎯 Actions disponibles selon rôle et statut
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

// 🆕 POST /dossiers - Créer un nouveau dossier (Préparateur et Admin)
// Nouvelle route POST /dossiers avec gestion UUID et structure conforme au cahier des charges
router.post('/', auth, checkRole(['preparateur', 'admin']), async (req, res) => {
  try {
    const {
      client,
      type_formulaire,
      data_formulaire = {},
      commentaire = '',
      quantite = 1,
      date_livraison = null,
      mode_paiement = null,
      montant_cfa = null,
    } = req.body;

    if (!client || !type_formulaire) {
      return res.status(400).json({
        success: false,
        message: 'Client et type_formulaire sont obligatoires',
      });
    }

    if (!['roland', 'xerox'].includes(type_formulaire.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'type_formulaire doit être roland ou xerox',
      });
    }

    // Génération du numéro unique
    const numero = await generateNumeroCommande();

    // Création du dossier avec preparateur_id et folder_id UUID
    const folderId = uuidv4(); // Générer UUID pour folder_id
    const dossierQuery = `
      INSERT INTO dossiers (
        folder_id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, commentaire, quantite, date_livraison, mode_paiement, montant_cfa
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const values = [
      folderId,
      numero,
      client,
      type_formulaire,
      DB_STATUTS.EN_COURS, // Utiliser le statut DB correct depuis le mapping
      req.user.id,
      data_formulaire,
      commentaire,
      quantite,
      date_livraison,
      mode_paiement,
      montant_cfa,
    ];
    const result = await db.query(dossierQuery, values);
    const dossier = result.rows[0];

    // Ajout : sauvegarde structurée du formulaire
    try {
      await db.query(
        `INSERT INTO dossier_formulaires (dossier_id, type_formulaire, details) VALUES ($1, $2, $3)`,
        [dossier.id, type_formulaire, data_formulaire]
      );
    } catch (e) {
      console.warn("⚠️ Impossible d'insérer dans dossier_formulaires:", e.message);
    }

    // Création du dossier sur le disque
    const uploadPath = path.join(__dirname, '../../uploads', String(dossier.id));
    await fs.mkdir(uploadPath, { recursive: true });

    // Synchronisation Socket.IO via le service centralisé
    socketService.emitDossierCreated(dossier);
    
    // Logger l'activité
    await logDossierActivity(dossier.folder_id, req.user.id, 'created', {
      numero,
      client,
      type_formulaire,
    });

    res.status(201).json({
      success: true,
      message: `Dossier ${numero} créé avec succès`,
      dossier: {
        ...dossier,
        id: dossier.folder_id, // Retourner folder_id comme ID principal
        legacy_id: dossier.id,
      },
    });
  } catch (error) {
    console.error('Erreur POST /dossiers:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du dossier',
      error: error.message,
    });
  }
});

// ✏️ PUT /dossiers/:id - Modifier un dossier (supporte folder_id UUID)
router.put('/:id', auth, checkDossierPermission('update'), async (req, res) => {
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
    } = req.body;
    // Compat: accepter `commentaire` (singulier) et mapper vers `commentaires` si nécessaire
    const commentaires =
      req.body?.commentaires !== undefined
        ? req.body.commentaires
        : req.body?.commentaire !== undefined
          ? req.body.commentaire
          : undefined;

    // Le dossier a déjà été chargé et vérifié par checkDossierPermission
    const dossier = req.dossier;
    const oldData = { ...dossier }; // Pour tracker les changements

    // Normaliser le statut pour gérer les différents formats
    const statutNormalise = dossier.statut.toLowerCase().replace(/\s+/g, '_');
    
    const canModify =
      req.user.role === 'admin' ||
      (req.user.role === 'preparateur' &&
        dossier.created_by === parseInt(parseInt(req.user.id)) &&
        !dossier.valide_preparateur) ||
      (req.user.role === 'preparateur' && statutNormalise === 'a_revoir');

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

    // Enregistrer un snapshot des détails si form_data/type_formulaire fournis
    try {
      const body = req.body || {};
      let formData = body.form_data || body.data_formulaire || null;
      const tfRaw = body.type_formulaire || body.machine || updatedDossier?.machine || null;
      // Fallback: si formData non fourni mais certains champs ont changé, tenter de déduire minimal
      if (!formData) {
        const desc = (description !== undefined ? description : updatedDossier?.description) || '';
        const qtyVal = (quantite !== undefined ? quantite : updatedDossier?.quantite) || null;
        if (
          String(tfRaw || '')
            .toLowerCase()
            .includes('xerox')
        ) {
          const inferred = {};
          if (desc) inferred.format = desc;
          if (qtyVal) inferred.nombre_exemplaires = parseInt(qtyVal);
          if (Object.keys(inferred).length > 0) formData = inferred;
        } else if (
          String(tfRaw || '')
            .toLowerCase()
            .includes('roland')
        ) {
          const inferred = {};
          if (desc) inferred.dimension = desc;
          if (Object.keys(inferred).length > 0) formData = inferred;
        }
      }
      if (formData && typeof formData === 'object' && tfRaw) {
        const tf = tfRaw.toString().toLowerCase().includes('roland')
          ? 'Roland'
          : tfRaw.toString().toLowerCase().includes('xerox')
            ? 'Xerox'
            : null;
        if (tf) {
          await db.query(
            `INSERT INTO dossier_formulaires (dossier_id, type_formulaire, details) VALUES ($1, $2, $3)`,
            [id, tf, formData]
          );
        }
      }
    } catch (e) {
      console.warn("⚠️ Impossible d'enregistrer form_data lors du PUT:", e.message);
    }

    // Émission Socket.IO avec le service centralisé
    const changes = {};
    if (client !== undefined) changes.client = { old: oldData.client, new: client };
    if (machine !== undefined) changes.machine = { old: oldData.machine, new: machine };
    if (description !== undefined) changes.description = { old: oldData.description, new: description };
    socketService.emitDossierUpdated(updatedDossier, changes);
    
    // Logger l'activité
    await logDossierActivity(updatedDossier.folder_id, req.user.id, 'updated', changes);

    res.json({
      success: true,
      message: 'Dossier modifié avec succès',
      dossier: {
        ...updatedDossier,
        id: updatedDossier.folder_id,
        legacy_id: updatedDossier.id,
      },
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

// Factoriser le changement de statut pour réutilisation
async function changeStatutCore(req, res) {
  try {
    const { id } = req.params;
    const { nouveau_statut, commentaire = null } = req.body;
    // Champs optionnels pour la livraison/paiement
    const date_livraison_prevue = req.body?.date_livraison_prevue ?? undefined;
    const date_livraison = req.body?.date_livraison ?? undefined;
    const mode_paiement = req.body?.mode_paiement ?? undefined;
    // accepter montant_paye (frontend) et mapper vers montant_cfa
    const montant_cfa =
      req.body?.montant_cfa !== undefined
        ? req.body.montant_cfa
        : req.body?.montant_paye !== undefined
          ? req.body.montant_paye
          : undefined;

    // États étendus selon le cahier des charges
    const statusAllowed = [
      'Nouveau',
      'En préparation', // alias de "En cours" si nécessaire
      'En cours',
      'À revoir',
      'Prêt impression',
      'En impression',
      'Imprimé',
      'Prêt livraison',
      'En livraison',
      'Livré',
      'Terminé',
    ];

    if (!statusAllowed.includes(nouveau_statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Autorisés: ${statusAllowed.join(', ')}`,
      });
    }

    const checkQuery = filterDossiersByRole(
      req.user,
      `
      SELECT d.* FROM dossiers d WHERE d.id = $1
    `,
      1
    );

    const checkParams = [id];
    if (req.user.role === 'preparateur') {
      checkParams.push(parseInt(req.user.id));
    }

    const checkResult = await db.query(checkQuery, checkParams);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action',
      });
    }

    const dossier = checkResult.rows[0];

    // Règle: "À revoir" nécessite un commentaire
    const targetStatutNormalise = nouveau_statut.toLowerCase().replace(/\s+/g, '_');
    if (targetStatutNormalise === 'a_revoir' && (!commentaire || !String(commentaire).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Un commentaire est requis pour passer un dossier en "À revoir"',
        code: 'COMMENT_REQUIRED',
      });
    }

    const canChangeStatus = () => {
      // Normaliser les statuts pour la comparaison
      const current = normalizeStatusForWorkflow(dossier.statut);
      const target = normalizeStatusForWorkflow(nouveau_statut);
      
      switch (req.user.role) {
        case 'admin': {
          // Admin: toutes transitions raisonnées
          const adminTransitions = {
            'À revoir': ['En cours'],
            'En cours': ['À revoir', 'Prêt impression', 'En impression', 'Prêt livraison'], // compat legacy
            'Prêt impression': ['En impression', 'À revoir'],
            'En impression': ['Imprimé', 'À revoir', 'En cours'],
            'Imprimé': ['Prêt livraison', 'En impression', 'À revoir'],
            'Prêt livraison': ['En livraison', 'Imprimé'],
            'En livraison': ['Livré', 'Prêt livraison'],
            'Livré': ['Terminé', 'Prêt livraison'],
            'Terminé': [],
          };
          return (adminTransitions[current] || []).includes(target);
        }
        case 'preparateur':
          // Le préparateur corrige depuis "À revoir" → "En cours"
          return (
            dossier.created_by === parseInt(req.user.id) &&
            current === 'À revoir' &&
            target === 'En cours'
          );
        case 'imprimeur_roland':
        case 'imprimeur_xerox': {
          // Imprimeur: prépare ou imprime
          const printTransitions = {
            'En cours': ['À revoir', 'En impression'], // compat legacy
            'Prêt impression': ['En impression', 'À revoir'],
            'En impression': ['Imprimé', 'À revoir', 'Prêt livraison'],
            'Imprimé': ['Prêt livraison', 'À revoir'],
          };
          return (printTransitions[current] || []).includes(target);
        }
        case 'livreur': {
          // Livreur: de prêt à en livraison puis Terminé (final)
          if (current === 'Prêt livraison' && target === 'En livraison') return true;
          if (
            current === 'En livraison' &&
            (target === 'Terminé' || target === 'Livré')
          )
            return true; // accepter 'Livré' en alias
          return false;
        }
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

    // Garde explicite : un imprimeur ne peut jamais passer à 'Terminé' ou 'COMPLETED'
    if ((req.user.role === 'imprimeur_roland' || req.user.role === 'imprimeur_xerox') && ['Terminé', 'termine', 'COMPLETED', 'completed'].includes(String(nouveau_statut).trim())) {
      return res.status(403).json({
        success: false,
        message: `Un imprimeur ne peut pas clore un dossier en 'Terminé'. Statut demandé: ${nouveau_statut}`,
      });
    }

    // Construire dynamiquement la mise à jour pour persister les champs de livraison/paiement
    const setClauses = ['statut = $1', 'commentaire_revision = $2'];
    const extraValues = [];
    let paramIndex = 4; // $3 est réservé pour l'ID dans le WHERE

    // Pour la planification de livraison
    if (nouveau_statut === 'En livraison' && date_livraison_prevue !== undefined) {
      setClauses.push(`date_livraison_prevue = $${paramIndex++}`);
      extraValues.push(date_livraison_prevue);
    }
    // Pour la confirmation de livraison (finaliser en "Terminé")
    if (nouveau_statut === 'Livré' || nouveau_statut === 'Terminé') {
      // Si une date est fournie, l'utiliser, sinon par défaut NOW()
      if (date_livraison !== undefined && String(date_livraison).trim() !== '') {
        setClauses.push(`date_livraison = $${paramIndex++}`);
        extraValues.push(date_livraison);
      } else {
        setClauses.push(`date_livraison = NOW()`);
      }
      if (mode_paiement !== undefined) {
        setClauses.push(`mode_paiement = $${paramIndex++}`);
        extraValues.push(mode_paiement);
      }
      if (montant_cfa !== undefined && montant_cfa !== null && montant_cfa !== '') {
        setClauses.push(`montant_cfa = $${paramIndex++}`);
        extraValues.push(parseFloat(montant_cfa));
      }
    }

    // 🔧 Normaliser le statut vers le format DB avant de persister
    // Utiliser le système centralisé pour garantir la cohérence
    let statutToPersist = normalizeToDb(nouveau_statut);
    
    // Cas spécial : Livré = Terminé en DB
    if (nouveau_statut === 'Livré' || nouveau_statut === 'livre') {
      statutToPersist = DB_STATUTS.TERMINE;
    }
    
    // Vérifier que le statut est valide pour la DB
    if (!isValidDbStatus(statutToPersist)) {
      console.warn(`⚠️  Statut non valide pour la DB: "${statutToPersist}" (depuis "${nouveau_statut}")`);
      // Fallback au statut normalisé
      statutToPersist = normalizeToDb(nouveau_statut);
    }

    const updateQuery = `
      UPDATE dossiers 
      SET ${setClauses.join(', ')}
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(updateQuery, [statutToPersist, commentaire, id, ...extraValues]);
    const updatedDossier = result.rows[0];

    if (commentaire) {
      await db.query(
        `
        UPDATE dossier_status_history 
        SET commentaire = $1 
        WHERE id = (
          SELECT id FROM dossier_status_history 
          WHERE dossier_id = $2 AND nouveau_statut = $3 AND commentaire IS NULL
          ORDER BY changed_at DESC LIMIT 1
        )
      `,
        [commentaire, id, nouveau_statut]
      );
    }

    // Émission Socket.IO via service centralisé
    socketService.emitStatusChanged(
      updatedDossier.folder_id, 
      dossier.statut, 
      statutToPersist, 
      updatedDossier
    );
    
    // Logger l'activité
    await logDossierActivity(updatedDossier.folder_id, req.user.id, 'status_changed', {
      old_status: dossier.statut,
      new_status: statutToPersist,
      commentaire,
    });

    return res.json({
      success: true,
      message: `Statut changé: ${dossier.statut} → ${nouveau_statut}`,
      dossier: {
        ...updatedDossier,
        id: updatedDossier.folder_id,
        legacy_id: updatedDossier.id,
        // Exposer explicitement le commentaire de révision pour compat frontend
        commentaire_revision: updatedDossier.commentaire_revision ?? null,
        revision_comment: updatedDossier.commentaire_revision ?? null,
        // Alias large compat: si pas de commentaire(s), fournir le commentaire de révision
        commentaire: updatedDossier.commentaire ?? updatedDossier.commentaires ?? updatedDossier.commentaire_revision ?? null,
      },
    });
  } catch (error) {
    console.error('Erreur changement de statut:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut',
      error: error.message,
    });
  }
}

// Fonction de changement de statut utilisant le dossier déjà chargé par le middleware
async function changeStatutCoreFixed(req, res) {
    // Garde stricte : interdit à un imprimeur de passer un dossier en 'Terminé'
    // Priorité au champ 'status' (snake_case) envoyé par le frontend
    let nouveau_statut = req.body?.status || req.body?.nouveau_statut || '';
    nouveau_statut = String(nouveau_statut).trim();
    // Si le statut est en snake_case, le mapper vers le label français pour la validation
    const snakeToFr = {
      'en_cours': 'En cours',
      'a_revoir': 'À revoir',
      'en_impression': 'En impression',
      'pret_impression': 'Prêt impression',
      'imprime': 'Imprimé',
      'pret_livraison': 'Prêt livraison',
      'en_livraison': 'En livraison',
      'livre': 'Livré',
      'termine': 'Terminé',
    };
    const validationStatut = snakeToFr[nouveau_statut] || nouveau_statut;
    const requestedStatusKey = nouveau_statut.toLowerCase();
    if ((req.user.role === 'imprimeur_roland' || req.user.role === 'imprimeur_xerox') && (requestedStatusKey === 'termine' || requestedStatusKey === 'terminé')) {
      return res.status(403).json({
        success: false,
        message: "Un imprimeur ne peut pas clore un dossier en 'Terminé'.",
        code: 'FORBIDDEN_IMPRIMEUR_TERMINE',
        details: { role: req.user.role, requestedStatusKey }
      });
    }
    try {
      // Log complet du payload reçu pour diagnostic
      try {
        const currentStat = req.dossier?.statut;
        const requested = nouveau_statut;
        console.log('[CHANGE_STATUS DEBUG]', {
          user: { id: req.user?.id, role: req.user?.role },
          param: req.params?.id,
          hasDossier: !!req.dossier,
          currentStat,
          requested,
          body: req.body
        });
      } catch (dbg) {}

      // Le dossier a déjà été chargé par checkDossierPermission et est dans req.dossier
      const dossier = req.dossier;
      const commentaire = req.body?.commentaire ?? req.body?.comment ?? null;

      // Champs optionnels pour la livraison/paiement
      const date_livraison_prevue = req.body?.date_livraison_prevue ?? undefined;
      const date_livraison = req.body?.date_livraison ?? undefined;
      const mode_paiement = req.body?.mode_paiement ?? undefined;
      const montant_cfa =
        req.body?.montant_cfa !== undefined
          ? req.body.montant_cfa
          : req.body?.montant_paye !== undefined
            ? req.body.montant_paye
            : undefined;

      // États étendus selon le cahier des charges
      const statusAllowed = [
        'Nouveau',
        'En préparation',
        'En cours',
        'À revoir',
        'Prêt impression',
        'En impression',
        'Imprimé',
        'Prêt livraison',
        'En livraison',
        'Livré',
        'Terminé',
      ];

      if (!statusAllowed.includes(validationStatut)) {
        return res.status(400).json({
          success: false,
          message: `Statut invalide. Autorisés: ${statusAllowed.join(', ')}`,
        });
      }

      // Règle: "À revoir" nécessite un commentaire
      const targetStatutNormaliseFixed = nouveau_statut.toLowerCase().replace(/\s+/g, '_');
      if (targetStatutNormaliseFixed === 'a_revoir' && (!commentaire || !String(commentaire).trim())) {
        return res.status(400).json({
          success: false,
          message: 'Un commentaire est requis pour passer un dossier en "À revoir"',
          code: 'COMMENT_REQUIRED',
        });
      }

    // Validation des transitions selon les rôles
    const canChangeStatus = () => {
      const current = normalizeStatusForWorkflow(dossier.statut);
      const target = normalizeStatusForWorkflow(nouveau_statut);
      
      // If admin, allow all transitions (short-circuit). Administrators need full control.
      if (req.user.role === 'admin') return true;

      switch (req.user.role) {
        case 'admin': {
          // L'admin peut faire presque toutes les transitions (fallback, kept for compatibility)
          const adminTransitions = {
            'À revoir': ['En cours', 'En impression', 'Prêt impression', 'Imprimé', 'Terminé'],
            'En cours': ['À revoir', 'Prêt impression', 'En impression', 'Prêt livraison', 'Imprimé', 'Terminé'],
            'Prêt impression': ['En impression', 'À revoir', 'En cours', 'Imprimé', 'Terminé'],
            'En impression': ['Imprimé', 'À revoir', 'En cours', 'Prêt impression', 'Terminé'],
            'Imprimé': ['Prêt livraison', 'En impression', 'À revoir', 'En cours', 'Terminé'],
            'Prêt livraison': ['En livraison', 'Imprimé', 'En impression', 'Terminé'],
            'En livraison': ['Livré', 'Prêt livraison', 'Imprimé', 'Terminé'],
            'Livré': ['Terminé', 'Prêt livraison', 'En livraison', 'En cours', 'Imprimé'],
            'Terminé': ['Livré', 'En cours', 'À revoir', 'En impression'], // Permettre de revenir depuis Terminé, y compris remettre en impression
          };
          return (adminTransitions[current] || []).includes(target);
        }
        case 'preparateur': {
          // Le préparateur peut gérer ses dossiers et faire les transitions de préparation
          const prepTransitions = {
            'À revoir': ['En cours', 'Prêt impression'],
            'En cours': ['À revoir', 'Prêt impression'],
            'Prêt impression': ['En cours', 'À revoir', 'En impression'],
          };
          return (prepTransitions[current] || []).includes(target);
        }
        case 'imprimeur_roland':
        case 'imprimeur_xerox': {
          // Les imprimeurs ne peuvent pas clore un dossier en 'Terminé' directement.
          const printTransitions = {
            'En cours': ['À revoir', 'Prêt impression', 'En impression'],
            'Prêt impression': ['En impression', 'À revoir', 'En cours'],
            'En impression': ['Imprimé', 'À revoir', 'Prêt livraison', 'En cours'],
            // Enlever 'Terminé' comme cible possible depuis 'Imprimé' pour les imprimeurs
            'Imprimé': ['Prêt livraison', 'À revoir', 'En impression'],
            'Prêt livraison': ['En livraison', 'Imprimé', 'En impression'],
          };
          return (printTransitions[current] || []).includes(target);
        }
        case 'livreur': {
          const deliveryTransitions = {
            'Imprimé': ['Prêt livraison'],
            'Prêt livraison': ['En livraison', 'Imprimé'],
            'En livraison': ['Terminé', 'Livré', 'Prêt livraison'],
            'Livré': ['Terminé'],
          };
          return (deliveryTransitions[current] || []).includes(target);
        }
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

    // Mise à jour avec les champs optionnels
    let updateFields = ['statut = $1', 'updated_at = CURRENT_TIMESTAMP'];
    let values = [nouveau_statut];
    let paramIndex = 2;

    // Si un commentaire est fourni, le persister comme commentaire de révision
    if (commentaire && String(commentaire).trim() !== '') {
      updateFields.push(`commentaire_revision = $${paramIndex}`);
      values.push(commentaire);
      paramIndex++;
    }

    if (date_livraison_prevue !== undefined) {
      updateFields.push(`date_livraison_prevue = $${paramIndex}`);
      values.push(date_livraison_prevue);
      paramIndex++;
    }
    if (date_livraison !== undefined) {
      updateFields.push(`date_livraison_reelle = $${paramIndex}`);
      values.push(date_livraison);
      paramIndex++;
    }
    if (mode_paiement !== undefined) {
      updateFields.push(`mode_paiement = $${paramIndex}`);
      values.push(mode_paiement);
      paramIndex++;
    }
    if (montant_cfa !== undefined) {
      updateFields.push(`montant_cfa = $${paramIndex}`);
      values.push(montant_cfa);
      paramIndex++;
    }

    const updateQuery = `
      UPDATE dossiers 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(dossier.id); // Utiliser l'ID réel du dossier
    const result = await db.query(updateQuery, values);
    const updatedDossier = result.rows[0];

    // Ajouter commentaire si fourni
    if (commentaire) {
      await db.query(
        `
        UPDATE dossier_status_history 
        SET commentaire = $1 
        WHERE id = (
          SELECT id FROM dossier_status_history 
          WHERE dossier_id = $2 AND nouveau_statut = $3 AND commentaire IS NULL
          ORDER BY changed_at DESC LIMIT 1
        )
      `,
        [commentaire, dossier.id, nouveau_statut]
      );
    }

    // Émission Socket.IO via service centralisé
    socketService.emitStatusChanged(
      updatedDossier.folder_id, 
      dossier.statut, 
      nouveau_statut, 
      updatedDossier
    );
    
    // Logger l'activité
    await logDossierActivity(updatedDossier.folder_id, req.user.id, 'status_changed', {
      old_status: dossier.statut,
      new_status: nouveau_statut,
      commentaire,
    });

    return res.json({
      success: true,
      message: `Statut changé: ${dossier.statut} → ${nouveau_statut}`,
      dossier: {
        ...updatedDossier,
        id: updatedDossier.folder_id,
        legacy_id: updatedDossier.id,
        // Exposer explicitement le commentaire de révision pour compat frontend
        commentaire_revision: updatedDossier.commentaire_revision ?? null,
        revision_comment: updatedDossier.commentaire_revision ?? null,
        // Alias large compat: si pas de commentaire(s), fournir le commentaire de révision
        commentaire: updatedDossier.commentaire ?? updatedDossier.commentaires ?? updatedDossier.commentaire_revision ?? null,
      },
    });
  } catch (error) {
    console.error('Erreur changement de statut (fixed):', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut',
      error: error.message,
    });
  }
}

// 🔄 PUT /dossiers/:id/statut - Changer le statut d'un dossier
router.put('/:id/statut', auth, checkDossierPermission('change_status'), async (req, res) => {
  return changeStatutCoreFixed(req, res);
});

// 🔁 ALIAS PATCH /dossiers/:id/status - Payload { status, comment } (compat guide)
router.patch('/:id/status', auth, checkDossierPermission('change_status'), async (req, res) => {
  try {
    const mapAppToFr = {
      en_cours: 'En cours',
      a_revoir: 'À revoir',
      en_impression: 'En impression',
      termine: 'Terminé',
      imprime: 'Imprimé',
      pret_impression: 'Prêt impression',
      pret_livraison: 'Prêt livraison',
      en_livraison: 'En livraison',
      livre: 'Livré',
    };
    const status = req.body?.status;
    const comment = req.body?.comment ?? req.body?.commentaire ?? null;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Champ status requis' });
    }
    req.body.nouveau_statut = mapAppToFr[status] || status;
    req.body.commentaire = comment;
    return changeStatutCoreFixed(req, res);
  } catch (e) {
    console.error('Erreur alias PATCH /status:', e);
    return res
      .status(500)
      .json({ success: false, message: 'Erreur alias status', error: e.message });
  }
});


// ✅ PUT /dossiers/:id/remettre-en-impression - Remettre un dossier en impression (Admin)
router.put('/:id/remettre-en-impression', auth, checkRole(['admin']), validateIdParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire = null } = req.body || {};

    // 1. Charger le dossier
    const checkResult = await db.query(
      `SELECT id, created_by, preparateur_id, statut FROM dossiers WHERE id = $1`,
      [id]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation de le remettre en impression' });
    }
    const d = checkResult.rows[0];
    const userId = parseInt(req.user.id);

    // 2. Vérifier que le dossier est dans un état "terminé" ou "imprimé"
    const statutsAutorises = ['Terminé', 'Imprimé', 'Livré'];
    if (!statutsAutorises.includes(d.statut)) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de remettre en impression depuis l'état "${d.statut}". États autorisés: ${statutsAutorises.join(', ')}` 
      });
    }

    // 3. Définir le nouveau statut
    const statutPersist = 'En impression';  // Format attendu en DB
    const statutLabelFr = 'En impression';  // Pour l'historique et les logs
    const statutCodeNormalise = 'en_impression';  // Code normalisé pour le frontend

    // 4. Mettre à jour le dossier
    const updateQuery = `
      UPDATE dossiers
      SET statut = $2, updated_at = NOW(),
          commentaire_revision = COALESCE($3, commentaire_revision)
      WHERE id = $1
      RETURNING *
    `;
    const updateResult = await db.query(updateQuery, [id, statutPersist, commentaire]);
    const dossier = updateResult.rows[0];

    // 5. Insérer dans l'historique
    try {
      await db.query(
        `INSERT INTO dossier_status_history (dossier_id, ancien_statut, nouveau_statut, changed_by, commentaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, d.statut, statutLabelFr, userId, commentaire || 'Remise en impression par admin']
      );
    } catch (e) {
      console.warn('⚠️ Historique non enregistré:', e.message);
    }

    // 6. Notifications temps réel
    const io = req.app.get('io');
    if (io) {
      io.emit('dossier_status_changed', {
        dossier,
        ancien_statut: d.statut,
        nouveau_statut: statutLabelFr,
        changed_by: req.user.nom,
        commentaire: commentaire || 'Remise en impression par admin',
        message: `Dossier ${dossier.numero_commande || dossier.numero || dossier.id} remis en impression par ${req.user.nom}`
      });
    }

    // 7. Log pour audit
    console.log(`✅ ADMIN REPRINT: Dossier ${id} remis en impression: ${d.statut} → ${statutLabelFr} par ${req.user.nom}`);

    // 8. Réponse
    res.json({
      success: true,
      message: `Dossier remis en impression avec succès: ${d.statut} → ${statutLabelFr}`,
      dossier,
      statut_code: statutCodeNormalise,
      ancien_statut: d.statut,
      nouveau_statut: statutLabelFr,
      commentaire: commentaire || 'Remise en impression par admin'
    });

  } catch (error) {
    console.error('Erreur PUT /dossiers/:id/remettre-en-impression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la remise en impression du dossier',
      error: error.message,
    });
  }
});

// 📤 POST /dossiers/:id/fichiers - Upload de fichiers (supporte folder_id UUID)
router.post('/:id/fichiers', auth, checkDossierPermission('upload_file'), upload.array('files', 10), async (req, res) => {
  try {
    const { id: dossierId } = req.params;
    
    // Le dossier a déjà été chargé et vérifié par checkDossierPermission
    const dossier = req.dossier;

    // Vérifications supplémentaires du workflow de validation des fichiers
    if (req.user.role === 'preparateur') {
      // Préparateur: vérifier propriété + workflow de validation
      const isOwner = dossier.created_by === req.user.id || dossier.preparateur_id === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Seul le créateur du dossier peut ajouter des fichiers',
        });
      }

      // Workflow de validation: upload interdit si dossier validé SAUF si statut "À revoir"
      const allowedStatuses = ['En cours', 'en_cours', 'À revoir', 'a_revoir'];
      if (dossier.valide_preparateur && !['À revoir', 'a_revoir'].includes(dossier.statut)) {
        return res.status(403).json({
          success: false,
          message: 'Upload interdit: dossier validé et figé. Disponible uniquement si remis "À revoir"',
        });
      }
      
      if (!allowedStatuses.includes(dossier.statut)) {
        return res.status(403).json({
          success: false,
          message: `Upload non autorisé pour le statut "${dossier.statut}"`,
        });
      }
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
        const relativePath = `uploads/${dossier.folder_id || dossierId}/${file.filename}`;

        const fileBuffer = await fs.readFile(file.path);
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const existingFileCheck = await db.query(
          'SELECT id FROM fichiers WHERE dossier_id = $1 AND checksum = $2',
          [dossier.id, checksum]
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
          dossier.id,
          file.originalname,
          relativePath,
          file.mimetype.startsWith('image/') ? 'image' : 'document',
          file.size,
          parseInt(req.user.id),
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

    // Émission Socket.IO pour chaque fichier
    for (const file of uploadedFiles) {
      socketService.emitFileUploaded(dossier.folder_id, file);
      await logDossierActivity(dossier.folder_id, req.user.id, 'file_uploaded', {
        file_name: file.nom,
        file_size: file.taille,
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
router.get('/:id/fichiers', auth, checkDossierPermission('view'), async (req, res) => {
  try {
    // Le dossier a déjà été chargé et vérifié par checkDossierPermission
    const dossier = req.dossier;

    const filesQuery = `
      SELECT f.*, u.nom as uploaded_by_name 
      FROM fichiers f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.dossier_id = $1
      ORDER BY f.uploaded_at DESC
    `;

    const filesResult = await db.query(filesQuery, [dossier.id]);

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

// �️ GET /fichiers/:id/preview - Prévisualiser un fichier (streaming)
router.get('/fichiers/:id/preview', auth, async (req, res) => {
  try {
    const { id: fileId } = req.params;

    const fileQuery = `
      SELECT f.*, d.folder_id FROM fichiers f
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

    // Vérifier permissions via getDossierByIdentifier
    const dossier = await getDossierByIdentifier(file.folder_id);
    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier associé non trouvé',
      });
    }

    const access = checkUserAccess(dossier, req.user);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: access.reason,
      });
    }

    const fullPath = path.join(__dirname, '../..', file.chemin);

    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Fichier physique non trouvé',
      });
    }

    // Headers pour prévisualisation inline
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.nom}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h

    res.sendFile(fullPath);
  } catch (error) {
    console.error('Erreur GET /fichiers/:id/preview:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la prévisualisation',
      error: error.message,
    });
  }
});

// �📂 GET /fichiers/:id/download - Télécharger un fichier
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

    // Vérifier permissions via getDossierByIdentifier
    const dossier = await getDossierByIdentifier(file.folder_id || file.dossier_id);
    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier associé non trouvé',
      });
    }

    const access = checkUserAccess(dossier, req.user);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: access.reason,
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
        file.created_by === parseInt(parseInt(req.user.id)) &&
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

    // Récupérer le dossier pour avoir le folder_id
    const dossierResult = await db.query('SELECT folder_id FROM dossiers WHERE id = $1', [file.dossier_id]);
    const folderId = dossierResult.rows[0]?.folder_id;
    
    if (folderId) {
      socketService.emitFileDeleted(folderId, fileId, file.nom);
      await logDossierActivity(folderId, req.user.id, 'file_deleted', {
        file_name: file.nom,
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

// 🗑️ DELETE /dossiers/:id - Supprimer un dossier et tous ses fichiers (supporte folder_id UUID)
router.delete('/:id', auth, checkDossierPermission('delete'), async (req, res) => {
  try {
    const { id: dossierId } = req.params;
    const user = req.user;

    // Charger le dossier
    const dossierResult = await db.query('SELECT * FROM dossiers d WHERE d.id = $1', [dossierId]);
    if (dossierResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation de le supprimer' });
    }
    const dossier = dossierResult.rows[0];

    // Autorisation: admin OU préparateur propriétaire du dossier (statuts En cours/À revoir)
    const isAdmin = user.role === 'admin';
    // Normaliser le statut pour gérer les différents formats
    const statutNormalise = dossier.statut.toLowerCase().replace(/\s+/g, '_');
    const isPreparateurOwner =
      user.role === 'preparateur' &&
      dossier.created_by === parseInt(user.id) &&
      (statutNormalise === 'en_cours' || statutNormalise === 'a_revoir');
    if (!isAdmin && !isPreparateurOwner) {
      return res.status(403).json({ success: false, message: 'Suppression non autorisée' });
    }

    // Supprimer les fichiers physiques et en base
    const filesResult = await db.query('SELECT * FROM fichiers WHERE dossier_id = $1', [dossierId]);
    for (const file of filesResult.rows) {
      const fullPath = path.join(__dirname, '../..', file.chemin);
      try {
        await fs.unlink(fullPath);
      } catch (unlinkError) {
        console.warn(`Impossible de supprimer le fichier physique ${file.nom}:`, unlinkError);
      }
    }
    await db.query('DELETE FROM fichiers WHERE dossier_id = $1', [dossierId]);

    // Supprimer le répertoire uploads du dossier
    const uploadPath = path.join(__dirname, '../../uploads', dossierId);
    try {
      // rm récursif remplace rmdir déprécié
      await fs.rm(uploadPath, { recursive: true, force: true });
    } catch (rmdirError) {
      console.warn('Impossible de supprimer le répertoire du dossier:', rmdirError);
    }

    // Supprimer l'historique éventuel (optionnel)
    try {
      await db.query('DELETE FROM dossier_status_history WHERE dossier_id = $1', [dossierId]);
    } catch (_) {}

    // Supprimer le dossier
    await db.query('DELETE FROM dossiers WHERE id = $1', [dossierId]);

    // Notifier via Socket.IO
    socketService.emitDossierDeleted(dossier.folder_id, {
      numero_commande: dossier.numero_commande,
      deleted_by: user.nom,
    });
    
    // Logger (avant suppression pour avoir le folder_id)
    await logDossierActivity(dossier.folder_id, user.id, 'deleted', {
      numero_commande: dossier.numero_commande,
    });

    res.json({ success: true, message: `Dossier ${dossier.numero_commande} supprimé avec succès` });
  } catch (error) {
    console.error('Erreur DELETE /dossiers/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du dossier',
      error: error.message,
    });
  }
});

// Export du routeur pour utilisation par server.js
module.exports = router;

// ✅ PUT /dossiers/:id/valider - Workflow simplifié de validation/revalidation
router.put('/:id/valider', auth, checkDossierPermission('validate'), async (req, res) => {
  try {
    const { commentaire = null } = req.body || {};
    const dossier = req.dossier; // Dossier déjà chargé par le middleware

    console.log('[WORKFLOW_SIMPLE] Validation/revalidation:', { 
      user: req.user?.nom, 
      dossier_id: dossier.folder_id,
      statut_actuel: dossier.statut,
      commentaire_revision: dossier.commentaire_revision
    });

    // 1. Vérifier que le dossier peut être validé (En cours ou À revoir uniquement)
    // Normaliser le statut pour gérer les différents formats (en_cours, En cours, etc.)
    const statutNormalise = dossier.statut.toLowerCase().replace(/\s+/g, '_');
    const statutsAutorisesNormalises = ['en_cours', 'a_revoir'];
    
    if (!statutsAutorisesNormalises.includes(statutNormalise)) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de valider ce dossier. Statut actuel: "${dossier.statut}". Le dossier doit être "En cours" ou "À revoir".` 
      });
    }

    // 2. Vérifier qu'il y a au moins un fichier
    const filesCheck = await db.query('SELECT COUNT(*) FROM fichiers WHERE dossier_id = $1', [dossier.id]);
    if (parseInt(filesCheck.rows[0].count) === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de valider un dossier sans fichiers. Veuillez d\'abord uploader un fichier.' 
      });
    }

    // 3. Workflow simplifié: dossier → "Prêt impression" (prêt pour les imprimeurs)
    const nouveauStatut = 'Prêt impression';
    
    const updateQuery = `
      UPDATE dossiers
      SET statut = $2, valide_preparateur = true, date_validation_preparateur = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const updateResult = await db.query(updateQuery, [dossier.id, nouveauStatut]);
    const dossierMisAJour = updateResult.rows[0];

    // 4. Historique des changements
    try {
      await db.query(
        `INSERT INTO dossier_status_history (dossier_id, ancien_statut, nouveau_statut, changed_by, commentaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [dossier.id, dossier.statut, nouveauStatut, req.user.id, commentaire]
      );
    } catch (e) {
      console.warn('[WORKFLOW_SIMPLE] Erreur historique:', e.message);
    }

    // 5. Notifications Socket.IO
    try {
      const socketService = require('../services/socketService');
      socketService.emitStatusChanged(dossier.folder_id, dossier.statut, nouveauStatut, dossierMisAJour);
    } catch (socketError) {
      console.warn('[WORKFLOW_SIMPLE] Erreur notification:', socketError.message);
    }

    // 6. Message selon le contexte (validation initiale vs revalidation)
    const messageSucces = statutNormalise === 'a_revoir' 
      ? 'Dossier revalidé avec succès ! Il est maintenant prêt pour l\'impression.' 
      : 'Dossier validé avec succès ! Il est maintenant prêt pour l\'impression.';

    console.log('[WORKFLOW_SIMPLE] Succès:', messageSucces);

    // 7. Réponse avec les données nécessaires pour le frontend
    return res.json({
      success: true,
      message: messageSucces,
      dossier: {
        ...dossierMisAJour,
        statut: 'pret_impression', // Code normalisé pour le frontend
        statut_legacy: nouveauStatut,
        valide_preparateur: true,
        // Inclure le commentaire de révision pour que le frontend puisse l'afficher
        commentaire_revision: dossierMisAJour.commentaire_revision
      }
    });

  } catch (error) {
    console.error('[WORKFLOW_SIMPLE] Erreur validation:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation du dossier',
      error: error.message,
    });
  }
});
