#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * VALIDATEUR DU SYSTÈME DE COULEURS UNIFIÉ
 * 
 * Vérifie que toutes les couleurs respectent la nouvelle palette
 * Palette : Bleu professionnel, Orange énergique, Blanc épuré
 */

class ColorSystemValidator {
  constructor() {
    this.srcPath = path.join(process.cwd(), 'src');
    this.issues = [];
    this.stats = {
      totalFiles: 0,
      filesChecked: 0,
      colorsFound: {
        blue: 0,
        orange: 0,
        neutral: 0,
        success: 0,
        error: 0,
        warning: 0,
        info: 0,
      },
      inconsistencies: 0,
      oldColorsFound: 0,
    };
  }

  async run() {
    console.log('🎨 VALIDATION DU SYSTÈME DE COULEURS UNIFIÉ');
    console.log('='.repeat(50));
    console.log('🔵 Palette : Bleu professionnel');
    console.log('🟠 Accent : Orange énergique');
    console.log('⚪ Base : Blanc épuré\n');
    
    try {
      const files = await this.getAllFiles();
      this.stats.totalFiles = files.length;
      
      console.log(`📁 Analyse de ${files.length} fichiers...\n`);
      
      for (const file of files) {
        await this.validateFile(file);
      }
      
      this.showValidationReport();
      
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  }

  async getAllFiles() {
    const files = [];
    
    const scanDirectory = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        if (!fs.existsSync(fullPath)) continue;
        
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

  async validateFile(filePath) {
    try {
      const relativePath = path.relative(this.srcPath, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      this.stats.filesChecked++;
      
      // Compter les couleurs de la nouvelle palette
      this.countColors(content);
      
      // Détecter les incohérences
      const issues = this.findInconsistencies(content, relativePath);
      
      if (issues.length > 0) {
        this.issues.push({
          file: relativePath,
          issues: issues
        });
        this.stats.inconsistencies += issues.length;
      }
      
    } catch (error) {
      console.error(`❌ Erreur dans ${filePath}:`, error.message);
    }
  }

  countColors(content) {
    // Compter les couleurs de la nouvelle palette
    const colorPatterns = {
      blue: /\\b(bg-blue-|text-blue-|border-blue-)/g,
      orange: /\\b(bg-orange-|text-orange-|border-orange-)/g,
      neutral: /\\b(bg-neutral-|text-neutral-|border-neutral-)/g,
      success: /\\b(bg-success-|text-success-|border-success-)/g,
      error: /\\b(bg-error-|text-error-|border-error-)/g,
      warning: /\\b(bg-warning-|text-warning-|border-warning-)/g,
      info: /\\b(bg-info-|text-info-|border-info-)/g,
    };

    for (const [colorName, pattern] of Object.entries(colorPatterns)) {
      const matches = content.match(pattern) || [];
      this.stats.colorsFound[colorName] += matches.length;
    }
  }

  findInconsistencies(content, filePath) {
    const issues = [];
    
    // 1. Détecter les anciennes couleurs qui n'ont pas été remplacées
    const oldColorPatterns = [
      { pattern: /\\b(primary-(?!500|600|700)\\d+)/g, description: 'Anciennes couleurs primary-* non-standard' },
      { pattern: /\\b(secondary-(?!50|100|200|300|400|500|600|700|800|900)\\d+)/g, description: 'Anciennes couleurs secondary-* non-standard' },
      { pattern: /\\b(gray-)/g, description: 'Couleurs gray-* (devrait être neutral-*)' },
      { pattern: /\\b(slate-)/g, description: 'Couleurs slate-* (devrait être neutral-*)' },
      { pattern: /\\b(zinc-)/g, description: 'Couleurs zinc-* (devrait être neutral-*)' },
      { pattern: /\\b(stone-)/g, description: 'Couleurs stone-* (devrait être neutral-*)' },
    ];

    for (const { pattern, description } of oldColorPatterns) {
      const matches = content.match(pattern) || [];
      if (matches.length > 0) {
        this.stats.oldColorsFound += matches.length;
        issues.push({
          type: 'old-color',
          description: `${description} (${matches.length} occurrence(s))`,
          matches: matches.slice(0, 5), // Limiter à 5 exemples
          severity: 'warning'
        });
      }
    }

    // 2. Détecter les couleurs hardcodées dans les styles inline
    const inlineColorPattern = /(backgroundColor|color|borderColor)\\s*:\\s*['"][^'"]*['"](?!\\s*var\\()/g;
    const inlineMatches = content.match(inlineColorPattern) || [];
    if (inlineMatches.length > 0) {
      issues.push({
        type: 'inline-color',
        description: `Couleurs hardcodées dans les styles inline (${inlineMatches.length} occurrence(s))`,
        matches: inlineMatches.slice(0, 3),
        severity: 'info'
      });
    }

    // 3. Détecter les couleurs hex non remplacées
    const hexPattern = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?!\\s*(;|\\)|$))/g;
    const hexMatches = content.match(hexPattern) || [];
    if (hexMatches.length > 0) {
      // Filtrer les couleurs hex connues de notre palette
      const knownHex = ['#3b82f6', '#f97316', '#ffffff', '#000000', '#22c55e', '#ef4444', '#f59e0b'];
      const unknownHex = hexMatches.filter(hex => !knownHex.includes(hex.toLowerCase()));
      
      if (unknownHex.length > 0) {
        issues.push({
          type: 'unknown-hex',
          description: `Couleurs hex inconnues (${unknownHex.length} occurrence(s))`,
          matches: [...new Set(unknownHex)].slice(0, 5),
          severity: 'info'
        });
      }
    }

    return issues;
  }

  showValidationReport() {
    console.log('=' .repeat(60));
    console.log('📊 RAPPORT DE VALIDATION DU SYSTÈME DE COULEURS');
    console.log('=' .repeat(60));
    
    // Statistiques générales
    console.log(`\\n✅ Statistiques générales:`);
    console.log(`   📁 Fichiers analysés: ${this.stats.filesChecked}/${this.stats.totalFiles}`);
    console.log(`   ⚠️  Incohérences détectées: ${this.stats.inconsistencies}`);
    console.log(`   🎨 Anciennes couleurs trouvées: ${this.stats.oldColorsFound}`);

    // Répartition des couleurs
    console.log(`\\n🎨 Répartition des couleurs (nouvelle palette):`);
    const totalColors = Object.values(this.stats.colorsFound).reduce((a, b) => a + b, 0);
    
    for (const [colorName, count] of Object.entries(this.stats.colorsFound)) {
      if (count > 0) {
        const percentage = Math.round((count / totalColors) * 100);
        const emoji = {
          blue: '🔵',
          orange: '🟠', 
          neutral: '⚪',
          success: '✅',
          error: '❌',
          warning: '⚠️',
          info: 'ℹ️'
        }[colorName] || '🎨';
        
        console.log(`   ${emoji} ${colorName}: ${count} utilisations (${percentage}%)`);
      }
    }

    // Détails des problèmes
    if (this.issues.length > 0) {
      console.log(`\\n🔍 Problèmes détectés dans ${this.issues.length} fichier(s):`);
      
      this.issues.slice(0, 10).forEach(({ file, issues }) => {
        console.log(`\\n📝 ${file}:`);
        issues.forEach(issue => {
          const icon = issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`   ${icon} ${issue.description}`);
          if (issue.matches && issue.matches.length > 0) {
            console.log(`      Exemples: ${issue.matches.join(', ')}`);
          }
        });
      });

      if (this.issues.length > 10) {
        console.log(`\\n   ... et ${this.issues.length - 10} autre(s) fichier(s)`);
      }
    }

    // Score de conformité
    const conformityScore = Math.max(0, Math.min(100, 100 - (this.stats.oldColorsFound * 2) - (this.stats.inconsistencies * 1)));
    console.log(`\\n🏆 Score de conformité: ${conformityScore}%`);
    
    if (conformityScore >= 95) {
      console.log('🎉 Excellent ! Votre système de couleurs est très bien unifié.');
    } else if (conformityScore >= 85) {
      console.log('👍 Bien ! Quelques ajustements mineurs suffisent.');
    } else if (conformityScore >= 70) {
      console.log('👌 Correct, mais des améliorations sont recommandées.');
    } else {
      console.log('⚠️  Des améliorations significatives sont nécessaires.');
    }

    // Recommandations
    console.log(`\\n💡 Recommandations:`);
    if (this.stats.oldColorsFound > 0) {
      console.log('   1. Exécutez à nouveau le script d\\'unification des couleurs');
    }
    if (this.stats.inconsistencies > 5) {
      console.log('   2. Utilisez le hook useColorSystem dans vos composants');
    }
    console.log('   3. Utilisez les classes Tailwind plutôt que les styles inline');
    console.log('   4. Respectez la palette: Bleu (principal), Orange (accent), Neutre (base)');

    console.log(`\\n🛠️  Commandes utiles:`);
    console.log('   npm run colors:unify     - Réexécuter l\\'unification');
    console.log('   npm run colors:validate  - Analyser les couleurs restantes');
    console.log('   npm start                - Tester l\\'interface');
  }
}

// Point d'entrée
if (require.main === module) {
  const validator = new ColorSystemValidator();
  validator.run().catch(console.error);
}

module.exports = ColorSystemValidator;