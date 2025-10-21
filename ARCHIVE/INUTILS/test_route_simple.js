#!/usr/bin/env node
/**
 * Test simple d'une route dossiers sans dépendances externes
 */

console.log('🔍 Test minimal route dossiers...');

// Test minimal sans dépendances externes
try {
  const express = require('express');
  const router = express.Router();
  
  // Route GET simple pour test
  router.get('/', (req, res) => {
    res.json({ message: 'Test route dossiers OK' });
  });
  
  console.log('✅ Route de test créée avec succès');
  console.log('Type:', typeof router);
  
  module.exports = router;
  
} catch (error) {
  console.error('❌ Erreur création route test:', error.message);
}