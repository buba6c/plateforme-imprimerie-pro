
/**
 * Utilitaires JWT sécurisés
 * Généré automatiquement le 2025-10-06T11:33:38.942Z
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTManager {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.expiresIn = process.env.JWT_EXPIRE_TIME || '24h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRE_TIME || '7d';
    
    if (!this.secret) {
      throw new Error('JWT_SECRET not found in environment variables');
    }
  }

  /**
   * Générer un token JWT sécurisé
   */
  generateToken(payload) {
    try {
      return jwt.sign(
        {
          ...payload,
          iat: Math.floor(Date.now() / 1000),
          jti: crypto.randomBytes(16).toString('hex') // JWT ID unique
        },
        this.secret,
        { 
          expiresIn: this.expiresIn,
          algorithm: 'HS256'
        }
      );
    } catch (error) {
      console.error('Erreur génération token:', error);
      throw new Error('Impossible de générer le token');
    }
  }

  /**
   * Générer un refresh token
   */
  generateRefreshToken(userId) {
    try {
      return jwt.sign(
        {
          userId: userId,
          type: 'refresh',
          iat: Math.floor(Date.now() / 1000)
        },
        this.refreshSecret,
        {
          expiresIn: this.refreshExpiresIn,
          algorithm: 'HS256'
        }
      );
    } catch (error) {
      console.error('Erreur génération refresh token:', error);
      throw new Error('Impossible de générer le refresh token');
    }
  }

  /**
   * Vérifier un token JWT
   */
  verifyToken(token) {
    try {
      if (!token) {
        throw new Error('Token manquant');
      }
      
      // Nettoyer le token (enlever "Bearer " si présent)
      const cleanToken = token.replace(/^Bearer\s+/, '');
      
      return jwt.verify(cleanToken, this.secret, { algorithms: ['HS256'] });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token JWT invalide ou malformé');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token JWT expiré');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token JWT pas encore valide');
      }
      throw error;
    }
  }

  /**
   * Vérifier un refresh token
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, { algorithms: ['HS256'] });
    } catch (error) {
      throw new Error('Refresh token invalide');
    }
  }

  /**
   * Décoder un token sans vérification (pour debug)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      return null;
    }
  }

  /**
   * Vérifier si un token est expiré sans lever d'erreur
   */
  isTokenExpired(token) {
    try {
      this.verifyToken(token);
      return false;
    } catch (error) {
      return error.message.includes('expiré');
    }
  }
}

// Instance singleton
const jwtManager = new JWTManager();

module.exports = jwtManager;
