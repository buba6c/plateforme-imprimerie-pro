#!/usr/bin/env node
/**
 * Script de correction des erreurs JWT et d'authentification
 * Régénère les clés JWT et nettoie les tokens corrompus
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Fonction pour générer une clé JWT sécurisée
function generateSecureJWTKey() {
  return crypto.randomBytes(64).toString('hex');
}

// Fonction pour générer un refresh token secret
function generateRefreshSecret() {
  return crypto.randomBytes(32).toString('hex');
}

async function updateEnvFile() {
  const envPath = './.env';
  
  try {
    // Lire le fichier .env existant
    let envContent = await fs.readFile(envPath, 'utf8');
    
    // Générer de nouvelles clés
    const newJWTSecret = generateSecureJWTKey();
    const newRefreshSecret = generateRefreshSecret();
    
    console.log('🔑 Génération de nouvelles clés JWT...');
    
    // Remplacer ou ajouter les variables JWT
    const updates = [
      { key: 'JWT_SECRET', value: newJWTSecret },
      { key: 'JWT_REFRESH_SECRET', value: newRefreshSecret },
      { key: 'JWT_EXPIRE_TIME', value: '24h' },
      { key: 'JWT_REFRESH_EXPIRE_TIME', value: '7d' }
    ];
    
    for (const { key, value } of updates) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
        console.log(`✅ Mis à jour: ${key}`);
      } else {
        envContent += `\n# JWT Configuration\n${key}=${value}\n`;
        console.log(`✅ Ajouté: ${key}`);
      }
    }
    
    // Sauvegarder le fichier .env mis à jour
    await fs.writeFile(envPath, envContent, 'utf8');
    console.log('💾 Fichier .env mis à jour avec les nouvelles clés JWT');
    
    return { newJWTSecret, newRefreshSecret };
    
  } catch (error) {
    console.error('❌ Erreur mise à jour .env:', error.message);
    throw error;
  }
}

async function fixAuthMiddleware() {
  const authPath = './backend/middleware/auth.js';
  
  try {
    const content = await fs.readFile(authPath, 'utf8');
    let fixedContent = content;
    
    // Corrections typiques des erreurs d'authentification
    const fixes = [
      {
        // Fix: allowedRoles.join is not a function
        pattern: /allowedRoles\.join\(/g,
        replacement: 'Array.isArray(allowedRoles) ? allowedRoles.join(',
        description: 'Correction allowedRoles.join error'
      },
      {
        // Fix: Vérification des tokens malformés
        pattern: /(jwt\.verify\([^)]+\))/g,
        replacement: `try {
          $1
        } catch (jwtError) {
          if (jwtError.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token JWT invalide' });
          }
          throw jwtError;
        }`,
        description: 'Ajout gestion erreurs JWT malformés'
      }
    ];
    
    let modificationsCount = 0;
    
    for (const fix of fixes) {
      const before = fixedContent;
      fixedContent = fixedContent.replace(fix.pattern, fix.replacement);
      
      if (before !== fixedContent) {
        console.log(`✅ ${fix.description}`);
        modificationsCount++;
      }
    }
    
    if (modificationsCount > 0) {
      await fs.writeFile(authPath, fixedContent, 'utf8');
      console.log(`💾 Middleware auth.js corrigé (${modificationsCount} modifications)`);
    }
    
    return modificationsCount;
    
  } catch (error) {
    console.error('❌ Erreur correction auth middleware:', error.message);
    return 0;
  }
}

async function createJWTUtility() {
  const utilPath = './backend/utils/jwt.js';
  
  const jwtUtilityContent = `
/**
 * Utilitaires JWT sécurisés
 * Généré automatiquement le ${new Date().toISOString()}
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
      const cleanToken = token.replace(/^Bearer\\s+/, '');
      
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
`;

  try {
    await fs.writeFile(utilPath, jwtUtilityContent, 'utf8');
    console.log('✅ Utilitaire JWT sécurisé créé: backend/utils/jwt.js');
    return true;
  } catch (error) {
    console.error('❌ Erreur création utilitaire JWT:', error.message);
    return false;
  }
}

async function clearCorruptedTokens() {
  console.log('🧹 Nettoyage des tokens corrompus...');
  
  // Cette fonction pourrait être étendue pour nettoyer une base de données
  // de sessions ou de tokens stockés, mais pour l'instant, on se contente
  // de régénérer les clés ce qui invalidera tous les tokens existants
  
  console.log('✅ Les anciens tokens seront automatiquement invalidés par les nouvelles clés');
  return true;
}

async function main() {
  console.log('🔐 Démarrage de la correction du système JWT...\n');
  
  try {
    // 1. Mettre à jour le fichier .env avec de nouvelles clés
    const { newJWTSecret, newRefreshSecret } = await updateEnvFile();
    
    // 2. Corriger le middleware d'authentification
    await fixAuthMiddleware();
    
    // 3. Créer un utilitaire JWT sécurisé
    await createJWTUtility();
    
    // 4. Nettoyer les tokens corrompus
    await clearCorruptedTokens();
    
    console.log('\\n🎉 Correction du système JWT terminée avec succès !');
    console.log('\n📋 Prochaines étapes:');
    console.log('   1. Redémarrer le backend pour charger les nouvelles clés');
    console.log('   2. Les utilisateurs devront se reconnecter');
    console.log('   3. Surveiller les logs pour vérifier l\'absence d\'erreurs JWT');
    
    console.log('\n🔐 Nouvelles clés générées:');
    console.log(`   JWT_SECRET: ${newJWTSecret.substring(0, 16)}...`);
    console.log(`   JWT_REFRESH_SECRET: ${newRefreshSecret.substring(0, 16)}...`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction JWT:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  updateEnvFile, 
  fixAuthMiddleware, 
  createJWTUtility,
  generateSecureJWTKey,
  generateRefreshSecret
};