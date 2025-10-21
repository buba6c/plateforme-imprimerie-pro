/**
 * Helper pour la compatibilité des requêtes entre MySQL et PostgreSQL
 * Convertit automatiquement les placeholders ? en $1, $2, etc.
 */

const db = require('../config/database');

/**
 * Convertit une requête MySQL avec ? en PostgreSQL avec $1, $2, etc.
 * @param {string} query - Requête SQL avec des ?
 * @param {Array} params - Paramètres de la requête
 * @returns {Object} - { query: string, params: Array }
 */
function convertMySQLtoPostgreSQL(query, params) {
  let paramIndex = 1;
  const convertedQuery = query.replace(/\?/g, () => `$${paramIndex++}`);
  return { query: convertedQuery, params };
}

/**
 * Exécute une requête avec conversion automatique MySQL -> PostgreSQL
 * @param {string} query - Requête SQL (syntaxe MySQL avec ?)
 * @param {Array} params - Paramètres
 * @returns {Promise} - Résultat de la requête
 */
async function query(sqlQuery, params = []) {
  try {
    // Détecter le type de base de données
    const isPostgreSQL = db.query.toString().includes('pg') || 
                         process.env.DB_PORT === '5432';
    
    if (isPostgreSQL) {
      // Convertir pour PostgreSQL
      const { query: convertedQuery, params: convertedParams } = 
        convertMySQLtoPostgreSQL(sqlQuery, params);
      
      const result = await db.query(convertedQuery, convertedParams);
      
      // Normaliser le résultat pour ressembler à MySQL
      return [result.rows || [], result];
    } else {
      // MySQL natif
      return await db.query(sqlQuery, params);
    }
  } catch (error) {
    console.error('Erreur requête DB:', error);
    throw error;
  }
}

/**
 * Retourne l'ID du dernier insert (compatible MySQL/PostgreSQL)
 * @param {Object} result - Résultat d'une insertion
 * @returns {number} - ID inséré
 */
function getInsertId(result) {
  // PostgreSQL
  if (result && result.rows && result.rows[0]) {
    return result.rows[0].id;
  }
  // MySQL
  if (result && result.insertId) {
    return result.insertId;
  }
  return null;
}

module.exports = {
  query,
  convertMySQLtoPostgreSQL,
  getInsertId,
};
