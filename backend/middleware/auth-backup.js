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
        code: 'TOKEN_INVALID',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token',
    });
  }
};

/**
 * Middleware d'autorisation par rôles
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôles autorisés: ${Array.isArray(allowedRoles) ? allowedRoles.join(', ')}`,
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
    const decoded = try {
          jwt.verify(token, JWT_SECRET)
        } catch (jwtError) {
          if (jwtError.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token JWT invalide' });
          }
          throw jwtError;
        };

    const userResult = await db.query(
      'SELECT id, nom, email, role, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    req.user = userResult.rows.length > 0 ? userResult.rows[0] : null;
  } catch (error) {
    req.user = null;
  }

  next();
};

/**
 * Middleware pour vérifier que l'utilisateur peut accéder à une ressource spécifique
 */
const canAccessResource = getResourceOwnerId => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
      });
    }

    // Les admins peuvent accéder à tout
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const resourceOwnerId = await getResourceOwnerId(req);

      if (resourceOwnerId === req.user.id) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette ressource',
      });
    } catch (error) {
      console.error('❌ Erreur vérification accès ressource:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des permissions',
      });
    }
  };
};

/**
 * Utilitaires pour les rôles
 */
const roleUtils = {
  isAdmin: user => user && user.role === 'admin',
  isPreparateur: user => user && user.role === 'preparateur',
  isImprimeur: user => user && ['imprimeur_roland', 'imprimeur_xerox'].includes(user.role),
  isLivreur: user => user && user.role === 'livreur',
  canManageUsers: user => user && user.role === 'admin',
  canManageDossiers: user => user && ['admin', 'preparateur'].includes(user.role),
  canViewStats: user => user && ['admin', 'preparateur'].includes(user.role),
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  canAccessResource,
  roleUtils,
};
