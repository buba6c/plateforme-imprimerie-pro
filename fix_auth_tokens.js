#!/usr/bin/env node
/**
 * Script pour corriger l'incohérence des tokens d'authentification dans le frontend
 */

const fs = require('fs').promises;
const path = require('path');

async function findJSFiles(dir) {
  const jsFiles = [];
  
  async function scanDir(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
          jsFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Erreur scan ${currentDir}:`, error.message);
    }
  }
  
  await scanDir(dir);
  return jsFiles;
}

async function fixTokenReferences() {
  console.log('🔧 Correction des références de tokens d\'authentification...\n');
  
  const frontendSrc = './frontend/src';
  const jsFiles = await findJSFiles(frontendSrc);
  
  const patterns = [
    {
      // Pattern: localStorage.getItem('token') simple
      search: /localStorage\.getItem\(['"]token['"]\)/g,
      replace: "localStorage.getItem('auth_token')",
      description: 'Correction localStorage token simple'
    },
    {
      // Pattern: sessionStorage.getItem('token')
      search: /sessionStorage\.getItem\(['"]token['"]\)/g,
      replace: "sessionStorage.getItem('auth_token')",
      description: 'Correction sessionStorage token'
    },
    {
      // Pattern: fallback sans auth_token en premier
      search: /localStorage\.getItem\(['"]token['"]\)\s*\|\|\s*sessionStorage\.getItem\(['"]token['"]\)/g,
      replace: "localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')",
      description: 'Correction fallback storage token'
    }
  ];
  
  let totalFixed = 0;
  let filesFixed = 0;
  
  for (const filePath of jsFiles) {
    try {
      let content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;
      let fileFixCount = 0;
      
      for (const pattern of patterns) {
        const matches = content.match(pattern.search);
        if (matches) {
          content = content.replace(pattern.search, pattern.replace);
          fileFixCount += matches.length;
          console.log(`  ✅ ${path.relative(frontendSrc, filePath)}: ${pattern.description} (${matches.length} occurrences)`);
        }
      }
      
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf8');
        totalFixed += fileFixCount;
        filesFixed++;
        console.log(`💾 ${path.relative(frontendSrc, filePath)}: ${fileFixCount} corrections appliquées`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur traitement ${filePath}:`, error.message);
    }
  }
  
  console.log(`\n📊 Résumé: ${totalFixed} corrections dans ${filesFixed} fichiers`);
  
  // Créer une fonction utilitaire pour les futures authentifications
  const utilsPath = './frontend/src/utils/auth.js';
  const utilsContent = `
/**
 * Utilitaires d'authentification centralisés
 * Créé automatiquement le ${new Date().toISOString()}
 */

/**
 * Récupérer le token d'authentification depuis le stockage
 * @returns {string|null} Token d'authentification ou null
 */
export const getAuthToken = () => {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
};

/**
 * Stocker le token d'authentification
 * @param {string} token Token à stocker
 */
export const setAuthToken = (token) => {
  localStorage.setItem('auth_token', token);
};

/**
 * Supprimer le token d'authentification
 */
export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
};

/**
 * Générer les headers d'autorisation pour les requêtes API
 * @returns {Object} Headers avec autorisation ou objet vide
 */
export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: \`Bearer \${token}\` } : {};
};

/**
 * Vérifier si l'utilisateur est connecté
 * @returns {boolean} True si un token existe
 */
export const isAuthenticated = () => {
  return !!getAuthToken();
};
`;
  
  try {
    await fs.writeFile(utilsPath, utilsContent, 'utf8');
    console.log(`\n✅ Utilitaire d'authentification créé: ${utilsPath}`);
  } catch (error) {
    console.error('❌ Erreur création utilitaire:', error.message);
  }
}

if (require.main === module) {
  fixTokenReferences().catch(console.error);
}

module.exports = { fixTokenReferences };