/**
 * Configuration de sécurité centralisée (secret JWT).
 *
 * - Charge le .env (dotenv) AVANT toute lecture de variable.
 * - Lit process.env.JWT_SECRET UNE seule fois.
 * - Aucun secret de repli : si JWT_SECRET est absent ou trop court, le serveur
 *   refuse de démarrer (assertSecurityConfig) et toute tentative de signature
 *   ou de vérification lève une erreur.
 */
require('dotenv').config();

const jwt = require('jsonwebtoken');

const JWT_MIN_LENGTH = 32;
const JWT_ALGORITHM = 'HS256';
const JWT_SECRET = process.env.JWT_SECRET;

const isJwtSecretValid = () => typeof JWT_SECRET === 'string' && JWT_SECRET.length >= JWT_MIN_LENGTH;

/**
 * À appeler en tout premier au démarrage du serveur.
 * Arrête le processus (exit 1) si le secret JWT est absent ou trop court.
 */
const assertSecurityConfig = () => {
  if (!isJwtSecretValid()) {
    const reason = !JWT_SECRET ? 'est absente' : `fait moins de ${JWT_MIN_LENGTH} caractères`;
    console.error('❌ ERREUR DE CONFIGURATION : la variable d\'environnement JWT_SECRET ' + reason + '.');
    console.error(`   Définissez JWT_SECRET (au moins ${JWT_MIN_LENGTH} caractères aléatoires) dans backend/.env ou dans l'environnement PM2,`);
    console.error('   par exemple :  JWT_SECRET=$(openssl rand -hex 48)');
    console.error('   Démarrage du serveur annulé.');
    process.exit(1);
  }
};

const getJwtSecret = () => {
  if (!isJwtSecretValid()) {
    throw new Error('JWT_SECRET absent ou trop court : configuration de sécurité invalide');
  }
  return JWT_SECRET;
};

/** Vérifie un JWT avec le secret central (algorithme imposé). Lève une erreur si invalide. */
const verifyToken = token => jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });

/** Signe un JWT avec le secret central. */
const signToken = (payload, options = {}) =>
  jwt.sign(payload, getJwtSecret(), { algorithm: JWT_ALGORITHM, ...options });

module.exports = {
  JWT_MIN_LENGTH,
  assertSecurityConfig,
  getJwtSecret,
  verifyToken,
  signToken,
};
