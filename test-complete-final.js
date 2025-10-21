#!/usr/bin/env node

/**
 * TEST COMPLET FINAL
 * Valide Roland, Xerox et Estimation IA
 */

const axios = require('axios');
const openaiService = require('./backend/services/openaiService');
const dbHelper = require('./backend/utils/dbHelper');

const API_URL = 'http://localhost:5001/api';

async function testAll() {
  console.log('\n🎯 === TEST COMPLET FINAL ===\n');
  
  try {
    // Charger les tarifs
    const [rolandTarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE',
      ['roland']
    );
    
    const [xeroxTarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE',
      ['xerox']
    );
    
    let results = [];
    
    // TEST 1: Roland API (Temps réel)
    console.log('📍 TEST 1: Roland - Estimation Temps Réel (API)');
    console.log('━'.repeat(60));
    try {
      const resp1 = await axios.post(`${API_URL}/devis/estimate-realtime`, {
        formData: { type_support: 'Bâche', largeur: 200, hauteur: 300, unite: 'cm' },
        machineType: 'roland'
      });
      const ok1 = resp1.data.prix_estime === 42000;
      console.log(`${ok1 ? '✅' : '❌'} Roland (Temps réel): ${resp1.data.prix_estime} FCFA${ok1 ? '' : ' (attendu: 42000)'}`);
      results.push(ok1);
    } catch (e) {
      console.log(`❌ Roland (Temps réel): ${e.message}`);
      results.push(false);
    }
    
    // TEST 2: Xerox API (Temps réel)
    console.log('\n📍 TEST 2: Xerox - Estimation Temps Réel (API)');
    console.log('━'.repeat(60));
    try {
      const resp2 = await axios.post(`${API_URL}/devis/estimate-realtime`, {
        formData: { format: 'A4', nombre_pages: 100, couleur_impression: 'couleur' },
        machineType: 'xerox'
      });
      const ok2 = resp2.data.prix_estime > 0;
      console.log(`${ok2 ? '✅' : '❌'} Xerox (Temps réel): ${resp2.data.prix_estime} FCFA`);
      results.push(ok2);
    } catch (e) {
      console.log(`❌ Xerox (Temps réel): ${e.message}`);
      results.push(false);
    }
    
    // TEST 3: Roland IA (Fallback)
    console.log('\n📍 TEST 3: Roland - Estimation IA');
    console.log('━'.repeat(60));
    try {
      const result3 = await openaiService.estimateQuoteManually(
        { type_support: 'Vinyle', largeur: 150, hauteur: 100, unite: 'cm' },
        'roland',
        rolandTarifs
      );
      const ok3 = result3.prix_estime === 14250; // 1.5m² × 9500 FCFA/m²
      console.log(`${ok3 ? '✅' : '❌'} Roland (IA): ${result3.prix_estime} FCFA${ok3 ? '' : ' (attendu: 14250)'}`);
      results.push(ok3);
    } catch (e) {
      console.log(`❌ Roland (IA): ${e.message}`);
      results.push(false);
    }
    
    // TEST 4: Xerox IA (Fallback)
    console.log('\n📍 TEST 4: Xerox - Estimation IA');
    console.log('━'.repeat(60));
    try {
      const result4 = await openaiService.estimateQuoteManually(
        { format: 'A3', nombre_pages: 50, couleur_impression: 'couleur' },
        'xerox',
        xeroxTarifs
      );
      const ok4 = result4.prix_estime > 0;
      console.log(`${ok4 ? '✅' : '❌'} Xerox (IA): ${result4.prix_estime} FCFA`);
      results.push(ok4);
    } catch (e) {
      console.log(`❌ Xerox (IA): ${e.message}`);
      results.push(false);
    }
    
    // TEST 5: Tous les supports Roland
    console.log('\n📍 TEST 5: Tous les supports Roland');
    console.log('━'.repeat(60));
    const supports = ['Bâche', 'Vinyle', 'Tissu', 'Backlit', 'Kakemono'];
    let supportsPassed = 0;
    for (const support of supports) {
      try {
        const resp = await axios.post(`${API_URL}/devis/estimate-realtime`, {
          formData: { type_support: support, largeur: 100, hauteur: 100, unite: 'cm' },
          machineType: 'roland'
        });
        if (resp.data.prix_estime > 0) {
          console.log(`✅ ${support}: ${resp.data.prix_estime} FCFA`);
          supportsPassed++;
        }
      } catch (e) {
        console.log(`❌ ${support}: ${e.message}`);
      }
    }
    results.push(supportsPassed === supports.length);
    
    // RÉSUMÉ
    console.log('\n📊 === RÉSUMÉ FINAL ===\n');
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`✅ Tests réussis: ${passed}/${total}`);
    console.log(`❌ Tests échoués: ${total - passed}/${total}`);
    
    if (passed === total) {
      console.log('\n🎉 TOUS LES TESTS SONT PASSÉS!');
      console.log('\n✅ Le fix fonctionne pour:');
      console.log('  • Estimation temps réel Roland');
      console.log('  • Estimation temps réel Xerox');
      console.log('  • Estimation IA Roland');
      console.log('  • Estimation IA Xerox');
      console.log('  • Tous les supports Roland\n');
      process.exit(0);
    } else {
      console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

testAll();
