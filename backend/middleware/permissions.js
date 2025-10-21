const { query } = require('../config/database');

/**
 * Middleware centralisé pour la gestion des permissions sur les dossiers
 * Supporte à la fois les ID integer (legacy) et les folder_id UUID (nouveau)
 */

// Rôles et leurs niveaux de permission
const ROLE_LEVELS = {
  admin: 100,
  operateur: 50,
  client: 10,
};

// Types d'actions et permissions requises
const ACTION_PERMISSIONS = {
  view: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'], // Tous les rôles peuvent voir selon leurs droits
  create: ['admin', 'preparateur'], // Admin et préparateur peuvent créer
  update: ['admin', 'preparateur'], // Admin et préparateur peuvent modifier
  delete: ['admin'], // Seul admin peut supprimer
  validate: ['admin', 'preparateur'], // Admin et préparateur peuvent valider
  upload_file: ['admin', 'preparateur'], // Upload fichiers
  delete_file: ['admin'], // Suppression fichiers admin uniquement
  change_status: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'], // Changement selon workflow
  assign: ['admin'], // Assignation admin uniquement
};

/**
 * Récupère un dossier par ID, folder_id ou numero
 * @param {string|number} identifier - ID UUID, folder_id UUID ou numero
 * @param {object} user - Utilisateur pour filtrer les permissions (optionnel)
 * @returns {object|null} - Dossier trouvé ou null
 */
const getDossierByIdentifier = async (identifier, user = null) => {
  try {
    // Détecter le type d'identifiant
    const isUUID =
      typeof identifier === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );
    
    const isNumericString = typeof identifier === 'string' && /^\d+$/.test(identifier);
    const isNumber = typeof identifier === 'number';

    let result = { rows: [] };
    let baseQuery = `
      SELECT d.*, 
             u.nom as preparateur_name
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
    `;

    let whereClause = '';
    let params = [identifier];

    // Construire la clause WHERE selon le type d'identifiant
    if (isUUID) {
      // 1. En cas d'UUID, prioriser la recherche par folder_id (UUID stocké)
      try {
        whereClause = 'WHERE d.folder_id = $1';
        result = await query(baseQuery + ' ' + whereClause, params);
      } catch (e) {
        // ignorer et tenter autre fallback
        result = { rows: [] };
      }
      
      // 2. Si pas trouvé, essayer par id numérique (certains environnements peuvent stocker l'UUID ailleurs)
      if (result.rows.length === 0) {
        try {
          whereClause = 'WHERE d.id = $1';
          result = await query(baseQuery + ' ' + whereClause, params);
        } catch (e2) {
          // Toujours renvoyer vide si erreur de typage
          result = { rows: [] };
        }
      }
    } else if (isNumericString || isNumber) {
      // 3. Recherche par ID numérique (legacy)
      whereClause = 'WHERE d.id = $1';
      result = await query(baseQuery + ' ' + whereClause, params);
    } else {
      // 4. Recherche par numero (ex: "CMD-2025-1080", "DOSS-001")
      whereClause = 'WHERE (d.numero = $1 OR d.numero_commande = $1)';
      result = await query(baseQuery + ' ' + whereClause, params);
    }

    // Si aucun dossier trouvé ou pas d'utilisateur fourni, retourner le résultat direct
    if (result.rows.length === 0 || !user) {
      return result.rows[0] || null;
    }

    // Si un utilisateur est fourni, appliquer les filtres de permissions
    const dossier = result.rows[0];
    
    // Admin voit tout
    if (user.role === 'admin') {
      return dossier;
    }
    
    // Préparateur : ses propres dossiers uniquement
    if (user.role === 'preparateur') {
      const isOwner = dossier.preparateur_id === user.id || dossier.created_by === user.id;
      return isOwner ? dossier : null;
    }
    
    // Imprimeur Roland : dossiers Roland uniquement
    if (user.role === 'imprimeur_roland') {
      const machineType = (dossier.machine || dossier.type_formulaire || '').toLowerCase();
      return machineType.includes('roland') ? dossier : null;
    }
    
    // Imprimeur Xerox : dossiers Xerox uniquement  
    if (user.role === 'imprimeur_xerox') {
      const machineType = (dossier.machine || dossier.type_formulaire || '').toLowerCase();
      return machineType.includes('xerox') ? dossier : null;
    }
    
    // Livreur : dossiers en phase de livraison uniquement
    if (user.role === 'livreur') {
      const statut = (dossier.statut || '').toLowerCase().replace(/\s/g, '_');
      const allowedStatuses = ['termine', 'en_livraison', 'livre', 'pret_livraison'];
      return allowedStatuses.includes(statut) ? dossier : null;
    }
    
    // Par défaut, pas d'accès
    return null;
    
  } catch (error) {
    console.error('Erreur getDossierByIdentifier:', error);
    return null;
  }
};

/**
 * Vérifie si l'utilisateur a la permission pour une action donnée
 * @param {string} userRole - Rôle de l'utilisateur
 * @param {string} action - Action à vérifier
 * @returns {boolean}
 */
