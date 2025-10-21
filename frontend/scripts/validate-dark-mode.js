#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DarkModeValidator {
  constructor() {
    this.srcPath = path.join(process.cwd(), 'src');
    this.issues = [];
    this.stats = {
      totalFiles: 0,
      filesWithDarkMode: 0,
      potentialIssues: 0,
      optimizationSuggestions: 0
    };
  }

  async run() {
    console.log('🔍 Validation du mode sombre...\n');
    
    try {
      const files = await this.getAllJsxFiles();
      this.stats.totalFiles = files.length;
      
      console.log(`📁 Analyse de ${files.length} fichiers...\n`);
      
      for (const file of files) {
        await this.validateFile(file);
      }
      
      this.showValidationReport();
      this.showOptimizationSuggestions();
      
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  }

  async getAllJsxFiles() {
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
        } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
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
      
      // Détecte si le fichier utilise des classes dark:
      const hasDarkModeClasses = /dark:/.test(content);
      if (hasDarkModeClasses) {
        this.stats.filesWithDarkMode++;
      }
      
      // Recherche des problèmes potentiels
      const potentialIssues = this.findPotentialIssues(content, relativePath);
      
      if (potentialIssues.length > 0) {
        this.issues.push({
          file: relativePath,
          issues: potentialIssues
        });
        this.stats.potentialIssues += potentialIssues.length;
      }
      
    } catch (error) {
      console.error(`❌ Erreur dans ${filePath}:`, error.message);
    }
  }

  findPotentialIssues(content, filePath) {
    const issues = [];
    
    // 1. Classes bg-white sans dark: correspondant
    const bgWhiteRegex = /\\bbg-white\\b(?![^"]*dark:)/g;
    const bgWhiteMatches = content.match(bgWhiteRegex) || [];
    if (bgWhiteMatches.length > 0) {
      issues.push({
        type: 'missing-dark-bg',
        description: `${bgWhiteMatches.length} occurrence(s) de 'bg-white' sans classe dark: correspondante`,
        severity: 'warning'
      });
    }
    
    // 2. Text colors sans dark:
    const textColorRegex = /\\btext-(gray|black|white)\\b(?![^"]*dark:)/g;
    const textColorMatches = content.match(textColorRegex) || [];
    if (textColorMatches.length > 0) {
      issues.push({
        type: 'missing-dark-text',
        description: `${textColorMatches.length} couleur(s) de texte sans variante dark:`,
        severity: 'warning'
      });
    }
    
    // 3. Border colors sans dark:
    const borderColorRegex = /\\bborder-(gray|black)\\b(?![^"]*dark:)/g;
    const borderColorMatches = content.match(borderColorRegex) || [];
    if (borderColorMatches.length > 0) {
      issues.push({
        type: 'missing-dark-border',
        description: `${borderColorMatches.length} bordure(s) sans variante dark:`,
        severity: 'info'
      });
    }
    
    // 4. Hardcoded colors dans styles inline
    const inlineColorRegex = /(backgroundColor|color|borderColor)\\s*:\\s*['"][^'"]*['"](?![^}]*dark)/g;
    const inlineColorMatches = content.match(inlineColorRegex) || [];
    if (inlineColorMatches.length > 0) {
      issues.push({
        type: 'hardcoded-colors',
        description: `${inlineColorMatches.length} couleur(s) codée(s) en dur dans les styles inline`,
        severity: 'warning'
      });
    }
    
    // 5. Détection des composants de graphiques sans thème adaptatif
    if (/\\b(LineChart|BarChart|PieChart)\\b/.test(content) && !/useChartTheme|chartTheme/.test(content)) {
      issues.push({
        type: 'chart-no-theme',
        description: 'Composant graphique sans thème adaptatif',
        severity: 'info'
      });
    }
    
    return issues;
  }

  showValidationReport() {
    console.log('=' .repeat(60));
    console.log('📊 RAPPORT DE VALIDATION DU MODE SOMBRE');
    console.log('=' .repeat(60));
    
    console.log(`\\n✅ Statistiques:`);
    console.log(`   📁 Total des fichiers: ${this.stats.totalFiles}`);
    console.log(`   🌙 Fichiers avec mode sombre: ${this.stats.filesWithDarkMode}`);
    console.log(`   📊 Couverture: ${Math.round((this.stats.filesWithDarkMode / this.stats.totalFiles) * 100)}%`);
    console.log(`   ⚠️  Problèmes potentiels: ${this.stats.potentialIssues}`);
    
    if (this.issues.length > 0) {
      console.log(`\\n🔍 Problèmes détectés:`);
      
      this.issues.forEach(({ file, issues }) => {
        console.log(`\\n📝 ${file}:`);
        issues.forEach(issue => {
          const icon = issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`   ${icon} ${issue.description}`);
        });
      });
    } else {
      console.log(`\\n🎉 Aucun problème majeur détecté !`);
    }
  }

  showOptimizationSuggestions() {
    console.log('\\n' + '=' .repeat(60));
    console.log('💡 SUGGESTIONS D\\'OPTIMISATION');
    console.log('=' .repeat(60));
    
    console.log(`\\n🚀 Améliorations recommandées:`);
    console.log(`   1. Utilisez le hook useChartTheme pour tous les graphiques`);
    console.log(`   2. Préférez les classes Tailwind aux styles inline`);
    console.log(`   3. Testez tous les composants en mode sombre`);
    console.log(`   4. Utilisez les variables CSS personnalisées pour les couleurs complexes`);
    
    console.log(`\\n🛠️  Commandes utiles:`);
    console.log(`   npm run dark-mode:analyze  - Analyser les classes manquantes`);
    console.log(`   npm start                  - Tester l'interface`);
    console.log(`   npm run build              - Générer la version de production`);
    
    console.log(`\\n📚 Documentation:`);
    console.log(`   - Hook useChartTheme: src/hooks/useChartTheme.js`);
    console.log(`   - Configuration Tailwind: tailwind.config.js`);
    console.log(`   - Context Theme: src/context/ThemeContext.js`);
  }
}

// Point d'entrée
if (require.main === module) {
  const validator = new DarkModeValidator();
  validator.run().catch(console.error);
}

module.exports = DarkModeValidator;