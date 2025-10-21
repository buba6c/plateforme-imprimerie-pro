#!/usr/bin/env node
/**
 * Solution complète pour corriger le problème "Dossier non trouvé"
 * 
 * Ce script identifie et corrige les problèmes d'authentification frontend
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_BASE = 'http://localhost:5001/api';

// Credentials valides (générées par reset-admin-user.js)
const VALID_CREDENTIALS = {
  email: 'admin@test.local',
  password: 'admin123'
};

class FrontendAuthFixer {
  constructor() {
    this.validToken = null;
  }

  async getValidToken() {
    if (this.validToken) return this.validToken;
    
    console.log('🔑 Obtention d\'un token valide...');
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, VALID_CREDENTIALS);
      this.validToken = response.data.token;
      console.log('✅ Token obtenu avec succès');
      return this.validToken;
    } catch (error) {
      throw new Error(`Erreur login: ${error.response?.data?.message || error.message}`);
    }
  }

  async testApiAccess() {
    console.log('\n🧪 TEST ACCÈS API...\n');
    
    const token = await this.getValidToken();
    
    // Test 1: Liste des dossiers
    try {
      const response = await axios.get(`${API_BASE}/dossiers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`✅ GET /dossiers: ${response.data.dossiers.length} dossiers`);
    } catch (error) {
      console.log(`❌ GET /dossiers: ${error.response?.status} - ${error.response?.data?.message}`);
    }

    // Test 2: Accès dossier individuel
    try {
      const listResponse = await axios.get(`${API_BASE}/dossiers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (listResponse.data.dossiers.length > 0) {
        const firstDossierId = listResponse.data.dossiers[0].id;
        const detailResponse = await axios.get(`${API_BASE}/dossiers/${firstDossierId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`✅ GET /dossiers/:id: Dossier "${detailResponse.data.dossier?.client || detailResponse.data.client}" accessible`);
      }
    } catch (error) {
      console.log(`❌ GET /dossiers/:id: ${error.response?.status} - ${error.response?.data?.message}`);
    }
  }

  async checkFrontendConfig() {
    console.log('\n🔍 VÉRIFICATION CONFIG FRONTEND...\n');
    
    const frontendDir = '/Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151/frontend';
    
    // 1. Vérifier le fichier de configuration API
    try {
      const apiConfigPath = path.join(frontendDir, 'src/services/api.js');
      const apiConfig = await fs.readFile(apiConfigPath, 'utf8');
      
      console.log('📄 Configuration API frontend:');
      
      // Extraire l'URL de base
      const urlMatch = apiConfig.match(/API_BASE_URL.*?=.*?['"`](.*?)['"`]/);
      if (urlMatch) {
        console.log(`  • URL Base: ${urlMatch[1]}`);
      }
      
      // Vérifier l'intercepteur d'authentification
      if (apiConfig.includes('Authorization') && apiConfig.includes('Bearer')) {
        console.log('  ✅ Intercepteur Authorization configuré');
      } else {
        console.log('  ❌ Intercepteur Authorization manquant');
      }
      
      // Vérifier localStorage
      if (apiConfig.includes('localStorage.getItem')) {
        console.log('  ✅ LocalStorage utilisé pour les tokens');
      }
      
    } catch (error) {
      console.log(`❌ Erreur lecture config API: ${error.message}`);
    }
  }

  async generateFrontendAuthFix() {
    console.log('\n🛠️  GÉNÉRATION FIX FRONTEND...\n');
    
    const token = await this.getValidToken();
    
    // Générer un script pour corriger l'authentification frontend
    const fixScript = `
// 🔧 SCRIPT DE CORRECTION AUTHENTIFICATION FRONTEND
// Copier ce code dans la console du navigateur (F12)

console.log('🔧 Correction authentification frontend...');

// 1. Nettoyer l'ancien token
localStorage.removeItem('auth_token');
localStorage.removeItem('user');

// 2. Définir le nouveau token valide
const validToken = '${token}';
const validUser = {
  id: 23,
  nom: 'Admin Test Reset',
  email: 'admin@test.local',
  role: 'admin'
};

// 3. Sauvegarder dans localStorage
localStorage.setItem('auth_token', validToken);
localStorage.setItem('user', JSON.stringify(validUser));

console.log('✅ Token mis à jour:', validToken.substring(0, 30) + '...');
console.log('✅ Utilisateur sauvegardé:', validUser);

// 4. Recharger la page pour appliquer les changements
console.log('🔄 Rechargement de la page...');
setTimeout(() => {
  window.location.reload();
}, 1000);
`;

    // Sauvegarder le script de fix
    const fixFilePath = path.join(process.cwd(), 'frontend-auth-fix.js');
    await fs.writeFile(fixFilePath, fixScript);
    
    console.log(`📝 Script de correction généré: ${fixFilePath}`);
    console.log('\n📋 INSTRUCTIONS:');
    console.log('1. Ouvrir http://localhost:3001 dans le navigateur');
    console.log('2. Ouvrir la console développeur (F12)');
    console.log('3. Copier-coller le contenu du fichier frontend-auth-fix.js');
    console.log('4. Appuyer sur Entrée pour exécuter');
    console.log('5. La page se rechargera automatiquement');
    console.log('6. Tester les boutons "Voir", "Modifier", etc.');
  }

  async generateLoginCredentials() {
    console.log('\n🎯 CREDENTIALS POUR LOGIN MANUEL...\n');
    
    console.log('Si vous préférez vous authentifier manuellement:');
    console.log(`📧 Email: ${VALID_CREDENTIALS.email}`);
    console.log(`🔐 Password: ${VALID_CREDENTIALS.password}`);
    console.log('\nUtilisez ces credentials sur la page de login à http://localhost:3001');
  }

  async run() {
    console.log('🚀 CORRECTION PROBLÈME "DOSSIER NON TROUVÉ"\n');
    console.log('=' .repeat(50));
    
    try {
      await this.getValidToken();
      await this.testApiAccess();
      await this.checkFrontendConfig();
      await this.generateFrontendAuthFix();
      await this.generateLoginCredentials();
      
      console.log('\n🎉 CORRECTION TERMINÉE !');
      console.log('\nLe problème "Dossier non trouvé" devrait être résolu après application du fix.');
      
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

// Exécuter le fix
if (require.main === module) {
  const fixer = new FrontendAuthFixer();
  fixer.run();
}

module.exports = FrontendAuthFixer;