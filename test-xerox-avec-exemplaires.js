const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testXeroxEstimation() {
  console.log('\n🧪 TEST XEROX - Différentes combinaisons\n');

  // Test 1: Avec nombre_exemplaires = 100 (pas de nombre_pages)
  console.log('📦 Test 1: Format A4 + 100 exemplaires');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        format: 'A4',
        nombre_exemplaires: 100,
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('   is_partial:', response.data.is_partial);
    console.log('   breakdown:', JSON.stringify(response.data.details.breakdown.base.pages, null, 2));
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }

  // Test 2: Avec nombre_pages = 100 et nombre_exemplaires = 1
  console.log('\n📦 Test 2: Format A4 + 100 pages + 1 exemplaire');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        format: 'A4',
        nombre_pages: 100,
        nombre_exemplaires: 1,
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('   is_partial:', response.data.is_partial);
    console.log('   breakdown:', JSON.stringify(response.data.details.breakdown.base.pages, null, 2));
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }

  // Test 3: Avec nombre_pages = 1 et nombre_exemplaires = 100
  console.log('\n📦 Test 3: Format A4 + 1 page + 100 exemplaires');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        format: 'A4',
        nombre_pages: 1,
        nombre_exemplaires: 100,
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('   is_partial:', response.data.is_partial);
    console.log('   breakdown:', JSON.stringify(response.data.details.breakdown.base.pages, null, 2));
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }
}

testXeroxEstimation();
