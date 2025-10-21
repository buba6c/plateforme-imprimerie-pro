#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * PLUGIN AUTOMATIQUE DE GESTION DES COULEURS
 * 
 * Remplace toutes les couleurs inconsistantes par la nouvelle palette unifié
 * Palette : Bleu professionnel, Orange énergique, Blanc épuré
 */

class ColorSystemFixer {
  constructor() {
    this.srcPath = path.join(process.cwd(), 'src');
    this.fixedFiles = [];
    this.errors = [];
    
    // Mapping des anciennes couleurs vers la nouvelle palette unifiée
    this.colorMappings = {
      
      // === REMPLACEMENT DES COULEURS PRINCIPALES ===
      
      // Remplacer tous les primary-* par blue-*
      'primary-50': 'blue-50',
      'primary-100': 'blue-100',
      'primary-200': 'blue-200',
      'primary-300': 'blue-300',
      'primary-400': 'blue-400',
      'primary-500': 'blue-500',
      'primary-600': 'blue-600',
      'primary-700': 'blue-700',
      'primary-800': 'blue-800',
      'primary-900': 'blue-900',
      
      // Remplacer tous les secondary-* par neutral-*
      'secondary-50': 'neutral-50',
      'secondary-100': 'neutral-100',
      'secondary-200': 'neutral-200',
      'secondary-300': 'neutral-300',
      'secondary-400': 'neutral-400',
      'secondary-500': 'neutral-500',
      'secondary-600': 'neutral-600',
      'secondary-700': 'neutral-700',
      'secondary-800': 'neutral-800',
      'secondary-900': 'neutral-900',
      
      // === UNIFICATION DES COULEURS GRISES ===
      
      // Tous les gray-* vers neutral-*
      'gray-50': 'neutral-50',
      'gray-100': 'neutral-100',
      'gray-200': 'neutral-200',
      'gray-300': 'neutral-300',
      'gray-400': 'neutral-400',
      'gray-500': 'neutral-500',
      'gray-600': 'neutral-600',
      'gray-700': 'neutral-700',
      'gray-800': 'neutral-800',
      'gray-900': 'neutral-900',
      
      // Tous les slate-* vers neutral-*
      'slate-50': 'neutral-50',
      'slate-100': 'neutral-100',
      'slate-200': 'neutral-200',
      'slate-300': 'neutral-300',
      'slate-400': 'neutral-400',
      'slate-500': 'neutral-500',
      'slate-600': 'neutral-600',
      'slate-700': 'neutral-700',
      'slate-800': 'neutral-800',
      'slate-900': 'neutral-900',
      
      // === COULEURS D'ACTION VERS ORANGE ===
      
      // Boutons d'action principaux
      'yellow-400': 'orange-400',
      'yellow-500': 'orange-500',
      'yellow-600': 'orange-600',
      'amber-400': 'orange-400',
      'amber-500': 'orange-500',
      'amber-600': 'orange-600',
      
      // === COULEURS FONCTIONNELLES ===
      
      // Garder les couleurs de statut mais les harmoniser
      'green-50': 'success-50',
      'green-100': 'success-100',
      'green-500': 'success-500',
      'green-600': 'success-600',
      'green-700': 'success-700',
      
      'red-50': 'error-50',
      'red-100': 'error-100',
      'red-500': 'error-500',
      'red-600': 'error-600',
      'red-700': 'error-700',
      
      // === COULEURS SPÉCIFIQUES MÉTIERS ===
      
      // Pour l'impression (bleus)
      'indigo-500': 'blue-500',
      'indigo-600': 'blue-600',
      'indigo-700': 'blue-700',
      'sky-500': 'blue-400',
      'sky-600': 'blue-500',
      'cyan-500': 'blue-400',
      
      // Pour les actions/CTA (orange)
      'orange-400': 'orange-400', // Garder
      'orange-500': 'orange-500', // Garder
      'orange-600': 'orange-600', // Garder
      
      // === REMPLACEMENTS HARDCODÉS ===
      
      // Hex colors vers classes Tailwind
      '#3b82f6': 'blue-500',
      '#2563eb': 'blue-600',
      '#1d4ed8': 'blue-700',
      '#f97316': 'orange-500',
      '#ea580c': 'orange-600',
      '#ffffff': 'neutral-0',
      '#000000': 'neutral-950',
    };
    
    // Classes spéciales pour les backgrounds avec transparence
    this.specialMappings = {
      'bg-white/95': 'bg-neutral-0/95',
      'bg-white/90': 'bg-neutral-0/90',
      'bg-white/80': 'bg-neutral-0/80',
      'bg-gray-50/50': 'bg-neutral-50/50',
      'bg-primary-500/10': 'bg-blue-500/10',
      'bg-primary-600/10': 'bg-blue-600/10',
    };
  }

