const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001/api';

async function test() {
  try {
    let xeroxData = {
      type_document: 'xerox',
      format: 'A4',
      nombre_exemplaires: '100',
      couleur_impression: 'couleur',
    };

    let response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: xeroxData,
      machineType: 'xerox'
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

test();
