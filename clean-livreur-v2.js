#!/usr/bin/env node
/**
 * 🧹 Script de nettoyage des fichiers Livreur V2 corrompus
 * Remplace les caractères échappés incorrectement (\" et \') par les bons caractères
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ARCHIVE_PATH = '/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/ARCHIVE/livreur-v2-corrompu-20251016';
const TARGET_PATH = '/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/frontend/src/components/livreur/v2-clean';

// Fichiers corrompus identifiés
const CORRUPTED_FILES = [
  'navigation/LivreurNavigation.js',
  'modals/DossierDetailsModalV2.js',
  'modals/ProgrammerModalV2.js',
  'dashboard/LivreurHeader.js',
  'dashboard/LivreurKPICards.js'
];

console.log('🧹 Démarrage du nettoyage des fichiers Livreur V2...\n');

/**
 * Nettoie les caractères échappés dans le contenu
 */
function cleanContent(content) {
  let cleaned = content;
  
  // Remplacer \" par " (sauf dans les regex et cas légitimes)
  cleaned = cleaned.replace(/\\"/g, '"');
  
  // Remplacer \' par ' (sauf dans les regex et cas légitimes)
  cleaned = cleaned.replace(/\\'/g, "'");
  
  // Nettoyer d'autres échappements problématiques
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  return cleaned;
}

/**
 * Vérifie la syntaxe d'un fichier avec Node.js
 */
function checkSyntax(filePath) {
  try {
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error.stderr ? error.stderr.toString() : error.message 
    };
  }
}

/**
 * Copie et nettoie un fichier
 */
function processFile(relativePath, isCorrupted) {
  const sourcePath = path.join(ARCHIVE_PATH, relativePath);
  const targetPath = path.join(TARGET_PATH, relativePath);
  
  // Créer le dossier cible si nécessaire
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Lire le fichier source
  let content = fs.readFileSync(sourcePath, 'utf8');
  
  if (isCorrupted) {
    console.log(`🔧 Nettoyage de ${relativePath}...`);
    const originalLength = content.length;
    content = cleanContent(content);
    const cleanedLength = content.length;
    console.log(`   ✓ ${originalLength - cleanedLength} caractères nettoyés`);
  } else {
    console.log(`✓ Copie de ${relativePath} (déjà propre)`);
  }
  
  // Écrire le fichier nettoyé
  fs.writeFileSync(targetPath, content, 'utf8');
  
  // Vérifier la syntaxe
  const syntaxCheck = checkSyntax(targetPath);
  if (syntaxCheck.valid) {
    console.log(`   ✅ Syntaxe valide\n`);
    return { success: true, file: relativePath };
  } else {
    console.log(`   ❌ Erreur de syntaxe: ${syntaxCheck.error}\n`);
    return { success: false, file: relativePath, error: syntaxCheck.error };
  }
}

/**
 * Récupère tous les fichiers .js de l'archive
 */
function getAllJsFiles(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(getAllJsFiles(filePath, baseDir));
    } else if (file.endsWith('.js') && !file.includes('.backup')) {
      const relativePath = path.relative(baseDir, filePath);
      results.push(relativePath);
    }
  });
  
  return results;
}

// Créer le dossier cible
if (!fs.existsSync(TARGET_PATH)) {
  fs.mkdirSync(TARGET_PATH, { recursive: true });
  console.log(`📁 Dossier créé: ${TARGET_PATH}\n`);
}

// Récupérer tous les fichiers
const allFiles = getAllJsFiles(ARCHIVE_PATH);
console.log(`📊 ${allFiles.length} fichiers à traiter\n`);
console.log('=' .repeat(60));

// Traiter tous les fichiers
const results = [];
allFiles.forEach(file => {
  const isCorrupted = CORRUPTED_FILES.includes(file);
  const result = processFile(file, isCorrupted);
  results.push(result);
});

// Rapport final
console.log('=' .repeat(60));
console.log('\n📊 RAPPORT FINAL:\n');

const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`✅ Fichiers traités avec succès: ${successful.length}/${results.length}`);
if (failed.length > 0) {
  console.log(`❌ Fichiers avec erreurs: ${failed.length}`);
  failed.forEach(f => {
    console.log(`   - ${f.file}`);
    console.log(`     ${f.error.split('\n')[0]}`);
  });
} else {
  console.log('🎉 Tous les fichiers sont propres et valides !');
}

console.log(`\n📁 Fichiers nettoyés disponibles dans:`);
console.log(`   ${TARGET_PATH}`);
