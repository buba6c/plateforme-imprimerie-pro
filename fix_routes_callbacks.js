#!/usr/bin/env node
/**
 * Script de correction des erreurs de routes et callbacks
 * Corrige les erreurs "Route.get() requires a callback function" et paramètres manquants
 */

const fs = require('fs').promises;
const path = require('path');

// Patterns d'erreurs de routes à corriger
const routeFixPatterns = [
  {
    // Fix: Route.get() requires a callback function
    pattern: /app\.(get|post|put|delete)\s*\(\s*['"][^'"]*['"](?:\s*,\s*[^,)]*)*\s*\)/g,
    validate: (match) => {
      // Vérifier si la route a au moins une fonction callback
      const parts = match.split(',');
      return parts.length >= 2 && parts[parts.length - 1].includes(')');
    },
    fix: (match) => {
      const routeMatch = match.match(/app\.(get|post|put|delete)\s*\(\s*(['"][^'"]*['"])/);
      if (!routeMatch) return match;
      
      const method = routeMatch[1];
      const route = routeMatch[2];
      
      return `app.${method}(${route}, (req, res) => {
  res.status(501).json({ error: 'Route not implemented yet' });
})`;
    },
    description: 'Correction routes sans callback'
  },
  {
    // Fix: Paramètres manquants dans les fonctions
    pattern: /function\s+\w*\s*\(\s*\)\s*{[^}]*res\.(send|json|status)/g,
    fix: (match) => {
      return match.replace(/function\s+(\w*)\s*\(\s*\)/, 'function $1(req, res)');
    },
    description: 'Ajout paramètres req, res aux fonctions'
  },
  {
    // Fix: Arrow functions sans paramètres
    pattern: /\(\s*\)\s*=>\s*{[^}]*res\.(send|json|status)/g,
    fix: (match) => {
      return match.replace(/\(\s*\)\s*=>/, '(req, res) =>');
    },
    description: 'Ajout paramètres aux arrow functions'
  }
];

// Patterns d'erreurs de callbacks à corriger
const callbackFixPatterns = [
  {
    // Fix: Callbacks manquants dans les middlewares
    pattern: /app\.use\s*\(\s*['"][^'"]*['"](?:\s*,\s*function\s*\([^)]*\)\s*{[^}]*})*\s*\)/g,
    validate: (match) => {
      return !match.includes('function') && !match.includes('=>');
    },
    fix: (match) => {
      const middlewareMatch = match.match(/app\.use\s*\(\s*(['"][^'"]*['"])/);
      if (!middlewareMatch) return match;
      
      const middleware = middlewareMatch[1];
      return `app.use(${middleware}, (req, res, next) => {
  next();
})`;
    },
    description: 'Ajout callbacks aux middlewares'
  }
];

