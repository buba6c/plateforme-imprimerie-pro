#!/usr/bin/env node
/**
 * Diagnostic de chargement des routes
 */

console.log('🔍 Diagnostic de chargement des routes...\n');

// Test de chargement de chaque route
const routes = [
  'auth',
  'dossiers', 
  'files',
  'users',
  'statistiques',
  'activites-recentes',
  'system-config'
];

for (const routeName of routes) {
  try {
    console.log(`📁 Test route: ${routeName}`);
    const route = require(`./routes/${routeName}`);
    
    if (route && typeof route === 'function') {
      console.log(`✅ Route ${routeName} chargée correctement (function)`);
    } else if (route && route.router) {
      console.log(`✅ Route ${routeName} chargée correctement (router object)`);
    } else if (route) {
      console.log(`⚠️  Route ${routeName} chargée mais type inattendu:`, typeof route);
    } else {
      console.log(`❌ Route ${routeName} est null/undefined`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur chargement route ${routeName}:`, error.message);
    
    // Détail de l'erreur pour diagnostic
    if (error.message.includes('Unexpected token')) {
      console.log(`   🔧 Erreur de syntaxe dans routes/${routeName}.js`);
    }
  }
}

console.log('\n🔧 Test chargement dépendances communes...');

// Test des dépendances communes
const dependencies = [
  'express',
  '../config/database',
  '../middleware/auth',
  '../utils/validators',
  '../middleware/permissions',
  '../services/socketService'
];

for (const dep of dependencies) {
  try {
    require(dep);
    console.log(`✅ ${dep} chargé`);
  } catch (error) {
    console.log(`❌ Erreur ${dep}: ${error.message}`);
  }
}