const hasActionPermission = (userRole, action) => {
  const allowedRoles = ACTION_PERMISSIONS[action] || [];
  return allowedRoles.includes(userRole);
};

/**
 * Vérifie si l'utilisateur peut accéder à un dossier spécifique
 * @param {object} user - Utilisateur connecté
 * @param {object} dossier - Dossier cible
 * @param {string} action - Action demandée
 * @returns {object} - { allowed: boolean, message: string }
 */
const canAccessDossier = (user, dossier, action) => {
  console.log('🔐 [canAccessDossier] Vérification:', { user: user?.role, action, dossier_id: dossier?.id });
  
  // Admin peut tout faire
  if (user.role === 'admin') {
    console.log('✅ [canAccessDossier] Admin - accès complet autorisé');
    return { allowed: true, message: 'Admin - accès complet' };
  }

  // Preparateur peut accéder à tous ses dossiers et voir les autres
  if (user.role === 'preparateur') {
    // Accès total aux dossiers créés par le préparateur
    const isOwner = dossier.preparateur_id === user.id || dossier.created_by === user.id;
    if (isOwner) {
      // Actions autorisées pour ses propres dossiers
      const allowedOwnerActions = ['view', 'validate', 'change_status', 'upload_file', 'download', 'access_files'];
      if (allowedOwnerActions.includes(action)) {
        return { allowed: true, message: 'Propriétaire du dossier' };
      }
      return { allowed: false, message: `Action "${action}" non autorisée pour vos dossiers` };
    }
    
    // Accès en lecture à tous les dossiers pour coordination
    if (['view', 'upload_file'].includes(action)) return { allowed: true, message: 'Accès lecture pour coordination' };
    
    return { allowed: false, message: 'Vous ne pouvez modifier que vos propres dossiers' };
  }

  // Imprimeurs peuvent accéder aux dossiers de leur machine + actions étendues
  if (user.role === 'imprimeur_roland') {
    const machineType = (dossier.machine || dossier.type_formulaire || '').toLowerCase();
    const isRolandJob = machineType.includes('roland');
    
    // Accès étendu pour les dossiers Roland
    if (isRolandJob) {
      const allowedActions = ['view', 'change_status', 'upload_file', 'download', 'access_files'];
      if (allowedActions.includes(action)) {
        return { allowed: true, message: 'Dossier Roland accessible' };
      }
      return { allowed: false, message: `Action "${action}" non autorisée pour les imprimeurs` };
    }
    
    // Accès en lecture aux autres pour coordination (mais pas aux fichiers)
    if (action === 'view') return { allowed: true, message: 'Accès lecture pour coordination' };
    
    return { 
      allowed: false, 
      message: `Ce dossier est pour machine "${machineType || 'non définie'}", vous gérez les machines Roland` 
    };
  }

  if (user.role === 'imprimeur_xerox') {
    const machineType = (dossier.machine || dossier.type_formulaire || '').toLowerCase();
    const isXeroxJob = machineType.includes('xerox');
    
    // Accès étendu pour les dossiers Xerox
    if (isXeroxJob) {
      const allowedActions = ['view', 'change_status', 'upload_file', 'download', 'access_files'];
      if (allowedActions.includes(action)) {
        return { allowed: true, message: 'Dossier Xerox accessible' };
      }
      return { allowed: false, message: `Action "${action}" non autorisée pour les imprimeurs` };
    }
    
    // Accès en lecture aux autres pour coordination (mais pas aux fichiers)
    if (action === 'view') return { allowed: true, message: 'Accès lecture pour coordination' };
    
    return { 
      allowed: false, 
      message: `Ce dossier est pour machine "${machineType || 'non définie'}", vous gérez les machines Xerox` 
    };
  }

  // Livreur peut voir et gérer les dossiers en livraison + accès étendu
  if (user.role === 'livreur') {
    const statut = (dossier.statut || '').toLowerCase().replace(/\s/g, '_');
    
    // Accès étendu aux dossiers en livraison
    if (['termine', 'en_livraison', 'livre', 'pret_livraison'].includes(statut)) {
      const allowedActions = ['view', 'change_status', 'upload_file', 'download', 'access_files'];
      if (allowedActions.includes(action)) {
        return { allowed: true, message: 'Dossier en phase de livraison accessible' };
      }
      return { allowed: false, message: `Action "${action}" non autorisée pour les livreurs` };
    }
    
    // Accès en lecture aux autres pour planification (mais pas aux fichiers)
    if (action === 'view') return { allowed: true, message: 'Accès lecture pour planification' };
    
    return { 
      allowed: false, 
      message: `Dossier avec statut "${dossier.statut}" non accessible aux livreurs (attendre impression terminée)` 
    };
  }

  return { allowed: false, message: `Rôle "${user.role}" non reconnu` };
};

/**
 * Middleware: Vérifier les permissions pour une action sur un dossier
 * Utilise req.params.id ou req.params.folderId pour identifier le dossier
 * @param {string} action - Action à vérifier (view, update, delete, etc.)
 */
