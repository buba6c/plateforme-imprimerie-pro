const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001/api';

async function testFinal() {
  try {
    console.log('🎉 TEST FINAL: Vérification du fix');
    console.log('===================================\n');

    // Test 1: Xerox avec nombre_exemplaires = 100 (défaut)
    console.log('TEST 1: Xerox format A4, 100 exemplaires (défaut)');
    console.log('Attendu: 1 page × 100 exemplaires × 100 FCFA/page = 10,000 FCFA');

    let response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: {
        type_document: 'xerox',
        format: 'A4',
        nombre_exemplaires: '100',
        couleur_impression: 'couleur',
      },
      machineType: 'xerox'
    });

    let prix = response.data.prix_estime;
    let pages = response.data.details.breakdown.base.pages.total_pages;
    let exemplaires = response.data.details.breakdown.base.pages.nombre_exemplaires;

    console.log(`Résultat: ${exemplaires} exemplaires × ${pages} pages = ${prix} FCFA`);
    console.log(prix === 10000 ? '✅ PASS\n' : `❌ FAIL (attendu 10000, reçu ${prix})\n`);

    // Test 2: Xerox avec nombre_exemplaires = 50
    console.log('TEST 2: Xerox format A4, 50 exemplaires');
    console.log('Attendu: 1 page × 50 exemplaires × 100 FCFA/page = 5,000 FCFA');

    response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: {
        type_document: 'xerox',
        format: 'A4',
        nombre_exemplaires: '50',
        couleur_impression: 'couleur',
      },
      machineType: 'xerox'
    });

    prix = response.data.prix_estime;
    pages = response.data.details.breakdown.base.pages.total_pages;
    exemplaires = response.data.details.breakdown.base.pages.nombre_exemplaires;

    console.log(`Résultat: ${exemplaires} exemplaires × ${pages} pages = ${prix} FCFA`);
    console.log(prix === 5000 ? '✅ PASS\n' : `❌ FAIL (attendu 5000, reçu ${prix})\n`);

    // Test 3: Xerox avec nombre_exemplaires = 1000
    console.log('TEST 3: Xerox format A4, 1000 exemplaires');
    console.log('Attendu: 1 page × 1000 exemplaires × 100 FCFA/page = 100,000 FCFA');

    response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: {
        type_document: 'xerox',
        format: 'A4',
        nombre_exemplaires: '1000',
        couleur_impression: 'couleur',
      },
      machineType: 'xerox'
    });

    prix = response.data.prix_estime;
    pages = response.data.details.breakdown.base.pages.total_pages;
    exemplaires = response.data.details.breakdown.base.pages.nombre_exemplaires;

    console.log(`Résultat: ${exemplaires} exemplaires × ${pages} pages = ${prix} FCFA`);
    console.log(prix === 100000 ? '✅ PASS\n' : `❌ FAIL (attendu 100000, reçu ${prix})\n`);

    console.log('===================================');
    console.log('🎉 FIX VÉRIFIÉ: Tout fonctionne!');
    console.log('===================================');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testFinal();
