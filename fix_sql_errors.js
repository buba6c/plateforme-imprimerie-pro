#!/usr/bin/env node
/**
 * Script de correction automatique des erreurs SQL
 * Correction des références à 'status' vers 'statut' dans les requêtes SQL
 */

const fs = require('fs').promises;
const path = require('path');

// Patterns de requêtes problématiques à corriger
const corrections = [
  // Pattern 1: SELECT avec status direct (sans AS)
  {
    pattern: /SELECT\s+([^,]*,\s*)?status(\s*,\s*[^,]*)*\s+FROM\s+dossiers/gi,
    replacement: (match) => {
      return match.replace(/\bstatus\b/gi, 'statut AS status');
    },
    description: 'Corriger SELECT status -> statut AS status'
  },
  
  // Pattern 2: UPDATE avec status
  {
    pattern: /UPDATE\s+dossiers\s+SET\s+status\s*=/gi,
    replacement: 'UPDATE dossiers SET statut =',
    description: 'Corriger UPDATE status -> statut'
  },
  
  // Pattern 3: WHERE status =
  {
    pattern: /WHERE\s+status\s*=/gi,
    replacement: 'WHERE statut =',
    description: 'Corriger WHERE status -> statut'
  },
  
  // Pattern 4: INSERT avec status
  {
    pattern: /INSERT\s+INTO\s+dossiers\s*\([^)]*status[^)]*\)/gi,
    replacement: (match) => {
      return match.replace(/\bstatus\b/gi, 'statut');
    },
    description: 'Corriger INSERT status -> statut'
  },
  
  // Pattern 5: ORDER BY status
  {
    pattern: /ORDER\s+BY\s+status/gi,
    replacement: 'ORDER BY statut',
    description: 'Corriger ORDER BY status -> statut'
  },
  
  // Pattern 6: Paramètres SQL mal numérotés ($0 -> $1)
  {
    pattern: /\$0\b/g,
    replacement: '$1',
    description: 'Corriger paramètre $0 -> $1'
  }
];

// Fichiers à vérifier
const filesToCheck = [
  'backend/routes/dossiers.js',
  'backend/routes/files.js',
  'backend/routes/auth.js',
  'backend/routes/users.js',
  'backend/routes/index.js',
  'backend/middleware/permissions.js',
  'backend/services/*.js',
  'backend/utils/*.js'
];

async function findJSFiles(dir) {
  const files = [];
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        files.push(...await findJSFiles(fullPath));
      } else if (item.isFile() && item.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Erreur lecture dossier ${dir}:`, error.message);
  }
  
  return files;
}

async function correctFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    let correctedContent = content;
    let corrections_made = [];
    
    // Appliquer chaque correction
    for (const correction of corrections) {
      const before = correctedContent;
      
      if (typeof correction.replacement === 'function') {
        correctedContent = correctedContent.replace(correction.pattern, correction.replacement);
      } else {
        correctedContent = correctedContent.replace(correction.pattern, correction.replacement);
      }
      
      if (before !== correctedContent) {
        corrections_made.push(correction.description);
      }
    }
    
    // Sauvegarder si des corrections ont été apportées
    if (corrections_made.length > 0) {
      await fs.writeFile(filePath, correctedContent, 'utf8');
      console.log(`✅ ${filePath}:`);
      corrections_made.forEach(correction => console.log(`   - ${correction}`));
    }
    
    return corrections_made.length;
    
  } catch (error) {
    console.error(`❌ Erreur correction ${filePath}:`, error.message);
    return 0;
  }
}

async function main() {
  console.log('🔧 Démarrage de la correction automatique des erreurs SQL...\n');
  
  // Trouver tous les fichiers JS dans le backend
  const allFiles = await findJSFiles('./backend');
  
  let totalCorrections = 0;
  let filesModified = 0;
  
  for (const file of allFiles) {
    const corrections = await correctFile(file);
    if (corrections > 0) {
      totalCorrections += corrections;
      filesModified++;
    }
  }
  
  console.log('\n📊 Résumé des corrections:');
  console.log(`   - Fichiers modifiés: ${filesModified}`);
  console.log(`   - Total corrections: ${totalCorrections}`);
  
  if (totalCorrections === 0) {
    console.log('✨ Aucune correction nécessaire - le code semble déjà propre !');
  } else {
    console.log('✅ Corrections appliquées avec succès !');
    console.log('\n⚠️  N\'oubliez pas de redémarrer le backend après ces modifications.');
  }
}

// Gestion des erreurs globales
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { correctFile, corrections };