async function findBackendFiles() {
  const backendDir = './backend';
  const jsFiles = [];
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          jsFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Erreur scan ${dir}:`, error.message);
    }
  }
  
  await scanDir(backendDir);
  return jsFiles;
}

async function fixRouteFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    let fixedContent = content;
    let fixCount = 0;
    
    // Appliquer les corrections de routes
    for (const pattern of routeFixPatterns) {
      const matches = fixedContent.match(pattern.pattern);
      if (matches) {
        for (const match of matches) {
          // Vérifier si une validation est nécessaire
          if (pattern.validate && !pattern.validate(match)) {
            continue;
          }
          
          const fixed = pattern.fix(match);
          if (fixed !== match) {
            fixedContent = fixedContent.replace(match, fixed);
            fixCount++;
            console.log(`  ✅ ${pattern.description}`);
          }
        }
      }
    }
    
    // Appliquer les corrections de callbacks
    for (const pattern of callbackFixPatterns) {
      const matches = fixedContent.match(pattern.pattern);
      if (matches) {
        for (const match of matches) {
          if (pattern.validate && !pattern.validate(match)) {
            continue;
          }
          
          const fixed = pattern.fix(match);
          if (fixed !== match) {
            fixedContent = fixedContent.replace(match, fixed);
            fixCount++;
            console.log(`  ✅ ${pattern.description}`);
          }
        }
      }
    }
    
    // Sauvegarder si des modifications ont été apportées
    if (fixCount > 0) {
      await fs.writeFile(filePath, fixedContent, 'utf8');
      console.log(`💾 ${path.basename(filePath)}: ${fixCount} corrections appliquées`);
    }
    
    return fixCount;
    
  } catch (error) {
    console.error(`❌ Erreur correction ${filePath}:`, error.message);
    return 0;
  }
}

async function fixSpecificRouteErrors() {
  console.log('🔧 Correction des erreurs spécifiques dans les routes...');
  
  // Corrections spécifiques basées sur les logs d'erreur
  const specificFixes = [
    {
      file: './backend/routes/files.js',
      fixes: [
        {
          // Fix: Callback manquant pour upload route
          search: /router\.post\s*\(\s*['"]\/upload['"](?:\s*,\s*upload\.single\([^)]+\))*\s*\)/,
          replace: `router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier téléchargé' });
    }
    res.json({ 
      message: 'Fichier téléchargé avec succès',
      file: req.file 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur téléchargement fichier' });
  }
})`,
          description: 'Ajout callback route upload'
        }
      ]
    },
    {
      file: './backend/routes/dossiers.js',
      fixes: [
        {
          // Fix: Paramètres manquants dans les routes
          search: /router\.(get|post|put|delete)\s*\(\s*(['"][^'"]*['"])\s*\)/,
          replace: (match, method, route) => {
            return `router.${method}(${route}, async (req, res) => {
  try {
    res.status(501).json({ error: 'Route ${route} en cours d\\'implémentation' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})`;
          },
          description: 'Ajout callbacks aux routes dossiers'
        }
      ]
    }
  ];
  
  let totalFixes = 0;
  
  for (const { file, fixes } of specificFixes) {
    try {
      console.log(`\n📁 Traitement: ${path.basename(file)}`);
      
      let content = await fs.readFile(file, 'utf8');
      let fileFixCount = 0;
      
      for (const fix of fixes) {
        if (typeof fix.replace === 'string') {
          const before = content;
          content = content.replace(fix.search, fix.replace);
          if (before !== content) {
            console.log(`  ✅ ${fix.description}`);
            fileFixCount++;
          }
        } else if (typeof fix.replace === 'function') {
          const matches = content.match(fix.search);
          if (matches) {
            content = content.replace(fix.search, fix.replace);
            console.log(`  ✅ ${fix.description}`);
            fileFixCount++;
          }
        }
      }
      
      if (fileFixCount > 0) {
        await fs.writeFile(file, content, 'utf8');
        console.log(`💾 ${path.basename(file)}: ${fileFixCount} corrections spécifiques appliquées`);
        totalFixes += fileFixCount;
      }
      
    } catch (error) {
      console.error(`❌ Erreur fichier ${file}:`, error.message);
    }
  }
  
  return totalFixes;
}

async function validateBackendSyntax() {
  console.log('\n🔍 Validation de la syntaxe du backend...');
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Vérifier la syntaxe du serveur principal
    const { stdout, stderr } = await execAsync('node -c ./backend/server.js');
    
    if (stderr) {
      console.log('⚠️ Avertissements syntaxe:', stderr);
    } else {
      console.log('✅ Syntaxe backend/server.js validée');
    }
    
    return !stderr;
    
  } catch (error) {
    console.error('❌ Erreur validation syntaxe:', error.message);
    return false;
  }
}

async function main() {
  console.log('🛠️ Démarrage de la correction des routes et callbacks...\n');
  
  let totalFixedFiles = 0;
  let totalFixes = 0;
  
  try {
    // 1. Corrections spécifiques
    const specificFixes = await fixSpecificRouteErrors();
    totalFixes += specificFixes;
    
    // 2. Trouver tous les fichiers backend
    console.log('\n📂 Recherche des fichiers backend...');
    const backendFiles = await findBackendFiles();
    console.log(`Trouvé ${backendFiles.length} fichiers JavaScript`);
    
    // 3. Corriger chaque fichier
    console.log('\n🔧 Application des corrections automatiques...');
    
    for (const file of backendFiles) {
      console.log(`\n📁 Traitement: ${path.relative('./backend', file)}`);
      
      const fixCount = await fixRouteFile(file);
      if (fixCount > 0) {
        totalFixedFiles++;
        totalFixes += fixCount;
      }
    }
    
    // 4. Validation finale
    await validateBackendSyntax();
    
    console.log('\n🎉 Correction des routes terminée !');
    console.log(`📊 Résumé: ${totalFixes} corrections dans ${totalFixedFiles} fichiers`);
    
    console.log('\n📋 Actions recommandées:');
    console.log('   1. Redémarrer le backend');
    console.log('   2. Tester les routes principales');
    console.log('   3. Vérifier les logs pour confirmer les corrections');
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction des routes:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  fixRouteFile, 
  fixSpecificRouteErrors,
  validateBackendSyntax,
  findBackendFiles
};