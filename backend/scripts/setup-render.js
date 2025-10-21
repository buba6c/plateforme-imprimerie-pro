#!/usr/bin/env node
/**
 * Script de configuration post-installation pour Render
 * Exécuté automatiquement après npm install
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Configuration Render en cours...');

// Créer les dossiers nécessaires
const requiredDirs = [
  'uploads',
  'logs',
  'backups',
  'temp'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Dossier créé: ${dir}`);
  }
});

// Créer un fichier .gitkeep pour conserver les dossiers vides
requiredDirs.forEach(dir => {
  const gitkeepPath = path.join(__dirname, '..', dir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
  }
});

// Vérifier la configuration de base de données
if (process.env.NODE_ENV === 'production') {
  // Variables d'environnement requises
  const requiredEnvVars = process.env.DATABASE_URL ? 
    ['DATABASE_URL', 'JWT_SECRET'] : 
    ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Variables d\'environnement manquantes:', missingVars.join(', '));
  } else {
    console.log('✅ Variables d\'environnement configurées');
    if (process.env.DATABASE_URL) {
      console.log('✅ Configuration PostgreSQL via DATABASE_URL');
    }
  }
}

console.log('✅ Configuration Render terminée');