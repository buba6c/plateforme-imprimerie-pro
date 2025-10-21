#!/usr/bin/env node

const dbHelper = require('./backend/utils/dbHelper');

(async () => {
  try {
    console.log('\n📊 === AUDIT TARIFS XEROX ===\n');
    
    // Tous les tarifs Xerox
    const [xeroxTarifs] = await dbHelper.query(
      'SELECT cle, label, valeur, unite FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE ORDER BY cle',
      ['xerox']
    );
    
    console.log('📋 TARIFS XEROX DISPONIBLES:\n');
    for (const t of xeroxTarifs) {
      console.log(`  • ${t.cle.padEnd(30)} | ${t.label.padEnd(30)} | ${t.valeur} FCFA/${t.unite}`);
    }
    
    // Grouper par catégorie
    console.log('\n\n📂 GROUPÉS PAR CATÉGORIE:\n');
    const categories = {};
    for (const t of xeroxTarifs) {
      const prefix = t.cle.split('_')[0];
      if (!categories[prefix]) categories[prefix] = [];
      categories[prefix].push(t);
    }
    
    for (const [cat, tarifs] of Object.entries(categories)) {
      console.log(`🏷️  ${cat.toUpperCase()}:`);
      for (const t of tarifs) {
        console.log(`   → ${t.cle}: ${t.label}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
})();
