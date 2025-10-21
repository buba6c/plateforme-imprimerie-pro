const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la base de données PostgreSQL
let dbConfig;

if (process.env.DATABASE_URL) {
  // Configuration pour Render/Production avec DATABASE_URL
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Configuration du pool de connexions
    max: 20,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: true,
  };
} else {
  // Configuration locale/développement
  dbConfig = {
    user: process.env.DB_USER || 'imprimerie_user',
    password: process.env.DB_PASSWORD || 'imprimerie_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'imprimerie_db',
    ssl: false,
    // Configuration du pool de connexions
    max: 20,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: true,
  };
}

// Créer le pool de connexions
const pool = new Pool(dbConfig);

// Fonction pour tester la connexion
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();

    console.log('✅ Connexion PostgreSQL réussie');
    console.log(`📅 Heure serveur DB: ${result.rows[0].current_time}`);
    console.log(`📋 Version PostgreSQL: ${result.rows[0].pg_version.split(' ')[0]}`);

    return true;
  } catch (error) {
    console.error('❌ Erreur connexion PostgreSQL:', error.message);
    return false;
  }
};

// Fonction pour exécuter une requête
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 Requête exécutée en ${duration}ms:`, text.substring(0, 100) + '...');
    }

    return result;
  } catch (error) {
    console.error('❌ Erreur requête SQL:', error.message);
    console.error('📝 Requête:', text);
    throw error;
  }
};

// Fonction pour obtenir un client pour les transactions
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('❌ Erreur obtention client DB:', error.message);
    throw error;
  }
};

// Fonctions utilitaires pour les transactions
const beginTransaction = async client => {
  await client.query('BEGIN');
};

const commitTransaction = async client => {
  await client.query('COMMIT');
};

const rollbackTransaction = async client => {
  await client.query('ROLLBACK');
};

// Fonction pour fermer proprement le pool (idempotente via poolClosed)
const closePool = async () => {
  if (poolClosed) {
    return;
  }
  poolClosed = true;
  try {
    await pool.end();
    console.log('🔒 Pool de connexions fermé');
  } catch (error) {
    if (String(error?.message || '').includes('end on pool more than once')) {
      // Éviter le bruit si fermeture double
      return;
    }
    console.error('❌ Erreur fermeture pool:', error.message);
  }
};

// Gestionnaires d'événements du pool
pool.on('connect', () => {
  console.log('🔗 Nouvelle connexion établie avec PostgreSQL');
});

pool.on('error', error => {
  console.error('❌ Erreur pool PostgreSQL:', error.message);
});

// Test initial de connexion au démarrage
testConnection();

// Gestion propre de l'arrêt
let poolClosed = false;
const safeClosePool = async () => {
  await closePool();
};
process.on('SIGINT', safeClosePool);
process.on('SIGTERM', safeClosePool);

module.exports = {
  pool,
  query,
  getClient,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  closePool,
  safeClosePool,
  testConnection,
};
