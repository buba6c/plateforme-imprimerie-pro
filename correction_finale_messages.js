#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Messages de remplacement contextuel
const replacements = [
  // Backend - Messages spécifiques par action
  {
    pattern: /message: 'Dossier non trouvé ou accès non autorisé'/g,
    replacement: "message: 'Ce dossier n\\'existe pas ou vous n\\'avez pas l\\'autorisation pour cette action'"
  },
  {
    pattern: /message: "Dossier non trouvé, déjà validé ou vous n'en êtes pas le créateur"/g,
    replacement: "message: \"Ce dossier ne peut pas être validé : il n'existe pas, est déjà validé, ou vous n'en êtes pas le créateur\""
  },
  {
    pattern: /message: 'Dossier non trouvé'/g,
    replacement: "message: 'Ce dossier n\\'existe pas'"
  },
  {
    pattern: /error: 'Dossier non trouvé'/g,
    replacement: "error: 'Ce dossier n\\'existe pas'"
  },
  {
    pattern: /{ error: 'Dossier non trouvé\.' }/g,
    replacement: "{ error: 'Ce dossier n\\'existe pas.' }"
  },
  {
    pattern: /'Dossier non trouvé ou accès non autorisé'/g,
    replacement: "'Ce dossier n\\'existe pas ou vous n\\'avez pas l\\'autorisation pour cette action'"
  },
  
  // Frontend - Messages améliorés
  {
    pattern: /if \(!error\) return 'Dossier non trouvé ou accès non autorisé';/g,
    replacement: "if (!error) return 'Ce dossier n\\'existe pas ou vous n\\'avez pas l\\'autorisation d\\'accès';"
  },
  {
    pattern: /throw new Error\(response\.data\.message \|\| 'Dossier non trouvé ou accès non autorisé'\);/g,
    replacement: "throw new Error(response.data.message || 'Ce dossier n\\'existe pas ou vous n\\'avez pas l\\'autorisation d\\'accès');"
  },
  {
    pattern: /return error\.response\?\.\data \|\| { error: 'Dossier non trouvé' };/g,
    replacement: "return error.response?.data || { error: 'Une erreur s\\'est produite' };"
  },
  {
    pattern: /throw { code: 'DOSSIER_NOT_FOUND', message: 'Dossier non trouvé ou accès non autorisé' };/g,
    replacement: "throw { code: 'DOSSIER_NOT_FOUND', message: 'Ce dossier n\\'existe pas ou vous n\\'avez pas l\\'autorisation d\\'accès' };"
  },
  {
    pattern: /message: 'Dossier non trouvé ou accès non autorisé'/g,
    replacement: "message: 'Ce dossier n\\'existe pas ou vous n\\'avez pas l\\'autorisation pour cette action'"
  }
];

async function processFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let hasChanges = false;
    
    for (const { pattern, replacement } of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`✅ Corrigé: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Erreur avec ${filePath}:`, error.message);
    return false;
  }
}

async function findAndProcessFiles() {
  const filesToProcess = [
    // Backend routes
    'backend/routes/dossiers-crud.js',
    'backend/routes/dossiers-files.js',
    'backend/routes/dossiers-final.js',
    'backend/routes/dossiers-new.js',
    'backend/routes/dossiers-old-backup.js',
    'backend/routes/dossiers-v2.js',
    'backend/routes/dossiers.js',
    'backend/routes/files.js',
    
    // Frontend
    'frontend/src/components/dossiers/DossierDetailsFixed.js',
    'frontend/src/contexts/DossierContext.js',
    'frontend/src/services/api.js',
    'frontend/src/services/filesSyncService.js',
    'frontend/src/services/workflowService.js'
  ];
  
  let totalProcessed = 0;
  
  for (const file of filesToProcess) {
    const fullPath = path.resolve(file);
    
    try {
      await fs.access(fullPath);
      const processed = await processFile(fullPath);
      if (processed) totalProcessed++;
    } catch (error) {
      console.log(`⏩ Ignoré (fichier inexistant): ${file}`);
    }
  }
  
  console.log(`\n🎉 Total de fichiers corrigés: ${totalProcessed}`);
}

// Exécution
findAndProcessFiles().catch(console.error);