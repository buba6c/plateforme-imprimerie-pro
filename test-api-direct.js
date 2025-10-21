const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/devis';

async function testEstimateRealtime() {
  console.log('\n✅ TEST 1: Estimation temps réel ROLAND');
  try {
    const response = await axios.post(`${BASE_URL}/estimate-realtime`, {
      formData: {
        type_support: 'Bâche',
        largeur: 100,
        hauteur: 60,
        unite: 'cm'
      },
      machineType: 'roland'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

async function testEstimateRealtimeXerox() {
  console.log('\n✅ TEST 2: Estimation temps réel XEROX');
  try {
    const response = await axios.post(`${BASE_URL}/estimate-realtime`, {
      formData: {
        format: 'A4',
        nombre_pages: 100,
        nombre_exemplaires: 1,
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

(async () => {
  await testEstimateRealtime();
  await testEstimateRealtimeXerox();
})();
