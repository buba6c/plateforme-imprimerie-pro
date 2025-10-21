#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Mappings des classes vers leurs équivalents dark:
const DARK_MODE_MAPPINGS = {
  // Backgrounds
  'bg-white': 'bg-white dark:bg-secondary-800',
  'bg-gray-50': 'bg-gray-50 dark:bg-secondary-900',
  'bg-gray-100': 'bg-gray-100 dark:bg-secondary-800',
  'bg-gray-200': 'bg-gray-200 dark:bg-secondary-700',
  'bg-secondary-50': 'bg-secondary-50 dark:bg-secondary-900',
  'bg-secondary-100': 'bg-secondary-100 dark:bg-secondary-800',
  
  // Text colors
  'text-gray-900': 'text-gray-900 dark:text-white',
  'text-gray-800': 'text-gray-800 dark:text-secondary-100',
  'text-gray-700': 'text-gray-700 dark:text-secondary-200',
  'text-gray-600': 'text-gray-600 dark:text-secondary-300',
  'text-gray-500': 'text-gray-500 dark:text-secondary-400',
  'text-secondary-900': 'text-secondary-900 dark:text-white',
  'text-secondary-800': 'text-secondary-800 dark:text-secondary-100',
  'text-secondary-700': 'text-secondary-700 dark:text-secondary-200',
  'text-secondary-600': 'text-secondary-600 dark:text-secondary-300',
  
  // Borders
  'border-gray-200': 'border-gray-200 dark:border-secondary-700',
  'border-gray-300': 'border-gray-300 dark:border-secondary-600',
  'border-secondary-200': 'border-secondary-200 dark:border-secondary-700',
  'border-secondary-300': 'border-secondary-300 dark:border-secondary-600',
  
  // Hover states
  'hover:bg-gray-50': 'hover:bg-gray-50 dark:hover:bg-secondary-800',
  'hover:bg-gray-100': 'hover:bg-gray-100 dark:hover:bg-secondary-700',
  'hover:bg-secondary-50': 'hover:bg-secondary-50 dark:hover:bg-secondary-800',
  'hover:bg-secondary-100': 'hover:bg-secondary-100 dark:hover:bg-secondary-700',
  
  // Focus states
  'focus:ring-gray-500': 'focus:ring-gray-500 dark:focus:ring-secondary-400',
  'focus:border-gray-500': 'focus:border-gray-500 dark:focus:border-secondary-400',
  
  // Shadows (souvent problématiques en dark mode)
  'shadow-md': 'shadow-md dark:shadow-secondary-900/20',
  'shadow-lg': 'shadow-lg dark:shadow-secondary-900/25',
  'shadow-xl': 'shadow-xl dark:shadow-secondary-900/30',
};

// Classes spéciales qui nécessitent une attention particulière
const SPECIAL_CASES = {
  // Cas où bg-white/95 backdrop-blur-xl (LoginModern.js)
  'bg-white/95': 'bg-white/95 dark:bg-secondary-800/95',
  'bg-white/90': 'bg-white/90 dark:bg-secondary-800/90',
  'bg-white/80': 'bg-white/80 dark:bg-secondary-800/80',
};

class DarkModeFixer {
  constructor() {
    this.srcPath = path.join(process.cwd(), 'src');
    this.fixedFiles = [];
    this.errors = [];
  }

  // Fonction principale
  async run() {
    console.log('🌙 Démarrage de la correction automatique du mode sombre...\n');
    
    try {
      const files = await this.getAllJsxFiles();
      console.log(`📁 ${files.length} fichiers JSX trouvés\n`);
      
      for (const file of files) {
        await this.processFile(file);
      }
      
      this.showSummary();
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  }

  // Récupère tous les fichiers JSX
  async getAllJsxFiles() {
    const files = [];
    
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && item !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory(this.srcPath);
    return files;
  }

  // Traite un fichier
  async processFile(filePath) {
    try {
      const relativePath = path.relative(this.srcPath, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      let modified = content;
      let changes = 0;

      // Applique les corrections automatiques
      for (const [original, replacement] of Object.entries({...DARK_MODE_MAPPINGS, ...SPECIAL_CASES})) {
        // Évite de dupliquer les classes dark: existantes
        if (!modified.includes(replacement) && modified.includes(original)) {
          const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?!.*dark:)`, 'g');
          const newModified = modified.replace(regex, replacement);
          
          if (newModified !== modified) {
            changes += (modified.match(regex) || []).length;
            modified = newModified;
          }
        }
      }

      // Sauvegarde si des changements ont été effectués
      if (changes > 0) {
        fs.writeFileSync(filePath, modified);
        this.fixedFiles.push({ file: relativePath, changes });
        console.log(`✅ ${relativePath} - ${changes} correction(s)`);
      }
    } catch (error) {
      this.errors.push({ file: path.relative(this.srcPath, filePath), error: error.message });
      console.error(`❌ Erreur dans ${filePath}:`, error.message);
    }
  }

  // Affiche le résumé
  showSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA CORRECTION AUTOMATIQUE');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Fichiers corrigés: ${this.fixedFiles.length}`);
    
    let totalChanges = 0;
    this.fixedFiles.forEach(({ file, changes }) => {
      console.log(`   📝 ${file}: ${changes} correction(s)`);
      totalChanges += changes;
    });
    
    console.log(`\n🔧 Total des corrections: ${totalChanges}`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Erreurs: ${this.errors.length}`);
      this.errors.forEach(({ file, error }) => {
        console.log(`   ⚠️  ${file}: ${error}`);
      });
    }
    
    console.log('\n🎉 Correction automatique terminée !');
    console.log('\n💡 Prochaines étapes:');
    console.log('   1. Vérifiez les changements avec git diff');
    console.log('   2. Testez l\'interface en mode sombre');
    console.log('   3. Validez les corrections manuellement');
  }
}

// Point d'entrée
if (require.main === module) {
  const fixer = new DarkModeFixer();
  fixer.run().catch(console.error);
}

module.exports = DarkModeFixer;