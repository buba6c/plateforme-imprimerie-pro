const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testXeroxEnvoi() {
  try {
    const xeroxData = {
      client: '',
      type_document: 'xerox',
      format: 'A4',
      nombre_exemplaires: '100',
      couleur_impression: 'couleur',
      mode_impression: 'recto_simple',
      grammage: '80',
      finition: [],
      faconnage: [],
      conditionnement: [],
    };

    const response = await axios.post(
      `${API_URL}/devis/estimate-realtime`,
      { formData: xeroxData, machineType: 'xerox' }
    );

    console.log('✅ Réponse complète:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testXeroxEnvoi();
