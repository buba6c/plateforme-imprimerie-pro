const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware d'authentification JWT
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token d'accès requis",
    });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'imprimerie_jwt_secret_key_2024_super_secure';
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que l'utilisateur existe toujours en base
    const userResult = await db.query(
      'SELECT id, nom, email, role, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif',
      });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('❌ Erreur authentification:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide',
        code: 'INVALID_TOKEN',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
    });
  }
};

/**
 * Middleware de vérification de rôle
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
      });
    }

    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôles autorisés: ${rolesArray.join(', ')}`,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Middleware optionnel - n'échoue pas si pas de token
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'imprimerie_jwt_secret_key_2024_super_secure';
    const decoded = jwt.verify(token, JWT_SECRET);

    const userResult = await db.query(
      'SELECT id, nom, email, role, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    req.user = userResult.rows.length > 0 ? userResult.rows[0] : null;
    next();
  } catch (error) {
    // En mode optionnel, on continue même avec erreur token
    req.user = null;
    next();
  }
};

/**
 * Middleware pour vérifier l'appartenance d'un dossier
 */
const checkDossierOwnership = async (req, res, next) => {
  try {
    const dossierId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin peut tout voir
    if (userRole === 'admin') {
      return next();
    }

    const result = await db.query(
      'SELECT id FROM dossiers WHERE id = $1 AND (client_id = $2 OR $3 = ANY(ARRAY[\'admin\', \'staff\']))',
      [dossierId, userId, userRole]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit à ce dossier',
      });
    }

    next();
  } catch (error) {
    console.error('Erreur vérification propriété dossier:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
    });
  }
};

/**
 * Middleware pour les livreurs
 */
const requireLivreurAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise',
    });
  }

  const allowedRoles = ['admin', 'livreur', 'staff'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux livreurs et administrateurs',
      userRole: req.user.role,
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  checkDossierOwnership,
  requireLivreurAccess,
};