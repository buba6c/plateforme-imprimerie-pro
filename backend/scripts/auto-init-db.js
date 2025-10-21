#!/usr/bin/env node
/**
 * Script d'initialisation automatique pour Render
 * Vérifie si les tables existent et les crée si nécessaire
 */

const fs = require('fs');
const path = require('path');

async function autoInitDatabase() {
  // Ne s'exécute qu'en production avec DATABASE_URL
  if (process.env.NODE_ENV !== 'production' || !process.env.DATABASE_URL) {
    console.log('📋 Auto-init ignoré (dev mode ou pas de DATABASE_URL)');
    return;
  }

  try {
    const { query } = require('../config/database');
    
    console.log('🔍 Vérification tables PostgreSQL...');
    
    // Vérifier si la table users existe
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (tablesResult.rows.length === 0) {
      console.log('🚀 Tables manquantes - Initialisation automatique...');
      
      // Lire et exécuter le script d'initialisation
      const initSqlPath = path.join(__dirname, '..', 'database', 'init.sql');
      const initSql = fs.readFileSync(initSqlPath, 'utf8');
      
      await query(initSql);
      
      console.log('✅ Base de données initialisée automatiquement !');
      console.log('👥 Utilisateurs créés avec mot de passe: admin123');
    } else {
      console.log('✅ Tables déjà présentes');
    }

  } catch (error) {
    console.error('❌ Erreur auto-init DB:', error.message);
    // Ne pas faire échouer le déploiement
  }
}

// Auto-exécution si appelé directement
if (require.main === module) {
  autoInitDatabase();
}

module.exports = { autoInitDatabase };