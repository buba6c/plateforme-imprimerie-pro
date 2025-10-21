#!/usr/bin/env node

/**
 * TEST ESTIMATION IA
 * Vérifie que l'estimation IA utilise le mapping des tarifs correctement
 */

const fs = require('fs');
const path = require('path');

// Charger directement les services
const openaiService = require('./backend/services/openaiService');
const dbHelper = require('./backend/utils/dbHelper');

async function testEstimationIA() {
  console.log('\n🤖 === TEST ESTIMATION IA ===\n');
  
  try {
    // Récupérer les tarifs depuis la DB
    console.log('📍 Étape 1: Charger les tarifs depuis la base');
    console.log('━'.repeat(50));
    
    const [rolandTarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE',
      ['roland']
    );
    
    const [xeroxTarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE',
      ['xerox']
    );
    
    console.log(`✅ ${rolandTarifs.length} tarifs Roland chargés`);
    console.log(`✅ ${xeroxTarifs.length} tarifs Xerox chargés\n`);
    
    // Test 1: Estimation IA Roland
    console.log('📍 Étape 2: Tester estimation IA Roland');
    console.log('━'.repeat(50));
    
    const testRoland = {
      type_support: 'Bâche',
      largeur: 200,
      hauteur: 300,
      unite: 'cm',
      nombre_exemplaires: 1,
    };
    
    const resultRoland = await openaiService.estimateQuoteManually(testRoland, 'roland', rolandTarifs);
    
    console.log(`✅ Résultat: ${resultRoland.prix_estime} FCFA`);
    console.log(`   Details: ${JSON.stringify(resultRoland.details.base, null, 2)}`);
    
    if (resultRoland.prix_estime > 0 && resultRoland.prix_estime === 42000) {
      console.log('   ✅ VALIDE: Bâche 6m² × 7000 FCFA/m² = 42000 FCFA\n');
    } else {
      console.log(`   ❌ INVALIDE: Attendu 42000, obtenu ${resultRoland.prix_estime}\n`);
    }
    
    // Test 2: Estimation IA Xerox
    console.log('📍 Étape 3: Tester estimation IA Xerox');
    console.log('━'.repeat(50));
    
    const testXerox = {
      type_document: 'Flyer',
      format: 'A4',
      nombre_pages: 100,
      couleur_impression: 'couleur',
      exemplaires: 1,
    };
    
    const resultXerox = await openaiService.estimateQuoteManually(testXerox, 'xerox', xeroxTarifs);
    
    console.log(`✅ Résultat: ${resultXerox.prix_estime} FCFA`);
    console.log(`   Details: ${JSON.stringify(resultXerox.details.base, null, 2)}`);
    
    if (resultXerox.prix_estime > 0) {
      console.log(`   ✅ VALIDE: A4 Couleur 100 pages × ${resultXerox.details.base.prix_page} FCFA = ${resultXerox.prix_estime} FCFA\n`);
    } else {
      console.log(`   ❌ INVALIDE: Prix 0 FCFA\n`);
    }
    
    console.log('📊 === RÉSUMÉ ===\n');
    
    const tests = [
      { name: 'Roland (Bâche)', prix: resultRoland.prix_estime, ok: resultRoland.prix_estime === 42000 },
      { name: 'Xerox (A4)', prix: resultXerox.prix_estime, ok: resultXerox.prix_estime > 0 },
    ];
    
    let passed = 0;
    for (const test of tests) {
      const status = test.ok ? '✅' : '❌';
      console.log(`${status} ${test.name}: ${test.prix} FCFA`);
      if (test.ok) passed++;
    }
    
    console.log(`\n${passed === tests.length ? '✅ TOUS LES TESTS SONT PASSÉS!' : '❌ CERTAINS TESTS ONT ÉCHOUÉ'}\n`);
    
    process.exit(passed === tests.length ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testEstimationIA();
