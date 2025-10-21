#!/usr/bin/env node
/**
 * Script de nettoyage final du fichier server.js
 * Supprime les syntaxes malformées et corrige les routes
 */

const fs = require('fs').promises;

async function cleanServerFile() {
  const serverPath = './backend/server.js';
  
  try {
    let content = await fs.readFile(serverPath, 'utf8');
    
    // Corrections spécifiques
    const fixes = [
      // Supprimer les }); orphelins
      { pattern: /^\s*}\s*;\s*$/gm, replacement: '' },
      
      // Corriger les routes malformées
      { 
        pattern: /app\.(get|post|put|delete)\s*\([^)]+\)\s*;\s*res\.json\(/gm, 
        replacement: 'app.$1($1, (req, res) => {\n  res.json(' 
      },
      
      // Nettoyer les doubles arrow functions
      { pattern: /}\)\s*=>\s*{/g, replacement: '}); // Cleaned' },
      
      // Corriger les lignes orphelines
      { pattern: /^\s*res\.json\(/gm, replacement: '  res.json(' },
      
      // Nettoyer les commentaires orphelins 
      { pattern: /\s*\/\/ Cleaned\s*/g, replacement: '' },
      
      // Supprimer les lignes vides multiples
      { pattern: /\n\s*\n\s*\n/g, replacement: '\n\n' }
    ];
    
    console.log('🧹 Nettoyage du fichier server.js...');
    
    for (const fix of fixes) {
      const before = content;
      content = content.replace(fix.pattern, fix.replacement);
      if (before !== content) {
        console.log('✅ Correction appliquée');
      }
    }
    
    // Vérifier qu'il n'y a pas de syntaxes problématiques restantes
    const problematicPatterns = [
      /}\s*=>\s*{/,
      /^\s*}\s*;\s*$/m,
      /app\.[a-z]+\([^)]+\)\s*;\s*[^{]/
    ];
    
    for (const pattern of problematicPatterns) {
      if (pattern.test(content)) {
        console.log('⚠️ Pattern problématique détecté, correction manuelle nécessaire');
      }
    }
    
    await fs.writeFile(serverPath, content, 'utf8');
    console.log('💾 Fichier server.js nettoyé');
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur nettoyage server.js:', error.message);
    return false;
  }
}

async function validateSyntax() {
  console.log('🔍 Validation finale de la syntaxe...');
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    await execAsync('node -c ./backend/server.js');
    console.log('✅ Syntaxe server.js validée');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur syntaxe:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Nettoyage final du backend...\n');
  
  const cleaned = await cleanServerFile();
  if (cleaned) {
    const valid = await validateSyntax();
    if (valid) {
      console.log('\n🎉 Backend nettoyé avec succès !');
    } else {
      console.log('\n⚠️ Nettoyage terminé mais syntaxe à vérifier manuellement');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}