const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testFormDataXerox() {
  console.log('\n🔍 TEST: Quels données Xerox ne rencontrent PAS?');
  
  // Test 1: Données minimales
  console.log('\n📦 Test 1: Données minimales Xerox');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        type_document: '',
        format: '',
        nombre_pages: '',
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('Prix:', response.data.prix_estime, '- Partial:', response.data.is_partial);
  } catch (e) {
    console.error('Erreur:', e.response?.data || e.message);
  }

  // Test 2: Avec format seulement
  console.log('\n📦 Test 2: Avec format seulement');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        format: 'A4',
        nombre_pages: 100,
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('Prix:', response.data.prix_estime, '- Partial:', response.data.is_partial);
    console.log('Details:', JSON.stringify(response.data.details, null, 2));
  } catch (e) {
    console.error('Erreur:', e.response?.data || e.message);
  }

  // Test 3: Avec type_document
  console.log('\n📦 Test 3: Avec type_document');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        type_document: 'Flyer',
        nombre_pages: 100,
        couleur_impression: 'couleur'
      },
      machineType: 'xerox'
    });
    console.log('Prix:', response.data.prix_estime, '- Partial:', response.data.is_partial);
    console.log('Details:', JSON.stringify(response.data.details, null, 2));
  } catch (e) {
    console.error('Erreur:', e.response?.data || e.message);
  }

  // Test 4: Complète avec tout
  console.log('\n📦 Test 4: Complète avec tout');
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        format: 'A4',
        type_document: 'Flyer',
        nombre_pages: 100,
        nombre_exemplaires: 1,
        couleur_impression: 'couleur',
        grammage: '100g'
      },
      machineType: 'xerox'
    });
    console.log('Prix:', response.data.prix_estime, '- Partial:', response.data.is_partial);
    console.log('Details:', JSON.stringify(response.data.details, null, 2));
  } catch (e) {
    console.error('Erreur:', e.response?.data || e.message);
  }
}

testFormDataXerox();
