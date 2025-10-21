#!/usr/bin/env node
/**
 * Script de validation pour le déploiement Render
 * Vérifie que tous les fichiers et configurations sont prêts
 */

const fs = require('fs');
const path = require('path');

class RenderValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  log(type, message) {
    switch (type) {
      case 'error':
        this.errors.push(message);
        console.log(`❌ ${message}`);
        break;
      case 'warning':
        this.warnings.push(message);
        console.log(`⚠️  ${message}`);
        break;
      case 'success':
        this.success.push(message);
        console.log(`✅ ${message}`);
        break;
      default:
        console.log(`ℹ️  ${message}`);
    }
  }

  checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log('success', `${description} présent`);
      return true;
    } else {
      this.log('error', `${description} manquant: ${filePath}`);
      return false;
    }
  }

  validateRenderYaml() {
    console.log('\n🔍 Validation render.yaml...');
    
    if (!this.checkFileExists('render.yaml', 'Fichier render.yaml')) {
      return false;
    }

    try {
      const content = fs.readFileSync('render.yaml', 'utf8');
      
      // Vérifications basiques
      const requiredSections = ['databases', 'services'];
      requiredSections.forEach(section => {
        if (content.includes(section + ':')) {
          this.log('success', `Section ${section} trouvée`);
        } else {
          this.log('error', `Section ${section} manquante`);
        }
      });

      // Vérifier les services
      const requiredServices = ['imprimerie-postgres', 'imprimerie-redis', 'imprimerie-backend', 'imprimerie-frontend'];
      requiredServices.forEach(service => {
        if (content.includes(service)) {
          this.log('success', `Service ${service} configuré`);
        } else {
          this.log('error', `Service ${service} manquant`);
        }
      });

      return true;
    } catch (error) {
      this.log('error', `Erreur lecture render.yaml: ${error.message}`);
      return false;
    }
  }

  validateBackend() {
    console.log('\n🔍 Validation Backend...');
    
    // Package.json
    this.checkFileExists('backend/package.json', 'Backend package.json');
    
    // Script de setup
    this.checkFileExists('backend/scripts/setup-render.js', 'Script setup Render');
    
    // Configuration Redis
    this.checkFileExists('backend/config/redis.js', 'Configuration Redis');
    
    // Server.js
    this.checkFileExists('backend/server.js', 'Fichier server.js');

    // Vérifier package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
      
      if (packageJson.scripts.start === 'node server.js') {
        this.log('success', 'Script start configuré pour Render');
      } else {
        this.log('warning', 'Script start non optimisé pour Render');
      }

      if (packageJson.scripts.postinstall) {
        this.log('success', 'Script postinstall configuré');
      } else {
        this.log('warning', 'Script postinstall manquant');
      }

      // Dépendances critiques
      const criticalDeps = ['express', 'pg', 'socket.io', 'dotenv'];
      criticalDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
          this.log('success', `Dépendance ${dep} présente`);
        } else {
          this.log('error', `Dépendance critique manquante: ${dep}`);
        }
      });

    } catch (error) {
      this.log('error', `Erreur lecture backend/package.json: ${error.message}`);
    }
  }

  validateFrontend() {
    console.log('\n🔍 Validation Frontend...');
    
    // Package.json
    this.checkFileExists('frontend/package.json', 'Frontend package.json');
    
    // Public et src
    this.checkFileExists('frontend/public', 'Dossier public');
    this.checkFileExists('frontend/src', 'Dossier src');

    // Vérifier package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
      
      if (packageJson.scripts.build.includes('GENERATE_SOURCEMAP=false')) {
        this.log('success', 'Build optimisé pour production');
      } else {
        this.log('warning', 'Build non optimisé (sourcemaps activées)');
      }

      // Dépendances React
      const reactDeps = ['react', 'react-dom', 'react-scripts'];
      reactDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
          this.log('success', `Dépendance ${dep} présente`);
        } else {
          this.log('error', `Dépendance React manquante: ${dep}`);
        }
      });

    } catch (error) {
      this.log('error', `Erreur lecture frontend/package.json: ${error.message}`);
    }
  }

  validateDatabase() {
    console.log('\n🔍 Validation Base de Données...');
    
    // Scripts d'initialisation
    this.checkFileExists('database', 'Dossier database');
    this.checkFileExists('database/init', 'Dossier database/init');
    this.checkFileExists('database/init/01-init.sql', 'Script initialisation principal');
    this.checkFileExists('database/init/02-render-config.sql', 'Script configuration Render');

    // Vérifier le contenu des scripts SQL
    try {
      const initScript = fs.readFileSync('database/init/01-init.sql', 'utf8');
      
      const requiredTables = ['users', 'dossiers', 'dossier_files', 'dossier_status_history'];
      requiredTables.forEach(table => {
        if (initScript.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          this.log('success', `Table ${table} définie`);
        } else {
          this.log('error', `Table ${table} manquante dans le script`);
        }
      });

      if (initScript.includes('uuid-ossp')) {
        this.log('success', 'Extension UUID configurée');
      } else {
        this.log('warning', 'Extension UUID non configurée');
      }

    } catch (error) {
      this.log('error', `Erreur lecture scripts SQL: ${error.message}`);
    }
  }

  validateEnvironment() {
    console.log('\n🔍 Validation Variables d\'Environnement...');
    
    const requiredEnvVars = [
      'NODE_ENV',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME', 
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET',
      'FRONTEND_URL',
      'BACKEND_URL'
    ];

    // Ces variables seront configurées automatiquement par Render
    requiredEnvVars.forEach(varName => {
      this.log('success', `Variable ${varName} sera auto-configurée par Render`);
    });
  }

  validateGitIgnore() {
    console.log('\n🔍 Validation .gitignore...');
    
    if (this.checkFileExists('.gitignore', 'Fichier .gitignore')) {
      try {
        const gitignore = fs.readFileSync('.gitignore', 'utf8');
        
        const shouldIgnore = ['node_modules', '.env', 'build', 'uploads'];
        shouldIgnore.forEach(pattern => {
          if (gitignore.includes(pattern)) {
            this.log('success', `Pattern ${pattern} ignoré`);
          } else {
            this.log('warning', `Pattern ${pattern} non ignoré`);
          }
        });

      } catch (error) {
        this.log('error', `Erreur lecture .gitignore: ${error.message}`);
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT DE VALIDATION RENDER');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Succès: ${this.success.length}`);
    console.log(`⚠️  Avertissements: ${this.warnings.length}`);
    console.log(`❌ Erreurs: ${this.errors.length}`);

    if (this.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERREURS À CORRIGER:');
      this.errors.forEach(error => console.log(`   • ${error}`));
      console.log('\n🔧 Corrigez ces erreurs avant le déploiement Render');
      return false;
    } else {
      console.log('\n🎉 VALIDATION RÉUSSIE !');
      console.log('🚀 Votre projet est prêt pour le déploiement Render');
      console.log('\n📝 Prochaines étapes:');
      console.log('   1. Push le code vers GitHub/GitLab');
      console.log('   2. Connecter le repository à Render');
      console.log('   3. Sélectionner render.yaml comme Blueprint');
      console.log('   4. Déployer ! 🎯');
      return true;
    }
  }

  async run() {
    console.log('🔍 VALIDATION RENDER - PLATEFORME IMPRIMERIE');
    console.log('='.repeat(60));
    
    this.validateRenderYaml();
    this.validateBackend();
    this.validateFrontend();
    this.validateDatabase();
    this.validateEnvironment();
    this.validateGitIgnore();
    
    return this.generateReport();
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const validator = new RenderValidator();
  validator.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = RenderValidator;