const checkDossierPermission = action => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non authentifié',
        });
      }

      // Vérifier d'abord si l'action est permise pour ce rôle
      if (!hasActionPermission(user.role, action)) {
        return res.status(403).json({
          success: false,
          message: `Permission refusée: votre rôle (${user.role}) ne permet pas l'action "${action}"`,
        });
      }

      // Si l'action nécessite un dossier spécifique
      const dossierId = req.params.id || req.params.folderId;

      if (dossierId) {
        // Récupérer le dossier SANS filtrage initial (on vérifiera après avec canAccessDossier)
        const dossier = await getDossierByIdentifier(dossierId);

        if (!dossier) {
          // Générer un message explicite selon le rôle de l'utilisateur
          let message = 'Ce dossier n\'existe pas ou vous n\'avez pas les droits d\'accès';
          
          // Pour éviter les fuites d'information, on vérifie d'abord si le dossier existe réellement
          const dossierExists = await getDossierByIdentifier(dossierId);
          if (dossierExists) {
            // Le dossier existe mais l'utilisateur n'y a pas accès
            switch (user.role) {
              case 'imprimeur_roland':
                message = `Ce dossier n'est pas accessible. Vous gérez les machines Roland uniquement.`;
                break;
              case 'imprimeur_xerox':
                message = `Ce dossier n'est pas accessible. Vous gérez les machines Xerox uniquement.`;
                break;
              case 'livreur':
                message = `Ce dossier n'est pas encore prêt pour la livraison. Attendez que l'impression soit terminée.`;
                break;
              case 'preparateur':
                message = `Ce dossier ne vous appartient pas. Vous ne pouvez accéder qu'à vos propres dossiers.`;
                break;
              default:
                message = `Accès non autorisé à ce dossier pour votre rôle (${user.role}).`;
            }
          }
          
          // Si le dossier existe mais n'est pas accessible pour cet utilisateur, renvoyer 403, sinon 404
          const statusCode = dossierExists ? 403 : 404;
          return res.status(statusCode).json({
            success: false,
            message: message,
          });
        }

        // Vérifier les permissions spécifiques à l'action demandée
        const accessResult = canAccessDossier(user, dossier, action);
        if (!accessResult.allowed) {
          return res.status(403).json({
            success: false,
            message: accessResult.message,
          });
        }

        // Attacher le dossier à la requête pour éviter une nouvelle requête dans le contrôleur
        req.dossier = dossier;
      }

      // Permission accordée
      next();
    } catch (error) {
      console.error('Erreur checkDossierPermission:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des permissions',
        error: error.message,
      });
    }
  };
};

/**
 * Middleware: Vérifier que l'utilisateur a un rôle minimum requis
 * @param {string[]} allowedRoles - Rôles autorisés
 */
const requireRole = allowedRoles => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non authentifié',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé: rôle requis parmi [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

/**
 * Middleware: Filtre les dossiers selon les permissions de l'utilisateur
 * Ajoute les clauses WHERE appropriées à une requête SQL
 * @param {object} user - Utilisateur connecté
 * @returns {object} - { whereClause, params }
 */
const getDossierFilterForUser = user => {
  if (user.role === 'admin') {
    // Admin voit tous les dossiers
    return {
      whereClause: '',
      params: [],
    };
  }

  if (user.role === 'preparateur') {
    // Preparateur ne voit que ses dossiers
    return {
      whereClause: 'WHERE (d.preparateur_id = $1 OR d.created_by = $1)',
      params: [user.id],
    };
  }

  if (user.role === 'imprimeur_roland') {
    // Imprimeur Roland voit les dossiers Roland
    return {
      whereClause: "WHERE LOWER(d.machine) LIKE '%roland%' OR LOWER(d.type_formulaire) LIKE '%roland%'",
      params: [],
    };
  }

  if (user.role === 'imprimeur_xerox') {
    // Imprimeur Xerox voit les dossiers Xerox
    return {
      whereClause: "WHERE LOWER(d.machine) LIKE '%xerox%' OR LOWER(d.type_formulaire) LIKE '%xerox%'",
      params: [],
    };
  }

  if (user.role === 'livreur') {
    // Livreur voit les dossiers prêts/en livraison
    return {
      whereClause: "WHERE d.statut IN ('termine', 'Terminé', 'en_livraison', 'En livraison', 'livre', 'Livré')",
      params: [],
    };
  }

  // Par défaut, aucun dossier
  return {
    whereClause: 'WHERE 1=0',
    params: [],
  };
};

/**
 * Middleware: Logger les actions sur les dossiers
 * Utilise la fonction log_dossier_activity de PostgreSQL
 */
const logDossierActivity = async (folderId, userId, action, details = {}) => {
  try {
    await query(
      'SELECT log_dossier_activity($1, $2, $3, $4)',
      [folderId, userId, action, JSON.stringify(details)]
    );
  } catch (error) {
    // Ne pas bloquer l'opération si le log échoue
    console.error('Erreur logDossierActivity:', error);
  }
};

module.exports = {
  checkDossierPermission,
  requireRole,
  getDossierByIdentifier,
  hasActionPermission,
  canAccessDossier,
  getDossierFilterForUser,
  logDossierActivity,
  ROLE_LEVELS,
  ACTION_PERMISSIONS,
};
