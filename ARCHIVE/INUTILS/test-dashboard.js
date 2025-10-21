// Test rapide pour vérifier les imports des dashboards
const React = require('react');

try {
  console.log('🧪 Test des imports des dashboards...\n');
  
  // Test de l'import du dashboard préparateur
  console.log('✅ Test: Import PreparateurDashboardUltraModern');
  const prep = require('./src/components/PreparateurDashboardUltraModern.js');
  console.log('✅ PreparateurDashboardUltraModern importé avec succès');
  
  // Test de l'import du dashboard imprimeur
  console.log('✅ Test: Import ImprimeurDashboardUltraModern');
  const imp = require('./src/components/ImprimeurDashboardUltraModern.js');
  console.log('✅ ImprimeurDashboardUltraModern importé avec succès');
  
  // Test de l'import du dashboard livreur  
  console.log('✅ Test: Import LivreurDashboardUltraModern');
  const liv = require('./src/components/LivreurDashboardUltraModern.js');
  console.log('✅ LivreurDashboardUltraModern importé avec succès');
  
  // Test de l'index des dashboards
  console.log('✅ Test: Import dashboards index');
  const dashboards = require('./src/components/dashboards/index.js');
  console.log('✅ Dashboards index importé avec succès');
  
  console.log('\n🎉 Tous les tests d\'import sont passés avec succès!');
  console.log('📱 Les dashboards sont prêts à être utilisés.\n');
  
} catch (error) {
  console.error('❌ Erreur lors du test:', error.message);
  console.error('📍 Chemin de l\'erreur:', error.stack);
  process.exit(1);
}