  async run() {
    console.log('🎨 Démarrage de l\'uniformisation des couleurs...\n');
    console.log('🔵 Palette principale : Bleu professionnel');
    console.log('🟠 Couleur d\'accent : Orange énergique'); 
    console.log('⚪ Base neutre : Blanc épuré\n');
    
    try {
      const files = await this.getAllFiles();
      console.log(`📁 ${files.length} fichiers à traiter\n`);
      
      for (const file of files) {
        await this.processFile(file);
      }
      
      this.showSummary();
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  }

  async getAllFiles() {
    const files = [];
    
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && item !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (item.endsWith('.js') || item.endsWith('.jsx') || item.endsWith('.css')) {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory(this.srcPath);
    return files;
  }

  async processFile(filePath) {
    try {
      const relativePath = path.relative(this.srcPath, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      let modified = content;
      let changes = 0;

      // 1. Remplacer les classes Tailwind
      for (const [oldColor, newColor] of Object.entries(this.colorMappings)) {
        const patterns = [
          // Classes de background
          `bg-${oldColor}`,
          // Classes de texte
          `text-${oldColor}`,
          // Classes de bordure
          `border-${oldColor}`,
          // Classes hover
          `hover:bg-${oldColor}`,
          `hover:text-${oldColor}`,
          `hover:border-${oldColor}`,
          // Classes focus
          `focus:bg-${oldColor}`,
          `focus:text-${oldColor}`,
          `focus:border-${oldColor}`,
          `focus:ring-${oldColor}`,
          // Classes dark mode
          `dark:bg-${oldColor}`,
          `dark:text-${oldColor}`,
          `dark:border-${oldColor}`,
          `dark:hover:bg-${oldColor}`,
          `dark:hover:text-${oldColor}`,
        ];

        for (const pattern of patterns) {
          const newPattern = pattern.replace(oldColor, newColor);
          if (modified.includes(pattern) && !modified.includes(newPattern)) {
            const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            const before = modified;
            modified = modified.replace(regex, newPattern);
            
            if (modified !== before) {
              changes += (before.match(regex) || []).length;
            }
          }
        }
      }

      // 2. Remplacer les mappings spéciaux
      for (const [original, replacement] of Object.entries(this.specialMappings)) {
        if (modified.includes(original)) {
          const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
          const before = modified;
          modified = modified.replace(regex, replacement);
          
          if (modified !== before) {
            changes += (before.match(regex) || []).length;
          }
        }
      }

      // 3. Remplacer les couleurs hex dans les styles inline
      const hexMappings = {
        '#3b82f6': 'var(--color-blue-500)',
        '#2563eb': 'var(--color-blue-600)', 
        '#1d4ed8': 'var(--color-blue-700)',
        '#f97316': 'var(--color-orange-500)',
        '#ea580c': 'var(--color-orange-600)',
        '#ffffff': 'var(--color-neutral-0)',
        '#000000': 'var(--color-neutral-950)',
      };

      for (const [hex, cssVar] of Object.entries(hexMappings)) {
        if (modified.includes(hex)) {
          const regex = new RegExp(hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const before = modified;
          modified = modified.replace(regex, cssVar);
          
          if (modified !== before) {
            changes += (before.match(regex) || []).length;
          }
        }
      }

      // Sauvegarder si des changements ont été effectués
      if (changes > 0) {
        fs.writeFileSync(filePath, modified);
        this.fixedFiles.push({ file: relativePath, changes });
        console.log(`✅ ${relativePath} - ${changes} couleur(s) unifiée(s)`);
      }

    } catch (error) {
      this.errors.push({ file: path.relative(this.srcPath, filePath), error: error.message });
      console.error(`❌ Erreur dans ${filePath}:`, error.message);
    }
  }

  showSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎨 RÉSUMÉ DE L\'UNIFORMISATION DES COULEURS');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Fichiers modifiés: ${this.fixedFiles.length}`);
    
    let totalChanges = 0;
    this.fixedFiles.forEach(({ file, changes }) => {
      console.log(`   🎨 ${file}: ${changes} couleur(s) unifiée(s)`);
      totalChanges += changes;
    });
    
    console.log(`\n🔧 Total des unifications: ${totalChanges}`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Erreurs: ${this.errors.length}`);
      this.errors.forEach(({ file, error }) => {
        console.log(`   ⚠️  ${file}: ${error}`);
      });
    }
    
    console.log('\n🎉 Uniformisation terminée !');
    console.log('\n🎨 Nouvelle palette appliquée:');
    console.log('   🔵 Bleu (blue-*) : Couleur principale et navigation');
    console.log('   🟠 Orange (orange-*) : Actions et éléments dynamiques');
    console.log('   ⚪ Neutre (neutral-*) : Backgrounds et textes');
    console.log('   ✅ Success (success-*) : États de succès');
    console.log('   ❌ Error (error-*) : États d\'erreur');
    
    console.log('\n💡 Prochaines étapes:');
    console.log('   1. Vérifiez les changements avec git diff');
    console.log('   2. Mettez à jour tailwind.config.js');
    console.log('   3. Testez l\'interface avec les nouvelles couleurs');
    console.log('   4. Ajustez manuellement si nécessaire');
  }
}

// Point d'entrée
if (require.main === module) {
  const fixer = new ColorSystemFixer();
  fixer.run().catch(console.error);
}

module.exports = ColorSystemFixer;