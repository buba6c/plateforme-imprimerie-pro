const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  Status,
  canTransition,
  getAvailableActions,
  canDeleteDossier,
  canViewDossier,
  getNotifications,
  validateTransition,
} = require('../constants/workflow');
const router = express.Router();

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// ================================
// UTILITAIRES
// ================================

// Statuts valides pour un dossier (selon cahier des charges)
const VALID_STATUSES = [
  'en_cours', // Créé par Préparateur (remplace 'nouveau')
  'a_revoir', // Renvoyé par Imprimeur avec commentaire
  'en_impression', // Accepté par Imprimeur
  'termine', // Validé par Imprimeur (remplace 'imprime')
  'en_livraison', // Transmis au Livreur
  'livre', // Clôturé par Livreur
];

// Mapping des anciens statuts vers nouveaux (pour compatibilité)
const STATUS_MAPPING = {
  nouveau: 'en_cours',
  en_preparation: 'en_cours',
  pret_impression: 'en_cours',
  imprime: 'termine',
  pret_livraison: 'termine',
  // Les autres statuts restent identiques
};

// Types de dossiers valides
const VALID_TYPES = ['roland', 'xerox'];

// ================================
// ROUTES DOSSIERS
// ================================
// DELETE /api/dossiers - Suppression de plusieurs dossiers (batch, admin)
router.delete('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "Liste d'IDs de dossiers requise",
        code: 'MISSING_IDS',
      });
    }

    // Supprimer les dossiers
    await query(`DELETE FROM dossiers WHERE id = ANY($1::int[])`, [ids]);

    // Supprimer les fichiers associés
    await query(`DELETE FROM dossier_files WHERE dossier_id = ANY($1::int[])`, [ids]);

    // Supprimer l'historique des statuts
    await query(`DELETE FROM dossier_status_history WHERE dossier_id = ANY($1::int[])`, [ids]);

    // Notification temps réel pour tous les rôles
    if (global.notificationService) {
      global.notificationService.sendToAll('dossiers_deleted', {
        ids,
        deletedBy: {
          userId: req.user.id,
          role: req.user.role,
          prenom: req.user.prenom || 'Admin',
          nom: req.user.nom || '',
        },
      });
    }

    res.status(200).json({
      message: 'Dossiers supprimés avec succès',
      deleted_ids: ids,
    });
    console.log(`✅ Dossiers supprimés: ${ids.join(', ')}`);
  } catch (error) {
    console.error('❌ Erreur suppression dossiers:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/dossiers - Liste des dossiers selon le rôle
router.get('/', async (req, res) => {
  try {
    const { role } = req.user;
    const { status, type, page = 1, limit = 20, search = '' } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCounter = 1;

    // Filtrage selon le rôle (workflow cahier des charges)
    switch (role) {
      case 'admin':
        // Admin voit tout
        break;
      case 'preparateur':
        // Préparateur voit uniquement ses propres dossiers (createdBy = user.id)
        whereConditions.push(
          `preparateur_id = $${paramCounter} AND status IN ('en_cours', 'a_revoir')`
        );
        queryParams.push(req.user.id);
        paramCounter++;
        break;
      case 'imprimeur_roland':
        // Imprimeur Roland voit ses dossiers prêts à imprimer et en impression
        whereConditions.push(
          `type = 'roland' AND status IN ('en_cours', 'en_impression', 'termine')`
        );
        break;
      case 'imprimeur_xerox':
        // Imprimeur Xerox voit ses dossiers prêts à imprimer et en impression
        whereConditions.push(
          `type = 'xerox' AND status IN ('en_cours', 'en_impression', 'termine')`
        );
        break;
      case 'livreur':
        // Livreur voit les dossiers terminés et en livraison
        whereConditions.push(`status IN ('termine', 'en_livraison', 'livre')`);
        break;
      default:
        return res.status(403).json({
          error: 'Rôle non autorisé',
          code: 'UNAUTHORIZED_ROLE',
        });
    }

    // Filtres optionnels
    if (status && VALID_STATUSES.includes(status)) {
      whereConditions.push(`status = $${paramCounter}`);
      queryParams.push(status);
      paramCounter++;
    }

    if (type && VALID_TYPES.includes(type)) {
      whereConditions.push(`type = $${paramCounter}`);
      queryParams.push(type);
      paramCounter++;
    }

    // Recherche textuelle
    if (search.trim()) {
      whereConditions.push(`(
        numero_commande ILIKE $${paramCounter} OR 
        client_nom ILIKE $${paramCounter} OR 
        commentaire ILIKE $${paramCounter}
      )`);
      queryParams.push(`%${search.trim()}%`);
      paramCounter++;
    }

    // Construction de la clause WHERE
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitParam = paramCounter;
    const offsetParam = paramCounter + 1;
    queryParams.push(parseInt(limit), offset);

    // Requête principale
    const selectQuery = whereClause
      ? `SELECT 
        id, numero_commande, client_nom,
        type, status, preparateur_id, imprimeur_id, livreur_id,
        data_formulaire, commentaire, date_reception, date_impression, date_livraison,
        mode_paiement, montant_cfa, created_at, updated_at
      FROM dossiers 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`
      : `SELECT 
        id, numero_commande, client_nom,
        type, status, preparateur_id, imprimeur_id, livreur_id,
        data_formulaire, commentaire, date_reception, date_impression, date_livraison,
        mode_paiement, montant_cfa, created_at, updated_at
      FROM dossiers 
      ORDER BY created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`;
    const dossiersResult = await query(selectQuery, queryParams);

    // Compter le total
    const countQuery = whereClause
      ? `SELECT COUNT(*) as total FROM dossiers ${whereClause}`
      : `SELECT COUNT(*) as total FROM dossiers`;
    const countResult = await query(
      countQuery,
      queryParams.slice(0, -2) // Enlever limit et offset
    );

    const dossiers = dossiersResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      dossiers,
      meta: {
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: total,
          total_pages: totalPages,
          has_next: parseInt(page) < totalPages,
          has_previous: parseInt(page) > 1,
        },
        filters: {
          status: status || null,
          type: type || null,
          search: search || '',
        },
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération dossiers:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/dossiers/:id - Détails d'un dossier
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    // Récupérer le dossier avec les infos du créateur
    const dossierResult = await query(
      `SELECT d.*, u.prenom as created_by_prenom, u.nom as created_by_nom
       FROM dossiers d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = $1`,
      [id]
    );

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Ce dossier n\'existe pas',
        code: 'DOSSIER_NOT_FOUND',
      });
    }

    const dossier = dossierResult.rows[0];

    // Vérifier les permissions selon le rôle
    const canView = checkViewPermissions(role, dossier);
    if (!canView) {
      return res.status(403).json({
        error: 'Accès refusé à ce dossier',
        code: 'ACCESS_DENIED',
      });
    }

    // Récupérer les fichiers associés
    const filesResult = await query(
      `SELECT id, original_filename, mimetype, size, uploaded_at
       FROM dossier_files 
       WHERE dossier_id = $1 
       ORDER BY uploaded_at ASC`,
      [id]
    );

    // Récupérer l'historique des statuts
    const historyResult = await query(
      `SELECT dsh.old_status, dsh.new_status, dsh.changed_at, dsh.notes,
              u.prenom, u.nom, u.role
       FROM dossier_status_history dsh
       LEFT JOIN users u ON dsh.changed_by = u.id
       WHERE dsh.dossier_id = $1
       ORDER BY dsh.changed_at DESC`,
      [id]
    );

    res.status(200).json({
      dossier,
      files: filesResult.rows,
      status_history: historyResult.rows,
    });
  } catch (error) {
    console.error('❌ Erreur récupération détails dossier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /api/dossiers - Créer un nouveau dossier (admin, preparateur)
router.post('/', authorizeRoles('admin', 'preparateur'), async (req, res) => {
  try {
    const {
      numero_commande,
      client_nom,
      client_email,
      client_telephone,
      type,
      description,
      quantite,
      format_papier,
      urgence = false,
      deadline,
    } = req.body;

    // Validation des champs requis
    if (!numero_commande || !client_nom || !type || !description || !quantite) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        code: 'MISSING_REQUIRED_FIELDS',
        required: ['numero_commande', 'client_nom', 'type', 'description', 'quantite'],
      });
    }

    // Validation du type
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: 'Type de dossier invalide',
        code: 'INVALID_TYPE',
        valid_types: VALID_TYPES,
      });
    }

    // Vérifier l'unicité du numéro de commande
    const existingResult = await query('SELECT id FROM dossiers WHERE numero_commande = $1', [
      numero_commande,
    ]);

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Numéro de commande déjà existant',
        code: 'DUPLICATE_ORDER_NUMBER',
      });
    }

    // Créer le dossier avec statut initial 'en_cours' (selon cahier des charges)
    // Utiliser les colonnes réelles de la table dossiers
    const newDossierResult = await query(
      `INSERT INTO dossiers (
        numero_commande, client_nom, type, statut, preparateur_id,
        data_formulaire, commentaire
      ) VALUES ($1, $2, $3, 'en_cours', $4, $5, $6)
      RETURNING *`,
      [
        numero_commande,
        client_nom,
        type,
        req.user.id, // preparateur_id
        JSON.stringify({
          client_email,
          client_telephone,
          description,
          quantite: parseInt(quantite),
          format_papier,
          urgence,
          deadline,
        }), // data_formulaire en JSON
        `Créé par ${req.user.nom || 'Préparateur'}`,
      ]
    );

    const newDossier = newDossierResult.rows[0];

    // Ajouter l'entrée dans l'historique des statuts
    await query(
      `INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at)
       VALUES ($1, null, 'en_cours', $2, CURRENT_TIMESTAMP)`,
      [newDossier.id, req.user.id]
    );

    res.status(201).json({
      message: 'Dossier créé avec succès',
      dossier: newDossier,
    });

    console.log(`✅ Nouveau dossier créé: ${numero_commande} (${type})`);

    // Notification en temps réel avec service avancé
    if (global.notificationService) {
      global.notificationService.notifyNewDossier(newDossier, {
        userId: req.user.id,
        role: req.user.role,
        prenom: req.user.prenom,
        nom: req.user.nom,
      });

      // Émettre événement de synchronisation pour rafraîchir les listes
      global.notificationService.sendToAll('dossier_created', {
        dossier: newDossier,
        createdBy: {
          userId: req.user.id,
          role: req.user.role,
          prenom: req.user.prenom,
          nom: req.user.nom,
        },
      });
    }
  } catch (error) {
    console.error('❌ Erreur création dossier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// ================================
// FONCTIONS UTILITAIRES
// ================================

// Vérifier les permissions de visualisation (nouveau workflow)
function checkViewPermissions(role, dossier) {
  switch (role) {
    case 'admin':
      return true;
    case 'preparateur':
      return ['en_cours', 'a_revoir'].includes(dossier.status);
    case 'imprimeur_roland':
      return (
        dossier.type === 'roland' &&
        ['en_cours', 'en_impression', 'termine'].includes(dossier.status)
      );
    case 'imprimeur_xerox':
      return (
        dossier.type === 'xerox' &&
        ['en_cours', 'en_impression', 'termine'].includes(dossier.status)
      );
    case 'livreur':
      return ['termine', 'en_livraison', 'livre'].includes(dossier.status);
    default:
      return false;
  }
}

// PATCH /api/dossiers/:id/status - Changer le statut d'un dossier
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    const { role, id: userId } = req.user;

    // Vérifier si commentaire requis pour statut "a_revoir"
    if (status === 'a_revoir' && (!comment || comment.trim() === '')) {
      return res.status(400).json({
        error: 'Commentaire obligatoire pour marquer un dossier à revoir',
        code: 'COMMENT_REQUIRED',
      });
    }

    // Valider le nouveau statut
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Statut invalide',
        code: 'INVALID_STATUS',
        valid_statuses: VALID_STATUSES,
      });
    }

    // Récupérer le dossier actuel
    const dossierResult = await query('SELECT * FROM dossiers WHERE id = $1', [id]);

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Ce dossier n\'existe pas',
        code: 'DOSSIER_NOT_FOUND',
      });
    }

    const dossier = dossierResult.rows[0];
    const oldStatus = dossier.status;

    // Vérifier les permissions de changement de statut avec le nouveau workflow adapter
    const user = { id: userId, role };
    const transitionCheck = canTransition(user, dossier, status);
    if (!transitionCheck.allowed) {
      return res.status(403).json({
        error: transitionCheck.reason || 'Permission refusée pour ce changement de statut',
        code: 'STATUS_CHANGE_DENIED',
        current_status: oldStatus,
        requested_status: status,
        user_role: role,
      });
    }

    // Validation complète avec commentaire
    const validation = validateTransition(user, dossier, status, comment);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.reason,
        code: 'VALIDATION_FAILED',
      });
    }

    // Mettre à jour le statut du dossier
    const updatedDossierResult = await query(
      'UPDATE dossiers SET statut = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    const updatedDossier = updatedDossierResult.rows[0];

    // Ajouter l'entrée dans l'historique des statuts avec commentaire si nécessaire
    await query(
      'INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, notes) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
      [id, oldStatus, status, userId, comment || null]
    );

    res.status(200).json({
      message: 'Statut mis à jour avec succès',
      dossier: updatedDossier,
      old_status: oldStatus,
      new_status: status,
    });

    console.log(
      `✅ Statut dossier ${dossier.numero_commande} changé: ${oldStatus} → ${status} par ${role}`
    );

    // Notification temps réel avec le nouveau système de workflow
    if (global.notificationService) {
      // D'abord, notifier le changement de statut avec l'ancien système
      global.notificationService.notifyStatusChange(
        updatedDossier,
        oldStatus,
        status,
        {
          userId: req.user.id,
          role: req.user.role,
          prenom: req.user.prenom,
          nom: req.user.nom,
        },
        comment
      );

      // Ensuite, utiliser le nouveau système pour les notifications ciblées
      const notifications = getNotifications(updatedDossier, oldStatus, status, {
        userId: req.user.id,
        role: req.user.role,
        prenom: req.user.prenom,
        nom: req.user.nom,
      });

      // Traiter les notifications du workflow adapter
      notifications.forEach(notification => {
        if (notification.targetRoles) {
          notification.targetRoles.forEach(role => {
            global.notificationService.sendToRole(role, 'workflow_notification', {
              ...notification,
              timestamp: new Date(),
            });
          });
        }
        if (notification.targetUsers) {
          notification.targetUsers.forEach(userId => {
            global.notificationService.sendToUser(userId, 'workflow_notification', {
              ...notification,
              timestamp: new Date(),
            });
          });
        }
      });

      // Émettre événement de synchronisation pour rafraîchir les listes
      global.notificationService.sendToAll('dossier_updated', {
        dossier: updatedDossier,
        oldStatus,
        newStatus: status,
        updatedBy: {
          userId: req.user.id,
          role: req.user.role,
          prenom: req.user.prenom,
          nom: req.user.nom,
        },
        comment,
      });
    }
  } catch (error) {
    console.error('❌ Erreur changement statut dossier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/dossiers/:id/actions - Obtenir les actions disponibles pour un dossier
router.get('/:id/actions', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Récupérer le dossier
    const dossierResult = await query('SELECT * FROM dossiers WHERE id = $1', [id]);

    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Ce dossier n\'existe pas',
        code: 'DOSSIER_NOT_FOUND',
      });
    }

    const dossier = dossierResult.rows[0];
    const user = { id: userId, role };

    // Vérifier si l'utilisateur peut voir ce dossier
    if (!canUserViewDossier(user, dossier)) {
      return res.status(403).json({
        error: 'Permission refusée pour consulter ce dossier',
        code: 'ACCESS_DENIED',
      });
    }

    // Obtenir les actions disponibles
    const actions = getDossierActions(user, dossier);

    // Ajouter les permissions supplémentaires
    const permissions = {
      canView: canUserViewDossier(user, dossier),
      canDelete: canUserDeleteDossier(user, dossier).allowed,
      canEdit: role === 'admin' || (role === 'preparateur' && dossier.preparateur_id === userId),
    };

    res.status(200).json({
      dossier_id: id,
      current_status: dossier.statut,
      available_actions: actions,
      permissions,
    });
  } catch (error) {
    console.error('❌ Erreur récupération actions dossier:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// ================================
// FONCTIONS UTILITAIRES ÉTENDUES
// ================================

// Fonction helper pour obtenir les actions disponibles pour un utilisateur et un dossier
function getDossierActions(user, dossier) {
  return getAvailableActions(user, dossier);
}

// Fonction helper pour vérifier les permissions de vue d'un dossier
function canUserViewDossier(user, dossier) {
  return canViewDossier(user, dossier);
}

// Fonction helper pour vérifier les permissions de suppression
function canUserDeleteDossier(user, dossier) {
  return canDeleteDossier(user, dossier);
}

module.exports = router;
